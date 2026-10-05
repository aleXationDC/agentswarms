-- Locked #10 schema on existing Case rows, using native users/groups and stable custody.
CREATE FUNCTION public.axtn_case_responsibility_fields(value jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT COALESCE(jsonb_object_agg(key,val),'{}') FROM jsonb_each(value) e(key,val)
    WHERE key IN ('responsible_principal_type','responsible_principal_id','assignee_user_id',
      'assignment_policy','semantic_route_mode','semantic_route_provider_id','semantic_route_model_id')
$$;
CREATE FUNCTION public.axtn_case_visible(actor_id uuid,custodian uuid,value jsonb) RETURNS boolean
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  SELECT COALESCE(EXISTS(SELECT 1 FROM auth.users WHERE id=actor_id AND deleted_at IS NULL
    AND (banned_until IS NULL OR banned_until<=now())) AND (
      actor_id=custodian
      OR value->>'responsible_principal_type'='USER'
        AND value->>'responsible_principal_id'=actor_id::text
      OR value->>'responsible_principal_type'='GROUP' AND EXISTS(
        SELECT 1 FROM iam_group_members WHERE group_id::text=value->>'responsible_principal_id'
          AND user_id=actor_id)),false)
$$;
CREATE FUNCTION public.axtn_case_custodian(actor_id uuid,case_id text,principal jsonb)
RETURNS uuid LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE custodian uuid; value jsonb;
BEGIN
  PERFORM assert_axtn_case_principal(actor_id,principal);
  IF (SELECT count(*) FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.name='axtn_cases' AND r.row->>'case_id'=case_id)<>1
  THEN RAISE EXCEPTION 'CASE_ACCESS_DENIED'; END IF;
  SELECT t.user_id,r.row INTO custodian,value FROM user_data_rows r
    JOIN user_data_tables t ON t.id=r.table_id WHERE t.name='axtn_cases' AND r.row->>'case_id'=case_id;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||custodian::text,0));
  SELECT r.row INTO value FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.name='axtn_cases' AND t.user_id=custodian AND r.row->>'case_id'=case_id FOR UPDATE OF r;
  PERFORM 1 FROM auth.users WHERE id=actor_id AND deleted_at IS NULL
    AND (banned_until IS NULL OR banned_until<=clock_timestamp()) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CASE_ACCESS_DENIED'; END IF;
  IF actor_id<>custodian AND value->>'responsible_principal_type'='GROUP' THEN
    PERFORM 1 FROM iam_group_members WHERE group_id::text=value->>'responsible_principal_id'
      AND user_id=actor_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'CASE_ACCESS_DENIED'; END IF;
  END IF;
  IF NOT axtn_case_visible(actor_id,custodian,value)
    OR actor_id<>custodian AND principal->>'kind'<>'user_session'
  THEN RAISE EXCEPTION 'CASE_ACCESS_DENIED'; END IF;
  RETURN custodian;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_responsibility_fields(jsonb),
  public.axtn_case_visible(uuid,uuid,jsonb),public.axtn_case_custodian(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.axtn_case_project(actor_id uuid,custodian uuid,value jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
  IF NOT axtn_case_visible(actor_id,custodian,value) THEN RAISE EXCEPTION 'CASE_ACCESS_DENIED'; END IF;
  IF actor_id=custodian THEN RETURN value; END IF;
  SELECT COALESCE(jsonb_object_agg(key,val),'{}') INTO result FROM jsonb_each(value) e(key,val)
    WHERE key IN ('case_id','subject','case_type','case_version','status','status_reason','priority',
      'created_at','updated_at','closed_at','source_kind','processing_stage','processing_version',
      'waiting_reason','due_date','follow_up','processing_mode','execution_channel','actor_ref','actor_principal',
      'candidate_sha','checks_sha','accepted_sha','accepted_approval_id','integration_phase','attempt_id','result_ref',
      'required_capability_ref','primary_pattern_ref','capability_provider_ref','references',
      'external_environment_id','external_ref_id','external_parent_ref_id','external_reference_version',
      'responsible_principal_type','responsible_principal_id','assignee_user_id','assignment_policy',
      'assignment_inheritance','assignment_version','assignment_updated_at','assignment_updated_by',
      'semantic_route_mode','semantic_route_provider_id','semantic_route_model_id','semantic_route_version');
  IF value#>>'{work_identity,scenarioClass}' IS NOT NULL THEN
    result:=result||jsonb_build_object('scenario_class',value#>'{work_identity,scenarioClass}');
  END IF;
  IF value#>>'{work_identity,processingMode}' IS NOT NULL THEN
    result:=result||jsonb_build_object('initial_processing_mode',value#>'{work_identity,processingMode}');
  END IF;
  IF value#>'{work_identity,workContractRef}' IS NOT NULL THEN
    result:=result||jsonb_build_object('work_contract_ref',value#>'{work_identity,workContractRef}');
  END IF;
  RETURN result||jsonb_build_object('case_access_mode','RESPONSIBLE','parent_case_id',
    CASE WHEN EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.name='axtn_cases' AND t.user_id=custodian AND r.row->>'case_id'=value->>'parent_case_id'
        AND axtn_case_visible(actor_id,custodian,r.row)) THEN value->>'parent_case_id' ELSE NULL END);
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_project(uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.axtn_case_capacity_project(actor_id uuid,custodian uuid,value jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path=public,pg_temp AS $$
DECLARE result jsonb; allocation jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.name='axtn_cases' AND t.user_id=custodian AND r.row->>'case_id'=value->>'caseId'
      AND axtn_case_visible(actor_id,custodian,r.row))
  THEN RAISE EXCEPTION 'CASE_ACCESS_DENIED'; END IF;
  IF actor_id=custodian THEN RETURN value; END IF;
  IF value->>'kind'='allocation' THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_CUSTODIAN_REQUIRED'; END IF;
  SELECT COALESCE(jsonb_object_agg(key,val),'{}') INTO result FROM jsonb_each(value) e(key,val)
    WHERE key IN ('id','kind','caseId','providerRef','poolRef','hours','purpose','supersedes',
      'version','recordedAt','actor','commitmentId','bookedOn','capabilityRef');
  IF value->>'kind'='commitment' THEN
    SELECT r.row INTO allocation FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.name='axtn_case_capacity' AND t.user_id=custodian AND r.row->>'id'=value->>'allocationId'
        AND r.row->>'kind'='allocation';
    result:=result||jsonb_build_object('startsOn',allocation->'startsOn','endsOn',allocation->'endsOn');
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_capacity_project(uuid,uuid,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.axtn_case_inherit_descendants(
  custodian uuid,dataset uuid,case_id text,fields jsonb,principal jsonb,transition_key text,stamp timestamptz)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE child record;
BEGIN
  FOR child IN WITH RECURSIVE inherited AS (
    SELECT r.id,r.row,ARRAY[r.row->>'case_id'] path FROM user_data_rows r WHERE table_id=dataset
      AND r.row->>'parent_case_id'=case_id AND r.row->>'assignment_inheritance'='INHERIT'
      AND r.row->>'status'<>'CLOSED'
    UNION ALL SELECT r.id,r.row,p.path||(r.row->>'case_id') FROM inherited p JOIN user_data_rows r
      ON r.table_id=dataset AND r.row->>'parent_case_id'=p.row->>'case_id'
      WHERE r.row->>'assignment_inheritance'='INHERIT' AND r.row->>'status'<>'CLOSED'
        AND NOT r.row->>'case_id'=ANY(p.path)
  ) SELECT id,row FROM inherited LOOP
    UPDATE user_data_rows SET row=row||fields||jsonb_build_object(
      'assignment_version',(row->>'assignment_version')::bigint+1,
      'semantic_route_version',(row->>'semantic_route_version')::bigint+
        CASE WHEN (row->'semantic_route_mode',row->'semantic_route_provider_id',row->'semantic_route_model_id')
          IS DISTINCT FROM (fields->'semantic_route_mode',fields->'semantic_route_provider_id',fields->'semantic_route_model_id')
        THEN 1 ELSE 0 END,
      'assignment_updated_at',stamp,'assignment_updated_by',principal->>'id') WHERE id=child.id;
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
      VALUES(custodian,'axtn_case_assignment.INHERITED','axtn_case_assignment',(child.row->>'case_id')::uuid,stamp,
        jsonb_build_object('transitionKey',transition_key,'principal',principal,'sourceCaseId',case_id,
          'from',axtn_case_responsibility_fields(child.row),'to',fields,
          'resultVersion',(child.row->>'assignment_version')::bigint+1,'activeAttemptRebound',false));
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_inherit_descendants(uuid,uuid,text,jsonb,jsonb,text,timestamptz)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.guard_axtn_case_responsibility() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE custodian uuid; parent jsonb; fields jsonb; changed boolean:=false;
  stamp timestamptz:=clock_timestamp(); principal jsonb; native_default boolean:=false;
BEGIN
  IF TG_TABLE_NAME='audit_events' THEN
    IF TG_OP<>'INSERT' THEN changed:=OLD.action LIKE 'axtn_case_assignment.%'; END IF;
    IF TG_OP<>'DELETE' THEN changed:=changed OR NEW.action LIKE 'axtn_case_assignment.%'; END IF;
    IF changed AND current_user<>'postgres'
    THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_NATIVE_CONTRACT_REQUIRED'; END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  SELECT user_id INTO custodian FROM user_data_tables WHERE id=NEW.table_id AND name='axtn_cases';
  IF custodian IS NULL THEN RETURN NEW; END IF;
  IF current_user<>'postgres' THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_NATIVE_CONTRACT_REQUIRED'; END IF;
  IF TG_OP='INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-id:'||(NEW.row->>'case_id'),0));
    IF EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.name='axtn_cases' AND r.row->>'case_id'=NEW.row->>'case_id')
    THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_IDENTITY_CONFLICT'; END IF;
  END IF;
  IF TG_OP='INSERT' AND NOT NEW.row ? 'assignment_version' THEN
    principal:=NULLIF(current_setting('axtn.case_principal',true),'')::jsonb;
    IF NEW.row->>'parent_case_id' IS NOT NULL THEN
      SELECT row INTO parent FROM user_data_rows WHERE table_id=NEW.table_id
        AND row->>'case_id'=NEW.row->>'parent_case_id';
    END IF;
    fields:=CASE WHEN parent IS NOT NULL THEN axtn_case_responsibility_fields(parent)
      ELSE jsonb_build_object(
        'responsible_principal_type',CASE WHEN NEW.row->>'source_kind'='manual' THEN 'USER' ELSE 'SYSTEM' END,
        'responsible_principal_id',CASE WHEN NEW.row->>'source_kind'='manual' THEN custodian ELSE NULL END,
        'assignee_user_id',CASE WHEN NEW.row->>'source_kind'='manual' THEN custodian ELSE NULL END,
        'assignment_policy','MANUAL','semantic_route_mode','SYSTEM_INTEGRATION',
        'semantic_route_provider_id',NULL,'semantic_route_model_id',NULL) END;
    NEW.row:=NEW.row||fields||jsonb_build_object('assignment_version',1,'semantic_route_version',1,
      'assignment_inheritance',CASE WHEN parent IS NULL THEN 'OVERRIDE' ELSE 'INHERIT' END,
      'assignment_updated_at',stamp,'assignment_updated_by',COALESCE(principal->>'id','SYSTEM'));
    native_default:=true;
  ELSIF TG_OP='UPDATE' AND NEW.row->>'assignment_inheritance'='INHERIT'
    AND OLD.row->'parent_case_id' IS DISTINCT FROM NEW.row->'parent_case_id' THEN
    IF NEW.row->>'parent_case_id' IS NULL THEN
      NEW.row:=NEW.row||jsonb_build_object('assignment_inheritance','OVERRIDE');
    ELSE
      SELECT row INTO parent FROM user_data_rows WHERE table_id=NEW.table_id
        AND row->>'case_id'=NEW.row->>'parent_case_id';
      IF parent IS NULL THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_OWNED_PARENT_REQUIRED'; END IF;
      NEW.row:=NEW.row||axtn_case_responsibility_fields(parent);
    END IF;
    principal:=NULLIF(current_setting('axtn.case_principal',true),'')::jsonb;
    NEW.row:=NEW.row||jsonb_build_object('assignment_version',
      COALESCE((OLD.row->>'assignment_version')::bigint,0)+1,
      'semantic_route_version',COALESCE((OLD.row->>'semantic_route_version')::bigint,0)+
        CASE WHEN (OLD.row->'semantic_route_mode',OLD.row->'semantic_route_provider_id',OLD.row->'semantic_route_model_id')
          IS DISTINCT FROM (NEW.row->'semantic_route_mode',NEW.row->'semantic_route_provider_id',NEW.row->'semantic_route_model_id')
        THEN 1 ELSE 0 END,
      'assignment_updated_at',stamp,'assignment_updated_by',COALESCE(principal->>'id','SYSTEM'));
    native_default:=true;
    PERFORM axtn_case_inherit_descendants(custodian,NEW.table_id,NEW.row->>'case_id',
      axtn_case_responsibility_fields(NEW.row),
      COALESCE(principal,jsonb_build_object('kind','system','id','native-case-default')),
      'native-reparent:'||(NEW.row->>'case_id')||':'||(NEW.row->>'assignment_version'),stamp);
  END IF;
  IF TG_OP='INSERT' THEN
    UPDATE user_data_tables t SET columns=t.columns||(
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name',k,'type','string')),'[]')
      FROM jsonb_object_keys(NEW.row) k WHERE (
        k LIKE 'assignment_%' OR k LIKE 'responsible_principal_%'
          OR k LIKE 'semantic_route_%' OR k='assignee_user_id')
        AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(t.columns) c WHERE c->>'name'=k))
      WHERE t.id=NEW.table_id;
  END IF;
  IF native_default THEN
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
      VALUES(custodian,'axtn_case_assignment.NATIVE_INHERITANCE','axtn_case_assignment',
        (NEW.row->>'case_id')::uuid,stamp,jsonb_build_object(
          'principal',COALESCE(principal,jsonb_build_object('kind','system','id','native-case-default')),
          'from',CASE WHEN TG_OP='UPDATE' THEN axtn_case_responsibility_fields(OLD.row) ELSE NULL END,
          'to',axtn_case_responsibility_fields(NEW.row),'assignmentVersion',NEW.row->'assignment_version',
          'operation','NATIVE_CREATE_OR_REPARENT','attemptId',NEW.row->'attempt_id'));
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_axtn_case_responsibility() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER guard_zz_axtn_case_responsibility_rows BEFORE INSERT OR UPDATE ON user_data_rows
  FOR EACH ROW EXECUTE FUNCTION guard_axtn_case_responsibility();
CREATE TRIGGER guard_axtn_case_responsibility_audit BEFORE INSERT OR UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION guard_axtn_case_responsibility();

-- Existing IDs/rows/lineage/evidence remain in place. Defaults do not change provider resolution.
DO $$
DECLARE item record; parent jsonb; fields jsonb; stamp timestamptz:=clock_timestamp();
BEGIN
  IF EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.name='axtn_cases' AND COALESCE(r.row->>'case_id','') !~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
  THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_DATA_INTEGRITY_REQUIRED'; END IF;
  IF EXISTS(SELECT r.row->>'case_id' FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.name='axtn_cases' GROUP BY r.row->>'case_id' HAVING count(*)<>1)
  THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_DATA_INTEGRITY_REQUIRED'; END IF;
  FOR item IN SELECT r.id,r.row,t.user_id,r.table_id FROM user_data_rows r
    JOIN user_data_tables t ON t.id=r.table_id WHERE t.name='axtn_cases'
      AND NOT r.row ? 'assignment_version' LOOP
    fields:=jsonb_build_object(
      'responsible_principal_type',CASE WHEN item.row->>'source_kind'='manual' THEN 'USER' ELSE 'SYSTEM' END,
      'responsible_principal_id',CASE WHEN item.row->>'source_kind'='manual' THEN item.user_id ELSE NULL END,
      'assignee_user_id',CASE WHEN item.row->>'source_kind'='manual' THEN item.user_id ELSE NULL END,
      'assignment_policy','MANUAL','assignment_inheritance',
        CASE WHEN item.row->>'parent_case_id' IS NULL THEN 'OVERRIDE' ELSE 'INHERIT' END,
      'assignment_version',1,'assignment_updated_at',stamp,'assignment_updated_by','SYSTEM',
      'semantic_route_mode','SYSTEM_INTEGRATION','semantic_route_provider_id',NULL,
      'semantic_route_model_id',NULL,'semantic_route_version',1);
    UPDATE user_data_rows SET row=row||fields WHERE id=item.id;
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
      VALUES(item.user_id,'axtn_case_assignment.NATIVE_BACKFILL','axtn_case_assignment',
        (item.row->>'case_id')::uuid,stamp,jsonb_build_object(
          'operation','ADDITIVE_DEFAULT_BACKFILL','principal',jsonb_build_object('kind','system','id','native-case-default'),
          'to',fields,'assignmentVersion',1));
  END LOOP;
  FOR item IN WITH RECURSIVE tree AS (
    SELECT r.id,r.table_id,r.row,0 depth,ARRAY[r.row->>'case_id'] path FROM user_data_rows r
      JOIN user_data_tables t ON t.id=r.table_id WHERE t.name='axtn_cases' AND r.row->>'parent_case_id' IS NULL
    UNION ALL SELECT r.id,r.table_id,r.row,p.depth+1,p.path||(r.row->>'case_id')
      FROM tree p JOIN user_data_rows r ON r.table_id=p.table_id AND r.row->>'parent_case_id'=p.row->>'case_id'
      WHERE NOT r.row->>'case_id'=ANY(p.path)
  ) SELECT * FROM tree WHERE depth>0 ORDER BY depth LOOP
    SELECT row INTO parent FROM user_data_rows WHERE table_id=item.table_id AND row->>'case_id'=item.row->>'parent_case_id';
    fields:=axtn_case_responsibility_fields(parent);
    IF axtn_case_responsibility_fields(item.row) IS DISTINCT FROM fields THEN
      UPDATE user_data_rows SET row=row||fields WHERE id=item.id;
      INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
        SELECT t.user_id,'axtn_case_assignment.NATIVE_BACKFILL_INHERITED','axtn_case_assignment',
          (item.row->>'case_id')::uuid,stamp,jsonb_build_object(
            'operation','ADDITIVE_INHERITANCE_BACKFILL','principal',jsonb_build_object('kind','system','id','native-case-default'),
            'from',axtn_case_responsibility_fields(item.row),'to',fields,'assignmentVersion',1)
          FROM user_data_tables t WHERE t.id=item.table_id;
    END IF;
  END LOOP;
END;
$$;

UPDATE user_data_tables t SET columns=t.columns||(
  SELECT COALESCE(jsonb_agg(jsonb_build_object('name',k,'type','string')),'[]') FROM (
    SELECT DISTINCT k FROM user_data_rows r CROSS JOIN LATERAL jsonb_object_keys(r.row) k
      WHERE r.table_id=t.id AND (k LIKE 'assignment_%' OR k LIKE 'responsible_principal_%'
        OR k LIKE 'semantic_route_%' OR k='assignee_user_id')
        AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(t.columns) c WHERE c->>'name'=k)) fields)
  WHERE t.name='axtn_cases';

CREATE FUNCTION public.axtn_case_assignment(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE principal jsonb:=p_payload->'_principal'; payload jsonb:=p_payload-'_principal';
  custodian uuid; dataset uuid; row_id bigint; current_case jsonb; parent jsonb; fields jsonb;
  result jsonb; prior jsonb; request_hash text; revision bigint; stamp timestamptz;
  selected jsonb; total bigint; page_offset integer; page_limit integer;
BEGIN
  PERFORM assert_axtn_case_principal(p_user_id,principal);
  IF COALESCE(p_operation,'') NOT IN ('case_assignment','case_access')
    OR jsonb_typeof(payload) IS DISTINCT FROM 'object'
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(payload) k WHERE NOT k=ANY(
      CASE p_operation WHEN 'case_access' THEN ARRAY['caseId','sharedOnly','offset','limit']
      ELSE ARRAY['caseId','expectedVersion','transitionKey','responsiblePrincipalType',
        'responsiblePrincipalId','assigneeUserId','assignmentPolicy','assignmentInheritance',
        'semanticRouteMode','semanticRouteProviderId','semanticRouteModelId'] END))
  THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_PAYLOAD_REQUIRED'; END IF;
  IF p_operation='case_access' THEN
    IF jsonb_typeof(payload->'offset') IS DISTINCT FROM 'number'
      OR COALESCE(payload->>'offset','') !~ '^[0-9]{1,9}$'
      OR jsonb_typeof(payload->'limit') IS DISTINCT FROM 'number'
      OR COALESCE(payload->>'limit','') !~ '^[0-9]{1,3}$'
      OR (payload->>'limit')::integer NOT BETWEEN 1 AND 200
      OR jsonb_typeof(payload->'sharedOnly') IS DISTINCT FROM 'boolean'
    THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_VIEW_REQUIRED'; END IF;
    page_offset:=(payload->>'offset')::integer; page_limit:=(payload->>'limit')::integer;
    IF payload ? 'caseId' THEN
      custodian:=axtn_case_custodian(p_user_id,payload->>'caseId',principal);
    END IF;
    SELECT COALESCE(jsonb_agg(axtn_case_project(p_user_id,t.user_id,r.row)||jsonb_build_object(
      'case_access_mode',CASE WHEN t.user_id=p_user_id THEN 'CUSTODIAN' ELSE 'RESPONSIBLE' END)
      ORDER BY r.row->>'case_id'),'[]'),count(*) INTO selected,total
      FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id WHERE t.name='axtn_cases'
        AND (principal->>'kind'='user_session' OR t.user_id=p_user_id)
        AND axtn_case_visible(p_user_id,t.user_id,r.row)
        AND (NOT (payload->>'sharedOnly')::boolean OR t.user_id<>p_user_id)
        AND (NOT payload ? 'caseId' OR r.row->>'case_id'=payload->>'caseId');
    RETURN jsonb_build_object('scope','AUTHORIZED_CASES','total',total,'offset',page_offset,'limit',page_limit,
      'cases',(SELECT COALESCE(jsonb_agg(value),'[]') FROM (
        SELECT value FROM jsonb_array_elements(selected) ORDER BY value->>'case_id'
          OFFSET page_offset LIMIT page_limit) page));
  END IF;
  IF principal->>'kind'<>'user_session' THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_AUTHENTICATED_HUMAN_REQUIRED'; END IF;
  custodian:=axtn_case_custodian(p_user_id,payload->>'caseId',principal);
  IF custodian<>p_user_id THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_CUSTODIAN_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||custodian::text,0));
  stamp:=clock_timestamp();
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=custodian AND name='axtn_cases';
  SELECT id,row INTO row_id,current_case FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=payload->>'caseId' FOR UPDATE;
  revision:=COALESCE((current_case->>'assignment_version')::bigint,0);
  IF jsonb_typeof(payload->'expectedVersion') IS DISTINCT FROM 'number'
    OR COALESCE(payload->>'expectedVersion','') !~ '^[0-9]{1,16}$'
    OR (payload->>'expectedVersion')::numeric<1
    OR (payload->>'expectedVersion')::numeric>9007199254740991
    OR jsonb_typeof(payload->'transitionKey') IS DISTINCT FROM 'string'
    OR length(payload->>'transitionKey') NOT BETWEEN 1 AND 200
  THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_VERSION_REQUIRED'; END IF;
  request_hash:=encode(extensions.digest((payload||jsonb_build_object('principal',principal))::text,'sha256'),'hex');
  SELECT detail INTO prior FROM audit_events WHERE user_id=custodian
    AND action='axtn_case_assignment.ASSIGNED' AND detail->>'transitionKey'=payload->>'transitionKey';
  IF prior IS NOT NULL THEN
    IF prior->>'requestHash' IS DISTINCT FROM request_hash THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_CONFLICT'; END IF;
    IF revision<>(prior->>'resultVersion')::bigint THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_STALE_REPLAY'; END IF;
    RETURN current_case;
  END IF;
  IF revision<>(payload->>'expectedVersion')::bigint THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_VERSION_CONFLICT'; END IF;
  IF COALESCE(payload->>'responsiblePrincipalType','') NOT IN ('USER','GROUP','SYSTEM')
    OR COALESCE(payload->>'assignmentPolicy','') NOT IN ('MANUAL','LEAST_ACTIVE_ELIGIBLE')
    OR COALESCE(payload->>'assignmentInheritance','') NOT IN ('INHERIT','OVERRIDE')
    OR COALESCE(payload->>'semanticRouteMode','') NOT IN ('SYSTEM_INTEGRATION','PERSONAL_CONNECTION')
    OR payload->>'semanticRouteProviderId' IS NULL AND payload->>'semanticRouteModelId' IS NOT NULL
    OR length(COALESCE(payload->>'semanticRouteProviderId',''))>100
    OR length(COALESCE(payload->>'semanticRouteModelId',''))>200
    OR payload->'semanticRouteProviderId' IS NOT NULL AND payload->'semanticRouteProviderId'<>'null'::jsonb
      AND (jsonb_typeof(payload->'semanticRouteProviderId') IS DISTINCT FROM 'string'
        OR payload->>'semanticRouteProviderId' !~ '^[A-Za-z0-9_-]{1,100}$')
    OR payload->'semanticRouteModelId' IS NOT NULL AND payload->'semanticRouteModelId'<>'null'::jsonb
      AND (jsonb_typeof(payload->'semanticRouteModelId') IS DISTINCT FROM 'string' OR payload->>'semanticRouteModelId'='')
  THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_FIELDS_REQUIRED'; END IF;
  PERFORM 1 FROM auth.users WHERE id::text IN (
    payload->>'responsiblePrincipalId',payload->>'assigneeUserId') FOR SHARE;
  IF payload->>'responsiblePrincipalType'='GROUP' THEN
    PERFORM 1 FROM iam_groups WHERE id::text=payload->>'responsiblePrincipalId' FOR SHARE;
    PERFORM 1 FROM iam_group_members WHERE group_id::text=payload->>'responsiblePrincipalId'
      AND user_id::text=payload->>'assigneeUserId' FOR SHARE;
  END IF;
  IF payload->>'responsiblePrincipalType'='USER' AND NOT EXISTS(SELECT 1 FROM auth.users
    WHERE id::text=payload->>'responsiblePrincipalId' AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()))
    OR payload->>'responsiblePrincipalType'='USER'
      AND payload->>'assigneeUserId' IS DISTINCT FROM payload->>'responsiblePrincipalId'
    OR payload->>'responsiblePrincipalType'='GROUP' AND NOT EXISTS(SELECT 1 FROM iam_groups
      WHERE id::text=payload->>'responsiblePrincipalId')
    OR payload->>'responsiblePrincipalType'='GROUP' AND payload->>'assigneeUserId' IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM iam_group_members m JOIN auth.users u ON u.id=m.user_id
        WHERE m.group_id::text=payload->>'responsiblePrincipalId' AND m.user_id::text=payload->>'assigneeUserId'
          AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=now()))
    OR payload->>'responsiblePrincipalType'='SYSTEM' AND (
      payload->>'responsiblePrincipalId' IS NOT NULL OR payload->>'assigneeUserId' IS NOT NULL
      OR payload->>'semanticRouteMode'<>'SYSTEM_INTEGRATION')
  THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_ELIGIBLE_PRINCIPAL_REQUIRED'; END IF;
  fields:=jsonb_build_object('responsible_principal_type',payload->>'responsiblePrincipalType',
    'responsible_principal_id',payload->'responsiblePrincipalId','assignee_user_id',payload->'assigneeUserId',
    'assignment_policy',payload->>'assignmentPolicy','semantic_route_mode',payload->>'semanticRouteMode',
    'semantic_route_provider_id',payload->'semanticRouteProviderId','semantic_route_model_id',payload->'semanticRouteModelId');
  IF payload->>'assignmentInheritance'='INHERIT' THEN
    SELECT row INTO parent FROM user_data_rows WHERE table_id=dataset
      AND row->>'case_id'=current_case->>'parent_case_id';
    IF parent IS NULL OR fields IS DISTINCT FROM axtn_case_responsibility_fields(parent)
    THEN RAISE EXCEPTION 'CASE_ASSIGNMENT_PARENT_BINDING_REQUIRED'; END IF;
  END IF;
  result:=current_case||fields||jsonb_build_object('assignment_inheritance',payload->>'assignmentInheritance',
    'assignment_version',revision+1,'assignment_updated_at',stamp,'assignment_updated_by',principal->>'id',
    'semantic_route_version',COALESCE((current_case->>'semantic_route_version')::bigint,0)+
      CASE WHEN (current_case->'semantic_route_mode',current_case->'semantic_route_provider_id',current_case->'semantic_route_model_id')
        IS DISTINCT FROM (fields->'semantic_route_mode',fields->'semantic_route_provider_id',fields->'semantic_route_model_id')
      THEN 1 ELSE 0 END);
  UPDATE user_data_rows SET row=result WHERE id=row_id;
  INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
    VALUES(custodian,'axtn_case_assignment.ASSIGNED','axtn_case_assignment',(payload->>'caseId')::uuid,stamp,
      jsonb_build_object('transitionKey',payload->>'transitionKey','requestHash',request_hash,
        'principal',principal,'from',axtn_case_responsibility_fields(current_case),'to',fields,
        'resultVersion',revision+1,'attemptId',current_case->'attempt_id','activeAttemptRebound',false));
  PERFORM axtn_case_inherit_descendants(custodian,dataset,payload->>'caseId',fields,principal,
    payload->>'transitionKey',stamp);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_assignment(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_assignment(uuid,text,jsonb) TO service_role;

-- Return native trigger-populated responsibility on the first ensure as well as replay.
ALTER FUNCTION public.axtn_case_work(uuid,text,jsonb) RENAME TO axtn_case_work_before_responsibility;
REVOKE ALL ON FUNCTION public.axtn_case_work_before_responsibility(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_case_work(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb; fields jsonb; shared jsonb; shared_events jsonb; custodian uuid:=p_user_id;
  actor_id uuid:=p_user_id; principal jsonb:=p_payload->'_principal';
  trusted_context text:=COALESCE(current_setting('axtn.case_principal',true),'');
BEGIN
  PERFORM set_config('axtn.case_principal',COALESCE((p_payload->'_principal')::text,''),true);
  -- Independent Acceptance retains the existing protected approval contract and custody context.
  IF principal IS NOT NULL AND p_operation<>'accept' THEN
    PERFORM assert_axtn_case_principal(actor_id,principal);
    IF p_payload ? 'caseId' THEN
      custodian:=axtn_case_custodian(actor_id,p_payload->>'caseId',principal);
    ELSIF p_operation='ensure' AND p_payload->>'parentCaseId' IS NOT NULL THEN
      custodian:=axtn_case_custodian(actor_id,p_payload->>'parentCaseId',principal);
    END IF;
  END IF;
  p_user_id:=custodian;
  result:=axtn_case_work_before_responsibility(p_user_id,p_operation,p_payload);
  IF result ? 'case_id' THEN
    SELECT (SELECT jsonb_object_agg(key,val) FROM jsonb_each(r.row) e(key,val)
      WHERE key LIKE 'assignment_%' OR key LIKE 'responsible_principal_%'
        OR key LIKE 'semantic_route_%' OR key='assignee_user_id') INTO fields
      FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.name='axtn_cases' AND t.user_id=p_user_id AND r.row->>'case_id'=result->>'case_id';
    result:=axtn_case_project(actor_id,custodian,result||COALESCE(fields,'{}'));
  ELSIF p_operation='list' AND principal->>'kind'='user_session' THEN
    SELECT COALESCE(jsonb_agg(axtn_case_project(actor_id,t.user_id,r.row)
      ORDER BY r.row->>'case_id'),'[]') INTO shared
      FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.name='axtn_cases' AND t.user_id<>actor_id AND r.row->>'source_kind'='development_work'
        AND axtn_case_visible(actor_id,t.user_id,r.row);
    SELECT COALESCE(jsonb_agg(jsonb_build_object('action',a.action,'caseId',a.resource_id,
      'timestamp',a.created_at,'detail',jsonb_strip_nulls(jsonb_build_object(
        'principal',a.detail->'principal','eventType',a.detail->'request'->'eventType',
        'request',jsonb_strip_nulls(jsonb_build_object('attemptId',a.detail->'request'->'attemptId')),
        'reasonCode',a.detail->'request'->'reasonCode','fromMode',a.detail->'fromMode',
        'toMode',a.detail->'toMode','processingMode',a.detail->'processingMode')))
      ORDER BY a.created_at,a.id),'[]') INTO shared_events
      FROM audit_events a WHERE a.resource_type='axtn_case_work' AND EXISTS(
        SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
        WHERE t.name='axtn_cases' AND t.user_id=a.user_id AND t.user_id<>actor_id
          AND r.row->>'case_id'=a.resource_id::text AND r.row->>'source_kind'='development_work'
          AND axtn_case_visible(actor_id,t.user_id,r.row));
    result:=result||jsonb_build_object('cases',COALESCE(result->'cases','[]')||shared,
      'events',COALESCE(result->'events','[]')||shared_events);
  END IF;
  IF p_operation='list' THEN
    SELECT COALESCE(jsonb_agg(CASE WHEN c->>'parent_case_id' IS NOT NULL
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result->'cases') p
        WHERE p->>'case_id'=c->>'parent_case_id')
      AND EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
        WHERE t.name='axtn_cases' AND r.row->>'case_id'=c->>'parent_case_id'
          AND r.row->>'source_kind' IS DISTINCT FROM 'development_work'
          AND EXISTS(SELECT 1 FROM user_data_rows child WHERE child.table_id=r.table_id
            AND child.row->>'case_id'=c->>'case_id')
          AND axtn_case_visible(actor_id,t.user_id,r.row))
      THEN c||jsonb_build_object('view_root_reason','PARENT_OUTSIDE_WORK_VIEW') ELSE c END
      ORDER BY c->>'case_id'),'[]') INTO fields FROM jsonb_array_elements(result->'cases') c;
    result:=result||jsonb_build_object('cases',fields);
  END IF;
  PERFORM set_config('axtn.case_principal',trusted_context,true);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_work(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_work(uuid,text,jsonb) TO service_role;

-- Preserve the existing DMS authority/effect contract and enrich first response/replay alike.
ALTER FUNCTION public.axtn_case_document(uuid,text,jsonb) RENAME TO axtn_case_document_before_responsibility;
REVOKE ALL ON FUNCTION public.axtn_case_document_before_responsibility(uuid,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_case_document(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb; fields jsonb;
  trusted_context text:=COALESCE(current_setting('axtn.case_principal',true),'');
BEGIN
  PERFORM set_config('axtn.case_principal',COALESCE((p_payload->'_principal')::text,''),true);
  result:=axtn_case_document_before_responsibility(p_user_id,p_operation,p_payload);
  IF result->>'source_kind'='document_work' AND result ? 'case_id' THEN
    SELECT (SELECT jsonb_object_agg(key,val) FROM jsonb_each(r.row) e(key,val)
      WHERE key LIKE 'assignment_%' OR key LIKE 'responsible_principal_%'
        OR key LIKE 'semantic_route_%' OR key='assignee_user_id') INTO fields
      FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.name='axtn_cases' AND t.user_id=p_user_id AND r.row->>'case_id'=result->>'case_id';
    result:=result||COALESCE(fields,'{}');
  END IF;
  PERFORM set_config('axtn.case_principal',trusted_context,true);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_document(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_document(uuid,text,jsonb) TO service_role;
