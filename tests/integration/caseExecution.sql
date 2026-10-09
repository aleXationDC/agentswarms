\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='45s';
INSERT INTO knowledge_bases(id,user_id,name,is_sample)
  VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
  ON CONFLICT(id) DO NOTHING;
DO $$
DECLARE a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
  fixture_group uuid:=gen_random_uuid(); swarm uuid:=gen_random_uuid();
  first_run uuid:=gen_random_uuid(); second_run uuid:=gen_random_uuid();
  root jsonb; first_child jsonb; second_child jsonb; result jsonb; again jsonb; request jsonb;
  first_actor uuid; second_actor uuid; before_count bigint; original_case text;
  company_run uuid:=gen_random_uuid(); other_run uuid:=gen_random_uuid();
  other_group uuid:=gen_random_uuid(); company_case jsonb; other_case jsonb;
  system_group uuid:=gen_random_uuid(); group_integration uuid; company_integration uuid;
  group_swarm uuid:=gen_random_uuid();
  group_case jsonb; group_child jsonb; group_run uuid:=gen_random_uuid();
  group_child_run uuid:=gen_random_uuid(); signed_case jsonb; signed_run uuid:=gen_random_uuid();
  signed_credential uuid:=gen_random_uuid(); wrong_model_run uuid:=gen_random_uuid();
  wrong_provider_run uuid:=gen_random_uuid();
  private_trace uuid:=gen_random_uuid(); resource_key uuid:=gen_random_uuid(); total numeric;
  nested_parent uuid:=gen_random_uuid(); nested_child uuid:=gen_random_uuid();
  duplicate_child uuid:=gen_random_uuid(); child_swarm uuid:=gen_random_uuid();
  blocked_version bigint; blocked_events bigint; human_before jsonb;
  duplicate_integration uuid:=gen_random_uuid();
  native_one uuid:=gen_random_uuid(); native_two uuid:=gen_random_uuid();
  native_invalid uuid:=gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id,email,invited_at) VALUES(a,a||'@execution.invalid',now()),
    (b,b||'@execution.invalid',now()),(c,c||'@execution.invalid',now());
  INSERT INTO iam_groups(id,name) VALUES(fixture_group,'synthetic-execution-'||fixture_group);
  INSERT INTO iam_group_members(group_id,user_id) VALUES(fixture_group,b),(fixture_group,c);
  INSERT INTO iam_model_rules(principal_type,principal_id,provider,model_pattern)
    VALUES('user',b,'openai','fixture-model'),('user',c,'openai','fixture-model');
  INSERT INTO integrations(user_id,type,name,provider,is_active,config) VALUES
    (b,'llm_provider','Synthetic personal fixture','openai',true,'{}'),
    (c,'llm_provider','Synthetic personal fixture','openai',true,'{}');
  root:=axtn_case_manual(a,'create',jsonb_build_object('row',jsonb_build_object(
    'subject','Synthetic native execution','status','OPEN','priority',3,'source_kind','manual','source_id',a),
    'expectedVersion',0,'transitionKey','execution-root','_principal',jsonb_build_object('kind','user_session','id',a)));
  root:=axtn_case_assignment(a,'case_assignment',jsonb_build_object(
    'caseId',root->>'case_id','expectedVersion',1,'transitionKey','execution-group',
    'responsiblePrincipalType','GROUP','responsiblePrincipalId',fixture_group,'assigneeUserId',NULL,
    'assignmentPolicy','LEAST_ACTIVE_ELIGIBLE','assignmentInheritance','OVERRIDE',
    'semanticRouteMode','PERSONAL_CONNECTION','semanticRouteProviderId',NULL,'semanticRouteModelId',NULL,
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  first_child:=axtn_case_manual(a,'create',jsonb_build_object('row',jsonb_build_object(
    'subject','First synthetic group child','status','OPEN','priority',3,
    'source_kind','manual','source_id',a,'parent_case_id',root->>'case_id'),
    'expectedVersion',0,'transitionKey','execution-child-one','_principal',jsonb_build_object('kind','user_session','id',a)));
  second_child:=axtn_case_manual(a,'create',jsonb_build_object('row',jsonb_build_object(
    'subject','Second synthetic group child','status','OPEN','priority',3,
    'source_kind','manual','source_id',a,'parent_case_id',root->>'case_id'),
    'expectedVersion',0,'transitionKey','execution-child-two','_principal',jsonb_build_object('kind','user_session','id',a)));
  original_case:=first_child->>'case_id';
  INSERT INTO swarms(id,user_id,name) VALUES(swarm,a,'Synthetic execution fixture');
  INSERT INTO swarm_runs(id,user_id,swarm_id,status,swarm_snapshot) VALUES
    (first_run,a,swarm,'running','{"nodes":[{"id":"agent","data":{"kind":"agent","provider":"openai","model":"fixture-model"}}]}'),
    (second_run,a,swarm,'running','{"nodes":[{"id":"agent","data":{"kind":"agent","provider":"openai","model":"fixture-model"}}]}');
  request:=jsonb_build_object('runId',first_run,'caseId',original_case,
    '_principal',jsonb_build_object('kind','user_session','id',a));
  result:=axtn_case_execution(a,'bind_run',request);
  again:=axtn_case_execution(a,'bind_run',request);
  IF result IS DISTINCT FROM again THEN RAISE EXCEPTION 'Run binding replay differs'; END IF;
  PERFORM axtn_case_execution(a,'bind_run',jsonb_build_object(
    'runId',second_run,'caseId',second_child->>'case_id','_principal',jsonb_build_object('kind','user_session','id',a)));
  result:=axtn_case_execution(a,'resolve',jsonb_build_object('runId',first_run,'nodeId','agent','operationKey','agent/0'));
  first_actor:=(result->>'execution_principal_user_id')::uuid;
  IF first_actor<>least(b,c) OR result->>'execution_class'<>'PERSONAL_CONNECTION'
    OR result->>'data_scope_user_id'<>a::text OR result->>'attempt_id'<>first_run::text
    OR NOT result->'node_routes' ? (first_run::text||':agent')
  THEN RAISE EXCEPTION 'Stable tie-break/custody/server Attempt failed'; END IF;
  SELECT count(*) INTO before_count FROM audit_events;
  BEGIN
    PERFORM axtn_case_execution(a,'resolve',jsonb_build_object('runId',first_run,'nodeId','agent','operationKey','agent/0'));
    RAISE EXCEPTION 'Repeated semantic operation was not denied';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_EXECUTION_READBACK_RECOVERY_REQUIRED' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM audit_events)<>before_count THEN RAISE EXCEPTION 'Replay changed audit'; END IF;
  result:=axtn_case_execution(a,'resolve',jsonb_build_object('runId',second_run,'nodeId','agent','operationKey','agent/0'));
  second_actor:=(result->>'execution_principal_user_id')::uuid;
  IF second_actor=first_actor THEN RAISE EXCEPTION 'Least-active group balancing failed'; END IF;
  root:=axtn_case_assignment(a,'case_assignment',jsonb_build_object(
    'caseId',root->>'case_id','expectedVersion',2,'transitionKey','execution-parent-reassigned',
    'responsiblePrincipalType','USER','responsiblePrincipalId',second_actor,'assigneeUserId',second_actor,
    'assignmentPolicy','MANUAL','assignmentInheritance','OVERRIDE',
    'semanticRouteMode','PERSONAL_CONNECTION','semanticRouteProviderId',NULL,'semanticRouteModelId',NULL,
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  result:=axtn_case_execution(a,'resolve',jsonb_build_object('runId',first_run,'nodeId','agent','operationKey','agent/1'));
  IF result->>'execution_principal_user_id'<>first_actor::text
  THEN RAISE EXCEPTION 'Assignment changed active Attempt principal'; END IF;
  result:=axtn_case_execution(a,'credential',jsonb_build_object('runId',first_run,'nodeId','agent'));
  IF result->>'ownerId'<>first_actor::text OR result->>'source'<>'integration'
  THEN RAISE EXCEPTION 'Personal credential used another owner/grant'; END IF;
  INSERT INTO iam_groups(id,name) VALUES(other_group,'synthetic-other-funding-'||other_group);
  INSERT INTO iam_group_members(group_id,user_id) VALUES(other_group,b),(other_group,c);
  INSERT INTO budget_limits(scope_type,scope_id,monthly_cap_usd,is_active)
    VALUES('group',fixture_group,100,true),('group',other_group,100,true);
  INSERT INTO iam_model_rules(principal_type,principal_id,provider,model_pattern)
    VALUES('user',a,'openai','fixture-model'),('user',a,'vllm','fixture-model'),
      ('user',a,'gemini','fixture-model'),
      ('user',a,'anthropic','fixture-model');
  INSERT INTO integrations(user_id,type,name,provider,is_active,config)
    VALUES(a,'llm_provider','Synthetic company fixture','openai',true,'{}')
    RETURNING id INTO company_integration;
  company_case:=axtn_case_manual(a,'create',jsonb_build_object('row',jsonb_build_object(
    'subject','Synthetic company budget','status','OPEN','priority',3,'source_kind','manual','source_id',a),
    'expectedVersion',0,'transitionKey','company-case','_principal',jsonb_build_object('kind','user_session','id',a)));
  company_case:=axtn_case_assignment(a,'case_assignment',jsonb_build_object(
    'caseId',company_case->>'case_id','expectedVersion',1,'transitionKey','company-assignment',
    'responsiblePrincipalType','GROUP','responsiblePrincipalId',fixture_group,'assigneeUserId',NULL,
    'assignmentPolicy','MANUAL','assignmentInheritance','OVERRIDE',
    'semanticRouteMode','SYSTEM_INTEGRATION','semanticRouteProviderId',NULL,'semanticRouteModelId',NULL,
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  other_case:=axtn_case_manual(a,'create',jsonb_build_object('row',jsonb_build_object(
    'subject','Synthetic other company budget','status','OPEN','priority',3,'source_kind','manual','source_id',a),
    'expectedVersion',0,'transitionKey','other-company-case','_principal',jsonb_build_object('kind','user_session','id',a)));
  other_case:=axtn_case_assignment(a,'case_assignment',jsonb_build_object(
    'caseId',other_case->>'case_id','expectedVersion',1,'transitionKey','other-company-assignment',
    'responsiblePrincipalType','GROUP','responsiblePrincipalId',other_group,'assigneeUserId',NULL,
    'assignmentPolicy','MANUAL','assignmentInheritance','OVERRIDE',
    'semanticRouteMode','SYSTEM_INTEGRATION','semanticRouteProviderId',NULL,'semanticRouteModelId',NULL,
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  INSERT INTO swarm_runs(id,user_id,swarm_id,status,swarm_snapshot) VALUES
    (company_run,a,swarm,'running','{"nodes":[{"id":"agent","data":{"kind":"agent","provider":"openai","model":"fixture-model"}}]}'),
    (other_run,a,swarm,'running','{"nodes":[{"id":"agent","data":{"kind":"agent","provider":"openai","model":"fixture-model"}}]}');
  PERFORM axtn_case_execution(a,'bind_run',jsonb_build_object(
    'runId',company_run,'caseId',company_case->>'case_id','_principal',jsonb_build_object('kind','user_session','id',a)));
  BEGIN
    PERFORM axtn_case_execution(a,'resolve',jsonb_build_object(
      'runId',company_run,'nodeId','agent','operationKey','agent/no-own-grant'));
    RAISE EXCEPTION 'SYSTEM_INTEGRATION accepted the actor-owned credential without an IAM grant';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SYSTEM_INTEGRATION_UNAVAILABLE' THEN RAISE; END IF;
  END;
  INSERT INTO iam_resource_grants(principal_type,principal_id,resource_type,resource_id)
    VALUES('user',a,'integration',company_integration);
  result:=axtn_case_execution(a,'resolve',jsonb_build_object('runId',company_run,'nodeId','agent','operationKey','agent/0'));
  IF result->>'budget_subject_group_id'<>fixture_group::text OR result->>'budget_subject_user_id' IS NOT NULL
    OR result->>'execution_class'<>'SYSTEM_INTEGRATION' OR result->>'policy_user_id'<>a::text
  THEN RAISE EXCEPTION 'Configured company funding did not bind responsible group'; END IF;
  result:=axtn_case_execution(a,'credential',jsonb_build_object('runId',company_run,'nodeId','agent'));
  IF result->>'ownerId'<>a::text OR result->>'source'<>'integration'
    OR result->>'id'<>company_integration::text
  THEN RAISE EXCEPTION 'Explicit user grant did not select the exact company integration'; END IF;
  PERFORM axtn_case_execution(a,'bind_run',jsonb_build_object(
    'runId',other_run,'caseId',other_case->>'case_id','_principal',jsonb_build_object('kind','user_session','id',a)));
  PERFORM axtn_case_execution(a,'resolve',jsonb_build_object('runId',other_run,'nodeId','agent','operationKey','agent/0'));

  INSERT INTO iam_groups(id,name) VALUES(system_group,'synthetic-system-grant-'||system_group);
  INSERT INTO iam_group_members(group_id,user_id) VALUES(system_group,a);
  INSERT INTO integrations(id,user_id,type,name,provider,is_active,config) VALUES
    (gen_random_uuid(),b,'llm_provider','Synthetic group-granted company fixture','vllm',true,'{}')
    RETURNING id INTO group_integration;
  group_case:=axtn_case_manual(a,'create',jsonb_build_object('row',jsonb_build_object(
    'subject','Synthetic group-granted company Case','status','OPEN','priority',3,
    'source_kind','manual','source_id',a),
    'expectedVersion',0,'transitionKey','system-group-case',
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  group_case:=axtn_case_assignment(a,'case_assignment',jsonb_build_object(
    'caseId',group_case->>'case_id','expectedVersion',1,'transitionKey','system-group-assignment',
    'responsiblePrincipalType','GROUP','responsiblePrincipalId',system_group,'assigneeUserId',NULL,
    'assignmentPolicy','MANUAL','assignmentInheritance','OVERRIDE',
    'semanticRouteMode','SYSTEM_INTEGRATION','semanticRouteProviderId',NULL,'semanticRouteModelId',NULL,
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  group_child:=axtn_case_manual(a,'create',jsonb_build_object('row',jsonb_build_object(
    'subject','Synthetic inherited system child','status','OPEN','priority',3,
    'source_kind','manual','source_id',a,'parent_case_id',group_case->>'case_id'),
    'expectedVersion',0,'transitionKey','system-group-child',
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  SELECT r.row INTO group_child FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=a AND t.name='axtn_cases' AND r.row->>'parent_case_id'=group_case->>'case_id';
  IF group_child->>'semantic_route_mode'<>'SYSTEM_INTEGRATION'
    OR group_child->>'responsible_principal_id'<>system_group::text
    OR group_child->>'assignment_inheritance'<>'INHERIT'
  THEN RAISE EXCEPTION 'Child Case did not inherit company route and group responsibility'; END IF;
  INSERT INTO swarms(id,user_id,name) VALUES(group_swarm,a,'Synthetic provider-credential fixture');
  INSERT INTO swarm_runs(id,user_id,swarm_id,status,swarm_snapshot) VALUES
    (group_run,a,group_swarm,'running',
      '{"nodes":[{"id":"agent","data":{"kind":"agent","provider":"vllm","model":"fixture-model"}}]}'),
    (group_child_run,a,group_swarm,'running',
      '{"nodes":[{"id":"agent","data":{"kind":"agent","provider":"vllm","model":"fixture-model"}}]}');
  PERFORM axtn_case_execution(a,'bind_run',jsonb_build_object(
    'runId',group_run,'caseId',group_case->>'case_id',
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  BEGIN
    PERFORM axtn_case_execution(a,'resolve',jsonb_build_object(
      'runId',group_run,'nodeId','agent','operationKey','agent/no-third-party-grant'));
    RAISE EXCEPTION 'SYSTEM_INTEGRATION accepted an ungranted third-party credential';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SYSTEM_INTEGRATION_UNAVAILABLE' THEN RAISE; END IF;
  END;
  INSERT INTO iam_resource_grants(principal_type,principal_id,resource_type,resource_id)
    VALUES('group',system_group,'integration',group_integration);
  result:=axtn_case_execution(a,'resolve',jsonb_build_object(
    'runId',group_run,'nodeId','agent','operationKey','agent/group-grant'));
  IF result->>'execution_class'<>'SYSTEM_INTEGRATION'
    OR result->>'policy_user_id'<>a::text
    OR result->>'provider_id'<>'vllm'
  THEN RAISE EXCEPTION 'Effective group grant did not authorize the server-bound company Case'; END IF;
  result:=axtn_case_execution(a,'credential',jsonb_build_object('runId',group_run,'nodeId','agent'));
  IF result->>'ownerId'<>b::text OR result->>'source'<>'integration'
    OR result->>'id'<>group_integration::text
  THEN RAISE EXCEPTION 'Group grant selected a different provider credential'; END IF;
  PERFORM axtn_case_execution(a,'bind_run',jsonb_build_object(
    'runId',group_child_run,'caseId',group_child->>'case_id',
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  result:=axtn_case_execution(a,'resolve',jsonb_build_object(
    'runId',group_child_run,'nodeId','agent','operationKey','agent/inherited-group-grant'));
  IF result->>'case_id'<>group_child->>'case_id'
    OR result->>'execution_class'<>'SYSTEM_INTEGRATION'
    OR result->>'policy_user_id'<>a::text
  THEN RAISE EXCEPTION 'Inherited Child Case did not retain its native system execution binding'; END IF;
  DELETE FROM iam_group_members WHERE group_id=system_group AND user_id=a;
  BEGIN
    PERFORM axtn_case_execution(a,'credential',jsonb_build_object('runId',group_run,'nodeId','agent'));
    RAISE EXCEPTION 'Revoked group membership retained corporate credential access';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SYSTEM_INTEGRATION_UNAVAILABLE' THEN RAISE; END IF;
  END;
  INSERT INTO iam_group_members(group_id,user_id) VALUES(system_group,a);
  UPDATE integrations SET is_active=false WHERE id=group_integration;
  BEGIN
    PERFORM axtn_case_execution(a,'credential',jsonb_build_object('runId',group_run,'nodeId','agent'));
    RAISE EXCEPTION 'Inactive IAM-granted integration was selected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SYSTEM_INTEGRATION_UNAVAILABLE' THEN RAISE; END IF;
  END;
  UPDATE integrations SET is_active=true WHERE id=group_integration;
  INSERT INTO iam_resource_grants(principal_type,principal_id,resource_type,resource_id)
    VALUES('user',a,'integration',group_integration);
  UPDATE integrations SET is_active=false WHERE id=group_integration;
  BEGIN
    PERFORM axtn_case_execution(a,'credential',jsonb_build_object('runId',group_run,'nodeId','agent'));
    RAISE EXCEPTION 'Duplicate grants bypassed inactive resource rejection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SYSTEM_INTEGRATION_UNAVAILABLE' THEN RAISE; END IF;
  END;
  UPDATE integrations SET is_active=true WHERE id=group_integration;
  DELETE FROM iam_resource_grants WHERE resource_type='integration' AND resource_id=group_integration;
  DELETE FROM integrations WHERE id=group_integration;
  INSERT INTO iam_resource_grants(principal_type,principal_id,resource_type,resource_id)
    VALUES('group',system_group,'integration',group_integration);
  BEGIN
    PERFORM axtn_case_execution(a,'credential',jsonb_build_object('runId',group_run,'nodeId','agent'));
    RAISE EXCEPTION 'Deleted IAM-granted integration was selected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SYSTEM_INTEGRATION_UNAVAILABLE' THEN RAISE; END IF;
  END;

  signed_case:=axtn_case_manual(a,'create',jsonb_build_object('row',jsonb_build_object(
    'subject','Synthetic provider-credential Case','status','OPEN','priority',3,
    'source_kind','manual','source_id',a),
    'expectedVersion',0,'transitionKey','signed-system-case',
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  signed_case:=axtn_case_assignment(a,'case_assignment',jsonb_build_object(
    'caseId',signed_case->>'case_id','expectedVersion',1,'transitionKey','signed-system-assignment',
    'responsiblePrincipalType','USER','responsiblePrincipalId',a,'assigneeUserId',a,
    'assignmentPolicy','MANUAL','assignmentInheritance','OVERRIDE',
    'semanticRouteMode','SYSTEM_INTEGRATION','semanticRouteProviderId',NULL,'semanticRouteModelId',NULL,
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  INSERT INTO provider_credentials(id,user_id,provider,label,credentials,config,is_active)
    VALUES(signed_credential,c,'anthropic','Synthetic company fixture',
      '{"ciphertext":"synthetic-ciphertext","iv":"synthetic-iv"}','{}',true);
  INSERT INTO swarm_runs(id,user_id,swarm_id,status,swarm_snapshot) VALUES
    (signed_run,a,swarm,'running',
      '{"nodes":[{"id":"agent","data":{"kind":"agent","provider":"anthropic","model":"fixture-model"}}]}');
  PERFORM axtn_case_execution(a,'bind_run',jsonb_build_object(
    'runId',signed_run,'caseId',signed_case->>'case_id',
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  BEGIN
    PERFORM axtn_case_execution(a,'resolve',jsonb_build_object(
      'runId',signed_run,'nodeId','agent','operationKey','agent/provider-credential-no-grant'));
    RAISE EXCEPTION 'SYSTEM_INTEGRATION accepted an ungranted provider_credentials row';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SYSTEM_INTEGRATION_UNAVAILABLE' THEN RAISE; END IF;
  END;
  INSERT INTO iam_resource_grants(principal_type,principal_id,resource_type,resource_id)
    VALUES('user',a,'provider_credential',signed_credential);
  result:=axtn_case_execution(a,'resolve',jsonb_build_object(
    'runId',signed_run,'nodeId','agent','operationKey','agent/provider-credential-grant'));
  result:=axtn_case_execution(a,'credential',jsonb_build_object('runId',signed_run,'nodeId','agent'));
  IF result->>'ownerId'<>c::text OR result->>'source'<>'provider_credential'
    OR result->>'id'<>signed_credential::text
  THEN RAISE EXCEPTION 'Explicit IAM grant did not authorize the exact provider_credentials row'; END IF;
  DELETE FROM iam_resource_grants WHERE resource_type='provider_credential' AND resource_id=signed_credential;
  BEGIN
    PERFORM axtn_case_execution(a,'credential',jsonb_build_object('runId',signed_run,'nodeId','agent'));
    RAISE EXCEPTION 'Revoked provider-credential grant remained effective';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SYSTEM_INTEGRATION_UNAVAILABLE' THEN RAISE; END IF;
  END;
  INSERT INTO iam_resource_grants(principal_type,principal_id,resource_type,resource_id)
    VALUES('user',a,'provider_credential',signed_credential);
  UPDATE provider_credentials SET is_active=false WHERE id=signed_credential;
  BEGIN
    PERFORM axtn_case_execution(a,'credential',jsonb_build_object('runId',signed_run,'nodeId','agent'));
    RAISE EXCEPTION 'Inactive IAM-granted provider credential was selected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SYSTEM_INTEGRATION_UNAVAILABLE' THEN RAISE; END IF;
  END;
  UPDATE provider_credentials SET is_active=true WHERE id=signed_credential;

  INSERT INTO swarm_runs(id,user_id,swarm_id,status,swarm_snapshot) VALUES
    (wrong_model_run,a,swarm,'running',
      '{"nodes":[{"id":"agent","data":{"kind":"agent","provider":"openai","model":"unapproved-model"}}]}'),
    (wrong_provider_run,a,swarm,'running',
      '{"nodes":[{"id":"agent","data":{"kind":"agent","provider":"gemini","model":"fixture-model"}}]}');
  PERFORM axtn_case_execution(a,'bind_run',jsonb_build_object(
    'runId',wrong_model_run,'caseId',company_case->>'case_id',
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  BEGIN
    PERFORM axtn_case_execution(a,'resolve',jsonb_build_object(
      'runId',wrong_model_run,'nodeId','agent','operationKey','agent/wrong-model'));
    RAISE EXCEPTION 'SYSTEM_INTEGRATION bypassed the native model allow rule';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'MODEL_ACCESS_DENIED' THEN RAISE; END IF;
  END;
  PERFORM axtn_case_execution(a,'bind_run',jsonb_build_object(
    'runId',wrong_provider_run,'caseId',company_case->>'case_id',
    '_principal',jsonb_build_object('kind','user_session','id',a)));
  BEGIN
    PERFORM axtn_case_execution(a,'resolve',jsonb_build_object(
      'runId',wrong_provider_run,'nodeId','agent','operationKey','agent/wrong-provider'));
    RAISE EXCEPTION 'Grant for another provider authorized this Case node';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SYSTEM_INTEGRATION_UNAVAILABLE' THEN RAISE; END IF;
  END;
  UPDATE budget_limits SET is_active=false WHERE scope_type='group' AND scope_id=fixture_group;
  result:=axtn_case_execution(a,'resolve',jsonb_build_object('runId',company_run,'nodeId','agent','operationKey','agent/1'));
  IF result->>'budget_subject_group_id'<>fixture_group::text
  THEN RAISE EXCEPTION 'Live cap change silently changed Attempt payer'; END IF;
  INSERT INTO execution_traces(id,user_id,agent_name,llm_provider,llm_model,prompt,cost_usd,
    budget_execution_run_id,budget_subject_user_id,cost_scope_type,cost_scope_id)
    VALUES(private_trace,a,'Synthetic private personal trace','openai','fixture-model',
      'SYNTHETIC_PRIVATE_CUSTODY_MARKER',2,first_run,first_actor,'swarm_api_key',resource_key);
  INSERT INTO execution_traces(user_id,agent_name,llm_provider,llm_model,cost_usd,
    budget_execution_run_id,budget_subject_user_id) VALUES
    (a,'Synthetic second personal trace','openai','fixture-model',3,second_run,second_actor);
  INSERT INTO execution_traces(user_id,agent_name,llm_provider,llm_model,cost_usd,
    budget_execution_run_id,budget_subject_group_id,cost_scope_type,cost_scope_id) VALUES
    (a,'Synthetic company trace','openai','fixture-model',5,company_run,fixture_group,'swarm_api_key',resource_key),
    (a,'Synthetic other company trace','openai','fixture-model',13,other_run,other_group,NULL,NULL);
  INSERT INTO execution_traces(user_id,agent_name,llm_provider,llm_model,cost_usd) VALUES
    (first_actor,'Synthetic legacy member trace','openai','fixture-model',1),
    (a,'Synthetic legacy operator trace','openai','fixture-model',7);
  PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
  IF budget_spend_since(a,date_trunc('month',now()))<>7
    OR budget_spend_since(first_actor,date_trunc('month',now()))<>3
    OR budget_spend_since(second_actor,date_trunc('month',now()))<>3
    OR (axtn_case_group_spend(fixture_group,date_trunc('month',now()))->>'spend')::numeric<>11
    OR (axtn_case_group_spend(other_group,date_trunc('month',now()))->>'spend')::numeric<>19
    OR budget_spend_since(NULL,date_trunc('month',now()),'swarm_api_key',resource_key)<>7
  THEN RAISE EXCEPTION 'Company/personal/operator/key attribution cross-charged or double-counted'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',first_actor)::text,true);
  SET LOCAL ROLE authenticated;
  IF EXISTS(SELECT 1 FROM execution_traces WHERE id=private_trace)
  THEN RAISE EXCEPTION 'Payer received private Case prompt custody'; END IF;
  total:=budget_spend_since(first_actor,date_trunc('month',now()));
  IF total<>3 THEN RAISE EXCEPTION 'Own budget cannot include scoped cost without private trace read'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',a)::text,true);
  SET LOCAL ROLE authenticated;
  BEGIN
    INSERT INTO execution_traces(user_id,agent_name,llm_provider,llm_model,cost_usd,
      budget_execution_run_id,budget_subject_user_id)
      VALUES(a,'Synthetic forged billing','openai','fixture-model',2,first_run,first_actor);
    RAISE EXCEPTION 'Generic authenticated insert forged foreign payer';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_EXECUTION_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  RESET ROLE;
  BEGIN
    UPDATE execution_traces SET budget_subject_user_id=a WHERE id=private_trace;
    RAISE EXCEPTION 'Historical payer changed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_EXECUTION_BUDGET_IDENTITY_IMMUTABLE' THEN RAISE; END IF;
  END;
  INSERT INTO swarms(id,user_id,name) VALUES(child_swarm,a,'Synthetic nested Case fixture');
  INSERT INTO swarm_runs(id,user_id,swarm_id,status,swarm_snapshot) VALUES
    (nested_parent,a,swarm,'running',jsonb_build_object('nodes',jsonb_build_array(jsonb_build_object(
      'id','child','data',jsonb_build_object('kind','subswarm','subSwarmId',child_swarm))))),
    (nested_child,a,child_swarm,'running','{"nodes":[{"id":"agent","data":{"kind":"agent","provider":"openai","model":"fixture-model"}}]}'),
    (duplicate_child,a,child_swarm,'running','{"nodes":[{"id":"agent","data":{"kind":"agent","provider":"openai","model":"fixture-model"}}]}');
  PERFORM axtn_case_execution(a,'bind_run',jsonb_build_object(
    'runId',nested_parent,'caseId',company_case->>'case_id','_principal',jsonb_build_object('kind','user_session','id',a)));
  result:=axtn_case_execution(a,'bind_run',jsonb_build_object(
    'runId',nested_child,'caseId',company_case->>'case_id','parentRunId',nested_parent,
    'parentNodeId','child','_principal',jsonb_build_object('kind','user_session','id',a)));
  IF result->>'attemptId'<>nested_parent::text OR (SELECT case_parent_node_id FROM swarm_runs WHERE id=nested_child)<>'child'
  THEN RAISE EXCEPTION 'Native nested run did not inherit exact parent Attempt/node'; END IF;
  BEGIN
    PERFORM axtn_case_execution(a,'bind_run',jsonb_build_object(
      'runId',duplicate_child,'caseId',company_case->>'case_id','parentRunId',nested_parent,
      'parentNodeId','forged-node','_principal',jsonb_build_object('kind','user_session','id',a)));
    RAISE EXCEPTION 'Forged parent node accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_EXECUTION_PARENT_NODE_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_execution(a,'bind_run',jsonb_build_object(
      'runId',duplicate_child,'caseId',company_case->>'case_id','parentRunId',nested_parent,
      'parentNodeId','child','_principal',jsonb_build_object('kind','user_session','id',a)));
    RAISE EXCEPTION 'Duplicate parent/node child accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  INSERT INTO swarm_run_checkpoints(run_id,user_id,source,depth,ctx,last_output,
    completed_node_ids,skipped_node_ids,dead_edge_ids,level_index,suspended_node_id)
    VALUES(nested_child,a,'api',1,'{}','synthetic',ARRAY[]::text[],ARRAY[]::text[],ARRAY[]::text[],0,'agent');
  SET LOCAL ROLE authenticated;
  BEGIN
    UPDATE swarm_run_checkpoints SET completed_node_ids=ARRAY['agent'] WHERE run_id=nested_child;
    RAISE EXCEPTION 'Generic caller forged native checkpoint completion';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_EXECUTION_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE swarm_runs SET status='success' WHERE id=nested_child;
    RAISE EXCEPTION 'Generic caller forged native Case run success';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_EXECUTION_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM swarm_runs WHERE id=nested_child;
    RAISE EXCEPTION 'Generic caller deleted protected native Case execution identity';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_EXECUTION_NATIVE_RETENTION_REQUIRED' THEN RAISE; END IF;
  END;
  RESET ROLE;
  SELECT id INTO duplicate_integration FROM integrations WHERE user_id=first_actor AND provider='openai';
  INSERT INTO iam_resource_grants(principal_type,principal_id,resource_type,resource_id)
    VALUES('user',a,'integration',duplicate_integration);
  BEGIN
    PERFORM axtn_case_execution(a,'credential',jsonb_build_object('runId',other_run,'nodeId','agent'));
    RAISE EXCEPTION 'Ambiguous company connection silently selected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SYSTEM_INTEGRATION_AMBIGUOUS' THEN RAISE; END IF;
  END;
  DELETE FROM iam_resource_grants WHERE principal_id=a AND resource_type='integration' AND resource_id=duplicate_integration;
  UPDATE integrations SET is_active=false WHERE user_id=a AND provider='openai';
  BEGIN
    PERFORM axtn_case_execution(a,'credential',jsonb_build_object('runId',other_run,'nodeId','agent'));
    RAISE EXCEPTION 'Missing company connection silently selected another payer';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SYSTEM_INTEGRATION_UNAVAILABLE' THEN RAISE; END IF;
  END;
  UPDATE integrations SET is_active=true WHERE user_id=a AND provider='openai';
  INSERT INTO iam_resource_grants(principal_type,principal_id,resource_type,resource_id)
    SELECT 'user',second_actor,'integration',id FROM integrations WHERE user_id=first_actor AND provider='openai';
  UPDATE integrations SET is_active=false WHERE user_id=second_actor AND provider='openai';
  BEGIN
    PERFORM axtn_case_execution(a,'credential',jsonb_build_object('runId',second_run,'nodeId','agent'));
    RAISE EXCEPTION 'Personal connection fell back to granted foreign connection';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'PERSONAL_CONNECTION_REQUIRED' THEN RAISE; END IF;
  END;
  UPDATE integrations SET is_active=true WHERE user_id=second_actor AND provider='openai';
  DELETE FROM iam_group_members WHERE group_id=fixture_group AND user_id=first_actor;
  BEGIN
    PERFORM axtn_case_execution(a,'resolve',jsonb_build_object('runId',first_run,'nodeId','agent','operationKey','agent/2'));
    RAISE EXCEPTION 'Revoked execution principal was not denied';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'NO_ELIGIBLE_EXECUTION_PRINCIPAL' THEN RAISE; END IF;
  END;
  UPDATE auth.users SET deleted_at=now() WHERE id=c;
  BEGIN
    PERFORM axtn_case_execution(a,'credential',jsonb_build_object('runId',signed_run,'nodeId','agent'));
    RAISE EXCEPTION 'Credential owned by a deleted principal remained eligible';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'SYSTEM_INTEGRATION_UNAVAILABLE' THEN RAISE; END IF;
  END;
  IF (SELECT t.user_id FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE r.row->>'case_id'=original_case)<>a
  THEN RAISE EXCEPTION 'Custody changed'; END IF;
  SELECT count(*) INTO before_count FROM audit_events;
  BEGIN
    PERFORM axtn_case_execution(b,'block',jsonb_build_object(
      'runId',company_run,'reasonCode','SYSTEM_INTEGRATION_QUOTA_REACHED'));
    RAISE EXCEPTION 'Foreign principal blocked native Case';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ACCESS_DENIED' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM audit_events)<>before_count THEN RAISE EXCEPTION 'Denied block changed audit'; END IF;
  result:=axtn_case_execution(a,'block',jsonb_build_object(
    'runId',company_run,'reasonCode','SYSTEM_INTEGRATION_QUOTA_REACHED'));
  SELECT r.row INTO company_case FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=a AND t.name='axtn_cases' AND r.row->>'case_id'=company_case->>'case_id';
  IF result->>'disposition'<>'BLOCKED' OR company_case->>'status'='CLOSED'
    OR company_case->>'processing_stage'<>'WAITING_EXTERNAL_CAPABILITY'
    OR company_case->>'waiting_reason'<>'CAPABILITY_UNAVAILABLE'
  THEN RAISE EXCEPTION 'Typed failure did not atomically block existing native Processing'; END IF;
  blocked_version:=(company_case->>'processing_version')::bigint;
  SELECT count(*) INTO blocked_events FROM audit_events WHERE action='axtn_case_execution.BLOCKED'
    AND resource_id=company_run;
  IF blocked_events<>1 OR NOT EXISTS(SELECT 1 FROM audit_events WHERE action='axtn_case_execution.BLOCKED'
    AND resource_id=company_run AND detail->>'caseId'=company_case->>'case_id'
    AND detail->>'attemptId'=company_run::text AND detail#>>'{principal,id}'=a::text)
  THEN RAISE EXCEPTION 'Failure lost Case/Attempt/Actor evidence'; END IF;
  UPDATE swarm_runs SET status='error' WHERE id=company_run;
  UPDATE user_data_rows r SET row=r.row||jsonb_build_object('attempt_id',company_run)
    FROM user_data_tables t WHERE t.id=r.table_id AND t.user_id=a AND t.name='axtn_cases'
      AND r.row->>'case_id'=company_case->>'case_id';
  BEGIN
    PERFORM axtn_case_execution(a,'bind_run',jsonb_build_object(
      'runId',duplicate_child,'caseId',company_case->>'case_id',
      '_principal',jsonb_build_object('kind','user_session','id',a)));
    RAISE EXCEPTION 'New root duplicated the existing Work Attempt';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_EXECUTION_READBACK_RECOVERY_REQUIRED' THEN RAISE; END IF;
  END;
  again:=axtn_case_execution(a,'block',jsonb_build_object(
    'runId',company_run,'reasonCode','SYSTEM_INTEGRATION_QUOTA_REACHED'));
  IF result IS DISTINCT FROM again OR (SELECT count(*) FROM audit_events
    WHERE action='axtn_case_execution.BLOCKED' AND resource_id=company_run)<>blocked_events
    OR (SELECT (r.row->>'processing_version')::bigint FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=a AND t.name='axtn_cases' AND r.row->>'case_id'=company_case->>'case_id')<>blocked_version
  THEN RAISE EXCEPTION 'Failure readback repeated processing/audit after native run completed'; END IF;
  UPDATE user_data_rows r SET row=r.row||'{"processing_mode":"HUMAN"}'
    FROM user_data_tables t WHERE t.id=r.table_id AND t.user_id=a AND t.name='axtn_cases'
      AND r.row->>'case_id'=other_case->>'case_id'
    RETURNING r.row INTO human_before;
  result:=axtn_case_execution(a,'block',jsonb_build_object(
    'runId',other_run,'reasonCode','PROVIDER_UNAVAILABLE'));
  IF result->>'disposition'<>'HUMAN_TAKEOVER_FENCED' OR NOT EXISTS(
    SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id WHERE t.user_id=a
      AND t.name='axtn_cases' AND r.row->>'case_id'=other_case->>'case_id'
      AND r.row=human_before)
  THEN RAISE EXCEPTION 'Semantic failure overwrote Human takeover'; END IF;
  IF has_function_privilege('authenticated','public.axtn_case_execution(uuid,text,jsonb)','EXECUTE')
    OR has_function_privilege('service_role','public.axtn_case_credential_candidates(uuid,text,boolean)','EXECUTE')
  THEN RAISE EXCEPTION 'Private native execution authority exposed'; END IF;
  SET LOCAL ROLE service_role;
  BEGIN
    UPDATE swarm_runs SET case_semantic_claims='{}' WHERE id=first_run;
    RAISE EXCEPTION 'Generic service reset semantic claim';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_EXECUTION_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  RESET ROLE;
  INSERT INTO swarm_runs(id,user_id,swarm_id,status,swarm_snapshot) VALUES
    (native_one,a,swarm,'running',jsonb_build_object(
      'startRequestHash',repeat('a',64),'publishedVersionId',gen_random_uuid(),'nodes','[]'::jsonb)),
    (native_two,a,swarm,'running',jsonb_build_object(
      'startRequestHash',repeat('b',64),'publishedVersionId',gen_random_uuid(),'nodes','[]'::jsonb)),
    (native_invalid,a,swarm,'running','{}');
  FOR request IN SELECT jsonb_build_object('runId',id,'caseId',company_case->>'case_id',
      'nativeStart',true,'_principal',jsonb_build_object('kind','user_session','id',a))
      FROM swarm_runs WHERE id IN(native_one,native_two)
  LOOP
    result:=axtn_case_execution(a,'bind_run',request);
    SELECT count(*) INTO before_count FROM audit_events;
    again:=axtn_case_execution(a,'bind_run',request);
    IF result->>'attemptId'<>request->>'runId' OR result IS DISTINCT FROM again
      OR (SELECT count(*) FROM audit_events)<>before_count
    THEN RAISE EXCEPTION 'Explicit native execution attempt/replay failed'; END IF;
  END LOOP;
  IF (SELECT r.row->>'attempt_id' FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=a AND t.name='axtn_cases' AND r.row->>'case_id'=company_case->>'case_id')<>company_run::text
  THEN RAISE EXCEPTION 'Native start replaced retained Work/Candidate attempt'; END IF;
  BEGIN
    PERFORM axtn_case_execution(a,'bind_run',jsonb_build_object(
      'runId',native_invalid,'caseId',company_case->>'case_id','nativeStart',true,
      '_principal',jsonb_build_object('kind','user_session','id',a)));
    RAISE EXCEPTION 'Native start accepted absent server provenance';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_EXECUTION_BINDING_REQUIRED' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: native binding, balancing, sticky principal/payer, exact cost scopes, private prompt RLS, nested uniqueness/forgery denial, failure processing/replay/HUMAN fence and revocation; no provider call/Acceptance';
END;
$$;
ROLLBACK;
