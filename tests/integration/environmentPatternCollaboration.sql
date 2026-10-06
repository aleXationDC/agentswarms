\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='45s';
CREATE FUNCTION pg_temp.fixture_case(actor uuid,subject text,parent_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE sql AS $$
  SELECT axtn_case_manual(actor,'create',jsonb_build_object('row',jsonb_build_object(
    'subject',subject,'status','OPEN','priority',3,'source_kind','manual','source_id',actor,
    'parent_case_id',parent_id),'expectedVersion',0,'transitionKey',gen_random_uuid(),
    '_principal',jsonb_build_object('kind','user_session','id',actor)))
$$;
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); stranger uuid:=gen_random_uuid();
  fixture_group uuid:=gen_random_uuid(); integration uuid:=gen_random_uuid();
  human jsonb; peer jsonb; machine jsonb; root jsonb; leaf jsonb; local_root jsonb; local_leaf jsonb;
  allocation jsonb; commitment jsonb; consumption jsonb; request jsonb; result jsonb; view jsonb;
  status_view jsonb; artifact_view jsonb; triple jsonb; exchange jsonb; released jsonb;
  allocation_id uuid:=gen_random_uuid(); commitment_id uuid:=gen_random_uuid(); usage_id uuid:=gen_random_uuid();
  native_ref jsonb; evidence_ref jsonb; before_count bigint; reference_version bigint;
BEGIN
  INSERT INTO auth.users(id,email,invited_at) VALUES
    (a,a||'@collaboration.invalid',now()),(b,b||'@collaboration.invalid',now()),
    (stranger,stranger||'@collaboration.invalid',now());
  human:=jsonb_build_object('kind','user_session','id',a);
  peer:=jsonb_build_object('kind','user_session','id',b);
  machine:=jsonb_build_object('kind','swarm','id',a);
  INSERT INTO iam_groups(id,name) VALUES(fixture_group,'synthetic-collaboration-'||fixture_group);
  INSERT INTO iam_group_members(group_id,user_id) VALUES(fixture_group,b);
  root:=pg_temp.fixture_case(a,'SYNTHETIC_PRIVATE_HIERARCHY_CALENDAR_SECRET');
  leaf:=pg_temp.fixture_case(a,'Synthetic delegated capability request',root->>'case_id');
  leaf:=axtn_case_assignment(a,'case_assignment',jsonb_build_object('caseId',leaf->>'case_id',
    'expectedVersion',1,'transitionKey','responsibility','responsiblePrincipalType','GROUP',
    'responsiblePrincipalId',fixture_group,'assigneeUserId',b,'assignmentPolicy','MANUAL',
    'assignmentInheritance','OVERRIDE','semanticRouteMode','SYSTEM_INTEGRATION',
    'semanticRouteProviderId',NULL,'semanticRouteModelId',NULL,'_principal',human));
  local_root:=pg_temp.fixture_case(b,'SYNTHETIC_OTHER_PRIVATE_HIERARCHY');
  local_leaf:=pg_temp.fixture_case(b,'Different local ticket model',local_root->>'case_id');
  native_ref:=jsonb_build_object('kind','contract','repository','aXtn/aXtn-agentswarms',
    'id','tests/fixtures/environment-pattern/portable-skill.json','revision',repeat('a',40));
  evidence_ref:=jsonb_build_object('kind','evidence','repository','aXtn/aXtn-agentswarms',
    'id','tests/integration/environmentPatternCollaboration.sql','revision',repeat('b',40));
  request:=jsonb_build_object('caseId',leaf->>'case_id','expectedVersion',0,
    'transitionKey','capability-request','reasonCode','SYNTHETIC_CAPABILITY_REQUEST',
    'patch',jsonb_build_object('processing_stage','WAITING_EXTERNAL_CAPABILITY',
      'waiting_reason','CAPABILITY_UNAVAILABLE','required_capability_ref',native_ref),'_principal',peer);
  result:=axtn_case_processing(b,'processing',request);
  before_count:=(SELECT count(*) FROM audit_events);
  IF axtn_case_processing(b,'processing',request) IS DISTINCT FROM result
    OR (SELECT count(*) FROM audit_events)<>before_count
  THEN RAISE EXCEPTION 'Capability-request duplicate/lost ACK duplicated native effect'; END IF;
  BEGIN
    PERFORM axtn_case_capacity(a,'capacity_commitment',jsonb_build_object(
      'commitmentId',commitment_id,'allocationId',allocation_id,'caseId',leaf->>'case_id','hours',2,
      'expectedVersion',0,'transitionKey','before-availability','_principal',human));
    RAISE EXCEPTION 'Declared capability manufactured availability or commitment';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_CAPACITY_CONTEXT_REQUIRED' THEN RAISE; END IF;
  END;
  allocation:=axtn_case_capacity(a,'capacity_allocation',jsonb_build_object(
    'allocationId',allocation_id,'contextCaseId',root->>'case_id','providerRef','synthetic:provider',
    'poolRef','synthetic:private-pool','startsOn','2026-10-06','endsOn','2026-10-07',
    'availableHours',4,'unavailableHours',1,'expectedVersion',0,'transitionKey','availability','_principal',human));
  view:=axtn_case_capacity(b,'capacity_view',jsonb_build_object('caseId',leaf->>'case_id',
    'scope','CURRENT','offset',0,'limit',200,'_principal',peer));
  IF view->>'total'<>'0' OR view->'capacityPeriods'<>'[]'::jsonb
  THEN RAISE EXCEPTION 'Private availability became public permission or a promise'; END IF;
  request:=jsonb_build_object('commitmentId',commitment_id,'allocationId',allocation_id,
    'caseId',leaf->>'case_id','hours',2,'expectedVersion',0,'transitionKey','authorized-promise','_principal',human);
  commitment:=axtn_case_capacity(a,'capacity_commitment',request);
  before_count:=(SELECT count(*) FROM audit_events);
  IF axtn_case_capacity(a,'capacity_commitment',request) IS DISTINCT FROM commitment
    OR (SELECT count(*) FROM audit_events)<>before_count
  THEN RAISE EXCEPTION 'Commitment duplicate/lost ACK duplicated the promise'; END IF;
  BEGIN
    PERFORM axtn_case_capacity(b,'capacity_commitment',request||jsonb_build_object(
      'commitmentId',gen_random_uuid(),'transitionKey','responsibility-not-permission','_principal',peer));
    RAISE EXCEPTION 'Group responsibility granted authority to promise private capacity';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ASSIGNMENT_CUSTODIAN_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_capacity(a,'capacity_commitment',request||jsonb_build_object(
      'commitmentId',gen_random_uuid(),'transitionKey','machine-not-decider','_principal',machine));
    RAISE EXCEPTION 'Machine freely authorized commitment';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_CAPACITY_AUTHENTICATED_HUMAN_REQUIRED' THEN RAISE; END IF;
  END;
  view:=axtn_case_capacity(b,'capacity_view',jsonb_build_object('caseId',leaf->>'case_id',
    'scope','CURRENT','offset',0,'limit',200,'_principal',peer));
  released:=view->'records'->0;
  IF released->>'providerRef'<>'synthetic:provider' OR released->>'hours'<>'2'
    OR released->>'startsOn'<>'2026-10-06' OR released->>'endsOn'<>'2026-10-07'
    OR released ? 'allocationId' OR released ? 'recordedScope' OR view->>'canAllocate'<>'false'
    OR view::text LIKE '%'||(root->>'case_id')||'%'
    OR view::text LIKE '%unavailableHours%' OR view->>'forecastStatus'<>'UNKNOWN'
  THEN RAISE EXCEPTION 'Scoped time/provider/commitment readback lost privacy or honest forecast'; END IF;
  consumption:=axtn_case_capacity(b,'capacity_consumption',jsonb_build_object(
    'consumptionId',gen_random_uuid(),'commitmentId',commitment_id,'caseId',leaf->>'case_id',
    'bookedOn','2026-10-06','hours',1,'capabilityRef','synthetic:contract-proof','purpose','ASSURANCE',
    'expectedVersion',0,'transitionKey','authorized-outcome','_principal',peer));
  PERFORM axtn_case_processing(b,'processing',jsonb_build_object('caseId',leaf->>'case_id',
    'expectedVersion',1,'transitionKey','status-outcome','reasonCode','SYNTHETIC_OUTCOME',
    'patch',jsonb_build_object('processing_stage','VALIDATION_REVIEW','waiting_reason','REVIEW'),'_principal',peer));
  PERFORM axtn_case_pattern(b,'pattern_usage',jsonb_build_object(
    'caseId',leaf->>'case_id','usageId',usage_id,'artifact',native_ref,'purpose','ASSURANCE',
    'rClass','R0','eClass','E0','iClass','I0','outcome','POSITIVE','evidence',jsonb_build_array(evidence_ref),
    'expectedVersion',0,'transitionKey','released-evidence','_principal',peer));
  status_view:=axtn_case_processing(b,'subtree',jsonb_build_object('caseId',leaf->>'case_id',
    'offset',0,'limit',200,'_principal',peer));
  artifact_view:=axtn_case_pattern(b,'pattern_view',jsonb_build_object('caseId',leaf->>'case_id',
    'offset',0,'limit',200,'_principal',peer));
  INSERT INTO integrations(id,user_id,type,name,is_active,config)
    VALUES(integration,b,'notification','Synthetic authorized local ticket fixture',true,'{}');
  PERFORM axtn_case_environment(b,'environment_binding',jsonb_build_object(
    'integrationId',integration,'environmentId','Synthetic local counterpart','enabled',true,
    'expectedVersion',0,'transitionKey','confirmed-ticket-binding','_principal',peer));
  triple:=jsonb_build_object('external_environment_id','Synthetic local counterpart',
    'external_ref_id','  0001/Ä  ','external_parent_ref_id','Ticket parent is not a local Case parent');
  request:=jsonb_build_object('caseId',leaf->>'case_id','patch',triple,'expectedVersion',0,
    'transitionKey','exact-ticket','_principal',peer);
  PERFORM axtn_case_environment(b,'external_references',request);
  result:=axtn_case_environment(b,'external_handover',jsonb_build_object(
    'caseId',leaf->>'case_id','integrationId',integration,'expectedVersion',1,'_principal',peer));
  IF result IS DISTINCT FROM triple OR result ? 'case_id' OR result ? 'parent_case_id'
  THEN RAISE EXCEPTION 'Different ticket model leaked or normalized local hierarchy'; END IF;
  exchange:=jsonb_build_object('ticket',result,'requiredCapability',native_ref,
    'commitment',released,'status','VALIDATION_REVIEW','outcome','POSITIVE','evidence',evidence_ref);
  IF exchange::text LIKE '%SYNTHETIC_PRIVATE%' OR exchange::text LIKE '%OTHER_PRIVATE%'
    OR exchange::text LIKE '%'||(root->>'case_id')||'%' OR exchange::text LIKE '%'||(local_root->>'case_id')||'%'
    OR exchange::text LIKE '%'||allocation_id::text||'%' OR exchange::text LIKE '%unavailableHours%'
    OR status_view->>'total'<>'1' OR artifact_view->>'acceptanceGranted'<>'false'
    OR artifact_view->>'forecastStatus'<>'EXPERIMENTAL_DISABLED'
  THEN RAISE EXCEPTION 'Released context leaked hierarchy/calendar/authority or granted Acceptance'; END IF;
  result:=axtn_case_environment(b,'external_correlate',triple||jsonb_build_object(
    'integrationId',integration,'_principal',peer));
  IF result->>'status'<>'MATCHED' OR result->'candidates'->>0<>leaf->>'case_id'
  THEN RAISE EXCEPTION 'Lost ACK authorized readback lost native identity'; END IF;
  IF axtn_case_environment(b,'external_correlate',triple||jsonb_build_object(
      'integrationId',integration,'external_ref_id','unknown-ticket','_principal',peer))->>'status'<>'NO_MATCH'
    OR axtn_case_environment(b,'external_correlate',triple||jsonb_build_object(
      'integrationId',integration,'external_environment_id','unknown-environment','_principal',peer))->>'status'<>'NEEDS_CLARIFICATION'
  THEN RAISE EXCEPTION 'Unknown counterpart/ticket silently accepted'; END IF;
  BEGIN
    PERFORM axtn_case_environment(b,'external_handover',jsonb_build_object(
      'caseId',leaf->>'case_id','integrationId',integration,'expectedVersion',0,'_principal',peer));
    RAISE EXCEPTION 'Stale released revision accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ENVIRONMENT_VERSION_CONFLICT' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_processing(stranger,'subtree',jsonb_build_object('caseId',leaf->>'case_id',
      'offset',0,'limit',200,'_principal',jsonb_build_object('kind','user_session','id',stranger)));
    RAISE EXCEPTION 'Commitment or ticket identity manufactured stranger permission';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ACCESS_DENIED' THEN RAISE; END IF;
  END;
  PERFORM axtn_case_environment(b,'external_references',request||jsonb_build_object(
    'caseId',local_leaf->>'case_id','transitionKey','conflicting-ticket'));
  IF axtn_case_environment(b,'external_correlate',triple||jsonb_build_object(
      'integrationId',integration,'_principal',peer))->>'status'<>'NEEDS_CLARIFICATION'
  THEN RAISE EXCEPTION 'Conflicting identities silently selected a local hierarchy'; END IF;
  RAISE NOTICE 'PASS: actual isolated native User/Group capability request, private availability, authorized time/provider commitment, status/outcome/evidence, different ticket hierarchy, duplicate/lost ACK readback, UNKNOWN/disallowed/conflict/stale/privacy; no external transport, real peer, credential authority or Acceptance';
END;
$$;
ROLLBACK;
