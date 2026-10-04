-- Explicit configuration seed, never a read-time or business-document seed.
CREATE FUNCTION public.axtn_seed_document_registries(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  definition jsonb;
  dataset uuid;
  metadata jsonb;
  additions jsonb;
  created boolean;
  reconciled boolean;
  results jsonb := '[]'::jsonb;
  starter text;
  existing_count integer;
  seeded integer := 0;
  stamp timestamptz := clock_timestamp();
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id)
  THEN RAISE EXCEPTION 'DOCUMENT_REGISTRY_AUTHENTICATED_OWNER_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text,0));
  FOR definition IN SELECT value FROM jsonb_array_elements('[
    {"name":"axtn_document_registry","columns":[
      "schema_version","record_kind","artifact_type","document_id","source_type","source_ref",
      "intake_case_id","privacy_status","processing_status","message_id","mail_ref",
      "mail_identity_source","provider_type","provider_account_id","provider_message_id",
      "mailbox","uidvalidity","uid","original_filename","current_filename","mime_type",
      "extraction_status","content_hash","hash_algorithm","file_size","drive_file_id",
      "current_parent_folder_id","current_path","drive_url","discovered_at"]},
    {"name":"axtn_document_recognition_patterns","columns":[
      "pattern_id","name","active","source_document_id","source_ref","source_stage",
      "created_by","created_at","updated_at","conditions","match_settings","suggestions"]},
    {"name":"axtn_document_classification_values","columns":[
      "value_id","kind","value","created_by","created_at","updated_at"]}
  ]'::jsonb) LOOP
    created := false;
    reconciled := false;
    -- Existing native owner/name uniqueness arbitrates concurrent creation.
    INSERT INTO user_data_tables(user_id,name,source_filename,columns,is_sample)
      VALUES(p_user_id,definition->>'name','aXtn Document Management','[]'::jsonb,false)
      ON CONFLICT(user_id,name) DO NOTHING RETURNING id INTO dataset;
    created := dataset IS NOT NULL;
    SELECT id,columns INTO dataset,metadata FROM user_data_tables
      WHERE user_id=p_user_id AND name=definition->>'name' FOR UPDATE;
    IF dataset IS NULL OR EXISTS(
      SELECT 1 FROM user_data_tables WHERE id=dataset AND is_sample)
    THEN RAISE EXCEPTION 'DOCUMENT_REGISTRY_NON_SAMPLE_OWNED_DATASET_REQUIRED'; END IF;
    IF jsonb_typeof(metadata) IS DISTINCT FROM 'array'
    THEN RAISE EXCEPTION 'DOCUMENT_REGISTRY_METADATA_INVALID'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(metadata) c
      WHERE jsonb_typeof(c) IS DISTINCT FROM 'object'
        OR jsonb_typeof(c->'name') IS DISTINCT FROM 'string'
        OR btrim(c->>'name')='')
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(metadata) c
        GROUP BY c->>'name' HAVING count(*)>1)
    THEN RAISE EXCEPTION 'DOCUMENT_REGISTRY_METADATA_INVALID'; END IF;
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name',name,'type','string')
      ORDER BY position),'[]'::jsonb) INTO additions
      FROM jsonb_array_elements_text(definition->'columns') WITH ORDINALITY names(name,position)
      WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(metadata) c WHERE c->>'name'=names.name);
    IF additions<>'[]'::jsonb THEN
      UPDATE user_data_tables SET columns=metadata||additions WHERE id=dataset;
      reconciled := true;
    END IF;
    IF definition->>'name'='axtn_document_classification_values' THEN
      FOR starter IN SELECT unnest(ARRAY[
        'Rechnung','Vertrag','Vertragsanpassung','Mahnung','Bescheid','Nachweis']) LOOP
        SELECT count(*) INTO existing_count FROM user_data_rows WHERE table_id=dataset
          AND row->>'kind'='document_type'
          AND lower(btrim(row->>'value'))=lower(starter);
        IF existing_count>1 THEN RAISE EXCEPTION 'DOCUMENT_REGISTRY_TAXONOMY_AMBIGUOUS'; END IF;
        IF existing_count=0 THEN
          INSERT INTO user_data_rows(table_id,row) VALUES(dataset,jsonb_build_object(
            'value_id',gen_random_uuid(),'kind','document_type','value',starter,
            'created_by',p_user_id,'created_at',stamp,'updated_at',stamp));
          seeded := seeded+1;
        END IF;
      END LOOP;
    END IF;
    results := results||jsonb_build_array(jsonb_build_object(
      'name',definition->>'name','id',dataset,'created',created,'reconciled',reconciled));
    IF created OR reconciled THEN
      INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
        VALUES(p_user_id,'axtn_document.REGISTRY_RECONCILED','user_data_table',dataset,
          jsonb_build_object('created',created,'addedColumns',jsonb_array_length(additions),
            'seedRevision','document-registry-seed-v1'));
    END IF;
  END LOOP;
  IF seeded>0 THEN
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
      VALUES(p_user_id,'axtn_document.TAXONOMY_SEEDED','user_data_table',dataset,
        jsonb_build_object('inserted',seeded,'seedRevision','document-registry-seed-v1'));
  END IF;
  RETURN jsonb_build_object('schemaVersion','document-registry-seed-v1',
    'datasets',results,'classificationValuesInserted',seeded);
END $$;
REVOKE ALL ON FUNCTION public.axtn_seed_document_registries(uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_seed_document_registries(uuid) TO service_role;
