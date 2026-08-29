-- Maintenance Matrix redaction lifecycle.
--
-- This migration deliberately stores only technical dispatch/session metadata:
-- Matrix event IDs and timestamps. It never stores opening-phrase plaintext,
-- answer-phrase text, Matrix message bodies, conversations or memory.
--
-- Command sequence:
-- 1. begin_maintenance_command(candidate) verifies bcrypt and creates a
--    120-second dispatch token, but does NOT open Maintenance.
-- 2. The trusted E2EE Matrix adapter redacts the triggering Matrix event.
-- 3. open_maintenance_after_redaction(dispatch_id, trigger_event_id) consumes
--    that single-use dispatch and opens Maintenance atomically.
-- 4. The adapter sends the configured answer and binds its returned Matrix
--    event ID to this technical session.
--
-- Closing always changes network state first; answer-event redaction is
-- separately queued best effort and auditable.

-- Retire the earlier PoC RPC that could open access directly after phrase
-- verification. The only remaining opening path is the redaction-first
-- begin_maintenance_command -> Matrix redact ->
-- open_maintenance_after_redaction sequence below.
drop function if exists public.try_open_maintenance(text);

create table if not exists public.maintenance_command_dispatches (
  id uuid primary key default gen_random_uuid(),
  expires_at timestamptz not null default now() + interval '2 minutes',
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_sessions (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'OPEN',
  room_id text not null,
  trigger_event_id text not null unique,
  answer_event_id text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  answer_redaction_status text not null default 'NOT_READY',
  answer_redaction_attempted_at timestamptz,
  answer_redacted_at timestamptz,
  answer_redaction_error text,
  constraint maintenance_sessions_status_valid check (status in ('OPEN', 'CLOSED')),
  constraint maintenance_sessions_answer_redaction_status_valid
    check (answer_redaction_status in ('NOT_READY', 'PENDING', 'REDACTED', 'FAILED'))
);

create unique index if not exists maintenance_sessions_one_open
  on public.maintenance_sessions ((status = 'OPEN'))
  where status = 'OPEN';

alter table public.maintenance_command_dispatches enable row level security;
alter table public.maintenance_sessions enable row level security;

-- Only server-side service-role calls may interact with command/session
-- lifecycle data. Superadmins use the existing narrow close_maintenance()
-- RPC; they do not need direct access to Matrix event metadata.

create or replace function public.begin_maintenance_command(candidate text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  row_hash text;
  row_answer text;
  dispatch_id uuid;
begin
  select opening_phrase_hash, answer_phrase
    into row_hash, row_answer
    from public.maintenance_access
    where id = true;

  if row_hash is null
     or candidate is null
     or length(trim(candidate)) = 0
     or length(trim(coalesce(row_answer, ''))) = 0
     or row_hash <> crypt(candidate, row_hash) then
    return null;
  end if;

  insert into public.maintenance_command_dispatches default values
    returning id into dispatch_id;
  return dispatch_id;
end;
$$;

revoke all on function public.begin_maintenance_command(text) from public;
grant execute on function public.begin_maintenance_command(text) to service_role;

create or replace function public.open_maintenance_after_redaction(
  dispatch_id uuid,
  trigger_event_id text,
  room_id text
)
returns table (opened boolean, session_id uuid, answer_phrase text)
language plpgsql
security definer
set search_path = public
as $$
declare
  answer text;
  existing_session uuid;
  new_session uuid;
begin
  if dispatch_id is null
     or trigger_event_id is null
     or length(trim(trigger_event_id)) = 0
     or room_id is null
     or length(trim(room_id)) = 0 then
    return query select false, null::uuid, null::text;
    return;
  end if;

  update public.maintenance_command_dispatches
    set consumed_at = now()
    where id = dispatch_id
      and consumed_at is null
      and expires_at >= now();
  if not found then
    return query select false, null::uuid, null::text;
    return;
  end if;

  select maintenance_access.answer_phrase
    into answer
    from public.maintenance_access
    where id = true;
  if length(trim(coalesce(answer, ''))) = 0 then
    return query select false, null::uuid, null::text;
    return;
  end if;

  -- Security transition first. A previous session's answer is queued for
  -- cosmetic cleanup but can never delay closing/replacing access.
  update public.maintenance_access
    set status = 'OPEN', opened_at = now(), last_activity_at = now(), updated_at = now()
    where id = true;

  update public.maintenance_sessions
    set status = 'CLOSED',
        closed_at = now(),
        answer_redaction_status = case
          when answer_event_id is null then answer_redaction_status
          else 'PENDING'
        end
    where status = 'OPEN'
    returning id into existing_session;

  -- The partial unique index permits exactly one new OPEN session.
  insert into public.maintenance_sessions (trigger_event_id, room_id)
    values (trigger_event_id, room_id)
    returning id into new_session;

  return query select true, new_session, answer;
exception
  when unique_violation then
    -- Retried opening event: never create a duplicate session or answer.
    return query select false, null::uuid, null::text;
end;
$$;

revoke all on function public.open_maintenance_after_redaction(uuid, text, text) from public;
grant execute on function public.open_maintenance_after_redaction(uuid, text, text) to service_role;

create or replace function public.record_maintenance_answer_event(
  trigger_event_id text,
  matrix_answer_event_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.maintenance_sessions
    set answer_event_id = matrix_answer_event_id,
        answer_redaction_status = case when status = 'CLOSED' then 'PENDING' else 'NOT_READY' end
    where maintenance_sessions.trigger_event_id = $1
      and maintenance_sessions.answer_event_id is null;
end;
$$;

revoke all on function public.record_maintenance_answer_event(text, text) from public;
grant execute on function public.record_maintenance_answer_event(text, text) to service_role;

create or replace function public.close_maintenance()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Closing is the critical, first operation. Do not move this below any
  -- answer-redaction bookkeeping.
  update public.maintenance_access set status = 'CLOSED' where id = true;
  update public.maintenance_sessions
    set status = 'CLOSED',
        closed_at = coalesce(closed_at, now()),
        answer_redaction_status = case
          when answer_event_id is null then answer_redaction_status
          else 'PENDING'
        end
    where status = 'OPEN';
end;
$$;

revoke all on function public.close_maintenance() from public;
grant execute on function public.close_maintenance() to authenticated, service_role;

create or replace function public.auto_close_maintenance()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.maintenance_access
    where id = true
      and status = 'OPEN'
      and coalesce(last_activity_at, opened_at) < now() - interval '30 minutes'
  ) then
    perform public.close_maintenance();
  end if;
end;
$$;

revoke all on function public.auto_close_maintenance() from public, anon, authenticated;

create or replace function public.maintenance_answer_redaction_candidates()
returns table (session_id uuid, room_id text, answer_event_id text)
language sql
security definer
set search_path = public
as $$
  select id, room_id, answer_event_id
  from public.maintenance_sessions
  where status = 'CLOSED'
    and answer_event_id is not null
    and answer_redaction_status in ('PENDING', 'FAILED')
  order by closed_at asc nulls last
  limit 20
$$;

revoke all on function public.maintenance_answer_redaction_candidates() from public;
grant execute on function public.maintenance_answer_redaction_candidates() to service_role;

create or replace function public.record_maintenance_answer_redaction(
  session_id uuid,
  succeeded boolean,
  error_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.maintenance_sessions
    set answer_redaction_status = case when succeeded then 'REDACTED' else 'FAILED' end,
        answer_redaction_attempted_at = now(),
        answer_redacted_at = case when succeeded then now() else answer_redacted_at end,
        answer_redaction_error = case
          when succeeded then null
          else left(coalesce(error_message, 'Matrix answer redaction failed'), 500)
        end
    where id = session_id;
end;
$$;

revoke all on function public.record_maintenance_answer_redaction(uuid, boolean, text) from public;
grant execute on function public.record_maintenance_answer_redaction(uuid, boolean, text) to service_role;

-- Bound technical dispatch retention; this neither contains phrase text nor
-- affects active Maintenance sessions.
select cron.schedule(
  'cleanup-maintenance-command-dispatches',
  '*/15 * * * *',
  $$ delete from public.maintenance_command_dispatches
     where expires_at < now() - interval '1 day'; $$
)
where not exists (
  select 1 from cron.job where jobname = 'cleanup-maintenance-command-dispatches'
);
