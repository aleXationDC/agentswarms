\set ON_ERROR_STOP on
BEGIN;
INSERT INTO knowledge_bases(id,user_id,name,is_sample)
  VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
  ON CONFLICT(id) DO NOTHING;
CREATE TEMP TABLE environment_fixture(owner_id uuid,other_id uuid,case_id uuid,integration_id uuid,
  dataset_id uuid,request jsonb);
DO $$
DECLARE owner uuid := gen_random_uuid(); other uuid := gen_random_uuid();
  human jsonb; machine jsonb; work jsonb; state jsonb; second_case jsonb;
  integration_id uuid := gen_random_uuid(); binding jsonb; dataset uuid;
  request jsonb; result jsonb; before_count bigint; value text;
BEGIN
  INSERT INTO auth.users(id,email,invited_at)
    VALUES(owner,owner::text||'@pilot.invalid',now()),(other,other::text||'@pilot.invalid',now());
  human := jsonb_build_object('kind','user_session','id',owner);
  machine := jsonb_build_object('kind','swarm','id',owner);
  work := jsonb_build_object('sourceId','pilot:external-fixture','subject','External fixture',
    'caseType','DEVELOPMENT_BUILD','workContractRef',jsonb_build_object(
      'kind','contract','repository','aXtn/aXtn-agentswarms',
      'id','tests/integration/caseEnvironment.sql','revision',repeat('a',40)),
    'scenarioClass','regression','scenarioId','external-fixture',
    'processingMode','DETERMINISTIC','executionChannel','SWARM','actorRef',owner,
    'requiredDependencies','[]'::jsonb,'references','[]'::jsonb,
    '_principal',machine);
  state := axtn_case_work(owner,'ensure',work);
  second_case := axtn_case_work(owner,'ensure',work||jsonb_build_object(
    'sourceId','pilot:external-fixture-child','parentCaseId',state->>'case_id'));
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=owner AND name='axtn_cases';
  SELECT row INTO state FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=state->>'case_id';
  UPDATE user_data_tables SET columns=columns||'[{"name":"operator_column","type":"string"}]'::jsonb
    WHERE id=dataset;
  INSERT INTO integrations(id,user_id,type,name,is_active,config)
    VALUES(integration_id,owner,'notification','Authorized ticket fixture',true,'{"retained":"operator-config"}');
  binding := axtn_case_environment(owner,'environment_binding',jsonb_build_object(
    'integrationId',integration_id,'environmentId','  Env-01 ','enabled',true,
    'expectedVersion',0,'transitionKey','env-confirm','_principal',human));
  IF (SELECT config->>'retained' FROM integrations WHERE id=integration_id)<>'operator-config'
    OR binding->>'environmentId'<>'  Env-01 '
  THEN RAISE EXCEPTION 'Integration confirmation lost exact identity or configuration'; END IF;
  result:=axtn_case_environment(owner,'environment_binding_state',jsonb_build_object(
    'integrationId',integration_id,'_principal',human));
  IF result IS DISTINCT FROM jsonb_build_object('environmentId','  Env-01 ','enabled',true,'version',1)
    OR result ? 'config' OR result ? 'confirmedBy'
  THEN RAISE EXCEPTION 'Minimized binding/version readback failed'; END IF;
  request := jsonb_build_object('caseId',state->>'case_id','expectedVersion',0,
    'transitionKey','refs-01','patch',jsonb_build_object(
      'external_environment_id','  Env-01 ','external_ref_id','0001/Ä',
      'external_parent_ref_id','External parent not in local hierarchy'),'_principal',human);
  result := axtn_case_environment(owner,'external_references',request);
  IF result - ARRAY['external_environment_id','external_ref_id','external_parent_ref_id',
      'external_reference_version','updated_at'] IS DISTINCT FROM state-'updated_at'
    OR result->>'external_ref_id'<>'0001/Ä'
    OR EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
      AND row->>'case_id'=second_case->>'case_id' AND row ? 'external_ref_id')
  THEN RAISE EXCEPTION 'References changed custody/work/hierarchy or inherited to Child'; END IF;
  before_count := (SELECT count(*) FROM audit_events WHERE user_id=owner
    AND action LIKE 'axtn_case_environment.%');
  IF axtn_case_environment(owner,'external_references',request) IS DISTINCT FROM result
    OR (SELECT count(*) FROM audit_events WHERE user_id=owner
      AND action LIKE 'axtn_case_environment.%')<>before_count
  THEN RAISE EXCEPTION 'Replay changed reference state or duplicated audit'; END IF;
  IF NOT EXISTS(SELECT 1 FROM user_data_tables t,jsonb_array_elements(t.columns) c
      WHERE t.id=dataset AND c->>'name'='operator_column')
    OR (SELECT count(*) FROM user_data_tables t,jsonb_array_elements(t.columns) c
      WHERE t.id=dataset AND c->>'name'='external_ref_id')<>1
  THEN RAISE EXCEPTION 'Metadata reconciliation lost or duplicated columns'; END IF;
  binding := axtn_case_environment(owner,'external_handover',jsonb_build_object(
    'caseId',state->>'case_id','integrationId',integration_id,'expectedVersion',1,'_principal',machine));
  IF binding IS DISTINCT FROM request->'patch' OR binding ? 'case_id' OR binding ? 'parent_case_id'
  THEN RAISE EXCEPTION 'External handover changed triple or leaked local hierarchy'; END IF;
  binding := axtn_case_environment(owner,'external_correlate',jsonb_build_object(
    'integrationId',integration_id,'external_environment_id','  Env-01 ',
    'external_ref_id','0001/Ä','_principal',machine));
  IF binding->>'status'<>'MATCHED' OR binding->'candidates'->>0<>state->>'case_id'
  THEN RAISE EXCEPTION 'Exact correlation failed'; END IF;
  IF axtn_case_environment(owner,'external_correlate',jsonb_build_object(
      'integrationId',integration_id,'external_environment_id','Env-01',
      'external_ref_id','0001/Ä','_principal',machine))->>'reason'<>'UNCONFIRMED_ENVIRONMENT'
    OR axtn_case_environment(owner,'external_correlate',jsonb_build_object(
      'external_ref_id','0001/Ä','_principal',machine))->>'reason'<>'LEGACY_ENVIRONMENT_REQUIRED'
  THEN RAISE EXCEPTION 'Unconfirmed or legacy binding authorized matching'; END IF;
  PERFORM axtn_case_environment(owner,'external_references',jsonb_build_object(
    'caseId',second_case->>'case_id','expectedVersion',0,'transitionKey','refs-child',
    'patch',request->'patch','_principal',machine));
  IF axtn_case_environment(owner,'external_correlate',jsonb_build_object(
    'integrationId',integration_id,'external_environment_id','  Env-01 ',
    'external_ref_id','0001/Ä','_principal',machine))->>'status'<>'NEEDS_CLARIFICATION'
  THEN RAISE EXCEPTION 'Multiple work packages silently selected latest'; END IF;
  result := axtn_case_environment(owner,'external_references',jsonb_build_object(
    'caseId',state->>'case_id','expectedVersion',1,'transitionKey','refs-null',
    'patch',jsonb_build_object('external_parent_ref_id',NULL),'_principal',human));
  IF result->>'external_ref_id'<>'0001/Ä' OR result->'external_parent_ref_id'<>'null'::jsonb
  THEN RAISE EXCEPTION 'Absent/null patch semantics failed'; END IF;
  FOREACH value IN ARRAY ARRAY['', ' ', chr(160),chr(65279),E'bad\n',
      'bad'||chr(127),repeat('x',501)] LOOP
    BEGIN
      PERFORM axtn_case_environment(owner,'external_references',jsonb_build_object(
        'caseId',state->>'case_id','expectedVersion',2,'transitionKey','invalid-'||md5(value),
        'patch',jsonb_build_object('external_ref_id',value),'_principal',human));
      RAISE EXCEPTION 'Malformed reference accepted';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'CASE_ENVIRONMENT_REFERENCE_PATCH_REQUIRED' THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    PERFORM axtn_case_environment(owner,'external_references',request);
    RAISE EXCEPTION 'Stale replay accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ENVIRONMENT_STALE_REPLAY' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_environment(owner,'external_references',request||
      jsonb_build_object('transitionKey','stale-update'));
    RAISE EXCEPTION 'Stale version accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ENVIRONMENT_VERSION_CONFLICT' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_environment(owner,'environment_binding',jsonb_build_object(
      'integrationId',integration_id,'environmentId','unknown','enabled',true,
      'expectedVersion',1,'transitionKey','machine-confirm','_principal',machine));
    RAISE EXCEPTION 'Machine confirmed environment authority';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ENVIRONMENT_AUTHENTICATED_HUMAN_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_environment(owner,'external_references',request||
      jsonb_build_object('_principal',jsonb_build_object('kind','user_session','id',other)));
    RAISE EXCEPTION 'Foreign principal accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ENVIRONMENT_PRINCIPAL_DENIED' THEN RAISE; END IF;
  END;
  IF axtn_case_environment(owner,'external_references',jsonb_build_object(
    'caseId',state->>'case_id','expectedVersion',2,'transitionKey','refs-limit',
    'patch',jsonb_build_object('external_ref_id',repeat('x',500)),'_principal',human))
    ->>'external_ref_id'<>repeat('x',500)
  THEN RAISE EXCEPTION 'Exact500 boundary failed'; END IF;
  INSERT INTO environment_fixture VALUES(owner,other,(state->>'case_id')::uuid,integration_id,
    dataset,request);
  RAISE NOTICE 'PASS: native exact triple, preserved identity/Child/no inheritance, replay, metadata, matching/ambiguity, minimized handover, null/absent, limits, stale/foreign/machine denial';
END;
$$;
GRANT SELECT ON environment_fixture TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE fixture environment_fixture%ROWTYPE;
BEGIN
  SELECT * INTO fixture FROM environment_fixture;
  BEGIN
    UPDATE user_data_rows SET row=row||'{"external_ref_id":"bypass"}'::jsonb
      WHERE table_id=fixture.dataset_id AND row->>'case_id'=fixture.case_id::text;
    RAISE EXCEPTION 'Direct row bypass';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ENVIRONMENT_NATIVE_CONTRACT_REQUIRED'
      AND SQLERRM<>'Native work contract required'
    THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_local_table_upsert(fixture.owner_id,'axtn_cases','case_id',fixture.case_id::text,
      jsonb_build_object('case_id',fixture.case_id,'subject','bypass'));
    RAISE EXCEPTION 'Local Table bypass';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ENVIRONMENT_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE integrations SET config=config||'{"axtn_environment_binding":{"enabled":true}}'
      WHERE id=fixture.integration_id;
    RAISE EXCEPTION 'Integration authority bypass';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ENVIRONMENT_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE audit_events SET detail='{}' WHERE user_id=fixture.owner_id
      AND action LIKE 'axtn_case_environment.%';
    RAISE EXCEPTION 'Audit bypass';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ENVIRONMENT_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  IF has_function_privilege('authenticated','axtn_case_environment(uuid,text,jsonb)','EXECUTE')
    OR has_function_privilege('service_role',
      'axtn_local_table_upsert_before_environment(uuid,text,text,text,jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'Private delegate/public mutation exposure'; END IF;
  DECLARE
    before_binding jsonb;
    state jsonb;
    current_version bigint;
    before_audit bigint;
    human jsonb:=jsonb_build_object('kind','user_session','id',fixture.owner_id);
  BEGIN
    SELECT config->'axtn_environment_binding' INTO before_binding
      FROM integrations WHERE id=fixture.integration_id;
    UPDATE integrations SET config='{"retained":"changed-by-existing-provider-save"}'
      WHERE id=fixture.integration_id;
    IF (SELECT config->'axtn_environment_binding' FROM integrations
        WHERE id=fixture.integration_id) IS DISTINCT FROM before_binding
      OR (SELECT config->>'retained' FROM integrations WHERE id=fixture.integration_id)
        <>'changed-by-existing-provider-save'
    THEN RAISE EXCEPTION 'Native metadata broke ordinary integration config/credential saves'; END IF;
    state:=axtn_case_environment(fixture.owner_id,'environment_binding_state',
      jsonb_build_object('integrationId',fixture.integration_id,'_principal',human));
    IF state->>'enabled'<>'false' OR state->>'version'<>'1'
    THEN RAISE EXCEPTION 'Changed configuration retained stale counterpart authority'; END IF;
    SELECT count(*) INTO before_audit FROM audit_events WHERE user_id=fixture.owner_id;
    BEGIN
      PERFORM axtn_case_environment(fixture.owner_id,'environment_binding',jsonb_build_object(
        'integrationId',fixture.integration_id,'environmentId','  Env-01 ','enabled',true,
        'expectedVersion',0,'transitionKey','env-confirm','_principal',human));
      RAISE EXCEPTION 'Stale configuration replay reported a confirmed binding';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'CASE_ENVIRONMENT_STALE_REPLAY' THEN RAISE; END IF;
    END;
    IF has_function_privilege('service_role',
      'axtn_case_environment_config_hash(public.integrations)','EXECUTE')
      OR has_function_privilege('service_role',
        'axtn_case_environment_binding_valid(public.integrations)','EXECUTE')
    THEN RAISE EXCEPTION 'Private configuration delegates exposed'; END IF;
    SELECT (row->>'external_reference_version')::bigint INTO current_version
      FROM user_data_rows WHERE table_id=fixture.dataset_id
        AND row->>'case_id'=fixture.case_id::text;
    BEGIN
      PERFORM axtn_case_environment(fixture.owner_id,'external_references',jsonb_build_object(
        'caseId',fixture.case_id,'expectedVersion',current_version,
        'transitionKey','stale-config-automation','patch',jsonb_build_object(
          'external_environment_id','  Env-01 ','external_ref_id','stale-config-reference'),
        '_principal',jsonb_build_object('kind','swarm','id',fixture.owner_id)));
      RAISE EXCEPTION 'Stale configuration authorized automated reference binding';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'CASE_ENVIRONMENT_CONFIRMED_BINDING_REQUIRED' THEN RAISE; END IF;
    END;
    IF (SELECT count(*) FROM audit_events WHERE user_id=fixture.owner_id)<>before_audit
      OR (SELECT (row->>'external_reference_version')::bigint FROM user_data_rows
        WHERE table_id=fixture.dataset_id AND row->>'case_id'=fixture.case_id::text)<>current_version
    THEN RAISE EXCEPTION 'Rejected stale configuration changed Case/audit state'; END IF;
    state:=axtn_case_environment(fixture.owner_id,'external_correlate',jsonb_build_object(
      'integrationId',fixture.integration_id,'external_environment_id','  Env-01 ',
      'external_ref_id','stale-config-reference','_principal',human));
    IF state->>'status'<>'NEEDS_CLARIFICATION' OR state->>'reason'<>'UNCONFIRMED_ENVIRONMENT'
    THEN RAISE EXCEPTION 'Stale configuration authorized correlation'; END IF;
    BEGIN
      PERFORM axtn_case_environment(fixture.owner_id,'external_handover',jsonb_build_object(
        'caseId',fixture.case_id,'integrationId',fixture.integration_id,
        'expectedVersion',current_version,'_principal',human));
      RAISE EXCEPTION 'Stale configuration authorized handover';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'CASE_ENVIRONMENT_CONFIRMED_BINDING_REQUIRED' THEN RAISE; END IF;
    END;
    PERFORM axtn_case_environment(fixture.owner_id,'environment_binding',jsonb_build_object(
      'integrationId',fixture.integration_id,'environmentId','  Env-01 ','enabled',true,
      'expectedVersion',1,'transitionKey','reconfirm-config','_principal',human));
    state:=axtn_case_environment(fixture.owner_id,'environment_binding_state',
      jsonb_build_object('integrationId',fixture.integration_id,'_principal',human));
    IF state->>'enabled'<>'true' OR state->>'version'<>'2'
    THEN RAISE EXCEPTION 'Explicit Human reconfirmation did not restore current binding'; END IF;
    BEGIN
      DELETE FROM integrations WHERE id=fixture.integration_id;
      RAISE EXCEPTION 'Active counterpart binding deleted without Human revocation';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM<>'CASE_ENVIRONMENT_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
    END;
    PERFORM axtn_case_environment(fixture.owner_id,'environment_binding',jsonb_build_object(
      'integrationId',fixture.integration_id,'environmentId','  Env-01 ','enabled',false,
      'expectedVersion',2,'transitionKey','revoke-before-delete','_principal',human));
    DELETE FROM integrations WHERE id=fixture.integration_id;
    IF EXISTS(SELECT 1 FROM integrations WHERE id=fixture.integration_id)
    THEN RAISE EXCEPTION 'Revoked native binding broke ordinary integration deletion'; END IF;
  END;
  RAISE NOTICE 'PASS: actual service-role direct Case/LocalTable/config/audit denials and private delegates';
  RAISE NOTICE 'PASS: ordinary provider/config writes preserved; changed configuration fences external authority until explicit Human reconfirmation';
END;
$$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM axtn_case_environment(gen_random_uuid(),'external_correlate','{}');
    RAISE EXCEPTION 'Browser directly called service mutation';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RAISE NOTICE 'PASS: authenticated browser cannot call trusted server RPC directly';
END;
$$;
RESET ROLE;
ROLLBACK;
