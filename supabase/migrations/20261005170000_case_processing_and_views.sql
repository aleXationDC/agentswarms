-- Extend the existing Case row, native audit and LocalTable guards; no new history store.
CREATE FUNCTION public.assert_axtn_case_principal(owner_id uuid,principal jsonb)
RETURNS void LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=owner_id)
    OR jsonb_typeof(principal) IS DISTINCT FROM 'object'
    OR COALESCE(principal->>'kind','') NOT IN ('user_session','swarm','swarm_api_key')
    OR COALESCE(principal->>'id','')=''
  THEN RAISE EXCEPTION 'CASE_PROCESSING_AUTHENTICATED_OWNER_REQUIRED'; END IF;
  IF principal->>'kind' IN ('user_session','swarm')
    AND principal->>'id' IS DISTINCT FROM owner_id::text
  THEN RAISE EXCEPTION 'CASE_PROCESSING_PRINCIPAL_DENIED'; END IF;
  IF principal->>'kind'='swarm_api_key' AND NOT EXISTS(
    SELECT 1 FROM swarm_api_keys WHERE id=(principal->>'id')::uuid AND user_id=owner_id
      AND is_active AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>now())
      AND 'cases'=ANY(scopes))
  THEN RAISE EXCEPTION 'CASE_PROCESSING_CASE_KEY_DENIED'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assert_axtn_case_principal(uuid,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.guard_axtn_case_processing() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE protected boolean := false; dataset_name text; old_dataset_name text;
  parent_id text; case_identity text;
BEGIN
  IF TG_TABLE_NAME='audit_events' THEN
    IF TG_OP<>'INSERT' THEN protected := OLD.action LIKE 'axtn_case_processing.%'; END IF;
    IF TG_OP<>'DELETE' THEN protected := protected OR NEW.action LIKE 'axtn_case_processing.%'; END IF;
  ELSIF TG_TABLE_NAME='user_data_tables' THEN
    IF OLD.name='axtn_cases' THEN
      protected := TG_OP='DELETE';
      IF TG_OP='UPDATE' THEN
        protected := OLD.id IS DISTINCT FROM NEW.id OR OLD.user_id IS DISTINCT FROM NEW.user_id
          OR OLD.name IS DISTINCT FROM NEW.name OR OLD.columns IS DISTINCT FROM NEW.columns;
      END IF;
    END IF;
  ELSE
    SELECT name INTO dataset_name FROM user_data_tables WHERE id=
      CASE WHEN TG_OP='DELETE' THEN OLD.table_id ELSE NEW.table_id END;
    IF TG_OP<>'INSERT' THEN
      SELECT name INTO old_dataset_name FROM user_data_tables WHERE id=OLD.table_id;
    END IF;
    protected:=(dataset_name='axtn_cases' OR old_dataset_name='axtn_cases');
    IF TG_OP<>'DELETE' THEN
      SELECT name INTO dataset_name FROM user_data_tables WHERE id=NEW.table_id;
      IF dataset_name='axtn_cases' AND (
        TG_OP='INSERT' OR OLD.row->'parent_case_id' IS DISTINCT FROM NEW.row->'parent_case_id'
        OR OLD.table_id IS DISTINCT FROM NEW.table_id OR OLD.row->'case_id' IS DISTINCT FROM NEW.row->'case_id'
      ) THEN
        parent_id := NEW.row->>'parent_case_id'; case_identity := NEW.row->>'case_id';
        IF parent_id IS NOT NULL THEN
          IF parent_id=case_identity THEN RAISE EXCEPTION 'CASE_PARENT_SELF_DENIED'; END IF;
          IF NOT EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=NEW.table_id
            AND row->>'case_id'=parent_id)
          THEN RAISE EXCEPTION 'CASE_OWNED_PARENT_REQUIRED'; END IF;
          IF EXISTS(WITH RECURSIVE ancestors AS (
            SELECT row->>'case_id' id,row->>'parent_case_id' parent,ARRAY[row->>'case_id'] path,false cycle
            FROM user_data_rows WHERE table_id=NEW.table_id AND row->>'case_id'=parent_id
            UNION ALL
            SELECT r.row->>'case_id',r.row->>'parent_case_id',a.path||(r.row->>'case_id'),
              r.row->>'case_id'=ANY(a.path)
            FROM ancestors a JOIN user_data_rows r ON r.table_id=NEW.table_id
              AND r.row->>'case_id'=a.parent WHERE NOT a.cycle
          ) SELECT 1 FROM ancestors WHERE id=case_identity OR cycle)
          THEN RAISE EXCEPTION 'CASE_PARENT_CYCLE_DENIED'; END IF;
        END IF;
      END IF;
    END IF;
  END IF;
  IF COALESCE(protected,false) AND current_user<>'postgres'
  THEN RAISE EXCEPTION 'CASE_PROCESSING_NATIVE_CONTRACT_REQUIRED'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_axtn_case_processing() FROM PUBLIC,anon,authenticated,service_role;
-- Existing Development/DMS guards retain their more specific rejection contracts.
CREATE TRIGGER guard_z_axtn_case_processing_rows BEFORE INSERT OR UPDATE OR DELETE
  ON user_data_rows FOR EACH ROW EXECUTE FUNCTION guard_axtn_case_processing();
CREATE TRIGGER guard_z_axtn_case_processing_tables BEFORE UPDATE OR DELETE
  ON user_data_tables FOR EACH ROW EXECUTE FUNCTION guard_axtn_case_processing();
CREATE TRIGGER guard_z_axtn_case_processing_audit BEFORE INSERT OR UPDATE OR DELETE
  ON audit_events FOR EACH ROW EXECUTE FUNCTION guard_axtn_case_processing();

CREATE FUNCTION public.axtn_case_manual(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE principal jsonb:=p_payload->'_principal'; payload jsonb:=p_payload-'_principal';
  proposed jsonb:=payload->'row'; before_row jsonb; after_row jsonb; dataset uuid; row_id bigint;
  revision bigint; prior jsonb; prior_case_id uuid; request_hash text; stamp timestamptz:=clock_timestamp();
  allowed text[]:=ARRAY['subject','case_type','status','status_reason','priority','due_date',
    'follow_up','account_id','primary_contact_id','related_entity','parent_case_id',
    'external_environment_id','external_ref_id','external_parent_ref_id','updated_at','closed_at'];
BEGIN
  PERFORM assert_axtn_case_principal(p_user_id,principal);
  IF principal->>'kind'<>'user_session'
  THEN RAISE EXCEPTION 'CASE_MANUAL_AUTHENTICATED_HUMAN_REQUIRED'; END IF;
  IF COALESCE(p_operation,'') NOT IN ('create','update') OR jsonb_typeof(payload) IS DISTINCT FROM 'object'
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(payload) k
      WHERE k NOT IN ('row','expectedVersion','transitionKey'))
    OR jsonb_typeof(proposed) IS DISTINCT FROM 'object'
    OR jsonb_typeof(payload->'transitionKey') IS DISTINCT FROM 'string'
    OR length(payload->>'transitionKey') NOT BETWEEN 1 AND 200
    OR jsonb_typeof(payload->'expectedVersion') IS DISTINCT FROM 'number'
    OR COALESCE(payload->>'expectedVersion','') !~ '^[0-9]{1,16}$'
    OR (payload->>'expectedVersion')::numeric>9007199254740991
    OR (p_operation='update' OR proposed ? 'case_id') AND
      COALESCE(proposed->>'case_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN RAISE EXCEPTION 'CASE_MANUAL_PAYLOAD_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text,0));
  stamp:=clock_timestamp();
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=p_user_id AND name='axtn_cases';
  IF dataset IS NULL THEN
    INSERT INTO user_data_tables(user_id,name,source_filename,columns,is_sample)
      VALUES(p_user_id,'axtn_cases','aXtn SupaCase Management','[]',false) RETURNING id INTO dataset;
  END IF;
  request_hash:=encode(extensions.digest((payload||jsonb_build_object(
    'row',proposed-ARRAY['updated_at','closed_at'],
    'operation',p_operation,'principal',principal))::text,'sha256'),'hex');
  SELECT detail,resource_id INTO prior,prior_case_id FROM audit_events WHERE user_id=p_user_id
    AND action LIKE 'axtn_case_processing.MANUAL_%'
    AND detail->>'transitionKey'=payload->>'transitionKey';
  IF p_operation='create' AND NOT proposed ? 'case_id' THEN
    proposed:=proposed||jsonb_build_object('case_id',COALESCE(prior_case_id,gen_random_uuid()));
  END IF;
  IF (SELECT count(*) FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=proposed->>'case_id')>1
  THEN RAISE EXCEPTION 'CASE_MANUAL_AMBIGUOUS_CASE'; END IF;
  SELECT id,row INTO row_id,before_row FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=proposed->>'case_id' FOR UPDATE;
  revision:=COALESCE((before_row->>'case_version')::bigint,0);
  IF prior IS NOT NULL THEN
    IF prior->>'requestHash' IS DISTINCT FROM request_hash
    THEN RAISE EXCEPTION 'CASE_MANUAL_REPLAY_CONFLICT'; END IF;
    IF revision IS DISTINCT FROM (prior->>'resultVersion')::bigint
    THEN RAISE EXCEPTION 'CASE_MANUAL_STALE_REPLAY'; END IF;
    RETURN before_row;
  END IF;
  IF p_operation='create' AND before_row IS NOT NULL
    OR p_operation='update' AND before_row IS NULL
  THEN RAISE EXCEPTION 'CASE_MANUAL_IDENTITY_CONFLICT'; END IF;
  IF revision IS DISTINCT FROM (payload->>'expectedVersion')::bigint
  THEN RAISE EXCEPTION 'CASE_MANUAL_VERSION_CONFLICT'; END IF;
  IF p_operation='update' THEN
    IF before_row->>'source_kind' IN ('development_work','document_work')
    THEN RAISE EXCEPTION 'CASE_EXISTING_WORK_CONTRACT_REQUIRED'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(before_row||proposed) k
      WHERE NOT k=ANY(allowed) AND before_row->k IS DISTINCT FROM proposed->k)
    THEN RAISE EXCEPTION 'CASE_MANUAL_PROTECTED_FIELD_DENIED'; END IF;
  ELSIF EXISTS(SELECT 1 FROM jsonb_object_keys(proposed) k
    WHERE NOT k=ANY(allowed||ARRAY['case_id','source_kind','source_id','created_at']))
    OR proposed->>'source_kind' IS DISTINCT FROM 'manual'
    OR proposed->>'source_id' IS DISTINCT FROM p_user_id::text
  THEN RAISE EXCEPTION 'CASE_MANUAL_PROTECTED_FIELD_DENIED'; END IF;
  IF jsonb_typeof(proposed->'subject') IS DISTINCT FROM 'string'
    OR length(btrim(proposed->>'subject')) NOT BETWEEN 1 AND 500
    OR COALESCE(proposed->>'status','') NOT IN ('NEW','OPEN','WAITING_CONTACT','CLOSED')
    OR jsonb_typeof(proposed->'priority') IS DISTINCT FROM 'number'
    OR COALESCE(proposed->>'priority','') !~ '^[0-3]$'
    OR proposed->>'status'='WAITING_CONTACT' AND (
      proposed->>'primary_contact_id' IS NULL OR proposed->>'follow_up' IS NULL)
    OR EXISTS(SELECT 1 FROM jsonb_each(proposed) field
      WHERE field.key IN ('external_environment_id','external_ref_id','external_parent_ref_id')
        AND NOT axtn_case_opaque_reference(field.value))
  THEN RAISE EXCEPTION 'CASE_MANUAL_DRAFT_INVALID'; END IF;
  IF proposed->>'account_id' IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=p_user_id AND t.name='axtn_accounts'
        AND r.row->>'account_id'=proposed->>'account_id')
    OR proposed->>'primary_contact_id' IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
        WHERE t.user_id=p_user_id AND t.name='axtn_contacts'
          AND r.row->>'contact_id'=proposed->>'primary_contact_id')
  THEN RAISE EXCEPTION 'CASE_MANUAL_OWNED_CONTEXT_REQUIRED'; END IF;
  after_row:=jsonb_build_object('case_type','TODO')||proposed||jsonb_build_object('case_version',revision+1,'updated_at',stamp,
    'closed_at',CASE WHEN proposed->>'status'='CLOSED'
      THEN COALESCE(before_row->>'closed_at',stamp::text) ELSE NULL END);
  IF p_operation='create' THEN
    after_row:=after_row||jsonb_build_object('created_at',stamp);
  END IF;
  IF EXISTS(SELECT 1 FROM unnest(ARRAY['external_environment_id','external_ref_id',
    'external_parent_ref_id']) field WHERE before_row->field IS DISTINCT FROM after_row->field) THEN
    after_row:=after_row||jsonb_build_object('external_reference_version',
      COALESCE((before_row->>'external_reference_version')::bigint,0)+1);
  END IF;
  UPDATE user_data_tables t SET columns=t.columns||(
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name',k,'type','string')),'[]')
    FROM jsonb_object_keys(after_row) k WHERE NOT EXISTS(
      SELECT 1 FROM jsonb_array_elements(t.columns) c WHERE c->>'name'=k)) WHERE t.id=dataset;
  IF p_operation='create' THEN
    INSERT INTO user_data_rows(table_id,row) VALUES(dataset,after_row);
  ELSE UPDATE user_data_rows SET row=after_row WHERE id=row_id;
  END IF;
  INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
    VALUES(p_user_id,'axtn_case_processing.MANUAL_'||upper(p_operation),'axtn_case',
      (after_row->>'case_id')::uuid,stamp,jsonb_build_object(
        'transitionKey',payload->>'transitionKey','requestHash',request_hash,
        'principal',principal,'fromVersion',revision,'resultVersion',revision+1,
        'fromStatus',before_row->'status','toStatus',after_row->'status',
        'processingStage',after_row->'processing_stage',
        'reasonCode','MANUAL_'||upper(p_operation),
        'occurredAt',stamp,'recordedAt',stamp));
  RETURN after_row;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_manual(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_manual(uuid,text,jsonb) TO service_role;

CREATE FUNCTION public.axtn_case_processing(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE principal jsonb:=p_payload->'_principal'; payload jsonb:=p_payload-'_principal';
  dataset uuid; current_case jsonb; result jsonb; row_id bigint; patch jsonb:=payload->'patch';
  revision bigint; prior jsonb; request_hash text; stamp timestamptz:=clock_timestamp();
  selected jsonb; total bigint; states jsonb; durations jsonb; page_offset integer; page_limit integer;
BEGIN
  PERFORM assert_axtn_case_principal(p_user_id,principal);
  IF COALESCE(p_operation,'') NOT IN ('processing','subtree')
    OR jsonb_typeof(payload) IS DISTINCT FROM 'object'
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(payload) k WHERE NOT k=ANY(
      CASE p_operation WHEN 'subtree' THEN ARRAY['caseId','offset','limit']
        ELSE ARRAY['caseId','transitionKey','expectedVersion','patch','reasonCode','occurredAt'] END))
  THEN RAISE EXCEPTION 'CASE_PROCESSING_PAYLOAD_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text,0));
  stamp:=clock_timestamp();
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=p_user_id AND name='axtn_cases';
  IF dataset IS NULL THEN RAISE EXCEPTION 'CASE_PROCESSING_DATASET_REQUIRED'; END IF;
  IF p_operation='subtree' THEN
    IF jsonb_typeof(payload->'offset') IS DISTINCT FROM 'number'
      OR COALESCE(payload->>'offset','') !~ '^[0-9]{1,9}$'
      OR jsonb_typeof(payload->'limit') IS DISTINCT FROM 'number'
      OR COALESCE(payload->>'limit','') !~ '^[0-9]{1,3}$'
      OR (payload->>'limit')::integer NOT BETWEEN 1 AND 200
    THEN RAISE EXCEPTION 'CASE_VIEW_PAGING_REQUIRED'; END IF;
    page_offset:=(payload->>'offset')::integer; page_limit:=(payload->>'limit')::integer;
    IF payload ? 'caseId' AND NOT EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
      AND row->>'case_id'=payload->>'caseId')
    THEN RAISE EXCEPTION 'CASE_VIEW_AUTHORIZED_ROOT_REQUIRED'; END IF;
    WITH RECURSIVE scoped AS (
      SELECT row,ARRAY[row->>'case_id'] path FROM user_data_rows WHERE table_id=dataset
        AND (NOT payload ? 'caseId' OR row->>'case_id'=payload->>'caseId')
      UNION ALL
      SELECT r.row,s.path||(r.row->>'case_id') FROM scoped s JOIN user_data_rows r
        ON r.table_id=dataset AND r.row->>'parent_case_id'=s.row->>'case_id'
        WHERE payload ? 'caseId' AND NOT r.row->>'case_id'=ANY(s.path)
    ) SELECT COALESCE(jsonb_agg(row ORDER BY row->>'case_id'),'[]'),count(*) INTO selected,total FROM scoped;
    SELECT COALESCE(jsonb_object_agg(stage,cnt),'{}') INTO states FROM (
      SELECT CASE WHEN r->>'status'='CLOSED' THEN 'DONE'
        ELSE COALESCE(r->>'processing_stage','UNKNOWN') END stage,count(*) cnt
      FROM jsonb_array_elements(selected) r GROUP BY 1) grouped;
    SELECT COALESCE(jsonb_object_agg(stage,hours),'{}') INTO durations FROM (
      SELECT stage,sum(greatest(0,extract(epoch FROM COALESCE(next_at,stamp)-created_at))/3600) hours
      FROM (
        SELECT CASE WHEN action='axtn_case_processing.PROCESSING_CHANGED'
            THEN COALESCE(detail->>'toStage','UNKNOWN')
            WHEN detail->>'toStatus'='CLOSED' THEN 'DONE'
            ELSE COALESCE(detail->>'processingStage','UNKNOWN') END stage,created_at,
          lead(created_at) OVER(PARTITION BY resource_id ORDER BY created_at,id) next_at
        FROM audit_events WHERE user_id=p_user_id
          AND action IN ('axtn_case_processing.PROCESSING_CHANGED',
            'axtn_case_processing.MANUAL_CREATE','axtn_case_processing.MANUAL_UPDATE')
          AND resource_id::text IN (SELECT value->>'case_id' FROM jsonb_array_elements(selected))
      ) intervals GROUP BY stage
    ) grouped;
    RETURN jsonb_build_object('scope','OWNED_LOCAL_CASES','root',payload->'caseId','total',total,
      'rootCase',(SELECT row FROM user_data_rows WHERE table_id=dataset
        AND row->>'case_id'=payload->>'caseId'),
      'offset',page_offset,'limit',page_limit,'complete',page_offset=0 AND total<=page_limit,
      'cases',(SELECT COALESCE(jsonb_agg(row ORDER BY row->>'case_id'),'[]')
        FROM (SELECT value row FROM jsonb_array_elements(selected) ORDER BY value->>'case_id'
          OFFSET page_offset LIMIT page_limit) paged),
      'viewRoots',(SELECT COALESCE(jsonb_agg(r.row->>'case_id' ORDER BY r.row->>'case_id'),'[]')
        FROM jsonb_array_elements(selected) r(row) WHERE r.row->>'parent_case_id' IS NULL
          OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(selected) p(row)
            WHERE p.row->>'case_id'=r.row->>'parent_case_id')),
      'processingCounts',states,'consumptionHours',NULL,'remainingForecastHours',NULL,
      'processingDurationHours',durations,'durationCoverage','RECORDED_NATIVE_PROCESSING_EVENTS_ONLY',
      'forecastStatus','UNKNOWN','stateDurationIsConsumption',false,'asOf',stamp);
  END IF;
  IF (SELECT count(*) FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=payload->>'caseId')>1
  THEN RAISE EXCEPTION 'CASE_PROCESSING_AMBIGUOUS_CASE'; END IF;
  SELECT id,row INTO row_id,current_case FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=payload->>'caseId' FOR UPDATE;
  IF current_case IS NULL THEN RAISE EXCEPTION 'CASE_PROCESSING_OWNED_CASE_REQUIRED'; END IF;
  IF jsonb_typeof(patch) IS DISTINCT FROM 'object' OR patch='{}'
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(patch) k WHERE k NOT IN (
      'processing_stage','waiting_reason','required_capability_ref','primary_pattern_ref','capability_provider_ref'))
    OR jsonb_typeof(payload->'expectedVersion') IS DISTINCT FROM 'number'
    OR COALESCE(payload->>'expectedVersion','') !~ '^[0-9]{1,16}$'
    OR (payload->>'expectedVersion')::numeric>9007199254740991
    OR jsonb_typeof(payload->'transitionKey') IS DISTINCT FROM 'string'
    OR length(payload->>'transitionKey') NOT BETWEEN 1 AND 200
    OR COALESCE(payload->>'reasonCode','') !~ '^[A-Z][A-Z0-9_]{0,79}$'
    OR patch ? 'processing_stage' AND COALESCE(patch->>'processing_stage','') NOT IN (
      'ACTIVE','WAITING_INTERNAL_DEPENDENCY','WAITING_CUSTOMER','WAITING_EXTERNAL_CAPABILITY',
      'WAITING_APPROVAL','VALIDATION_REVIEW')
    OR patch->>'waiting_reason' IS NOT NULL AND patch->>'waiting_reason' NOT IN (
      'DEPENDENCY','CUSTOMER_RESPONSE','CAPABILITY_UNAVAILABLE','APPROVAL','REVIEW','UNKNOWN')
    OR EXISTS(SELECT 1 FROM jsonb_each(patch) field WHERE field.key LIKE '%_ref'
      AND field.value<>'null'::jsonb AND (
        jsonb_typeof(field.value) IS DISTINCT FROM 'object'
        OR COALESCE(field.value->>'kind','') NOT IN ('repository','issue','pull_request','run','evidence','contract')
        OR COALESCE(field.value->>'repository','') !~ '^aXtn/[A-Za-z0-9._-]+$'
        OR jsonb_typeof(field.value->'id') IS DISTINCT FROM 'string'
        OR length(COALESCE(field.value->>'id','')) NOT BETWEEN 1 AND 500
        OR '..'=ANY(string_to_array(field.value->>'id','/'))
        OR CASE WHEN field.value->>'kind' IN ('issue','pull_request')
            THEN field.value->>'id' !~ '^[1-9][0-9]*$'
          WHEN field.value->>'kind'='run'
            THEN field.value->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          ELSE field.value->>'id' !~ '^[A-Za-z0-9_./-]+$'
            OR field.value->>'id' LIKE '/%' END
        OR field.value ? 'revision' AND COALESCE(field.value->>'revision','') !~ '^[a-f0-9]{40,64}$'
        OR EXISTS(SELECT 1 FROM jsonb_object_keys(field.value) k
          WHERE k NOT IN ('kind','repository','id','revision'))))
    OR payload ? 'occurredAt' AND (
      jsonb_typeof(payload->'occurredAt') IS DISTINCT FROM 'string'
      OR COALESCE(payload->>'occurredAt','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$'
      OR (payload->>'occurredAt')::timestamptz>stamp)
  THEN RAISE EXCEPTION 'CASE_PROCESSING_PATCH_REQUIRED'; END IF;
  IF current_case->>'processing_mode'='HUMAN' AND principal->>'kind'<>'user_session'
  THEN RAISE EXCEPTION 'CASE_PROCESSING_HUMAN_TAKEOVER_FENCED'; END IF;
  revision:=COALESCE((current_case->>'processing_version')::bigint,0);
  request_hash:=encode(extensions.digest((payload||jsonb_build_object('principal',principal))::text,'sha256'),'hex');
  SELECT detail INTO prior FROM audit_events WHERE user_id=p_user_id
    AND action='axtn_case_processing.PROCESSING_CHANGED'
    AND detail->>'transitionKey'=payload->>'transitionKey';
  IF prior IS NOT NULL THEN
    IF prior->>'requestHash' IS DISTINCT FROM request_hash
    THEN RAISE EXCEPTION 'CASE_PROCESSING_REPLAY_CONFLICT'; END IF;
    IF revision IS DISTINCT FROM (prior->>'resultVersion')::bigint
    THEN RAISE EXCEPTION 'CASE_PROCESSING_STALE_REPLAY'; END IF;
    RETURN current_case;
  END IF;
  IF revision IS DISTINCT FROM (payload->>'expectedVersion')::bigint
  THEN RAISE EXCEPTION 'CASE_PROCESSING_VERSION_CONFLICT'; END IF;
  result:=current_case||patch||jsonb_build_object('processing_version',revision+1,'updated_at',stamp);
  IF result->>'processing_stage'='ACTIVE' THEN result:=result||'{"waiting_reason":null}'::jsonb;
  ELSIF result->>'processing_stage' LIKE 'WAITING_%' AND result->>'waiting_reason' IS NULL
    THEN result:=result||'{"waiting_reason":"UNKNOWN"}'::jsonb;
  END IF;
  UPDATE user_data_rows SET row=result WHERE id=row_id;
  UPDATE user_data_tables t SET columns=t.columns||(
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name',k,'type','string')),'[]')
    FROM unnest(ARRAY['processing_stage','processing_version','waiting_reason','required_capability_ref',
      'primary_pattern_ref','capability_provider_ref']) k WHERE NOT EXISTS(
        SELECT 1 FROM jsonb_array_elements(t.columns) c WHERE c->>'name'=k)) WHERE t.id=dataset;
  INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
    VALUES(p_user_id,'axtn_case_processing.PROCESSING_CHANGED','axtn_case',
      (current_case->>'case_id')::uuid,stamp,jsonb_build_object('transitionKey',payload->>'transitionKey',
        'requestHash',request_hash,'principal',principal,'fromVersion',revision,'resultVersion',revision+1,
        'fromStage',current_case->'processing_stage','toStage',
          CASE WHEN current_case->>'status'='CLOSED' THEN to_jsonb('DONE'::text)
            ELSE result->'processing_stage' END,
        'waitingReason',result->'waiting_reason','reasonCode',payload->'reasonCode',
        'capability',result->'required_capability_ref','provider',result->'capability_provider_ref',
        'occurredAt',COALESCE((payload->>'occurredAt')::timestamptz,stamp),'recordedAt',stamp));
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_processing(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_processing(uuid,text,jsonb) TO service_role;

ALTER FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb)
  RENAME TO axtn_local_table_upsert_before_processing;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert_before_processing(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_local_table_upsert(
  _user_id uuid,_table_name text,_key_column text,_key_value text,_row jsonb
) RETURNS TABLE(table_id uuid,row_id bigint,outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE fields text[]:=ARRAY['case_version','processing_version','processing_stage','waiting_reason',
  'required_capability_ref','primary_pattern_ref','capability_provider_ref'];
BEGIN
  IF _table_name='axtn_cases' AND (_row ?| fields
    OR EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
    WHERE t.user_id=_user_id AND t.name=_table_name AND r.row->>_key_column=_key_value
      AND r.row ?| fields)
    OR COALESCE(_row->>'source_kind','') NOT IN (
      'development_work','document_work') AND NOT EXISTS(
        SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
          WHERE t.user_id=_user_id AND t.name=_table_name AND r.row->>_key_column=_key_value
            AND r.row->>'source_kind' IN ('development_work','document_work')))
  THEN RAISE EXCEPTION 'CASE_PROCESSING_NATIVE_CONTRACT_REQUIRED'; END IF;
  RETURN QUERY SELECT * FROM axtn_local_table_upsert_before_processing(
    _user_id,_table_name,_key_column,_key_value,_row);
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb) TO service_role;
