-- Matrix <-> AgentSwarms channel binding (PoC).
--
-- This is bookkeeping only, following the same discipline already established
-- in 20260835000000_clarification_orchestration_only.sql: the native
-- conversations/messages tables remain the ONE conversation store. This table
-- does not duplicate them -- it only maps a technical transport identifier
-- (a Matrix room) to a technical AgentSwarms identifier (a conversation row),
-- so that the Matrix E2EE adapter (ops/n8n/matrix-e2ee-adapter) can resolve
-- "which conversation does this room continue" without inventing a second
-- conversation database.
--
-- No message text, no history, no agent memory lives here. Message content
-- lives exclusively in public.messages, keyed by conversation_id as it
-- already does for every other AgentSwarms surface (playground, embed,
-- Slack).
create table if not exists public.matrix_agentswarms_bindings (
  id uuid primary key default gen_random_uuid(),
  matrix_room_id text not null unique,
  matrix_sender_mxid text,
  agentswarms_conversation_id uuid not null references public.conversations(id) on delete cascade,
  agentswarms_user_id uuid not null references auth.users(id) on delete cascade,
  agentswarms_agent_id uuid not null references public.agents(id) on delete cascade,
  -- Matrix event_id of the last successfully processed inbound message.
  -- Dedup authority remains the adapter's own persistent event queue
  -- (matrix-e2ee-adapter/src/dedupe.rs); this column is an observability/
  -- recovery aid only, not a second dedup mechanism.
  last_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.matrix_agentswarms_bindings is
  'Technical channel binding only (PoC): one row per Matrix room bound to one AgentSwarms conversation. No conversation history or message content is stored here -- see public.messages.';

-- Internal transport binding: no anon/authenticated access is needed. Only
-- the adapter, authenticating with the service-role key (same as every other
-- headless/internal caller in this app, e.g. src/utils/swarmExecute.server.ts),
-- reads or writes this table. RLS is enabled with no permissive policy, which
-- denies all access to anon/authenticated roles and is bypassed by the
-- service role as usual.
alter table public.matrix_agentswarms_bindings enable row level security;

create index if not exists matrix_agentswarms_bindings_conversation_id_idx
  on public.matrix_agentswarms_bindings (agentswarms_conversation_id);
