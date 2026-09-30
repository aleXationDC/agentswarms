-- Atomic, broker-only Local Table row upsert. This does not create storage:
-- user_data_tables and user_data_rows remain the sole authoritative model.
create or replace function public.axtn_local_table_upsert(
  _user_id uuid,
  _table_name text,
  _key_column text,
  _key_value text,
  _row jsonb
)
returns table(table_id uuid, row_id bigint, outcome text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_table_id uuid;
  v_row_id bigint;
  v_caller_role text;
begin
  -- Broker-only, belt and braces alongside the GRANT below.
  --
  -- This used to read auth.role() alone. In this project's Postgres image
  -- auth.role() resolves ONLY the legacy `request.jwt.claim.role` GUC, which
  -- PostgREST has not emitted since v9 and which the version deployed here
  -- (v14) never sets. auth.role() therefore returned NULL for every real call
  -- and this guard rejected the broker itself. Resolve the caller's role the
  -- way the running stack actually reports it, newest form first, and keep the
  -- legacy GUC for older/direct callers.
  begin
    v_caller_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role';
  exception when others then
    v_caller_role := null;
  end;
  v_caller_role := coalesce(
    v_caller_role,
    nullif(current_setting('request.jwt.claim.role', true), ''),
    -- PostgREST issues SET LOCAL ROLE; security definer masks it in
    -- current_user, but the GUC still names the role it switched to.
    nullif(current_setting('role', true), 'none'),
    session_user::text
  );
  if v_caller_role is distinct from 'service_role' then
    raise exception 'axtn_local_table_upsert is broker-only (caller role %)',
      coalesce(v_caller_role, '<unknown>');
  end if;

  if nullif(btrim(_table_name), '') is null
    or nullif(btrim(_key_column), '') is null
    or nullif(btrim(_key_value), '') is null
    or _row is null
    or jsonb_typeof(_row) <> 'object' then
    raise exception 'invalid Local Table upsert arguments';
  end if;

  select id into v_table_id
  from public.user_data_tables
  where user_id = _user_id and name = _table_name;
  if v_table_id is null then
    raise exception 'Local Table is not owned by caller';
  end if;

  if not exists (
    select 1
    from public.user_data_tables t
    cross join lateral jsonb_array_elements(t.columns) as column_def
    where t.id = v_table_id and column_def->>'name' = _key_column
  ) then
    raise exception 'key_column is not declared by Local Table';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(_row) as row_key
    where not exists (
      select 1
      from public.user_data_tables t
      cross join lateral jsonb_array_elements(t.columns) as column_def
      where t.id = v_table_id and column_def->>'name' = row_key
    )
  ) then
    raise exception 'row contains undeclared Local Table column';
  end if;
  if nullif(_row->>_key_column, '') is null or _row->>_key_column <> _key_value then
    raise exception 'key_value must match a non-empty row key';
  end if;

  -- The table has no arbitrary-JSON unique key. A transaction-scoped advisory
  -- lock serializes precisely one logical (table, column, value) upsert.
  perform pg_advisory_xact_lock(
    hashtextextended(v_table_id::text || chr(31) || _key_column || chr(31) || _key_value, 0)
  );
  -- `r.` is load-bearing: this function RETURNS TABLE(table_id uuid, ...), so
  -- `table_id` is also an OUT parameter here. An unqualified reference matches
  -- both it and user_data_rows.table_id, and PL/pgSQL rejects the statement
  -- with "column reference is ambiguous" — on every call, not just contended
  -- ones. Aliasing the relation keeps the returned column names the broker
  -- reads while making each reference unambiguous.
  select r.id into v_row_id
  from public.user_data_rows r
  where r.table_id = v_table_id and r.row->>_key_column = _key_value
  order by r.id
  limit 1
  for update;

  if v_row_id is null then
    insert into public.user_data_rows(table_id, row)
    values (v_table_id, _row)
    returning user_data_rows.id into v_row_id;
    outcome := 'inserted';
  else
    update public.user_data_rows r set row = _row where r.id = v_row_id;
    outcome := 'updated';
  end if;

  -- Stale mirrors fall back to user_data_rows until the native refresh succeeds.
  update public.user_data_tables t
  set data_loaded_at = now(), parquet_synced_at = null
  where t.id = v_table_id;

  table_id := v_table_id;
  row_id := v_row_id;
  return next;
end;
$$;

revoke all on function public.axtn_local_table_upsert(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.axtn_local_table_upsert(uuid, text, text, text, jsonb)
  to service_role;
