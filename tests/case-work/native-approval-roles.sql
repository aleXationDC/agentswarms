-- Run inside a BEGIN/ROLLBACK transaction with the migration loaded first.
-- Synthetic identities/receipts test DB contracts, not business Acceptance.
CREATE TEMP TABLE native_fixture AS SELECT
  gen_random_uuid() owner_id,gen_random_uuid() reviewer_id,
  gen_random_uuid() group_reviewer_id,gen_random_uuid() stranger_id,
  gen_random_uuid() builder_id,gen_random_uuid() group_id,
  gen_random_uuid() run_id,gen_random_uuid() case_id,gen_random_uuid() session_id,
  gen_random_uuid() dataset_id;
INSERT INTO auth.users(id,email,invited_at) SELECT owner_id,'owner@native-guard.invalid',now() FROM native_fixture
  UNION ALL SELECT reviewer_id,'reviewer@native-guard.invalid',now() FROM native_fixture
  UNION ALL SELECT group_reviewer_id,'group@native-guard.invalid',now() FROM native_fixture
  UNION ALL SELECT stranger_id,'stranger@native-guard.invalid',now() FROM native_fixture
  UNION ALL SELECT builder_id,'builder@native-guard.invalid',now() FROM native_fixture;
INSERT INTO user_data_tables(id,user_id,name,columns)
  SELECT dataset_id,owner_id,'axtn_cases','[]'::jsonb FROM native_fixture;
INSERT INTO user_data_rows(table_id,row) SELECT dataset_id,jsonb_build_object(
  'case_id',case_id,'source_kind','development_work','case_type','DEVELOPMENT_CHANGE',
  'status','OPEN','candidate_sha',repeat('a',40),'attempt_id','native-guard-fixture',
  'human_builder_ids',jsonb_build_array(builder_id)) FROM native_fixture;
INSERT INTO swarm_runs(id,user_id,status,swarm_snapshot)
  SELECT run_id,owner_id,'suspended','{"nodes":[],"edges":[]}'::jsonb FROM native_fixture;
INSERT INTO notebook_runtime_sessions(id,user_id,entrypoint,status,inputs,result)
  SELECT session_id,owner_id,'axtn-development-verify-v1','succeeded',
    jsonb_build_object('caseId',case_id,'candidateSHA',repeat('a',40),'attemptId','native-guard-fixture'),
    jsonb_build_object('candidateSHA',repeat('a',40),'gateVerdict','PASS') FROM native_fixture;
INSERT INTO iam_groups(id,name) SELECT group_id,'native-guard-fixture' FROM native_fixture;
INSERT INTO iam_group_members(group_id,user_id)
  SELECT group_id,group_reviewer_id FROM native_fixture;
CREATE TEMP TABLE native_requests(label text,id uuid);
INSERT INTO native_requests SELECT label,gen_random_uuid()
  FROM unnest(ARRAY['denials','approve','reject','group','immutable','drift']) label;
INSERT INTO approvals(id,user_id,agent_name,action_type,action_title,swarm_run_id,
  payload,approver_user_ids,approver_group_ids)
SELECT r.id,f.owner_id,'Native fixture','swarm_step',r.label,f.run_id,
  jsonb_build_object('axtnDevelopment',jsonb_build_object(
    'caseId',f.case_id,'candidateSHA',repeat('a',40),'repository','aXtn/development-swarm-acceptance',
    'runtimeSessionId',f.session_id,'attemptId','native-guard-fixture',
    'operationId',r.label,'nodeId','approval','graphHash',repeat('b',64),'evidenceHash',repeat('c',64))),
  ARRAY[f.owner_id,f.reviewer_id,f.builder_id],ARRAY[f.group_id]
FROM native_fixture f CROSS JOIN native_requests r;
GRANT SELECT ON native_fixture,native_requests TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT owner_id::text FROM native_fixture),true);
DO $$ BEGIN
  BEGIN
    PERFORM decide_swarm_approval((SELECT id FROM native_requests WHERE label='denials'),'approved');
    RAISE EXCEPTION 'TEST: owner approval unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'NATIVE_APPROVAL_WORK_OWNER_DENIED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM decide_swarm_approval((SELECT id FROM native_requests WHERE label='denials'),'rejected');
    RAISE EXCEPTION 'TEST: owner rejection unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'NATIVE_APPROVAL_WORK_OWNER_DENIED' THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT stranger_id::text FROM native_fixture),true);
DO $$ BEGIN
  BEGIN
    PERFORM decide_swarm_approval((SELECT id FROM native_requests WHERE label='denials'),'approved');
    RAISE EXCEPTION 'TEST: unrelated reviewer unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'NATIVE_APPROVAL_REVIEWER_DENIED_OR_ALREADY_DECIDED' THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT builder_id::text FROM native_fixture),true);
DO $$ BEGIN
  BEGIN
    PERFORM decide_swarm_approval((SELECT id FROM native_requests WHERE label='denials'),'rejected');
    RAISE EXCEPTION 'TEST: routed Builder unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'NATIVE_APPROVAL_BUILDER_DENIED' THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT reviewer_id::text FROM native_fixture),true);
DO $$ BEGIN
  BEGIN
    UPDATE approvals SET payload='{}' WHERE id=(SELECT id FROM native_requests WHERE label='immutable');
    RAISE EXCEPTION 'TEST: binding edit unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'NATIVE_APPROVAL_BINDING_IMMUTABLE' THEN RAISE; END IF;
  END;
END $$;
SELECT decide_swarm_approval(id,'approved') FROM native_requests WHERE label='approve';
SELECT decide_swarm_approval(id,'rejected') FROM native_requests WHERE label='reject';
DO $$ BEGIN
  BEGIN
    PERFORM decide_swarm_approval((SELECT id FROM native_requests WHERE label='approve'),'approved');
    RAISE EXCEPTION 'TEST: duplicate decision unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'NATIVE_APPROVAL_REVIEWER_DENIED_OR_ALREADY_DECIDED' THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT group_reviewer_id::text FROM native_fixture),true);
SELECT decide_swarm_approval(id,'approved') FROM native_requests WHERE label='group';
RESET ROLE;
UPDATE user_data_rows SET row=row||'{"attempt_id":"drifted"}'::jsonb
  WHERE table_id=(SELECT dataset_id FROM native_fixture);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT reviewer_id::text FROM native_fixture),true);
DO $$ BEGIN
  BEGIN
    PERFORM decide_swarm_approval((SELECT id FROM native_requests WHERE label='drift'),'approved');
    RAISE EXCEPTION 'TEST: attempt drift unexpectedly succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'NATIVE_APPROVAL_CURRENT_WORK_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM audit_events a JOIN native_fixture f ON a.user_id=f.owner_id
      WHERE a.action='axtn_work.APPROVAL_DECIDED') <> 3
  THEN RAISE EXCEPTION 'TEST: decision audit count mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM approvals a JOIN native_requests r ON r.id=a.id
    WHERE r.label IN ('denials','immutable','drift')
      AND (a.status <> 'pending' OR a.decided_at IS NOT NULL OR a.decided_by IS NOT NULL))
  THEN RAISE EXCEPTION 'TEST: denial changed state'; END IF;
  IF EXISTS(SELECT 1 FROM approvals a JOIN native_requests r ON r.id=a.id
    WHERE r.label IN ('approve','reject','group') AND
      (a.decided_at IS NULL OR a.decided_by IS NULL OR
        a.decided_by=(SELECT owner_id FROM native_fixture)))
  THEN RAISE EXCEPTION 'TEST: authenticated decision identity/time missing'; END IF;
  RAISE NOTICE 'PASS: owner/builder/unrouted denial, immutable binding, reviewer approve/reject, group, duplicate, drift, atomic audit';
END $$;
