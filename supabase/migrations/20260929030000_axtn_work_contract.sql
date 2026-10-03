-- Native work mutations commit their existing dataset state and audit atomically.
-- Actual database roles, not caller-editable JWT claims, guard generic bypasses.
CREATE FUNCTION public.guard_axtn_work_storage() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE protected boolean := false;
BEGIN
  IF TG_TABLE_NAME='user_data_rows' THEN
    IF TG_OP <> 'INSERT' THEN
      protected := OLD.row->>'source_kind'='development_work' OR OLD.row ? 'work_identity';
    END IF;
    IF TG_OP <> 'DELETE' THEN
      protected := COALESCE(protected,false) OR NEW.row->>'source_kind'='development_work'
        OR NEW.row ? 'work_identity' OR NEW.row->>'case_type' LIKE 'DEVELOPMENT_%';
    END IF;
    IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND OLD.row->>'case_id' IS DISTINCT FROM NEW.row->>'case_id') THEN
      protected := COALESCE(protected,false) OR EXISTS(SELECT 1 FROM user_data_rows child
        WHERE child.table_id=OLD.table_id AND child.row->>'parent_case_id'=OLD.row->>'case_id'
          AND child.row->>'source_kind'='development_work');
    END IF;
  ELSIF TG_TABLE_NAME='user_data_tables' THEN
    protected := EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=OLD.id
      AND (row->>'source_kind'='development_work' OR row ? 'work_identity'));
    IF TG_OP='UPDATE' AND NEW.id=OLD.id AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
      AND NEW.name=OLD.name AND NEW.columns IS NOT DISTINCT FROM OLD.columns
      AND NEW.is_sample IS NOT DISTINCT FROM OLD.is_sample
    THEN protected := false; END IF;
  ELSIF TG_TABLE_NAME='audit_events' THEN
    IF TG_OP <> 'INSERT' THEN protected := OLD.resource_type='axtn_case_work'; END IF;
    IF TG_OP <> 'DELETE' THEN
      protected := COALESCE(protected,false) OR NEW.resource_type='axtn_case_work';
    END IF;
    IF TG_OP='DELETE' AND current_user='service_role'
      AND OLD.created_at < now() - make_interval(days =>
        (SELECT audit_retention_days FROM iam_settings LIMIT 1))
    THEN RETURN OLD; END IF;
  END IF;
  IF COALESCE(protected,false) AND current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Development work requires the native Case contract';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_axtn_work_rows BEFORE INSERT OR UPDATE OR DELETE
  ON public.user_data_rows FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_work_storage();
CREATE TRIGGER guard_axtn_work_datasets BEFORE UPDATE OR DELETE
  ON public.user_data_tables FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_work_storage();
CREATE TRIGGER guard_axtn_work_events BEFORE INSERT OR UPDATE OR DELETE
  ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_work_storage();

-- The existing Local Table broker is SECURITY DEFINER too; it cannot be an
-- alternate route around the native work guard.
ALTER FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb)
  RENAME TO axtn_local_table_upsert_nonwork;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert_nonwork(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_local_table_upsert(
  _user_id uuid,_table_name text,_key_column text,_key_value text,_row jsonb
) RETURNS TABLE(table_id uuid,row_id bigint,outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF _row->>'source_kind'='development_work' OR _row ? 'work_identity'
    OR _row->>'case_type' LIKE 'DEVELOPMENT_%'
    OR EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=_user_id AND t.name=_table_name AND r.row->>_key_column=_key_value
        AND (r.row->>'source_kind'='development_work' OR r.row ? 'work_identity'))
    OR EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=_user_id AND t.name=_table_name AND r.row->>_key_column=_key_value
        AND r.row->>'case_id' IS DISTINCT FROM _row->>'case_id'
        AND EXISTS(SELECT 1 FROM user_data_rows child WHERE child.table_id=r.table_id
          AND child.row->>'parent_case_id'=r.row->>'case_id'
          AND child.row->>'source_kind'='development_work'))
  THEN RAISE EXCEPTION 'Development work requires the native Case contract'; END IF;
  RETURN QUERY SELECT * FROM axtn_local_table_upsert_nonwork(
    _user_id,_table_name,_key_column,_key_value,_row);
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb) TO service_role;

CREATE FUNCTION public.guard_axtn_work_approval() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE native boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' THEN native := OLD.payload ? 'axtnDevelopment'; END IF;
  IF TG_OP <> 'DELETE' THEN native := native OR NEW.payload ? 'axtnDevelopment'; END IF;
  IF NOT native THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='INSERT' THEN
    IF current_user NOT IN ('postgres','service_role') OR NEW.status <> 'pending'
      OR NEW.decided_by IS NOT NULL OR NEW.swarm_run_id IS NULL
    THEN RAISE EXCEPTION 'Native work approvals are server-created pending requests'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Native work approval evidence must be retained'; END IF;
  IF (to_jsonb(NEW) - ARRAY['status','decided_at','decided_by','notified_at'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','decided_at','decided_by','notified_at'])
  THEN RAISE EXCEPTION 'Native work approval binding is immutable'; END IF;
  IF NEW.notified_at IS DISTINCT FROM OLD.notified_at THEN
    IF current_user NOT IN ('postgres','service_role')
    THEN RAISE EXCEPTION 'Native work notification metadata is server-owned'; END IF;
    IF NEW.status=OLD.status AND NEW.decided_by IS NOT DISTINCT FROM OLD.decided_by
      AND NEW.decided_at IS NOT DISTINCT FROM OLD.decided_at
    THEN RETURN NEW; END IF;
  END IF;
  IF OLD.status='pending' AND NEW.status='cancelled'
    AND current_user IN ('postgres','service_role')
  THEN NEW.decided_by := NULL; NEW.decided_at := clock_timestamp(); RETURN NEW; END IF;
  IF current_user <> 'authenticated' OR auth.uid() IS NULL
    OR OLD.status <> 'pending' OR NEW.status NOT IN ('approved','rejected')
  THEN RAISE EXCEPTION 'Native work decisions require the routed authenticated approver'; END IF;
  IF auth.uid() <> OLD.user_id
    AND NOT is_swarm_approver(OLD.approver_user_ids,OLD.approver_group_ids,auth.uid())
  THEN RAISE EXCEPTION 'Native work approver denied'; END IF;
  IF NEW.status='approved' AND EXISTS(
    SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=OLD.user_id AND t.name='axtn_cases'
      AND (r.row->>'case_id'=OLD.payload->'axtnDevelopment'->>'caseId'
        OR (r.row->>'parent_case_id'=OLD.payload->'axtnDevelopment'->>'caseId'
          AND r.row->>'case_type'='DEVELOPMENT_BUILD'))
      AND COALESCE(r.row->'human_builder_ids','[]') ? auth.uid()::text)
  THEN RAISE EXCEPTION 'Human Builder cannot approve its own result'; END IF;
  NEW.decided_by := auth.uid();
  NEW.decided_at := clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_axtn_work_approval BEFORE INSERT OR UPDATE OR DELETE
  ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_work_approval();

ALTER FUNCTION public.axtn_case_work(uuid,text,jsonb) RENAME TO axtn_case_work_bootstrap;
REVOKE ALL ON FUNCTION public.axtn_case_work_bootstrap(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.invalidate_axtn_work_dependents(
  owner_id uuid, dataset_id uuid, changed_case text, cause_key text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE affected jsonb;
BEGIN
  FOR affected IN
    WITH RECURSIVE affected_cases(id) AS (
      SELECT changed_case
      UNION
      SELECT r.row->>'case_id' FROM user_data_rows r JOIN affected_cases a
        ON r.table_id=dataset_id AND (
          EXISTS(SELECT 1 FROM user_data_rows child
            WHERE child.table_id=dataset_id AND child.row->>'case_id'=a.id
              AND child.row->>'parent_case_id'=r.row->>'case_id')
          OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(r.row->'dependencies',
            (SELECT COALESCE(jsonb_agg(jsonb_build_object('caseId',x,'kind','REQUIRES_COMPLETION')),'[]')
             FROM jsonb_array_elements_text(COALESCE(r.row->'required_dependencies','[]')) x))) d
            WHERE d->>'caseId'=a.id AND d->>'kind'<>'INFORMS'))
        WHERE r.row->>'source_kind'='development_work'
    )
    SELECT r.row FROM affected_cases a JOIN user_data_rows r
      ON r.table_id=dataset_id AND r.row->>'case_id'=a.id WHERE a.id<>changed_case
  LOOP
    UPDATE user_data_rows SET row=(row-'checks_sha'-'accepted_sha'-'accepted_approval_id'-'integration_phase') ||
      jsonb_build_object('status',CASE WHEN affected->>'status'='NEW' THEN 'NEW' ELSE 'OPEN' END,
        'closed_at',NULL,'updated_at',clock_timestamp(),
        'status_reason','DEPENDENCY_INVALIDATED')
      WHERE table_id=dataset_id AND row->>'case_id'=affected->>'case_id';
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
      VALUES(owner_id,'axtn_work.DEPENDENCY_INVALIDATED','axtn_case_work',
        (affected->>'case_id')::uuid,jsonb_build_object(
          'transitionKey','invalidate:'||md5(cause_key||':'||(affected->>'case_id')),
          'causeCaseId',changed_case,'causeKey',cause_key));
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_axtn_work_dependents(uuid,uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.axtn_case_work(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
<<native_work>>
DECLARE
  payload jsonb := p_payload - '_principal';
  principal jsonb := COALESCE(p_payload->'_principal',
    jsonb_build_object('kind','legacy_machine','id',p_user_id));
  dataset uuid;
  current_case jsonb;
  result jsonb;
  prior jsonb;
  dependency jsonb;
  dependency_row jsonb;
  event_type text;
  key text;
  deps jsonb;
  cycle boolean;
  approval public.approvals%ROWTYPE;
  receipt public.notebook_runtime_sessions%ROWTYPE;
  binding jsonb;
  stamp timestamptz := clock_timestamp();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text,0));
  IF p_operation='list' THEN RETURN axtn_case_work_bootstrap(p_user_id,p_operation,payload); END IF;
  IF principal->>'kind' NOT IN ('user_session','swarm_api_key','swarm','legacy_machine')
    OR principal->>'id' IS NULL
  THEN RAISE EXCEPTION 'Trusted work principal required'; END IF;
  IF p_operation='ensure' THEN
    IF (payload->>'processingMode'='HUMAN' OR payload->>'executionChannel'='HUMAN')
      AND principal->>'kind'<>'user_session'
    THEN RAISE EXCEPTION 'Human responsibility requires an authenticated user session'; END IF;
    result := axtn_case_work_bootstrap(p_user_id,p_operation,payload);
    IF (result->>'created_at')::timestamptz >= stamp THEN
      UPDATE audit_events SET detail=detail||jsonb_build_object('principal',principal)
        WHERE user_id=p_user_id AND resource_type='axtn_case_work'
          AND detail->>'transitionKey'='ensure:'||(payload->>'sourceId')
          AND NOT detail ? 'principal';
      IF payload->>'parentCaseId' IS NOT NULL
        AND payload->>'caseType'<>'DEVELOPMENT_IMPROVEMENT_CANDIDATE'
      THEN
        SELECT id INTO dataset FROM user_data_tables WHERE user_id=p_user_id AND name='axtn_cases';
        PERFORM invalidate_axtn_work_dependents(
          p_user_id,dataset,result->>'case_id','ensure:'||(payload->>'sourceId'));
      END IF;
    END IF;
    RETURN result;
  END IF;
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=p_user_id AND name='axtn_cases';
  SELECT row INTO current_case FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=payload->>'caseId' AND row->>'source_kind'='development_work' FOR UPDATE;
  IF current_case IS NULL THEN RAISE EXCEPTION 'Owned work Case not found'; END IF;
  key := payload->>'transitionKey';
  SELECT detail INTO prior FROM audit_events WHERE user_id=p_user_id
    AND resource_type='axtn_case_work' AND detail->>'transitionKey'=key;
  IF prior IS NOT NULL THEN
    IF prior->'request' IS DISTINCT FROM payload
      OR (prior ? 'principal' AND prior->'principal' IS DISTINCT FROM principal)
    THEN RAISE EXCEPTION 'Transition conflict'; END IF;
    RETURN current_case;
  END IF;
  IF current_case->>'processing_mode'='HUMAN' AND principal->>'kind'<>'user_session'
  THEN RAISE EXCEPTION 'Human-owned Work requires an authenticated release'; END IF;
  IF p_operation='details' THEN
    IF (payload->>'priority')::integer NOT BETWEEN 0 AND 3
      OR length(trim(payload->>'subject')) NOT BETWEEN 1 AND 500
    THEN RAISE EXCEPTION 'Invalid Work details'; END IF;
    IF principal->>'kind'<>'user_session' AND (
      (payload->>'priority')::integer=0
      OR (current_case->>'priority'='0' AND payload->>'priority'<>'0'))
    THEN RAISE EXCEPTION 'Automation cannot set or overwrite Human Critical priority'; END IF;
    result := current_case||jsonb_build_object('subject',payload->>'subject',
      'priority',(payload->>'priority')::integer,'due_date',payload->'dueDate',
      'follow_up',payload->'followUp','updated_at',stamp);
    UPDATE user_data_rows SET row=result WHERE table_id=dataset AND row->>'case_id'=payload->>'caseId';
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
      VALUES(p_user_id,'axtn_work.DETAILS_UPDATED','axtn_case_work',(payload->>'caseId')::uuid,
        jsonb_build_object('transitionKey',key,'request',payload,'principal',principal));
    RETURN result;
  END IF;
  IF p_operation='dependencies' THEN
    deps := payload->'dependencies';
    IF jsonb_typeof(deps)<>'array' OR jsonb_array_length(deps)>50
    THEN RAISE EXCEPTION 'Bounded directed dependencies required'; END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(deps)) <>
      (SELECT count(DISTINCT d->>'caseId') FROM jsonb_array_elements(deps) d)
    THEN RAISE EXCEPTION 'Duplicate dependency target'; END IF;
    FOR dependency IN SELECT jsonb_array_elements(deps) LOOP
      IF dependency->>'kind' NOT IN ('REQUIRES_COMPLETION','REQUIRES_CANDIDATE','INFORMS')
        OR dependency->>'caseId'=current_case->>'case_id'
      THEN RAISE EXCEPTION 'Invalid directed dependency'; END IF;
      SELECT row INTO dependency_row FROM user_data_rows WHERE table_id=dataset
        AND row->>'case_id'=dependency->>'caseId' AND row->>'source_kind'='development_work';
      IF dependency_row IS NULL THEN RAISE EXCEPTION 'Owned dependency Case not found'; END IF;
      WITH RECURSIVE walk(id,path) AS (
        SELECT dependency->>'caseId',ARRAY[dependency->>'caseId']
        UNION ALL SELECT d->>'caseId',w.path||(d->>'caseId') FROM walk w
        JOIN user_data_rows r ON r.table_id=dataset AND r.row->>'case_id'=w.id
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.row->'dependencies',
          (SELECT COALESCE(jsonb_agg(jsonb_build_object('caseId',x,'kind','REQUIRES_COMPLETION')),'[]')
           FROM jsonb_array_elements_text(COALESCE(r.row->'required_dependencies','[]')) x))) d
        WHERE NOT d->>'caseId'=ANY(w.path)
      ) SELECT EXISTS(SELECT 1 FROM walk WHERE id=current_case->>'case_id') INTO cycle;
      IF cycle THEN RAISE EXCEPTION 'Directed dependency cycle'; END IF;
    END LOOP;
    result := (current_case - 'checks_sha' - 'accepted_sha' - 'accepted_approval_id' - 'integration_phase') ||
      jsonb_build_object('dependencies',deps,'required_dependencies',
        (SELECT COALESCE(jsonb_agg(d->>'caseId'),'[]') FROM jsonb_array_elements(deps) d
         WHERE d->>'kind'<>'INFORMS'),'updated_at',stamp,'status','OPEN','closed_at',NULL);
    UPDATE user_data_rows SET row=result WHERE table_id=dataset AND row->>'case_id'=payload->>'caseId';
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
    VALUES(p_user_id,'axtn_work.DEPENDENCIES_UPDATED','axtn_case_work',(payload->>'caseId')::uuid,
      jsonb_build_object('transitionKey',key,'request',payload,'principal',principal));
    PERFORM invalidate_axtn_work_dependents(p_user_id,dataset,payload->>'caseId',key);
    RETURN result;
  END IF;
  IF p_operation='accept' THEN
    IF EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
      AND row->>'parent_case_id'=current_case->>'case_id'
      AND row->>'case_type'<>'DEVELOPMENT_IMPROVEMENT_CANDIDATE'
      AND (row->>'status'<>'CLOSED' OR (
        row->>'case_type' IN ('DEVELOPMENT_REVIEW_SECURITY','DEVELOPMENT_REVIEW_CONTRACT',
          'DEVELOPMENT_REVIEW_MAINTAINABILITY','DEVELOPMENT_VERIFY')
        AND row->>'candidate_sha' IS DISTINCT FROM current_case->>'candidate_sha')))
    THEN RAISE EXCEPTION 'Required child Contracts incomplete'; END IF;
    SELECT * INTO approval FROM approvals
      WHERE id=(native_work.payload->>'approvalId')::uuid FOR UPDATE;
    binding := approval.payload->'axtnDevelopment';
    IF approval.status IS DISTINCT FROM 'approved' OR approval.decided_by IS NULL
      OR current_case->>'status' IS DISTINCT FROM 'OPEN'
      OR binding->>'caseId' IS DISTINCT FROM current_case->>'case_id'
      OR binding->>'candidateSHA' IS DISTINCT FROM current_case->>'candidate_sha'
      OR payload->>'candidateSHA' IS DISTINCT FROM current_case->>'candidate_sha'
      OR NOT EXISTS(SELECT 1 FROM swarm_runs WHERE id=approval.swarm_run_id AND user_id=p_user_id)
    THEN RAISE EXCEPTION 'Independent native Approval required for exact Candidate'; END IF;
    IF current_case->'actor_principal'->>'kind'='user_session'
      AND current_case->'actor_principal'->>'id'=approval.decided_by::text
      OR EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
        AND row->>'parent_case_id'=current_case->>'case_id' AND row->>'case_type'='DEVELOPMENT_BUILD'
        AND row->'actor_principal'->>'kind'='user_session'
        AND row->'actor_principal'->>'id'=approval.decided_by::text)
      OR COALESCE(current_case->'human_builder_ids','[]') ? approval.decided_by::text
      OR EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
        AND row->>'parent_case_id'=current_case->>'case_id' AND row->>'case_type'='DEVELOPMENT_BUILD'
        AND COALESCE(row->'human_builder_ids','[]') ? approval.decided_by::text)
      OR EXISTS(SELECT 1 FROM audit_events a WHERE a.user_id=p_user_id
        AND a.resource_type='axtn_case_work' AND a.action IN ('axtn_work.STARTED','axtn_work.TAKEOVER')
        AND a.detail->'principal'->>'kind'='user_session'
        AND a.detail->'principal'->>'id'=approval.decided_by::text
        AND (a.resource_id::text=current_case->>'case_id'
          OR EXISTS(SELECT 1 FROM user_data_rows r WHERE r.table_id=dataset
            AND r.row->>'parent_case_id'=current_case->>'case_id'
            AND r.row->>'case_type'='DEVELOPMENT_BUILD' AND r.row->>'case_id'=a.resource_id::text)))
    THEN RAISE EXCEPTION 'Human Builder cannot self accept'; END IF;
    SELECT * INTO receipt FROM notebook_runtime_sessions
      WHERE id=(binding->>'runtimeSessionId')::uuid AND user_id=p_user_id
        AND entrypoint='axtn-development-verify-v1';
    IF receipt.status IS DISTINCT FROM 'succeeded'
      OR current_case->'work_identity'->>'taskId' IS NULL
      OR receipt.inputs->>'taskId' IS DISTINCT FROM current_case->'work_identity'->>'taskId'
      OR receipt.inputs->>'attemptId' IS DISTINCT FROM current_case->>'attempt_id'
      OR receipt.inputs->>'candidateSHA' IS DISTINCT FROM current_case->>'candidate_sha'
      OR receipt.result->>'gateVerdict' IS DISTINCT FROM 'PASS'
      OR receipt.result->'candidate'->>'pass' IS DISTINCT FROM 'true'
      OR receipt.result->'candidate'->>'compileExitCode' IS DISTINCT FROM '0'
      OR COALESCE((receipt.result->'candidate'->>'testsRun')::integer,0)<1
      OR receipt.result->>'candidateSHA' IS DISTINCT FROM current_case->>'candidate_sha'
    THEN RAISE EXCEPTION 'Native deterministic hard gate required'; END IF;
    WITH RECURSIVE lineage(id,path) AS (
      SELECT receipt.inputs->>'caseId',ARRAY[receipt.inputs->>'caseId']
      UNION ALL SELECT r.row->>'parent_case_id',l.path||(r.row->>'parent_case_id')
        FROM lineage l JOIN user_data_rows r
          ON r.table_id=dataset AND r.row->>'case_id'=l.id
        WHERE r.row->>'parent_case_id' IS NOT NULL
          AND NOT r.row->>'parent_case_id'=ANY(l.path)
    ) SELECT EXISTS(SELECT 1 FROM lineage WHERE id=current_case->>'case_id') INTO cycle;
    IF NOT cycle THEN RAISE EXCEPTION 'Native receipt belongs to a different Case lineage'; END IF;
    payload := jsonb_build_object('caseId',payload->>'caseId','transitionKey',key,
      'eventType','ACCEPTED','reasonCode','INDEPENDENT_NATIVE_APPROVAL',
      'candidateSHA',payload->>'candidateSHA','actorRef',approval.decided_by,
      'references',jsonb_build_array(
        jsonb_build_object('kind','run','repository','aXtn/aXtn-agentswarms','id',approval.swarm_run_id)));
    result := axtn_case_work_bootstrap(p_user_id,'transition',payload);
    result := result||jsonb_build_object('accepted_approval_id',approval.id);
    UPDATE user_data_rows SET row=result
      WHERE table_id=dataset AND row->>'case_id'=current_case->>'case_id';
    UPDATE audit_events SET detail=detail||jsonb_build_object('request',p_payload-'_principal',
      'principal',principal,'approvalId',approval.id,'decidedBy',approval.decided_by)
      WHERE user_id=p_user_id AND resource_type='axtn_case_work' AND detail->>'transitionKey'=key;
    RETURN result;
  END IF;
  IF p_operation<>'transition' THEN RAISE EXCEPTION 'Unknown Case operation'; END IF;
  event_type := payload->>'eventType';
  IF event_type='ACCEPTED' THEN RAISE EXCEPTION 'Native independent Acceptance proof required'; END IF;
  IF event_type='COMPLETED' AND current_case->>'status'<>'OPEN'
  THEN RAISE EXCEPTION 'Start Work before completion'; END IF;
  IF event_type='COMPLETED' AND NOT EXISTS(SELECT 1 FROM audit_events
    WHERE user_id=p_user_id AND resource_type='axtn_case_work'
      AND resource_id::text=current_case->>'case_id' AND action='axtn_work.STARTED')
  THEN RAISE EXCEPTION 'Start Work before completion'; END IF;
  IF (payload->>'processingMode'='HUMAN' OR payload->>'executionChannel'='HUMAN'
    OR event_type IN ('PROMOTED','ABANDONED'))
    AND principal->>'kind'<>'user_session'
  THEN RAISE EXCEPTION 'Human responsibility requires an authenticated user session'; END IF;
  IF payload ? 'candidateSHA' AND event_type<>'CANDIDATE_UPDATED'
    AND payload->>'candidateSHA' IS DISTINCT FROM current_case->>'candidate_sha'
  THEN RAISE EXCEPTION 'Bind Candidate explicitly before revision-bound events'; END IF;
  IF event_type='ABANDONED' THEN
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'references') ref
      WHERE ref->>'kind'='evidence')
    THEN RAISE EXCEPTION 'Abandonment requires Evidence'; END IF;
    result := (current_case-'accepted_sha'-'accepted_approval_id'-'checks_sha')||
      jsonb_build_object('status','CLOSED','status_reason',payload->>'reasonCode',
        'integration_phase','ABANDONED','closed_at',stamp,'updated_at',stamp,
        'references',COALESCE(current_case->'references','[]')||payload->'references');
    UPDATE user_data_rows SET row=result WHERE table_id=dataset AND row->>'case_id'=payload->>'caseId';
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
      VALUES(p_user_id,'axtn_work.ABANDONED','axtn_case_work',(payload->>'caseId')::uuid,
        jsonb_build_object('transitionKey',key,'request',payload,'principal',principal));
    RETURN result;
  END IF;
  IF event_type='CHECKS_PASSED' AND current_case->>'case_type'='DEVELOPMENT_VERIFY' THEN
    SELECT * INTO receipt FROM notebook_runtime_sessions
      WHERE id=(payload->>'runId')::uuid AND user_id=p_user_id
        AND entrypoint='axtn-development-verify-v1';
    IF current_case->>'status' IS DISTINCT FROM 'OPEN'
      OR receipt.status IS DISTINCT FROM 'succeeded'
      OR receipt.inputs->>'caseId' IS DISTINCT FROM current_case->>'case_id'
      OR current_case->'work_identity'->>'taskId' IS NULL
      OR receipt.inputs->>'taskId' IS DISTINCT FROM current_case->'work_identity'->>'taskId'
      OR receipt.inputs->>'attemptId' IS DISTINCT FROM current_case->>'attempt_id'
      OR receipt.inputs->>'candidateSHA' IS DISTINCT FROM current_case->>'candidate_sha'
      OR receipt.result->>'gateVerdict' IS DISTINCT FROM 'PASS'
      OR receipt.result->'candidate'->>'pass' IS DISTINCT FROM 'true'
      OR receipt.result->'candidate'->>'compileExitCode' IS DISTINCT FROM '0'
      OR COALESCE((receipt.result->'candidate'->>'testsRun')::integer,0)<1
    THEN RAISE EXCEPTION 'Verify checks require native deterministic proof'; END IF;
  END IF;
  IF event_type IN ('STARTED','COMPLETED') THEN
    FOR dependency IN SELECT jsonb_array_elements(COALESCE(current_case->'dependencies','[]')) LOOP
      IF dependency->>'kind'='INFORMS' THEN CONTINUE; END IF;
      SELECT row INTO dependency_row FROM user_data_rows WHERE table_id=dataset
        AND row->>'case_id'=dependency->>'caseId';
      IF dependency_row->>'status' IS DISTINCT FROM 'CLOSED'
        OR (dependency->>'kind'='REQUIRES_CANDIDATE'
          AND (current_case->>'candidate_sha' IS NULL
            OR dependency_row->>'candidate_sha' IS DISTINCT FROM current_case->>'candidate_sha'))
      THEN RAISE EXCEPTION 'Directed dependency contract incomplete'; END IF;
    END LOOP;
    IF event_type='STARTED' AND current_case->>'case_type'='DEVELOPMENT_IMPROVEMENT_CANDIDATE'
      AND current_case->>'promoted' IS DISTINCT FROM 'true'
    THEN RAISE EXCEPTION 'Improvement Candidate requires explicit promotion'; END IF;
    IF event_type='COMPLETED' AND current_case->>'case_type'='DEVELOPMENT_VERIFY'
      AND (current_case->>'candidate_sha' IS NULL
        OR current_case->>'checks_sha' IS DISTINCT FROM current_case->>'candidate_sha')
    THEN RAISE EXCEPTION 'Verify Work completion requires exact hard checks'; END IF;
    IF event_type='COMPLETED' AND current_case->>'case_type'='DEVELOPMENT_CHANGE'
      AND EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
        AND row->>'parent_case_id'=current_case->>'case_id'
        AND row->>'case_type' IN ('DEVELOPMENT_REVIEW_SECURITY','DEVELOPMENT_REVIEW_CONTRACT',
          'DEVELOPMENT_REVIEW_MAINTAINABILITY','DEVELOPMENT_VERIFY')
        AND row->>'candidate_sha' IS DISTINCT FROM current_case->>'candidate_sha')
    THEN RAISE EXCEPTION 'Required Review and Verify Contracts have a different Candidate'; END IF;
  END IF;
  -- The bootstrap's legacy dependencies retain completion semantics, independent
  -- of cross-repository revision identity. Typed same-candidate edges enforce it above.
  result := axtn_case_work_bootstrap(p_user_id,p_operation,
    CASE WHEN event_type='STARTED' THEN payload-'candidateSHA' ELSE payload END);
  IF event_type='STARTED' THEN
    UPDATE audit_events SET detail=jsonb_set(detail,'{request}',payload)
      WHERE user_id=p_user_id AND resource_type='axtn_case_work' AND detail->>'transitionKey'=key;
  END IF;
  IF event_type IN ('STARTED','TAKEOVER') THEN
    result := result||jsonb_build_object('actor_principal',principal,'actor_ref',payload->>'actorRef');
    IF principal->>'kind'='user_session'
      AND current_case->>'case_type' IN ('DEVELOPMENT_CHANGE','DEVELOPMENT_BUILD')
    THEN result := result||jsonb_build_object('human_builder_ids',
      (SELECT jsonb_agg(DISTINCT id) FROM jsonb_array_elements(
        COALESCE(result->'human_builder_ids','[]')||jsonb_build_array(principal->>'id')) id));
    END IF;
  END IF;
  IF payload ? 'attemptId' THEN result := result||jsonb_build_object('attempt_id',payload->>'attemptId'); END IF;
  IF event_type='PROMOTED' THEN result := result||jsonb_build_object('promoted',true); END IF;
  IF event_type='RESULT' AND payload ? 'resultRef' THEN
    result := result||jsonb_build_object('result_ref',payload->'resultRef');
  END IF;
  IF event_type IN ('CHECKS_FAILED','ROLLBACK','REOPENED')
    OR (event_type='CANDIDATE_UPDATED'
      AND current_case->>'candidate_sha' IS DISTINCT FROM payload->>'candidateSHA')
    OR (payload ? 'attemptId' AND payload->>'attemptId' IS DISTINCT FROM current_case->>'attempt_id')
  THEN
    result := (result-'checks_sha'-'accepted_sha'-'accepted_approval_id'-'integration_phase') ||
      jsonb_build_object('status',CASE WHEN current_case->>'status'='NEW' THEN 'NEW' ELSE 'OPEN' END,
        'closed_at',NULL);
    PERFORM invalidate_axtn_work_dependents(p_user_id,dataset,payload->>'caseId',key);
  END IF;
  UPDATE user_data_rows SET row=result WHERE table_id=dataset AND row->>'case_id'=payload->>'caseId';
  UPDATE audit_events SET detail=detail||jsonb_build_object('principal',principal)
    WHERE user_id=p_user_id AND resource_type='axtn_case_work' AND detail->>'transitionKey'=key;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_work(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_work(uuid,text,jsonb) TO service_role;
