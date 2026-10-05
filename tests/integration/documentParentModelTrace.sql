\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
  VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO auth.users(id,aud,role,email) VALUES
  ('11111111-1111-4111-8111-111111111111','authenticated','authenticated','model-trace-fixture@example.invalid'),
  ('22222222-2222-4222-8222-222222222222','authenticated','authenticated','model-trace-other@example.invalid')
  ON CONFLICT(id) DO NOTHING;
SET LOCAL ROLE service_role;
INSERT INTO swarm_runs(id,user_id,swarm_id) VALUES
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',
    '9b9ea6c2-a554-4fa7-9c40-908dad632ae7'),
  ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111',NULL);
DO $$
DECLARE
  owner uuid := '11111111-1111-4111-8111-111111111111';
  parent uuid := '33333333-3333-4333-8333-333333333333';
  generic uuid := '44444444-4444-4444-8444-444444444444';
  trace uuid;
BEGIN
  INSERT INTO execution_traces(user_id,decision_id,agent_name,llm_provider,llm_model,
    prompt,request_payload,response_payload,tool_calls,error_message,tokens_in,tokens_out,
    latency_ms,cost_usd,cost_scope_type,cost_scope_id)
  VALUES(owner,parent,'existing-agent','existing-provider','existing-model',
    'MODEL_LEAKAGE_MARKER','{"messages":["MODEL_LEAKAGE_MARKER"],"tokens_estimated":true,
      "pricing_missing":false,"replayed_final":false,"price_source":"provider",
      "turn_tokens_in":7,"turn_tokens_out":8,"turn_cost_usd":0.5,"image_count":1}',
    '{"preview":"MODEL_LEAKAGE_MARKER"}','["MODEL_LEAKAGE_MARKER"]','MODEL_LEAKAGE_MARKER',
    3,4,12,0.25,'swarm_api_key','55555555-5555-4555-8555-555555555555') RETURNING id INTO trace;
  IF (SELECT to_jsonb(t)::text LIKE '%MODEL_LEAKAGE_MARKER%' FROM execution_traces t WHERE id=trace)
    OR NOT EXISTS(SELECT 1 FROM execution_traces WHERE id=trace AND prompt IS NULL
      AND request_payload='{"schemaVersion":"document-model-trace-redaction-v1","redacted":true,
        "tokens_estimated":true,"pricing_missing":false,"replayed_final":false,"price_source":"provider",
        "turn_tokens_in":7,"turn_tokens_out":8,"turn_cost_usd":0.5,"image_count":1}'::jsonb
      AND response_payload='{"schemaVersion":"document-model-trace-redaction-v1","redacted":true}'::jsonb
      AND tool_calls='[]'::jsonb
      AND error_message='DOCUMENT_NATIVE_MODEL_FAILED' AND tokens_in=3 AND tokens_out=4
      AND latency_ms=12 AND cost_usd=0.25 AND llm_provider='existing-provider'
      AND llm_model='existing-model' AND cost_scope_type='swarm_api_key'
      AND cost_scope_id='55555555-5555-4555-8555-555555555555')
  THEN RAISE EXCEPTION 'Model trace body/technical contract failed'; END IF;
  UPDATE execution_traces SET prompt='MODEL_LEAKAGE_MARKER',
    request_payload='{"x":"MODEL_LEAKAGE_MARKER","price_source":"MODEL_LEAKAGE_MARKER",
      "pricing_missing":"MODEL_LEAKAGE_MARKER","tokens_estimated":{"x":"MODEL_LEAKAGE_MARKER"},
      "turn_tokens_in":"MODEL_LEAKAGE_MARKER"}',
    response_payload='{"x":"MODEL_LEAKAGE_MARKER"}',tool_calls='["MODEL_LEAKAGE_MARKER"]',
    error_message='MODEL_LEAKAGE_MARKER' WHERE id=trace;
  IF (SELECT to_jsonb(t)::text LIKE '%MODEL_LEAKAGE_MARKER%' FROM execution_traces t WHERE id=trace)
  THEN RAISE EXCEPTION 'Model update bypassed storage profile'; END IF;
  BEGIN
    UPDATE execution_traces SET decision_id=NULL WHERE id=trace;
    RAISE EXCEPTION 'Protected model identity detached';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_MODEL_TRACE_IMMUTABLE_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE execution_traces SET decision_id=generic WHERE id=trace;
    RAISE EXCEPTION 'Protected model identity downgraded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_MODEL_TRACE_IMMUTABLE_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE execution_traces SET user_id='22222222-2222-4222-8222-222222222222' WHERE id=trace;
    RAISE EXCEPTION 'Protected model owner rebound';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_MODEL_TRACE_IMMUTABLE_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO execution_traces(user_id,decision_id,agent_name,llm_model)
      VALUES('22222222-2222-4222-8222-222222222222',parent,'forged','existing-model');
    RAISE EXCEPTION 'Forged model Parent owner accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_MODEL_TRACE_OWNED_PARENT_REQUIRED' THEN RAISE; END IF;
  END;
  INSERT INTO execution_traces(user_id,decision_id,agent_name,llm_model,prompt,request_payload,
    response_payload,tool_calls,error_message)
    VALUES(owner,generic,'generic','existing-model','GENERIC_UNCHANGED',
      '{"x":"GENERIC_UNCHANGED"}','{"x":"GENERIC_UNCHANGED"}','["GENERIC_UNCHANGED"]',
      'GENERIC_UNCHANGED') RETURNING id INTO trace;
  IF NOT EXISTS(SELECT 1 FROM execution_traces WHERE id=trace AND prompt='GENERIC_UNCHANGED'
    AND request_payload='{"x":"GENERIC_UNCHANGED"}'::jsonb AND response_payload=request_payload
    AND tool_calls='["GENERIC_UNCHANGED"]'::jsonb AND error_message='GENERIC_UNCHANGED')
  THEN RAISE EXCEPTION 'Generic model body contract changed'; END IF;
  BEGIN
    UPDATE execution_traces SET decision_id=parent WHERE id=trace;
    RAISE EXCEPTION 'Historical generic trace rebound to Parent';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_MODEL_TRACE_IMMUTABLE_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
END;
$$;
RESET ROLE;
SET LOCAL request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
SET LOCAL ROLE authenticated;
INSERT INTO execution_traces(user_id,decision_id,agent_name,llm_model,prompt,request_payload,response_payload,
  tool_calls,error_message)
  VALUES('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333',
    'browser','existing-model','BROWSER_MODEL_LEAKAGE_MARKER',
    '{"x":"BROWSER_MODEL_LEAKAGE_MARKER"}','{"x":"BROWSER_MODEL_LEAKAGE_MARKER"}',
    '["BROWSER_MODEL_LEAKAGE_MARKER"]','BROWSER_MODEL_LEAKAGE_MARKER');
UPDATE execution_traces SET prompt='BROWSER_MODEL_LEAKAGE_MARKER',
  request_payload='{"x":"BROWSER_MODEL_LEAKAGE_MARKER"}' WHERE agent_name='browser';
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM execution_traces t WHERE agent_name='browser'
    AND to_jsonb(t)::text LIKE '%BROWSER_MODEL_LEAKAGE_MARKER%')
  THEN RAISE EXCEPTION 'Browser model write bypassed profile'; END IF;
  IF has_function_privilege(current_user,'public.guard_axtn_document_parent_model_trace()','EXECUTE')
  THEN RAISE EXCEPTION 'Private model trace guard callable'; END IF;
END;
$$;
RESET ROLE;
DO $$
DECLARE trace uuid;
BEGIN
  SELECT id INTO trace FROM execution_traces WHERE agent_name='browser';
  DELETE FROM swarm_runs WHERE id='33333333-3333-4333-8333-333333333333';
  BEGIN
    UPDATE execution_traces SET prompt='ORPHAN_MODEL_LEAKAGE_MARKER' WHERE id=trace;
    RAISE EXCEPTION 'Deleted Parent allowed historical protected trace body injection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_MODEL_TRACE_OWNED_PARENT_REQUIRED' THEN RAISE; END IF;
  END;
END;
$$;
ROLLBACK;
\echo PASS: actual native Parent-correlated model bodies excluded, immutable identity/owner and technical/generic behavior retained. Uncorrelated/nested/cache/checkpoint paths are not covered.
