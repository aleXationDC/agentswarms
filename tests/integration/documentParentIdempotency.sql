\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
  VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO auth.users(id,aud,role,email,invited_at) VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','authenticated','authenticated','cache-owner@example.invalid',now()),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','authenticated','authenticated','cache-other@example.invalid',now())
  ON CONFLICT(id) DO NOTHING;
SET LOCAL ROLE service_role;
INSERT INTO public.swarms(id,user_id,name) VALUES
  ('9b9ea6c2-a554-4fa7-9c40-908dad632ae7','cccccccc-cccc-4ccc-8ccc-cccccccccccc','cache-parent-fixture'),
  ('77777777-7777-4777-8777-777777777777','cccccccc-cccc-4ccc-8ccc-cccccccccccc','cache-generic-fixture');
INSERT INTO public.swarm_api_keys(id,user_id,swarm_id,name,key_hash,key_prefix) VALUES
  ('88888888-8888-4888-8888-888888888888','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '9b9ea6c2-a554-4fa7-9c40-908dad632ae7','cache-parent-fixture','cache-parent-hash','fixture'),
  ('99999999-9999-4999-8999-999999999999','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '77777777-7777-4777-8777-777777777777','cache-generic-fixture','cache-generic-hash','fixture');
INSERT INTO public.swarm_runs(id,user_id,swarm_id) VALUES
  ('33333333-3333-4333-8333-333333333333','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '9b9ea6c2-a554-4fa7-9c40-908dad632ae7'),
  ('44444444-4444-4444-8444-444444444444','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '77777777-7777-4777-8777-777777777777'),
  ('66666666-6666-4666-8666-666666666666','dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '9b9ea6c2-a554-4fa7-9c40-908dad632ae7');
INSERT INTO public.swarm_run_idempotency(api_key_id,idempotency_key,request_hash) VALUES
  ('88888888-8888-4888-8888-888888888888','cache-fixture','hash-fixture');
UPDATE public.swarm_run_idempotency SET run_id='33333333-3333-4333-8333-333333333333',
  response='{"runId":"33333333-3333-4333-8333-333333333333","status":"suspended",
    "output":"{\"schemaVersion\":\"document-suspended-output-v1\"}"}'
  WHERE idempotency_key='cache-fixture';
DO $$
DECLARE
  change jsonb;
  body jsonb;
BEGIN
  FOREACH body IN ARRAY ARRAY[
    '{"runId":"33333333-3333-4333-8333-333333333333","status":"suspended","output":"ORIGINAL_LEAKAGE_MARKER"}',
    '{"runId":"33333333-3333-4333-8333-333333333333","status":"suspended","output":"{\"schemaVersion\":\"document-suspended-output-v1\"}","extra":"ORIGINAL_LEAKAGE_MARKER"}',
    '{"runId":"33333333-3333-4333-8333-333333333333","status":"success","output":"{\"schemaVersion\":\"document-suspended-output-v1\"}"}',
    '{"runId":null,"status":"suspended","output":"{\"schemaVersion\":\"document-suspended-output-v1\"}"}',
    '{"runId":"33333333-3333-4333-8333-333333333333","status":"suspended","output":"{\"schemaVersion\":\"document-suspended-output-v1\"}","error":"ORIGINAL_LEAKAGE_MARKER"}',
    '[]','"ORIGINAL_LEAKAGE_MARKER"','{}'
  ]::jsonb[] LOOP
    BEGIN
      UPDATE public.swarm_run_idempotency SET response=body WHERE idempotency_key='cache-fixture';
      RAISE EXCEPTION 'Unsafe cache body accepted';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'DOCUMENT_CACHE_MINIMIZED_RESPONSE_REQUIRED' THEN RAISE; END IF;
    END;
  END LOOP;
  FOREACH change IN ARRAY ARRAY[
    '{"run_id":null}',
    '{"run_id":"44444444-4444-4444-8444-444444444444"}',
    '{"run_id":"66666666-6666-4666-8666-666666666666"}',
    '{"api_key_id":"99999999-9999-4999-8999-999999999999"}',
    '{"idempotency_key":"changed"}',
    '{"request_hash":"changed"}'
  ]::jsonb[] LOOP
    BEGIN
      IF change ? 'run_id' THEN
        UPDATE public.swarm_run_idempotency SET run_id=(change->>'run_id')::uuid
          WHERE idempotency_key='cache-fixture';
      ELSIF change ? 'api_key_id' THEN
        UPDATE public.swarm_run_idempotency SET api_key_id=(change->>'api_key_id')::uuid
          WHERE idempotency_key='cache-fixture';
      ELSIF change ? 'idempotency_key' THEN
        UPDATE public.swarm_run_idempotency SET idempotency_key=change->>'idempotency_key'
          WHERE idempotency_key='cache-fixture';
      ELSE
        UPDATE public.swarm_run_idempotency SET request_hash=change->>'request_hash'
          WHERE idempotency_key='cache-fixture';
      END IF;
      RAISE EXCEPTION 'Cache identity rebound';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'DOCUMENT_CACHE_IMMUTABLE_RECORD_BINDING_REQUIRED' THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    INSERT INTO public.swarm_run_idempotency(api_key_id,idempotency_key,request_hash,run_id)
      VALUES('88888888-8888-4888-8888-888888888888','foreign-run','hash',
        '66666666-6666-4666-8666-666666666666');
    RAISE EXCEPTION 'Foreign Parent owner accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_CACHE_OWNED_PARENT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.swarm_run_idempotency(api_key_id,idempotency_key,request_hash,run_id)
      VALUES('99999999-9999-4999-8999-999999999999','foreign-key','hash',
        '33333333-3333-4333-8333-333333333333');
    RAISE EXCEPTION 'Generic key attached to Parent';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_CACHE_OWNED_PARENT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.swarm_api_keys SET swarm_id='77777777-7777-4777-8777-777777777777'
      WHERE id='88888888-8888-4888-8888-888888888888';
    RAISE EXCEPTION 'Parent key profile downgraded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_CACHE_IMMUTABLE_KEY_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.swarm_api_keys SET user_id='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      WHERE id='88888888-8888-4888-8888-888888888888';
    RAISE EXCEPTION 'Parent key owner changed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_CACHE_IMMUTABLE_KEY_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
  UPDATE public.swarm_run_idempotency SET status='completed',completed_at=now(),
    response='{"runId":"33333333-3333-4333-8333-333333333333",
      "output":"{\"schemaVersion\":\"document-completed-output-v1\"}"}'
    WHERE idempotency_key='cache-fixture';
  UPDATE public.swarm_run_idempotency SET status='failed',
    response='{"runId":"33333333-3333-4333-8333-333333333333","status":"error",
      "output":"{\"schemaVersion\":\"document-failed-output-v1\"}","error":"DOCUMENT_RUN_FAILED"}'
    WHERE idempotency_key='cache-fixture';
  BEGIN
    UPDATE public.swarm_run_idempotency
      SET response=jsonb_set(response,'{error}','"DOCUMENT_RUN_FAILED ORIGINAL_LEAKAGE_MARKER"')
      WHERE idempotency_key='cache-fixture';
    RAISE EXCEPTION 'Fake diagnostic prefix accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_CACHE_MINIMIZED_RESPONSE_REQUIRED' THEN RAISE; END IF;
  END;
  INSERT INTO public.swarm_run_idempotency(api_key_id,idempotency_key,request_hash,status,response)
    VALUES('88888888-8888-4888-8888-888888888888','pre-run-failure','hash','failed',
      '{"runId":null,"error":"DOCUMENT_RUN_FAILED"}');
  INSERT INTO public.swarm_run_idempotency(api_key_id,idempotency_key,request_hash,run_id,response)
    VALUES('99999999-9999-4999-8999-999999999999','generic-fixture','generic-hash',
      '44444444-4444-4444-8444-444444444444','{"output":"GENERIC_UNCHANGED","extra":"GENERIC_UNCHANGED"}');
  UPDATE public.swarm_run_idempotency SET response='{"output":"GENERIC_UNCHANGED","error":"GENERIC_UNCHANGED"}'
    WHERE idempotency_key='generic-fixture';
  IF NOT EXISTS(SELECT 1 FROM public.swarm_run_idempotency WHERE idempotency_key='generic-fixture'
    AND response='{"output":"GENERIC_UNCHANGED","error":"GENERIC_UNCHANGED"}'::jsonb)
    OR EXISTS(SELECT 1 FROM public.swarm_run_idempotency WHERE idempotency_key<>'generic-fixture'
      AND response::text LIKE '%ORIGINAL_LEAKAGE_MARKER%')
  THEN RAISE EXCEPTION 'Cache body or generic compatibility failed'; END IF;
END;
$$;
RESET ROLE;
SET LOCAL request.jwt.claims='{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}';
SET LOCAL ROLE authenticated;
UPDATE public.swarm_api_keys SET is_active=false WHERE id='88888888-8888-4888-8888-888888888888';
DO $$
DECLARE
  changed integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.swarm_run_idempotency WHERE idempotency_key='cache-fixture')
    OR NOT EXISTS(SELECT 1 FROM public.swarm_api_keys
      WHERE id='88888888-8888-4888-8888-888888888888' AND NOT is_active)
  THEN RAISE EXCEPTION 'Owner read or native key revocation changed'; END IF;
  UPDATE public.swarm_run_idempotency SET response='{"original":"BROWSER_LEAKAGE_MARKER"}'
    WHERE idempotency_key='cache-fixture';
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>0 THEN RAISE EXCEPTION 'Authenticated cache write bypassed existing RLS'; END IF;
  IF has_function_privilege(current_user,'public.guard_axtn_document_parent_api_key()','EXECUTE')
    OR has_function_privilege(current_user,'public.guard_axtn_document_parent_idempotency()','EXECUTE')
  THEN RAISE EXCEPTION 'Private cache guard is directly callable'; END IF;
  BEGIN
    INSERT INTO public.swarm_run_idempotency(api_key_id,idempotency_key,request_hash,response)
      VALUES('88888888-8888-4888-8888-888888888888','browser-write','hash',
        '{"original":"BROWSER_LEAKAGE_MARKER"}');
    RAISE EXCEPTION 'Authenticated cache insert accepted';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
    WHEN raise_exception THEN
      IF SQLERRM<>'DOCUMENT_CACHE_MINIMIZED_RESPONSE_REQUIRED' THEN RAISE; END IF;
  END;
END;
$$;
RESET ROLE;
SET LOCAL request.jwt.claims='{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}';
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.swarm_run_idempotency WHERE idempotency_key='cache-fixture')
  THEN RAISE EXCEPTION 'Foreign owner read Parent cache'; END IF;
END;
$$;
RESET ROLE;
ROLLBACK;
\echo PASS: native service cache writes require minimized bodies and immutable owner/key/run/request bindings; browser/foreign-owner RLS and generic/revocation behavior preserved. Not effect/acceptance authority or full L19.
