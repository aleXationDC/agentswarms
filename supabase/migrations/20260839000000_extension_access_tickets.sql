-- Generic public "System Extension" launch tickets (freeze audit 2026-08-29,
-- Phase 3: public Maintenance access to Gitea/n8n without a second admin UI
-- and without ever making git.alexation.com / n8n.alexation.com permanently
-- public).
--
-- Flow:
--   1. An authenticated AgentSwarms superadmin, only while Maintenance is
--      OPEN, requests a ticket for one allowlisted target
--      (request-access-ticket). A short-lived, single-use nonce is stored.
--   2. The browser is redirected to https://<target-host>/_ext-access/redeem?
--      t=<nonce>. Caddy proxies that one path straight to AgentSwarms
--      (redeem-ticket), which atomically consumes the ticket and, only if
--      valid AND Maintenance is still OPEN, sets a host-scoped (never
--      wildcard) short-lived grant cookie, then redirects into the target
--      app's own root.
--   3. Every subsequent request to that host is gated by Caddy forward_auth
--      against extension-gate, which re-checks the grant cookie AND
--      Maintenance status on every single request. Closing Maintenance
--      therefore fails the very next request closed, even for an already
--      "logged in" grant — there is no cached/standing bypass.
--
-- This table stores only technical dispatch/grant metadata (nonce, target,
-- timestamps, issuing user). It is not a conversation store, not a second
-- Gitea/n8n session, and does not touch native Gitea/n8n authentication:
-- native login there remains fully required after the Network Gate opens.
create table if not exists public.extension_access_tickets (
  id uuid primary key default gen_random_uuid(),
  nonce text not null unique default encode(gen_random_bytes(32), 'hex'),
  target_key text not null check (target_key in ('gitea', 'n8n')),
  target_host text not null,
  issued_by uuid references auth.users(id),
  issued_at timestamptz not null default now(),
  ticket_expires_at timestamptz not null default now() + interval '90 seconds',
  redeemed_at timestamptz,
  grant_expires_at timestamptz
);

create index if not exists idx_extension_access_tickets_nonce
  on public.extension_access_tickets (nonce);

alter table public.extension_access_tickets enable row level security;
-- Only server-side service-role calls touch this table directly; end users
-- never query it (there is nothing for a human to read here beyond what the
-- issuing flow already returns once).

create or replace function public.issue_extension_access_ticket(
  requested_target_key text,
  requested_target_host text,
  requesting_user uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_nonce text;
begin
  if requested_target_key not in ('gitea', 'n8n') then
    return null;
  end if;

  if not exists (
    select 1 from public.maintenance_access where id = true and status = 'OPEN'
  ) then
    return null;
  end if;

  insert into public.extension_access_tickets (target_key, target_host, issued_by)
    values (requested_target_key, requested_target_host, requesting_user)
    returning nonce into new_nonce;
  return new_nonce;
end;
$$;

revoke all on function public.issue_extension_access_ticket(text, text, uuid) from public;
grant execute on function public.issue_extension_access_ticket(text, text, uuid) to service_role;

create or replace function public.redeem_extension_access_ticket(
  candidate_nonce text,
  requesting_host text
)
returns table (ok boolean, grant_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id uuid;
  new_grant_expiry timestamptz := now() + interval '15 minutes';
begin
  if candidate_nonce is null or requesting_host is null then
    return query select false, null::timestamptz;
    return;
  end if;

  if not exists (
    select 1 from public.maintenance_access where id = true and status = 'OPEN'
  ) then
    return query select false, null::timestamptz;
    return;
  end if;

  update public.extension_access_tickets
    set redeemed_at = now(), grant_expires_at = new_grant_expiry
    where nonce = candidate_nonce
      and target_host = requesting_host
      and redeemed_at is null
      and ticket_expires_at >= now()
    returning id into row_id;

  if row_id is null then
    return query select false, null::timestamptz;
    return;
  end if;

  return query select true, new_grant_expiry;
end;
$$;

revoke all on function public.redeem_extension_access_ticket(text, text) from public;
grant execute on function public.redeem_extension_access_ticket(text, text) to service_role;

-- Re-checked on EVERY proxied request via Caddy forward_auth. Fails closed
-- the instant Maintenance closes, regardless of remaining grant lifetime.
create or replace function public.check_extension_access_grant(
  candidate_nonce text,
  requesting_host text
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.extension_access_tickets t
    join public.maintenance_access m on m.id = true
    where t.nonce = candidate_nonce
      and t.target_host = requesting_host
      and t.redeemed_at is not null
      and t.grant_expires_at > now()
      and m.status = 'OPEN'
  );
$$;

revoke all on function public.check_extension_access_grant(text, text) from public;
grant execute on function public.check_extension_access_grant(text, text) to service_role;

-- Bounded retention; never contains conversation content, only dispatch
-- metadata, matching the pattern used for maintenance_command_dispatches.
select cron.schedule(
  'cleanup-extension-access-tickets',
  '*/15 * * * *',
  $$ delete from public.extension_access_tickets
     where issued_at < now() - interval '1 day'; $$
)
where not exists (
  select 1 from cron.job where jobname = 'cleanup-extension-access-tickets'
);
