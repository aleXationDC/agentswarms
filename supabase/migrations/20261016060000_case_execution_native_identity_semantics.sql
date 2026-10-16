-- Native identity semantics for Case execution (supersedes the Case-funding / Case-route parts of the
-- earlier function; 20261016030000..050000 are already applied and are not rewritten).
--  * Personal execution applies ONLY when the node's effective provider is the personal ChatGPT plan
--    (axtn_chatgpt_plan). Case semantic_route_mode / assignee / group are no longer a precondition for
--    standard provider, API-key or llm_gateway resolution.
--  * Provider/model come from the node (snapshot) configuration or the existing native default,
--    never from Case semantic_route_provider/model.
--  * Policy, model rights, credentials, gateway integration and budget use the run owner (p_user_id);
--    no Case company-funding gate. Case route/group stay as reporting dimensions in the binding.
--  * Fresh bindings and per-node routes persist the same identity that is returned to the app.
--    Existing bindings are not rewritten.
CREATE OR REPLACE FUNCTION public.axtn_case_execution(p_user_id uuid, p_operation text, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE run swarm_runs%ROWTYPE; parent swarm_runs%ROWTYPE; custodian uuid; value jsonb;
  principal jsonb; attempt text; binding jsonb; node jsonb; node_id text; operation_key text;
  provider_id text; model_id text; actor uuid; responsible_group uuid; personal boolean;
  assignment_revision bigint; stamp timestamptz:=clock_timestamp(); candidate_count bigint; budget_group uuid;
  previous jsonb; gateway_route boolean:=false; gateway_id uuid; first_actor uuid; node_class text;
BEGIN
  IF p_operation NOT IN ('bind_run','resolve','credential','block')
  THEN RAISE EXCEPTION 'CASE_EXECUTION_OPERATION_REQUIRED'; END IF;
  SELECT * INTO run FROM swarm_runs WHERE id=(p_payload->>'runId')::uuid AND user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'CASE_ACCESS_DENIED'; END IF;
  principal:=CASE WHEN p_operation='bind_run' THEN p_payload->'_principal' ELSE run.case_execution_principal END;
  PERFORM assert_axtn_case_principal(p_user_id,principal);
  custodian:=axtn_case_custodian(p_user_id,
    CASE WHEN p_operation='bind_run' THEN p_payload->>'caseId' ELSE run.case_id::text END,principal);
  IF custodian<>run.user_id THEN RAISE EXCEPTION 'CASE_EXECUTION_CUSTODIAN_REQUIRED'; END IF;
  SELECT r.row INTO value FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.name='axtn_cases' AND t.user_id=custodian AND r.row->>'case_id'=
      CASE WHEN p_operation='bind_run' THEN p_payload->>'caseId' ELSE run.case_id::text END FOR UPDATE OF r;
  SELECT * INTO run FROM swarm_runs WHERE id=run.id FOR UPDATE;
  IF p_operation='block' THEN
    IF p_payload->>'reasonCode' NOT IN (
      'CASE_EXECUTION_PRIVACY_HOLD','CASE_EXECUTION_READBACK_RECOVERY_REQUIRED',
      'CASE_EXECUTION_EVIDENCE_WRITE_FAILED','CASE_EXECUTION_BUDGET_EXCEEDED','CASE_EXECUTION_CREDENTIAL_CHANGED',
      'CASE_EXECUTION_PRINCIPAL_INACTIVE',
      'NO_ELIGIBLE_EXECUTION_PRINCIPAL','PERSONAL_CONNECTION_REQUIRED','PERSONAL_CONNECTION_REAUTH_REQUIRED',
      'PERSONAL_PLAN_LIMIT_REACHED','MODEL_ACCESS_DENIED','PROVIDER_CAPABILITY_UNSUPPORTED','PROVIDER_UNAVAILABLE',
      'SYSTEM_INTEGRATION_UNAVAILABLE','SYSTEM_INTEGRATION_AMBIGUOUS','SYSTEM_INTEGRATION_REAUTH_REQUIRED',
      'SYSTEM_INTEGRATION_QUOTA_REACHED','ROUTING_DECISION_REQUIRED')
      OR p_payload->>'reasonCode' IS NULL
    THEN RAISE EXCEPTION 'CASE_EXECUTION_BLOCK_REASON_REQUIRED'; END IF;
    SELECT detail INTO previous FROM audit_events WHERE user_id=custodian
      AND action='axtn_case_execution.BLOCKED' AND resource_id=run.id
      AND detail->>'reasonCode'=p_payload->>'reasonCode';
    IF previous IS NOT NULL THEN RETURN jsonb_build_object(
      'reasonCode',previous->>'reasonCode','disposition',previous->>'disposition'); END IF;
    IF value->>'status'='CLOSED' OR run.status NOT IN ('running','suspended')
    THEN RAISE EXCEPTION 'CASE_EXECUTION_INACTIVE'; END IF;
    IF value->>'processing_mode'<>'HUMAN' OR value->>'processing_mode' IS NULL THEN
      PERFORM axtn_case_processing(custodian,'processing',jsonb_build_object(
        'caseId',run.case_id,'expectedVersion',COALESCE((value->>'processing_version')::bigint,0),
        'transitionKey','execution-block-'||run.id::text||'-'||(p_payload->>'reasonCode'),
        'reasonCode',p_payload->>'reasonCode','_principal',principal,
        'patch',jsonb_build_object('processing_stage','WAITING_EXTERNAL_CAPABILITY',
          'waiting_reason','CAPABILITY_UNAVAILABLE')));
    END IF;
    IF NOT EXISTS(SELECT 1 FROM audit_events WHERE user_id=custodian
      AND action='axtn_case_execution.BLOCKED' AND resource_id=run.id AND detail->>'reasonCode'=p_payload->>'reasonCode') THEN
      INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
        VALUES(custodian,'axtn_case_execution.BLOCKED','axtn_case_execution',run.id,stamp,
          jsonb_build_object('caseId',run.case_id,'attemptId',run.case_attempt_id,'principal',principal,
            'reasonCode',p_payload->>'reasonCode','disposition',
            CASE WHEN value->>'processing_mode'='HUMAN' THEN 'HUMAN_TAKEOVER_FENCED' ELSE 'BLOCKED' END));
    END IF;
    RETURN jsonb_build_object('reasonCode',p_payload->>'reasonCode','disposition',
      CASE WHEN value->>'processing_mode'='HUMAN' THEN 'HUMAN_TAKEOVER_FENCED' ELSE 'BLOCKED' END);
  END IF;
  IF value->>'status'='CLOSED' OR run.status NOT IN ('running','suspended')
  THEN RAISE EXCEPTION 'CASE_EXECUTION_INACTIVE'; END IF;
  IF p_operation='bind_run' THEN
    IF run.case_id IS NOT NULL THEN
      IF run.case_id::text IS DISTINCT FROM p_payload->>'caseId'
        OR run.case_execution_principal IS DISTINCT FROM principal
        OR run.case_parent_run_id::text IS DISTINCT FROM p_payload->>'parentRunId'
        OR run.case_parent_node_id IS DISTINCT FROM p_payload->>'parentNodeId'
      THEN RAISE EXCEPTION 'CASE_EXECUTION_RUN_IDENTITY_IMMUTABLE'; END IF;
      RETURN jsonb_build_object('caseId',run.case_id,'attemptId',run.case_attempt_id);
    END IF;
    IF p_payload->>'parentRunId' IS NOT NULL THEN
      SELECT * INTO parent FROM swarm_runs WHERE id=(p_payload->>'parentRunId')::uuid
        AND user_id=p_user_id AND case_id::text=p_payload->>'caseId' AND status='running';
      IF NOT FOUND OR parent.case_execution_principal IS DISTINCT FROM principal
      THEN RAISE EXCEPTION 'CASE_EXECUTION_PARENT_REQUIRED'; END IF;
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(parent.swarm_snapshot->'nodes') item
        WHERE item->>'id'=p_payload->>'parentNodeId'
          AND item#>>'{data,kind}'='subswarm' AND item#>>'{data,subSwarmId}'=run.swarm_id::text)
      THEN RAISE EXCEPTION 'CASE_EXECUTION_PARENT_NODE_REQUIRED'; END IF;
      attempt:=parent.case_attempt_id;
    ELSE
      IF p_payload->>'parentNodeId' IS NOT NULL
      THEN RAISE EXCEPTION 'CASE_EXECUTION_PARENT_REQUIRED'; END IF;
      IF principal->>'kind'='swarm_api_key' AND NOT EXISTS(SELECT 1 FROM swarm_api_keys k
        WHERE k.id::text=principal->>'id' AND k.user_id=p_user_id AND k.swarm_id=run.swarm_id)
      THEN RAISE EXCEPTION 'CASE_ACCESS_DENIED'; END IF;
      
      IF p_payload->'nativeStart'='true'::jsonb THEN
        IF principal->>'kind'<>'user_session'
          OR COALESCE(run.swarm_snapshot->>'startRequestHash','') !~ '^[a-f0-9]{64}$'
          OR COALESCE(run.swarm_snapshot->>'publishedVersionId','') !~ '^[a-f0-9-]{36}$'
        THEN RAISE EXCEPTION 'CASE_EXECUTION_BINDING_REQUIRED'; END IF;
        attempt:=run.id::text;
      ELSE
        attempt:=COALESCE(value->>'attempt_id',run.id::text);
      END IF;
  
      IF value->'execution_bindings' ? attempt OR EXISTS(SELECT 1 FROM swarm_runs WHERE case_id=(p_payload->>'caseId')::uuid
        AND case_attempt_id=attempt AND case_parent_run_id IS NULL AND id<>run.id)
      THEN RAISE EXCEPTION 'CASE_EXECUTION_READBACK_RECOVERY_REQUIRED'; END IF;
    END IF;
    UPDATE swarm_runs SET case_id=(p_payload->>'caseId')::uuid,case_attempt_id=attempt,
      case_parent_run_id=(p_payload->>'parentRunId')::uuid,case_parent_node_id=p_payload->>'parentNodeId',
      case_execution_principal=principal WHERE id=run.id;
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
      VALUES(custodian,'axtn_case_execution.RUN_BOUND','axtn_case_execution',run.id,stamp,
        jsonb_build_object('caseId',p_payload->>'caseId','attemptId',attempt,'principal',principal,
          'parentRunId',p_payload->'parentRunId','parentNodeId',p_payload->'parentNodeId'));
    RETURN jsonb_build_object('caseId',p_payload->>'caseId','attemptId',attempt);
  END IF;
  IF value->>'source_kind'='document_work'
    AND value#>>'{work_identity,inputManifest,privacyStatus}' IS DISTINCT FROM 'ELIGIBLE'
  THEN RAISE EXCEPTION 'CASE_EXECUTION_PRIVACY_HOLD'; END IF;
  node_id:=p_payload->>'nodeId';
  SELECT item INTO node FROM jsonb_array_elements(run.swarm_snapshot->'nodes') item WHERE item->>'id'=node_id;
  IF node IS NULL OR COALESCE(node#>>'{data,kind}',node->>'type') NOT IN (
    'agent','loop','evaluate','extract','foreach','condition','router')
  THEN RAISE EXCEPTION 'CASE_EXECUTION_SEMANTIC_NODE_REQUIRED'; END IF;
  binding:=value#>ARRAY['execution_bindings',run.case_attempt_id];
  IF p_operation='credential' AND (binding IS NULL OR NOT binding->'node_routes' ? (run.id::text||':'||node_id))
  THEN RAISE EXCEPTION 'CASE_EXECUTION_BINDING_REQUIRED'; END IF;
  gateway_route:=COALESCE(node#>>'{data,routeThroughGateway}','')='true';
  provider_id:=COALESCE(NULLIF(node#>>'{data,provider}',''),'openrouter');
  model_id:=COALESCE(NULLIF(node#>>'{data,model}',''),'google/gemini-3-flash-preview');
  personal:=provider_id='axtn_chatgpt_plan' AND NOT gateway_route;
  LOCK TABLE iam_model_rules,iam_settings,integrations,provider_credentials,budget_limits IN SHARE MODE;
  IF binding IS NULL THEN
    assignment_revision:=(value->>'assignment_version')::bigint;
    IF value->>'responsible_principal_type'='GROUP' THEN
      responsible_group:=(value->>'responsible_principal_id')::uuid;
      PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-personal-group:'||responsible_group::text,0));
    END IF;
    actor:=CASE WHEN personal THEN (value->>'assignee_user_id')::uuid ELSE p_user_id END;
    IF personal AND actor IS NULL AND responsible_group IS NOT NULL
      AND value->>'assignment_policy'='LEAST_ACTIVE_ELIGIBLE' THEN
      PERFORM 1 FROM iam_group_members WHERE iam_group_members.group_id=responsible_group FOR SHARE;
      PERFORM 1 FROM auth.users u JOIN iam_group_members m ON m.user_id=u.id
        WHERE m.group_id=responsible_group FOR SHARE OF u;
      SELECT u.id INTO actor FROM auth.users u JOIN iam_group_members m ON m.user_id=u.id
        WHERE m.group_id=responsible_group AND u.deleted_at IS NULL
          AND (u.banned_until IS NULL OR u.banned_until<=stamp)
          AND axtn_case_model_allowed(u.id,provider_id,model_id)
          AND (SELECT count(*) FROM axtn_case_credential_candidates(u.id,provider_id,true))=1
        ORDER BY (SELECT count(DISTINCT r.case_attempt_id) FROM swarm_runs r
          WHERE r.status IN ('running','suspended')
            AND r.case_execution_binding->>'execution_class'='PERSONAL_CONNECTION'
            AND r.case_execution_binding->>'responsible_group_id'=responsible_group::text
            AND r.case_execution_binding->>'execution_principal_user_id'=u.id::text),u.id LIMIT 1;
      IF actor IS NULL THEN RAISE EXCEPTION 'NO_ELIGIBLE_EXECUTION_PRINCIPAL'; END IF;
      assignment_revision:=assignment_revision+1;
      value:=value||jsonb_build_object('assignee_user_id',actor,'assignment_version',assignment_revision,
        'assignment_updated_at',stamp,'assignment_updated_by',principal->>'id');
      INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
        VALUES(custodian,'axtn_case_execution.GROUP_CLAIMED','axtn_case_execution',run.case_id,stamp,
          jsonb_build_object('caseId',run.case_id,'attemptId',run.case_attempt_id,
            'principal',principal,'groupId',responsible_group,'assigneeUserId',actor,
            'assignmentVersion',assignment_revision));
    END IF;
    IF actor IS NULL THEN RAISE EXCEPTION 'PERSONAL_CONNECTION_REQUIRED'; END IF;
    binding:=jsonb_build_object('case_id',run.case_id,'attempt_id',run.case_attempt_id,
      'assignment_version',assignment_revision,'semantic_route_version',value->'semantic_route_version',
      'execution_class',CASE WHEN personal THEN 'PERSONAL_CONNECTION' ELSE 'SYSTEM_INTEGRATION' END,
      'execution_principal_type',CASE WHEN personal THEN 'USER' ELSE 'SYSTEM' END,
      'execution_principal_user_id',CASE WHEN personal THEN actor ELSE NULL END,
      'data_scope_user_id',custodian,'policy_user_id',actor,
      'budget_subject_group_id',NULL,
      'budget_subject_user_id',actor,
      'responsible_group_id',responsible_group,'provider_id',provider_id,'model_id',model_id,
      'route_provider_id',value->'semantic_route_provider_id','route_model_id',value->'semantic_route_model_id',
      'routing_reason',CASE WHEN personal THEN 'CASE_PERSONAL_ASSIGNMENT' ELSE 'CASE_SYSTEM_POLICY' END,
      'bound_at',stamp,'node_routes','{}'::jsonb);
  END IF;
  first_actor:=(binding->>'policy_user_id')::uuid;
  IF personal THEN
    actor:=CASE WHEN binding->>'execution_class'='PERSONAL_CONNECTION' THEN first_actor
      ELSE (value->>'assignee_user_id')::uuid END;
    IF actor IS NULL THEN RAISE EXCEPTION 'PERSONAL_CONNECTION_REQUIRED'; END IF;
  ELSE
    actor:=p_user_id;
  END IF;
  PERFORM 1 FROM auth.users WHERE id=actor AND deleted_at IS NULL
    AND (banned_until IS NULL OR banned_until<=stamp) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CASE_EXECUTION_PRINCIPAL_INACTIVE'; END IF;
  IF personal AND binding->>'responsible_group_id' IS NOT NULL
    AND binding->>'execution_class'='PERSONAL_CONNECTION' THEN
    PERFORM 1 FROM iam_group_members WHERE iam_group_members.group_id=
      (binding->>'responsible_group_id')::uuid AND user_id=actor FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'NO_ELIGIBLE_EXECUTION_PRINCIPAL'; END IF;
  END IF;
  IF NOT axtn_case_model_allowed(actor,provider_id,model_id)
  THEN RAISE EXCEPTION 'MODEL_ACCESS_DENIED'; END IF;
  IF gateway_route THEN
    IF p_operation='credential' THEN RAISE EXCEPTION 'ROUTING_DECISION_REQUIRED'; END IF;
    SELECT count(*),(array_agg(i.id))[1] INTO candidate_count,gateway_id FROM integrations i
      WHERE i.user_id=actor AND i.type='llm_gateway' AND i.is_active;
    IF candidate_count=0 THEN RAISE EXCEPTION 'SYSTEM_INTEGRATION_UNAVAILABLE';
    ELSIF candidate_count<>1 THEN RAISE EXCEPTION 'SYSTEM_INTEGRATION_AMBIGUOUS'; END IF;
  ELSE
    SELECT count(*) INTO candidate_count FROM axtn_case_credential_candidates(actor,provider_id,personal);
  END IF;
  IF candidate_count=0 THEN RAISE EXCEPTION '%',
    CASE WHEN personal THEN 'PERSONAL_CONNECTION_REQUIRED' ELSE 'SYSTEM_INTEGRATION_UNAVAILABLE' END;
  ELSIF candidate_count<>1 THEN RAISE EXCEPTION '%',
    CASE WHEN personal THEN 'ROUTING_DECISION_REQUIRED' ELSE 'SYSTEM_INTEGRATION_AMBIGUOUS' END;
  END IF;
  IF p_operation='credential' THEN
    RETURN (SELECT jsonb_build_object('source',source,'ownerId',owner_id,'id',id)
      FROM axtn_case_credential_candidates(actor,provider_id,personal));
  END IF;
  node_class:=CASE WHEN personal THEN 'PERSONAL_CONNECTION' ELSE 'SYSTEM_INTEGRATION' END;
  operation_key:=p_payload->>'operationKey';
  IF operation_key IS NULL OR length(operation_key) NOT BETWEEN 1 AND 200
  THEN RAISE EXCEPTION 'CASE_EXECUTION_OPERATION_REQUIRED'; END IF;
  IF run.case_semantic_claims ? operation_key
  THEN RAISE EXCEPTION 'CASE_EXECUTION_READBACK_RECOVERY_REQUIRED'; END IF;
  binding:=binding||jsonb_build_object('node_routes',COALESCE(binding->'node_routes','{}')||
    jsonb_build_object(run.id::text||':'||node_id,jsonb_build_object('provider_id',provider_id,'model_id',model_id,
      'execution_class',node_class,'policy_user_id',actor,'budget_subject_user_id',actor)
      ||CASE WHEN gateway_route THEN jsonb_build_object('transport','LLM_GATEWAY','gateway_integration_id',gateway_id)
        ELSE '{}'::jsonb END));
  UPDATE user_data_rows r SET row=value||jsonb_build_object('execution_bindings',
    COALESCE(value->'execution_bindings','{}')||jsonb_build_object(run.case_attempt_id,binding))
    FROM user_data_tables t WHERE r.table_id=t.id AND t.name='axtn_cases'
      AND t.user_id=custodian AND r.row->>'case_id'=run.case_id::text;
  UPDATE swarm_runs SET case_execution_binding=binding,
    case_semantic_claims=case_semantic_claims||jsonb_build_object(operation_key,
      jsonb_build_object('nodeId',node_id,'boundAt',stamp)) WHERE id=run.id;
  INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
    VALUES(custodian,'axtn_case_execution.SEMANTIC_BOUND','axtn_case_execution',run.id,stamp,
      jsonb_build_object('caseId',run.case_id,'attemptId',run.case_attempt_id,'nodeId',node_id,
        'operationKey',operation_key,'principal',principal,'binding',binding));
  RETURN binding||jsonb_build_object('execution_class',node_class,
    'execution_principal_type',CASE WHEN personal THEN 'USER' ELSE 'SYSTEM' END,
    'execution_principal_user_id',CASE WHEN personal THEN actor ELSE NULL END,
    'policy_user_id',actor,'budget_subject_user_id',actor,'budget_subject_group_id',NULL,
    'provider_id',provider_id,'model_id',model_id);
END;
$function$;

-- Native owner-or-IAM-grant visibility is kept; only credential-owner liveness is added
-- (a deleted or banned owner's credential must not stay eligible).
CREATE OR REPLACE FUNCTION public.axtn_case_credential_candidates(actor uuid, provider_id text, personal boolean)
 RETURNS TABLE(source text, id uuid, owner_id uuid)
 LANGUAGE sql STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH grants AS (
    SELECT resource_type,resource_id FROM iam_resource_grants g WHERE NOT personal AND (
      g.principal_type='user' AND g.principal_id=actor
      OR g.principal_type='group' AND EXISTS(SELECT 1 FROM iam_group_members m
        WHERE m.user_id=actor AND m.group_id=g.principal_id))
  )
  SELECT 'integration',i.id,i.user_id FROM integrations i WHERE i.is_active
    AND i.type='llm_provider' AND i.provider=provider_id
    AND EXISTS(SELECT 1 FROM auth.users o WHERE o.id=i.user_id AND o.deleted_at IS NULL
      AND (o.banned_until IS NULL OR o.banned_until<=now()))
    AND (i.user_id=actor OR NOT personal AND EXISTS(SELECT 1 FROM grants g
        WHERE g.resource_type='integration' AND g.resource_id=i.id))
  UNION ALL
  SELECT 'provider_credential',c.id,c.user_id FROM provider_credentials c WHERE c.is_active
    AND c.provider=provider_id
    AND EXISTS(SELECT 1 FROM auth.users o WHERE o.id=c.user_id AND o.deleted_at IS NULL
      AND (o.banned_until IS NULL OR o.banned_until<=now()))
    AND (c.user_id=actor OR NOT personal AND EXISTS(SELECT 1 FROM grants g
        WHERE g.resource_type='provider_credential' AND g.resource_id=c.id));
$function$;
