-- Human Access / System Extensions (2026-08-29)
--
-- Two narrowly-scoped, single-purpose config tables, consistent with the
-- existing repo convention of small per-feature settings tables (see
-- iam_settings, notebook_runtime_settings, git_export_config) rather than a
-- new generic config platform.
--
-- matrix_system_access: canonical, admin-configurable Matrix control-room
-- and operator allowlist, replacing static env vars as the sole source of
-- truth for the "which room / which sender may issue system commands"
-- check. Consolidates on the same room+sender check shape the existing
-- MatrixPolicy (ops/n8n/matrix-e2ee-adapter) already uses for the canonical
-- Brain-ingress path -- this is not a second, competing policy engine.
--
-- maintenance_access: exactly three admin-configurable values (opening
-- phrase, answer phrase, maintenance path) plus machine-managed state
-- (status/opened_at/last_activity_at). The opening phrase is never stored
-- in plaintext: it is hashed with pgcrypto's bcrypt (crypt()/gen_salt('bf'),
-- already available in this Supabase instance -- no new crypto dependency
-- needed anywhere). Verification happens exclusively inside a
-- SECURITY DEFINER RPC so neither the Matrix adapter nor any client ever
-- sees the hash or the plaintext together.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- matrix_system_access
-- ---------------------------------------------------------------------
create table if not exists public.matrix_system_access (
  id boolean primary key default true,
  control_room_id text not null default '',
  operator_mxids text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint matrix_system_access_single_row check (id)
);

insert into public.matrix_system_access (id)
values (true)
on conflict (id) do nothing;

alter table public.matrix_system_access enable row level security;

-- Superadmins may read/update the config through the normal client.
create policy matrix_system_access_superadmin_all
  on public.matrix_system_access for all
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

-- ---------------------------------------------------------------------
-- maintenance_access
-- ---------------------------------------------------------------------
create table if not exists public.maintenance_access (
  id boolean primary key default true,
  opening_phrase_hash text,
  answer_phrase text not null default '',
  maintenance_path text not null default '',
  status text not null default 'CLOSED',
  opened_at timestamptz,
  last_activity_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint maintenance_access_single_row check (id),
  constraint maintenance_access_status_valid check (status in ('OPEN', 'CLOSED'))
);

insert into public.maintenance_access (id)
values (true)
on conflict (id) do nothing;

alter table public.maintenance_access enable row level security;

-- Superadmins may read/update answer_phrase and maintenance_path and view
-- status directly. Note: opening_phrase_hash is included in the row for
-- simplicity of RLS (single-row table); the client UI must never render it,
-- and it is write-only in practice (see set_opening_phrase below, which is
-- the only supported way to set it).
create policy maintenance_access_superadmin_all
  on public.maintenance_access for all
  using (public.is_superadmin(auth.uid()))
  with check (public.is_superadmin(auth.uid()));

-- ---------------------------------------------------------------------
-- set_opening_phrase(phrase): superadmin-only, hashes with bcrypt, never
-- persists or returns plaintext.
-- ---------------------------------------------------------------------
create or replace function public.set_opening_phrase(phrase text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_superadmin(auth.uid()) then
    raise exception 'not authorized';
  end if;
  if phrase is null or length(trim(phrase)) = 0 then
    raise exception 'opening phrase must not be empty';
  end if;
  update public.maintenance_access
    set opening_phrase_hash = crypt(phrase, gen_salt('bf')),
        updated_at = now()
    where id = true;
end;
$$;

revoke all on function public.set_opening_phrase(text) from public;
grant execute on function public.set_opening_phrase(text) to authenticated;

-- ---------------------------------------------------------------------
-- try_open_maintenance(candidate): called only by the trusted Matrix
-- adapter (service role), after it has already verified
-- E2EE + room_id allowed + sender_mxid allowed. Verifies the candidate
-- phrase against the stored hash and, only on match, atomically flips
-- status to OPEN and returns the configured answer_phrase. On no match,
-- returns matched=false and no answer_phrase, so the adapter cannot
-- accidentally leak the answer phrase for a wrong guess.
-- ---------------------------------------------------------------------
create or replace function public.try_open_maintenance(candidate text)
returns table (matched boolean, answer_phrase text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  row_hash text;
  row_answer text;
begin
  select opening_phrase_hash, maintenance_access.answer_phrase
    into row_hash, row_answer
    from public.maintenance_access
    where id = true;

  if row_hash is null or candidate is null or length(trim(candidate)) = 0 then
    return query select false, null::text;
    return;
  end if;

  -- Never open Maintenance without an answer phrase: otherwise a
  -- misconfigured row could grant access while leaving the Matrix operator
  -- without the mandated exact acknowledgement.
  if row_hash = crypt(candidate, row_hash)
     and length(trim(coalesce(row_answer, ''))) > 0 then
    update public.maintenance_access
      set status = 'OPEN',
          opened_at = now(),
          last_activity_at = now(),
          updated_at = now()
      where id = true;
    return query select true, row_answer;
  else
    return query select false, null::text;
  end if;
end;
$$;

revoke all on function public.try_open_maintenance(text) from public;
grant execute on function public.try_open_maintenance(text) to service_role;

-- ---------------------------------------------------------------------
-- touch_maintenance_activity(): called by the AgentSwarms frontend while a
-- user is genuinely interacting with the app AND the request originated
-- from the maintenance path (not by background polling -- enforced at the
-- application layer, this RPC only records the timestamp). Only advances
-- last_activity_at while status is already OPEN; does not open Maintenance.
-- ---------------------------------------------------------------------
create or replace function public.touch_maintenance_activity()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.maintenance_access
    set last_activity_at = now()
    where id = true and status = 'OPEN';
end;
$$;

revoke all on function public.touch_maintenance_activity() from public;
grant execute on function public.touch_maintenance_activity() to authenticated;

-- ---------------------------------------------------------------------
-- close_maintenance(): idempotent close, callable by the adapter's
-- auto-close loop (service role) or manually by a superadmin from the UI.
-- ---------------------------------------------------------------------
create or replace function public.close_maintenance()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.maintenance_access
    set status = 'CLOSED'
    where id = true;
end;
$$;

revoke all on function public.close_maintenance() from public;
grant execute on function public.close_maintenance() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- auto_close_maintenance(): native pg_cron sweep (every 5 minutes),
-- closing Maintenance after 30 minutes without genuine activity. This is a
-- FIXED system rule per spec (not a 4th admin value) and lives entirely in
-- Postgres -- no adapter-side timer loop needed, and no "any HTTP request
-- counts as activity" risk, since last_activity_at is only ever advanced by
-- touch_maintenance_activity() (called from real user interaction while
-- authenticated, never by background polling -- see
-- src/utils/systemExtensions.functions.ts / AutoCloseHeartbeat).
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;

create or replace function public.auto_close_maintenance()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.maintenance_access
    set status = 'CLOSED'
    where id = true
      and status = 'OPEN'
      and coalesce(last_activity_at, opened_at) < now() - interval '30 minutes';
end;
$$;

revoke all on function public.auto_close_maintenance() from public, anon, authenticated;

select cron.schedule(
  'auto-close-maintenance',
  '*/5 * * * *',
  $$ select public.auto_close_maintenance(); $$
)
where not exists (select 1 from cron.job where jobname = 'auto-close-maintenance');
