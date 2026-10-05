\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='45s';
INSERT INTO knowledge_bases(id,user_id,name,is_sample)
  VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
  ON CONFLICT(id) DO NOTHING;
CREATE TEMP TABLE assignment_access_fixture(actor_id uuid,dataset_id uuid,capacity_dataset_id uuid,case_id uuid);
CREATE FUNCTION pg_temp.make_case(actor uuid,subject text,parent_id text DEFAULT NULL,status text DEFAULT 'OPEN')
RETURNS jsonb LANGUAGE sql AS $$
  SELECT axtn_case_manual(actor,'create',jsonb_build_object('row',jsonb_build_object(
    'subject',subject,'status',status,'priority',3,'source_kind','manual','source_id',actor,
    'parent_case_id',parent_id),'expectedVersion',0,'transitionKey',gen_random_uuid(),
    '_principal',jsonb_build_object('kind','user_session','id',actor)))
$$;
CREATE FUNCTION pg_temp.assign_case(actor uuid,value jsonb,principal_type text,principal_id uuid,
  inheritance text DEFAULT 'OVERRIDE',assignee uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT axtn_case_assignment(actor,'case_assignment',jsonb_build_object(
    'caseId',value->>'case_id','expectedVersion',(value->>'assignment_version')::bigint,
    'transitionKey',gen_random_uuid(),'responsiblePrincipalType',principal_type,
    'responsiblePrincipalId',principal_id,'assigneeUserId',
      CASE WHEN principal_type='USER' THEN principal_id ELSE assignee END,
    'assignmentPolicy','MANUAL','assignmentInheritance',inheritance,
    'semanticRouteMode','SYSTEM_INTEGRATION','semanticRouteProviderId',NULL,'semanticRouteModelId',NULL,
    '_principal',jsonb_build_object('kind','user_session','id',actor)))
$$;
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
  fixture_group uuid:=gen_random_uuid(); dataset uuid; root jsonb; child jsonb; grandchild jsonb;
  barrier jsonb; barrier_child jsonb; closed_child jsonb; private_root jsonb; shared_leaf jsonb;
  value jsonb; request jsonb; work jsonb; allocation jsonb; commitment jsonb; booking jsonb;
  usage_id uuid:=gen_random_uuid(); before_count bigint; attempt text:=gen_random_uuid()::text;
  shared_integration uuid:=gen_random_uuid(); private_integration uuid:=gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id,email,invited_at) VALUES(a,a||'@assignment.invalid',now()),
    (b,b||'@assignment.invalid',now()),(c,c||'@assignment.invalid',now());
  INSERT INTO iam_groups(id,name) VALUES(fixture_group,'synthetic-assignment-'||fixture_group);
  INSERT INTO iam_group_members(group_id,user_id) VALUES(fixture_group,b),(fixture_group,c);
  root:=pg_temp.make_case(a,'Synthetic responsibility');
  child:=pg_temp.make_case(a,'Inherited child',root->>'case_id');
  grandchild:=pg_temp.make_case(a,'Inherited grandchild',child->>'case_id');
  barrier:=pg_temp.make_case(a,'Override barrier',root->>'case_id');
  barrier:=pg_temp.assign_case(a,barrier,'USER',a);
  barrier_child:=pg_temp.make_case(a,'Beyond barrier',barrier->>'case_id');
  closed_child:=pg_temp.make_case(a,'Closed history',root->>'case_id','CLOSED');
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=a AND name='axtn_cases';
  UPDATE user_data_rows SET row=row||jsonb_build_object('attempt_id',attempt,
    'sticky_attempt_fixture',jsonb_build_object('executionPrincipal',a,'provider','synthetic'))
    WHERE table_id=dataset AND row->>'case_id'=child->>'case_id';
  IF child->>'assignment_inheritance'<>'INHERIT' OR child->>'responsible_principal_id'<>a::text
    OR root->>'assignment_updated_by'<>a::text
  THEN RAISE EXCEPTION 'First response/default/inheritance/actual actor failed'; END IF;
  request:=jsonb_build_object('caseId',root->>'case_id','expectedVersion',1,
    'transitionKey','assign-root','responsiblePrincipalType','USER','responsiblePrincipalId',b,
    'assigneeUserId',b,'assignmentPolicy','MANUAL','assignmentInheritance','OVERRIDE',
    'semanticRouteMode','SYSTEM_INTEGRATION','semanticRouteProviderId',NULL,'semanticRouteModelId',NULL,
    '_principal',jsonb_build_object('kind','user_session','id',a));
  root:=axtn_case_assignment(a,'case_assignment',request);
  before_count:=(SELECT count(*) FROM audit_events);
  IF axtn_case_assignment(a,'case_assignment',request) IS DISTINCT FROM root
    OR (SELECT count(*) FROM audit_events)<>before_count
  THEN RAISE EXCEPTION 'Assignment replay duplicated state or audit'; END IF;
  IF EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id' IN (child->>'case_id',grandchild->>'case_id')
    AND row->>'responsible_principal_id'<>b::text)
    OR EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
      AND row->>'case_id' IN (barrier->>'case_id',barrier_child->>'case_id',closed_child->>'case_id')
      AND row->>'responsible_principal_id'<>a::text)
    OR (SELECT row->>'attempt_id' FROM user_data_rows WHERE table_id=dataset
      AND row->>'case_id'=child->>'case_id')<>attempt
    OR (SELECT row->'sticky_attempt_fixture'->>'executionPrincipal' FROM user_data_rows WHERE table_id=dataset
      AND row->>'case_id'=child->>'case_id')<>a::text
  THEN RAISE EXCEPTION 'Cascade/barriers/active binding changed incorrectly'; END IF;
  value:=axtn_case_assignment(b,'case_access',jsonb_build_object(
    'sharedOnly',true,'offset',0,'limit',1,'_principal',jsonb_build_object('kind','user_session','id',b)));
  IF value->>'total'<>'3' OR jsonb_array_length(value->'cases')<>1
    OR EXISTS(SELECT 1 FROM user_data_tables WHERE user_id=b AND name='axtn_cases')
  THEN RAISE EXCEPTION 'Shared full totals/paging/no copied Cases failed'; END IF;
  BEGIN
    PERFORM pg_temp.assign_case(b,root,'USER',c);
    RAISE EXCEPTION 'Assignee rewrote custody assignment';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ASSIGNMENT_CUSTODIAN_REQUIRED' THEN RAISE; END IF;
  END;
  private_root:=pg_temp.make_case(a,'PRIVATE_SYNTHETIC_ANCESTOR');
  shared_leaf:=pg_temp.make_case(a,'Selective collaboration',private_root->>'case_id');
  shared_leaf:=pg_temp.assign_case(a,shared_leaf,'USER',b);
  UPDATE user_data_rows SET row=row||'{"private_payload":"PRIVATE_SYNTHETIC_CONTENT"}'
    WHERE table_id=dataset AND row->>'case_id'=shared_leaf->>'case_id';
  value:=axtn_case_processing(b,'subtree',jsonb_build_object('caseId',shared_leaf->>'case_id',
    'offset',0,'limit',50,'_principal',jsonb_build_object('kind','user_session','id',b)));
  IF value->>'total'<>'1' OR value::text LIKE '%PRIVATE_SYNTHETIC%'
    OR value::text LIKE '%'||(private_root->>'case_id')||'%'
    OR value->'rootCase'->'parent_case_id'<>'null'::jsonb
  THEN RAISE EXCEPTION 'Shared projection disclosed private hierarchy/content'; END IF;
  INSERT INTO integrations(id,user_id,type,name,is_active,config) VALUES
    (shared_integration,b,'notification','Synthetic shared ticket binding',true,'{}'),
    (private_integration,a,'notification','Private synthetic ticket binding',true,'{}');
  PERFORM axtn_case_environment(b,'environment_binding',jsonb_build_object(
    'integrationId',shared_integration,'environmentId',' synthetic shared environment ',
    'enabled',true,'expectedVersion',0,'transitionKey','shared-env-binding',
    '_principal',jsonb_build_object('kind','user_session','id',b)));
  PERFORM axtn_case_environment(a,'environment_binding',jsonb_build_object(
    'integrationId',private_integration,'environmentId',' synthetic shared environment ',
    'enabled',true,'expectedVersion',0,'transitionKey','private-env-binding',
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  request:=jsonb_build_object('caseId',shared_leaf->>'case_id','expectedVersion',0,
    'transitionKey','shared-external-refs','patch',jsonb_build_object(
      'external_environment_id',' synthetic shared environment ','external_ref_id','shared opaque ticket',
      'external_parent_ref_id','foreign-only parent'),
    '_principal',jsonb_build_object('kind','user_session','id',b));
  value:=axtn_case_environment(b,'external_references',request);
  before_count:=(SELECT count(*) FROM audit_events);
  IF value::text LIKE '%PRIVATE_SYNTHETIC%' OR value->'parent_case_id'<>'null'::jsonb
    OR value ? 'source_id' OR value->>'external_ref_id'<>'shared opaque ticket'
    OR axtn_case_environment(b,'external_references',request) IS DISTINCT FROM value
    OR (SELECT count(*) FROM audit_events)<>before_count
    OR NOT EXISTS(SELECT 1 FROM audit_events WHERE user_id=a
      AND detail->>'transitionKey'='shared-external-refs' AND detail->'principal'->>'id'=b::text)
  THEN RAISE EXCEPTION 'Shared external references lost privacy/custody/actual actor/replay'; END IF;
  value:=axtn_case_environment(b,'external_handover',jsonb_build_object(
    'caseId',shared_leaf->>'case_id','integrationId',shared_integration,'expectedVersion',1,
    '_principal',jsonb_build_object('kind','user_session','id',b)));
  IF value IS DISTINCT FROM request->'patch'
  THEN RAISE EXCEPTION 'Shared minimized handover changed the exact triple'; END IF;
  BEGIN
    PERFORM axtn_case_environment(b,'external_handover',jsonb_build_object(
      'caseId',shared_leaf->>'case_id','integrationId',private_integration,'expectedVersion',1,
      '_principal',jsonb_build_object('kind','user_session','id',b)));
    RAISE EXCEPTION 'Shared Case assignment granted foreign integration authority';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ENVIRONMENT_OWNED_INTEGRATION_REQUIRED' THEN RAISE; END IF;
  END;
  PERFORM axtn_case_environment(a,'external_references',request||jsonb_build_object(
    'caseId',private_root->>'case_id','transitionKey','private-external-refs',
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  request:=jsonb_build_object('integrationId',shared_integration,
    'external_environment_id',' synthetic shared environment ','external_ref_id','shared opaque ticket',
    '_principal',jsonb_build_object('kind','user_session','id',b));
  value:=axtn_case_environment(b,'external_correlate',request);
  IF value->>'status'<>'MATCHED' OR value->'candidates'<>jsonb_build_array(shared_leaf->>'case_id')
    OR axtn_case_environment(b,'external_correlate',request||jsonb_build_object(
      '_principal',jsonb_build_object('kind','swarm','id',b)))->>'status'<>'NO_MATCH'
  THEN RAISE EXCEPTION 'Correlation leaked hidden Case counts or granted foreign automation access'; END IF;
  RAISE NOTICE 'PASS: shared exact references/readback/minimized handover and correlation preserve real actor/custody; integration configuration stays with its owner and hidden/foreign-automation Cases remain excluded';
  value:=axtn_case_manual(b,'update',jsonb_build_object(
    'row',jsonb_build_object('case_id',shared_leaf->>'case_id','subject','Collaborative manual takeover'),
    'expectedVersion',1,'transitionKey','shared-manual',
    '_principal',jsonb_build_object('kind','user_session','id',b)));
  IF value->>'subject'<>'Collaborative manual takeover' OR value::text LIKE '%PRIVATE_SYNTHETIC%'
    OR NOT EXISTS(SELECT 1 FROM audit_events WHERE user_id=a AND action='axtn_case_processing.MANUAL_UPDATE'
      AND detail->>'transitionKey'='shared-manual' AND detail->'principal'->>'id'=b::text)
    OR (SELECT row->>'parent_case_id' FROM user_data_rows WHERE table_id=dataset
      AND row->>'case_id'=shared_leaf->>'case_id')<>private_root->>'case_id'
  THEN RAISE EXCEPTION 'Shared manual partial update/custody/actual actor failed'; END IF;
  value:=axtn_case_processing(b,'processing',jsonb_build_object('caseId',shared_leaf->>'case_id',
    'expectedVersion',0,'transitionKey','shared-processing','reasonCode','SYNTHETIC_TAKEOVER',
    'patch','{"processing_stage":"VALIDATION_REVIEW","waiting_reason":"REVIEW"}'::jsonb,
    '_principal',jsonb_build_object('kind','user_session','id',b)));
  IF value->>'processing_stage'<>'VALIDATION_REVIEW' OR value::text LIKE '%PRIVATE_SYNTHETIC%'
  THEN RAISE EXCEPTION 'Shared processing failed'; END IF;
  allocation:=axtn_case_capacity(a,'capacity_allocation',jsonb_build_object(
    'allocationId',gen_random_uuid(),'contextCaseId',private_root->>'case_id','providerRef','synthetic:provider-A',
    'poolRef','synthetic:team','startsOn','2026-10-01','endsOn','2026-10-31',
    'availableHours',20,'unavailableHours',5,'expectedVersion',0,'transitionKey','private-allocation',
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  commitment:=axtn_case_capacity(a,'capacity_commitment',jsonb_build_object(
    'commitmentId',gen_random_uuid(),'allocationId',allocation->>'id','caseId',shared_leaf->>'case_id',
    'hours',3,'expectedVersion',0,'transitionKey','shared-commitment',
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  booking:=axtn_case_capacity(b,'capacity_consumption',jsonb_build_object(
    'consumptionId',gen_random_uuid(),'commitmentId',commitment->>'id','caseId',shared_leaf->>'case_id',
    'bookedOn','2026-10-05','hours',1.5,'capabilityRef','synthetic:assurance','purpose','ASSURANCE',
    'expectedVersion',0,'transitionKey','shared-booking',
    '_principal',jsonb_build_object('kind','user_session','id',b)));
  value:=axtn_case_capacity(b,'capacity_view',jsonb_build_object('caseId',shared_leaf->>'case_id',
    'scope','RECORDED','offset',0,'limit',1,'_principal',jsonb_build_object('kind','user_session','id',b)));
  IF value->>'total'<>'2' OR value->>'actualHours'<>'1.5' OR value->'capacityPeriods'<>'[]'::jsonb
    OR value::text LIKE '%'||(allocation->>'id')||'%'
    OR value::text LIKE '%'||(private_root->>'case_id')||'%'
    OR value::text LIKE '%unavailableHours%' OR booking ? 'recordedScope'
    OR booking->'actor'->>'id'<>b::text OR value->>'canAllocate'<>'false'
  THEN RAISE EXCEPTION 'Selective commitment/booking exposed private capacity/hierarchy or wrong actor'; END IF;
  BEGIN
    PERFORM axtn_case_capacity(b,'capacity_commitment',jsonb_build_object(
      'commitmentId',gen_random_uuid(),'allocationId',allocation->>'id','caseId',shared_leaf->>'case_id',
      'hours',1,'expectedVersion',0,'transitionKey','unauthorized-team-promise',
      '_principal',jsonb_build_object('kind','user_session','id',b)));
    RAISE EXCEPTION 'Shared assignee allocated private capacity';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ASSIGNMENT_CUSTODIAN_REQUIRED' THEN RAISE; END IF;
  END;
  commitment:=axtn_case_capacity(a,'capacity_commitment',jsonb_build_object(
    'commitmentId',gen_random_uuid(),'allocationId',allocation->>'id','caseId',private_root->>'case_id',
    'hours',2,'expectedVersion',0,'transitionKey','hidden-commitment',
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  BEGIN
    PERFORM axtn_case_capacity(b,'capacity_consumption',jsonb_build_object(
      'consumptionId',gen_random_uuid(),'commitmentId',commitment->>'id','caseId',shared_leaf->>'case_id',
      'bookedOn','2026-10-05','hours',1,'capabilityRef','synthetic:delivery','purpose','DELIVERY',
      'expectedVersion',0,'transitionKey','hidden-promise-booking',
      '_principal',jsonb_build_object('kind','user_session','id',b)));
    RAISE EXCEPTION 'Shared assignee consumed an invisible ancestor promise';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_CAPACITY_COMMITMENT_REQUIRED' THEN RAISE; END IF;
  END;
  request:=jsonb_build_object('caseId',shared_leaf->>'case_id','usageId',usage_id,
    'artifact',jsonb_build_object('kind','contract','repository','aXtn/aXtn-agentswarms',
      'id','tests/fixtures/environment-pattern/portable-skill.json','revision',repeat('a',40)),
    'purpose','CAPABILITY_UPLIFT','rClass','R1','eClass','E1','iClass','I1','outcome','POSITIVE',
    'evidence',jsonb_build_array(jsonb_build_object('kind','evidence','repository','aXtn/aXtn-agentswarms',
      'id','tests/integration/caseAssignment.sql','revision',repeat('b',40))),
    'expectedVersion',0,'transitionKey','shared-pattern','_principal',jsonb_build_object('kind','user_session','id',b));
  value:=axtn_case_pattern(b,'pattern_usage',request);
  IF value->'actor'->>'id'<>b::text THEN RAISE EXCEPTION 'Shared Pattern actor changed'; END IF;
  value:=axtn_case_pattern(b,'pattern_improvement',jsonb_build_object('caseId',shared_leaf->>'case_id',
    'usageId',usage_id,'hypothesis','CAPABILITY_GAP','signal',request->'evidence'->0,
    'scenarioClass','regression','expectedVersion',1,'transitionKey','shared-improvement',
    '_principal',jsonb_build_object('kind','user_session','id',b)));
  IF NOT EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=value->>'improvementCaseId' AND row->>'responsible_principal_id'=b::text)
    OR value->>'promotionEnabled'<>'false'
  THEN RAISE EXCEPTION 'Shared native Improvement lost custody/inheritance or promoted work'; END IF;
  request:=value;
  value:=axtn_case_work(b,'list',jsonb_build_object(
    '_principal',jsonb_build_object('kind','user_session','id',b)));
  SELECT item INTO value FROM jsonb_array_elements(value->'cases') item
    WHERE item->>'case_id'=request->>'improvementCaseId';
  IF value IS NULL OR value->>'view_root_reason'<>'PARENT_OUTSIDE_WORK_VIEW'
    OR value->>'parent_case_id'<>shared_leaf->>'case_id'
    OR value->'work_contract_ref' IS NULL OR value->>'scenario_class'<>'regression'
    OR value->>'initial_processing_mode'<>'DETERMINISTIC'
    OR value ? 'work_identity' OR value ? 'source_id'
  THEN RAISE EXCEPTION 'Shared Work view lost bounded root/contract projections or exposed private identity'; END IF;
  value:=axtn_case_pattern(b,'pattern_view',jsonb_build_object('caseId',shared_leaf->>'case_id',
    'offset',0,'limit',50,'_principal',jsonb_build_object('kind','user_session','id',b)));
  IF value->>'total'<>'1' OR value->>'acceptanceGranted'<>'false'
    OR value::text LIKE '%'||(private_root->>'case_id')||'%'
  THEN RAISE EXCEPTION 'Authorized Pattern view exposed ancestor or granted Acceptance'; END IF;
  root:=pg_temp.assign_case(a,root,'GROUP',fixture_group,'OVERRIDE',c);
  value:=pg_temp.make_case(b,'Group child',root->>'case_id');
  IF value->>'responsible_principal_id'<>fixture_group::text OR value->>'assignee_user_id'<>c::text
    OR NOT EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset AND row->>'case_id'=value->>'case_id')
  THEN RAISE EXCEPTION 'Shared Group child inheritance/custody failed'; END IF;
  child:=axtn_case_manual(a,'update',jsonb_build_object(
    'row',jsonb_build_object('case_id',child->>'case_id','parent_case_id',private_root->>'case_id'),
    'expectedVersion',1,'transitionKey','reparent-assignment-chain',
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  IF child->>'responsible_principal_id'<>a::text OR child->>'attempt_id'<>attempt
    OR NOT EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
      AND row->>'case_id'=grandchild->>'case_id' AND row->>'responsible_principal_id'=a::text)
  THEN RAISE EXCEPTION 'Reparent did not cascade open inheritance or rebound active Attempt'; END IF;
  work:=axtn_case_work(a,'ensure',jsonb_build_object(
    'sourceId','PRIVATE_SYNTHETIC_WORK_SOURCE','subject','Shared native Work','caseType','DEVELOPMENT_VERIFY',
    'workContractRef',jsonb_build_object('kind','contract','repository','aXtn/aXtn-agentswarms',
      'id','tests/integration/caseAssignment.sql','revision',repeat('a',40)),
    'scenarioClass','regression','scenarioId','synthetic-assignment',
    'processingMode','DETERMINISTIC','executionChannel','COPILOT_CLI','actorRef',a,
    'requiredDependencies','[]'::jsonb,'references','[]'::jsonb,
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  IF work->>'responsible_principal_type'<>'SYSTEM' THEN RAISE EXCEPTION 'Work default changed'; END IF;
  work:=pg_temp.assign_case(a,work,'USER',b);
  request:=jsonb_build_object('caseId',work->>'case_id','transitionKey','shared-native-takeover',
    'eventType','TAKEOVER','reasonCode','SYNTHETIC_TAKEOVER','processingMode','HUMAN',
    'executionChannel','HUMAN','actorRef',b,'references','[]'::jsonb,
    '_principal',jsonb_build_object('kind','user_session','id',b));
  value:=axtn_case_work(b,'transition',request);
  before_count:=(SELECT count(*) FROM audit_events);
  IF axtn_case_work(b,'transition',request) IS DISTINCT FROM value
    OR (SELECT count(*) FROM audit_events)<>before_count
    OR value->>'actor_ref'<>b::text OR value->>'processing_mode'<>'HUMAN'
    OR NOT EXISTS(SELECT 1 FROM audit_events WHERE user_id=a
      AND detail->>'transitionKey'='shared-native-takeover' AND detail->'principal'->>'id'=b::text)
  THEN RAISE EXCEPTION 'Native shared Work takeover/actual actor/replay failed'; END IF;
  value:=axtn_case_work(b,'list',jsonb_build_object('_principal',
    jsonb_build_object('kind','user_session','id',b)));
  IF jsonb_array_length(value->'cases')<>2 OR jsonb_array_length(value->'events')<>3
    OR value::text LIKE '%PRIVATE_SYNTHETIC%'
  THEN RAISE EXCEPTION 'Shared Work/event view leaked identity or omitted work'; END IF;
  PERFORM axtn_case_work(b,'transition',jsonb_build_object(
    'caseId',work->>'case_id','transitionKey','shared-verify-start','eventType','STARTED',
    'reasonCode','SYNTHETIC_VERIFY','actorRef',b,'references','[]'::jsonb,
    '_principal',jsonb_build_object('kind','user_session','id',b)));
  before_count:=(SELECT count(*) FROM audit_events);
  BEGIN
    PERFORM axtn_case_work(b,'transition',jsonb_build_object(
      'caseId',work->>'case_id','transitionKey','shared-forged-verify-completion','eventType','COMPLETED',
      'reasonCode','SYNTHETIC_VERIFY','actorRef',b,
      'references',jsonb_build_array(jsonb_build_object('kind','evidence',
        'repository','aXtn/aXtn-agentswarms','id','tests/integration/caseAssignment.sql')),
      '_principal',jsonb_build_object('kind','user_session','id',b)));
    RAISE EXCEPTION 'Shared assignee completed Verify without exact hard checks';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Verify Work completion requires exact hard checks' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM audit_events)<>before_count
    OR NOT EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
      AND row->>'case_id'=work->>'case_id' AND row->>'status'='OPEN')
  THEN RAISE EXCEPTION 'Denied shared Verify completion changed state or audit'; END IF;
  work:=axtn_case_work(b,'ensure',jsonb_build_object(
    'sourceId','synthetic-shared-build','subject','Synthetic shared completion','caseType','DEVELOPMENT_BUILD',
    'parentCaseId',shared_leaf->>'case_id',
    'workContractRef',jsonb_build_object('kind','contract','repository','aXtn/aXtn-agentswarms',
      'id','tests/integration/caseAssignment.sql','revision',repeat('a',40)),
    'scenarioClass','regression','scenarioId','synthetic-shared-completion',
    'processingMode','HUMAN','executionChannel','HUMAN','actorRef',b,
    'requiredDependencies','[]'::jsonb,'references','[]'::jsonb,
    '_principal',jsonb_build_object('kind','user_session','id',b)));
  PERFORM axtn_case_work(b,'transition',jsonb_build_object(
    'caseId',work->>'case_id','transitionKey','shared-build-start','eventType','STARTED',
    'reasonCode','SYNTHETIC_BUILD','actorRef',b,'references','[]'::jsonb,
    '_principal',jsonb_build_object('kind','user_session','id',b)));
  request:=jsonb_build_object('caseId',work->>'case_id','transitionKey','shared-build-complete',
    'eventType','COMPLETED','reasonCode','SYNTHETIC_BUILD','actorRef',b,
    'references',jsonb_build_array(jsonb_build_object('kind','evidence',
      'repository','aXtn/aXtn-agentswarms','id','tests/integration/caseAssignment.sql')),
    '_principal',jsonb_build_object('kind','user_session','id',b));
  value:=axtn_case_work(b,'transition',request);
  before_count:=(SELECT count(*) FROM audit_events);
  IF value->>'status'<>'CLOSED' OR value->>'actor_ref'<>b::text
    OR axtn_case_work(b,'transition',request) IS DISTINCT FROM value
    OR (SELECT count(*) FROM audit_events)<>before_count
    OR NOT EXISTS(SELECT 1 FROM audit_events WHERE user_id=a
      AND action='axtn_work.COMPLETED' AND detail->>'transitionKey'='shared-build-complete'
      AND detail->'principal'->>'id'=b::text)
  THEN RAISE EXCEPTION 'Shared native completion lost actual actor/custody/replay'; END IF;
  RAISE NOTICE 'PASS: shared native Work completion preserves custody/actual actor/replay; missing Verify hard checks denies without state or audit change';
  DELETE FROM iam_group_members WHERE group_id=fixture_group AND user_id=b;
  BEGIN
    PERFORM axtn_case_processing(b,'subtree',jsonb_build_object('caseId',root->>'case_id',
      'offset',0,'limit',50,'_principal',jsonb_build_object('kind','user_session','id',b)));
    RAISE EXCEPTION 'Revoked Group member retained access';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ACCESS_DENIED' THEN RAISE; END IF;
  END;
  UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id=b;
  BEGIN
    PERFORM axtn_case_assignment(b,'case_access',jsonb_build_object(
      'sharedOnly',true,'offset',0,'limit',50,'_principal',jsonb_build_object('kind','user_session','id',b)));
    RAISE EXCEPTION 'Banned actor retained access';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PROCESSING_AUTHENTICATED_OWNER_REQUIRED' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM iam_resource_grants WHERE principal_id=b)
    OR has_function_privilege('service_role','axtn_case_custodian(uuid,text,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','axtn_case_assignment(uuid,text,jsonb)','EXECUTE')
    OR has_function_privilege('service_role','axtn_case_inherit_descendants(uuid,uuid,text,jsonb,jsonb,text,timestamptz)','EXECUTE')
  THEN RAISE EXCEPTION 'Assignment leaked generic/private authority'; END IF;
  UPDATE auth.users SET banned_until=NULL WHERE id=b;
  INSERT INTO assignment_access_fixture VALUES(b,dataset,
    (SELECT id FROM user_data_tables WHERE user_id=a AND name='axtn_case_capacity'),
    (shared_leaf->>'case_id')::uuid);
  RAISE NOTICE 'PASS: native User/Group assignment, custody/identity preserved, transactional cascade/barriers/reparent, actual actors/replay, sticky existing Attempt untouched, private hierarchy/calendar projection, shared manual/Work/Pattern/booking, revocation and inactive-user denial';
END;
$$;
GRANT SELECT ON assignment_access_fixture TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT actor_id::text FROM assignment_access_fixture),true);
DO $$
DECLARE fixture assignment_access_fixture%ROWTYPE;
BEGIN
  SELECT * INTO fixture FROM assignment_access_fixture;
  IF EXISTS(SELECT 1 FROM user_data_rows WHERE table_id IN (fixture.dataset_id,fixture.capacity_dataset_id))
    OR EXISTS(SELECT 1 FROM user_data_tables WHERE id IN (fixture.dataset_id,fixture.capacity_dataset_id))
  THEN RAISE EXCEPTION 'Active assigned actor acquired private generic Case/calendar access'; END IF;
  BEGIN
    PERFORM axtn_case_assignment(fixture.actor_id,'case_access',jsonb_build_object(
      'caseId',fixture.case_id,'sharedOnly',true,'offset',0,'limit',1,
      '_principal',jsonb_build_object('kind','user_session','id',fixture.actor_id)));
    RAISE EXCEPTION 'Browser directly invoked trusted service authorization';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS: actual active assigned browser principal receives neither generic Case rows/table metadata nor private calendar; direct trusted RPC remains denied';
END;
$$;
RESET ROLE;
ROLLBACK;
