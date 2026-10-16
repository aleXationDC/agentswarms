-- Run against an isolated clone. Reproduces / guards reference persistence on ABANDONED.
\set ON_ERROR_STOP on
BEGIN;
DO $t$
DECLARE
  u uuid := '83727979-ed5f-4a1b-8090-05e7bc3fe453';
  sw jsonb := jsonb_build_object('kind','swarm','id',u);
  us jsonb := jsonb_build_object('kind','user_session','id',u);
  c jsonb; cid text; r jsonb; n int;
BEGIN
  c := axtn_case_work_before_responsibility(u,'ensure', jsonb_build_object(
    'sourceId','ABANDON-REF-PROBE','subject','ABANDON-REF-PROBE','caseType','DEVELOPMENT_CHANGE',
    'processingMode','SEMANTIC','executionChannel','COPILOT_CLI','actorRef','probe',
    'scenarioClass','regression','scenarioId','ABANDON-REF-PROBE','taskId','ABANDON-REF-PROBE',
    'inputRevision','0a38f20ccea94d937a5d4fa2ad18b37ae6439c09','testProfile','python-normalization-v1',
    'requiredDependencies','[]'::jsonb,
    'workContractRef',jsonb_build_object('kind','contract','repository','aXtn/aXtn-agentswarms','id','probe','revision','abc'),
    'references',jsonb_build_array(jsonb_build_object('kind','run','repository','x','id','prior-1')),
    '_principal',sw));
  cid := c->>'case_id';
  PERFORM axtn_case_work_before_responsibility(u,'transition', jsonb_build_object(
    'caseId',cid,'transitionKey','probe:started','eventType','STARTED','reasonCode','PROBE','actorRef','probe',
    'processingMode','SEMANTIC','executionChannel','COPILOT_CLI','attemptId','probe','references','[]'::jsonb,'_principal',sw));
  r := axtn_case_work_before_responsibility(u,'transition', jsonb_build_object(
    'caseId',cid,'transitionKey','probe:abandon','eventType','ABANDONED','reasonCode','PROBE_ABANDON','actorRef','probe',
    'processingMode','SEMANTIC','executionChannel','COPILOT_CLI','attemptId','probe',
    'references',jsonb_build_array(jsonb_build_object('kind','evidence','repository','x','id','new-1','revision','abc')),
    '_principal',us));
  n := CASE WHEN jsonb_typeof(r->'references')='array' THEN jsonb_array_length(r->'references') ELSE 0 END;
  RAISE NOTICE 'RESULT status=% refs=%', r->>'status', n;
  IF n <> 2 THEN RAISE EXCEPTION 'FAIL: expected prior+new reference (2), got %', n; END IF;
  RAISE NOTICE 'PASS abandoned references preserved';
END
$t$;
ROLLBACK;
