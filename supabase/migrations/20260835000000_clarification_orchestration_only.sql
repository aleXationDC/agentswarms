-- Strip the semantic payload out of clarification_cases.
--
-- The original table carried `learned_signals`, a JSONB blob of what a
-- clarification dialogue had taught us. That was a mistake: it duplicated
-- capabilities AgentSwarms already ships, and — worse — the code that fed it
-- switched the native mechanisms OFF to do so.
--
-- The native facilities, verified in this installation:
--
--   dialogue memory      conversations + messages (20260416100227_*.sql:114-136)
--                        conversation_memory rolling summary
--   preferences          agent_memory_items, kind='preference', written by the
--                        native post-turn extractor (utils/memory/extract.server.ts,
--                        triggered at routes/api/chat.ts:387)
--   confirmed rules      knowledge_documents + kb_chunks (pgvector), retrievable
--                        headlessly through the kb_search tool
--   domains / topics     kb_graph_entities + kb_graph_relations
--
-- What remains genuinely missing is not knowledge but BOOKKEEPING: nothing
-- natively ties one approval to the run that produced it, to the conversation
-- that argued about it, and to how many times we have been round the loop.
-- That — and only that — is what this table is for now.
--
-- Nothing semantic may be added back here. If a future need looks semantic,
-- it belongs in memory, a knowledge base, the graph, or a skill.

ALTER TABLE public.clarification_cases DROP COLUMN IF EXISTS learned_signals;

COMMENT ON TABLE public.clarification_cases IS
  'Orchestration state only: binds an approval to its swarm run, its clarification '
  'conversation and the proposal cycle count. Semantic knowledge belongs in the '
  'native memory / knowledge base / knowledge graph facilities, never here.';
