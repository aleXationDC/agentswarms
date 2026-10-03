-- Run with psql against the existing test owner, in a transaction that rolls back.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  owner uuid;
  work jsonb;
  result jsonb;
  again jsonb;
  case_id text;
  transition jsonb;
BEGIN
  SELECT id INTO owner FROM auth.users ORDER BY created_at LIMIT 1;
  IF owner IS NULL THEN RAISE EXCEPTION 'An authenticated fixture owner is required'; END IF;
  work := jsonb_build_object(
    'sourceId','contract-test:case-work','subject','Case work transactional fixture',
    'caseType','DEVELOPMENT_VERIFY','workContractRef',jsonb_build_object(
      'kind','contract','repository','aXtn/aXtn-agentswarms','id','caseWork.sql'),
    'scenarioClass','regression','scenarioId','case-work-transaction',
    'processingMode','DETERMINISTIC','executionChannel','COPILOT_CLI',
    'actorRef','test-builder','requiredDependencies','[]'::jsonb,'references','[]'::jsonb);
  result := public.axtn_case_work(owner,'ensure',work);
  again := public.axtn_case_work(owner,'ensure',work);
  IF result IS DISTINCT FROM again THEN RAISE EXCEPTION 'Ensure replay differs'; END IF;
  case_id := result->>'case_id';
  BEGIN
    PERFORM public.axtn_case_work(owner,'ensure',work||'{"subject":"changed"}'::jsonb);
    RAISE EXCEPTION 'Identity conflict was not denied';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Work identity conflict' THEN RAISE; END IF;
  END;
  transition := jsonb_build_object('caseId',case_id,'transitionKey','test-start',
    'eventType','STARTED','actorRef','test-builder','reasonCode','TEST',
    'references','[]'::jsonb);
  result := public.axtn_case_work(owner,'transition',transition);
  again := public.axtn_case_work(owner,'transition',transition);
  IF result IS DISTINCT FROM again THEN RAISE EXCEPTION 'Transition replay differs'; END IF;
  IF (SELECT count(*) FROM audit_events WHERE user_id=owner
      AND detail->>'transitionKey'='test-start')<>1 THEN
    RAISE EXCEPTION 'Transition event duplicated';
  END IF;
  BEGIN
    PERFORM public.axtn_case_work(owner,'transition',transition||'{"reasonCode":"OTHER"}');
    RAISE EXCEPTION 'Transition conflict was not denied';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Transition conflict' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.axtn_case_work(owner,'transition',transition||
      '{"eventType":"COMPLETED","transitionKey":"test-complete-no-evidence"}');
    RAISE EXCEPTION 'Completion without Evidence was not denied';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Completion requires Evidence' THEN RAISE; END IF;
  END;
  result := public.axtn_case_work(owner,'ensure',work||jsonb_build_object(
    'sourceId','contract-test:case-work-parent','caseType','DEVELOPMENT_CHANGE'));
  UPDATE user_data_rows SET row=row||jsonb_build_object(
    'candidate_sha',repeat('a',40),'accepted_sha',repeat('a',40))
    WHERE row->>'case_id'=result->>'case_id';
  BEGIN
    PERFORM public.axtn_case_work(owner,'transition',jsonb_build_object(
      'caseId',result->>'case_id','transitionKey','test-parent-no-integration',
      'eventType','COMPLETED','actorRef','test-builder','reasonCode','TEST',
      'references',jsonb_build_array(jsonb_build_object(
        'kind','evidence','repository','aXtn/aXtn-agentswarms','id','caseWork.sql'))));
    RAISE EXCEPTION 'Parent with no integration receipt was not denied';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Parent requires independent Acceptance and integration' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: identity, transition replay/conflict, atomic audit and completion Evidence';
END;
$$;
ROLLBACK;
