-- A registered DMS binding on the existing native Approval row and IAM.
CREATE UNIQUE INDEX approvals_native_document_operation
  ON public.approvals(swarm_run_id,(payload->'axtnDocument'->>'operationId'))
  WHERE payload->'axtnDocument' ? 'operationId';

CREATE FUNCTION public.assert_axtn_document_approval(
  binding jsonb,owner_id uuid,reviewer_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE work jsonb; decision jsonb; proposal jsonb;
BEGIN
  SELECT r.row INTO work FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=owner_id AND t.name='axtn_cases'
      AND r.row->>'case_id'=binding->>'caseId' FOR SHARE OF r;
  SELECT r.row INTO decision FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=owner_id AND t.name='axtn_document_decisions'
      AND r.row->>'decision_id'=binding->>'decisionId' FOR SHARE OF r;
  proposal := decision->'document_decision';
  IF work IS NULL OR decision IS NULL OR proposal IS NULL
    OR work->>'source_kind' IS DISTINCT FROM 'document_work'
    OR work->>'status' IS DISTINCT FROM 'OPEN'
    OR decision->>'status' IS DISTINCT FROM 'PROPOSED'
    OR proposal->>'schemaVersion' IS DISTINCT FROM 'document-decision-v1'
    OR proposal->>'featureSchemaRevision' IS DISTINCT FROM 'document-features-v1'
    OR proposal->>'operation' IS DISTINCT FROM binding->>'proposalOperation'
    OR COALESCE(binding->>'proposalOperation','') NOT IN ('CLASSIFY','FILE','DELETE')
    OR decision->>'case_id' IS DISTINCT FROM work->>'case_id'
    OR proposal->>'caseId' IS DISTINCT FROM work->>'case_id'
    OR work->>'attempt_id' IS DISTINCT FROM binding->>'attemptId'
    OR proposal->>'attemptId' IS DISTINCT FROM work->>'attempt_id'
    OR work->>'input_hash' IS DISTINCT FROM binding->>'inputHash'
    OR proposal->>'inputHash' IS DISTINCT FROM work->>'input_hash'
    OR work->>'document_id' IS DISTINCT FROM binding->>'documentId'
    OR proposal->>'documentId' IS DISTINCT FROM work->>'document_id'
    OR work->'document_input'->>'sourceRef' IS DISTINCT FROM binding->>'sourceRef'
    OR proposal->>'sourceRef' IS DISTINCT FROM binding->>'sourceRef'
    OR work->'document_input'->>'sourceRevision' IS DISTINCT FROM binding->>'sourceRevision'
    OR proposal->>'sourceRevision' IS DISTINCT FROM binding->>'sourceRevision'
    OR decision->>'revision' IS DISTINCT FROM binding->>'decisionRevision'
    OR decision->'principal' IS DISTINCT FROM work->'actor_principal'
    OR COALESCE(proposal->>'automationMode','') NOT IN ('OBSERVE','SHADOW','ASSISTED')
    OR proposal->>'ruleRevision' IS NOT NULL OR binding->>'policyRevision' IS NOT NULL
  THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_CURRENT_PROPOSAL_BINDING_REQUIRED'; END IF;
  IF COALESCE(work->>'processing_mode','')<>'HUMAN' AND (
    COALESCE(work->>'privacy_evidence_revision','') !~ '^[a-f0-9]{64}$'
    OR work->>'verified_privacy_status' IS DISTINCT FROM 'ELIGIBLE'
    OR work->'document_input'->>'privacyStatus'='NO_AI')
  THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_PROTECTED_PRIVACY_EVIDENCE_REQUIRED'; END IF;
  IF reviewer_id IS NOT NULL THEN
    IF auth.uid() IS NULL OR reviewer_id IS DISTINCT FROM auth.uid()
    THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_AUTHENTICATED_REVIEWER_REQUIRED'; END IF;
    IF (decision->'principal'->>'kind'='user_session'
        AND decision->'principal'->>'id'=reviewer_id::text)
      OR EXISTS(SELECT 1 FROM audit_events WHERE user_id=owner_id
        AND resource_type='axtn_case_work' AND resource_id::text=work->>'case_id'
        AND action IN ('axtn_work.STARTED','axtn_work.TAKEOVER')
        AND detail->'principal'->>'kind'='user_session'
        AND detail->'principal'->>'id'=reviewer_id::text)
    THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_BUILDER_DENIED'; END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_axtn_document_approval(jsonb,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assert_axtn_document_approval(jsonb,uuid,uuid)
  TO authenticated,service_role;

CREATE FUNCTION public.guard_axtn_document_approval() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE native boolean := false; binding jsonb; node_config jsonb;
BEGIN
  IF TG_OP<>'INSERT' THEN native := OLD.payload ? 'axtnDocument'; END IF;
  IF TG_OP<>'DELETE' THEN native := native OR NEW.payload ? 'axtnDocument'; END IF;
  IF NOT native THEN
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_EVIDENCE_RETAINED'; END IF;
  IF NEW.payload ? 'axtnDevelopment'
  THEN RAISE EXCEPTION 'NATIVE_APPROVAL_DOMAIN_BINDING_CONFLICT'; END IF;
  binding := NEW.payload->'axtnDocument';
  IF TG_OP='INSERT' THEN
    IF current_user NOT IN ('postgres','service_role') OR NEW.status<>'pending'
      OR NEW.decided_by IS NOT NULL OR NEW.decided_at IS NOT NULL
      OR NEW.swarm_run_id IS NULL
    THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_SERVER_CREATED_PENDING_REQUIRED'; END IF;
    IF NOT EXISTS(SELECT 1 FROM swarm_runs WHERE id=NEW.swarm_run_id
      AND user_id=NEW.user_id AND status IN ('running','suspended'))
    THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_RUN_OWNER_DENIED'; END IF;
    IF cardinality(NEW.approver_user_ids)+cardinality(NEW.approver_group_ids)=0
    THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_REVIEWER_REQUIRED'; END IF;
    IF COALESCE(binding->>'operationId','') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
      OR COALESCE(binding->>'nodeId','')='' OR binding->>'attemptId' IS NULL
      OR COALESCE(binding->>'graphHash','') !~ '^[a-f0-9]{64}$'
      OR COALESCE(binding->>'evidenceHash','') !~ '^[a-f0-9]{64}$'
      OR COALESCE(binding->>'decisionRevision','') !~ '^[a-f0-9]{64}$'
      OR COALESCE(binding->>'inputHash','') !~ '^[a-f0-9]{64}$'
      OR COALESCE(binding->>'documentId','')='' OR COALESCE(binding->>'sourceRef','')=''
      OR COALESCE(binding->>'sourceRevision','')=''
      OR NOT binding ? 'policyRevision' OR binding->'policyRevision'<>'null'::jsonb
    THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_OPERATION_BINDING_REQUIRED'; END IF;
    SELECT node->'data' INTO node_config FROM swarm_runs run,
      jsonb_array_elements(run.swarm_snapshot->'nodes') node
      WHERE run.id=NEW.swarm_run_id AND node->>'id'=binding->>'nodeId';
    IF node_config IS NULL OR node_config->>'kind' IS DISTINCT FROM 'approval'
      OR NOT node_config ? 'approvalDocument' OR node_config ? 'approvalWork'
      OR COALESCE(node_config->'approverUserIds','[]'::jsonb) IS DISTINCT FROM to_jsonb(NEW.approver_user_ids)
      OR COALESCE(node_config->'approverGroupIds','[]'::jsonb) IS DISTINCT FROM to_jsonb(NEW.approver_group_ids)
      OR node_config->'approvalDocument'->>'operation' IS DISTINCT FROM binding->>'proposalOperation'
      OR EXISTS(SELECT 1 FROM unnest(ARRAY['caseId','decisionId','operationId']) fields(name)
        WHERE COALESCE(node_config->'approvalDocument'->>fields.name,'')=''
          OR (strpos(node_config->'approvalDocument'->>fields.name,'{{')=0
            AND node_config->'approvalDocument'->>fields.name IS DISTINCT FROM binding->>fields.name))
    THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_PERSISTED_ROUTING_REQUIRED'; END IF;
    PERFORM assert_axtn_document_approval(binding,NEW.user_id,NULL);
    IF NEW.payload->'documentProposal' IS DISTINCT FROM (
      SELECT r.row->'document_decision' FROM user_data_rows r
      JOIN user_data_tables t ON t.id=r.table_id WHERE t.user_id=NEW.user_id
        AND t.name='axtn_document_decisions' AND r.row->>'decision_id'=binding->>'decisionId')
    THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_MINIMIZED_PROPOSAL_REQUIRED'; END IF;
    RETURN NEW;
  END IF;
  IF (to_jsonb(NEW)-ARRAY['status','decided_at','decided_by','notified_at'])
    IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','decided_at','decided_by','notified_at'])
  THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_BINDING_IMMUTABLE'; END IF;
  IF NEW.notified_at IS DISTINCT FROM OLD.notified_at THEN
    IF current_user NOT IN ('postgres','service_role')
    THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_NOTIFICATION_SERVER_OWNED'; END IF;
    IF NEW.status=OLD.status AND NEW.decided_by IS NOT DISTINCT FROM OLD.decided_by
      AND NEW.decided_at IS NOT DISTINCT FROM OLD.decided_at
    THEN RETURN NEW; END IF;
  END IF;
  IF OLD.status='pending' AND NEW.status='cancelled'
    AND current_user IN ('postgres','service_role')
  THEN NEW.decided_by := NULL; NEW.decided_at := clock_timestamp(); RETURN NEW; END IF;
  IF current_user<>'authenticated' OR auth.uid() IS NULL OR OLD.status<>'pending'
    OR NEW.status NOT IN ('approved','rejected')
  THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_AUTHENTICATED_REVIEWER_REQUIRED'; END IF;
  IF auth.uid()=OLD.user_id THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_WORK_OWNER_DENIED'; END IF;
  IF NOT is_swarm_approver(OLD.approver_user_ids,OLD.approver_group_ids,auth.uid())
  THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_REVIEWER_DENIED'; END IF;
  PERFORM assert_axtn_document_approval(binding,OLD.user_id,auth.uid());
  NEW.decided_by := auth.uid(); NEW.decided_at := clock_timestamp();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_axtn_document_approval() FROM PUBLIC;
CREATE TRIGGER guard_axtn_document_approval BEFORE INSERT OR UPDATE OR DELETE
  ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_document_approval();

CREATE FUNCTION public.audit_axtn_document_approval() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.payload ? 'axtnDocument' AND
    (TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status)
  THEN
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
      VALUES(NEW.user_id,
        CASE WHEN TG_OP='INSERT' THEN 'axtn_work.DOCUMENT_APPROVAL_REQUESTED'
          ELSE 'axtn_work.DOCUMENT_APPROVAL_DECIDED' END,
        'axtn_case_work',(NEW.payload->'axtnDocument'->>'caseId')::uuid,
        jsonb_build_object('approvalId',NEW.id,'runId',NEW.swarm_run_id,
          'binding',NEW.payload->'axtnDocument','decision',NEW.status,
          'decidedBy',NEW.decided_by,'decidedAt',NEW.decided_at,
          'approverUserIds',NEW.approver_user_ids,'approverGroupIds',NEW.approver_group_ids,
          'processingMode',CASE WHEN NEW.status IN ('approved','rejected') THEN 'HUMAN'
            WHEN NEW.status='cancelled' THEN 'DETERMINISTIC'
            ELSE (SELECT r.row->>'processing_mode' FROM user_data_rows r
              JOIN user_data_tables t ON t.id=r.table_id WHERE t.user_id=NEW.user_id
                AND t.name='axtn_cases'
                AND r.row->>'case_id'=NEW.payload->'axtnDocument'->>'caseId') END,
          'executionChannel','SWARM'));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_axtn_document_approval() FROM PUBLIC;
CREATE TRIGGER audit_axtn_document_approval AFTER INSERT OR UPDATE ON public.approvals
  FOR EACH ROW EXECUTE FUNCTION public.audit_axtn_document_approval();

CREATE FUNCTION public.guard_axtn_document_approval_run() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM approvals WHERE swarm_run_id=OLD.id AND payload ? 'axtnDocument')
    AND (TG_OP='DELETE' OR NEW.swarm_snapshot IS DISTINCT FROM OLD.swarm_snapshot
      OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.swarm_id IS DISTINCT FROM OLD.swarm_id)
  THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_RUN_EVIDENCE_IMMUTABLE'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_axtn_document_approval_run() FROM PUBLIC;
CREATE TRIGGER guard_axtn_document_approval_run BEFORE UPDATE OR DELETE ON public.swarm_runs
  FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_document_approval_run();

-- Resume/effects re-read current reviewer authority; an old group grant is
-- not an irrevocable effect permission.
CREATE FUNCTION public.assert_axtn_document_approval_resume(p_approval_id uuid,p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE approval public.approvals; proposal jsonb;
BEGIN
  SELECT * INTO approval FROM approvals WHERE id=p_approval_id AND user_id=p_user_id FOR SHARE;
  IF approval.id IS NULL OR NOT approval.payload ? 'axtnDocument'
    OR approval.status NOT IN ('approved','rejected') OR approval.decided_by IS NULL
    OR approval.decided_by=approval.user_id
    OR NOT is_swarm_approver(approval.approver_user_ids,approval.approver_group_ids,approval.decided_by)
  THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_CURRENT_REVIEWER_REQUIRED'; END IF;
  PERFORM assert_axtn_document_approval(approval.payload->'axtnDocument',approval.user_id,NULL);
  SELECT r.row INTO proposal FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=approval.user_id AND t.name='axtn_document_decisions'
      AND r.row->>'decision_id'=approval.payload->'axtnDocument'->>'decisionId';
  IF (proposal->'principal'->>'kind'='user_session'
    AND proposal->'principal'->>'id'=approval.decided_by::text)
    OR EXISTS(SELECT 1 FROM audit_events WHERE user_id=approval.user_id
      AND resource_type='axtn_case_work'
      AND resource_id::text=approval.payload->'axtnDocument'->>'caseId'
      AND action IN ('axtn_work.STARTED','axtn_work.TAKEOVER')
      AND detail->'principal'->>'kind'='user_session'
      AND detail->'principal'->>'id'=approval.decided_by::text)
  THEN RAISE EXCEPTION 'DMS_NATIVE_APPROVAL_BUILDER_DENIED'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_axtn_document_approval_resume(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assert_axtn_document_approval_resume(uuid,uuid) TO service_role;
