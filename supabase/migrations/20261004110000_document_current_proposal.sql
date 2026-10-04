-- Extend the same registered Case RPC; no new lifecycle or approval store.
ALTER FUNCTION public.axtn_case_document(uuid,text,jsonb)
  RENAME TO axtn_case_document_profile_v1;
REVOKE ALL ON FUNCTION public.axtn_case_document_profile_v1(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.axtn_case_document(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE dataset uuid; row_id public.user_data_rows.id%TYPE;
  work jsonb; prior jsonb; result jsonb; pointer jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text,0));
  IF p_operation='document_propose' OR (p_operation='document_transition'
    AND p_payload->>'processingMode'='SEMANTIC')
  THEN
    SELECT r.id,r.table_id,r.row INTO row_id,dataset,work FROM user_data_rows r
      JOIN user_data_tables t ON t.id=r.table_id WHERE t.user_id=p_user_id
        AND t.name='axtn_cases' AND r.row->>'source_kind'='document_work'
        AND r.row->>'case_id'=p_payload->>'caseId' FOR UPDATE OF r;
    IF work IS NULL THEN RAISE EXCEPTION 'DOCUMENT_OWNED_CASE_REQUIRED'; END IF;
    IF work->>'processing_mode'='HUMAN'
      AND p_payload->'_principal'->>'kind' IS DISTINCT FROM 'user_session'
    THEN RAISE EXCEPTION 'DOCUMENT_HUMAN_TAKEOVER_FENCED'; END IF;
    IF (p_operation='document_transition' OR work->>'processing_mode' IS DISTINCT FROM 'HUMAN'
      OR p_payload->'_principal'->>'kind' IS DISTINCT FROM 'user_session') AND (
      work->>'verified_privacy_status' IS DISTINCT FROM 'ELIGIBLE'
      OR work->'document_input'->>'privacyStatus'='NO_AI'
      OR COALESCE(work->>'privacy_evidence_revision','') !~ '^[a-f0-9]{64}$')
    THEN RAISE EXCEPTION 'DOCUMENT_PROTECTED_PRIVACY_EVIDENCE_REQUIRED'; END IF;
    IF p_operation='document_propose' THEN
      pointer := work->'document_decisions_by_operation'->(p_payload->>'operation');
      SELECT r.row INTO prior FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
        WHERE t.user_id=p_user_id AND t.name='axtn_document_decisions'
          AND r.row->>'decision_id'=p_payload->>'decisionId';
      IF prior IS NOT NULL AND pointer IS NOT NULL
        AND pointer->>'decisionId' IS DISTINCT FROM p_payload->>'decisionId'
      THEN RAISE EXCEPTION 'DOCUMENT_DECISION_SUPERSEDED'; END IF;
    END IF;
  END IF;
  result := axtn_case_document_profile_v1(p_user_id,p_operation,p_payload);
  IF p_operation='document_proposals' THEN
    SELECT r.row INTO work FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=p_user_id AND t.name='axtn_cases'
        AND r.row->>'case_id'=p_payload->>'caseId';
    RETURN (SELECT COALESCE(jsonb_agg(proposal||jsonb_build_object('current',COALESCE(
      work->'document_decisions_by_operation'->(proposal->'document_decision'->>'operation')->>'decisionId'
        =proposal->>'decision_id'
      AND work->'document_decisions_by_operation'->(proposal->'document_decision'->>'operation')->>'revision'
        =proposal->>'revision'
      AND work->>'attempt_id'=proposal->'document_decision'->>'attemptId'
      AND work->>'input_hash'=proposal->'document_decision'->>'inputHash'
      AND work->'actor_principal'=proposal->'principal',false))),'[]'::jsonb)
      FROM jsonb_array_elements(result) proposal);
  END IF;
  IF p_operation='document_propose' THEN
    IF pointer IS DISTINCT FROM jsonb_build_object(
      'decisionId',result->>'decision_id','revision',result->>'revision')
    THEN
      UPDATE user_data_rows SET row=jsonb_set(row,'{document_decisions_by_operation}',
        COALESCE(row->'document_decisions_by_operation','{}'::jsonb)||
          jsonb_build_object(p_payload->>'operation',jsonb_build_object(
            'decisionId',result->>'decision_id','revision',result->>'revision')))
        WHERE id=row_id;
      UPDATE user_data_tables t SET columns=t.columns||jsonb_build_array(
        jsonb_build_object('name','document_decisions_by_operation','type','json'))
        WHERE t.id=dataset AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(t.columns) c
          WHERE c->>'name'='document_decisions_by_operation');
      INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
        VALUES(p_user_id,'axtn_work.DOCUMENT_PROPOSAL_SELECTED','axtn_case_work',
          (work->>'case_id')::uuid,jsonb_build_object(
            'principal',p_payload->'_principal','operation',p_payload->>'operation',
            'processingMode',work->>'processing_mode','executionChannel',work->>'execution_channel',
            'decisionId',result->>'decision_id','decisionRevision',result->>'revision',
            'prior',pointer,'attemptId',work->>'attempt_id','inputHash',work->>'input_hash'));
    END IF;
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_document(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_document(uuid,text,jsonb) TO service_role;

ALTER FUNCTION public.assert_axtn_document_approval(jsonb,uuid,uuid)
  RENAME TO assert_axtn_document_approval_binding_v1;
REVOKE ALL ON FUNCTION public.assert_axtn_document_approval_binding_v1(jsonb,uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.assert_axtn_document_approval(binding jsonb,owner_id uuid,reviewer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE work jsonb; pointer jsonb;
BEGIN
  SELECT r.row INTO work FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=owner_id AND t.name='axtn_cases'
      AND r.row->>'case_id'=binding->>'caseId' FOR SHARE OF r;
  pointer := work->'document_decisions_by_operation'->(binding->>'proposalOperation');
  IF pointer IS NULL OR pointer->>'decisionId' IS DISTINCT FROM binding->>'decisionId'
    OR pointer->>'revision' IS DISTINCT FROM binding->>'decisionRevision'
  THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_CURRENT_DECISION_REQUIRED'; END IF;
  PERFORM assert_axtn_document_approval_binding_v1(binding,owner_id,reviewer_id);
END;
$$;
REVOKE ALL ON FUNCTION public.assert_axtn_document_approval(jsonb,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assert_axtn_document_approval(jsonb,uuid,uuid)
  TO authenticated,service_role;
