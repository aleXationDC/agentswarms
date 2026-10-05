-- Append-only descriptive reports; never privacy, quality or promotion authority.
CREATE UNIQUE INDEX axtn_document_evaluation_identity ON public.user_data_rows
  (table_id,(row->>'evaluation_id')) WHERE row ? 'document_evaluation';
CREATE UNIQUE INDEX axtn_document_evaluation_dedup ON public.user_data_rows
  (table_id,(row->>'evaluation_key')) WHERE row ? 'document_evaluation';

CREATE FUNCTION public.guard_axtn_document_evaluation_storage() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE protected boolean:=false;
BEGIN
  IF TG_TABLE_NAME='user_data_rows' THEN
    IF TG_OP<>'INSERT' THEN
      protected:=OLD.row ? 'document_evaluation' OR EXISTS(
        SELECT 1 FROM user_data_tables WHERE id=OLD.table_id AND name='axtn_document_evaluations');
    END IF;
    IF TG_OP<>'DELETE' THEN
      protected:=protected OR NEW.row ? 'document_evaluation' OR EXISTS(
        SELECT 1 FROM user_data_tables WHERE id=NEW.table_id AND name='axtn_document_evaluations');
    END IF;
  ELSE
    IF TG_OP<>'INSERT' THEN
      protected:=OLD.name='axtn_document_evaluations' OR EXISTS(
        SELECT 1 FROM user_data_rows WHERE table_id=OLD.id AND row ? 'document_evaluation');
    END IF;
    IF TG_OP<>'DELETE' THEN protected:=protected OR NEW.name='axtn_document_evaluations'; END IF;
  END IF;
  IF protected AND current_user<>'postgres'
  THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_NATIVE_CONTRACT_REQUIRED'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_axtn_document_evaluation_rows BEFORE INSERT OR UPDATE OR DELETE
  ON public.user_data_rows FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_document_evaluation_storage();
CREATE TRIGGER protect_axtn_document_evaluation_datasets BEFORE INSERT OR UPDATE OR DELETE
  ON public.user_data_tables FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_document_evaluation_storage();

ALTER FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb)
  RENAME TO axtn_local_table_upsert_before_evaluation;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert_before_evaluation(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_local_table_upsert(
  _user_id uuid,_table_name text,_key_column text,_key_value text,_row jsonb
) RETURNS TABLE(table_id uuid,row_id bigint,outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF _table_name='axtn_document_evaluations' OR _row ? 'document_evaluation'
    OR EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=_user_id AND t.name=_table_name AND r.row->>_key_column=_key_value
        AND r.row ? 'document_evaluation')
  THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_NATIVE_CONTRACT_REQUIRED'; END IF;
  RETURN QUERY SELECT * FROM axtn_local_table_upsert_before_evaluation(
    _user_id,_table_name,_key_column,_key_value,_row);
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb) TO service_role;

ALTER FUNCTION public.axtn_case_document(uuid,text,jsonb) RENAME TO axtn_case_document_before_evaluation;
REVOKE ALL ON FUNCTION public.axtn_case_document_before_evaluation(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_case_document(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE work jsonb; candidate_record jsonb; report jsonb; prior jsonb; metric jsonb; family_metric jsonb;
  ref_item jsonb; field text; side text; dataset uuid; stable_report jsonb; key text;
  principal jsonb:=p_payload->'_principal';
BEGIN
  IF p_operation NOT IN ('document_evaluation','document_evaluations') THEN
    RETURN axtn_case_document_before_evaluation(p_user_id,p_operation,p_payload);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text,0));
  PERFORM axtn_case_document_before_evaluation(p_user_id,'document_candidates',
    jsonb_build_object('caseId',p_payload->>'caseId','_principal',principal));
  SELECT r.row INTO work FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=p_user_id AND t.name='axtn_cases' AND r.row->>'case_id'=p_payload->>'caseId'
      AND r.row->>'source_kind'='document_work';
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=p_user_id AND name='axtn_document_evaluations';
  IF p_operation='document_evaluations' THEN
    RETURN (SELECT COALESCE(jsonb_agg(row ORDER BY id),'[]'::jsonb)
      FROM user_data_rows WHERE table_id=dataset AND row->>'case_id'=work->>'case_id');
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR p_payload-ARRAY[
    'evaluationId','candidateRevision','attemptId','inputHash','evaluation','caseId',
    'evaluationRevision','actorRef','_principal']<>'{}'::jsonb
  THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_REGISTERED_CONTRACT_REQUIRED'; END IF;
  FOREACH field IN ARRAY ARRAY['evaluationId','attemptId','caseId'] LOOP
    IF jsonb_typeof(p_payload->field) IS DISTINCT FROM 'string'
      OR p_payload->>field !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
    THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_IDENTITY_REQUIRED'; END IF;
  END LOOP;
  FOREACH field IN ARRAY ARRAY['candidateRevision','inputHash','evaluationRevision'] LOOP
    IF jsonb_typeof(p_payload->field) IS DISTINCT FROM 'string' OR p_payload->>field !~ '^[a-f0-9]{64}$'
    THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_REVISION_REQUIRED'; END IF;
  END LOOP;
  report:=p_payload->'evaluation';
  IF jsonb_typeof(report) IS DISTINCT FROM 'object' OR report-ARRAY[
    'schemaVersion','candidateId','caseId','baselineSHA','candidateSHA','evaluatorRevision',
    'datasetRevision','splitRevision','featureSchemaRevision','vocabularyRevision','baselineRuleRevision',
    'candidateRuleRevision','evaluatedSplit','authority','baseline','candidate','hardGates','verdict',
    'promotionAuthorized','evidence']<>'{}'::jsonb
    OR report->>'schemaVersion' IS DISTINCT FROM 'document-evaluation-evidence-v1'
    OR report->>'caseId' IS DISTINCT FROM work->>'case_id'
    OR report->>'authority' IS DISTINCT FROM 'UNATTESTED_MINIMIZED_INPUT'
    OR report->'promotionAuthorized' IS DISTINCT FROM 'false'::jsonb
    OR report->>'evaluatedSplit' IS DISTINCT FROM 'test'
    OR COALESCE(report->>'verdict','') NOT IN ('FAIL','REVIEW_REQUIRED')
    OR jsonb_typeof(report->'candidateId') IS DISTINCT FROM 'string'
    OR report->>'candidateId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_UNATTESTED_CONTRACT_REQUIRED'; END IF;
  FOREACH field IN ARRAY ARRAY['baselineSHA','candidateSHA','evaluatorRevision','datasetRevision',
    'splitRevision','featureSchemaRevision','vocabularyRevision','baselineRuleRevision','candidateRuleRevision'] LOOP
    IF jsonb_typeof(report->field) IS DISTINCT FROM 'string' OR report->>field !~
      (CASE WHEN field IN ('baselineSHA','candidateSHA') THEN '^[a-f0-9]{40}$' ELSE '^[a-f0-9]{64}$' END)
    THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_REVISION_REQUIRED'; END IF;
  END LOOP;
  FOREACH side IN ARRAY ARRAY['baseline','candidate'] LOOP
    metric:=report->side;
    IF jsonb_typeof(metric) IS DISTINCT FROM 'object' OR metric-ARRAY[
      'families','sampleCount','macroF1','accuracy','uncertainty','severeWrongTargetCount','abstentionCount',
      'elapsedMs','modelCalls','providerWrites','monetaryCost']<>'{}'::jsonb
      OR metric->>'uncertainty' IS DISTINCT FROM 'BINOMIAL_UNADJUSTED_FOR_WITHIN_SPLIT_GROUPING'
      OR metric->'modelCalls' IS DISTINCT FROM '0'::jsonb OR metric->'providerWrites' IS DISTINCT FROM '0'::jsonb
      OR metric->'monetaryCost' IS DISTINCT FROM 'null'::jsonb
      OR jsonb_typeof(metric->'families') IS DISTINCT FROM 'array'
      OR jsonb_array_length(metric->'families') NOT BETWEEN 1 AND 65
    THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_MINIMIZED_METRICS_REQUIRED'; END IF;
    FOREACH field IN ARRAY ARRAY['sampleCount','severeWrongTargetCount','abstentionCount'] LOOP
      IF jsonb_typeof(metric->field) IS DISTINCT FROM 'number' OR metric->>field !~ '^[0-9]+$'
        OR (metric->>field)::numeric NOT BETWEEN 0 AND 256
      THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_MINIMIZED_METRICS_REQUIRED'; END IF;
    END LOOP;
    FOREACH field IN ARRAY ARRAY['macroF1','accuracy','elapsedMs'] LOOP
      IF jsonb_typeof(metric->field) IS DISTINCT FROM 'number' OR (metric->>field)::numeric<0
        OR (field<>'elapsedMs' AND (metric->>field)::numeric>1)
      THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_MINIMIZED_METRICS_REQUIRED'; END IF;
    END LOOP;
    FOR family_metric IN SELECT value FROM jsonb_array_elements(metric->'families') LOOP
      IF jsonb_typeof(family_metric) IS DISTINCT FROM 'object' OR family_metric-ARRAY[
        'family','sampleCount','predictionCount','correctCount','precision','precisionInterval95',
        'severeWrongTargetCount','correctionCount','correctionRate','exceptionCount','exceptionRate',
        'abstentionCount','coverage','estimatedHumanInteractionsPerDocument']<>'{}'::jsonb
        OR NOT(family_metric ? 'family') OR (family_metric->'family'<>'null'::jsonb AND (
          jsonb_typeof(family_metric->'family')<>'string'
          OR family_metric->>'family' !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$'))
      THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_MINIMIZED_METRICS_REQUIRED'; END IF;
      FOREACH field IN ARRAY ARRAY['sampleCount','predictionCount','correctCount','severeWrongTargetCount',
        'correctionCount','exceptionCount','abstentionCount'] LOOP
        IF jsonb_typeof(family_metric->field) IS DISTINCT FROM 'number'
          OR family_metric->>field !~ '^[0-9]+$' OR (family_metric->>field)::numeric NOT BETWEEN 0 AND 256
        THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_MINIMIZED_METRICS_REQUIRED'; END IF;
      END LOOP;
      FOREACH field IN ARRAY ARRAY['precision','correctionRate','exceptionRate','coverage',
        'estimatedHumanInteractionsPerDocument'] LOOP
        IF NOT(family_metric ? field) OR (family_metric->field<>'null'::jsonb AND (
          jsonb_typeof(family_metric->field)<>'number' OR (family_metric->>field)::numeric NOT BETWEEN 0 AND 1))
        THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_MINIMIZED_METRICS_REQUIRED'; END IF;
      END LOOP;
      IF NOT(family_metric ? 'precisionInterval95') OR (family_metric->'precisionInterval95'<>'null'::jsonb AND (
        jsonb_typeof(family_metric->'precisionInterval95')<>'array'
        OR jsonb_array_length(family_metric->'precisionInterval95')<>2))
      THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_MINIMIZED_METRICS_REQUIRED'; END IF;
      IF family_metric->'precisionInterval95'<>'null'::jsonb THEN
        FOR ref_item IN SELECT value FROM jsonb_array_elements(family_metric->'precisionInterval95') LOOP
          IF jsonb_typeof(ref_item)<>'number' OR (ref_item #>> '{}')::numeric NOT BETWEEN 0 AND 1
          THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_MINIMIZED_METRICS_REQUIRED'; END IF;
        END LOOP;
      END IF;
      IF (family_metric->>'correctCount')::numeric>(family_metric->>'predictionCount')::numeric
        OR (family_metric->>'abstentionCount')::numeric>(family_metric->>'sampleCount')::numeric
        OR (family_metric->>'severeWrongTargetCount')::numeric>(family_metric->>'sampleCount')::numeric
        OR (family_metric->>'correctionCount')::numeric>(family_metric->>'sampleCount')::numeric
        OR (family_metric->>'exceptionCount')::numeric>(family_metric->>'sampleCount')::numeric
        OR (family_metric->>'precision')::double precision IS DISTINCT FROM
          ((family_metric->>'correctCount')::double precision/NULLIF((family_metric->>'predictionCount')::double precision,0))
        OR (family_metric->>'coverage')::double precision IS DISTINCT FROM
          (((family_metric->>'sampleCount')::double precision-(family_metric->>'abstentionCount')::double precision)/
            NULLIF((family_metric->>'sampleCount')::double precision,0))
        OR (family_metric->>'correctionRate')::double precision IS DISTINCT FROM
          ((family_metric->>'correctionCount')::double precision/NULLIF((family_metric->>'sampleCount')::double precision,0))
        OR (family_metric->>'exceptionRate')::double precision IS DISTINCT FROM
          ((family_metric->>'exceptionCount')::double precision/NULLIF((family_metric->>'sampleCount')::double precision,0))
        OR (family_metric->'precisionInterval95'<>'null'::jsonb AND (
          (family_metric->>'predictionCount')::numeric=0
          OR (family_metric->'precisionInterval95'->>0)::numeric>(family_metric->'precisionInterval95'->>1)::numeric))
      THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_METRIC_COUNT_CONFLICT'; END IF;
    END LOOP;
    IF (SELECT count(DISTINCT value->'family') FROM jsonb_array_elements(metric->'families'))
      <>jsonb_array_length(metric->'families')
      OR (SELECT sum((value->>'sampleCount')::numeric) FROM jsonb_array_elements(metric->'families'))
        IS DISTINCT FROM (metric->>'sampleCount')::numeric
      OR (SELECT sum((value->>'severeWrongTargetCount')::numeric) FROM jsonb_array_elements(metric->'families'))
        IS DISTINCT FROM (metric->>'severeWrongTargetCount')::numeric
      OR (SELECT sum((value->>'abstentionCount')::numeric) FROM jsonb_array_elements(metric->'families'))
        IS DISTINCT FROM (metric->>'abstentionCount')::numeric
    THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_METRIC_COUNT_CONFLICT'; END IF;
  END LOOP;
  metric:=report->'hardGates';
  IF jsonb_typeof(metric) IS DISTINCT FROM 'object' OR metric-ARRAY[
    'privacyInputContract','rightsInputContract','independentSplit','boundedScope','severeWrongTarget','familyRegression']<>'{}'::jsonb
    OR metric->'privacyInputContract' IS DISTINCT FROM 'true'::jsonb
    OR metric->'rightsInputContract' IS DISTINCT FROM 'true'::jsonb
    OR metric->'independentSplit' IS DISTINCT FROM 'true'::jsonb
    OR metric->'boundedScope' IS DISTINCT FROM 'true'::jsonb
    OR jsonb_typeof(metric->'severeWrongTarget') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(metric->'familyRegression') IS DISTINCT FROM 'boolean'
    OR (report->'baseline'->>'sampleCount')::numeric<1
    OR report->'baseline'->'sampleCount' IS DISTINCT FROM report->'candidate'->'sampleCount'
    OR (metric->>'severeWrongTarget')::boolean IS DISTINCT FROM
      ((report->'candidate'->>'severeWrongTargetCount')::numeric=0)
    OR report->>'verdict' IS DISTINCT FROM (CASE WHEN metric->'severeWrongTarget'='true'::jsonb
      AND metric->'familyRegression'='true'::jsonb THEN 'REVIEW_REQUIRED' ELSE 'FAIL' END)
  THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_GATE_VERDICT_CONFLICT'; END IF;
  IF jsonb_typeof(report->'evidence') IS DISTINCT FROM 'array'
    OR jsonb_array_length(report->'evidence') NOT BETWEEN 1 AND 50
  THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_MINIMIZED_EVIDENCE_REQUIRED'; END IF;
  FOR ref_item IN SELECT value FROM jsonb_array_elements(report->'evidence') LOOP
    IF jsonb_typeof(ref_item) IS DISTINCT FROM 'object' OR ref_item-ARRAY['kind','repository','id','revision']<>'{}'::jsonb
      OR COALESCE(ref_item->>'kind','') NOT IN ('repository','issue','pull_request','run','evidence','contract')
      OR jsonb_typeof(ref_item->'repository') IS DISTINCT FROM 'string'
      OR ref_item->>'repository' !~ '^aXtn/[A-Za-z0-9._-]+$'
      OR jsonb_typeof(ref_item->'id') IS DISTINCT FROM 'string' OR length(ref_item->>'id') NOT BETWEEN 1 AND 500
      OR (ref_item ? 'revision' AND (jsonb_typeof(ref_item->'revision')<>'string' OR ref_item->>'revision' !~ '^[a-f0-9]{40,64}$'))
      OR (CASE WHEN ref_item->>'kind' IN ('issue','pull_request') THEN ref_item->>'id' !~ '^[1-9][0-9]*$'
        WHEN ref_item->>'kind'='run' THEN ref_item->>'id' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
        ELSE ref_item->>'id' !~ '^[A-Za-z0-9_./-]+$' OR ref_item->>'id' LIKE '/%'
          OR '..'=ANY(string_to_array(ref_item->>'id','/')) END)
    THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_MINIMIZED_EVIDENCE_REQUIRED'; END IF;
  END LOOP;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(report->'evidence') item WHERE item->>'kind'='evidence')
  THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_MINIMIZED_EVIDENCE_REQUIRED'; END IF;
  SELECT row INTO prior FROM user_data_rows WHERE table_id=dataset AND row->>'evaluation_id'=p_payload->>'evaluationId';
  IF prior IS NOT NULL THEN
    IF prior->'document_evaluation' IS DISTINCT FROM report OR prior->'principal' IS DISTINCT FROM principal
      OR prior->>'revision' IS DISTINCT FROM p_payload->>'evaluationRevision'
      OR prior->>'candidate_revision' IS DISTINCT FROM p_payload->>'candidateRevision'
      OR prior->>'attempt_id' IS DISTINCT FROM p_payload->>'attemptId'
      OR prior->>'input_hash' IS DISTINCT FROM p_payload->>'inputHash'
    THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_IMMUTABLE'; END IF;
    RETURN prior;
  END IF;
  SELECT r.row INTO candidate_record FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=p_user_id AND t.name='axtn_document_learning_candidates'
      AND r.row->>'candidate_id'=report->>'candidateId';
  IF candidate_record IS NULL OR candidate_record->>'case_id' IS DISTINCT FROM work->>'case_id'
    OR candidate_record->>'revision' IS DISTINCT FROM p_payload->>'candidateRevision'
    OR candidate_record->'document_learning_candidate'->'baseline'->>'revision' IS DISTINCT FROM report->>'baselineSHA'
    OR work->'actor_principal' IS DISTINCT FROM principal OR work->>'attempt_id' IS DISTINCT FROM p_payload->>'attemptId'
    OR work->>'input_hash' IS DISTINCT FROM p_payload->>'inputHash'
    OR candidate_record->'document_learning_candidate'->>'inputHash' IS DISTINCT FROM work->>'input_hash'
  THEN RAISE EXCEPTION 'DOCUMENT_EVALUATION_CURRENT_CANDIDATE_REQUIRED'; END IF;
  -- Revalidate all current Candidate gates without changing its immutable identity.
  PERFORM axtn_case_document_before_evaluation(p_user_id,'document_candidate',
    candidate_record->'document_learning_candidate'||jsonb_build_object(
      'candidateId',gen_random_uuid(),'attemptId',work->>'attempt_id',
      'candidateRevision',candidate_record->>'revision','_principal',principal));
  stable_report:=report||jsonb_build_object('baseline',(report->'baseline')-'elapsedMs',
    'candidate',(report->'candidate')-'elapsedMs',
    'evidence',(SELECT jsonb_agg(item ORDER BY item::text) FROM(
      SELECT DISTINCT value AS item FROM jsonb_array_elements(report->'evidence')) minimized_refs));
  key:=encode(extensions.digest(jsonb_build_object('report',stable_report,
    'candidateRevision',candidate_record->>'revision')::text,'sha256'),'hex');
  SELECT row INTO prior FROM user_data_rows WHERE table_id=dataset AND row->>'evaluation_key'=key;
  IF prior IS NOT NULL THEN RETURN prior; END IF;
  IF dataset IS NULL THEN
    INSERT INTO user_data_tables(user_id,name,source_filename,columns,is_sample)
      VALUES(p_user_id,'axtn_document_evaluations','aXtn unattested minimized Document Evaluations',
        '[{"name":"evaluation_id","type":"string"},{"name":"evaluation_key","type":"string"},
          {"name":"case_id","type":"string"},{"name":"document_evaluation","type":"json"}]'::jsonb,false)
      RETURNING id INTO dataset;
  END IF;
  prior:=jsonb_build_object('evaluation_id',p_payload->>'evaluationId','evaluation_key',key,
    'candidate_id',candidate_record->>'candidate_id','candidate_revision',candidate_record->>'revision',
    'case_id',work->>'case_id','improvement_case_id',candidate_record->>'improvement_case_id',
    'attempt_id',work->>'attempt_id','input_hash',work->>'input_hash',
    'revision',p_payload->>'evaluationRevision','document_evaluation',report,
    'principal',principal,'created_at',clock_timestamp(),'promotion_authorized',false);
  INSERT INTO user_data_rows(table_id,row) VALUES(dataset,prior);
  INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
    VALUES(p_user_id,'axtn_work.DOCUMENT_EVALUATION_RECORDED','axtn_case_work',
      (candidate_record->>'improvement_case_id')::uuid,jsonb_build_object(
        'evaluationId',prior->>'evaluation_id','revision',prior->>'revision',
        'candidateId',candidate_record->>'candidate_id','candidateRevision',candidate_record->>'revision',
        'principal',principal,'attemptId',work->>'attempt_id','inputHash',work->>'input_hash',
        'authority','UNATTESTED_MINIMIZED_INPUT','promotionAuthorized',false));
  RETURN prior;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_document(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_document(uuid,text,jsonb) TO service_role;
