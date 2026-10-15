-- REVIEW CANDIDATE ONLY: not applied by this handoff.
-- Implements the accepted environment-owner authority in the existing native
-- Development Approval trigger. No approval row, snapshot or audit is rewritten.
-- Existing human-Builder/current-Candidate/receipt checks remain authoritative.
-- Source base: 0304f4534ea86a8b73a17e9a01d0e8750b265f24.

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
  -- Custody alone does not identify the Builder. The persisted reviewer routing
  -- below and assert_axtn_work_reviewer retain the actual human-Builder exclusion.
  -- This changes only Development approvals; DMS/generic guards are untouched.
  IF NOT is_swarm_approver(OLD.approver_user_ids,OLD.approver_group_ids,auth.uid())
  THEN RAISE EXCEPTION 'NATIVE_APPROVAL_REVIEWER_DENIED'; END IF;
  PERFORM assert_axtn_work_reviewer(binding,OLD.user_id,auth.uid());
  NEW.decided_by := auth.uid();
  NEW.decided_at := clock_timestamp();
  RETURN NEW;
END;
$$;
