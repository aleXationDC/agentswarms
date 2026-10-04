-- Reuse the native Approval row and SupaCase guard; no separate decision store.
CREATE UNIQUE INDEX approvals_native_work_operation
  ON public.approvals(swarm_run_id, (payload->'axtnDevelopment'->>'operationId'))
  WHERE payload->'axtnDevelopment' ? 'operationId';

-- A routed reviewer does not gain dataset access. Read protected work under a
-- narrow definer helper; the invoking trigger still checks the real DB role.
CREATE FUNCTION public.assert_axtn_work_reviewer(binding jsonb,owner_id uuid,reviewer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  work jsonb;
  dataset uuid;
  receipt public.notebook_runtime_sessions;
BEGIN
  IF auth.uid() IS NULL OR reviewer_id IS DISTINCT FROM auth.uid()
  THEN RAISE EXCEPTION 'NATIVE_APPROVAL_AUTHENTICATED_REVIEWER_REQUIRED'; END IF;
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=owner_id AND name='axtn_cases';
  SELECT row INTO work FROM user_data_rows
    WHERE table_id=dataset AND row->>'case_id'=binding->>'caseId' FOR SHARE;
  IF work IS NULL OR work->>'source_kind' IS DISTINCT FROM 'development_work'
    OR work->>'status' IS DISTINCT FROM 'OPEN'
    OR work->>'candidate_sha' IS DISTINCT FROM binding->>'candidateSHA'
    OR (binding ? 'attemptId' AND work->>'attempt_id' IS DISTINCT FROM binding->>'attemptId')
  THEN RAISE EXCEPTION 'NATIVE_APPROVAL_CURRENT_WORK_BINDING_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM user_data_rows r WHERE r.table_id=dataset
    AND (r.row->>'case_id'=work->>'case_id'
      OR (r.row->>'parent_case_id'=work->>'case_id' AND r.row->>'case_type'='DEVELOPMENT_BUILD'))
    AND (COALESCE(r.row->'human_builder_ids','[]') ? reviewer_id::text
      OR (r.row->'actor_principal'->>'kind'='user_session'
        AND r.row->'actor_principal'->>'id'=reviewer_id::text)))
    OR EXISTS(SELECT 1 FROM audit_events a WHERE a.user_id=owner_id
      AND a.resource_type='axtn_case_work' AND a.action IN ('axtn_work.STARTED','axtn_work.TAKEOVER')
      AND a.detail->'principal'->>'kind'='user_session'
      AND a.detail->'principal'->>'id'=reviewer_id::text
      AND (a.resource_id::text=work->>'case_id'
        OR EXISTS(SELECT 1 FROM user_data_rows r WHERE r.table_id=dataset
          AND r.row->>'parent_case_id'=work->>'case_id' AND r.row->>'case_type'='DEVELOPMENT_BUILD'
          AND r.row->>'case_id'=a.resource_id::text)))
  THEN RAISE EXCEPTION 'NATIVE_APPROVAL_BUILDER_DENIED'; END IF;
  SELECT * INTO receipt FROM notebook_runtime_sessions
    WHERE id=(binding->>'runtimeSessionId')::uuid AND user_id=owner_id
      AND entrypoint='axtn-development-verify-v1';
  IF receipt.status IS DISTINCT FROM 'succeeded'
    OR receipt.inputs->>'candidateSHA' IS DISTINCT FROM work->>'candidate_sha'
    OR receipt.inputs->>'attemptId' IS DISTINCT FROM work->>'attempt_id'
    OR receipt.result->>'candidateSHA' IS DISTINCT FROM work->>'candidate_sha'
    OR receipt.result->>'gateVerdict' IS DISTINCT FROM 'PASS'
  THEN RAISE EXCEPTION 'NATIVE_APPROVAL_CURRENT_RECEIPT_REQUIRED'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_axtn_work_reviewer(jsonb,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assert_axtn_work_reviewer(jsonb,uuid,uuid)
  TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.guard_axtn_work_approval() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE
  native boolean := false;
  binding jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN native := OLD.payload ? 'axtnDevelopment'; END IF;
  IF TG_OP <> 'DELETE' THEN native := native OR NEW.payload ? 'axtnDevelopment'; END IF;
  IF NOT native THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'NATIVE_APPROVAL_EVIDENCE_RETAINED'; END IF;
  binding := NEW.payload->'axtnDevelopment';
  IF TG_OP='INSERT' THEN
    IF current_user NOT IN ('postgres','service_role') OR NEW.status <> 'pending'
      OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL OR NEW.swarm_run_id IS NULL
    THEN RAISE EXCEPTION 'NATIVE_APPROVAL_SERVER_CREATED_PENDING_REQUIRED'; END IF;
    IF NOT EXISTS(SELECT 1 FROM swarm_runs WHERE id=NEW.swarm_run_id AND user_id=NEW.user_id)
    THEN RAISE EXCEPTION 'NATIVE_APPROVAL_RUN_OWNER_DENIED'; END IF;
    IF cardinality(NEW.approver_user_ids)+cardinality(NEW.approver_group_ids)=0
    THEN RAISE EXCEPTION 'NATIVE_APPROVAL_REVIEWER_REQUIRED'; END IF;
    IF binding ? 'operationId' AND (
      binding->>'operationId' !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
      OR binding->>'attemptId' IS NULL OR binding->>'nodeId' IS NULL
      OR binding->>'evidenceHash' !~ '^[a-f0-9]{64}$'
      OR binding->>'graphHash' !~ '^[a-f0-9]{64}$')
    THEN RAISE EXCEPTION 'NATIVE_APPROVAL_OPERATION_BINDING_REQUIRED'; END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status','decided_at','decided_by','notified_at'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','decided_at','decided_by','notified_at'])
  THEN RAISE EXCEPTION 'NATIVE_APPROVAL_BINDING_IMMUTABLE'; END IF;
  IF NEW.notified_at IS DISTINCT FROM OLD.notified_at THEN
    IF current_user NOT IN ('postgres','service_role')
    THEN RAISE EXCEPTION 'NATIVE_APPROVAL_NOTIFICATION_SERVER_OWNED'; END IF;
    IF NEW.status=OLD.status AND NEW.decided_by IS NOT DISTINCT FROM OLD.decided_by
      AND NEW.decided_at IS NOT DISTINCT FROM OLD.decided_at
    THEN RETURN NEW; END IF;
  END IF;
  IF OLD.status='pending' AND NEW.status='cancelled'
    AND current_user IN ('postgres','service_role')
  THEN NEW.decided_by := NULL; NEW.decided_at := clock_timestamp(); RETURN NEW; END IF;
  IF current_user <> 'authenticated' OR auth.uid() IS NULL
    OR OLD.status <> 'pending' OR NEW.status NOT IN ('approved','rejected')
  THEN RAISE EXCEPTION 'NATIVE_APPROVAL_AUTHENTICATED_REVIEWER_REQUIRED'; END IF;
  IF auth.uid()=OLD.user_id THEN RAISE EXCEPTION 'NATIVE_APPROVAL_WORK_OWNER_DENIED'; END IF;
  IF NOT is_swarm_approver(OLD.approver_user_ids,OLD.approver_group_ids,auth.uid())
  THEN RAISE EXCEPTION 'NATIVE_APPROVAL_REVIEWER_DENIED'; END IF;
  PERFORM assert_axtn_work_reviewer(binding,OLD.user_id,auth.uid());
  NEW.decided_by := auth.uid();
  NEW.decided_at := clock_timestamp();
  RETURN NEW;
END;
$$;

-- Audit in the same transaction as the existing row, including rejected and
-- cancelled requests. Rollback/denial cannot leave success-shaped evidence.
CREATE FUNCTION public.audit_axtn_work_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.payload ? 'axtnDevelopment' AND
    (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status)
  THEN
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
      VALUES(NEW.user_id,
        CASE WHEN TG_OP='INSERT' THEN 'axtn_work.APPROVAL_REQUESTED'
          ELSE 'axtn_work.APPROVAL_DECIDED' END,
        'axtn_case_work',(NEW.payload->'axtnDevelopment'->>'caseId')::uuid,
        jsonb_build_object('approvalId',NEW.id,'runId',NEW.swarm_run_id,
          'binding',NEW.payload->'axtnDevelopment',
          'decision',NEW.status,'decidedBy',NEW.decided_by,'decidedAt',NEW.decided_at,
          'approverUserIds',NEW.approver_user_ids,'approverGroupIds',NEW.approver_group_ids,
          'processingMode','HUMAN','executionChannel','SWARM'));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_axtn_work_approval() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER audit_axtn_work_approval AFTER INSERT OR UPDATE ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.audit_axtn_work_approval();

-- Use the caller's actual authenticated role/RLS. A zero-row decision is an
-- explicit denial, never a successful callback with no state change.
CREATE FUNCTION public.decide_swarm_approval(p_approval_id uuid,p_decision text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE decided uuid;
BEGIN
  IF current_user <> 'authenticated' OR auth.uid() IS NULL
    OR p_decision NOT IN ('approved','rejected')
  THEN RAISE EXCEPTION 'NATIVE_APPROVAL_AUTHENTICATED_DECISION_REQUIRED'; END IF;
  UPDATE approvals SET status=p_decision,decided_by=auth.uid(),decided_at=clock_timestamp()
    WHERE id=p_approval_id AND status='pending' RETURNING id INTO decided;
  IF decided IS NULL THEN RAISE EXCEPTION 'NATIVE_APPROVAL_REVIEWER_DENIED_OR_ALREADY_DECIDED'; END IF;
  RETURN decided;
END;
$$;
REVOKE ALL ON FUNCTION public.decide_swarm_approval(uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.decide_swarm_approval(uuid,text) TO authenticated;
