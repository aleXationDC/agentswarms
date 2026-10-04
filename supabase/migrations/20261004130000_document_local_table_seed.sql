-- Provision the existing native MCP Builder object; never publish or widen keys.
CREATE FUNCTION public.axtn_seed_document_local_table(
  p_user_id uuid,p_slug text,p_source text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  app public.mcp_apps;
  matches integer;
  created boolean := false;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_user_id)
  THEN RAISE EXCEPTION 'DOCUMENT_LOCAL_TABLE_AUTHENTICATED_OWNER_REQUIRED'; END IF;
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9][a-z0-9-]{1,59}$'
    OR p_source IS NULL
    OR encode(extensions.digest(p_source,'sha256'),'hex') <>
      '925c5324f7fd4c1a5e66e9972fd18b0a58212dc350a83722fb6cf98ed21a5c68'
  THEN RAISE EXCEPTION 'DOCUMENT_LOCAL_TABLE_CANONICAL_SOURCE_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text,0));
  SELECT count(*) INTO matches FROM mcp_apps WHERE user_id=p_user_id
    AND name='aXtn Local Table Integration';
  IF matches>1 THEN RAISE EXCEPTION 'DOCUMENT_LOCAL_TABLE_APP_AMBIGUOUS'; END IF;
  SELECT * INTO app FROM mcp_apps WHERE user_id=p_user_id
    AND name='aXtn Local Table Integration' FOR UPDATE;
  IF app.id IS NULL THEN
    INSERT INTO mcp_apps(user_id,name,slug,description,source_code,requirements,
      is_public,allowed_origins,requested_egress_hosts,secret_refs,keep_warm)
      VALUES(p_user_id,'aXtn Local Table Integration',p_slug,
        'Canonical native DMS Registry-only integration; runtime admission remains explicit.',
        p_source,'',false,'{}','{}','{}',false)
      RETURNING * INTO app;
    created := true;
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
      VALUES(p_user_id,'axtn_document.LOCAL_TABLE_DRAFT_SEEDED','mcp_app',app.id,
        jsonb_build_object('sourceRevision',
          '925c5324f7fd4c1a5e66e9972fd18b0a58212dc350a83722fb6cf98ed21a5c68',
          'public',false,'runtimeActivated',false));
  ELSE
    IF app.source_code IS DISTINCT FROM p_source OR app.requirements<>''
      OR app.is_public OR cardinality(app.allowed_origins)>0
      OR cardinality(app.requested_egress_hosts)>0 OR cardinality(app.secret_refs)>0
      OR (app.registered_server_id IS NOT NULL AND NOT EXISTS(
        SELECT 1 FROM mcp_servers WHERE id=app.registered_server_id AND user_id=p_user_id))
    THEN RAISE EXCEPTION 'DOCUMENT_LOCAL_TABLE_EXISTING_CONFIGURATION_CONFLICT'; END IF;
  END IF;
  RETURN jsonb_build_object('schemaVersion','document-local-table-seed-v1',
    'appId',app.id,'slug',app.slug,'created',created,'status',app.status,
    'registeredServerId',app.registered_server_id,'runtimeActivated',false);
END $$;
REVOKE ALL ON FUNCTION public.axtn_seed_document_local_table(uuid,text,text)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_seed_document_local_table(uuid,text,text) TO service_role;
