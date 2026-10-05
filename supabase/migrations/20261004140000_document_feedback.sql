-- Append-only minimized feedback in the existing owner-bound Dataset/Case seam.
CREATE UNIQUE INDEX axtn_document_feedback_event_identity ON public.user_data_rows
  (table_id,(row->>'feedback_id')) WHERE row ? 'document_feedback';
CREATE UNIQUE INDEX axtn_document_feedback_dedup ON public.user_data_rows
  (table_id,(row->>'feedback_key')) WHERE row ? 'document_feedback';

CREATE FUNCTION public.guard_axtn_document_feedback_storage() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE protected boolean := false;
BEGIN
  IF TG_TABLE_NAME='user_data_rows' THEN
    IF TG_OP<>'INSERT' THEN
      protected := OLD.row ? 'document_feedback' OR EXISTS(
        SELECT 1 FROM user_data_tables WHERE id=OLD.table_id AND name='axtn_document_feedback');
    END IF;
    IF TG_OP<>'DELETE' THEN
      protected := protected OR NEW.row ? 'document_feedback' OR EXISTS(
        SELECT 1 FROM user_data_tables WHERE id=NEW.table_id AND name='axtn_document_feedback');
    END IF;
  ELSE
    IF TG_OP<>'INSERT' THEN
      protected := OLD.name='axtn_document_feedback' OR EXISTS(
        SELECT 1 FROM user_data_rows WHERE table_id=OLD.id AND row ? 'document_feedback');
    END IF;
    IF TG_OP<>'DELETE' THEN protected := protected OR NEW.name='axtn_document_feedback'; END IF;
  END IF;
  IF protected AND current_user<>'postgres'
  THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_NATIVE_CONTRACT_REQUIRED'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_axtn_document_feedback_storage() FROM PUBLIC;
CREATE TRIGGER guard_axtn_document_feedback_rows BEFORE INSERT OR UPDATE OR DELETE
  ON public.user_data_rows FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_document_feedback_storage();
CREATE TRIGGER guard_axtn_document_feedback_datasets BEFORE INSERT OR UPDATE OR DELETE
  ON public.user_data_tables FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_document_feedback_storage();

ALTER FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb)
  RENAME TO axtn_local_table_upsert_before_feedback;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert_before_feedback(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_local_table_upsert(
  _user_id uuid,_table_name text,_key_column text,_key_value text,_row jsonb
) RETURNS TABLE(table_id uuid,row_id bigint,outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF _table_name='axtn_document_feedback' OR _row ? 'document_feedback'
    OR EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=_user_id AND t.name=_table_name AND r.row->>_key_column=_key_value
        AND r.row ? 'document_feedback')
  THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_NATIVE_CONTRACT_REQUIRED'; END IF;
  RETURN QUERY SELECT * FROM axtn_local_table_upsert_before_feedback(
    _user_id,_table_name,_key_column,_key_value,_row);
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb) TO service_role;

ALTER FUNCTION public.axtn_case_document(uuid,text,jsonb)
  RENAME TO axtn_case_document_before_feedback;
REVOKE ALL ON FUNCTION public.axtn_case_document_before_feedback(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_case_document(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  work jsonb; decision jsonb; prior jsonb; predecessor jsonb; result jsonb;
  event jsonb; assignment jsonb; evidence_ref jsonb; field text; dataset uuid;
  principal jsonb := p_payload->'_principal'; key text; stamp timestamptz := clock_timestamp();
BEGIN
  IF p_operation NOT IN ('document_feedback','document_feedback_events') THEN
    RETURN axtn_case_document_before_feedback(p_user_id,p_operation,p_payload);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text,0));
  -- The existing adapter authenticates current owner/key scope and owned Case.
  PERFORM axtn_case_document_before_feedback(p_user_id,'document_proposals',
    jsonb_build_object('caseId',p_payload->>'caseId','_principal',principal));
  SELECT r.row INTO work FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=p_user_id AND t.name='axtn_cases'
      AND r.row->>'source_kind'='document_work' AND r.row->>'case_id'=p_payload->>'caseId';
  SELECT id INTO dataset FROM user_data_tables
    WHERE user_id=p_user_id AND name='axtn_document_feedback';
  IF p_operation='document_feedback_events' THEN
    RETURN (SELECT COALESCE(jsonb_agg(row ORDER BY id),'[]'::jsonb)
      FROM user_data_rows WHERE table_id=dataset AND row->>'case_id'=work->>'case_id');
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR p_payload - ARRAY[
    'schemaVersion','eventId','caseId','decisionId','decisionRevision','attemptId','inputHash',
    'sourceRevision','eventType','before','after','reasonCode','supersedesEventId','evidence',
    'feedbackRevision','actorRef','_principal'] <> '{}'::jsonb
    OR p_payload->>'schemaVersion' IS DISTINCT FROM 'document-feedback-v1'
    OR COALESCE(p_payload->>'eventType','') NOT IN (
      'CORRECTION','EXCEPTION','TAXONOMY_CHANGE','VERIFIED_CORRECT','UNVERIFIED')
    OR COALESCE(p_payload->>'reasonCode','') NOT IN (
      'HUMAN_CONFIRMED','WRONG_FAMILY','WRONG_TARGET','TAXONOMY_CHANGED',
      'SOURCE_EXCEPTION','UNVERIFIED_OBSERVATION')
  THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_REGISTERED_CONTRACT_REQUIRED'; END IF;
  FOREACH field IN ARRAY ARRAY['eventId','caseId','decisionId','attemptId'] LOOP
    IF jsonb_typeof(p_payload->field) IS DISTINCT FROM 'string'
      OR p_payload->>field !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_IDENTITY_REQUIRED'; END IF;
  END LOOP;
  FOREACH field IN ARRAY ARRAY['decisionRevision','inputHash','feedbackRevision'] LOOP
    IF jsonb_typeof(p_payload->field) IS DISTINCT FROM 'string'
      OR p_payload->>field !~ '^[a-f0-9]{64}$'
    THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_REVISION_REQUIRED'; END IF;
  END LOOP;
  IF jsonb_typeof(p_payload->'sourceRevision') IS DISTINCT FROM 'string'
    OR length(p_payload->>'sourceRevision')>500 OR btrim(p_payload->>'sourceRevision')=''
    OR p_payload->>'sourceRevision' ~ '[[:cntrl:]]'
  THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_SOURCE_REVISION_REQUIRED'; END IF;
  FOREACH field IN ARRAY ARRAY['before','after'] LOOP
    assignment := p_payload->field;
    IF jsonb_typeof(assignment) IS DISTINCT FROM 'object'
      OR assignment - ARRAY['family','targetId'] <> '{}'::jsonb
      OR NOT (assignment ? 'family' AND assignment ? 'targetId')
      OR (assignment->'family'<>'null'::jsonb AND (
        jsonb_typeof(assignment->'family')<>'string'
        OR assignment->>'family' !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'))
      OR (assignment->'targetId'<>'null'::jsonb AND (
        jsonb_typeof(assignment->'targetId')<>'string'
        OR assignment->>'targetId' !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'))
    THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_MINIMIZED_ASSIGNMENT_REQUIRED'; END IF;
  END LOOP;
  IF NOT (p_payload ? 'supersedesEventId')
    OR (p_payload->'supersedesEventId'<>'null'::jsonb AND (
      jsonb_typeof(p_payload->'supersedesEventId')<>'string'
      OR p_payload->>'supersedesEventId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'))
    OR p_payload->>'supersedesEventId'=p_payload->>'eventId'
    OR (p_payload->>'eventType'='UNVERIFIED' AND p_payload->'supersedesEventId'<>'null'::jsonb)
    OR (p_payload->>'eventType' IN ('CORRECTION','TAXONOMY_CHANGE')
      AND (p_payload->'supersedesEventId'='null'::jsonb OR p_payload->'before'=p_payload->'after'))
    OR (p_payload->>'eventType' IN ('VERIFIED_CORRECT','UNVERIFIED')
      AND p_payload->'before'<>p_payload->'after')
    OR ((p_payload->>'eventType'='UNVERIFIED') IS DISTINCT FROM
      (p_payload->>'reasonCode'='UNVERIFIED_OBSERVATION'))
  THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_EVENT_SEMANTICS_REQUIRED'; END IF;
  IF jsonb_typeof(p_payload->'evidence') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'evidence') NOT BETWEEN 1 AND 50
  THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_EVIDENCE_REQUIRED'; END IF;
  FOR evidence_ref IN SELECT value FROM jsonb_array_elements(p_payload->'evidence') LOOP
    IF jsonb_typeof(evidence_ref) IS DISTINCT FROM 'object' OR evidence_ref - ARRAY['kind','repository','id','revision']<>'{}'::jsonb
      OR COALESCE(evidence_ref->>'kind','') NOT IN ('repository','issue','pull_request','run','evidence','contract')
      OR jsonb_typeof(evidence_ref->'repository') IS DISTINCT FROM 'string'
      OR evidence_ref->>'repository' !~ '^aXtn/[A-Za-z0-9._-]+$'
      OR jsonb_typeof(evidence_ref->'id') IS DISTINCT FROM 'string' OR length(evidence_ref->>'id') NOT BETWEEN 1 AND 500
      OR (evidence_ref ? 'revision' AND (jsonb_typeof(evidence_ref->'revision')<>'string' OR evidence_ref->>'revision' !~ '^[a-f0-9]{40,64}$'))
      OR (CASE WHEN evidence_ref->>'kind' IN ('issue','pull_request') THEN evidence_ref->>'id' !~ '^[1-9][0-9]*$'
        WHEN evidence_ref->>'kind'='run' THEN evidence_ref->>'id' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
        ELSE evidence_ref->>'id' !~ '^[A-Za-z0-9_./-]+$' OR evidence_ref->>'id' LIKE '/%'
          OR '..'=ANY(string_to_array(evidence_ref->>'id','/')) END)
    THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_MINIMIZED_REFERENCE_REQUIRED'; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'evidence') ref WHERE ref->>'kind'='evidence')
  THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_EVIDENCE_REQUIRED'; END IF;
  IF p_payload->>'eventType'<>'UNVERIFIED' AND principal->>'kind'<>'user_session'
  THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_AUTHENTICATED_HUMAN_REQUIRED'; END IF;
  event := p_payload - ARRAY['_principal','actorRef','feedbackRevision'];
  SELECT row INTO prior FROM user_data_rows WHERE table_id=dataset
    AND row->>'feedback_id'=event->>'eventId';
  IF prior IS NOT NULL THEN
    IF prior->'document_feedback' IS DISTINCT FROM event
      OR prior->'principal' IS DISTINCT FROM principal
      OR prior->>'revision' IS DISTINCT FROM p_payload->>'feedbackRevision'
    THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_IMMUTABLE'; END IF;
    RETURN prior;
  END IF;
  key := encode(extensions.digest(jsonb_build_object(
    'event',(event-ARRAY['eventId','evidence'])||jsonb_build_object('evidence',
      (SELECT jsonb_agg(ref ORDER BY ref::text)
        FROM (SELECT DISTINCT value ref FROM jsonb_array_elements(event->'evidence')) refs)),
    'principal',principal)::text,'sha256'),'hex');
  SELECT row INTO prior FROM user_data_rows WHERE table_id=dataset AND row->>'feedback_key'=key;
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF work->>'attempt_id' IS DISTINCT FROM event->>'attemptId'
    OR work->>'input_hash' IS DISTINCT FROM event->>'inputHash'
    OR work->'document_input'->>'sourceRevision' IS DISTINCT FROM event->>'sourceRevision'
    OR work->'actor_principal' IS DISTINCT FROM principal
  THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_CURRENT_CASE_BINDING_REQUIRED'; END IF;
  SELECT r.row INTO decision FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=p_user_id AND t.name='axtn_document_decisions'
      AND r.row->>'decision_id'=event->>'decisionId' AND r.row->>'case_id'=work->>'case_id';
  IF decision IS NULL OR decision->>'revision' IS DISTINCT FROM event->>'decisionRevision'
    OR decision->'document_decision'->>'attemptId' IS DISTINCT FROM work->>'attempt_id'
    OR decision->'document_decision'->>'inputHash' IS DISTINCT FROM work->>'input_hash'
    OR decision->'document_decision'->>'sourceRevision' IS DISTINCT FROM event->>'sourceRevision'
    OR work->'document_decisions_by_operation'->(decision->'document_decision'->>'operation')->>'decisionId'
      IS DISTINCT FROM event->>'decisionId'
    OR work->'document_decisions_by_operation'->(decision->'document_decision'->>'operation')->>'revision'
      IS DISTINCT FROM event->>'decisionRevision'
  THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_CURRENT_DECISION_REQUIRED'; END IF;
  IF event->'supersedesEventId'<>'null'::jsonb THEN
    SELECT row INTO predecessor FROM user_data_rows WHERE table_id=dataset
      AND row->>'feedback_id'=event->>'supersedesEventId'
      AND row->>'case_id'=work->>'case_id';
    IF predecessor IS NULL
      OR predecessor->'document_feedback'->>'decisionId' IS DISTINCT FROM event->>'decisionId'
      OR predecessor->'document_feedback'->>'decisionRevision' IS DISTINCT FROM event->>'decisionRevision'
      OR predecessor->'document_feedback'->'after' IS DISTINCT FROM event->'before'
      OR predecessor->'document_feedback'->>'eventType'='UNVERIFIED'
      OR EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
        AND row->'document_feedback'->>'supersedesEventId'=event->>'supersedesEventId')
    THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_CONFIRMED_PREDECESSOR_REQUIRED'; END IF;
  ELSIF event->'before' IS DISTINCT FROM jsonb_build_object(
    'family',decision->'document_decision'->'family',
    'targetId',COALESCE(decision->'document_decision'->'target'->'id','null'::jsonb))
  THEN RAISE EXCEPTION 'DOCUMENT_FEEDBACK_CONFIRMED_ASSIGNMENT_REQUIRED'; END IF;
  IF dataset IS NULL THEN
    INSERT INTO user_data_tables(user_id,name,source_filename,columns,is_sample)
      VALUES(p_user_id,'axtn_document_feedback','aXtn minimized Document Feedback',
        '[{"name":"feedback_id","type":"string"},{"name":"feedback_key","type":"string"},
          {"name":"case_id","type":"string"},{"name":"revision","type":"string"},
          {"name":"document_feedback","type":"json"},{"name":"principal","type":"json"},
          {"name":"created_at","type":"string"},{"name":"verified","type":"boolean"}]'::jsonb,false)
      RETURNING id INTO dataset;
  END IF;
  result := jsonb_build_object('feedback_id',event->>'eventId','feedback_key',key,
    'case_id',work->>'case_id','revision',p_payload->>'feedbackRevision',
    'document_feedback',event,'principal',principal,'created_at',stamp,
    'verified',event->>'eventType'<>'UNVERIFIED');
  INSERT INTO user_data_rows(table_id,row) VALUES(dataset,result);
  INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
    VALUES(p_user_id,'axtn_work.DOCUMENT_FEEDBACK_RECORDED','axtn_case_work',
      (work->>'case_id')::uuid,jsonb_build_object(
        'eventId',result->>'feedback_id','feedbackRevision',result->>'revision',
        'decisionId',event->>'decisionId','decisionRevision',event->>'decisionRevision',
        'principal',principal,'attemptId',work->>'attempt_id','inputHash',work->>'input_hash',
        'eventType',event->>'eventType','verified',result->'verified'));
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_document(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_document(uuid,text,jsonb) TO service_role;
