\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
  VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
  ON CONFLICT(id) DO NOTHING;

CREATE FUNCTION pg_temp.feedback_denied(owner_id uuid,payload jsonb,expected text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE before_rows bigint; before_audit bigint; before_case jsonb; after_case jsonb;
BEGIN
  SELECT count(*) INTO before_rows FROM user_data_rows;
  SELECT count(*) INTO before_audit FROM audit_events;
  SELECT r.row INTO before_case FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=owner_id AND t.name='axtn_cases' AND r.row->>'case_id'=payload->>'caseId';
  BEGIN
    PERFORM axtn_case_document(owner_id,'document_feedback',payload);
    RAISE EXCEPTION 'Feedback denial unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>expected THEN RAISE; END IF;
  END;
  SELECT r.row INTO after_case FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=owner_id AND t.name='axtn_cases' AND r.row->>'case_id'=payload->>'caseId';
  IF before_rows<>(SELECT count(*) FROM user_data_rows)
    OR before_audit<>(SELECT count(*) FROM audit_events) OR before_case IS DISTINCT FROM after_case
  THEN RAISE EXCEPTION 'Feedback denial changed persisted state'; END IF;
END;
$$;

CREATE TEMP TABLE feedback_fixture(owner_id uuid,case_id uuid,event jsonb,stored jsonb,dataset_id uuid);
GRANT SELECT ON feedback_fixture TO service_role;
DO $$
DECLARE owner_id uuid:=gen_random_uuid(); foreign_owner uuid:=gen_random_uuid(); human jsonb; machine jsonb;
  work jsonb; state jsonb; original_state jsonb; proposal jsonb; decision jsonb;
  event jsonb; stored jsonb; corrected jsonb; correction jsonb; observed jsonb;
  dataset uuid; ref jsonb; candidate_event uuid:=gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id,email,invited_at) VALUES
    (owner_id,owner_id::text||'@dms-feedback.invalid',now()),
    (foreign_owner,foreign_owner::text||'@dms-feedback.invalid',now());
  human:=jsonb_build_object('kind','user_session','id',owner_id);
  machine:=jsonb_build_object('kind','swarm','id',owner_id);
  ref:=jsonb_build_object('kind','evidence','repository','aXtn/aXtn-agentswarms',
    'id','tests/integration/documentFeedback.sql','revision',repeat('a',40));
  work:=jsonb_build_object('businessRequestId','feedback-native-fixture','caseType','DOCUMENT_PROCESSING',
    'workContractRef',ref||jsonb_build_object('kind','contract'),
    'scenarioClass','regression','scenarioId','feedback-native-fixture',
    'processingMode','DETERMINISTIC','executionChannel','SWARM','actorRef',owner_id,
    'inputManifest',jsonb_build_object('sourceKind','fixture','sourceRef','fixture:feedback',
      'sourceRevision','"etag:0001"','contentHash',repeat('a',64),'privacyStatus','NO_AI'),
    'inputHash',repeat('b',64),'deliveryId','feedback-native-fixture','references','[]'::jsonb,
    '_principal',machine);
  state:=axtn_case_document(owner_id,'document_ensure',work);
  state:=axtn_case_document(owner_id,'document_transition',jsonb_build_object(
    'caseId',state->>'case_id','attemptId',state->>'attempt_id','inputHash',state->>'input_hash',
    'eventType','TAKEOVER','reasonCode','MANUAL_FEEDBACK_FIXTURE','transitionKey','feedback-takeover',
    'references','[]'::jsonb,'_principal',human));
  original_state:=state;
  proposal:=jsonb_build_object('schemaVersion','document-decision-v1','decisionId',gen_random_uuid(),
    'caseId',state->>'case_id','attemptId',state->>'attempt_id','inputHash',state->>'input_hash',
    'documentId',state->>'document_id','sourceRef','fixture:feedback','sourceRevision','"etag:0001"',
    'graphRevision',NULL,'ruleRevision',NULL,'featureSchemaRevision','document-features-v1',
    'family','fixture-first','operation','CLASSIFY','target',NULL,'automationMode','ASSISTED',
    'evidence',jsonb_build_array(ref),'decisionRevision',repeat('c',64),'_principal',human);
  decision:=axtn_case_document(owner_id,'document_propose',proposal);
  event:=jsonb_build_object('schemaVersion','document-feedback-v1','eventId',gen_random_uuid(),
    'caseId',state->>'case_id','decisionId',decision->>'decision_id','decisionRevision',decision->>'revision',
    'attemptId',state->>'attempt_id','inputHash',state->>'input_hash','sourceRevision','"etag:0001"',
    'eventType','VERIFIED_CORRECT','before',jsonb_build_object('family','fixture-first','targetId',NULL),
    'after',jsonb_build_object('family','fixture-first','targetId',NULL),'reasonCode','HUMAN_CONFIRMED',
    'supersedesEventId',NULL,'evidence',jsonb_build_array(ref),
    'feedbackRevision',repeat('d',64),'_principal',human,'actorRef',owner_id);
  stored:=axtn_case_document(owner_id,'document_feedback',event);
  IF stored->>'verified'<>'true' OR stored->'principal'<>human
    OR stored->>'created_at' IS NULL OR stored->>'revision'<>repeat('d',64)
    OR stored->'document_feedback' ? '_principal'
  THEN RAISE EXCEPTION 'Persisted feedback lacks minimized authenticated binding'; END IF;
  IF axtn_case_document(owner_id,'document_feedback',event) IS DISTINCT FROM stored
    OR axtn_case_document(owner_id,'document_feedback',event||
      jsonb_build_object('eventId',gen_random_uuid(),'evidence',jsonb_build_array(ref,ref)))
      IS DISTINCT FROM stored
  THEN RAISE EXCEPTION 'Lost-response/content duplicate feedback was not idempotent'; END IF;
  IF (SELECT count(*) FROM audit_events WHERE user_id=owner_id
    AND action='axtn_work.DOCUMENT_FEEDBACK_RECORDED')<>1
  THEN RAISE EXCEPTION 'Feedback replay duplicated audit'; END IF;
  PERFORM pg_temp.feedback_denied(owner_id,event||jsonb_build_object('feedbackRevision',repeat('e',64)),
    'DOCUMENT_FEEDBACK_IMMUTABLE');
  PERFORM pg_temp.feedback_denied(owner_id,event||jsonb_build_object(
    'eventId',gen_random_uuid(),'_principal',machine),'DOCUMENT_FEEDBACK_AUTHENTICATED_HUMAN_REQUIRED');
  PERFORM pg_temp.feedback_denied(owner_id,event||jsonb_build_object(
    'eventId',gen_random_uuid(),'_principal',jsonb_build_object('kind','user_session','id',foreign_owner)),
    'DOCUMENT_PRINCIPAL_OWNER_DENIED');
  PERFORM pg_temp.feedback_denied(foreign_owner,event||jsonb_build_object(
    '_principal',jsonb_build_object('kind','user_session','id',foreign_owner)),
    'DOCUMENT_OWNED_CASE_REQUIRED');
  PERFORM pg_temp.feedback_denied(owner_id,event||jsonb_build_object(
    'eventId',gen_random_uuid(),'attemptId',gen_random_uuid()),'DOCUMENT_FEEDBACK_CURRENT_CASE_BINDING_REQUIRED');
  PERFORM pg_temp.feedback_denied(owner_id,event||jsonb_build_object(
    'eventId',gen_random_uuid(),'sourceRevision','"etag:0002"'),'DOCUMENT_FEEDBACK_CURRENT_CASE_BINDING_REQUIRED');
  PERFORM pg_temp.feedback_denied(owner_id,event||jsonb_build_object(
    'eventId',gen_random_uuid(),'decisionRevision',repeat('e',64)),'DOCUMENT_FEEDBACK_CURRENT_DECISION_REQUIRED');
  PERFORM pg_temp.feedback_denied(owner_id,event||jsonb_build_object('eventId',gen_random_uuid(),
    'before',jsonb_build_object('family','fiction','targetId',NULL),
    'after',jsonb_build_object('family','fiction','targetId',NULL)),
    'DOCUMENT_FEEDBACK_CONFIRMED_ASSIGNMENT_REQUIRED');
  PERFORM pg_temp.feedback_denied(owner_id,event||jsonb_build_object(
    'eventId',gen_random_uuid(),'approved',true),'DOCUMENT_FEEDBACK_REGISTERED_CONTRACT_REQUIRED');
  PERFORM pg_temp.feedback_denied(owner_id,event||jsonb_build_object(
    'eventId',gen_random_uuid(),'evidence',jsonb_build_array(ref||jsonb_build_object('id','https://outside.invalid'))),
    'DOCUMENT_FEEDBACK_MINIMIZED_REFERENCE_REQUIRED');
  PERFORM pg_temp.feedback_denied(owner_id,event||jsonb_build_object(
    'eventId',gen_random_uuid(),'after',jsonb_build_object('family','original text marker','targetId',NULL)),
    'DOCUMENT_FEEDBACK_MINIMIZED_ASSIGNMENT_REQUIRED');

  correction:=event||jsonb_build_object('eventId',candidate_event,'eventType','CORRECTION',
    'supersedesEventId',stored->>'feedback_id','reasonCode','WRONG_FAMILY',
    'after',jsonb_build_object('family','fixture-second','targetId',NULL),'feedbackRevision',repeat('e',64));
  corrected:=axtn_case_document(owner_id,'document_feedback',correction);
  IF axtn_case_document(owner_id,'document_feedback',correction||jsonb_build_object('eventId',gen_random_uuid()))
    IS DISTINCT FROM corrected
  THEN RAISE EXCEPTION 'Correction duplicate re-created a successor'; END IF;
  PERFORM pg_temp.feedback_denied(owner_id,correction||jsonb_build_object(
    'eventId',gen_random_uuid(),'after',jsonb_build_object('family','competing','targetId',NULL)),
    'DOCUMENT_FEEDBACK_CONFIRMED_PREDECESSOR_REQUIRED');
  PERFORM pg_temp.feedback_denied(owner_id,correction||jsonb_build_object(
    'eventId',gen_random_uuid(),'supersedesEventId',gen_random_uuid()),
    'DOCUMENT_FEEDBACK_CONFIRMED_PREDECESSOR_REQUIRED');
  observed:=axtn_case_document(owner_id,'document_feedback',event||jsonb_build_object(
    'eventId',gen_random_uuid(),'eventType','UNVERIFIED','reasonCode','UNVERIFIED_OBSERVATION',
    'evidence',jsonb_build_array(ref,ref||jsonb_build_object('id','tests/integration/documentFeedbackConcurrency.mjs'))));
  IF observed->>'verified'<>'false'
  THEN RAISE EXCEPTION 'Unverified observation acquired confirmation authority'; END IF;
  IF axtn_case_document(owner_id,'document_feedback',
    observed->'document_feedback'||jsonb_build_object('eventId',gen_random_uuid(),
      'feedbackRevision',observed->>'revision','_principal',human,
      'evidence',jsonb_build_array(
        ref||jsonb_build_object('id','tests/integration/documentFeedbackConcurrency.mjs'),ref,ref)))
    IS DISTINCT FROM observed
  THEN RAISE EXCEPTION 'Evidence reorder/repetition created duplicate feedback'; END IF;
  PERFORM pg_temp.feedback_denied(owner_id,event||jsonb_build_object('eventId',gen_random_uuid(),
    'eventType','UNVERIFIED','reasonCode','UNVERIFIED_OBSERVATION','supersedesEventId',stored->>'feedback_id'),
    'DOCUMENT_FEEDBACK_EVENT_SEMANTICS_REQUIRED');
  IF jsonb_array_length(axtn_case_document(owner_id,'document_feedback_events',jsonb_build_object(
    'caseId',state->>'case_id','_principal',machine)))<>3
  THEN RAISE EXCEPTION 'Owned feedback not findable through existing Case service'; END IF;
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=owner_id AND name='axtn_document_feedback';
  IF (SELECT row-'document_decisions_by_operation' FROM user_data_rows
    WHERE table_id IN(SELECT id FROM user_data_tables WHERE user_id=owner_id AND name='axtn_cases')
      AND row->>'case_id'=state->>'case_id') IS DISTINCT FROM original_state
  THEN RAISE EXCEPTION 'Feedback altered Case lifecycle or privacy authority'; END IF;
  -- Current Decision drift forbids new events, but immutable replay remains readback-only.
  PERFORM axtn_case_document(owner_id,'document_propose',proposal||jsonb_build_object(
    'decisionId',gen_random_uuid(),'decisionRevision',repeat('f',64)));
  PERFORM pg_temp.feedback_denied(owner_id,event||jsonb_build_object(
    'eventId',gen_random_uuid(),'evidence',jsonb_build_array(ref||jsonb_build_object('revision',repeat('b',40)))),
    'DOCUMENT_FEEDBACK_CURRENT_DECISION_REQUIRED');
  IF axtn_case_document(owner_id,'document_feedback',event) IS DISTINCT FROM stored
  THEN RAISE EXCEPTION 'Post-drift replay attempted new feedback'; END IF;
  INSERT INTO feedback_fixture VALUES(owner_id,(state->>'case_id')::uuid,event,stored,dataset);
END $$;

SET LOCAL ROLE service_role;
DO $$
DECLARE fixture feedback_fixture%ROWTYPE;
BEGIN
  SELECT * INTO fixture FROM feedback_fixture;
  BEGIN
    UPDATE user_data_rows SET row=row||'{"verified":false}'::jsonb
      WHERE table_id=fixture.dataset_id;
    RAISE EXCEPTION 'Direct service role changed immutable feedback';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_FEEDBACK_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM user_data_rows WHERE table_id=fixture.dataset_id;
    RAISE EXCEPTION 'Direct service role deleted immutable feedback';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_FEEDBACK_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE user_data_tables SET name='feedback-shadow' WHERE id=fixture.dataset_id;
    RAISE EXCEPTION 'Dataset rename bypassed append-only contract';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_FEEDBACK_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_local_table_upsert(fixture.owner_id,'axtn_document_feedback','feedback_id',
      fixture.stored->>'feedback_id',fixture.stored);
    RAISE EXCEPTION 'Local Table bypassed feedback contract';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_FEEDBACK_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  IF axtn_case_document(fixture.owner_id,'document_feedback',fixture.event) IS DISTINCT FROM fixture.stored
  THEN RAISE EXCEPTION 'Actual service-role RPC readback failed'; END IF;
END $$;
RESET ROLE;
DO $$
DECLARE owner_id uuid:=gen_random_uuid(); machine jsonb; state jsonb; decision jsonb;
  event jsonb; stored jsonb; dataset uuid; key_id uuid:=gen_random_uuid(); swarm_id uuid:=gen_random_uuid();
  ref jsonb:=jsonb_build_object('kind','evidence','repository','aXtn/aXtn-agentswarms',
    'id','tests/integration/documentFeedback.sql');
BEGIN
  INSERT INTO auth.users(id,email,invited_at) VALUES(owner_id,owner_id::text||'@dms-feedback-key.invalid',now());
  INSERT INTO swarms(id,user_id,name,nodes,edges)
    VALUES(swarm_id,owner_id,'Isolated feedback key fixture','[]'::jsonb,'[]'::jsonb);
  INSERT INTO swarm_api_keys(id,user_id,swarm_id,name,key_hash,key_prefix,scopes)
    VALUES(key_id,owner_id,swarm_id,'Isolated nonfunctional key fixture',repeat('f',64),'fixture',ARRAY['cases']);
  machine:=jsonb_build_object('kind','swarm_api_key','id',key_id);
  state:=axtn_case_document(owner_id,'document_ensure',jsonb_build_object(
    'businessRequestId','feedback-key-fixture','caseType','DOCUMENT_PROCESSING',
    'workContractRef',ref||jsonb_build_object('kind','contract'),
    'scenarioClass','regression','scenarioId','feedback-key-fixture',
    'processingMode','DETERMINISTIC','executionChannel','SWARM',
    'inputManifest',jsonb_build_object('sourceKind','fixture','sourceRef','fixture:feedback-key',
      'sourceRevision','"etag:key-0001"','contentHash',repeat('a',64),
      'privacyStatus','ELIGIBLE','privacyRevision',repeat('b',64)),
    'inputHash',repeat('c',64),'deliveryId','feedback-key-fixture','references','[]'::jsonb,'_principal',machine));
  state:=axtn_case_document(owner_id,'document_transition',jsonb_build_object(
    'caseId',state->>'case_id','attemptId',state->>'attempt_id','inputHash',state->>'input_hash',
    'eventType','STARTED','reasonCode','ISOLATED_KEY_FIXTURE','transitionKey','key-start',
    'references','[]'::jsonb,'_principal',machine));
  -- Privileged synthetic receipt fixture only; no live eligibility setter exists.
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=owner_id AND name='axtn_cases';
  UPDATE user_data_rows SET row=row||jsonb_build_object(
    'verified_privacy_status','ELIGIBLE','privacy_evidence_revision',repeat('b',64))
    WHERE table_id=dataset AND row->>'case_id'=state->>'case_id';
  decision:=axtn_case_document(owner_id,'document_propose',jsonb_build_object(
    'schemaVersion','document-decision-v1','decisionId',gen_random_uuid(),
    'caseId',state->>'case_id','attemptId',state->>'attempt_id','inputHash',state->>'input_hash',
    'documentId',state->>'document_id','sourceRef','fixture:feedback-key','sourceRevision','"etag:key-0001"',
    'graphRevision',NULL,'ruleRevision',NULL,'featureSchemaRevision','document-features-v1',
    'family','fixture','operation','CLASSIFY','target',NULL,'automationMode','OBSERVE',
    'evidence',jsonb_build_array(ref),'decisionRevision',repeat('d',64),'_principal',machine));
  event:=jsonb_build_object('schemaVersion','document-feedback-v1','eventId',gen_random_uuid(),
    'caseId',state->>'case_id','decisionId',decision->>'decision_id','decisionRevision',decision->>'revision',
    'attemptId',state->>'attempt_id','inputHash',state->>'input_hash','sourceRevision','"etag:key-0001"',
    'eventType','UNVERIFIED','before',jsonb_build_object('family','fixture','targetId',NULL),
    'after',jsonb_build_object('family','fixture','targetId',NULL),'reasonCode','UNVERIFIED_OBSERVATION',
    'supersedesEventId',NULL,'evidence',jsonb_build_array(ref),'feedbackRevision',repeat('e',64),'_principal',machine);
  stored:=axtn_case_document(owner_id,'document_feedback',event);
  IF stored->>'verified'<>'false' OR stored->'principal'<>machine
  THEN RAISE EXCEPTION 'Actual machine-key observation acquired Human authority'; END IF;
  PERFORM pg_temp.feedback_denied(owner_id,event||jsonb_build_object(
    'eventId',gen_random_uuid(),'eventType','VERIFIED_CORRECT','reasonCode','HUMAN_CONFIRMED'),
    'DOCUMENT_FEEDBACK_AUTHENTICATED_HUMAN_REQUIRED');
  UPDATE swarm_api_keys SET scopes=ARRAY['run'] WHERE id=key_id;
  PERFORM pg_temp.feedback_denied(owner_id,event,'DOCUMENT_CASE_KEY_DENIED');
  UPDATE swarm_api_keys SET scopes=ARRAY['cases'],expires_at=now()-interval '1 second' WHERE id=key_id;
  PERFORM pg_temp.feedback_denied(owner_id,event,'DOCUMENT_CASE_KEY_DENIED');
  UPDATE swarm_api_keys SET expires_at=NULL,revoked_at=now() WHERE id=key_id;
  PERFORM pg_temp.feedback_denied(owner_id,event,'DOCUMENT_CASE_KEY_DENIED');
END $$;
DO $$
BEGIN
  IF has_function_privilege('authenticated','public.axtn_case_document(uuid,text,jsonb)','EXECUTE')
    OR has_function_privilege('anon','public.axtn_case_document(uuid,text,jsonb)','EXECUTE')
    OR has_function_privilege('service_role','public.axtn_case_document_before_feedback(uuid,text,jsonb)','EXECUTE')
    OR has_function_privilege('service_role','public.axtn_local_table_upsert_before_feedback(uuid,text,text,text,jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'Feedback private delegates or unauthenticated RPC remained callable'; END IF;
  RAISE NOTICE 'PASS: actual protected minimized feedback, replay/dedup, correction chain, current bindings, roles/broker guards, NO_AI human metadata and lifecycle preservation';
END $$;
ROLLBACK;
