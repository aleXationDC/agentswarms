-- A candidate is a NEW Child in the existing Case carrier, never a promotion.
CREATE UNIQUE INDEX axtn_document_candidate_identity ON public.user_data_rows
  (table_id,(row->>'candidate_id')) WHERE row ? 'document_learning_candidate';
CREATE UNIQUE INDEX axtn_document_candidate_dedup ON public.user_data_rows
  (table_id,(row->>'candidate_key')) WHERE row ? 'document_learning_candidate';

CREATE OR REPLACE FUNCTION public.guard_axtn_document_feedback_storage() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE protected boolean := false;
BEGIN
  IF TG_TABLE_NAME='user_data_rows' THEN
    IF TG_OP<>'INSERT' THEN
      protected := OLD.row ?| ARRAY['document_feedback','document_learning_candidate'] OR EXISTS(
        SELECT 1 FROM user_data_tables WHERE id=OLD.table_id
          AND name IN ('axtn_document_feedback','axtn_document_learning_candidates'));
    END IF;
    IF TG_OP<>'DELETE' THEN
      protected := protected OR NEW.row ?| ARRAY['document_feedback','document_learning_candidate'] OR EXISTS(
        SELECT 1 FROM user_data_tables WHERE id=NEW.table_id
          AND name IN ('axtn_document_feedback','axtn_document_learning_candidates'));
    END IF;
  ELSE
    IF TG_OP<>'INSERT' THEN
      protected := OLD.name IN ('axtn_document_feedback','axtn_document_learning_candidates') OR EXISTS(
        SELECT 1 FROM user_data_rows WHERE table_id=OLD.id
          AND row ?| ARRAY['document_feedback','document_learning_candidate']);
    END IF;
    IF TG_OP<>'DELETE' THEN
      protected := protected OR NEW.name IN ('axtn_document_feedback','axtn_document_learning_candidates');
    END IF;
  END IF;
  IF protected AND current_user<>'postgres'
  THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_NATIVE_CONTRACT_REQUIRED'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb)
  RENAME TO axtn_local_table_upsert_before_candidate;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert_before_candidate(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_local_table_upsert(
  _user_id uuid,_table_name text,_key_column text,_key_value text,_row jsonb
) RETURNS TABLE(table_id uuid,row_id bigint,outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF _table_name='axtn_document_learning_candidates' OR _row ? 'document_learning_candidate'
    OR EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=_user_id AND t.name=_table_name AND r.row->>_key_column=_key_value
        AND r.row ? 'document_learning_candidate')
  THEN RAISE EXCEPTION 'DOCUMENT_LEARNING_NATIVE_CONTRACT_REQUIRED'; END IF;
  RETURN QUERY SELECT * FROM axtn_local_table_upsert_before_candidate(
    _user_id,_table_name,_key_column,_key_value,_row);
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb) TO service_role;

ALTER FUNCTION public.axtn_case_document(uuid,text,jsonb) RENAME TO axtn_case_document_before_candidate;
REVOKE ALL ON FUNCTION public.axtn_case_document_before_candidate(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_case_document(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE work jsonb; candidate jsonb; manifest jsonb; baseline jsonb; prior jsonb; event jsonb;
  child jsonb; ref jsonb; field text; dataset uuid; key text;
  principal jsonb:=p_payload->'_principal';
BEGIN
  IF p_operation NOT IN ('document_candidate','document_candidates') THEN
    RETURN axtn_case_document_before_candidate(p_user_id,p_operation,p_payload);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text,0));
  PERFORM axtn_case_document_before_candidate(p_user_id,'document_proposals',
    jsonb_build_object('caseId',p_payload->>'caseId','_principal',principal));
  SELECT r.row INTO work FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=p_user_id AND t.name='axtn_cases' AND r.row->>'source_kind'='document_work'
      AND r.row->>'case_id'=p_payload->>'caseId';
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=p_user_id AND name='axtn_document_learning_candidates';
  IF p_operation='document_candidates' THEN
    RETURN (SELECT COALESCE(jsonb_agg(row ORDER BY id),'[]'::jsonb)
      FROM user_data_rows WHERE table_id=dataset AND row->>'case_id'=work->>'case_id');
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR p_payload - ARRAY[
    'schemaVersion','candidateId','caseId','decisionId','decisionRevision','attemptId','inputHash',
    'baseline','feedback','hypothesis','risks','testProfile','changeManifest','evidence','candidateRevision','actorRef','_principal']<>'{}'::jsonb
    OR p_payload->>'schemaVersion' IS DISTINCT FROM 'document-learning-candidate-v1'
    OR COALESCE(p_payload->>'hypothesis','') NOT IN ('MATCH_TOO_NARROW','MATCH_TOO_BROAD',
      'FAMILY_MAPPING_WRONG','TARGET_MAPPING_WRONG','TAXONOMY_DRIFT')
  THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_REGISTERED_CONTRACT_REQUIRED'; END IF;
  FOREACH field IN ARRAY ARRAY['candidateId','caseId','decisionId','attemptId'] LOOP
    IF jsonb_typeof(p_payload->field) IS DISTINCT FROM 'string'
      OR p_payload->>field !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_IDENTITY_REQUIRED'; END IF;
  END LOOP;
  FOREACH field IN ARRAY ARRAY['decisionRevision','inputHash','candidateRevision'] LOOP
    IF jsonb_typeof(p_payload->field) IS DISTINCT FROM 'string' OR p_payload->>field !~ '^[a-f0-9]{64}$'
    THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_REVISION_REQUIRED'; END IF;
  END LOOP;
  manifest:=p_payload->'changeManifest'; baseline:=p_payload->'baseline';
  IF jsonb_typeof(manifest) IS DISTINCT FROM 'object' OR manifest - ARRAY[
    'schemaVersion','patternId','patternRevision','conditionChanges','family','targetId','sourceKind','operation','enabled']<>'{}'::jsonb
    OR manifest->>'schemaVersion' IS DISTINCT FROM 'document-rule-change-v1'
    OR manifest->'enabled' IS DISTINCT FROM 'false'::jsonb
    OR manifest->>'operation' IS DISTINCT FROM 'CLASSIFY'
    OR COALESCE(manifest->>'sourceKind','') NOT IN ('drive','mail','fixture')
    OR jsonb_typeof(manifest->'patternId') IS DISTINCT FROM 'string'
    OR manifest->>'patternId' !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR jsonb_typeof(manifest->'patternRevision') IS DISTINCT FROM 'string'
    OR manifest->>'patternRevision' !~ '^[a-f0-9]{64}$'
    OR jsonb_typeof(manifest->'family') IS DISTINCT FROM 'string'
    OR manifest->>'family' !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'
    OR NOT (manifest ? 'targetId') OR (manifest->'targetId'<>'null'::jsonb AND (
      jsonb_typeof(manifest->'targetId')<>'string' OR manifest->>'targetId' !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'))
    OR jsonb_typeof(manifest->'conditionChanges') IS DISTINCT FROM 'array'
    OR jsonb_array_length(manifest->'conditionChanges') NOT BETWEEN 1 AND 32
  THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_BOUNDED_MANIFEST_REQUIRED'; END IF;
  FOR ref IN SELECT value FROM jsonb_array_elements(manifest->'conditionChanges') LOOP
    IF jsonb_typeof(ref) IS DISTINCT FROM 'object' OR ref-ARRAY['index','matchMode','maxDeviationPercent']<>'{}'::jsonb
      OR jsonb_typeof(ref->'index') IS DISTINCT FROM 'number' OR ref->>'index' !~ '^[0-9]+$'
      OR (ref->>'index')::numeric NOT BETWEEN 0 AND 31
      OR COALESCE(ref->>'matchMode','') NOT IN ('exact','fuzzy')
      OR jsonb_typeof(ref->'maxDeviationPercent') IS DISTINCT FROM 'number'
      OR (ref->>'maxDeviationPercent')::numeric NOT BETWEEN 0 AND 100
    THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_BOUNDED_MANIFEST_REQUIRED'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT value->>'index') FROM jsonb_array_elements(manifest->'conditionChanges'))
    <>jsonb_array_length(manifest->'conditionChanges')
  THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_BOUNDED_MANIFEST_REQUIRED'; END IF;
  IF jsonb_typeof(baseline) IS DISTINCT FROM 'object' OR baseline-ARRAY['kind','repository','id','revision']<>'{}'::jsonb
    OR baseline->>'kind' IS DISTINCT FROM 'repository' OR baseline->>'repository' IS DISTINCT FROM 'aXtn/aXtn-agentswarms'
    OR jsonb_typeof(baseline->'id') IS DISTINCT FROM 'string' OR length(baseline->>'id') NOT BETWEEN 1 AND 500
    OR baseline->>'id' !~ '^[A-Za-z0-9_./-]+$' OR baseline->>'id' LIKE '/%'
    OR '..'=ANY(string_to_array(baseline->>'id','/'))
    OR jsonb_typeof(baseline->'revision') IS DISTINCT FROM 'string' OR baseline->>'revision' !~ '^[a-f0-9]{40}$'
    OR jsonb_typeof(p_payload->'feedback') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'feedback') NOT BETWEEN 1 AND 50
    OR jsonb_typeof(p_payload->'evidence') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'evidence') NOT BETWEEN 1 AND 50
  THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_PROVENANCE_REQUIRED'; END IF;
  ref:=p_payload->'testProfile';
  IF jsonb_typeof(ref) IS DISTINCT FROM 'object' OR ref-ARRAY['kind','repository','id','revision']<>'{}'::jsonb
    OR ref->>'kind' IS DISTINCT FROM 'contract' OR ref->>'repository' IS DISTINCT FROM 'aXtn/aXtn-agentswarms'
    OR jsonb_typeof(ref->'id') IS DISTINCT FROM 'string' OR length(ref->>'id') NOT BETWEEN 1 AND 500
    OR ref->>'id' !~ '^[A-Za-z0-9_./-]+$' OR ref->>'id' LIKE '/%'
    OR '..'=ANY(string_to_array(ref->>'id','/'))
    OR jsonb_typeof(ref->'revision') IS DISTINCT FROM 'string' OR ref->>'revision' !~ '^[a-f0-9]{40}$'
    OR jsonb_typeof(p_payload->'risks') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'risks') NOT BETWEEN 1 AND 4
  THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_TEST_PROFILE_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'risks') item
    WHERE jsonb_typeof(item) IS DISTINCT FROM 'string' OR item #>> '{}' NOT IN (
      'FAMILY_REGRESSION','WRONG_TARGET','PRIVACY_LEAKAGE','SOURCE_SCOPE_DRIFT'))
    OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(p_payload->'risks'))
      <>jsonb_array_length(p_payload->'risks')
  THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_TEST_PROFILE_REQUIRED'; END IF;
  FOR ref IN SELECT value FROM jsonb_array_elements(p_payload->'evidence') LOOP
    IF jsonb_typeof(ref) IS DISTINCT FROM 'object' OR ref-ARRAY['kind','repository','id','revision']<>'{}'::jsonb
      OR COALESCE(ref->>'kind','') NOT IN ('repository','issue','pull_request','run','evidence','contract')
      OR jsonb_typeof(ref->'repository') IS DISTINCT FROM 'string' OR ref->>'repository' !~ '^aXtn/[A-Za-z0-9._-]+$'
      OR jsonb_typeof(ref->'id') IS DISTINCT FROM 'string' OR length(ref->>'id') NOT BETWEEN 1 AND 500
      OR (ref ? 'revision' AND (jsonb_typeof(ref->'revision')<>'string' OR ref->>'revision' !~ '^[a-f0-9]{40,64}$'))
      OR (CASE WHEN ref->>'kind' IN ('issue','pull_request') THEN ref->>'id' !~ '^[1-9][0-9]*$'
        WHEN ref->>'kind'='run' THEN ref->>'id' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
        ELSE ref->>'id' !~ '^[A-Za-z0-9_./-]+$' OR ref->>'id' LIKE '/%'
          OR '..'=ANY(string_to_array(ref->>'id','/')) END)
    THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_MINIMIZED_EVIDENCE_REQUIRED'; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'evidence') item WHERE item->>'kind'='evidence')
  THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_MINIMIZED_EVIDENCE_REQUIRED'; END IF;
  candidate:=p_payload-ARRAY['_principal','actorRef','candidateRevision'];
  SELECT row INTO prior FROM user_data_rows WHERE table_id=dataset AND row->>'candidate_id'=candidate->>'candidateId';
  IF prior IS NOT NULL THEN
    IF prior->'document_learning_candidate' IS DISTINCT FROM candidate
      OR prior->'principal' IS DISTINCT FROM principal OR prior->>'revision' IS DISTINCT FROM p_payload->>'candidateRevision'
    THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_IMMUTABLE'; END IF;
    RETURN prior;
  END IF;
  IF work->>'case_type' IS DISTINCT FROM 'DOCUMENT_PROCESSING'
    OR work->>'attempt_id' IS DISTINCT FROM candidate->>'attemptId'
    OR work->>'input_hash' IS DISTINCT FROM candidate->>'inputHash'
    OR work->'actor_principal' IS DISTINCT FROM principal
    OR manifest->>'sourceKind' IS DISTINCT FROM work->'document_input'->>'sourceKind'
  THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_CURRENT_CASE_SCOPE_REQUIRED'; END IF;
  IF work->'document_input'->>'privacyStatus' IS DISTINCT FROM 'ELIGIBLE'
    OR work->>'verified_privacy_status' IS DISTINCT FROM 'ELIGIBLE'
    OR COALESCE(work->>'privacy_evidence_revision','') !~ '^[a-f0-9]{64}$'
    OR work->>'privacy_evidence_revision' IS DISTINCT FROM work->'document_input'->>'privacyRevision'
  THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_PROTECTED_PRIVACY_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM user_data_rows feedback_tip
    JOIN user_data_tables feedback_dataset ON feedback_dataset.id=feedback_tip.table_id
    WHERE feedback_dataset.user_id=p_user_id AND feedback_dataset.name='axtn_document_feedback'
      AND feedback_tip.row->'verified'='true'::jsonb
      AND feedback_tip.row->>'case_id'=work->>'case_id'
      AND feedback_tip.row->'document_feedback'->>'decisionId'=candidate->>'decisionId'
      AND feedback_tip.row->'document_feedback'->>'decisionRevision'=candidate->>'decisionRevision'
      AND feedback_tip.row->'document_feedback'->>'inputHash'=work->>'input_hash'
      AND NOT EXISTS(SELECT 1 FROM user_data_rows successor
        WHERE successor.table_id=feedback_tip.table_id
          AND successor.row->'document_feedback'->>'supersedesEventId'=feedback_tip.row->>'feedback_id')
      AND feedback_tip.row->'document_feedback'->'after'
        IS DISTINCT FROM jsonb_build_object('family',manifest->'family','targetId',manifest->'targetId'))
  THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_CONFIRMED_ASSIGNMENT_CONFLICT'; END IF;
  IF (SELECT count(DISTINCT value->>'eventId') FROM jsonb_array_elements(candidate->'feedback'))
    <>jsonb_array_length(candidate->'feedback')
  THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_VERIFIED_FEEDBACK_REQUIRED'; END IF;
  FOR ref IN SELECT value FROM jsonb_array_elements(candidate->'feedback') LOOP
    IF jsonb_typeof(ref) IS DISTINCT FROM 'object' OR ref-ARRAY['eventId','revision']<>'{}'::jsonb
      OR jsonb_typeof(ref->'eventId') IS DISTINCT FROM 'string'
      OR ref->>'eventId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
      OR jsonb_typeof(ref->'revision') IS DISTINCT FROM 'string' OR ref->>'revision' !~ '^[a-f0-9]{64}$'
    THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_VERIFIED_FEEDBACK_REQUIRED'; END IF;
    SELECT r.row INTO event FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=p_user_id AND t.name='axtn_document_feedback' AND r.row->>'feedback_id'=ref->>'eventId';
    IF event IS NULL OR event->'verified' IS DISTINCT FROM 'true'::jsonb
      OR event->>'revision' IS DISTINCT FROM ref->>'revision' OR event->>'case_id' IS DISTINCT FROM work->>'case_id'
      OR event->'document_feedback'->>'decisionId' IS DISTINCT FROM candidate->>'decisionId'
      OR event->'document_feedback'->>'decisionRevision' IS DISTINCT FROM candidate->>'decisionRevision'
      OR event->'document_feedback'->>'inputHash' IS DISTINCT FROM work->>'input_hash'
      OR event->'document_feedback'->>'sourceRevision' IS DISTINCT FROM work->'document_input'->>'sourceRevision'
      OR manifest->'family' IS DISTINCT FROM event->'document_feedback'->'after'->'family'
      OR manifest->'targetId' IS DISTINCT FROM event->'document_feedback'->'after'->'targetId'
      OR EXISTS(SELECT 1 FROM user_data_rows WHERE table_id IN(
        SELECT id FROM user_data_tables WHERE user_id=p_user_id AND name='axtn_document_feedback')
          AND row->'document_feedback'->>'supersedesEventId'=ref->>'eventId')
      OR NOT EXISTS(SELECT 1 FROM jsonb_each(work->'document_decisions_by_operation') pointer
        WHERE pointer.value->>'decisionId'=candidate->>'decisionId'
          AND pointer.value->>'revision'=candidate->>'decisionRevision')
    THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_VERIFIED_FEEDBACK_REQUIRED'; END IF;
  END LOOP;
  key:=encode(extensions.digest(jsonb_build_object(
    'candidate',(candidate-ARRAY['candidateId','attemptId'])||jsonb_build_object(
      'risks',(SELECT jsonb_agg(item ORDER BY item::text) FROM jsonb_array_elements(candidate->'risks') item),
      'evidence',(SELECT jsonb_agg(item ORDER BY item::text) FROM (
        SELECT DISTINCT value AS item FROM jsonb_array_elements(candidate->'evidence')) references_dedup),
      'feedback',(SELECT jsonb_agg(item ORDER BY item->>'eventId') FROM jsonb_array_elements(candidate->'feedback') item),
      'changeManifest',manifest||jsonb_build_object('conditionChanges',
        (SELECT jsonb_agg(item ORDER BY (item->>'index')::integer) FROM jsonb_array_elements(manifest->'conditionChanges') item)))
    )::text,'sha256'),'hex');
  SELECT row INTO prior FROM user_data_rows WHERE table_id=dataset AND row->>'candidate_key'=key;
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  child:=axtn_case_document_before_candidate(p_user_id,'document_ensure',jsonb_build_object(
    'businessRequestId',work->'document_work_identity'->>'businessRequestId',
    'caseType','DOCUMENT_IMPROVEMENT_CANDIDATE','parentCaseId',work->>'case_id','packageKey','learning-'||key,
    'workContractRef',work->'document_work_identity'->'workContractRef',
    'scenarioClass',work->>'scenario_class','scenarioId','learning-'||key,
    'processingMode',CASE WHEN principal->>'kind'='user_session' THEN 'HUMAN' ELSE 'DETERMINISTIC' END,
    'executionChannel',CASE WHEN principal->>'kind'='user_session' THEN 'HUMAN' ELSE 'SWARM' END,
    'inputManifest',work->'document_input','inputHash',work->>'input_hash',
    'deliveryId','candidate:'||key,'references',candidate->'evidence'||jsonb_build_array(baseline),
    '_principal',principal,'actorRef',principal->>'id'));
  IF child->>'status' IS DISTINCT FROM 'NEW'
    OR child->>'case_type' IS DISTINCT FROM 'DOCUMENT_IMPROVEMENT_CANDIDATE'
    OR child->>'parent_case_id' IS DISTINCT FROM work->>'case_id'
  THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_NEW_CHILD_REQUIRED'; END IF;
  IF dataset IS NULL THEN
    INSERT INTO user_data_tables(user_id,name,source_filename,columns,is_sample)
      VALUES(p_user_id,'axtn_document_learning_candidates','aXtn disabled Document Learning Candidates',
        '[{"name":"candidate_id","type":"string"},{"name":"candidate_key","type":"string"},
          {"name":"case_id","type":"string"},{"name":"improvement_case_id","type":"string"},
          {"name":"revision","type":"string"},{"name":"document_learning_candidate","type":"json"},
          {"name":"principal","type":"json"},{"name":"created_at","type":"string"},
          {"name":"status","type":"string"},{"name":"enabled","type":"boolean"}]'::jsonb,false)
      RETURNING id INTO dataset;
  END IF;
  prior:=jsonb_build_object('candidate_id',candidate->>'candidateId','candidate_key',key,
    'case_id',work->>'case_id','improvement_case_id',child->>'case_id','revision',p_payload->>'candidateRevision',
    'document_learning_candidate',candidate,'principal',principal,'created_at',clock_timestamp(),
    'status','NEW','enabled',false);
  INSERT INTO user_data_rows(table_id,row) VALUES(dataset,prior);
  INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
    VALUES(p_user_id,'axtn_work.DOCUMENT_CANDIDATE_CREATED','axtn_case_work',(child->>'case_id')::uuid,
      jsonb_build_object('candidateId',prior->>'candidate_id','candidateRevision',prior->>'revision',
        'parentCaseId',work->>'case_id','principal',principal,'enabled',false,
        'attemptId',work->>'attempt_id','inputHash',work->>'input_hash'));
  RETURN prior;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_document(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_document(uuid,text,jsonb) TO service_role;
