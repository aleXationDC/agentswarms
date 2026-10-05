-- One primary external binding on existing Case rows; native integration config is authority.
CREATE FUNCTION public.axtn_case_opaque_reference(value jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT value='null'::jsonb OR (
    jsonb_typeof(value)='string' AND length(value#>>'{}') BETWEEN 1 AND 500
    AND length(btrim(value#>>'{}',E' \t\n\r\v\f'||chr(160)||chr(5760)||
      chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||
      chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||
      chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279)))>0
    AND (value#>>'{}') !~ '[[:cntrl:]]')
$$;
REVOKE ALL ON FUNCTION public.axtn_case_opaque_reference(jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.axtn_case_environment_config_hash(integration public.integrations)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT encode(extensions.digest(jsonb_build_object(
    'id',(integration).id,'owner',(integration).user_id,'type',(integration).type,
    'provider',(integration).provider,'config',(integration).config-'axtn_environment_binding'
  )::text,'sha256'),'hex')
$$;
CREATE FUNCTION public.axtn_case_environment_binding_valid(integration public.integrations)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT COALESCE((integration).is_active
    AND (integration).config->'axtn_environment_binding'->>'enabled'='true'
    AND (integration).config->'axtn_environment_binding'->>'configHash'=
      axtn_case_environment_config_hash(integration),false)
$$;
REVOKE ALL ON FUNCTION public.axtn_case_environment_config_hash(public.integrations),
  public.axtn_case_environment_binding_valid(public.integrations)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.guard_axtn_case_environment() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE fields text[] := ARRAY['external_environment_id','external_ref_id',
  'external_parent_ref_id','external_reference_version']; protected boolean := false;
  old_case_table boolean:=false; new_case_table boolean:=false;
BEGIN
  IF TG_TABLE_NAME='integrations' THEN
    -- Generic credential/config edits cannot accidentally delete native binding metadata.
    IF TG_OP='UPDATE' AND current_user<>'postgres'
      AND OLD.config ? 'axtn_environment_binding'
      AND jsonb_typeof(NEW.config)='object' AND NOT NEW.config ? 'axtn_environment_binding'
    THEN NEW.config:=NEW.config||jsonb_build_object(
      'axtn_environment_binding',OLD.config->'axtn_environment_binding'); END IF;
    IF TG_OP='INSERT' THEN protected := NEW.config ? 'axtn_environment_binding';
    ELSIF TG_OP='DELETE' THEN protected := OLD.config ? 'axtn_environment_binding'
      AND OLD.config->'axtn_environment_binding'->>'enabled' IS DISTINCT FROM 'false';
    ELSE protected := OLD.config->'axtn_environment_binding' IS DISTINCT FROM
      NEW.config->'axtn_environment_binding' OR (
      OLD.config ? 'axtn_environment_binding' AND (
        OLD.id IS DISTINCT FROM NEW.id OR OLD.user_id IS DISTINCT FROM NEW.user_id));
    END IF;
  ELSIF TG_TABLE_NAME='audit_events' THEN
    IF TG_OP<>'INSERT' THEN protected := OLD.action LIKE 'axtn_case_environment.%'; END IF;
    IF TG_OP<>'DELETE' THEN
      protected := protected OR NEW.action LIKE 'axtn_case_environment.%';
    END IF;
  ELSIF TG_TABLE_NAME='user_data_tables' THEN
    IF TG_OP<>'INSERT' AND OLD.name='axtn_cases'
      AND EXISTS(SELECT 1 FROM user_data_rows r WHERE r.table_id=OLD.id
      AND r.row ?| fields) THEN
      protected := TG_OP='DELETE';
      IF TG_OP='UPDATE' THEN
        protected := OLD.id IS DISTINCT FROM NEW.id OR OLD.user_id IS DISTINCT FROM NEW.user_id
          OR OLD.name IS DISTINCT FROM NEW.name OR OLD.columns IS DISTINCT FROM NEW.columns;
      END IF;
    END IF;
  ELSE
    IF TG_OP<>'INSERT' THEN
      SELECT name='axtn_cases' INTO old_case_table FROM user_data_tables WHERE id=OLD.table_id;
    END IF;
    IF TG_OP<>'DELETE' THEN
      SELECT name='axtn_cases' INTO new_case_table FROM user_data_tables WHERE id=NEW.table_id;
    END IF;
    IF TG_OP='INSERT' THEN protected := new_case_table AND NEW.row ?| fields;
    ELSIF TG_OP='DELETE' THEN protected := old_case_table AND OLD.row ?| fields;
    ELSE
      protected := (old_case_table OR new_case_table)
        AND (OLD.row ?| fields OR NEW.row ?| fields) AND (
        OLD.table_id IS DISTINCT FROM NEW.table_id OR OLD.id IS DISTINCT FROM NEW.id
        OR OLD.row->>'case_id' IS DISTINCT FROM NEW.row->>'case_id'
        OR EXISTS(SELECT 1 FROM unnest(fields) name
          WHERE OLD.row->name IS DISTINCT FROM NEW.row->name));
    END IF;
  END IF;
  IF COALESCE(protected,false) AND current_user<>'postgres'
  THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_NATIVE_CONTRACT_REQUIRED'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_axtn_case_environment()
  FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER guard_axtn_case_environment_rows BEFORE INSERT OR UPDATE OR DELETE
  ON public.user_data_rows FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_case_environment();
CREATE TRIGGER guard_axtn_case_environment_tables BEFORE UPDATE OR DELETE
  ON public.user_data_tables FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_case_environment();
CREATE TRIGGER guard_axtn_case_environment_integrations BEFORE INSERT OR UPDATE OR DELETE
  ON public.integrations FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_case_environment();
CREATE TRIGGER guard_axtn_case_environment_audit BEFORE INSERT OR UPDATE OR DELETE
  ON public.audit_events FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_case_environment();

CREATE FUNCTION public.axtn_case_environment(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  principal jsonb := p_payload->'_principal';
  payload jsonb := p_payload-'_principal';
  dataset uuid;
  row_id bigint;
  current_case jsonb;
  result jsonb;
  binding jsonb;
  integration public.integrations%ROWTYPE;
  prior jsonb;
  revision bigint;
  request_hash text;
  field_name text;
  patch jsonb;
  candidates jsonb;
  stamp timestamptz := clock_timestamp();
BEGIN
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id)
    OR COALESCE(principal->>'kind','') NOT IN ('user_session','swarm','swarm_api_key')
    OR COALESCE(principal->>'id','')=''
  THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_AUTHENTICATED_OWNER_REQUIRED'; END IF;
  IF principal->>'kind' IN ('user_session','swarm')
    AND principal->>'id' IS DISTINCT FROM p_user_id::text
  THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_PRINCIPAL_DENIED'; END IF;
  IF principal->>'kind'='swarm_api_key' AND NOT EXISTS(
    SELECT 1 FROM swarm_api_keys WHERE id=(principal->>'id')::uuid AND user_id=p_user_id
      AND is_active AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())
      AND 'cases'=ANY(scopes))
  THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_CASE_KEY_DENIED'; END IF;
  IF jsonb_typeof(payload) IS DISTINCT FROM 'object'
    OR COALESCE(p_operation,'') NOT IN ('environment_binding','environment_binding_state','external_references',
      'external_correlate','external_handover')
  THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_OPERATION_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(payload) field WHERE NOT field=ANY(
    CASE p_operation
      WHEN 'environment_binding_state' THEN ARRAY['integrationId']
      WHEN 'environment_binding' THEN ARRAY['integrationId','environmentId','enabled','transitionKey','expectedVersion']
      WHEN 'external_references' THEN ARRAY['caseId','patch','transitionKey','expectedVersion']
      WHEN 'external_handover' THEN ARRAY['caseId','integrationId','expectedVersion']
      ELSE ARRAY['integrationId','external_environment_id','external_ref_id','external_parent_ref_id','accountId','contactId']
    END))
  THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_PAYLOAD_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_each(payload) field WHERE field.key IN (
    'caseId','integrationId','accountId','contactId') AND (
      jsonb_typeof(field.value) IS DISTINCT FROM 'string' OR
      (field.value#>>'{}') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'))
    OR p_operation IN ('environment_binding','environment_binding_state','external_handover') AND NOT payload ? 'integrationId'
    OR p_operation IN ('external_references','external_handover') AND NOT payload ? 'caseId'
    OR p_operation='external_handover' AND (
      jsonb_typeof(payload->'expectedVersion') IS DISTINCT FROM 'number'
      OR COALESCE(payload->>'expectedVersion','') !~ '^[0-9]{1,16}$'
      OR (payload->>'expectedVersion')::numeric>9007199254740991)
  THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_PAYLOAD_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text,0));
  stamp := clock_timestamp();
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=p_user_id AND name='axtn_cases';
  IF dataset IS NULL THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_DATASET_REQUIRED'; END IF;

  IF payload ? 'integrationId' THEN
    SELECT * INTO integration FROM integrations WHERE id=(payload->>'integrationId')::uuid
      AND user_id=p_user_id FOR UPDATE;
    IF integration.id IS NULL THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_OWNED_INTEGRATION_REQUIRED'; END IF;
    binding := integration.config->'axtn_environment_binding';
  END IF;
  IF p_operation='environment_binding_state' THEN
    RETURN jsonb_build_object('environmentId',binding->'environmentId',
      'enabled',axtn_case_environment_binding_valid(integration),
      'version',COALESCE((binding->>'version')::bigint,0));
  END IF;
  IF p_operation IN ('environment_binding','external_references') THEN
    IF COALESCE(payload->>'transitionKey','')='' OR length(payload->>'transitionKey')>200
      OR jsonb_typeof(payload->'transitionKey') IS DISTINCT FROM 'string'
      OR jsonb_typeof(payload->'expectedVersion') IS DISTINCT FROM 'number'
      OR COALESCE(payload->>'expectedVersion','') !~ '^[0-9]{1,16}$'
      OR (payload->>'expectedVersion')::numeric>9007199254740991
    THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_VERSIONED_CHANGE_REQUIRED'; END IF;
    request_hash := encode(extensions.digest((payload||jsonb_build_object(
      'operation',p_operation,'principal',principal))::text,'sha256'),'hex');
    SELECT detail INTO prior FROM audit_events WHERE user_id=p_user_id
      AND resource_type='axtn_case_environment'
      AND detail->>'transitionKey'=payload->>'transitionKey';
    IF prior IS NOT NULL AND prior->>'requestHash' IS DISTINCT FROM request_hash
    THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_REPLAY_CONFLICT'; END IF;
  END IF;
  IF p_operation='environment_binding' THEN
    IF principal->>'kind'<>'user_session'
    THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_AUTHENTICATED_HUMAN_REQUIRED'; END IF;
    IF integration.id IS NULL OR NOT integration.is_active
      OR NOT axtn_case_opaque_reference(payload->'environmentId')
      OR payload->'environmentId'='null'::jsonb
      OR jsonb_typeof(payload->'enabled') IS DISTINCT FROM 'boolean'
    THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_BINDING_REQUIRED'; END IF;
    revision := COALESCE((binding->>'version')::bigint,0);
    IF prior IS NOT NULL THEN
      IF revision IS DISTINCT FROM (prior->>'resultVersion')::bigint
        OR binding->>'configHash' IS DISTINCT FROM axtn_case_environment_config_hash(integration)
      THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_STALE_REPLAY'; END IF;
      RETURN binding;
    END IF;
    IF revision IS DISTINCT FROM (payload->>'expectedVersion')::bigint
    THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_VERSION_CONFLICT'; END IF;
    binding := jsonb_build_object('environmentId',payload->'environmentId',
      'enabled',payload->'enabled','version',revision+1,'confirmedBy',principal,
      'confirmedAt',stamp,'configHash',axtn_case_environment_config_hash(integration));
    UPDATE integrations SET config=config||jsonb_build_object('axtn_environment_binding',binding)
      WHERE id=integration.id;
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
      VALUES(p_user_id,'axtn_case_environment.BINDING_CONFIRMED','axtn_case_environment',
        integration.id,stamp,jsonb_build_object('transitionKey',payload->>'transitionKey',
          'requestHash',request_hash,'principal',principal,'resultVersion',revision+1,
          'enabled',payload->'enabled','recordedAt',stamp));
    RETURN binding;
  END IF;
  IF p_operation IN ('external_references','external_handover') THEN
    IF (SELECT count(*) FROM user_data_rows WHERE table_id=dataset
      AND row->>'case_id'=payload->>'caseId')>1
    THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_AMBIGUOUS_CASE'; END IF;
    SELECT id,row INTO row_id,current_case FROM user_data_rows WHERE table_id=dataset
      AND row->>'case_id'=payload->>'caseId' FOR UPDATE;
    IF current_case IS NULL THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_OWNED_CASE_REQUIRED'; END IF;
    revision := COALESCE((current_case->>'external_reference_version')::bigint,0);
  END IF;
  IF p_operation='external_references' THEN
    patch := payload->'patch';
    IF jsonb_typeof(patch) IS DISTINCT FROM 'object'
    THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_REFERENCE_PATCH_REQUIRED'; END IF;
    IF patch='{}'::jsonb OR EXISTS(SELECT 1 FROM jsonb_each(patch) field
      WHERE field.key NOT IN ('external_environment_id','external_ref_id','external_parent_ref_id')
        OR NOT axtn_case_opaque_reference(field.value))
    THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_REFERENCE_PATCH_REQUIRED'; END IF;
    IF prior IS NOT NULL THEN
      IF revision IS DISTINCT FROM (prior->>'resultVersion')::bigint
      THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_STALE_REPLAY'; END IF;
      RETURN current_case;
    END IF;
    IF revision IS DISTINCT FROM (payload->>'expectedVersion')::bigint
    THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_VERSION_CONFLICT'; END IF;
    IF current_case->>'processing_mode'='HUMAN' AND principal->>'kind'<>'user_session'
    THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_HUMAN_TAKEOVER_FENCED'; END IF;
    result := current_case||patch||jsonb_build_object(
      'external_reference_version',revision+1,'updated_at',stamp);
    IF principal->>'kind'<>'user_session' AND NOT EXISTS(SELECT 1 FROM integrations i
      WHERE i.user_id=p_user_id AND axtn_case_environment_binding_valid(i)
        AND i.config->'axtn_environment_binding'->>'environmentId'=result->>'external_environment_id')
    THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_CONFIRMED_BINDING_REQUIRED'; END IF;
    UPDATE user_data_tables t SET columns=t.columns||(
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name',field,'type','string')),'[]'::jsonb)
      FROM unnest(ARRAY['external_environment_id','external_ref_id','external_parent_ref_id',
        'external_reference_version']) field
      WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(t.columns) c WHERE c->>'name'=field))
      WHERE t.id=dataset;
    UPDATE user_data_rows SET row=result WHERE id=row_id;
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
      VALUES(p_user_id,'axtn_case_environment.REFERENCES_CHANGED','axtn_case_environment',
        (current_case->>'case_id')::uuid,stamp,jsonb_build_object(
          'transitionKey',payload->>'transitionKey','requestHash',request_hash,
          'principal',principal,'fromVersion',revision,'resultVersion',revision+1,
          'fields',(SELECT jsonb_agg(field) FROM jsonb_object_keys(patch) field)));
    RETURN result;
  END IF;
  IF p_operation='external_handover' THEN
    IF revision IS DISTINCT FROM (payload->>'expectedVersion')::bigint
    THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_VERSION_CONFLICT'; END IF;
    IF integration.id IS NULL OR NOT axtn_case_environment_binding_valid(integration)
      OR binding->>'environmentId' IS DISTINCT FROM current_case->>'external_environment_id'
      OR current_case->>'external_ref_id' IS NULL
    THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_CONFIRMED_BINDING_REQUIRED'; END IF;
    RETURN jsonb_build_object('external_environment_id',current_case->'external_environment_id',
      'external_ref_id',current_case->'external_ref_id',
      'external_parent_ref_id',current_case->'external_parent_ref_id');
  END IF;
  FOREACH field_name IN ARRAY ARRAY['external_environment_id','external_ref_id','external_parent_ref_id'] LOOP
    IF payload ? field_name AND NOT axtn_case_opaque_reference(payload->field_name)
    THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_REFERENCE_REQUIRED'; END IF;
  END LOOP;
  IF payload->>'external_ref_id' IS NULL THEN
    RETURN jsonb_build_object('status','NEEDS_CLARIFICATION','reason','REFERENCE_REQUIRED','candidates','[]'::jsonb);
  END IF;
  IF payload->>'external_environment_id' IS NULL THEN
    RETURN jsonb_build_object('status','NEEDS_CLARIFICATION','reason','LEGACY_ENVIRONMENT_REQUIRED','candidates','[]'::jsonb);
  END IF;
  IF integration.id IS NULL OR NOT axtn_case_environment_binding_valid(integration)
    OR binding->>'environmentId' IS DISTINCT FROM payload->>'external_environment_id'
  THEN RETURN jsonb_build_object('status','NEEDS_CLARIFICATION','reason','UNCONFIRMED_ENVIRONMENT','candidates','[]'::jsonb); END IF;
  IF payload ? 'accountId' AND NOT EXISTS(SELECT 1 FROM user_data_rows r
    JOIN user_data_tables t ON t.id=r.table_id WHERE t.user_id=p_user_id
      AND t.name='axtn_accounts' AND r.row->>'account_id'=payload->>'accountId')
    OR payload ? 'contactId' AND NOT EXISTS(SELECT 1 FROM user_data_rows r
      JOIN user_data_tables t ON t.id=r.table_id WHERE t.user_id=p_user_id
        AND t.name='axtn_contacts' AND r.row->>'contact_id'=payload->>'contactId'
        AND (NOT payload ? 'accountId' OR r.row->>'account_id'=payload->>'accountId'))
  THEN RETURN jsonb_build_object('status','CONFLICT','reason','COUNTERPARTY_CONTEXT_CONFLICT','candidates','[]'::jsonb); END IF;
  SELECT COALESCE(jsonb_agg(row->>'case_id' ORDER BY row->>'case_id'),'[]'::jsonb)
    INTO candidates FROM user_data_rows WHERE table_id=dataset
      AND row->>'external_environment_id'=payload->>'external_environment_id'
      AND row->>'external_ref_id'=payload->>'external_ref_id';
  IF jsonb_array_length(candidates)=0 THEN
    RETURN jsonb_build_object('status','NO_MATCH','reason','NO_EXACT_REFERENCE','candidates',candidates);
  END IF;
  SELECT COALESCE(jsonb_agg(row->>'case_id' ORDER BY row->>'case_id'),'[]'::jsonb)
    INTO candidates FROM user_data_rows WHERE table_id=dataset
      AND row->>'external_environment_id'=payload->>'external_environment_id'
      AND row->>'external_ref_id'=payload->>'external_ref_id'
      AND (NOT payload ? 'accountId' OR row->>'account_id'=payload->>'accountId')
      AND (NOT payload ? 'contactId' OR row->>'primary_contact_id'=payload->>'contactId')
      AND (payload->>'external_parent_ref_id' IS NULL
        OR row->>'external_parent_ref_id' IS NULL
        OR row->>'external_parent_ref_id'=payload->>'external_parent_ref_id');
  RETURN jsonb_build_object('status',CASE jsonb_array_length(candidates)
      WHEN 0 THEN 'CONFLICT' WHEN 1 THEN 'MATCHED' ELSE 'NEEDS_CLARIFICATION' END,
    'reason',CASE jsonb_array_length(candidates)
      WHEN 0 THEN 'CONFIRMED_CONTEXT_CONFLICT' WHEN 1 THEN 'EXACT_CONTEXT' ELSE 'AMBIGUOUS_REFERENCE' END,
    'candidates',candidates);
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_environment(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_environment(uuid,text,jsonb) TO service_role;

ALTER FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb)
  RENAME TO axtn_local_table_upsert_before_environment;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert_before_environment(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_local_table_upsert(
  _user_id uuid,_table_name text,_key_column text,_key_value text,_row jsonb
) RETURNS TABLE(table_id uuid,row_id bigint,outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF _table_name='axtn_cases' AND (_row ?| ARRAY['external_environment_id','external_ref_id',
      'external_parent_ref_id','external_reference_version']
    OR EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=_user_id AND t.name=_table_name AND r.row->>_key_column=_key_value
        AND r.row ?| ARRAY['external_environment_id','external_ref_id',
          'external_parent_ref_id','external_reference_version']))
  THEN RAISE EXCEPTION 'CASE_ENVIRONMENT_NATIVE_CONTRACT_REQUIRED'; END IF;
  RETURN QUERY SELECT * FROM axtn_local_table_upsert_before_environment(
    _user_id,_table_name,_key_column,_key_value,_row);
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb) TO service_role;
