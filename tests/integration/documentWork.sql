\set ON_ERROR_STOP on
BEGIN;
-- The schema-only rehearsal needs the native shared seed referenced by auth.
INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
  VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO auth.users(id,aud,role,email,invited_at)
  VALUES('11111111-1111-4111-8111-111111111111','authenticated','authenticated','dms-fixture@example.invalid',now())
  ON CONFLICT(id) DO NOTHING;
INSERT INTO auth.users(id,aud,role,email,invited_at)
  VALUES('22222222-2222-4222-8222-222222222222','authenticated','authenticated','dms-other@example.invalid',now())
  ON CONFLICT(id) DO NOTHING;
DO $$
DECLARE
  owner uuid := '11111111-1111-4111-8111-111111111111';
  other uuid := '22222222-2222-4222-8222-222222222222';
  machine jsonb := jsonb_build_object('kind','swarm','id',owner);
  human jsonb := jsonb_build_object('kind','user_session','id',owner);
  work jsonb;
  result jsonb;
  again jsonb;
  transition jsonb;
  original_attempt text;
  dataset uuid;
  before_count bigint;
  metadata jsonb;
  proposal jsonb;
  saved_proposal jsonb;
BEGIN
  work := jsonb_build_object(
    'businessRequestId','fixture-request-01','caseType','DOCUMENT_PROCESSING',
    'workContractRef',jsonb_build_object('kind','contract','repository','aXtn/aXtn-agentswarms',
      'id','tests/integration/documentWork.sql','revision',repeat('b',40)),
    'scenarioClass','regression','scenarioId','fixture-request-01',
    'processingMode','DETERMINISTIC','executionChannel','SWARM','actorRef',owner,
    'inputManifest',jsonb_build_object(
      'documentId','33333333-3333-4333-8333-333333333333',
      'sourceKind','fixture','sourceRef','fixture:opaque-01','sourceRevision','"etag:0001"',
      'contentHash',repeat('c',64),'privacyStatus','NO_AI'),
    'inputHash',repeat('a',64),'deliveryId','delivery-01','references','[]'::jsonb,
    '_principal',machine);
  result := axtn_case_document(owner,'document_ensure',work);
  again := axtn_case_document(owner,'document_ensure',work);
  IF result IS DISTINCT FROM again THEN RAISE EXCEPTION 'Ensure replay differs'; END IF;
  again := axtn_case_document(owner,'document_assign',jsonb_build_object(
    'caseId',result->>'case_id','documentId',result->>'document_id','_principal',human));
  IF again->>'ok'<>'true' OR again->>'created'<>'false'
  THEN RAISE EXCEPTION 'Human assignment did not preserve the primary relation'; END IF;
  DELETE FROM user_data_rows r USING user_data_tables t WHERE r.table_id=t.id
    AND t.user_id=owner AND t.name='axtn_case_relations'
    AND r.row->>'target_id'=result->>'document_id';
  again := axtn_case_document(owner,'document_assign',jsonb_build_object(
    'caseId',result->>'case_id','documentId',result->>'document_id','_principal',human));
  IF again->>'created'<>'true' THEN RAISE EXCEPTION 'Human assignment did not restore missing projection'; END IF;
  again := axtn_case_document(owner,'document_assign',jsonb_build_object(
    'caseId',result->>'case_id','documentId',result->>'document_id','_principal',human));
  IF again->>'created'<>'false' OR
    (SELECT count(*) FROM audit_events WHERE user_id=owner AND action='axtn_work.DOCUMENT_ASSIGNED')<>1
  THEN RAISE EXCEPTION 'Assignment replay duplicated relation or audit'; END IF;
  BEGIN
    PERFORM axtn_case_document(owner,'document_assign',jsonb_build_object(
      'caseId',result->>'case_id','documentId',result->>'document_id','_principal',machine));
    RAISE EXCEPTION 'Machine assigned a protected document';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_AUTHENTICATED_HUMAN_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_document(owner,'document_assign',jsonb_build_object(
      'caseId',result->>'case_id','documentId','unknown-document','_principal',human));
    RAISE EXCEPTION 'Human assigned an unowned document';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_OWNED_IDENTITY_REQUIRED' THEN RAISE; END IF;
  END;
  IF result->>'status_reason'<>'PRIVACY_HOLD' OR result->>'subject'<>'Document processing'
  THEN RAISE EXCEPTION 'Intake did not preserve neutral privacy hold'; END IF;
  original_attempt := result->>'attempt_id';
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=owner AND name='axtn_cases';
  SELECT columns INTO metadata FROM user_data_tables WHERE id=dataset;
  IF (SELECT count(*) FROM jsonb_array_elements(metadata) c WHERE c->>'name'='document_input')<>1
  THEN RAISE EXCEPTION 'Document Case metadata was not reconciled exactly once'; END IF;
  UPDATE user_data_tables SET columns=columns||'[{"name":"operator_column","type":"string"}]'
    WHERE id=dataset;
  PERFORM axtn_case_document(owner,'document_ensure',work);
  IF NOT EXISTS(SELECT 1 FROM user_data_tables t,jsonb_array_elements(t.columns) c
    WHERE t.id=dataset AND c->>'name'='operator_column')
  THEN RAISE EXCEPTION 'Unknown Case metadata column was lost'; END IF;
  SELECT count(*) INTO before_count FROM user_data_rows WHERE table_id=dataset
    AND row->>'source_kind'='document_work';
  BEGIN
    PERFORM axtn_case_document(owner,'document_ensure',work||
      jsonb_build_object('inputHash',repeat('d',64)));
    RAISE EXCEPTION 'Changed manifest under same request not rejected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_REQUEST_IDENTITY_CONFLICT' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_document(owner,'document_ensure',work||
      jsonb_build_object('businessRequestId','other-request'));
    RAISE EXCEPTION 'Same delivery assigned to a second request';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_DELIVERY_IDENTITY_CONFLICT' THEN RAISE; END IF;
  END;
  again := axtn_case_document(owner,'document_ensure',work||
    jsonb_build_object('deliveryId','delivery-02'));
  IF again->>'case_id'<>result->>'case_id' THEN RAISE EXCEPTION 'Delivery made a new Case'; END IF;
  IF before_count<>(SELECT count(*) FROM user_data_rows WHERE table_id=dataset
    AND row->>'source_kind'='document_work')
  THEN RAISE EXCEPTION 'Ensure conflict/retry changed Case count'; END IF;
  again := axtn_case_document(owner,'document_ensure',work||jsonb_build_object(
    'businessRequestId','untrusted-reference-request','deliveryId','untrusted-reference-delivery',
    'externalReferenceContext',jsonb_build_object(
      'external_ref_id','opaque:001','external_parent_ref_id','opaque:parent')));
  IF again->>'external_reference_status'<>'NEEDS_CLARIFICATION'
    OR again->>'parent_case_id' IS NOT NULL OR again ? 'external_ref_id'
    OR again->>'document_id'<>result->>'document_id'
  THEN RAISE EXCEPTION 'Untrusted reference inferred a Parent, Core field or different document'; END IF;
  BEGIN
    PERFORM axtn_case_document(owner,'document_assign',jsonb_build_object(
      'caseId',again->>'case_id','documentId',again->>'document_id','_principal',human));
    RAISE EXCEPTION 'Human overwrote an existing primary relation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_PRIMARY_BUSINESS_RELATION_CONFLICT' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_document(owner,'document_ensure',work||
      jsonb_build_object('processingMode','SEMANTIC'));
    RAISE EXCEPTION 'Claimed semantic authority not rejected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_PROTECTED_PRIVACY_EVIDENCE_REQUIRED' THEN RAISE; END IF;
  END;
  transition := jsonb_build_object('caseId',result->>'case_id',
    'attemptId',original_attempt,'inputHash',result->>'input_hash',
    'eventType','TAKEOVER','reasonCode','HUMAN_CONTINUATION',
    'transitionKey','fixture-human-takeover','references','[]'::jsonb,'_principal',human);
  result := axtn_case_document(owner,'document_transition',transition);
  again := axtn_case_document(owner,'document_transition',transition);
  IF result IS DISTINCT FROM again OR result->>'attempt_id'=original_attempt
    OR result->>'processing_mode'<>'HUMAN'
  THEN RAISE EXCEPTION 'Lost response replay or takeover fencing failed'; END IF;
  BEGIN
    PERFORM axtn_case_document(owner,'document_transition',transition||
      jsonb_build_object('_principal',machine,'eventType','RESULT','transitionKey','stale-machine'));
    RAISE EXCEPTION 'Machine result survived Human takeover';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_HUMAN_TAKEOVER_FENCED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_document(other,'document_transition',transition||
      jsonb_build_object('_principal',jsonb_build_object('kind','user_session','id',other)));
    RAISE EXCEPTION 'Foreign owner accessed Case';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_OWNED_CASE_REQUIRED' THEN RAISE; END IF;
  END;
  transition := transition||jsonb_build_object('attemptId',result->>'attempt_id',
    'eventType','DETAILS','transitionKey','fixture-human-critical',
    'details',jsonb_build_object('subject','Manual work','priority',0,'dueDate',NULL,'followUp',NULL));
  result := axtn_case_document(owner,'document_transition',transition);
  IF result->>'priority'<>'0' THEN RAISE EXCEPTION 'Human critical priority not recorded'; END IF;
  proposal := jsonb_build_object('schemaVersion','document-decision-v1',
    'decisionId','66666666-6666-4666-8666-666666666666','caseId',result->>'case_id',
    'attemptId',result->>'attempt_id','inputHash',result->>'input_hash',
    'documentId',result->>'document_id','sourceRef','fixture:opaque-01','sourceRevision','"etag:0001"',
    'graphRevision',NULL,'ruleRevision',NULL,'featureSchemaRevision','document-features-v1',
    'family','fixture-family','operation','CLASSIFY','target',NULL,'automationMode','ASSISTED',
    'evidence',jsonb_build_array(jsonb_build_object('kind','evidence',
      'repository','aXtn/aXtn-agentswarms','id','tests/integration/documentWork.sql')),
    'decisionRevision',repeat('e',64),'_principal',human);
  saved_proposal := axtn_case_document(owner,'document_propose',proposal);
  again := axtn_case_document(owner,'document_propose',proposal);
  IF saved_proposal IS DISTINCT FROM again OR saved_proposal->>'status'<>'PROPOSED'
    OR (SELECT count(*) FROM audit_events WHERE user_id=owner AND action='axtn_work.DOCUMENT_PROPOSED')<>1
  THEN RAISE EXCEPTION 'Proposal replay failed or became authority'; END IF;
  again := axtn_case_document(owner,'document_proposals',jsonb_build_object(
    'caseId',result->>'case_id','_principal',machine));
  IF jsonb_array_length(again)<>1 OR (again->0)-'current' IS DISTINCT FROM saved_proposal
    OR again->0->>'current'<>'true'
  THEN RAISE EXCEPTION 'Persisted proposal not readable through shared Case API'; END IF;
  BEGIN
    PERFORM axtn_case_document(other,'document_proposals',jsonb_build_object(
      'caseId',result->>'case_id','_principal',jsonb_build_object('kind','user_session','id',other)));
    RAISE EXCEPTION 'Foreign owner read proposal';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_OWNED_CASE_REQUIRED' THEN RAISE; END IF;
  END;
  IF result IS DISTINCT FROM (SELECT row-'document_decisions_by_operation' FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=result->>'case_id')
  THEN RAISE EXCEPTION 'Proposal silently changed Case state'; END IF;
  BEGIN
    PERFORM axtn_case_document(owner,'document_propose',proposal||'{"family":"changed"}');
    RAISE EXCEPTION 'Proposal revision overwritten';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_DECISION_IMMUTABLE' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_document(owner,'document_propose',proposal||'{"sourceRevision":"changed"}');
    RAISE EXCEPTION 'Stale source proposal accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_CURRENT_PROPOSAL_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
  transition := (transition-'details')||jsonb_build_object(
    'eventType','RELEASE','transitionKey','fixture-human-release',
    'processingMode','DETERMINISTIC','executionChannel','SWARM');
  result := axtn_case_document(owner,'document_transition',transition);
  IF result->>'priority'<>'0' OR result->>'processing_mode'<>'DETERMINISTIC'
  THEN RAISE EXCEPTION 'Release lost Human priority or mode'; END IF;
  BEGIN
    PERFORM axtn_case_document(owner,'document_propose',proposal||
      jsonb_build_object('attemptId',result->>'attempt_id'));
    RAISE EXCEPTION 'Takeover proposal survived release revision fence';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_PROTECTED_PRIVACY_EVIDENCE_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_document(owner,'document_transition',transition||
      jsonb_build_object('_principal',machine,'eventType','RESULT','transitionKey','stale-after-release'));
    RAISE EXCEPTION 'Old attempt accepted after release';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_STALE_ATTEMPT_OR_INPUT' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_document(owner,'document_transition',transition||
      jsonb_build_object('attemptId',result->>'attempt_id','eventType','COMPLETED',
        'transitionKey','fake-provider-success'));
    RAISE EXCEPTION 'Unverified completion accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_RESULT_CANNOT_ASSERT_ACCEPTANCE' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM audit_events WHERE user_id=owner AND resource_type='axtn_case_work'
      AND detail->>'transitionKey'='fixture-human-takeover')<>1
  THEN RAISE EXCEPTION 'Takeover audit duplicated'; END IF;
  IF has_function_privilege('authenticated','public.axtn_case_document(uuid,text,jsonb)','EXECUTE')
    OR has_function_privilege('anon','public.axtn_case_document(uuid,text,jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'Raw user has privileged document RPC access'; END IF;
  RAISE NOTICE 'PASS: Case-before-semantics, replay, delivery conflicts, fencing, foreign owner, manual priority and no forged completion';
END;
$$;

SET LOCAL ROLE service_role;
DO $$
DECLARE owner uuid := '11111111-1111-4111-8111-111111111111';
BEGIN
  BEGIN
    INSERT INTO user_data_tables(user_id,name,columns)
      VALUES('22222222-2222-4222-8222-222222222222','axtn_document_decisions','[]');
    RAISE EXCEPTION 'Generic Dataset insertion forged reserved Decisions namespace';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_NATIVE_CASE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO user_data_tables(user_id,name,columns)
      VALUES('22222222-2222-4222-8222-222222222222','unprotected-fixture','[]');
    UPDATE user_data_tables SET name='axtn_document_decisions'
      WHERE user_id='22222222-2222-4222-8222-222222222222' AND name='unprotected-fixture';
    RAISE EXCEPTION 'Dataset rename forged reserved Decisions namespace';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_NATIVE_CASE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO user_data_rows(table_id,row)
      SELECT id,'{"decision_id":"forged","status":"APPROVED"}'::jsonb
      FROM user_data_tables WHERE user_id=owner AND name='axtn_document_decisions';
    RAISE EXCEPTION 'Generic insert without marker forged proposal authority';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_NATIVE_CASE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE user_data_rows r SET row=r.row||'{"status":"APPROVED"}'
      FROM user_data_tables t WHERE t.id=r.table_id AND t.user_id=owner
        AND t.name='axtn_document_decisions';
    RAISE EXCEPTION 'Generic write turned proposal into authority';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_NATIVE_CASE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_local_table_upsert(owner,'axtn_document_decisions','decision_id',
      '66666666-6666-4666-8666-666666666666','{"status":"APPROVED"}');
    RAISE EXCEPTION 'Local Table rewrote immutable proposal';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_NATIVE_CASE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM user_data_tables WHERE user_id=owner AND name='axtn_document_decisions';
    RAISE EXCEPTION 'Dataset delete removed immutable proposal';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_NATIVE_CASE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO user_data_rows(table_id,row)
      SELECT id,'{"source_kind":"document_work","case_type":"DOCUMENT_PROCESSING","case_id":"44444444-4444-4444-8444-444444444444"}'
      FROM user_data_tables WHERE user_id=owner AND name='axtn_cases';
    RAISE EXCEPTION 'Generic insert bypassed native document contract';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_NATIVE_CASE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_local_table_upsert(owner,'axtn_cases','source_id',
      'request:fixture:fixture-request-01','{"subject":"overwrite"}'::jsonb);
    RAISE EXCEPTION 'Local Table bypassed protected document Case';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_NATIVE_CASE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE user_data_tables SET columns='[]'::jsonb WHERE user_id=owner AND name='axtn_cases';
    RAISE EXCEPTION 'Dataset metadata bypassed document protection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_NATIVE_CASE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE user_data_rows r SET row=r.row||'{"case_id":"22222222-2222-4222-8222-222222222222"}'
      FROM user_data_tables t WHERE t.id=r.table_id AND t.user_id=owner
        AND t.name='axtn_case_relations' AND r.row->>'relation_type'='related_document';
    RAISE EXCEPTION 'Generic update replaced the primary document relation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_NATIVE_CASE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_local_table_upsert(owner,'axtn_case_relations','target_id',
      '33333333-3333-4333-8333-333333333333','{"case_id":"22222222-2222-4222-8222-222222222222"}');
    RAISE EXCEPTION 'Local Table replaced the primary document relation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_NATIVE_CASE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: actual service_role generic Row/LocalTable/Dataset bypasses rejected';
END;
$$;
RESET ROLE;
ROLLBACK;
