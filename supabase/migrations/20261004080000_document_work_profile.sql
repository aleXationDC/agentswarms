-- Document work is a registered profile in the existing Case datasets and audit.
CREATE UNIQUE INDEX axtn_document_work_identity ON public.user_data_rows
  (table_id, (row->>'source_id')) WHERE row->>'source_kind'='document_work';

CREATE FUNCTION public.guard_axtn_document_storage() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE protected boolean := false;
BEGIN
  IF TG_TABLE_NAME='user_data_rows' THEN
    IF TG_OP<>'INSERT' THEN
      protected := OLD.row->>'source_kind'='document_work'
        OR OLD.row ? 'document_work_identity' OR OLD.row ? 'document_decision'
        OR OLD.row->>'case_type' LIKE 'DOCUMENT_%'
        OR EXISTS(SELECT 1 FROM user_data_tables WHERE id=OLD.table_id
          AND name='axtn_document_decisions');
    END IF;
    IF TG_OP<>'DELETE' THEN
      protected := COALESCE(protected,false) OR NEW.row->>'source_kind'='document_work'
        OR NEW.row ? 'document_work_identity' OR NEW.row ? 'document_decision'
        OR NEW.row->>'case_type' LIKE 'DOCUMENT_%'
        OR EXISTS(SELECT 1 FROM user_data_tables WHERE id=NEW.table_id
          AND name='axtn_document_decisions');
    END IF;
    IF TG_OP<>'INSERT' THEN
      protected := COALESCE(protected,false) OR EXISTS(
        SELECT 1 FROM user_data_tables relations JOIN user_data_tables cases
          ON cases.user_id=relations.user_id AND cases.name='axtn_cases'
        JOIN user_data_rows work ON work.table_id=cases.id
          AND work.row->>'source_kind'='document_work'
        WHERE relations.id=OLD.table_id AND relations.name='axtn_case_relations'
          AND OLD.row->>'target_kind'='document'
          AND OLD.row->>'relation_type'='related_document'
          AND work.row->>'document_id'=OLD.row->>'target_id');
    END IF;
    IF TG_OP<>'DELETE' THEN
      protected := COALESCE(protected,false) OR EXISTS(
        SELECT 1 FROM user_data_tables relations JOIN user_data_tables cases
          ON cases.user_id=relations.user_id AND cases.name='axtn_cases'
        JOIN user_data_rows work ON work.table_id=cases.id
          AND work.row->>'source_kind'='document_work'
        WHERE relations.id=NEW.table_id AND relations.name='axtn_case_relations'
          AND NEW.row->>'target_kind'='document'
          AND NEW.row->>'relation_type'='related_document'
          AND work.row->>'document_id'=NEW.row->>'target_id');
    END IF;
    IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND OLD.row->>'case_id' IS DISTINCT FROM NEW.row->>'case_id') THEN
      protected := COALESCE(protected,false) OR EXISTS(
        SELECT 1 FROM user_data_rows r WHERE r.table_id=OLD.table_id
          AND r.row->>'source_kind'='document_work'
          AND r.row->>'parent_case_id'=OLD.row->>'case_id');
    END IF;
  ELSIF TG_TABLE_NAME='user_data_tables' THEN
    IF TG_OP='INSERT' THEN
      protected := NEW.name='axtn_document_decisions';
    ELSE
    protected := OLD.name='axtn_document_decisions' OR EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=OLD.id
      AND (row->>'source_kind'='document_work' OR row ? 'document_work_identity'
        OR row ? 'document_decision'));
    protected := COALESCE(protected,false) OR (
      OLD.name='axtn_case_relations' AND EXISTS(
        SELECT 1 FROM user_data_rows relation JOIN user_data_tables cases
          ON cases.user_id=OLD.user_id AND cases.name='axtn_cases'
        JOIN user_data_rows work ON work.table_id=cases.id
          AND work.row->>'source_kind'='document_work'
        WHERE relation.table_id=OLD.id AND relation.row->>'target_kind'='document'
          AND relation.row->>'relation_type'='related_document'
          AND work.row->>'document_id'=relation.row->>'target_id'));
    IF TG_OP='UPDATE' AND NEW.name='axtn_document_decisions' THEN protected := true; END IF;
    IF TG_OP='UPDATE' AND NEW.id=OLD.id AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
      AND NEW.name=OLD.name AND NEW.columns IS NOT DISTINCT FROM OLD.columns
      AND NEW.is_sample IS NOT DISTINCT FROM OLD.is_sample
    THEN protected := false; END IF;
    END IF;
  END IF;
  IF COALESCE(protected,false) AND current_user<>'postgres'
  THEN RAISE EXCEPTION 'DOCUMENT_NATIVE_CASE_CONTRACT_REQUIRED'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_axtn_document_storage() FROM PUBLIC;
CREATE TRIGGER guard_axtn_document_rows BEFORE INSERT OR UPDATE OR DELETE
  ON public.user_data_rows FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_document_storage();
CREATE TRIGGER guard_axtn_document_datasets BEFORE INSERT OR UPDATE OR DELETE
  ON public.user_data_tables FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_document_storage();

ALTER FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb)
  RENAME TO axtn_local_table_upsert_development_guarded;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert_development_guarded(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.axtn_local_table_upsert(
  _user_id uuid,_table_name text,_key_column text,_key_value text,_row jsonb
) RETURNS TABLE(table_id uuid,row_id bigint,outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF _table_name='axtn_document_decisions'
    OR _row->>'source_kind'='document_work' OR _row ? 'document_work_identity'
    OR _row ? 'document_decision'
    OR _row->>'case_type' LIKE 'DOCUMENT_%'
    OR EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=_user_id AND t.name=_table_name AND r.row->>_key_column=_key_value
        AND (r.row->>'source_kind'='document_work' OR r.row ? 'document_work_identity'
          OR r.row ? 'document_decision'))
    OR EXISTS(SELECT 1 FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=_user_id AND t.name=_table_name AND r.row->>_key_column=_key_value
        AND r.row->>'case_id' IS DISTINCT FROM _row->>'case_id'
        AND EXISTS(SELECT 1 FROM user_data_rows child WHERE child.table_id=r.table_id
          AND child.row->>'parent_case_id'=r.row->>'case_id'
          AND child.row->>'source_kind'='document_work'))
    OR (_table_name='axtn_case_relations' AND EXISTS(
      SELECT 1 FROM user_data_rows work JOIN user_data_tables cases ON cases.id=work.table_id
      WHERE cases.user_id=_user_id AND cases.name='axtn_cases'
        AND work.row->>'source_kind'='document_work' AND (
          (_row->>'target_kind'='document' AND _row->>'relation_type'='related_document'
            AND _row->>'target_id'=work.row->>'document_id')
          OR EXISTS(SELECT 1 FROM user_data_rows relation JOIN user_data_tables t
            ON t.id=relation.table_id WHERE t.user_id=_user_id AND t.name=_table_name
              AND relation.row->>_key_column=_key_value
              AND relation.row->>'target_kind'='document'
              AND relation.row->>'relation_type'='related_document'
              AND relation.row->>'target_id'=work.row->>'document_id'))))
  THEN RAISE EXCEPTION 'DOCUMENT_NATIVE_CASE_CONTRACT_REQUIRED'; END IF;
  RETURN QUERY SELECT * FROM axtn_local_table_upsert_development_guarded(
    _user_id,_table_name,_key_column,_key_value,_row);
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_local_table_upsert(uuid,text,text,text,jsonb) TO service_role;

CREATE FUNCTION public.axtn_case_document(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  dataset uuid;
  relations_dataset uuid;
  row_id bigint;
  current_case jsonb;
  next_case jsonb;
  parent_case jsonb;
  document_id text;
  primary_case text;
  primary_parent text;
  source_identity_count integer;
  primary_relation jsonb;
  identity jsonb;
  manifest jsonb;
  prior jsonb;
  prior_attempt text;
  principal jsonb := p_payload->'_principal';
  key text;
  delivery_key text;
  delivery_case text;
  event_type text;
  case_id uuid;
  stamp timestamptz := clock_timestamp();
  decisions_dataset uuid;
  stored_decision jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id)
    OR COALESCE(principal->>'kind','') NOT IN ('user_session','swarm','swarm_api_key')
    OR principal->>'id' IS NULL
  THEN RAISE EXCEPTION 'DOCUMENT_AUTHENTICATED_OWNER_REQUIRED'; END IF;
  IF principal->>'kind' IN ('user_session','swarm')
    AND principal->>'id' IS DISTINCT FROM p_user_id::text
  THEN RAISE EXCEPTION 'DOCUMENT_PRINCIPAL_OWNER_DENIED'; END IF;
  IF principal->>'kind'='swarm_api_key' AND NOT EXISTS(
    SELECT 1 FROM swarm_api_keys WHERE id=(principal->>'id')::uuid
      AND user_id=p_user_id AND is_active AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at>now()) AND 'cases'=ANY(scopes))
  THEN RAISE EXCEPTION 'DOCUMENT_CASE_KEY_DENIED'; END IF;
  IF principal->>'kind'<>'user_session' AND (
    p_payload->>'processingMode'='HUMAN' OR p_payload->>'executionChannel'='HUMAN'
    OR p_payload->>'eventType' IN ('TAKEOVER','RELEASE','DETAILS')
    OR p_operation='document_assign')
  THEN RAISE EXCEPTION 'DOCUMENT_AUTHENTICATED_HUMAN_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text,0));
  PERFORM axtn_case_work(p_user_id,'list',jsonb_build_object('_principal',principal));
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=p_user_id AND name='axtn_cases';
  IF dataset IS NULL THEN RAISE EXCEPTION 'DOCUMENT_CASE_DATASET_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM user_data_tables WHERE id=dataset AND jsonb_typeof(columns)<>'array')
  THEN RAISE EXCEPTION 'DOCUMENT_CASE_METADATA_INVALID'; END IF;
  UPDATE user_data_tables t SET columns=t.columns || (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name',name,'type','string')),'[]'::jsonb)
      FROM unnest(ARRAY['document_work_identity','document_input','document_id','input_hash',
        'attempt_id','processing_mode','execution_channel','scenario_class','actor_ref',
        'actor_principal','references','external_reference_status']) names(name)
      WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(t.columns) c WHERE c->>'name'=names.name))
    WHERE t.id=dataset AND EXISTS(
      SELECT 1 FROM unnest(ARRAY['document_work_identity','document_input','document_id','input_hash',
        'attempt_id','processing_mode','execution_channel','scenario_class','actor_ref',
        'actor_principal','references','external_reference_status']) names(name)
      WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(t.columns) c WHERE c->>'name'=names.name));
  IF p_operation='document_assign' THEN
    SELECT row INTO current_case FROM user_data_rows WHERE table_id=dataset
      AND row->>'case_id'=p_payload->>'caseId' FOR UPDATE;
    IF current_case IS NULL THEN RAISE EXCEPTION 'DOCUMENT_OWNED_CASE_REQUIRED'; END IF;
    document_id := p_payload->>'documentId';
    IF COALESCE(document_id,'')='' OR NOT EXISTS(
      SELECT 1 FROM user_data_rows WHERE table_id=dataset
        AND row->>'source_kind'='document_work' AND row->>'document_id'=document_id)
      OR (current_case->>'source_kind'='document_work'
        AND current_case->>'document_id' IS DISTINCT FROM document_id)
    THEN RAISE EXCEPTION 'DOCUMENT_OWNED_IDENTITY_REQUIRED'; END IF;
    SELECT id INTO relations_dataset FROM user_data_tables
      WHERE user_id=p_user_id AND name='axtn_case_relations';
    IF relations_dataset IS NULL THEN RAISE EXCEPTION 'DOCUMENT_RELATIONS_DATASET_REQUIRED'; END IF;
    IF (SELECT count(*) FROM user_data_rows WHERE table_id=relations_dataset
      AND row->>'target_kind'='document' AND row->>'target_id'=document_id)>1
    THEN RAISE EXCEPTION 'DOCUMENT_PRIMARY_RELATION_AMBIGUOUS'; END IF;
    SELECT row INTO primary_relation FROM user_data_rows WHERE table_id=relations_dataset
      AND row->>'target_kind'='document' AND row->>'target_id'=document_id FOR UPDATE;
    IF primary_relation IS NOT NULL THEN
      IF primary_relation->>'case_id' IS DISTINCT FROM p_payload->>'caseId'
        OR primary_relation->>'relation_type' IS DISTINCT FROM 'related_document'
      THEN RAISE EXCEPTION 'DOCUMENT_PRIMARY_BUSINESS_RELATION_CONFLICT'; END IF;
      RETURN jsonb_build_object('ok',true,'created',false,'relationId',primary_relation->>'relation_id');
    END IF;
    primary_relation := jsonb_build_object('relation_id',gen_random_uuid(),
      'case_id',p_payload->>'caseId','relation_type','related_document',
      'target_id',document_id,'target_kind','document','created_at',stamp);
    INSERT INTO user_data_rows(table_id,row) VALUES(relations_dataset,primary_relation);
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
      VALUES(p_user_id,'axtn_work.DOCUMENT_ASSIGNED','axtn_case_work',
        (p_payload->>'caseId')::uuid,jsonb_build_object(
          'principal',principal,'documentId',document_id,'relationId',primary_relation->>'relation_id'));
    RETURN jsonb_build_object('ok',true,'created',true,'relationId',primary_relation->>'relation_id');
  END IF;
  IF p_operation='document_ensure' THEN
    manifest := p_payload->'inputManifest';
    IF COALESCE(p_payload->>'caseType','') NOT IN ('DOCUMENT_PROCESSING','DOCUMENT_REVIEW',
      'DOCUMENT_FILING','DOCUMENT_CLEANUP','DOCUMENT_IMPROVEMENT_CANDIDATE')
      OR p_payload->>'businessRequestId' IS NULL OR p_payload->>'businessRequestId'=''
      OR manifest->>'sourceRef' IS NULL
      OR COALESCE(manifest->>'sourceKind','') NOT IN ('drive','mail','fixture')
      OR manifest->>'sourceRevision' IS NULL
      OR COALESCE(manifest->>'contentHash','') !~ '^[a-f0-9]{64}$'
      OR COALESCE(p_payload->>'inputHash','') !~ '^[a-f0-9]{64}$'
      OR COALESCE(manifest->>'privacyStatus','') NOT IN ('UNRESOLVED','NO_AI','ELIGIBLE')
      OR COALESCE(p_payload->>'processingMode','') NOT IN ('SEMANTIC','DETERMINISTIC','HUMAN')
      OR COALESCE(p_payload->>'executionChannel','') NOT IN ('COPILOT_CLI','SWARM','HUMAN')
      OR COALESCE(p_payload->>'deliveryId','')=''
    THEN RAISE EXCEPTION 'DOCUMENT_REGISTERED_INPUT_REQUIRED'; END IF;
    IF p_payload->>'processingMode'='SEMANTIC'
    THEN RAISE EXCEPTION 'DOCUMENT_PROTECTED_PRIVACY_EVIDENCE_REQUIRED'; END IF;
    IF manifest->>'privacyStatus'='ELIGIBLE'
      AND COALESCE(manifest->>'privacyRevision','') !~ '^[a-f0-9]{64}$'
    THEN RAISE EXCEPTION 'DOCUMENT_PRIVACY_EVIDENCE_REQUIRED'; END IF;
    IF manifest->>'sourceKind'='fixture' AND p_payload->>'scenarioClass'='real_work'
    THEN RAISE EXCEPTION 'DOCUMENT_FIXTURE_NOT_REAL_SOURCE'; END IF;
    SELECT r.row->>'document_id' INTO document_id FROM user_data_rows r
      JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=p_user_id AND t.name='axtn_document_registry'
        AND r.row->>'source_ref'=manifest->>'sourceRef';
    IF manifest->>'documentId' IS NOT NULL AND document_id IS NOT NULL
      AND document_id IS DISTINCT FROM manifest->>'documentId'
    THEN RAISE EXCEPTION 'DOCUMENT_REGISTERED_IDENTITY_CONFLICT'; END IF;
    document_id := COALESCE(document_id,manifest->>'documentId');
    IF document_id IS NULL THEN
      SELECT min(row->>'document_id'),count(DISTINCT row->>'document_id')
        INTO document_id,source_identity_count FROM user_data_rows WHERE table_id=dataset
          AND row->>'source_kind'='document_work'
          AND row->'document_input'->>'sourceKind'=manifest->>'sourceKind'
          AND row->'document_input'->>'sourceRef'=manifest->>'sourceRef';
      IF source_identity_count>1 THEN RAISE EXCEPTION 'DOCUMENT_SOURCE_IDENTITY_AMBIGUOUS'; END IF;
    END IF;
    SELECT id INTO relations_dataset FROM user_data_tables
      WHERE user_id=p_user_id AND name='axtn_case_relations';
    SELECT row INTO primary_relation FROM user_data_rows WHERE table_id=relations_dataset
      AND row->>'relation_type'='related_document' AND row->>'target_kind'='document'
      AND row->>'target_id'=document_id;
    primary_case := primary_relation->>'case_id';
    IF primary_case IS NOT NULL AND p_payload->>'parentCaseId' IS NOT NULL
      AND primary_case IS DISTINCT FROM p_payload->>'parentCaseId'
      AND p_payload->>'caseType'='DOCUMENT_PROCESSING'
    THEN RAISE EXCEPTION 'DOCUMENT_PRIMARY_BUSINESS_RELATION_CONFLICT'; END IF;
    IF primary_case IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM user_data_rows WHERE table_id=dataset AND row->>'case_id'=primary_case)
    THEN RAISE EXCEPTION 'DOCUMENT_PRIMARY_CASE_MISSING'; END IF;
    SELECT row->>'case_id' INTO primary_parent FROM user_data_rows WHERE table_id=dataset
      AND row->>'case_id'=primary_case
      AND COALESCE(row->>'source_kind','') NOT IN ('document_work','development_work');
    IF p_payload->>'parentCaseId' IS NOT NULL THEN
      SELECT row INTO parent_case FROM user_data_rows WHERE table_id=dataset
        AND row->>'case_id'=p_payload->>'parentCaseId';
      IF parent_case IS NULL THEN RAISE EXCEPTION 'DOCUMENT_OWNED_PARENT_REQUIRED'; END IF;
      IF parent_case->>'source_kind'='development_work'
      THEN RAISE EXCEPTION 'DOCUMENT_DEVELOPMENT_LINEAGE_SEPARATE'; END IF;
      IF parent_case->>'source_kind'<>'document_work' AND principal->>'kind'<>'user_session'
      THEN RAISE EXCEPTION 'DOCUMENT_BUSINESS_PARENT_CONFIRMATION_REQUIRED'; END IF;
    END IF;
    IF p_payload->>'caseType'<>'DOCUMENT_PROCESSING' THEN
      IF parent_case IS NULL OR parent_case->>'source_kind' IS DISTINCT FROM 'document_work'
        OR COALESCE(p_payload->>'packageKey','') !~ '^[a-z0-9][a-z0-9._-]{0,99}$'
      THEN RAISE EXCEPTION 'DOCUMENT_ACCOUNTABLE_CHILD_REQUIRED'; END IF;
      key := 'child:'||(parent_case->>'case_id')||':'||(p_payload->>'packageKey');
    ELSE
      key := 'request:'||(manifest->>'sourceKind')||':'||(p_payload->>'businessRequestId');
    END IF;
    delivery_key := encode(extensions.digest(jsonb_build_array(
      manifest->>'sourceKind',manifest->>'sourceRef',p_payload->>'deliveryId')::text,'sha256'),'hex');
    SELECT resource_id::text INTO delivery_case FROM audit_events WHERE user_id=p_user_id
      AND resource_type='axtn_case_work' AND detail->>'deliveryKey'=delivery_key;
    IF delivery_case IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM user_data_rows WHERE table_id=dataset AND row->>'case_id'=delivery_case
        AND row->>'source_kind'='document_work' AND row->>'source_id'=key)
    THEN RAISE EXCEPTION 'DOCUMENT_DELIVERY_IDENTITY_CONFLICT'; END IF;
    identity := p_payload - ARRAY['_principal','actorRef','processingMode','executionChannel','deliveryId','references'];
    SELECT id,row INTO row_id,current_case FROM user_data_rows WHERE table_id=dataset
      AND row->>'source_kind'='document_work' AND row->>'source_id'=key FOR UPDATE;
    IF current_case IS NOT NULL THEN
      IF current_case->'document_work_identity' IS DISTINCT FROM identity
      THEN RAISE EXCEPTION 'DOCUMENT_REQUEST_IDENTITY_CONFLICT'; END IF;
      IF delivery_case IS NULL THEN
        INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
          VALUES(p_user_id,'axtn_work.DELIVERY_RECEIVED','axtn_case_work',
            (current_case->>'case_id')::uuid,jsonb_build_object(
              'deliveryKey',delivery_key,'principal',principal,'inputHash',p_payload->>'inputHash'));
      END IF;
      RETURN current_case;
    END IF;
    case_id := gen_random_uuid();
    document_id := COALESCE(document_id,encode(extensions.gen_random_bytes(12),'hex'));
    next_case := jsonb_build_object('case_id',case_id,
      'parent_case_id',COALESCE(p_payload->>'parentCaseId',primary_parent),'subject','Document processing',
      'case_type',p_payload->>'caseType','source_kind','document_work','source_id',key,
      'status','NEW','status_reason',
        CASE WHEN manifest->>'privacyStatus'='ELIGIBLE' THEN 'SOURCE_AUTHORIZATION_PENDING'
          ELSE 'PRIVACY_HOLD' END,
      'priority',3,'created_at',stamp,'updated_at',stamp,'closed_at',NULL,
      'document_work_identity',identity,'document_input',manifest,'document_id',document_id,
      'external_reference_status',CASE WHEN p_payload ? 'externalReferenceContext'
        THEN 'NEEDS_CLARIFICATION' ELSE NULL END,
      'input_hash',p_payload->>'inputHash','attempt_id',gen_random_uuid(),
      'processing_mode',p_payload->>'processingMode','execution_channel',p_payload->>'executionChannel',
      'scenario_class',p_payload->>'scenarioClass','actor_ref',principal->>'id',
      'actor_principal',principal,'references',COALESCE(p_payload->'references','[]'::jsonb));
    INSERT INTO user_data_rows(table_id,row) VALUES(dataset,next_case);
    IF primary_case IS NULL AND p_payload->>'caseType'='DOCUMENT_PROCESSING' THEN
      IF relations_dataset IS NULL THEN
        INSERT INTO user_data_tables(user_id,name,source_filename,columns,is_sample)
          VALUES(p_user_id,'axtn_case_relations','aXtn SupaCase Management',
            (SELECT jsonb_agg(jsonb_build_object('name',name,'type','string'))
              FROM unnest(ARRAY['relation_id','case_id','relation_type','target_id','target_kind','created_at'])
                names(name)),false)
          RETURNING id INTO relations_dataset;
      END IF;
      INSERT INTO user_data_rows(table_id,row) VALUES(relations_dataset,
        jsonb_build_object('relation_id',gen_random_uuid(),'case_id',case_id,
          'relation_type','related_document','target_id',document_id,
          'target_kind','document','created_at',stamp));
    END IF;
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
      VALUES(p_user_id,'axtn_work.CREATED','axtn_case_work',case_id,
        jsonb_build_object('transitionKey','document-ensure:'||key,'principal',principal,
          'inputHash',p_payload->>'inputHash','processingMode',p_payload->>'processingMode',
          'executionChannel',p_payload->>'executionChannel','actorRef',principal->>'id'));
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
      VALUES(p_user_id,'axtn_work.DELIVERY_RECEIVED','axtn_case_work',case_id,
        jsonb_build_object('deliveryKey',delivery_key,'principal',principal,'inputHash',p_payload->>'inputHash'));
    RETURN next_case;
  END IF;
  IF p_operation NOT IN ('document_transition','document_propose','document_proposals')
  THEN RAISE EXCEPTION 'DOCUMENT_OPERATION_NOT_REGISTERED'; END IF;
  SELECT id,row INTO row_id,current_case FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=p_payload->>'caseId' AND row->>'source_kind'='document_work' FOR UPDATE;
  IF current_case IS NULL THEN RAISE EXCEPTION 'DOCUMENT_OWNED_CASE_REQUIRED'; END IF;
  IF p_operation='document_proposals' THEN
    RETURN (SELECT COALESCE(jsonb_agg(r.row ORDER BY r.id),'[]'::jsonb)
      FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id=p_user_id AND t.name='axtn_document_decisions'
        AND r.row->>'case_id'=current_case->>'case_id');
  END IF;
  IF current_case->>'processing_mode'='HUMAN' AND principal->>'kind'<>'user_session'
  THEN RAISE EXCEPTION 'DOCUMENT_HUMAN_TAKEOVER_FENCED'; END IF;
  IF p_operation='document_propose' THEN
    IF current_case->>'status' IS DISTINCT FROM 'OPEN'
      OR current_case->>'input_hash' IS DISTINCT FROM p_payload->>'inputHash'
      OR current_case->>'attempt_id' IS DISTINCT FROM p_payload->>'attemptId'
      OR current_case->>'document_id' IS DISTINCT FROM p_payload->>'documentId'
      OR current_case->'document_input'->>'sourceRef' IS DISTINCT FROM p_payload->>'sourceRef'
      OR current_case->'document_input'->>'sourceRevision' IS DISTINCT FROM p_payload->>'sourceRevision'
    THEN RAISE EXCEPTION 'DOCUMENT_CURRENT_PROPOSAL_BINDING_REQUIRED'; END IF;
    IF current_case->'actor_principal' IS DISTINCT FROM principal
    THEN RAISE EXCEPTION 'DOCUMENT_CURRENT_WORKER_REQUIRED'; END IF;
    IF COALESCE(p_payload->>'schemaVersion','')<>'document-decision-v1'
      OR COALESCE(p_payload->>'featureSchemaRevision','')<>'document-features-v1'
      OR COALESCE(p_payload->>'decisionRevision','') !~ '^[a-f0-9]{64}$'
      OR COALESCE(p_payload->>'decisionId','') !~ '^[a-f0-9-]{36}$'
      OR COALESCE(p_payload->>'automationMode','') NOT IN ('OBSERVE','SHADOW','ASSISTED')
      OR COALESCE(p_payload->>'operation','') NOT IN ('CLASSIFY','FILE','DELETE')
      OR (p_payload->>'operation'<>'CLASSIFY' AND (
        COALESCE(p_payload->'target'->>'id','')='' OR COALESCE(p_payload->'target'->>'name','')=''))
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_payload->'evidence','[]')) ref
        WHERE ref->>'kind'='evidence')
    THEN RAISE EXCEPTION 'DOCUMENT_REGISTERED_PROPOSAL_REQUIRED'; END IF;
    IF current_case->>'processing_mode'<>'HUMAN'
      AND COALESCE(current_case->>'privacy_evidence_revision','') !~ '^[a-f0-9]{64}$'
    THEN RAISE EXCEPTION 'DOCUMENT_PROTECTED_PRIVACY_EVIDENCE_REQUIRED'; END IF;
    SELECT id INTO decisions_dataset FROM user_data_tables
      WHERE user_id=p_user_id AND name='axtn_document_decisions';
    IF decisions_dataset IS NULL THEN
      INSERT INTO user_data_tables(user_id,name,source_filename,columns,is_sample)
        VALUES(p_user_id,'axtn_document_decisions','aXtn Document Decision proposals',
          '[{"name":"decision_id","type":"string"},{"name":"case_id","type":"string"},
            {"name":"revision","type":"string"},{"name":"status","type":"string"},
            {"name":"document_decision","type":"json"},{"name":"principal","type":"json"},
            {"name":"created_at","type":"string"}]'::jsonb,false)
        RETURNING id INTO decisions_dataset;
    END IF;
    identity := p_payload - ARRAY['_principal','actorRef','decisionRevision'];
    SELECT row INTO stored_decision FROM user_data_rows WHERE table_id=decisions_dataset
      AND row->>'decision_id'=p_payload->>'decisionId' FOR UPDATE;
    IF stored_decision IS NOT NULL THEN
      IF stored_decision->'document_decision' IS DISTINCT FROM identity
        OR stored_decision->'principal' IS DISTINCT FROM principal
        OR stored_decision->>'revision' IS DISTINCT FROM p_payload->>'decisionRevision'
      THEN RAISE EXCEPTION 'DOCUMENT_DECISION_IMMUTABLE'; END IF;
      RETURN stored_decision;
    END IF;
    stored_decision := jsonb_build_object('decision_id',p_payload->>'decisionId',
      'case_id',current_case->>'case_id','revision',p_payload->>'decisionRevision',
      'status','PROPOSED','document_decision',identity,'principal',principal,'created_at',stamp);
    INSERT INTO user_data_rows(table_id,row) VALUES(decisions_dataset,stored_decision);
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
      VALUES(p_user_id,'axtn_work.DOCUMENT_PROPOSED','axtn_case_work',
        (current_case->>'case_id')::uuid,jsonb_build_object(
          'decisionId',p_payload->>'decisionId','decisionRevision',p_payload->>'decisionRevision',
          'principal',principal,'attemptId',current_case->>'attempt_id',
          'inputHash',current_case->>'input_hash','status','PROPOSED'));
    RETURN stored_decision;
  END IF;
  SELECT detail->'request',detail->>'resultAttempt' INTO prior,prior_attempt
    FROM audit_events WHERE user_id=p_user_id
    AND resource_type='axtn_case_work' AND detail->>'transitionKey'=p_payload->>'transitionKey';
  IF prior IS NOT NULL THEN
    IF prior IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'DOCUMENT_TRANSITION_CONFLICT'; END IF;
    IF current_case->>'attempt_id' IS DISTINCT FROM prior_attempt
    THEN RAISE EXCEPTION 'DOCUMENT_STALE_ATTEMPT_OR_INPUT'; END IF;
    RETURN current_case;
  END IF;
  IF current_case->>'input_hash' IS DISTINCT FROM p_payload->>'inputHash'
    OR current_case->>'attempt_id' IS DISTINCT FROM p_payload->>'attemptId'
  THEN RAISE EXCEPTION 'DOCUMENT_STALE_ATTEMPT_OR_INPUT'; END IF;
  event_type := p_payload->>'eventType';
  IF COALESCE(event_type,'') NOT IN ('STARTED','BLOCKED','TAKEOVER','RELEASE','RESULT','REOPENED','DETAILS')
  THEN RAISE EXCEPTION 'DOCUMENT_RESULT_CANNOT_ASSERT_ACCEPTANCE'; END IF;
  IF current_case->>'status'='CLOSED' AND event_type<>'REOPENED'
  THEN RAISE EXCEPTION 'DOCUMENT_REOPEN_REQUIRED'; END IF;
  next_case := current_case || jsonb_build_object(
    'updated_at',stamp,'status','OPEN','status_reason',p_payload->>'reasonCode','closed_at',NULL);
  IF event_type='DETAILS' THEN
    IF current_case->>'processing_mode'<>'HUMAN'
      OR COALESCE(p_payload->'details'->>'subject','')=''
      OR COALESCE((p_payload->'details'->>'priority')::integer,-1) NOT BETWEEN 0 AND 3
    THEN RAISE EXCEPTION 'DOCUMENT_HUMAN_DETAILS_REQUIRED'; END IF;
    next_case := next_case || jsonb_build_object(
      'subject',p_payload->'details'->>'subject','priority',p_payload->'details'->'priority',
      'due_date',p_payload->'details'->'dueDate','follow_up',p_payload->'details'->'followUp');
  ELSIF event_type IN ('TAKEOVER','RELEASE') THEN
    next_case := next_case || jsonb_build_object('attempt_id',gen_random_uuid(),
      'processing_mode',CASE WHEN event_type='TAKEOVER' THEN 'HUMAN' ELSE 'DETERMINISTIC' END,
      'execution_channel',CASE WHEN event_type='TAKEOVER' THEN 'HUMAN' ELSE 'SWARM' END,
      'actor_principal',principal,'actor_ref',principal->>'id');
  ELSIF event_type='STARTED' THEN
    IF current_case->>'case_type'='DOCUMENT_IMPROVEMENT_CANDIDATE'
    THEN RAISE EXCEPTION 'DOCUMENT_CANDIDATE_REQUIRES_EXPLICIT_PROMOTION'; END IF;
    next_case := next_case || jsonb_build_object('actor_principal',principal,'actor_ref',principal->>'id');
  ELSIF event_type='RESULT' THEN
    IF current_case->'actor_principal' IS DISTINCT FROM principal
    THEN RAISE EXCEPTION 'DOCUMENT_CURRENT_WORKER_REQUIRED'; END IF;
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_payload->'references','[]')) r
      WHERE r->>'kind'='evidence')
    THEN RAISE EXCEPTION 'DOCUMENT_RESULT_EVIDENCE_REQUIRED'; END IF;
  END IF;
  next_case := next_case || jsonb_build_object('references',
    (SELECT COALESCE(jsonb_agg(DISTINCT r),'[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(current_case->'references','[]'::jsonb)
        || COALESCE(p_payload->'references','[]'::jsonb)) r));
  UPDATE user_data_rows SET row=next_case WHERE id=row_id;
  INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
    VALUES(p_user_id,'axtn_work.'||event_type,'axtn_case_work',(current_case->>'case_id')::uuid,
      jsonb_build_object('transitionKey',p_payload->>'transitionKey','request',p_payload,
        'principal',principal,'fromMode',current_case->>'processing_mode',
        'toMode',next_case->>'processing_mode','executionChannel',next_case->>'execution_channel',
        'resultAttempt',next_case->>'attempt_id'));
  RETURN next_case;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_document(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_document(uuid,text,jsonb) TO service_role;
