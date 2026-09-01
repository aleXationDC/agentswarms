-- Minimal schema subset the Local Table MCP upsert boundary actually touches,
-- reproduced from the production migrations so the behavioural suite can run
-- against a THROWAWAY database instead of the real project.
--
-- This is deliberately a subset, not a replay of every migration: replaying the
-- full history would pull in the entire product surface to test one function.
-- schemaDrift.test.ts pins each column reproduced here against the migration
-- that owns it, so this file cannot silently drift away from production.
--
-- The base image (supabase/postgres, same tag as production) already provides
-- the auth schema, auth.role()/auth.uid(), and the anon/authenticated/
-- service_role/authenticator roles, so identity behaves exactly as it does in
-- the real project.

-- ── owners ────────────────────────────────────────────────────────────────
-- Two distinct users, so "owned by someone else" is a real FK-backed condition
-- rather than a made-up uuid.
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-4000-a000-00000000da01', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'owner@behavioural.invalid'),
  ('00000000-0000-4000-a000-00000000da02', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'stranger@behavioural.invalid')
on conflict (id) do nothing;

-- ── Local Tables (20260420163812, + 20260768000000 / 20260770000000) ──────
create table public.user_data_tables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  source_filename text,
  columns jsonb not null default '[]'::jsonb,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data_loaded_at timestamptz,
  parquet_synced_at timestamptz,
  unique (user_id, name)
);

create table public.user_data_rows (
  id bigserial primary key,
  table_id uuid not null references public.user_data_tables(id) on delete cascade,
  row jsonb not null
);
create index idx_user_data_rows_table_id on public.user_data_rows(table_id);

-- ── MCP apps (20260756000000) ─────────────────────────────────────────────
create table public.mcp_apps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  status text not null default 'draft'
);

-- ── runtime sessions (20260730000000, + mcp_app_id from 20260756000000) ───
-- notebook_id is dropped from the subset: it references user_python_notebooks,
-- which this boundary never reads, and the broker always writes null.
create table public.notebook_runtime_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mcp_app_id uuid references public.mcp_apps(id) on delete set null,
  kind text not null default 'interactive',
  status text not null default 'queued',
  backend text not null default 'docker',
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  expires_at timestamptz
);

-- ── audit (20260723300000, + actor_email from 20260781000000) ─────────────
create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_name text,
  resource_id uuid,
  detail jsonb not null default '{}'::jsonb,
  actor_email text,
  created_at timestamptz not null default now()
);

-- ── RLS, as in production ─────────────────────────────────────────────────
-- service_role carries BYPASSRLS in the base image exactly as it does in the
-- real project, so enabling RLS here keeps the broker's trust assumption
-- honest: it is privileged because of the role it uses, not because the test
-- database is permissive.
alter table public.user_data_tables enable row level security;
alter table public.user_data_rows enable row level security;
alter table public.mcp_apps enable row level security;
alter table public.notebook_runtime_sessions enable row level security;
alter table public.audit_events enable row level security;

-- PostgREST reaches these as service_role/anon; grants mirror the production
-- shape (anon can reach nothing here, which is the point).
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
