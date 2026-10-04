\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
  VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
  ON CONFLICT(id) DO NOTHING;
CREATE TEMP TABLE dms_approval_fixture AS SELECT
  gen_random_uuid() owner_id,gen_random_uuid() reviewer_id,
  gen_random_uuid() group_reviewer_id,gen_random_uuid() stranger_id,
  gen_random_uuid() builder_id,gen_random_uuid() group_id,
  gen_random_uuid() run_id,gen_random_uuid() case_id,gen_random_uuid() decision_id,
  gen_random_uuid() dataset_id,gen_random_uuid() decisions_dataset_id,gen_random_uuid() attempt_id;
INSERT INTO auth.users(id,email,invited_at)
  SELECT owner_id,'owner@dms-approval.invalid',now() FROM dms_approval_fixture
  UNION ALL SELECT reviewer_id,'reviewer@dms-approval.invalid',now() FROM dms_approval_fixture
  UNION ALL SELECT group_reviewer_id,'group@dms-approval.invalid',now() FROM dms_approval_fixture
  UNION ALL SELECT stranger_id,'stranger@dms-approval.invalid',now() FROM dms_approval_fixture
  UNION ALL SELECT builder_id,'builder@dms-approval.invalid',now() FROM dms_approval_fixture;
INSERT INTO user_data_tables(id,user_id,name,columns)
  SELECT dataset_id,owner_id,'axtn_cases','[]'::jsonb FROM dms_approval_fixture
  UNION ALL SELECT decisions_dataset_id,owner_id,'axtn_document_decisions','[]'::jsonb FROM dms_approval_fixture;
INSERT INTO user_data_rows(table_id,row)
  SELECT dataset_id,jsonb_build_object('case_id',case_id,'source_kind','document_work',
    'case_type','DOCUMENT_PROCESSING','source_id','request:fixture:approval-fixture','status','OPEN',
    'attempt_id',attempt_id,'input_hash',repeat('a',64),'document_id','document-fixture',
    'document_decisions_by_operation',jsonb_build_object('CLASSIFY',
      jsonb_build_object('decisionId',decision_id,'revision',repeat('b',64))),
    'processing_mode','HUMAN','actor_principal',jsonb_build_object('kind','user_session','id',builder_id),
    'document_input',jsonb_build_object('sourceRef','fixture:approval','sourceRevision','"etag:0001"'))
  FROM dms_approval_fixture;
INSERT INTO user_data_rows(table_id,row)
  SELECT decisions_dataset_id,jsonb_build_object('decision_id',decision_id,'case_id',case_id,
    'revision',repeat('b',64),'status','PROPOSED',
    'principal',jsonb_build_object('kind','user_session','id',builder_id),
    'document_decision',jsonb_build_object('caseId',case_id,'attemptId',attempt_id,
      'schemaVersion','document-decision-v1','featureSchemaRevision','document-features-v1',
      'operation','CLASSIFY',
      'inputHash',repeat('a',64),'documentId','document-fixture',
      'sourceRef','fixture:approval','sourceRevision','"etag:0001"',
      'automationMode','ASSISTED','ruleRevision',NULL))
  FROM dms_approval_fixture;
INSERT INTO iam_groups(id,name) SELECT group_id,'dms-approval-fixture' FROM dms_approval_fixture;
INSERT INTO iam_group_members(group_id,user_id)
  SELECT group_id,group_reviewer_id FROM dms_approval_fixture;
CREATE TEMP TABLE dms_approval_requests(label text,id uuid);
INSERT INTO dms_approval_requests SELECT label,gen_random_uuid()
  FROM unnest(ARRAY['denials','approve','reject','group','immutable','drift','cancel']) label;
INSERT INTO swarm_runs(id,user_id,status,swarm_snapshot)
  SELECT f.run_id,f.owner_id,'suspended',jsonb_build_object('nodes',
    (SELECT jsonb_agg(jsonb_build_object('id',r.label,'data',jsonb_build_object(
      'kind','approval','approverUserIds',jsonb_build_array(f.owner_id,f.reviewer_id,f.builder_id),
      'approverGroupIds',jsonb_build_array(f.group_id),'approvalDocument',
      jsonb_build_object('caseId',f.case_id,'decisionId',f.decision_id,'operationId',r.label,'operation','CLASSIFY'))))
      FROM dms_approval_requests r),'edges','[]'::jsonb) FROM dms_approval_fixture f;
INSERT INTO approvals(id,user_id,agent_name,action_type,action_title,swarm_run_id,
  payload,approver_user_ids,approver_group_ids)
SELECT r.id,f.owner_id,'DMS native fixture','swarm_step',r.label,f.run_id,
  jsonb_build_object('documentProposal',
    (SELECT row->'document_decision' FROM user_data_rows WHERE table_id=f.decisions_dataset_id),
    'axtnDocument',jsonb_build_object(
    'caseId',f.case_id,'attemptId',f.attempt_id,'inputHash',repeat('a',64),
    'documentId','document-fixture','sourceRef','fixture:approval','sourceRevision','"etag:0001"',
    'decisionId',f.decision_id,'decisionRevision',repeat('b',64),'policyRevision',NULL,
    'proposalOperation','CLASSIFY',
    'operationId',r.label,'nodeId',r.label,'graphHash',repeat('c',64),'evidenceHash',repeat('d',64))),
  ARRAY[f.owner_id,f.reviewer_id,f.builder_id],ARRAY[f.group_id]
FROM dms_approval_fixture f CROSS JOIN dms_approval_requests r;
GRANT SELECT ON dms_approval_fixture,dms_approval_requests TO authenticated,service_role;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT owner_id::text FROM dms_approval_fixture),true);
DO $$ DECLARE decision text; BEGIN
  FOREACH decision IN ARRAY ARRAY['approved','rejected'] LOOP
    BEGIN
      PERFORM decide_swarm_approval((SELECT id FROM dms_approval_requests WHERE label='denials'),decision);
      RAISE EXCEPTION 'Owner decided own DMS work';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'DMS_NATIVE_APPROVAL_WORK_OWNER_DENIED' THEN RAISE; END IF;
    END;
  END LOOP;
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT stranger_id::text FROM dms_approval_fixture),true);
DO $$ BEGIN
  BEGIN
    PERFORM decide_swarm_approval((SELECT id FROM dms_approval_requests WHERE label='denials'),'approved');
    RAISE EXCEPTION 'Unrouted reviewer decided';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'NATIVE_APPROVAL_REVIEWER_DENIED_OR_ALREADY_DECIDED' THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT builder_id::text FROM dms_approval_fixture),true);
DO $$ BEGIN
  BEGIN
    PERFORM decide_swarm_approval((SELECT id FROM dms_approval_requests WHERE label='denials'),'rejected');
    RAISE EXCEPTION 'Routed Builder decided own proposal';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DMS_NATIVE_APPROVAL_BUILDER_DENIED' THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT reviewer_id::text FROM dms_approval_fixture),true);
DO $$ BEGIN
  BEGIN
    UPDATE approvals SET payload='{}' WHERE id=(SELECT id FROM dms_approval_requests WHERE label='immutable');
    RAISE EXCEPTION 'Reviewer changed immutable binding';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DMS_NATIVE_APPROVAL_BINDING_IMMUTABLE' THEN RAISE; END IF;
  END;
END $$;
SELECT decide_swarm_approval(id,'approved') FROM dms_approval_requests WHERE label='approve';
SELECT decide_swarm_approval(id,'rejected') FROM dms_approval_requests WHERE label='reject';
DO $$ BEGIN
  BEGIN
    PERFORM decide_swarm_approval((SELECT id FROM dms_approval_requests WHERE label='approve'),'approved');
    RAISE EXCEPTION 'Repeated decision succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'NATIVE_APPROVAL_REVIEWER_DENIED_OR_ALREADY_DECIDED' THEN RAISE; END IF;
  END;
END $$;
SELECT set_config('request.jwt.claim.sub',(SELECT group_reviewer_id::text FROM dms_approval_fixture),true);
SELECT decide_swarm_approval(id,'approved') FROM dms_approval_requests WHERE label='group';
RESET ROLE;

SELECT assert_axtn_document_approval_resume(r.id,f.owner_id)
  FROM dms_approval_fixture f CROSS JOIN dms_approval_requests r WHERE r.label='group';
DELETE FROM iam_group_members WHERE group_id=(SELECT group_id FROM dms_approval_fixture);
DO $$ BEGIN
  BEGIN
    PERFORM assert_axtn_document_approval_resume(r.id,f.owner_id)
      FROM dms_approval_fixture f CROSS JOIN dms_approval_requests r WHERE r.label='group';
    RAISE EXCEPTION 'Revoked group authority survived resume';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DMS_NATIVE_APPROVAL_CURRENT_REVIEWER_REQUIRED' THEN RAISE; END IF;
  END;
END $$;
UPDATE user_data_rows SET row=jsonb_set(row,'{document_decisions_by_operation,CLASSIFY,decisionId}',
  to_jsonb((SELECT stranger_id::text FROM dms_approval_fixture)))
  WHERE table_id=(SELECT dataset_id FROM dms_approval_fixture);
DO $$ BEGIN
  BEGIN
    PERFORM assert_axtn_document_approval_resume(r.id,f.owner_id)
      FROM dms_approval_fixture f CROSS JOIN dms_approval_requests r WHERE r.label='approve';
    RAISE EXCEPTION 'Approved proposal survived supersession at resume';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DMS_NATIVE_APPROVAL_CURRENT_DECISION_REQUIRED' THEN RAISE; END IF;
  END;
END $$;
UPDATE user_data_rows SET row=jsonb_set(row,'{document_decisions_by_operation,CLASSIFY,decisionId}',
  to_jsonb((SELECT decision_id::text FROM dms_approval_fixture)))
  WHERE table_id=(SELECT dataset_id FROM dms_approval_fixture);
UPDATE user_data_rows SET row=jsonb_set(row,'{document_input,sourceRevision}','"changed"')
  WHERE table_id=(SELECT dataset_id FROM dms_approval_fixture);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT reviewer_id::text FROM dms_approval_fixture),true);
DO $$ BEGIN
  BEGIN
    PERFORM decide_swarm_approval((SELECT id FROM dms_approval_requests WHERE label='drift'),'approved');
    RAISE EXCEPTION 'Source drift survived decision';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DMS_NATIVE_APPROVAL_CURRENT_PROPOSAL_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM audit_events a JOIN dms_approval_fixture f ON a.user_id=f.owner_id
    WHERE a.action='axtn_work.DOCUMENT_APPROVAL_DECIDED')<>3
  THEN RAISE EXCEPTION 'Decision audit count mismatch'; END IF;
  IF EXISTS(SELECT 1 FROM approvals a JOIN dms_approval_requests r ON r.id=a.id
    WHERE r.label IN ('denials','immutable','drift')
      AND (a.status<>'pending' OR a.decided_by IS NOT NULL OR a.decided_at IS NOT NULL))
  THEN RAISE EXCEPTION 'Denied decision changed state'; END IF;
  IF EXISTS(SELECT 1 FROM approvals a JOIN dms_approval_requests r ON r.id=a.id
    WHERE r.label IN ('approve','reject','group') AND
      (a.decided_by IS NULL OR a.decided_at IS NULL))
  THEN RAISE EXCEPTION 'Durable authenticated identity/time missing'; END IF;
  IF EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=(SELECT dataset_id FROM dms_approval_fixture)
    AND row->>'status'<>'OPEN')
  THEN RAISE EXCEPTION 'Approval silently completed Case'; END IF;
END $$;
SET LOCAL ROLE service_role;
DO $$ BEGIN
  BEGIN
    INSERT INTO approvals(user_id,agent_name,action_type,action_title,swarm_run_id,
      payload,approver_user_ids,approver_group_ids)
      SELECT user_id,agent_name,action_type,action_title,swarm_run_id,payload,
        ARRAY[(SELECT owner_id FROM dms_approval_fixture)],approver_group_ids
      FROM approvals WHERE id=(SELECT id FROM dms_approval_requests WHERE label='denials');
    RAISE EXCEPTION 'Caller-provided routing replaced persisted node assignment';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DMS_NATIVE_APPROVAL_PERSISTED_ROUTING_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO approvals(user_id,agent_name,action_type,action_title,swarm_run_id,
      payload,approver_user_ids,approver_group_ids)
      SELECT user_id,agent_name,action_type,action_title,swarm_run_id,
        jsonb_set(payload,'{axtnDocument,proposalOperation}','"DELETE"'),
        approver_user_ids,approver_group_ids
      FROM approvals WHERE id=(SELECT id FROM dms_approval_requests WHERE label='denials');
    RAISE EXCEPTION 'Classification node authorized deletion';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DMS_NATIVE_APPROVAL_PERSISTED_ROUTING_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO approvals(user_id,agent_name,action_type,action_title,swarm_run_id,
      payload,approver_user_ids,approver_group_ids)
      SELECT user_id,agent_name,action_type,action_title,swarm_run_id,
        payload||'{"axtnDevelopment":{}}',approver_user_ids,approver_group_ids
      FROM approvals WHERE id=(SELECT id FROM dms_approval_requests WHERE label='denials');
    RAISE EXCEPTION 'Document binding reused Development authority';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'NATIVE_APPROVAL_DOMAIN_BINDING_CONFLICT' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO approvals(user_id,agent_name,action_type,action_title,swarm_run_id,
      payload,approver_user_ids,approver_group_ids,status)
      SELECT user_id,agent_name,action_type,action_title,swarm_run_id,payload,
        approver_user_ids,approver_group_ids,'approved'
      FROM approvals WHERE id=(SELECT id FROM dms_approval_requests WHERE label='denials');
    RAISE EXCEPTION 'Service role inserted decided Approval';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DMS_NATIVE_APPROVAL_SERVER_CREATED_PENDING_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE approvals SET status='approved'
      WHERE id=(SELECT id FROM dms_approval_requests WHERE label='denials');
    RAISE EXCEPTION 'Service role decided instead of authenticated reviewer';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DMS_NATIVE_APPROVAL_AUTHENTICATED_REVIEWER_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE swarm_runs SET swarm_snapshot='{"nodes":[]}'
      WHERE id=(SELECT run_id FROM dms_approval_fixture);
    RAISE EXCEPTION 'Approval-bound run snapshot changed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DMS_NATIVE_APPROVAL_RUN_EVIDENCE_IMMUTABLE' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM approvals WHERE id=(SELECT id FROM dms_approval_requests WHERE label='denials');
    RAISE EXCEPTION 'Approval evidence deleted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DMS_NATIVE_APPROVAL_EVIDENCE_RETAINED' THEN RAISE; END IF;
  END;
END $$;
UPDATE approvals SET status='cancelled'
  WHERE id=(SELECT id FROM dms_approval_requests WHERE label='cancel');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT count(*) FROM audit_events a JOIN dms_approval_fixture f ON a.user_id=f.owner_id
    WHERE a.action='axtn_work.DOCUMENT_APPROVAL_REQUESTED')<>7
  THEN RAISE EXCEPTION 'Denied insert persisted request audit'; END IF;
  IF EXISTS(SELECT 1 FROM audit_events e JOIN approvals a ON e.detail->>'approvalId'=a.id::text
    JOIN dms_approval_fixture f ON e.user_id=f.owner_id
    WHERE e.action='axtn_work.DOCUMENT_APPROVAL_DECIDED' AND
      (e.detail->'binding' IS DISTINCT FROM a.payload->'axtnDocument'
        OR e.detail->>'decidedBy' IS DISTINCT FROM a.decided_by::text
        OR (e.detail->>'decidedAt')::timestamptz IS DISTINCT FROM a.decided_at
        OR e.resource_id::text IS DISTINCT FROM a.payload->'axtnDocument'->>'caseId'
        OR e.detail->>'processingMode' IS DISTINCT FROM
          CASE WHEN a.status='cancelled' THEN 'DETERMINISTIC' ELSE 'HUMAN' END))
  THEN RAISE EXCEPTION 'Decision identity/time/binding/mode audit mismatch'; END IF;
  RAISE NOTICE 'PASS: real DMS owner/builder/unrouted denial, reviewer/group, immutable bindings, source drift, reviewer revocation, service-role denial and atomic audit';
END $$;
ROLLBACK;
