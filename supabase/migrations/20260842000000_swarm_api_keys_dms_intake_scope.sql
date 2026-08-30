-- Widen swarm_api_keys.scopes to allow "dms_intake" (DMS-D1-0002 §3): a key
-- scoped ONLY for document intake can post raw bytes to /api/dms/intake and
-- have them run through the Document Intake Swarm on the key's swarm_id, but
-- cannot call POST /api/swarm/run to invoke arbitrary swarms — least
-- privilege for the n8n transport-only credential, reusing the same
-- API-key/scope mechanism swarm.run.ts already enforces rather than a new
-- auth concept.
ALTER TABLE public.swarm_api_keys
  DROP CONSTRAINT IF EXISTS swarm_api_keys_scopes_valid;
ALTER TABLE public.swarm_api_keys
  ADD CONSTRAINT swarm_api_keys_scopes_valid
  CHECK (scopes <@ ARRAY['run', 'read_runs', 'dms_intake']::text[]);
