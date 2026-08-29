-- Public System Extension access requires a current Supabase AAL2 session.
-- Matrix Admin joins the existing generic ticket mechanism; this migration
-- changes only technical ticket metadata and never target-app authentication.

alter table public.extension_access_tickets
  drop constraint if exists extension_access_tickets_target_key_check;

alter table public.extension_access_tickets
  add constraint extension_access_tickets_target_key_check
  check (target_key in ('gitea', 'n8n', 'matrix_admin'));

alter table public.extension_access_tickets
  alter column ticket_expires_at set default now() + interval '60 seconds';

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
  if requested_target_key not in ('gitea', 'n8n', 'matrix_admin') then
    return null;
  end if;

  if not exists (
    select 1 from public.maintenance_access where id = true and status = 'OPEN'
  ) then
    return null;
  end if;

  insert into public.extension_access_tickets (
    target_key,
    target_host,
    issued_by,
    ticket_expires_at
  ) values (
    requested_target_key,
    requested_target_host,
    requesting_user,
    now() + interval '60 seconds'
  ) returning nonce into new_nonce;

  return new_nonce;
end;
$$;
