SELECT set_config('axtn_test.owner',(SELECT user_id::text FROM swarms
  WHERE id='62bbd9a0-2fb3-4241-828d-584fa76edc74'),true);
CREATE FUNCTION pg_temp.ensure_work(identity text,kind text DEFAULT 'DEVELOPMENT_BUILD')
RETURNS text LANGUAGE sql AS $$
  SELECT public.axtn_case_work(current_setting('axtn_test.owner')::uuid,'ensure',
    jsonb_build_object('sourceId','rollback-policy:'||identity,'subject','Rollback-only Case policy',
      'caseType',kind,'workContractRef',jsonb_build_object('kind','contract',
        'repository','aXtn/aXtn-agentswarms','id','tests/case-work/contract-policy.sql'),
      'scenarioClass','regression','scenarioId','rollback-policy','processingMode','DETERMINISTIC',
      'executionChannel','COPILOT_CLI','actorRef','policy-fixture','requiredDependencies','[]'::jsonb,
      'references','[]'::jsonb))->>'case_id';
$$;
CREATE FUNCTION pg_temp.reject_work(operation text,request jsonb,message text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM public.axtn_case_work(current_setting('axtn_test.owner')::uuid,operation,request);
    RAISE EXCEPTION 'Expected native policy denial did not occur';
  EXCEPTION WHEN raise_exception THEN
    IF position(message IN SQLERRM)=0 THEN RAISE; END IF;
  END;
END;
$$;
SELECT set_config('axtn_test.a',pg_temp.ensure_work('a'),true);
SELECT set_config('axtn_test.b',pg_temp.ensure_work('b'),true);
SELECT set_config('axtn_test.improvement',
  pg_temp.ensure_work('improvement','DEVELOPMENT_IMPROVEMENT_CANDIDATE'),true);
DO $$ BEGIN
  IF pg_temp.ensure_work('a')<>current_setting('axtn_test.a')
  THEN RAISE EXCEPTION 'Ensure duplicated stable Work identity'; END IF;
END $$;

-- Positive and negative proof fixtures are entirely transactional, not a real
-- Human decision or production acceptance claim.
CREATE FUNCTION pg_temp.ensure_proof(identity text,kind text,parent text DEFAULT NULL)
RETURNS text LANGUAGE sql AS $$
  SELECT public.axtn_case_work(current_setting('axtn_test.owner')::uuid,'ensure',
    jsonb_build_object('sourceId','rollback-policy:proof:'||identity,'subject','Rollback-only native proof',
      'caseType',kind,'parentCaseId',parent,'workContractRef',jsonb_build_object('kind','contract',
        'repository','aXtn/aXtn-agentswarms','id','tests/case-work/contract-policy.sql'),
      'taskId','native-policy-task','scenarioClass','regression','scenarioId','rollback-policy',
      'processingMode','DETERMINISTIC','executionChannel','SWARM','actorRef','native-machine',
      'requiredDependencies','[]'::jsonb,'references','[]'::jsonb))->>'case_id';
$$;
SELECT set_config('axtn_test.proof_parent',pg_temp.ensure_proof('parent','DEVELOPMENT_CHANGE'),true);
SELECT set_config('axtn_test.proof_verify',pg_temp.ensure_proof(
  'verify','DEVELOPMENT_VERIFY',current_setting('axtn_test.proof_parent')),true);
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_parent'),'transitionKey','rollback-policy:proof-parent-bind',
    'eventType','CANDIDATE_UPDATED','reasonCode','TEST','actorRef','native-machine',
    'candidateSHA',repeat('b',40),'attemptId','policy-attempt','references','[]'::jsonb));
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_verify'),'transitionKey','rollback-policy:proof-verify-bind',
    'eventType','CANDIDATE_UPDATED','reasonCode','TEST','actorRef','native-machine',
    'candidateSHA',repeat('b',40),'attemptId','policy-attempt','references','[]'::jsonb));

SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_parent'),'transitionKey','rollback-policy:proof-parent-start',
    'eventType','STARTED','reasonCode','TEST','actorRef','native-machine',
    'attemptId','policy-attempt','references','[]'::jsonb));
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_verify'),'transitionKey','rollback-policy:proof-verify-start',
    'eventType','STARTED','reasonCode','TEST','actorRef','native-machine',
    'attemptId','policy-attempt','references','[]'::jsonb));

INSERT INTO notebook_runtime_sessions
  SELECT (jsonb_populate_record(NULL::notebook_runtime_sessions,to_jsonb(s)||
    jsonb_build_object('id','77777777-7777-4777-8777-777777777777',
      'inputs',s.inputs||jsonb_build_object('caseId',current_setting('axtn_test.proof_verify'),
        'taskId','native-policy-task','attemptId','policy-attempt','candidateSHA',repeat('b',40),
        'effectKey','rollback-policy:native-proof'),
      'result',s.result||jsonb_build_object('sessionId','77777777-7777-4777-8777-777777777777',
        'taskId','native-policy-task','attemptId','policy-attempt','candidateSHA',repeat('b',40),
        'effectKey','rollback-policy:native-proof')))).*
  FROM notebook_runtime_sessions s
  WHERE s.id='c7532662-de0c-4e7c-8836-6d947a0a7d04';
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM notebook_runtime_sessions WHERE id='77777777-7777-4777-8777-777777777777')
  THEN RAISE EXCEPTION 'Expected source-verifier receipt fixture seed unavailable'; END IF;
END $$;
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_verify'),'transitionKey','rollback-policy:proof-hard-pass',
    'eventType','CHECKS_PASSED','reasonCode','TEST','actorRef','native-machine',
    'candidateSHA',repeat('b',40),'runId','77777777-7777-4777-8777-777777777777','references','[]'::jsonb));

SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_verify'),'transitionKey','rollback-policy:proof-verify-complete',
    'eventType','COMPLETED','reasonCode','TEST','actorRef','native-machine',
    'candidateSHA',repeat('b',40),
    'references',jsonb_build_array(jsonb_build_object('kind','evidence',
      'repository','aXtn/aXtn-agentswarms','id','tests/case-work/contract-policy.sql'))));

INSERT INTO swarm_runs(id,user_id,status)
VALUES('88888888-8888-4888-8888-888888888888',current_setting('axtn_test.owner')::uuid,'suspended');
INSERT INTO approvals(id,user_id,agent_name,action_type,action_title,swarm_run_id,payload)
VALUES('99999999-9999-4999-8999-999999999999',current_setting('axtn_test.owner')::uuid,
  'Native proof fixture','swarm_step','Rollback-only exact revision',
  '88888888-8888-4888-8888-888888888888',
  jsonb_build_object('axtnDevelopment',jsonb_build_object(
    'caseId',current_setting('axtn_test.proof_parent'),'candidateSHA',repeat('b',40),
    'runtimeSessionId','77777777-7777-4777-8777-777777777777')));
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub',current_setting('axtn_test.owner'),'role','authenticated')::text,true);
UPDATE approvals SET status='approved' WHERE id='99999999-9999-4999-8999-999999999999';
RESET ROLE;
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_parent'),'transitionKey','rollback-policy:proof-parent-checks',
    'eventType','CHECKS_PASSED','reasonCode','TEST','actorRef','native-machine',
    'candidateSHA',repeat('b',40),'references','[]'::jsonb));
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'accept',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_parent'),'transitionKey','rollback-policy:proof-accept',
    'candidateSHA',repeat('b',40),'approvalId','99999999-9999-4999-8999-999999999999'));
SELECT pg_temp.reject_work('accept',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_parent'),'transitionKey','rollback-policy:proof-wrong-sha',
    'candidateSHA',repeat('c',40),'approvalId','99999999-9999-4999-8999-999999999999'),
  'exact Candidate');
UPDATE notebook_runtime_sessions SET inputs=jsonb_set(inputs,'{attemptId}','"foreign-attempt"')
  WHERE id='77777777-7777-4777-8777-777777777777';
SELECT pg_temp.reject_work('accept',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_parent'),'transitionKey','rollback-policy:proof-wrong-attempt',
    'candidateSHA',repeat('b',40),'approvalId','99999999-9999-4999-8999-999999999999'),
  'hard gate required');
UPDATE notebook_runtime_sessions SET inputs=jsonb_set(inputs,'{attemptId}','"policy-attempt"'),
  result=jsonb_set(result,'{gateVerdict}','"FAIL"')
  WHERE id='77777777-7777-4777-8777-777777777777';
SELECT pg_temp.reject_work('accept',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_parent'),'transitionKey','rollback-policy:proof-hard-fail',
    'candidateSHA',repeat('b',40),'approvalId','99999999-9999-4999-8999-999999999999'),
  'hard gate required');
UPDATE notebook_runtime_sessions SET result=jsonb_set(result,'{gateVerdict}','"PASS"'),
  inputs=jsonb_set(inputs,'{caseId}',to_jsonb(current_setting('axtn_test.a')))
  WHERE id='77777777-7777-4777-8777-777777777777';
SELECT pg_temp.reject_work('accept',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_parent'),'transitionKey','rollback-policy:proof-wrong-lineage',
    'candidateSHA',repeat('b',40),'approvalId','99999999-9999-4999-8999-999999999999'),
  'different Case lineage');
UPDATE notebook_runtime_sessions SET inputs=jsonb_set(
  inputs,'{caseId}',to_jsonb(current_setting('axtn_test.proof_verify')))
  WHERE id='77777777-7777-4777-8777-777777777777';
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_parent'),'transitionKey','rollback-policy:proof-human-build',
    'eventType','TAKEOVER','reasonCode','TEST','actorRef',current_setting('axtn_test.owner'),
    'processingMode','HUMAN','executionChannel','HUMAN','references','[]'::jsonb,
    '_principal',jsonb_build_object('kind','user_session','id',current_setting('axtn_test.owner'))));
SELECT pg_temp.reject_work('accept',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_parent'),'transitionKey','rollback-policy:proof-self-accept',
    'candidateSHA',repeat('b',40),'approvalId','99999999-9999-4999-8999-999999999999',
    '_principal',jsonb_build_object('kind','user_session','id',current_setting('axtn_test.owner'))),
  'Human Builder cannot self accept');
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_parent'),'transitionKey','rollback-policy:proof-human-release',
    'eventType','TAKEOVER','reasonCode','TEST','actorRef',current_setting('axtn_test.owner'),
    'processingMode','SEMANTIC','executionChannel','SWARM','references','[]'::jsonb,
    '_principal',jsonb_build_object('kind','user_session','id',current_setting('axtn_test.owner'))));
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_parent'),'transitionKey','rollback-policy:proof-machine-after-builder',
    'eventType','STARTED','reasonCode','TEST','actorRef','native-machine','references','[]'::jsonb));
SELECT pg_temp.reject_work('accept',
  jsonb_build_object('caseId',current_setting('axtn_test.proof_parent'),'transitionKey','rollback-policy:proof-builder-laundering',
    'candidateSHA',repeat('b',40),'approvalId','99999999-9999-4999-8999-999999999999'),
  'Human Builder cannot self accept');
INSERT INTO approvals(id,user_id,agent_name,action_type,action_title,swarm_run_id,payload)
  SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id,agent_name,action_type,action_title,swarm_run_id,payload
    FROM approvals WHERE id='99999999-9999-4999-8999-999999999999';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    UPDATE approvals SET status='approved' WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    RAISE EXCEPTION 'Human Builder approved its own result';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Human Builder cannot approve its own result' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'dependencies',
  jsonb_build_object('operation','dependencies','caseId',current_setting('axtn_test.b'),
    'transitionKey','rollback-policy:b-dependency','actorRef','policy-fixture',
    'dependencies',jsonb_build_array(jsonb_build_object('caseId',current_setting('axtn_test.a'),
      'kind','REQUIRES_COMPLETION'))));
SELECT pg_temp.reject_work('dependencies',
  jsonb_build_object('caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:cycle',
    'actorRef','policy-fixture','dependencies',jsonb_build_array(
      jsonb_build_object('caseId',current_setting('axtn_test.b'),'kind','INFORMS'))),
  'Directed dependency cycle');
SELECT pg_temp.reject_work('dependencies',
  jsonb_build_object('caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:self',
    'actorRef','policy-fixture','dependencies',jsonb_build_array(
      jsonb_build_object('caseId',current_setting('axtn_test.a'),'kind','REQUIRES_CANDIDATE'))),
  'Invalid directed dependency');
SELECT pg_temp.reject_work('transition',
  jsonb_build_object('caseId',current_setting('axtn_test.b'),'transitionKey','rollback-policy:early',
    'eventType','STARTED','reasonCode','TEST','actorRef','policy-fixture','references','[]'::jsonb),
  'Directed dependency contract incomplete');
SELECT pg_temp.reject_work('transition',
  jsonb_build_object('caseId',current_setting('axtn_test.improvement'),'transitionKey','rollback-policy:learn-start',
    'eventType','STARTED','reasonCode','TEST','actorRef','policy-fixture','references','[]'::jsonb),
  'explicit promotion');
SELECT pg_temp.reject_work('transition',
  jsonb_build_object('caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:fake-human',
    'eventType','TAKEOVER','reasonCode','TEST','actorRef','invented-human',
    'processingMode','HUMAN','executionChannel','HUMAN','references','[]'::jsonb),
  'authenticated user session');
SELECT pg_temp.reject_work('transition',
  jsonb_build_object('caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:fake-accept',
    'eventType','ACCEPTED','reasonCode','PASS','actorRef','different-actor','references','[]'::jsonb),
  'independent Acceptance proof');
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:a-start',
    'eventType','STARTED','reasonCode','TEST','actorRef','policy-fixture','references','[]'::jsonb));
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:a-start',
    'eventType','STARTED','reasonCode','TEST','actorRef','policy-fixture','references','[]'::jsonb));
SELECT pg_temp.reject_work('transition',
  jsonb_build_object('caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:a-start',
    'eventType','STARTED','reasonCode','DIFFERENT','actorRef','policy-fixture','references','[]'::jsonb),
  'Transition conflict');
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:a-complete',
    'eventType','COMPLETED','reasonCode','TEST','actorRef','policy-fixture',
    'references',jsonb_build_array(jsonb_build_object('kind','evidence',
      'repository','aXtn/aXtn-agentswarms','id','tests/case-work/contract-policy.sql'))));
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.b'),'transitionKey','rollback-policy:b-start',
    'eventType','STARTED','reasonCode','TEST','actorRef','policy-fixture','references','[]'::jsonb));
DO $$ BEGIN
  IF (SELECT count(*) FROM audit_events WHERE resource_type='axtn_case_work'
      AND detail->>'transitionKey'='rollback-policy:a-start')<>1
  THEN RAISE EXCEPTION 'Duplicate transition evidence'; END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub',current_setting('axtn_test.owner'),'role','service_role')::text,true);
DO $$ BEGIN
  BEGIN
    UPDATE user_data_rows SET row=row||'{"status":"CLOSED","accepted_sha":"forged"}'::jsonb
      WHERE row->>'case_id'=current_setting('axtn_test.a');
    RAISE EXCEPTION 'Generic owner Case mutation succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Development work requires the native Case contract' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE user_data_rows SET row=row-'work_identity'-'source_kind'
      WHERE row->>'case_id'=current_setting('axtn_test.a');
    RAISE EXCEPTION 'Native Work identity laundering succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Development work requires the native Case contract' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM user_data_rows WHERE row->>'case_id'=current_setting('axtn_test.a');
    RAISE EXCEPTION 'Native Work deletion succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Development work requires the native Case contract' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE user_data_tables SET name='laundered_cases'
      WHERE user_id=current_setting('axtn_test.owner')::uuid AND name='axtn_cases';
    RAISE EXCEPTION 'Native Work dataset laundering succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Development work requires the native Case contract' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO audit_events(user_id,action,resource_type,resource_id)
    VALUES(current_setting('axtn_test.owner')::uuid,'axtn_work.ACCEPTED','axtn_case_work',
      current_setting('axtn_test.a')::uuid);
    RAISE EXCEPTION 'Native event forgery succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Development work requires the native Case contract' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$ BEGIN
  BEGIN
    UPDATE user_data_rows SET row=row||'{"status":"CLOSED"}'::jsonb
      WHERE row->>'case_id'=current_setting('axtn_test.b');
    RAISE EXCEPTION 'Generic server-role bypass succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Development work requires the native Case contract' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_local_table_upsert(current_setting('axtn_test.owner')::uuid,'axtn_cases',
      'case_id',current_setting('axtn_test.b'),jsonb_build_object(
        'case_id',current_setting('axtn_test.b'),'source_kind','manual','case_type','TODO','status','CLOSED'));
    RAISE EXCEPTION 'Local Table definer bypass succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Development work requires the native Case contract' THEN RAISE; END IF;
  END;
END $$;
-- Native SECURITY DEFINER contract still works through the real server role.
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.b'),'transitionKey','rollback-policy:native-server',
    'eventType','RESULT','reasonCode','TEST','actorRef','policy-fixture','references','[]'::jsonb));
RESET ROLE;

-- A server cannot pretend to be the routed human decision authority.
INSERT INTO swarm_runs(id,user_id,status)
VALUES('114a1912-c8a4-4350-bd56-a42c90f5a672',current_setting('axtn_test.owner')::uuid,'suspended');
INSERT INTO approvals(id,user_id,agent_name,action_type,action_title,swarm_run_id,payload)
VALUES('bc2a70a0-418a-4e60-a11a-6c424260821d',current_setting('axtn_test.owner')::uuid,
  'Case policy fixture','swarm_step','Rollback-only decision policy',
  '114a1912-c8a4-4350-bd56-a42c90f5a672',
  '{"axtnDevelopment":{"caseId":"rollback-only"}}');
SET LOCAL ROLE service_role;
DO $$ BEGIN
  BEGIN
    UPDATE approvals SET status='approved',decided_by=current_setting('axtn_test.owner')::uuid
      WHERE id='bc2a70a0-418a-4e60-a11a-6c424260821d';
    RAISE EXCEPTION 'Machine minted Human approval';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Native work decisions require the routed authenticated approver' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',jsonb_build_object(
  'sub',current_setting('axtn_test.owner'),'role','authenticated')::text,true);
UPDATE approvals SET status='approved',decided_by='00000000-0000-4000-8000-000000000000'
  WHERE id='bc2a70a0-418a-4e60-a11a-6c424260821d';
RESET ROLE;
DO $$ BEGIN
  IF (SELECT decided_by FROM approvals WHERE id='bc2a70a0-418a-4e60-a11a-6c424260821d')
    IS DISTINCT FROM current_setting('axtn_test.owner')::uuid
  THEN RAISE EXCEPTION 'Approval did not derive its real authenticated decision identity'; END IF;
END $$;

SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    UPDATE approvals SET status='rejected' WHERE id='bc2a70a0-418a-4e60-a11a-6c424260821d';
    RAISE EXCEPTION 'Double decision succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Native work decisions require the routed authenticated approver' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE approvals SET payload='{"axtnDevelopment":{"caseId":"different"}}'
      WHERE id='bc2a70a0-418a-4e60-a11a-6c424260821d';
    RAISE EXCEPTION 'Approval payload tampering succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Native work approval binding is immutable' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;

SELECT pg_temp.reject_work('transition',
  jsonb_build_object('caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:new-complete',
    'eventType','COMPLETED','reasonCode','TEST','actorRef','policy-fixture','references','[]'::jsonb),
  'Start Work before completion');
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:new-sha',
    'eventType','CANDIDATE_UPDATED','reasonCode','TEST','actorRef','policy-fixture',
    'candidateSHA',repeat('b',40),'references','[]'::jsonb));
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM user_data_rows WHERE row->>'case_id'=current_setting('axtn_test.b')
    AND row->>'status_reason'='DEPENDENCY_INVALIDATED'
    AND NOT row ? 'accepted_sha' AND NOT row ? 'checks_sha')
  THEN RAISE EXCEPTION 'Dependent Work did not invalidate on predecessor revision change'; END IF;
END $$;

SELECT pg_temp.reject_work('details',jsonb_build_object(
  'caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:fake-critical',
  'actorRef','machine','subject','Human Critical','priority',0,'dueDate',NULL,'followUp',NULL),
  'Human Critical');
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'details',jsonb_build_object(
  'caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:human-details',
  'actorRef',current_setting('axtn_test.owner'),'subject','Human Critical','priority',0,
  'dueDate','2026-10-20','followUp','2026-10-10',
  '_principal',jsonb_build_object('kind','user_session','id',current_setting('axtn_test.owner'))));
SELECT pg_temp.reject_work('details',jsonb_build_object(
  'caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:overwrite-critical',
  'actorRef','machine','subject','Low priority','priority',3,'dueDate',NULL,'followUp',NULL),
  'Human Critical');
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:human-takeover',
    'eventType','TAKEOVER','reasonCode','TEST','actorRef',current_setting('axtn_test.owner'),
    'processingMode','HUMAN','executionChannel','HUMAN','references','[]'::jsonb,
    '_principal',jsonb_build_object('kind','user_session','id',current_setting('axtn_test.owner'))));
SELECT pg_temp.reject_work('transition',
  jsonb_build_object('caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:machine-continue',
    'eventType','RESULT','reasonCode','TEST','actorRef','machine','references','[]'::jsonb),
  'Human-owned Work');
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.a'),'transitionKey','rollback-policy:human-release',
    'eventType','TAKEOVER','reasonCode','TEST','actorRef',current_setting('axtn_test.owner'),
    'processingMode','DETERMINISTIC','executionChannel','SWARM','references','[]'::jsonb,
    '_principal',jsonb_build_object('kind','user_session','id',current_setting('axtn_test.owner'))));

SELECT set_config('axtn_test.verify',pg_temp.ensure_work('verify','DEVELOPMENT_VERIFY'),true);
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.verify'),'transitionKey','rollback-policy:verify-candidate',
    'eventType','CANDIDATE_UPDATED','reasonCode','TEST','actorRef','verifier',
    'candidateSHA',repeat('b',40),'references','[]'::jsonb));
SELECT pg_temp.reject_work('transition',
  jsonb_build_object('caseId',current_setting('axtn_test.verify'),'transitionKey','rollback-policy:invented-hard-pass',
    'eventType','CHECKS_PASSED','reasonCode','TEST','actorRef','human',
    'candidateSHA',repeat('b',40),'references','[]'::jsonb),
  'native deterministic proof');

SELECT set_config('axtn_test.abandon',pg_temp.ensure_work('abandon','DEVELOPMENT_CHANGE'),true);
SELECT axtn_case_work(current_setting('axtn_test.owner')::uuid,'transition',
  jsonb_build_object('caseId',current_setting('axtn_test.abandon'),'transitionKey','rollback-policy:abandon',
    'eventType','ABANDONED','reasonCode','CONSCIOUS_ABANDONMENT','actorRef',current_setting('axtn_test.owner'),
    'references',jsonb_build_array(jsonb_build_object('kind','evidence',
      'repository','aXtn/aXtn-agentswarms','id','tests/case-work/contract-policy.sql')),
    '_principal',jsonb_build_object('kind','user_session','id',current_setting('axtn_test.owner'))));
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM user_data_rows WHERE row->>'case_id'=current_setting('axtn_test.abandon')
    AND row->>'status'='CLOSED' AND row->>'integration_phase'='ABANDONED' AND NOT row ? 'accepted_sha')
  THEN RAISE EXCEPTION 'Conscious abandonment became successful Acceptance'; END IF;
END $$;
