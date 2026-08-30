-- DMS-D1-0002 §5: Privacy Vault — reversible pseudonym token mapping.
--
-- This is SECURITY MATERIAL, not knowledge. It must never be reachable
-- through the normal agent-readable surfaces (Dataset / Knowledge Base /
-- Memory / Knowledge Graph) — mirrors the otel_export_cursor pattern:
-- RLS is enabled with NO policies, so only the service role (supabaseAdmin,
-- used exclusively by src/lib/privacyVault.server.ts) can read or write it.
-- No authenticated client, agent tool, or PostgREST caller can see a row here.
create table if not exists public.privacy_vault_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  -- Opaque provider-facing token, e.g. "PII-7f3a2c1d". Unique per owner so two
  -- users' pseudonyms can never collide or be confused across tenants.
  pseudonym_token text not null,
  -- Stable identity of what this token stands for, so the SAME entity across
  -- documents gets the SAME pseudonym (needed for local entity resolution /
  -- cross-document linkage) without ever exposing the clear value externally.
  -- Deliberately opaque here too (e.g. a hash of entity type + normalized
  -- value) — never the clear text itself.
  entity_key text not null,
  entity_type text not null,
  -- AES-256-GCM ciphertext of the clear value (see privacyVaultCrypto.server.ts).
  -- Never store clear PII in this or any other column.
  ciphertext text not null,
  iv text not null,
  key_id text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  unique (user_id, pseudonym_token),
  unique (user_id, entity_key)
);

alter table public.privacy_vault_tokens enable row level security;
-- Intentionally no policies: only the service role resolves tokens, per
-- DMS-D1-0002 §5 ("Only the AgentSwarms server privacy service may resolve
-- tokens"). Enabling RLS keeps every row invisible to authenticated users,
-- agent tools (sql_query/kb_search run under RLS-equivalent scoping) and
-- PostgREST.

create index if not exists privacy_vault_tokens_user_idx
  on public.privacy_vault_tokens (user_id);
