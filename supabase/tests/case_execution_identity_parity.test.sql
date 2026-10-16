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
  oa uuid := gen_random_uuid(); run2 uuid := gen_random_uuid(); pb jsonb;
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

  -- Standard (non-gateway) provider on a personal-mode Case: owner A's native rights decide, the Case
  -- route (anthropic) and assignee B play no role.
  PERFORM pg_temp.expect_fail('resolve',run,'plain','MODEL_ACCESS_DENIED');
  INSERT INTO iam_model_rules(principal_type,principal_id,provider,model_pattern) VALUES ('user',a,'openai','gpt-4o');
  INSERT INTO integrations(id,user_id,type,name,provider,is_active) VALUES (oa,a,'llm_provider','oa','openai',true);
  r := axtn_case_execution(a,'resolve',jsonb_build_object('runId',run,'nodeId','plain','operationKey','ok-2'));
  IF r->>'policy_user_id' <> a::text OR r->>'budget_subject_user_id' <> a::text OR r->>'budget_subject_group_id' IS NOT NULL
    OR r->>'execution_class' <> 'SYSTEM_INTEGRATION' OR r->>'provider_id' <> 'openai'
  THEN RAISE EXCEPTION 'FAIL standard provider identity %', r; END IF;
  r := axtn_case_execution(a,'credential',jsonb_build_object('runId',run,'nodeId','plain'));
  IF r->>'ownerId' <> a::text OR r->>'id' <> oa::text THEN RAISE EXCEPTION 'FAIL standard credential %', r; END IF;
  RAISE NOTICE 'PASS standard provider resolves on the run owner identity, not Case route/assignee';

  -- Persisted evidence equals what is returned (binding, per-node route, audit).
  SELECT row->'execution_bindings'->(run::text) INTO pb FROM user_data_rows WHERE table_id=tbl;
  IF pb->>'policy_user_id' <> a::text OR pb->>'budget_subject_user_id' <> a::text
    OR pb->>'budget_subject_group_id' IS NOT NULL OR pb->>'execution_class' <> 'SYSTEM_INTEGRATION'
    OR pb->'node_routes'->(run||':plain')->>'policy_user_id' <> a::text
    OR pb->'node_routes'->(run||':plain')->>'provider_id' <> 'openai'
    OR pb->'node_routes'->(run||':gw')->>'transport' <> 'LLM_GATEWAY'
  THEN RAISE EXCEPTION 'FAIL persisted binding evidence %', pb; END IF;
  IF NOT EXISTS(SELECT 1 FROM audit_events WHERE action='axtn_case_execution.SEMANTIC_BOUND' AND resource_id=run
    AND detail#>>'{binding,policy_user_id}'=a::text) THEN RAISE EXCEPTION 'FAIL audit evidence'; END IF;
  RAISE NOTICE 'PASS persisted binding/node-route/audit evidence matches the returned identity';

  -- Case without assignee/group + gateway: no personal precondition. Fresh attempt, fresh binding.
  UPDATE user_data_rows SET row=row-'assignee_user_id'||jsonb_build_object('responsible_principal_type','USER',
    'responsible_principal_id',a) WHERE table_id=tbl;
  INSERT INTO swarm_runs(id,user_id,swarm_id,swarm_snapshot,status,case_id,case_attempt_id,case_execution_principal)
    VALUES (run2,a,sw,snapshot||jsonb_build_object('nodes',(snapshot->'nodes')||jsonb_build_array(
      jsonb_build_object('id','bare','data',jsonb_build_object('kind','agent')),
      jsonb_build_object('id','cgpt','data',jsonb_build_object('kind','agent','provider','axtn_chatgpt_plan','model','plan-m')))),
      'running',cid::uuid,run2::text,pa);
  r := axtn_case_execution(a,'resolve',jsonb_build_object('runId',run2,'nodeId','gw','operationKey','ok-3'));
  IF r->>'policy_user_id' <> a::text OR r->'node_routes'->(run2||':gw')->>'transport' <> 'LLM_GATEWAY'
  THEN RAISE EXCEPTION 'FAIL gateway without assignee %', r; END IF;
  RAISE NOTICE 'PASS Case without assignee: gateway resolves on owner identity';

  -- Node without provider/model: native default, never Case.semantic_route; equals the non-Case decision.
  IF axtn_case_model_allowed(a,'openrouter','google/gemini-3-flash-preview') THEN RAISE EXCEPTION 'FAIL fixture'; END IF;
  PERFORM pg_temp.expect_fail('resolve',run2,'bare','MODEL_ACCESS_DENIED');
  INSERT INTO iam_model_rules(principal_type,principal_id,provider,model_pattern) VALUES ('user',a,'openrouter','*');
  INSERT INTO integrations(user_id,type,name,provider,is_active) VALUES (a,'llm_provider','or','openrouter',true);
  r := axtn_case_execution(a,'resolve',jsonb_build_object('runId',run2,'nodeId','bare','operationKey','ok-4'));
  IF r->>'provider_id' <> 'openrouter' OR r->>'model_id' <> 'google/gemini-3-flash-preview'
  THEN RAISE EXCEPTION 'FAIL Case route replaced missing node config %', r; END IF;
  RAISE NOTICE 'PASS missing node config uses the native default, not the Case route';

  -- Personal ChatGPT plan stays personal: assignee B's own connection and rights.
  PERFORM pg_temp.expect_fail('resolve',run2,'cgpt','PERSONAL_CONNECTION_REQUIRED');
  UPDATE user_data_rows SET row=row||jsonb_build_object('assignee_user_id',b) WHERE table_id=tbl;
  INSERT INTO iam_model_rules(principal_type,principal_id,provider,model_pattern) VALUES ('user',b,'anthropic','x');
  PERFORM pg_temp.expect_fail('resolve',run2,'cgpt','MODEL_ACCESS_DENIED');
  INSERT INTO iam_model_rules(principal_type,principal_id,provider,model_pattern) VALUES ('user',b,'axtn_chatgpt_plan','*');
  PERFORM pg_temp.expect_fail('resolve',run2,'cgpt','PERSONAL_CONNECTION_REQUIRED');
  INSERT INTO integrations(user_id,type,name,provider,is_active) VALUES (b,'llm_provider','plan','axtn_chatgpt_plan',true);
  r := axtn_case_execution(a,'resolve',jsonb_build_object('runId',run2,'nodeId','cgpt','operationKey','ok-5'));
  IF r->>'execution_class' <> 'PERSONAL_CONNECTION' OR r->>'policy_user_id' <> b::text
    OR r->>'execution_principal_user_id' <> b::text OR r->>'budget_subject_user_id' <> b::text
  THEN RAISE EXCEPTION 'FAIL personal ChatGPT plan not personal %', r; END IF;
  r := axtn_case_execution(a,'credential',jsonb_build_object('runId',run2,'nodeId','cgpt'));
  IF r->>'ownerId' <> b::text THEN RAISE EXCEPTION 'FAIL personal credential owner'; END IF;
  RAISE NOTICE 'PASS ChatGPT plan keeps the personal binding; standard nodes in the same attempt stay owner-bound';

  -- Missing Case data access stays blocked independent of model rights.
  DELETE FROM user_data_rows WHERE table_id=tbl;
  PERFORM pg_temp.expect_fail('resolve',run,'gw','CASE_ACCESS_DENIED');
  RAISE NOTICE 'PASS missing Case data access stays blocked';
END
$t$;
ROLLBACK;
