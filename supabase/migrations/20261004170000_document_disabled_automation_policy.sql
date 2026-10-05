-- Disabled immutable drafts only: no activation pointer or execution authority.
CREATE UNIQUE INDEX axtn_document_policy_identity ON public.user_data_rows
  (table_id,(row->>'policy_id')) WHERE row ? 'document_automation_policy';
CREATE UNIQUE INDEX axtn_document_policy_dedup ON public.user_data_rows
  (table_id,(row->>'policy_key')) WHERE row ? 'document_automation_policy';

CREATE FUNCTION public.guard_axtn_document_policy_storage() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE protected boolean:=false;
BEGIN
  IF TG_TABLE_NAME='user_data_rows' THEN
    IF TG_OP<>'INSERT' THEN
      protected:=OLD.row ? 'document_automation_policy' OR EXISTS(
        SELECT 1 FROM user_data_tables WHERE id=OLD.table_id AND name='axtn_document_automation_policies');
    END IF;
    IF TG_OP<>'DELETE' THEN
      protected:=protected OR NEW.row ? 'document_automation_policy' OR EXISTS(
        SELECT 1 FROM user_data_tables WHERE id=NEW.table_id AND name='axtn_document_automation_policies');
    END IF;
  ELSE
    IF TG_OP<>'INSERT' THEN
      protected:=OLD.name='axtn_document_automation_policies' OR EXISTS(
        SELECT 1 FROM user_data_rows WHERE table_id=OLD.id AND row ? 'document_automation_policy');
    END IF;
    IF TG_OP<>'DELETE' THEN protected:=protected OR NEW.name='axtn_document_automation_policies'; END IF;
  END IF;
  IF protected AND current_user<>'postgres'
  THEN RAISE EXCEPTION 'DOCUMENT_POLICY_NATIVE_CONTRACT_REQUIRED'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_axtn_document_policy_rows BEFORE INSERT OR UPDATE OR DELETE
  ON public.user_data_rows FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_document_policy_storage();
CREATE TRIGGER protect_axtn_document_policy_datasets BEFORE INSERT OR UPDATE OR DELETE
  ON public.user_data_tables FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_document_policy_storage();

ALTER FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb)
  RENAME TO axtn_local_table_upsert_before_policy;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert_before_policy(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_local_table_upsert(
  _user_id uuid,_table_name text,_key_column text,_key_value text,_row jsonb
) RETURNS TABLE(table_id uuid,row_id bigint,outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF _table_name='axtn_document_automation_policies' OR _row ? 'document_automation_policy'
    OR EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=_user_id AND t.name=_table_name AND r.row->>_key_column=_key_value
        AND r.row ? 'document_automation_policy')
  THEN RAISE EXCEPTION 'DOCUMENT_POLICY_NATIVE_CONTRACT_REQUIRED'; END IF;
  RETURN QUERY SELECT * FROM axtn_local_table_upsert_before_policy(
    _user_id,_table_name,_key_column,_key_value,_row);
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb) TO service_role;

ALTER FUNCTION public.axtn_case_document(uuid,text,jsonb) RENAME TO axtn_case_document_before_policy;
REVOKE ALL ON FUNCTION public.axtn_case_document_before_policy(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_case_document(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE work jsonb; candidate_record jsonb; evaluation_record jsonb; policy jsonb; prior jsonb;
  ref_item jsonb; field text; dataset uuid; stable_policy jsonb; key text; columns_required jsonb;
  principal jsonb:=p_payload->'_principal';
BEGIN
  IF p_operation NOT IN ('document_policy','document_policies') THEN
    RETURN axtn_case_document_before_policy(p_user_id,p_operation,p_payload);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text,0));
  PERFORM axtn_case_document_before_policy(p_user_id,'document_candidates',
    jsonb_build_object('caseId',p_payload->>'caseId','_principal',principal));
  SELECT r.row INTO work FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=p_user_id AND t.name='axtn_cases' AND r.row->>'case_id'=p_payload->>'caseId'
      AND r.row->>'source_kind'='document_work';
  SELECT id INTO dataset FROM user_data_tables
    WHERE user_id=p_user_id AND name='axtn_document_automation_policies';
  IF p_operation='document_policies' THEN
    RETURN (SELECT COALESCE(jsonb_agg(row ORDER BY id),'[]'::jsonb)
      FROM user_data_rows WHERE table_id=dataset AND row->>'case_id'=work->>'case_id');
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR p_payload-ARRAY[
    'policy','attemptId','inputHash','caseId','policyRevision','actorRef','_principal']<>'{}'::jsonb
  THEN RAISE EXCEPTION 'DOCUMENT_POLICY_REGISTERED_CONTRACT_REQUIRED'; END IF;
  FOREACH field IN ARRAY ARRAY['attemptId','caseId'] LOOP
    IF jsonb_typeof(p_payload->field) IS DISTINCT FROM 'string'
      OR p_payload->>field !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    THEN RAISE EXCEPTION 'DOCUMENT_POLICY_IDENTITY_REQUIRED'; END IF;
  END LOOP;
  FOREACH field IN ARRAY ARRAY['inputHash','policyRevision'] LOOP
    IF jsonb_typeof(p_payload->field) IS DISTINCT FROM 'string' OR p_payload->>field !~ '^[a-f0-9]{64}$'
    THEN RAISE EXCEPTION 'DOCUMENT_POLICY_REVISION_REQUIRED'; END IF;
  END LOOP;
  policy:=p_payload->'policy';
  IF jsonb_typeof(policy) IS DISTINCT FROM 'object' OR NOT(policy ?& ARRAY[
    'schemaVersion','policyId','caseId','candidateId','candidateRevision','evaluationId',
    'evaluationRevision','family','sourceKind','targetId','operation','ruleRevision','qualityProfile',
    'reviewTriggers','validFrom','validUntil','promotionCaseId','authority','enabled','evidence'])
    OR policy-ARRAY['schemaVersion','policyId','caseId','candidateId','candidateRevision','evaluationId',
      'evaluationRevision','family','sourceKind','targetId','operation','ruleRevision','qualityProfile',
      'reviewTriggers','validFrom','validUntil','promotionCaseId','authority','enabled','evidence']<>'{}'::jsonb
    OR policy->>'schemaVersion' IS DISTINCT FROM 'document-automation-policy-v1'
    OR policy->>'caseId' IS DISTINCT FROM work->>'case_id'
    OR policy->>'authority' IS DISTINCT FROM 'UNAPPROVED_DISABLED_DRAFT'
    OR policy->'enabled' IS DISTINCT FROM 'false'::jsonb
    OR policy->'promotionCaseId' IS DISTINCT FROM 'null'::jsonb
    OR policy->>'operation' IS DISTINCT FROM 'CLASSIFY'
    OR COALESCE(policy->>'sourceKind','') NOT IN ('drive','mail','fixture')
  THEN RAISE EXCEPTION 'DOCUMENT_POLICY_DISABLED_CONTRACT_REQUIRED'; END IF;
  FOREACH field IN ARRAY ARRAY['policyId','caseId','candidateId','evaluationId'] LOOP
    IF jsonb_typeof(policy->field) IS DISTINCT FROM 'string'
      OR policy->>field !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    THEN RAISE EXCEPTION 'DOCUMENT_POLICY_IDENTITY_REQUIRED'; END IF;
  END LOOP;
  FOREACH field IN ARRAY ARRAY['candidateRevision','evaluationRevision','ruleRevision'] LOOP
    IF jsonb_typeof(policy->field) IS DISTINCT FROM 'string' OR policy->>field !~ '^[a-f0-9]{64}$'
    THEN RAISE EXCEPTION 'DOCUMENT_POLICY_REVISION_REQUIRED'; END IF;
  END LOOP;
  FOREACH field IN ARRAY ARRAY['family','targetId'] LOOP
    IF field='targetId' AND policy->field='null'::jsonb THEN CONTINUE; END IF;
    IF jsonb_typeof(policy->field) IS DISTINCT FROM 'string'
      OR policy->>field !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
    THEN RAISE EXCEPTION 'DOCUMENT_POLICY_CATEGORICAL_SCOPE_REQUIRED'; END IF;
  END LOOP;
  IF jsonb_typeof(policy->'reviewTriggers') IS DISTINCT FROM 'array'
    OR jsonb_array_length(policy->'reviewTriggers')<>7
    OR NOT(policy->'reviewTriggers' @> '["UNKNOWN_FAMILY","AMBIGUOUS_TARGET","SOURCE_RIGHTS_DRIFT",
      "PRIVACY_DRIFT","RULE_DRIFT","QUALITY_DRIFT","HUMAN_OVERRIDE"]'::jsonb)
  THEN RAISE EXCEPTION 'DOCUMENT_POLICY_FAIL_CLOSED_TRIGGERS_REQUIRED'; END IF;
  FOREACH field IN ARRAY ARRAY['validFrom','validUntil'] LOOP
    IF jsonb_typeof(policy->field) IS DISTINCT FROM 'string' OR policy->>field !~
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
    THEN RAISE EXCEPTION 'DOCUMENT_POLICY_VALIDITY_REQUIRED'; END IF;
  END LOOP;
  IF (policy->>'validUntil')::timestamptz<=(policy->>'validFrom')::timestamptz
  THEN RAISE EXCEPTION 'DOCUMENT_POLICY_VALIDITY_REQUIRED'; END IF;
  IF policy->'qualityProfile'<>'null'::jsonb THEN
    ref_item:=policy->'qualityProfile';
    IF jsonb_typeof(ref_item) IS DISTINCT FROM 'object' OR ref_item-ARRAY['kind','repository','id','revision']<>'{}'::jsonb
      OR ref_item->>'kind' IS DISTINCT FROM 'contract'
      OR ref_item->>'repository' IS DISTINCT FROM 'aXtn/aXtn-agentswarms'
      OR jsonb_typeof(ref_item->'revision') IS DISTINCT FROM 'string' OR ref_item->>'revision' !~ '^[a-f0-9]{40}$'
      OR jsonb_typeof(ref_item->'id') IS DISTINCT FROM 'string' OR length(ref_item->>'id') NOT BETWEEN 1 AND 500
      OR ref_item->>'id' !~ '^[A-Za-z0-9_./-]+$' OR ref_item->>'id' LIKE '/%'
      OR '..'=ANY(string_to_array(ref_item->>'id','/'))
    THEN RAISE EXCEPTION 'DOCUMENT_POLICY_QUALITY_REFERENCE_REQUIRED'; END IF;
  END IF;
  IF jsonb_typeof(policy->'evidence') IS DISTINCT FROM 'array'
    OR jsonb_array_length(policy->'evidence') NOT BETWEEN 1 AND 50
  THEN RAISE EXCEPTION 'DOCUMENT_POLICY_MINIMIZED_EVIDENCE_REQUIRED'; END IF;
  FOR ref_item IN SELECT value FROM jsonb_array_elements(policy->'evidence') LOOP
    IF jsonb_typeof(ref_item) IS DISTINCT FROM 'object' OR ref_item-ARRAY['kind','repository','id','revision']<>'{}'::jsonb
      OR COALESCE(ref_item->>'kind','') NOT IN ('issue','pull_request','commit','run','evidence','contract')
      OR COALESCE(ref_item->>'repository','') NOT IN ('aXtn/aXtn-agentswarms','aXtn/aXtn-host','aXtn/aXtn-n8n')
      OR jsonb_typeof(ref_item->'id') IS DISTINCT FROM 'string' OR length(ref_item->>'id') NOT BETWEEN 1 AND 500
      OR (ref_item ? 'revision' AND (jsonb_typeof(ref_item->'revision')<>'string' OR ref_item->>'revision' !~ '^[a-f0-9]{40,64}$'))
      OR (CASE WHEN ref_item->>'kind' IN ('issue','pull_request') THEN ref_item->>'id' !~ '^[1-9][0-9]*$'
        WHEN ref_item->>'kind'='run' THEN ref_item->>'id' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
        ELSE ref_item->>'id' !~ '^[A-Za-z0-9_./-]+$' OR ref_item->>'id' LIKE '/%'
          OR '..'=ANY(string_to_array(ref_item->>'id','/')) END)
    THEN RAISE EXCEPTION 'DOCUMENT_POLICY_MINIMIZED_EVIDENCE_REQUIRED'; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(policy->'evidence') item WHERE item->>'kind'='evidence')
  THEN RAISE EXCEPTION 'DOCUMENT_POLICY_MINIMIZED_EVIDENCE_REQUIRED'; END IF;
  SELECT row INTO prior FROM user_data_rows WHERE table_id=dataset AND row->>'policy_id'=policy->>'policyId';
  IF prior IS NOT NULL THEN
    IF prior->'document_automation_policy' IS DISTINCT FROM policy OR prior->'principal' IS DISTINCT FROM principal
      OR prior->>'revision' IS DISTINCT FROM p_payload->>'policyRevision'
      OR prior->>'attempt_id' IS DISTINCT FROM p_payload->>'attemptId'
      OR prior->>'input_hash' IS DISTINCT FROM p_payload->>'inputHash'
    THEN RAISE EXCEPTION 'DOCUMENT_POLICY_IMMUTABLE'; END IF;
    RETURN prior;
  END IF;
  SELECT r.row INTO candidate_record FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=p_user_id AND t.name='axtn_document_learning_candidates'
      AND r.row->>'candidate_id'=policy->>'candidateId';
  SELECT r.row INTO evaluation_record FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=p_user_id AND t.name='axtn_document_evaluations'
      AND r.row->>'evaluation_id'=policy->>'evaluationId';
  IF candidate_record IS NULL OR evaluation_record IS NULL
    OR candidate_record->>'case_id' IS DISTINCT FROM work->>'case_id'
    OR candidate_record->>'revision' IS DISTINCT FROM policy->>'candidateRevision'
    OR evaluation_record->>'case_id' IS DISTINCT FROM work->>'case_id'
    OR evaluation_record->>'candidate_id' IS DISTINCT FROM policy->>'candidateId'
    OR evaluation_record->>'candidate_revision' IS DISTINCT FROM policy->>'candidateRevision'
    OR evaluation_record->>'revision' IS DISTINCT FROM policy->>'evaluationRevision'
    OR evaluation_record->>'input_hash' IS DISTINCT FROM work->>'input_hash'
    OR work->'actor_principal' IS DISTINCT FROM principal OR work->>'attempt_id' IS DISTINCT FROM p_payload->>'attemptId'
    OR work->>'input_hash' IS DISTINCT FROM p_payload->>'inputHash'
    OR candidate_record->'document_learning_candidate'->'changeManifest'->>'family' IS DISTINCT FROM policy->>'family'
    OR candidate_record->'document_learning_candidate'->'changeManifest'->>'sourceKind' IS DISTINCT FROM policy->>'sourceKind'
    OR candidate_record->'document_learning_candidate'->'changeManifest'->'targetId' IS DISTINCT FROM policy->'targetId'
    OR evaluation_record->'document_evaluation'->>'candidateRuleRevision' IS DISTINCT FROM policy->>'ruleRevision'
  THEN RAISE EXCEPTION 'DOCUMENT_POLICY_CURRENT_CANDIDATE_EVALUATION_REQUIRED'; END IF;
  PERFORM axtn_case_document_before_evaluation(p_user_id,'document_candidate',
    candidate_record->'document_learning_candidate'||jsonb_build_object(
      'candidateId',gen_random_uuid(),'attemptId',work->>'attempt_id',
      'candidateRevision',candidate_record->>'revision','_principal',principal));
  stable_policy:=policy-'policyId'||jsonb_build_object(
    'reviewTriggers',(SELECT jsonb_agg(value ORDER BY value::text) FROM jsonb_array_elements(policy->'reviewTriggers')),
    'evidence',(SELECT jsonb_agg(item ORDER BY item::text) FROM(
      SELECT DISTINCT value AS item FROM jsonb_array_elements(policy->'evidence')) minimized_refs));
  key:=encode(extensions.digest(stable_policy::text,'sha256'),'hex');
  SELECT row INTO prior FROM user_data_rows WHERE table_id=dataset AND row->>'policy_key'=key;
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  columns_required:='[{"name":"policy_id","type":"string"},{"name":"policy_key","type":"string"},
    {"name":"case_id","type":"string"},{"name":"improvement_case_id","type":"string"},
    {"name":"attempt_id","type":"string"},{"name":"input_hash","type":"string"},
    {"name":"revision","type":"string"},{"name":"document_automation_policy","type":"json"},
    {"name":"principal","type":"json"},{"name":"created_at","type":"string"},{"name":"enabled","type":"boolean"}]'::jsonb;
  IF dataset IS NULL THEN
    INSERT INTO user_data_tables(user_id,name,source_filename,columns,is_sample)
      VALUES(p_user_id,'axtn_document_automation_policies','aXtn disabled Document Automation Policies',
        columns_required,false) RETURNING id INTO dataset;
  ELSE
    UPDATE user_data_tables t SET columns=t.columns||COALESCE(
      (SELECT jsonb_agg(column_item) FROM jsonb_array_elements(columns_required) column_item
        WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(t.columns) existing
          WHERE existing->>'name'=column_item->>'name')),'[]'::jsonb) WHERE id=dataset;
  END IF;
  prior:=jsonb_build_object('policy_id',policy->>'policyId','policy_key',key,
    'case_id',work->>'case_id','improvement_case_id',candidate_record->>'improvement_case_id',
    'attempt_id',work->>'attempt_id','input_hash',work->>'input_hash',
    'revision',p_payload->>'policyRevision','document_automation_policy',policy,
    'principal',principal,'created_at',clock_timestamp(),'enabled',false);
  INSERT INTO user_data_rows(table_id,row) VALUES(dataset,prior);
  INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
    VALUES(p_user_id,'axtn_work.DOCUMENT_POLICY_DRAFT_RECORDED','axtn_case_work',
      (candidate_record->>'improvement_case_id')::uuid,jsonb_build_object(
        'policyId',prior->>'policy_id','revision',prior->>'revision',
        'candidateId',policy->>'candidateId','evaluationId',policy->>'evaluationId',
        'principal',principal,'attemptId',work->>'attempt_id','inputHash',work->>'input_hash',
        'authority','UNAPPROVED_DISABLED_DRAFT','enabled',false));
  RETURN prior;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_document(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_document(uuid,text,jsonb) TO service_role;
