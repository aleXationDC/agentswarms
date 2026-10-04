\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
  VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
  ON CONFLICT(id) DO NOTHING;
DO $$
DECLARE owner uuid := gen_random_uuid(); human jsonb; machine jsonb;
  work jsonb; state jsonb; proposal jsonb; first_decision jsonb; second_decision jsonb;
  decisions jsonb; before_case jsonb; dataset uuid; decision_id uuid := gen_random_uuid();
  constraint_name text;
BEGIN
  INSERT INTO auth.users(id,email,invited_at)
    VALUES(owner,owner::text||'@dms-current.invalid',now());
  human := jsonb_build_object('kind','user_session','id',owner);
  machine := jsonb_build_object('kind','swarm','id',owner);
  work := jsonb_build_object('businessRequestId','current-proposal','caseType','DOCUMENT_PROCESSING',
    'workContractRef',jsonb_build_object('kind','contract','repository','aXtn/aXtn-agentswarms',
      'id','tests/integration/documentCurrentProposal.sql','revision',repeat('a',40)),
    'scenarioClass','regression','scenarioId','current-proposal',
    'processingMode','DETERMINISTIC','executionChannel','SWARM','actorRef',owner,
    'inputManifest',jsonb_build_object('sourceKind','fixture','sourceRef','fixture:current',
      'sourceRevision','"etag:0001"','contentHash',repeat('a',64),'privacyStatus','NO_AI'),
    'inputHash',repeat('b',64),'deliveryId','current-proposal','references','[]'::jsonb,
    '_principal',machine);
  state := axtn_case_document(owner,'document_ensure',work);
  state := axtn_case_document(owner,'document_transition',jsonb_build_object(
    'caseId',state->>'case_id','attemptId',state->>'attempt_id','inputHash',state->>'input_hash',
    'eventType','TAKEOVER','reasonCode','HUMAN_PROPOSAL','transitionKey','current-takeover',
    'references','[]'::jsonb,'_principal',human));
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=owner AND name='axtn_cases';
  proposal := jsonb_build_object('schemaVersion','document-decision-v1',
    'decisionId',decision_id,'caseId',state->>'case_id','attemptId',state->>'attempt_id',
    'inputHash',state->>'input_hash','documentId',state->>'document_id',
    'sourceRef','fixture:current','sourceRevision','"etag:0001"','graphRevision',NULL,
    'ruleRevision',NULL,'featureSchemaRevision','document-features-v1','family','first-family',
    'operation','CLASSIFY','target',NULL,'automationMode','ASSISTED',
    'evidence',jsonb_build_array(jsonb_build_object('kind','evidence',
      'repository','aXtn/aXtn-agentswarms','id','tests/integration/documentCurrentProposal.sql')),
    'decisionRevision',repeat('c',64),'_principal',human);
  first_decision := axtn_case_document(owner,'document_propose',proposal);
  IF axtn_case_document(owner,'document_propose',proposal) IS DISTINCT FROM first_decision
    OR (SELECT count(*) FROM audit_events WHERE user_id=owner
      AND action='axtn_work.DOCUMENT_PROPOSAL_SELECTED')<>1
  THEN RAISE EXCEPTION 'Current proposal replay changed selection or audit'; END IF;
  second_decision := axtn_case_document(owner,'document_propose',proposal||
    jsonb_build_object('decisionId',gen_random_uuid(),'family','second-family','decisionRevision',repeat('d',64)));
  decisions := axtn_case_document(owner,'document_proposals',
    jsonb_build_object('caseId',state->>'case_id','_principal',machine));
  IF jsonb_array_length(decisions)<>2
    OR (SELECT count(*) FROM jsonb_array_elements(decisions) d WHERE d->>'current'='true')<>1
    OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(decisions) d
      WHERE d->>'decision_id'=second_decision->>'decision_id' AND d->>'current'='true')
  THEN RAISE EXCEPTION 'Current/non-current proposal readback mismatch'; END IF;
  BEGIN
    PERFORM axtn_case_document(owner,'document_propose',proposal);
    RAISE EXCEPTION 'Late callback reactivated old proposal';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_DECISION_SUPERSEDED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM assert_axtn_document_approval(jsonb_build_object('caseId',state->>'case_id',
      'proposalOperation','CLASSIFY','decisionId',first_decision->>'decision_id',
      'decisionRevision',first_decision->>'revision'),owner,NULL);
    RAISE EXCEPTION 'Superseded decision retained Approval authority';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DMS_NATIVE_APPROVAL_CURRENT_DECISION_REQUIRED' THEN RAISE; END IF;
  END;
  IF (SELECT row-'document_decisions_by_operation' FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=state->>'case_id') IS DISTINCT FROM state
    OR (SELECT count(*) FROM audit_events WHERE user_id=owner
      AND action='axtn_work.DOCUMENT_PROPOSAL_SELECTED')<>2
  THEN RAISE EXCEPTION 'Proposal selection changed lifecycle or denial changed audit'; END IF;
  -- A future privacy adapter may persist a terminal NO_AI proof. Its hash
  -- must never become semantic authority merely because it is well-formed.
  UPDATE user_data_rows SET row=row||jsonb_build_object(
    'processing_mode','DETERMINISTIC','actor_principal',machine,
    'privacy_evidence_revision',repeat('e',64),'verified_privacy_status','ELIGIBLE')
    WHERE table_id=dataset AND row->>'case_id'=state->>'case_id';
  SELECT row INTO before_case FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=state->>'case_id';
  BEGIN
    PERFORM axtn_case_document(owner,'document_propose',proposal||
      jsonb_build_object('decisionId',gen_random_uuid(),'_principal',machine));
    RAISE EXCEPTION 'NO_AI hash/claimed eligibility authorized machine proposal';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_PROTECTED_PRIVACY_EVIDENCE_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_document(owner,'document_transition',jsonb_build_object(
      'caseId',state->>'case_id','attemptId',state->>'attempt_id','inputHash',state->>'input_hash',
      'eventType','STARTED','reasonCode','SEMANTIC_REQUEST','transitionKey','no-ai-semantic',
      'processingMode','SEMANTIC','executionChannel','SWARM','_principal',human));
    RAISE EXCEPTION 'Authenticated Human bypassed NO_AI semantic gate';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_PROTECTED_PRIVACY_EVIDENCE_REQUIRED' THEN RAISE; END IF;
  END;
  IF (SELECT row FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=state->>'case_id') IS DISTINCT FROM before_case
  THEN RAISE EXCEPTION 'Privacy denial changed Case'; END IF;
  BEGIN
    INSERT INTO user_data_tables(user_id,name,columns) VALUES(owner,'axtn_cases','[]'::jsonb);
    RAISE EXCEPTION 'Duplicate logical Dataset forked Case authority';
  EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS constraint_name=CONSTRAINT_NAME;
    IF constraint_name<>'user_data_tables_user_id_name_key' THEN RAISE; END IF;
  END;
  IF has_function_privilege('service_role','public.axtn_case_document_profile_v1(uuid,text,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.assert_axtn_document_approval_binding_v1(jsonb,uuid,uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'Private legacy adapter bypass remains callable'; END IF;
  RAISE NOTICE 'PASS: atomic current proposal, stale callback/Approval denial, lifecycle preserved, NO_AI, existing Dataset uniqueness and private delegates';
END $$;
ROLLBACK;
