-- Run against an isolated clone: psql -v ON_ERROR_STOP=1 -f <this file>. Everything rolls back.
-- Guards native execution-identity parity for Case-bound runs: model IAM, gateway availability and
-- budget identity are the run owner's (A), never the Case assignee/payer/semantic route (B).
\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.expect_fail(op text, run uuid, node text, code text) RETURNS void
LANGUAGE plpgsql AS $f$
BEGIN
  PERFORM axtn_case_execution((SELECT user_id FROM swarm_runs WHERE id=run),op,
    jsonb_build_object('runId',run,'nodeId',node,'operationKey','k-'||gen_random_uuid()));
  RAISE EXCEPTION 'FAIL: expected % for %/%', code, op, node;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM IS DISTINCT FROM code THEN RAISE EXCEPTION 'FAIL: expected % got % (% %)', code, SQLERRM, op, node; END IF;
END
$f$;
DO $t$
DECLARE
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  tbl uuid := gen_random_uuid(); cid text := gen_random_uuid()::text;
  sw uuid := gen_random_uuid(); run uuid := gen_random_uuid();
  gw_b uuid := gen_random_uuid(); gw_a uuid := gen_random_uuid();
  pa jsonb; r jsonb; n int;
  snapshot jsonb := jsonb_build_object('nodes', jsonb_build_array(
    jsonb_build_object('id','gw','data',jsonb_build_object('kind','agent','provider','vllm','model','gpt-oss-120b','routeThroughGateway',true)),
    jsonb_build_object('id','plain','data',jsonb_build_object('kind','agent','provider','openai','model','gpt-4o','routeThroughGateway',false))));
BEGIN
  pa := jsonb_build_object('kind','user_session','id',a);
  INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES
    (a,'a-'||a||'@parity.invalid','{"provisioned_by":"admin"}'),(b,'b-'||b||'@parity.invalid','{"provisioned_by":"admin"}');
  INSERT INTO user_data_tables(id,name) VALUES (tbl,'axtn_cases');
  UPDATE user_data_tables SET user_id=a WHERE id=tbl;
  -- Case in A's custody and data scope; B is assignee and the semantic route points elsewhere.
  INSERT INTO user_data_rows(table_id,row) VALUES (tbl,jsonb_build_object(
    'case_id',cid,'status','OPEN','processing_mode','SEMANTIC','source_kind','development_work',
    'assignee_user_id',b,'assignment_version',1,'assignment_policy','MANUAL',
    'semantic_route_mode','PERSONAL_CONNECTION','semantic_route_provider_id','anthropic',
    'semantic_route_model_id','claude-other','semantic_route_version',1,
    'responsible_principal_type','USER','responsible_principal_id',b));
  INSERT INTO swarms(id,user_id,name,nodes,edges,is_deployed) VALUES (sw,a,'parity','[]','[]',false);
  INSERT INTO swarm_runs(id,user_id,swarm_id,swarm_snapshot,status,case_id,case_attempt_id,case_execution_principal)
    VALUES (run,a,sw,snapshot,'running',cid::uuid,run::text,pa);

  -- A: gateway + model right; B: no rights at all. Owner A's own gateway.
  INSERT INTO iam_model_rules(principal_type,principal_id,provider,model_pattern) VALUES ('user',a,'vllm','*');
  INSERT INTO iam_model_rules(principal_type,principal_id,provider,model_pattern) VALUES ('user',b,'anthropic','x');
  INSERT INTO integrations(id,user_id,type,name,is_active) VALUES (gw_a,a,'llm_gateway','gw-a',true);

  r := axtn_case_execution(a,'resolve',jsonb_build_object('runId',run,'nodeId','gw','operationKey','ok-1'));
  IF r->>'policy_user_id' <> a::text THEN RAISE EXCEPTION 'FAIL policy identity is %', r->>'policy_user_id'; END IF;
  IF r->>'budget_subject_user_id' <> a::text OR r->>'budget_subject_group_id' IS NOT NULL THEN RAISE EXCEPTION 'FAIL budget identity'; END IF;
  IF r->'node_routes'->(run||':gw')->>'provider_id' <> 'vllm' OR r->'node_routes'->(run||':gw')->>'transport' <> 'LLM_GATEWAY'
  THEN RAISE EXCEPTION 'FAIL gateway route evidence %', r->'node_routes'; END IF;
  IF r->>'execution_class' <> 'SYSTEM_INTEGRATION' THEN RAISE EXCEPTION 'FAIL gateway node must not need a personal connection'; END IF;
  RAISE NOTICE 'PASS A with rights is allowed; Case assignee/semantic route do not change identity';

  -- Direct credential loading is refused for a gateway node: no direct-provider fallback.
  PERFORM pg_temp.expect_fail('credential',run,'gw','ROUTING_DECISION_REQUIRED');
  RAISE NOTICE 'PASS credential load refused for gateway node';

  -- A loses the model right although B (assignee) has rights for the semantic route.
  DELETE FROM iam_model_rules WHERE principal_id=a;
  INSERT INTO iam_model_rules(principal_type,principal_id,provider,model_pattern) VALUES ('user',a,'openai','x');
  INSERT INTO iam_model_rules(principal_type,principal_id,provider,model_pattern) VALUES ('user',b,'vllm','*');
  PERFORM pg_temp.expect_fail('resolve',run,'gw','MODEL_ACCESS_DENIED');
  RAISE NOTICE 'PASS A without model right is denied although B has it';

  -- Gateway availability is A's own: missing, inactive, ambiguous, foreign owner, no derived right.
  DELETE FROM iam_model_rules WHERE principal_id IN (a,b);
  INSERT INTO iam_model_rules(principal_type,principal_id,provider,model_pattern) VALUES ('user',a,'vllm','*');
  UPDATE integrations SET is_active=false WHERE id=gw_a;
  PERFORM pg_temp.expect_fail('resolve',run,'gw','SYSTEM_INTEGRATION_UNAVAILABLE');
  UPDATE integrations SET is_active=true,user_id=b WHERE id=gw_a;
  PERFORM pg_temp.expect_fail('resolve',run,'gw','SYSTEM_INTEGRATION_UNAVAILABLE');
  UPDATE integrations SET user_id=a WHERE id=gw_a;
  -- Ambiguity cannot arise: uniq_integrations_singleton_type allows one llm_gateway per user.
  BEGIN
    INSERT INTO integrations(id,user_id,type,name,is_active) VALUES (gw_b,a,'llm_gateway','gw-a2',true);
    RAISE EXCEPTION 'FAIL second gateway per user was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS inactive/foreign gateway fail closed; ambiguity prevented by constraint';

  -- Node not in the snapshot / manipulated id.
  PERFORM pg_temp.expect_fail('resolve',run,'forged','CASE_EXECUTION_SEMANTIC_NODE_REQUIRED');
  RAISE NOTICE 'PASS manipulated node id rejected';

  -- Non-opted-in node on a personal-mode Case keeps the personal path (account/plan exception).
  BEGIN
    PERFORM axtn_case_execution(a,'resolve',jsonb_build_object('runId',run,'nodeId','plain','operationKey','ok-2'));
    RAISE EXCEPTION 'FAIL personal path unexpectedly resolved';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT IN ('PERSONAL_CONNECTION_REQUIRED','MODEL_ACCESS_DENIED','NO_ELIGIBLE_EXECUTION_PRINCIPAL')
    THEN RAISE EXCEPTION 'FAIL personal path error %', SQLERRM; END IF;
  END;
  RAISE NOTICE 'PASS personal path unchanged (%)', 'still personal-gated';

  -- Missing Case data access stays blocked independent of model rights.
  DELETE FROM user_data_rows WHERE table_id=tbl;
  PERFORM pg_temp.expect_fail('resolve',run,'gw','CASE_ACCESS_DENIED');
  RAISE NOTICE 'PASS missing Case data access stays blocked';
END
$t$;
ROLLBACK;
