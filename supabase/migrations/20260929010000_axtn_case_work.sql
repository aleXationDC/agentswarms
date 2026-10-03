-- Case state remains in the existing owner-scoped SupaCase dataset.
-- Transitions and their audit event commit together; a retry cannot duplicate either.
ALTER TABLE public.swarm_api_keys DROP CONSTRAINT swarm_api_keys_scopes_valid;
ALTER TABLE public.swarm_api_keys ADD CONSTRAINT swarm_api_keys_scopes_valid
  CHECK (scopes <@ ARRAY['run', 'read_runs', 'cases']::text[]);

CREATE UNIQUE INDEX axtn_work_case_identity ON public.user_data_rows
  (table_id, (row->>'source_id'))
  WHERE row->>'source_kind' = 'development_work';

CREATE OR REPLACE FUNCTION public.axtn_case_work(
  p_user_id uuid, p_operation text, p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  dataset uuid;
  row_id bigint;
  current_case jsonb;
  next_case jsonb;
  prior_event jsonb;
  dependency text;
  parent_id text;
  event_type text;
  next_status text;
  case_id uuid;
  stamp timestamptz := clock_timestamp();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id=p_user_id) THEN
    RAISE EXCEPTION 'Unknown Case owner';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('axtn-case-work:'||p_user_id::text, 0));
  SELECT id INTO dataset FROM user_data_tables
    WHERE user_id=p_user_id AND name='axtn_cases';
  IF dataset IS NULL THEN
    INSERT INTO user_data_tables(user_id,name,source_filename,columns,is_sample)
    VALUES(p_user_id,'axtn_cases','aXtn SupaCase Management',
      (SELECT jsonb_agg(jsonb_build_object('name',name,'type','string'))
       FROM unnest(ARRAY['case_id','parent_case_id','subject','case_type','status',
         'status_reason','priority','due_date','follow_up','account_id','primary_contact_id',
         'related_entity','created_at','updated_at','closed_at','source_kind','source_id'])
       AS names(name)),false)
    RETURNING id INTO dataset;
  END IF;
  IF p_operation='list' THEN
    RETURN jsonb_build_object('cases',
      COALESCE((SELECT jsonb_agg(row ORDER BY row->>'created_at')
        FROM user_data_rows WHERE table_id=dataset), '[]'::jsonb),
      'events', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'action',action,'caseId',resource_id,'detail',detail,'timestamp',created_at)
        ORDER BY created_at) FROM audit_events
        WHERE user_id=p_user_id AND resource_type='axtn_case_work'), '[]'::jsonb));
  END IF;
  IF p_operation='ensure' THEN
    SELECT id,row INTO row_id,current_case FROM user_data_rows
      WHERE table_id=dataset AND row->>'source_kind'='development_work'
        AND row->>'source_id'=p_payload->>'sourceId';
    IF current_case IS NOT NULL THEN
      IF current_case->'work_identity' IS DISTINCT FROM p_payload THEN
        RAISE EXCEPTION 'Work identity conflict';
      END IF;
      RETURN current_case;
    END IF;
    parent_id := p_payload->>'parentCaseId';
    IF parent_id IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM user_data_rows WHERE table_id=dataset AND row->>'case_id'=parent_id
    ) THEN RAISE EXCEPTION 'Owned parent Case not found'; END IF;
    FOR dependency IN SELECT jsonb_array_elements_text(p_payload->'requiredDependencies') LOOP
      IF NOT EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
        AND row->>'case_id'=dependency AND row->>'source_kind'='development_work')
      THEN RAISE EXCEPTION 'Owned dependency Case not found'; END IF;
    END LOOP;
    case_id := gen_random_uuid();
    next_case := jsonb_build_object(
      'case_id',case_id,'parent_case_id',parent_id,'subject',p_payload->>'subject',
      'case_type',p_payload->>'caseType','status','NEW','priority',3,
      'created_at',stamp,'updated_at',stamp,'closed_at',NULL,
      'source_kind','development_work','source_id',p_payload->>'sourceId',
      'work_identity',p_payload,'processing_mode',p_payload->>'processingMode',
      'execution_channel',p_payload->>'executionChannel','actor_ref',p_payload->>'actorRef',
      'required_dependencies',p_payload->'requiredDependencies',
      'references',p_payload->'references');
    INSERT INTO user_data_rows(table_id,row) VALUES(dataset,next_case);
    INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
    VALUES(p_user_id,'axtn_work.CREATED','axtn_case_work',case_id,
      jsonb_build_object('transitionKey','ensure:'||(p_payload->>'sourceId'),
      'processingMode',p_payload->>'processingMode','executionChannel',p_payload->>'executionChannel',
      'actorRef',p_payload->>'actorRef'));
    RETURN next_case;
  END IF;
  IF p_operation <> 'transition' THEN RAISE EXCEPTION 'Unknown Case operation'; END IF;
  SELECT id,row INTO row_id,current_case FROM user_data_rows
    WHERE table_id=dataset AND row->>'case_id'=p_payload->>'caseId'
      AND row->>'source_kind'='development_work' FOR UPDATE;
  IF current_case IS NULL THEN RAISE EXCEPTION 'Owned work Case not found'; END IF;
  SELECT detail->'request' INTO prior_event FROM audit_events
    WHERE user_id=p_user_id AND resource_type='axtn_case_work'
      AND detail->>'transitionKey'=p_payload->>'transitionKey';
  IF prior_event IS NOT NULL THEN
    IF prior_event IS DISTINCT FROM p_payload THEN RAISE EXCEPTION 'Transition conflict'; END IF;
    RETURN current_case;
  END IF;
  event_type := p_payload->>'eventType';
  next_status := current_case->>'status';
  IF event_type='STARTED' THEN
    IF next_status='CLOSED' THEN RAISE EXCEPTION 'Reopen before starting'; END IF;
    FOR dependency IN SELECT jsonb_array_elements_text(current_case->'required_dependencies') LOOP
      IF NOT EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
        AND row->>'case_id'=dependency AND row->>'status'='CLOSED'
        AND (p_payload->>'candidateSHA' IS NULL OR row->>'candidate_sha'=p_payload->>'candidateSHA'))
      THEN RAISE EXCEPTION 'Dependency not completed at required revision'; END IF;
    END LOOP;
    next_status := 'OPEN';
  ELSIF event_type IN ('REOPENED','ROLLBACK') THEN next_status := 'OPEN';
  ELSIF event_type IN ('COMPLETED','ABANDONED') THEN
    FOR dependency IN SELECT jsonb_array_elements_text(current_case->'required_dependencies') LOOP
      IF NOT EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
        AND row->>'case_id'=dependency AND row->>'status'='CLOSED')
      THEN RAISE EXCEPTION 'Dependency not completed'; END IF;
    END LOOP;
    IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'references') ref
      WHERE ref->>'kind'='evidence') THEN RAISE EXCEPTION 'Completion requires Evidence'; END IF;
    IF EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
      AND row->>'parent_case_id'=current_case->>'case_id'
      AND row->>'case_type'<>'DEVELOPMENT_IMPROVEMENT_CANDIDATE'
      AND row->>'status'<>'CLOSED') THEN RAISE EXCEPTION 'Required child Cases incomplete'; END IF;
    IF current_case->>'case_type'='DEVELOPMENT_CHANGE'
      AND (current_case->>'accepted_sha' IS DISTINCT FROM current_case->>'candidate_sha'
        OR current_case->>'accepted_sha' IS NULL
        OR COALESCE(current_case->>'integration_phase','') NOT IN ('PR_READY','DEPLOYED_VERIFIED','MERGED','ABANDONED'))
    THEN RAISE EXCEPTION 'Parent requires independent Acceptance and integration'; END IF;
    next_status := 'CLOSED';
  ELSIF event_type='ACCEPTED' THEN
    IF p_payload->>'actorRef'=current_case->>'actor_ref' THEN
      RAISE EXCEPTION 'Builder cannot self accept';
    END IF;
    IF p_payload->>'candidateSHA' IS NULL
      OR p_payload->>'candidateSHA' IS DISTINCT FROM current_case->>'candidate_sha'
      OR current_case->>'checks_sha' IS DISTINCT FROM p_payload->>'candidateSHA'
    THEN RAISE EXCEPTION 'Acceptance requires exact tested Candidate'; END IF;
  END IF;
  next_case := current_case || jsonb_build_object(
    'status',next_status,'status_reason',p_payload->>'reasonCode','updated_at',stamp,
    'closed_at',CASE WHEN next_status='CLOSED' THEN to_jsonb(stamp) ELSE 'null'::jsonb END);
  IF p_payload ? 'candidateSHA' THEN
    IF current_case->>'candidate_sha' IS DISTINCT FROM p_payload->>'candidateSHA' THEN
      next_case := next_case - 'accepted_sha' - 'checks_sha' - 'integration_phase';
    END IF;
    next_case := next_case || jsonb_build_object('candidate_sha',p_payload->>'candidateSHA');
  END IF;
  IF event_type='CHECKS_PASSED' THEN
    IF p_payload->>'candidateSHA' IS NULL THEN RAISE EXCEPTION 'Checks require Candidate'; END IF;
    next_case := next_case || jsonb_build_object('checks_sha',p_payload->>'candidateSHA');
  ELSIF event_type='CHECKS_FAILED' THEN
    next_case := next_case - 'checks_sha' - 'accepted_sha';
  ELSIF event_type='ACCEPTED' THEN
    next_case := next_case || jsonb_build_object('accepted_sha',p_payload->>'candidateSHA');
  ELSIF event_type='PR_CREATED' THEN
    next_case := next_case || jsonb_build_object('integration_phase','PR_READY');
  ELSIF event_type IN ('MERGED','DEPLOYED_VERIFIED','ABANDONED') THEN
    next_case := next_case || jsonb_build_object('integration_phase',event_type);
  END IF;
  IF event_type='TAKEOVER' THEN
    next_case := next_case || jsonb_build_object('actor_ref',p_payload->>'actorRef',
      'processing_mode',p_payload->>'processingMode','execution_channel',p_payload->>'executionChannel');
  END IF;
  next_case := next_case || jsonb_build_object('references',
    (SELECT COALESCE(jsonb_agg(DISTINCT ref),'[]'::jsonb)
      FROM jsonb_array_elements(COALESCE(next_case->'references','[]'::jsonb)
        || p_payload->'references') ref));
  UPDATE user_data_rows SET row=next_case WHERE id=row_id;
  INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
  VALUES(p_user_id,'axtn_work.'||event_type,'axtn_case_work',(current_case->>'case_id')::uuid,
    jsonb_build_object('transitionKey',p_payload->>'transitionKey','request',p_payload,
      'fromMode',current_case->>'processing_mode','toMode',next_case->>'processing_mode',
      'executionChannel',next_case->>'execution_channel'));
  RETURN next_case;
END;
$$;
REVOKE ALL ON FUNCTION public.axtn_case_work(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.axtn_case_work(uuid,text,jsonb) TO service_role;
