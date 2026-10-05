-- Explicit hours use the existing owner-scoped dataset and audit, never mode duration.
CREATE POLICY "Case capacity stays private to custodian" ON public.user_data_tables
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (name<>'axtn_case_capacity' OR user_id=auth.uid());
CREATE POLICY "Case capacity rows stay private to custodian" ON public.user_data_rows
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT EXISTS(SELECT 1 FROM user_data_tables t
    WHERE t.id=table_id AND t.name='axtn_case_capacity' AND t.user_id IS DISTINCT FROM auth.uid())
    AND EXISTS(SELECT 1 FROM user_data_tables t WHERE t.id=table_id));
CREATE FUNCTION public.guard_axtn_case_capacity() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE protected boolean:=false;
BEGIN
  IF TG_TABLE_NAME='audit_events' THEN
    IF TG_OP<>'INSERT' THEN protected:=OLD.action LIKE 'axtn_case_capacity.%'; END IF;
    IF TG_OP<>'DELETE' THEN protected:=protected OR NEW.action LIKE 'axtn_case_capacity.%'; END IF;
  ELSIF TG_TABLE_NAME='user_data_tables' THEN
    IF TG_OP<>'INSERT' THEN protected:=OLD.name='axtn_case_capacity'; END IF;
    IF TG_OP<>'DELETE' THEN protected:=protected OR NEW.name='axtn_case_capacity'; END IF;
  ELSE
    IF TG_OP<>'INSERT' THEN
      protected:=EXISTS(SELECT 1 FROM user_data_tables WHERE id=OLD.table_id AND name='axtn_case_capacity');
    END IF;
    IF TG_OP<>'DELETE' THEN
      protected:=protected OR EXISTS(SELECT 1 FROM user_data_tables
        WHERE id=NEW.table_id AND name='axtn_case_capacity');
    END IF;
  END IF;
  IF protected AND current_user<>'postgres'
  THEN RAISE EXCEPTION 'CASE_CAPACITY_NATIVE_CONTRACT_REQUIRED'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_axtn_case_capacity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER guard_axtn_case_capacity_rows BEFORE INSERT OR UPDATE OR DELETE ON user_data_rows
  FOR EACH ROW EXECUTE FUNCTION guard_axtn_case_capacity();
CREATE TRIGGER guard_axtn_case_capacity_tables BEFORE INSERT OR UPDATE OR DELETE ON user_data_tables
  FOR EACH ROW EXECUTE FUNCTION guard_axtn_case_capacity();
CREATE TRIGGER guard_axtn_case_capacity_audit BEFORE INSERT OR UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION guard_axtn_case_capacity();

CREATE FUNCTION public.axtn_case_capacity(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE principal jsonb:=p_payload->'_principal'; payload jsonb:=p_payload-'_principal';
  dataset uuid; cases uuid; kind text; identity text; target_case text; current_row jsonb;
  allocation jsonb; commitment jsonb; previous jsonb; result jsonb; prior jsonb;
  revision bigint; request_hash text; stamp timestamptz; lineage jsonb; selected jsonb;
  scoped_ids jsonb; used numeric; committed numeric; net numeric; replacement numeric;
  total bigint; page_offset integer; page_limit integer; field_name text;
BEGIN
  PERFORM assert_axtn_case_principal(p_user_id,principal);
  IF COALESCE(p_operation,'') NOT IN ('capacity_allocation','capacity_commitment',
    'capacity_consumption','capacity_view') OR jsonb_typeof(payload) IS DISTINCT FROM 'object'
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(payload) k WHERE NOT k=ANY(
      CASE p_operation
        WHEN 'capacity_allocation' THEN ARRAY['allocationId','contextCaseId','providerRef','poolRef',
          'startsOn','endsOn','availableHours','unavailableHours','expectedVersion','transitionKey']
        WHEN 'capacity_commitment' THEN ARRAY['commitmentId','allocationId','caseId','hours','expectedVersion','transitionKey']
        WHEN 'capacity_consumption' THEN ARRAY['consumptionId','commitmentId','caseId','bookedOn','hours',
          'capabilityRef','purpose','supersedes','expectedVersion','transitionKey']
        ELSE ARRAY['caseId','scope','offset','limit'] END))
  THEN RAISE EXCEPTION 'CASE_CAPACITY_PAYLOAD_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text,0));
  stamp:=clock_timestamp();
  SELECT id INTO cases FROM user_data_tables WHERE user_id=p_user_id AND name='axtn_cases';
  IF cases IS NULL THEN RAISE EXCEPTION 'CASE_CAPACITY_CASE_DATASET_REQUIRED'; END IF;
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=p_user_id AND name='axtn_case_capacity';
  IF p_operation='capacity_view' THEN
    IF COALESCE(payload->>'scope','') NOT IN ('CURRENT','RECORDED')
      OR jsonb_typeof(payload->'offset') IS DISTINCT FROM 'number'
      OR COALESCE(payload->>'offset','') !~ '^[0-9]{1,9}$'
      OR jsonb_typeof(payload->'limit') IS DISTINCT FROM 'number'
      OR COALESCE(payload->>'limit','') !~ '^[0-9]{1,3}$'
      OR (payload->>'limit')::integer NOT BETWEEN 1 AND 200
    THEN RAISE EXCEPTION 'CASE_CAPACITY_VIEW_REQUIRED'; END IF;
    IF payload ? 'caseId' AND NOT EXISTS(SELECT 1 FROM user_data_rows
      WHERE table_id=cases AND row->>'case_id'=payload->>'caseId')
    THEN RAISE EXCEPTION 'CASE_CAPACITY_AUTHORIZED_CASE_REQUIRED'; END IF;
    page_offset:=(payload->>'offset')::integer; page_limit:=(payload->>'limit')::integer;
    WITH RECURSIVE subtree AS (
      SELECT row->>'case_id' id,ARRAY[row->>'case_id'] path FROM user_data_rows WHERE table_id=cases
        AND (NOT payload ? 'caseId' OR row->>'case_id'=payload->>'caseId')
      UNION ALL
      SELECT r.row->>'case_id',s.path||(r.row->>'case_id') FROM subtree s JOIN user_data_rows r
        ON r.table_id=cases AND r.row->>'parent_case_id'=s.id
        WHERE payload ? 'caseId' AND NOT r.row->>'case_id'=ANY(s.path)
    ) SELECT COALESCE(jsonb_agg(id),'[]') INTO scoped_ids FROM subtree;
    SELECT COALESCE(jsonb_agg(r.row ORDER BY r.row->>'id'),'[]'),count(*) INTO selected,total
      FROM user_data_rows r WHERE r.table_id=dataset
        AND (NOT payload ? 'caseId' OR CASE WHEN payload->>'scope'='RECORDED'
          THEN r.row->'recordedScope' ? (payload->>'caseId')
          ELSE scoped_ids ? (r.row->>'caseId') END);
    RETURN jsonb_build_object('scope','OWNED_LOCAL_CASES','hierarchyScope',payload->>'scope',
      'total',total,'offset',page_offset,'limit',page_limit,'asOf',stamp,
      'records',(SELECT COALESCE(jsonb_agg(value ORDER BY value->>'id'),'[]') FROM
        (SELECT value FROM jsonb_array_elements(selected) ORDER BY value->>'id'
          OFFSET page_offset LIMIT page_limit) page),
      'actualHours',(SELECT COALESCE(sum((b->>'hours')::numeric),0)
        FROM jsonb_array_elements(selected) b WHERE b->>'kind'='consumption'
          AND NOT EXISTS(SELECT 1 FROM user_data_rows n WHERE n.table_id=dataset
            AND n.row->>'supersedes'=b->>'id')),
      'purposeHours',(SELECT COALESCE(jsonb_object_agg(purpose,hours),'{}') FROM (
        SELECT b->>'purpose' purpose,sum((b->>'hours')::numeric) hours
          FROM jsonb_array_elements(selected) b WHERE b->>'kind'='consumption'
            AND NOT EXISTS(SELECT 1 FROM user_data_rows n WHERE n.table_id=dataset
              AND n.row->>'supersedes'=b->>'id') GROUP BY 1) grouped),
      'capacityPeriods',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'allocationId',a->>'id','providerRef',a->>'providerRef','poolRef',a->>'poolRef',
        'startsOn',a->>'startsOn','endsOn',a->>'endsOn',
        'netAvailableHours',(a->>'availableHours')::numeric-(a->>'unavailableHours')::numeric,
        'committedHours',(SELECT COALESCE(sum((c.row->>'hours')::numeric),0)
          FROM user_data_rows c WHERE c.table_id=dataset AND c.row->>'kind'='commitment'
            AND c.row->>'allocationId'=a->>'id'))),'[]')
        FROM jsonb_array_elements(selected) a WHERE a->>'kind'='allocation'),
      'remainingEstimateHours',NULL,'eacHours',NULL,'forecastStatus','UNKNOWN',
      'stateDurationIsConsumption',false,'capacityIsCredentialAuthority',false);
  END IF;
  IF principal->>'kind'<>'user_session'
  THEN RAISE EXCEPTION 'CASE_CAPACITY_AUTHENTICATED_HUMAN_REQUIRED'; END IF;
  IF jsonb_typeof(payload->'expectedVersion') IS DISTINCT FROM 'number'
    OR COALESCE(payload->>'expectedVersion','') !~ '^[0-9]{1,16}$'
    OR (payload->>'expectedVersion')::numeric>9007199254740991
    OR jsonb_typeof(payload->'transitionKey') IS DISTINCT FROM 'string'
    OR length(payload->>'transitionKey') NOT BETWEEN 1 AND 200
  THEN RAISE EXCEPTION 'CASE_CAPACITY_VERSION_REQUIRED'; END IF;
  kind:=replace(p_operation,'capacity_','');
  identity:=payload->>(kind||'Id');
  IF COALESCE(identity,'') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN RAISE EXCEPTION 'CASE_CAPACITY_IDENTITY_REQUIRED'; END IF;
  request_hash:=encode(extensions.digest((payload||jsonb_build_object(
    'operation',p_operation,'principal',principal))::text,'sha256'),'hex');
  SELECT detail INTO prior FROM audit_events WHERE user_id=p_user_id
    AND action LIKE 'axtn_case_capacity.%' AND detail->>'transitionKey'=payload->>'transitionKey';
  IF prior IS NOT NULL THEN
    IF prior->>'requestHash' IS DISTINCT FROM request_hash
    THEN RAISE EXCEPTION 'CASE_CAPACITY_REPLAY_CONFLICT'; END IF;
    SELECT row INTO result FROM user_data_rows WHERE table_id=dataset AND row->>'id'=identity;
    IF result IS NULL THEN RAISE EXCEPTION 'CASE_CAPACITY_STALE_REPLAY'; END IF;
    RETURN result;
  END IF;
  SELECT row INTO current_row FROM user_data_rows WHERE table_id=dataset AND row->>'id'=identity;
  revision:=COALESCE((current_row->>'version')::bigint,0);
  IF revision<>(payload->>'expectedVersion')::bigint
  THEN RAISE EXCEPTION 'CASE_CAPACITY_VERSION_CONFLICT'; END IF;
  IF current_row IS NOT NULL THEN RAISE EXCEPTION 'CASE_CAPACITY_APPEND_ONLY_CORRECTION_REQUIRED'; END IF;
  IF revision<>0 THEN RAISE EXCEPTION 'CASE_CAPACITY_VERSION_CONFLICT'; END IF;
  target_case:=COALESCE(payload->>'caseId',payload->>'contextCaseId');
  IF NOT EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=cases AND row->>'case_id'=target_case)
  THEN RAISE EXCEPTION 'CASE_CAPACITY_AUTHORIZED_CASE_REQUIRED'; END IF;
  WITH RECURSIVE ancestors AS (
    SELECT row->>'case_id' id,row->>'parent_case_id' parent,ARRAY[row->>'case_id'] path
      FROM user_data_rows WHERE table_id=cases AND row->>'case_id'=target_case
    UNION ALL
    SELECT r.row->>'case_id',r.row->>'parent_case_id',a.path||(r.row->>'case_id')
      FROM ancestors a JOIN user_data_rows r ON r.table_id=cases AND r.row->>'case_id'=a.parent
      WHERE NOT r.row->>'case_id'=ANY(a.path)
  ) SELECT jsonb_agg(id) INTO lineage FROM ancestors;
  FOREACH field_name IN ARRAY CASE kind WHEN 'allocation' THEN ARRAY['availableHours','unavailableHours']
    ELSE ARRAY['hours'] END LOOP
    IF jsonb_typeof(payload->field_name) IS DISTINCT FROM 'number'
      OR COALESCE(payload->>field_name,'') !~ '^[0-9]{1,6}([.][0-9]{1,4})?$'
      OR (payload->>field_name)::numeric>100000
    THEN RAISE EXCEPTION 'CASE_CAPACITY_NONNEGATIVE_HOURS_REQUIRED'; END IF;
  END LOOP;
  IF kind='allocation' THEN
    IF COALESCE(payload->>'providerRef','') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
      OR COALESCE(payload->>'poolRef','') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
      OR COALESCE(payload->>'startsOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      OR COALESCE(payload->>'endsOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      OR (payload->>'endsOn')::date<(payload->>'startsOn')::date
      OR (payload->>'unavailableHours')::numeric>(payload->>'availableHours')::numeric
    THEN RAISE EXCEPTION 'CASE_CAPACITY_ALLOCATION_REQUIRED'; END IF;
    IF EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset AND row->>'kind'='allocation'
      AND row->>'providerRef'=payload->>'providerRef'
      AND (row->>'startsOn')::date<=(payload->>'endsOn')::date
      AND (row->>'endsOn')::date>=(payload->>'startsOn')::date)
    THEN RAISE EXCEPTION 'CASE_CAPACITY_PROVIDER_OVERLAP_DENIED'; END IF;
  ELSE
    IF kind='commitment' THEN
      SELECT row INTO allocation FROM user_data_rows WHERE table_id=dataset
        AND row->>'id'=payload->>'allocationId' AND row->>'kind'='allocation';
      IF allocation IS NULL OR NOT lineage ? (allocation->>'caseId')
      THEN RAISE EXCEPTION 'CASE_CAPACITY_CONTEXT_REQUIRED'; END IF;
      net:=(allocation->>'availableHours')::numeric-(allocation->>'unavailableHours')::numeric;
      SELECT COALESCE(sum((row->>'hours')::numeric),0) INTO committed FROM user_data_rows
        WHERE table_id=dataset AND row->>'kind'='commitment' AND row->>'allocationId'=allocation->>'id';
      IF committed+(payload->>'hours')::numeric>net
      THEN RAISE EXCEPTION 'CASE_CAPACITY_COMMITMENT_LIMIT'; END IF;
    ELSE
      SELECT row INTO commitment FROM user_data_rows WHERE table_id=dataset
        AND row->>'id'=payload->>'commitmentId' AND row->>'kind'='commitment';
      SELECT row INTO allocation FROM user_data_rows WHERE table_id=dataset
        AND row->>'id'=commitment->>'allocationId' AND row->>'kind'='allocation';
      IF payload ? 'supersedes' THEN
        SELECT row INTO previous FROM user_data_rows WHERE table_id=dataset
          AND row->>'id'=payload->>'supersedes' AND row->>'kind'='consumption';
        IF previous IS NULL OR previous->>'commitmentId' IS DISTINCT FROM payload->>'commitmentId'
          OR previous->>'caseId' IS DISTINCT FROM target_case OR EXISTS(SELECT 1 FROM user_data_rows
            WHERE table_id=dataset AND row->>'supersedes'=previous->>'id')
        THEN RAISE EXCEPTION 'CASE_CAPACITY_CORRECTION_CONFLICT'; END IF;
        lineage:=previous->'recordedScope';
      END IF;
      IF commitment IS NULL OR allocation IS NULL OR NOT lineage ? (commitment->>'caseId')
      THEN RAISE EXCEPTION 'CASE_CAPACITY_COMMITMENT_REQUIRED'; END IF;
      IF COALESCE(payload->>'purpose','') NOT IN ('DELIVERY','CAPABILITY_UPLIFT','ASSURANCE')
        OR COALESCE(payload->>'capabilityRef','') !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
        OR COALESCE(payload->>'bookedOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        OR (payload->>'bookedOn')::date NOT BETWEEN (allocation->>'startsOn')::date AND (allocation->>'endsOn')::date
      THEN RAISE EXCEPTION 'CASE_CAPACITY_BOOKING_REQUIRED'; END IF;
      replacement:=0;
      IF previous IS NOT NULL THEN
        replacement:=(previous->>'hours')::numeric;
      END IF;
      SELECT COALESCE(sum((r.row->>'hours')::numeric),0) INTO used FROM user_data_rows r
        WHERE r.table_id=dataset AND r.row->>'kind'='consumption'
          AND r.row->>'commitmentId'=commitment->>'id'
          AND NOT EXISTS(SELECT 1 FROM user_data_rows n WHERE n.table_id=dataset AND n.row->>'supersedes'=r.row->>'id');
      IF used-replacement+(payload->>'hours')::numeric>(commitment->>'hours')::numeric
      THEN RAISE EXCEPTION 'CASE_CAPACITY_CONSUMPTION_LIMIT'; END IF;
    END IF;
  END IF;
  IF dataset IS NULL THEN
    INSERT INTO user_data_tables(user_id,name,source_filename,columns,is_sample)
      VALUES(p_user_id,'axtn_case_capacity','Native explicit capacity and consumption','[]',false)
      RETURNING id INTO dataset;
  END IF;
  result:=payload-ARRAY['transitionKey','expectedVersion']||jsonb_build_object(
    'id',identity,'kind',kind,'caseId',target_case,'version',1,'recordedScope',lineage,
    'recordedAt',stamp,'actor',principal);
  IF kind<>'allocation' THEN result:=result||jsonb_build_object(
    'providerRef',allocation->'providerRef','poolRef',allocation->'poolRef'); END IF;
  INSERT INTO user_data_rows(table_id,row) VALUES(dataset,result);
  INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
    VALUES(p_user_id,'axtn_case_capacity.'||upper(kind),'axtn_case_capacity',identity::uuid,stamp,
      jsonb_build_object('transitionKey',payload->>'transitionKey','requestHash',request_hash,
        'principal',principal,'caseId',target_case,'resultVersion',1,'supersedes',payload->'supersedes'));
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_capacity(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_capacity(uuid,text,jsonb) TO service_role;

ALTER FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb)
  RENAME TO axtn_local_table_upsert_before_capacity;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert_before_capacity(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_local_table_upsert(
  _user_id uuid,_table_name text,_key_column text,_key_value text,_row jsonb
) RETURNS TABLE(table_id uuid,row_id bigint,outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF _table_name='axtn_case_capacity' THEN RAISE EXCEPTION 'CASE_CAPACITY_NATIVE_CONTRACT_REQUIRED'; END IF;
  RETURN QUERY SELECT * FROM axtn_local_table_upsert_before_capacity(
    _user_id,_table_name,_key_column,_key_value,_row);
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb) TO service_role;
