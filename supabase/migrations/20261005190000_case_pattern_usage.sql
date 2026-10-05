-- Per-Case usage of exact existing Git/skill artifacts, not another pattern registry.
CREATE FUNCTION public.axtn_case_canonical_reference(value jsonb,exact_revision boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$
  SELECT CASE WHEN jsonb_typeof(value) IS DISTINCT FROM 'object' THEN false ELSE COALESCE(
    value->>'kind' IN ('repository','issue','pull_request','run','evidence','contract')
    AND value->>'repository' ~ '^aXtn/[A-Za-z0-9._-]+$'
    AND jsonb_typeof(value->'id')='string' AND length(value->>'id') BETWEEN 1 AND 500
    AND NOT '..'=ANY(string_to_array(value->>'id','/'))
    AND CASE WHEN value->>'kind' IN ('issue','pull_request') THEN value->>'id' ~ '^[1-9][0-9]*$'
      WHEN value->>'kind'='run' THEN value->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      ELSE value->>'id' ~ '^[A-Za-z0-9_./-]+$' AND value->>'id' NOT LIKE '/%' END
    AND (NOT exact_revision AND NOT value ? 'revision'
      OR jsonb_typeof(value->'revision')='string' AND value->>'revision' ~ '^[a-f0-9]{40}([a-f0-9]{24})?$')
    AND NOT EXISTS(SELECT 1 FROM jsonb_object_keys(value) k
      WHERE k NOT IN ('kind','repository','id','revision')),false) END
$$;
REVOKE ALL ON FUNCTION public.axtn_case_canonical_reference(jsonb,boolean)
  FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.guard_axtn_case_pattern_usage() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE protected boolean:=false;
BEGIN
  IF TG_OP<>'INSERT' THEN protected:=OLD.action LIKE 'axtn_case_pattern.%'; END IF;
  IF TG_OP<>'DELETE' THEN protected:=protected OR NEW.action LIKE 'axtn_case_pattern.%'; END IF;
  IF protected AND current_user<>'postgres'
  THEN RAISE EXCEPTION 'CASE_PATTERN_NATIVE_CONTRACT_REQUIRED'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_axtn_case_pattern_usage() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER guard_axtn_case_pattern_audit BEFORE INSERT OR UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION guard_axtn_case_pattern_usage();

CREATE FUNCTION public.axtn_case_pattern(p_user_id uuid,p_operation text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE principal jsonb:=p_payload->'_principal'; payload jsonb:=p_payload-'_principal';
  dataset uuid; row_id bigint; current_case jsonb; usage jsonb; usages jsonb; result jsonb; prior jsonb;
  request_hash text; revision bigint; stamp timestamptz; selected jsonb; scoped_ids jsonb; total bigint;
  candidate jsonb; candidate_identity text; page_offset integer; page_limit integer;
BEGIN
  PERFORM assert_axtn_case_principal(p_user_id,principal);
  IF COALESCE(p_operation,'') NOT IN ('pattern_usage','pattern_assurance','pattern_view','pattern_improvement')
    OR jsonb_typeof(payload) IS DISTINCT FROM 'object'
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(payload) k WHERE NOT k=ANY(
      CASE p_operation
        WHEN 'pattern_usage' THEN ARRAY['caseId','usageId','artifact','purpose','rClass','eClass','iClass',
          'outcome','evidence','transitionKey','expectedVersion']
        WHEN 'pattern_assurance' THEN ARRAY['caseId','usageId','rClass','eClass','iClass',
          'evidence','transitionKey','expectedVersion']
        WHEN 'pattern_improvement' THEN ARRAY['caseId','usageId','hypothesis','signal',
          'scenarioClass','transitionKey','expectedVersion']
        ELSE ARRAY['caseId','offset','limit'] END))
  THEN RAISE EXCEPTION 'CASE_PATTERN_PAYLOAD_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text,0));
  stamp:=clock_timestamp();
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=p_user_id AND name='axtn_cases';
  IF dataset IS NULL THEN RAISE EXCEPTION 'CASE_PATTERN_DATASET_REQUIRED'; END IF;
  IF p_operation='pattern_view' THEN
    IF jsonb_typeof(payload->'offset') IS DISTINCT FROM 'number'
      OR COALESCE(payload->>'offset','') !~ '^[0-9]{1,9}$'
      OR jsonb_typeof(payload->'limit') IS DISTINCT FROM 'number'
      OR COALESCE(payload->>'limit','') !~ '^[0-9]{1,3}$'
      OR (payload->>'limit')::integer NOT BETWEEN 1 AND 200
    THEN RAISE EXCEPTION 'CASE_PATTERN_VIEW_REQUIRED'; END IF;
    IF payload ? 'caseId' AND NOT EXISTS(SELECT 1 FROM user_data_rows
      WHERE table_id=dataset AND row->>'case_id'=payload->>'caseId')
    THEN RAISE EXCEPTION 'CASE_PATTERN_AUTHORIZED_CASE_REQUIRED'; END IF;
    page_offset:=(payload->>'offset')::integer; page_limit:=(payload->>'limit')::integer;
    WITH RECURSIVE subtree AS (
      SELECT row->>'case_id' id,ARRAY[row->>'case_id'] path FROM user_data_rows WHERE table_id=dataset
        AND (NOT payload ? 'caseId' OR row->>'case_id'=payload->>'caseId')
      UNION ALL SELECT r.row->>'case_id',s.path||(r.row->>'case_id') FROM subtree s
        JOIN user_data_rows r ON r.table_id=dataset AND r.row->>'parent_case_id'=s.id
        WHERE payload ? 'caseId' AND NOT r.row->>'case_id'=ANY(s.path)
    ) SELECT COALESCE(jsonb_agg(id),'[]') INTO scoped_ids FROM subtree;
    SELECT COALESCE(jsonb_agg(u||jsonb_build_object('caseId',r.row->>'case_id')
      ORDER BY r.row->>'case_id',u->>'usageId'),'[]'),count(*) INTO selected,total
      FROM user_data_rows r CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(r.row->'pattern_usages','[]')) u
      WHERE r.table_id=dataset AND scoped_ids ? (r.row->>'case_id');
    RETURN jsonb_build_object('scope','OWNED_LOCAL_CASES','total',total,
      'offset',page_offset,'limit',page_limit,'asOf',stamp,
      'usages',(SELECT COALESCE(jsonb_agg(value),'[]') FROM (
        SELECT value FROM jsonb_array_elements(selected) ORDER BY value->>'caseId',value->>'usageId'
          OFFSET page_offset LIMIT page_limit) page),
      'artifacts',(SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'artifact',artifact,'distinctCaseCount',cases,'positiveCount',positive,
        'negativeCount',negative,'unknownCount',unknown)),'[]') FROM (
        SELECT u->'artifact' artifact,count(DISTINCT u->>'caseId') cases,
          count(*) FILTER(WHERE u->>'outcome'='POSITIVE') positive,
          count(*) FILTER(WHERE u->>'outcome'='NEGATIVE') negative,
          count(*) FILTER(WHERE u->>'outcome'='UNKNOWN') unknown
          FROM jsonb_array_elements(selected) u GROUP BY 1) grouped),
      'forecastStatus','EXPERIMENTAL_DISABLED','roi',NULL,'sampleSize',total,
      'ordinalClassesAreMultipliers',false,'acceptanceGranted',false);
  END IF;
  IF COALESCE(payload->>'usageId','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR jsonb_typeof(payload->'transitionKey') IS DISTINCT FROM 'string'
    OR length(payload->>'transitionKey') NOT BETWEEN 1 AND 200
    OR jsonb_typeof(payload->'expectedVersion') IS DISTINCT FROM 'number'
    OR COALESCE(payload->>'expectedVersion','') !~ '^[0-9]{1,16}$'
    OR (payload->>'expectedVersion')::numeric>9007199254740991
  THEN RAISE EXCEPTION 'CASE_PATTERN_VERSION_REQUIRED'; END IF;
  IF (SELECT count(*) FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=payload->>'caseId')<>1
  THEN RAISE EXCEPTION 'CASE_PATTERN_AUTHORIZED_CASE_REQUIRED'; END IF;
  SELECT id,row INTO row_id,current_case FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=payload->>'caseId' FOR UPDATE;
  usages:=COALESCE(current_case->'pattern_usages','[]');
  SELECT value INTO usage FROM jsonb_array_elements(usages) WHERE value->>'usageId'=payload->>'usageId';
  revision:=COALESCE((usage->>'version')::bigint,0);
  request_hash:=encode(extensions.digest((payload||jsonb_build_object(
    'operation',p_operation,'principal',principal))::text,'sha256'),'hex');
  SELECT detail INTO prior FROM audit_events WHERE user_id=p_user_id
    AND action LIKE 'axtn_case_pattern.%' AND detail->>'transitionKey'=payload->>'transitionKey';
  IF prior IS NOT NULL THEN
    IF prior->>'requestHash' IS DISTINCT FROM request_hash
    THEN RAISE EXCEPTION 'CASE_PATTERN_REPLAY_CONFLICT'; END IF;
    IF revision<>(prior->>'resultVersion')::bigint
    THEN RAISE EXCEPTION 'CASE_PATTERN_STALE_REPLAY'; END IF;
    RETURN usage;
  END IF;
  IF revision<>(payload->>'expectedVersion')::bigint
  THEN RAISE EXCEPTION 'CASE_PATTERN_VERSION_CONFLICT'; END IF;
  IF current_case->>'processing_mode'='HUMAN' AND principal->>'kind'<>'user_session'
  THEN RAISE EXCEPTION 'CASE_PATTERN_HUMAN_TAKEOVER_FENCED'; END IF;
  IF p_operation IN ('pattern_assurance','pattern_improvement') AND principal->>'kind'<>'user_session'
  THEN RAISE EXCEPTION 'CASE_PATTERN_AUTHENTICATED_HUMAN_REQUIRED'; END IF;
  IF p_operation='pattern_usage' AND usage IS NOT NULL
    OR p_operation<>'pattern_usage' AND usage IS NULL
  THEN RAISE EXCEPTION 'CASE_PATTERN_USAGE_IDENTITY_CONFLICT'; END IF;
  IF p_operation IN ('pattern_usage','pattern_assurance') THEN
    IF COALESCE(payload->>'rClass','') NOT IN ('R0','R1','R2','R3','R4')
      OR COALESCE(payload->>'eClass','') NOT IN ('E0','E1','E2','E3')
      OR COALESCE(payload->>'iClass','') NOT IN ('I0','I1','I2','I3')
      OR jsonb_typeof(payload->'evidence') IS DISTINCT FROM 'array'
      OR jsonb_array_length(payload->'evidence') NOT BETWEEN 1 AND 50
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'evidence') e
        WHERE NOT axtn_case_canonical_reference(e,true))
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(payload->'evidence') e WHERE e->>'kind'='evidence')
    THEN RAISE EXCEPTION 'CASE_PATTERN_CLASSIFICATION_EVIDENCE_REQUIRED'; END IF;
    IF p_operation='pattern_usage' AND (
      NOT axtn_case_canonical_reference(payload->'artifact',true)
      OR payload->'artifact'->>'kind' NOT IN ('repository','contract','evidence')
      OR COALESCE(payload->>'purpose','') NOT IN ('DELIVERY','CAPABILITY_UPLIFT','ASSURANCE')
      OR COALESCE(payload->>'outcome','') NOT IN ('POSITIVE','NEGATIVE','UNKNOWN'))
    THEN RAISE EXCEPTION 'CASE_PATTERN_VERSIONED_ARTIFACT_REQUIRED'; END IF;
    result:=COALESCE(usage,'{}')||payload-ARRAY['transitionKey','expectedVersion','caseId']
      ||jsonb_build_object('version',revision+1,'recordedAt',stamp,'actor',principal);
  ELSE
    IF COALESCE(payload->>'hypothesis','') NOT IN ('WAITING_BOTTLENECK','CAPABILITY_GAP','REWORK','PATTERN_DRIFT')
      OR COALESCE(payload->>'scenarioClass','') NOT IN ('real_work','synthetic_acceptance','regression')
      OR NOT axtn_case_canonical_reference(payload->'signal',true)
      OR payload->'signal'->>'kind'<>'evidence'
    THEN RAISE EXCEPTION 'CASE_PATTERN_IMPROVEMENT_SIGNAL_REQUIRED'; END IF;
    candidate_identity:='pattern-improvement:'||encode(extensions.digest(
      jsonb_build_object('caseId',payload->>'caseId','usageId',payload->>'usageId',
        'artifact',usage->'artifact','hypothesis',payload->>'hypothesis')::text,'sha256'),'hex');
    candidate:=axtn_case_work(p_user_id,'ensure',jsonb_build_object(
      'sourceId',candidate_identity,'subject','Pattern improvement: '||(payload->>'hypothesis'),
      'caseType','DEVELOPMENT_IMPROVEMENT_CANDIDATE','parentCaseId',payload->>'caseId',
      'workContractRef',jsonb_build_object('kind','contract',
        'repository',usage->'artifact'->>'repository','id',usage->'artifact'->>'id',
        'revision',usage->'artifact'->>'revision'),
      'scenarioClass',payload->>'scenarioClass','scenarioId',candidate_identity,
      'processingMode','DETERMINISTIC','executionChannel','HUMAN','actorRef',principal->>'id',
      'requiredDependencies','[]'::jsonb,'references',jsonb_build_array(usage->'artifact',payload->'signal'),
      '_principal',principal));
    result:=usage||jsonb_build_object('version',revision+1,'recordedAt',stamp,'actor',principal,
      'improvementCaseId',candidate->>'case_id','hypothesis',payload->>'hypothesis',
      'signal',payload->'signal','promotionEnabled',false);
  END IF;
  SELECT COALESCE(jsonb_agg(value),'[]') INTO usages FROM jsonb_array_elements(usages)
    WHERE value->>'usageId'<>payload->>'usageId';
  UPDATE user_data_rows SET row=current_case||jsonb_build_object(
    'pattern_usages',usages||jsonb_build_array(result),'updated_at',stamp) WHERE id=row_id;
  INSERT INTO audit_events(user_id,action,resource_type,resource_id,created_at,detail)
    VALUES(p_user_id,'axtn_case_pattern.'||upper(replace(p_operation,'pattern_','')),
      'axtn_case_pattern',(payload->>'caseId')::uuid,stamp,jsonb_build_object(
        'transitionKey',payload->>'transitionKey','requestHash',request_hash,
        'usageId',payload->>'usageId','principal',principal,'from',usage,'to',result,
        'resultVersion',revision+1,'acceptanceGranted',false,
        'purpose',CASE WHEN p_operation='pattern_assurance' THEN 'ASSURANCE' ELSE result->>'purpose' END));
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_pattern(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_pattern(uuid,text,jsonb) TO service_role;
