\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
  VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO auth.users(id,aud,role,email) VALUES
  ('11111111-1111-4111-8111-111111111111','authenticated','authenticated','trace-fixture@example.invalid'),
  ('22222222-2222-4222-8222-222222222222','authenticated','authenticated','trace-other@example.invalid')
  ON CONFLICT(id) DO NOTHING;
SET LOCAL ROLE service_role;
INSERT INTO swarm_runs(id,user_id,swarm_id,input_prompt,swarm_snapshot,final_output,error_message) VALUES
  ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',
    '9b9ea6c2-a554-4fa7-9c40-908dad632ae7','unchanged-ingress','{"nodes":[],"edges":[]}',
    'ORIGINAL_LEAKAGE_MARKER','ORIGINAL_LEAKAGE_MARKER'),
  ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111',
    NULL,'generic-ingress','{}','GENERIC_UNCHANGED','GENERIC_UNCHANGED');
DO $$
DECLARE
  owner uuid := '11111111-1111-4111-8111-111111111111';
  parent uuid := '33333333-3333-4333-8333-333333333333';
  generic uuid := '44444444-4444-4444-8444-444444444444';
  step uuid;
  edge uuid;
BEGIN
  INSERT INTO swarm_run_steps(run_id,user_id,node_id,input,output,thinking,tool_calls,
    memory_used,rag_chunks,data_extractions,error_message,llm_provider,llm_model,
    tokens_in,tokens_out,cost_usd,latency_ms)
  VALUES(parent,owner,'node','{"text":"ORIGINAL_LEAKAGE_MARKER"}','ORIGINAL_LEAKAGE_MARKER',
    'ORIGINAL_LEAKAGE_MARKER','["ORIGINAL_LEAKAGE_MARKER"]','["ORIGINAL_LEAKAGE_MARKER"]',
    '["ORIGINAL_LEAKAGE_MARKER"]','["ORIGINAL_LEAKAGE_MARKER"]','ORIGINAL_LEAKAGE_MARKER',
    'existing-provider','existing-model',3,4,0.25,12) RETURNING id INTO step;
  INSERT INTO swarm_run_edges(run_id,user_id,source_node_id,target_node_id,payload_preview,bytes)
    VALUES(parent,owner,'node','next','ORIGINAL_LEAKAGE_MARKER',18) RETURNING id INTO edge;
  IF (SELECT to_jsonb(s)::text LIKE '%ORIGINAL_LEAKAGE_MARKER%' FROM swarm_run_steps s WHERE id=step)
    OR (SELECT to_jsonb(e)::text LIKE '%ORIGINAL_LEAKAGE_MARKER%' FROM swarm_run_edges e WHERE id=edge)
    OR (SELECT to_jsonb(r)::text LIKE '%ORIGINAL_LEAKAGE_MARKER%' FROM swarm_runs r WHERE id=parent)
  THEN RAISE EXCEPTION 'Native direct writes leaked bodies'; END IF;
  IF NOT EXISTS(SELECT 1 FROM swarm_run_steps WHERE id=step AND tokens_in=3 AND tokens_out=4
    AND cost_usd=0.25 AND latency_ms=12 AND llm_provider='existing-provider'
    AND llm_model='existing-model'
    AND input='{"schemaVersion":"document-trace-redaction-v1","redacted":true}'::jsonb
    AND error_message='DOCUMENT_NATIVE_NODE_FAILED')
    OR NOT EXISTS(SELECT 1 FROM swarm_runs WHERE id=parent AND input_prompt='unchanged-ingress'
      AND swarm_snapshot='{"nodes":[],"edges":[]}'::jsonb AND error_message='DOCUMENT_NATIVE_RUN_FAILED')
    OR NOT EXISTS(SELECT 1 FROM swarm_run_edges WHERE id=edge AND bytes=18)
  THEN RAISE EXCEPTION 'Native technical or routing metadata changed'; END IF;
  UPDATE swarm_run_steps SET input='{"text":"ORIGINAL_LEAKAGE_MARKER"}',
    output='ORIGINAL_LEAKAGE_MARKER',error_message='ORIGINAL_LEAKAGE_MARKER' WHERE id=step;
  UPDATE swarm_run_edges SET payload_preview='ORIGINAL_LEAKAGE_MARKER' WHERE id=edge;
  UPDATE swarm_runs SET final_output='ORIGINAL_LEAKAGE_MARKER',error_message='ORIGINAL_LEAKAGE_MARKER'
    WHERE id=parent;
  IF (SELECT to_jsonb(s)::text LIKE '%ORIGINAL_LEAKAGE_MARKER%' FROM swarm_run_steps s WHERE id=step)
    OR (SELECT payload_preview IS NOT NULL FROM swarm_run_edges WHERE id=edge)
    OR (SELECT final_output IS NOT NULL FROM swarm_runs WHERE id=parent)
  THEN RAISE EXCEPTION 'Native update bypassed body protection'; END IF;
  BEGIN
    UPDATE swarm_runs SET swarm_id=NULL WHERE id=parent;
    RAISE EXCEPTION 'Parent identity downgraded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_TRACE_IMMUTABLE_RUN_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE swarm_runs SET swarm_id='9b9ea6c2-a554-4fa7-9c40-908dad632ae7' WHERE id=generic;
    RAISE EXCEPTION 'Generic historical bodies rebound to Parent';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_TRACE_IMMUTABLE_RUN_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE swarm_run_steps SET run_id=generic WHERE id=step;
    RAISE EXCEPTION 'Step moved outside protection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_TRACE_IMMUTABLE_ROW_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE swarm_run_edges SET run_id=generic WHERE id=edge;
    RAISE EXCEPTION 'Edge moved outside protection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_TRACE_IMMUTABLE_ROW_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO swarm_run_steps(run_id,user_id,node_id)
      VALUES(parent,'22222222-2222-4222-8222-222222222222','foreign');
    RAISE EXCEPTION 'Service role forged Parent step owner';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_TRACE_OWNED_PARENT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO swarm_run_edges(run_id,user_id,source_node_id,target_node_id)
      VALUES(parent,'22222222-2222-4222-8222-222222222222','foreign','next');
    RAISE EXCEPTION 'Service role forged Parent edge owner';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_TRACE_OWNED_PARENT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE swarm_runs SET user_id='22222222-2222-4222-8222-222222222222' WHERE id=parent;
    RAISE EXCEPTION 'Parent owner rebound';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_TRACE_IMMUTABLE_RUN_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
  INSERT INTO swarm_run_steps(run_id,user_id,node_id,input,output,thinking,tool_calls,error_message)
    VALUES(generic,owner,'generic','{"text":"GENERIC_UNCHANGED"}','GENERIC_UNCHANGED',
      'GENERIC_UNCHANGED','["GENERIC_UNCHANGED"]','GENERIC_UNCHANGED');
  IF NOT EXISTS(SELECT 1 FROM swarm_run_steps WHERE run_id=generic AND output='GENERIC_UNCHANGED'
    AND thinking='GENERIC_UNCHANGED' AND input='{"text":"GENERIC_UNCHANGED"}'::jsonb
    AND tool_calls='["GENERIC_UNCHANGED"]'::jsonb AND error_message='GENERIC_UNCHANGED')
    OR NOT EXISTS(SELECT 1 FROM swarm_runs WHERE id=generic AND final_output='GENERIC_UNCHANGED')
  THEN RAISE EXCEPTION 'Generic body behavior changed'; END IF;
  BEGIN
    UPDATE swarm_run_steps SET run_id=parent WHERE run_id=generic;
    RAISE EXCEPTION 'Generic historical step moved into protected Parent';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_TRACE_IMMUTABLE_ROW_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
END;
$$;
RESET ROLE;
SET LOCAL request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
SET LOCAL ROLE authenticated;
INSERT INTO swarm_run_steps(run_id,user_id,node_id,input,output,thinking,tool_calls,error_message)
  VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',
    'browser','{"text":"BROWSER_LEAKAGE_MARKER"}','BROWSER_LEAKAGE_MARKER','BROWSER_LEAKAGE_MARKER',
    '["BROWSER_LEAKAGE_MARKER"]','BROWSER_LEAKAGE_MARKER');
UPDATE swarm_run_steps SET output='BROWSER_LEAKAGE_MARKER',thinking='BROWSER_LEAKAGE_MARKER',
  memory_used='["BROWSER_LEAKAGE_MARKER"]',rag_chunks='["BROWSER_LEAKAGE_MARKER"]',
  data_extractions='["BROWSER_LEAKAGE_MARKER"]' WHERE node_id='browser';
INSERT INTO swarm_run_edges(run_id,user_id,source_node_id,target_node_id,payload_preview)
  VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',
    'browser','next','BROWSER_LEAKAGE_MARKER');
UPDATE swarm_runs SET final_output='BROWSER_LEAKAGE_MARKER',error_message='BROWSER_LEAKAGE_MARKER'
  WHERE id='33333333-3333-4333-8333-333333333333';
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM swarm_run_steps s WHERE node_id='browser'
    AND to_jsonb(s)::text LIKE '%BROWSER_LEAKAGE_MARKER%')
    OR EXISTS(SELECT 1 FROM swarm_run_edges e WHERE source_node_id='browser'
      AND to_jsonb(e)::text LIKE '%BROWSER_LEAKAGE_MARKER%')
    OR EXISTS(SELECT 1 FROM swarm_runs r WHERE id='33333333-3333-4333-8333-333333333333'
      AND to_jsonb(r)::text LIKE '%BROWSER_LEAKAGE_MARKER%')
  THEN RAISE EXCEPTION 'Authenticated browser bypassed redaction'; END IF;
  IF has_function_privilege(current_user,'public.guard_axtn_document_parent_trace()','EXECUTE')
  THEN RAISE EXCEPTION 'Private trace guard is directly callable'; END IF;
END;
$$;
RESET ROLE;
ROLLBACK;
\echo PASS: actual native service/browser trace bodies protected; owner/rebinding blocked; technical/routing and generic behavior retained. Not complete L19.
