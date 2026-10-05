\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE pattern_fixture(owner_id uuid,case_id uuid,dataset_id uuid,usage_id uuid);
DO $$
DECLARE owner uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); human jsonb; machine jsonb;
  root jsonb; child jsonb; second_child jsonb; artifact jsonb; evidence jsonb; request jsonb;
  result jsonb; assured jsonb; view jsonb; improvement jsonb; dataset uuid; usage_id uuid:=gen_random_uuid();
  before_count bigint; outcome text; work_count bigint;
BEGIN
  INSERT INTO auth.users(id,email,invited_at) VALUES
    (owner,owner::text||'@pattern.invalid',now()),(other,other::text||'@pattern.invalid',now());
  human:=jsonb_build_object('kind','user_session','id',owner);
  machine:=jsonb_build_object('kind','swarm','id',owner);
  root:=axtn_case_manual(owner,'create',jsonb_build_object('row',jsonb_build_object(
    'subject','Synthetic Pattern experiment','status','OPEN','priority',3,'source_kind','manual','source_id',owner),
    'transitionKey','root','expectedVersion',0,'_principal',human));
  artifact:=jsonb_build_object('kind','contract','repository','aXtn/aXtn-agentswarms',
    'id','tests/integration/casePattern.sql','revision',repeat('a',40));
  evidence:=jsonb_build_array(artifact||'{"kind":"evidence"}');
  request:=jsonb_build_object('caseId',root->>'case_id','usageId',usage_id,
    'transitionKey','usage-negative','expectedVersion',0,'artifact',artifact,'outcome','NEGATIVE','purpose','CAPABILITY_UPLIFT',
    'rClass','R2','eClass','E1','iClass','I0','evidence',evidence,'_principal',human);
  result:=axtn_case_pattern(owner,'pattern_usage',request);
  IF axtn_case_pattern(owner,'pattern_usage',request) IS DISTINCT FROM result
    OR result->>'version'<>'1' OR result->>'outcome'<>'NEGATIVE'
  THEN RAISE EXCEPTION 'Versioned negative usage or replay failed'; END IF;
  FOR outcome IN SELECT unnest(ARRAY['reuse-one','reuse-two']) LOOP
    child:=axtn_case_manual(owner,'create',jsonb_build_object('row',jsonb_build_object(
      'subject','Synthetic positive '||outcome,'status','OPEN','priority',3,
      'source_kind','manual','source_id',owner,'parent_case_id',root->>'case_id'),
      'transitionKey',outcome,'expectedVersion',0,'_principal',human));
    PERFORM axtn_case_pattern(owner,'pattern_usage',request||jsonb_build_object(
      'caseId',child->>'case_id','usageId',gen_random_uuid(),'transitionKey',outcome,
      'outcome','POSITIVE'));
  END LOOP;
  view:=axtn_case_pattern(owner,'pattern_view',jsonb_build_object('caseId',root->>'case_id',
    'offset',0,'limit',1,'_principal',human));
  IF view->>'total'<>'3' OR jsonb_array_length(view->'usages')<>1
    OR view->'artifacts'->0->>'distinctCaseCount'<>'3'
    OR view->'artifacts'->0->>'positiveCount'<>'2'
    OR view->'artifacts'->0->>'negativeCount'<>'1'
    OR view->>'ordinalClassesAreMultipliers'<>'false'
    OR view->>'acceptanceGranted'<>'false' OR view->>'roi' IS NOT NULL
  THEN RAISE EXCEPTION 'Versioned two-reuse/negative/sample/paging or unsupported ROI/Acceptance'; END IF;
  before_count:=(SELECT count(*) FROM audit_events WHERE user_id=owner);
  BEGIN
    PERFORM axtn_case_pattern(owner,'pattern_assurance',request-ARRAY['artifact','outcome','purpose']||
      jsonb_build_object('expectedVersion',1,'transitionKey','auto-assurance','_principal',machine));
    RAISE EXCEPTION 'Automated assurance accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PATTERN_AUTHENTICATED_HUMAN_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_pattern(owner,'pattern_usage',request||jsonb_build_object(
      'usageId',gen_random_uuid(),'transitionKey','unversioned','artifact',NULL));
    RAISE EXCEPTION 'Unversioned artifact accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PATTERN_VERSIONED_ARTIFACT_REQUIRED' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM audit_events WHERE user_id=owner)<>before_count
  THEN RAISE EXCEPTION 'Failed pattern write mutated audit'; END IF;
  request:=request-ARRAY['artifact','outcome','purpose']||jsonb_build_object(
    'expectedVersion',1,'transitionKey','assurance','rClass','R3','eClass','E2','iClass','I1');
  assured:=axtn_case_pattern(owner,'pattern_assurance',request);
  IF assured->>'version'<>'2' OR assured->>'outcome'<>'NEGATIVE'
    OR assured->'artifact' IS DISTINCT FROM artifact
    OR axtn_case_pattern(owner,'pattern_assurance',request) IS DISTINCT FROM assured
  THEN RAISE EXCEPTION 'Assurance changed outcome/artifact or lost audit/version/replay'; END IF;
  BEGIN
    PERFORM axtn_case_pattern(owner,'pattern_assurance',request||'{"transitionKey":"stale"}');
    RAISE EXCEPTION 'Stale assurance accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PATTERN_VERSION_CONFLICT' THEN RAISE; END IF;
  END;
  request:=jsonb_build_object('caseId',root->>'case_id','usageId',usage_id,
    'expectedVersion',2,'transitionKey','candidate','hypothesis','REWORK',
    'scenarioClass','synthetic_acceptance','signal',artifact||'{"kind":"evidence"}','_principal',human);
  improvement:=axtn_case_pattern(owner,'pattern_improvement',request);
  IF improvement->>'promotionEnabled'<>'false'
    OR improvement->>'improvementCaseId' IS NULL OR improvement->>'version'<>'3'
    OR axtn_case_pattern(owner,'pattern_improvement',request) IS DISTINCT FROM improvement
  THEN RAISE EXCEPTION 'Existing Improvement Work missing, duplicate or auto-promoted'; END IF;
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=owner AND name='axtn_cases';
  IF NOT EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=improvement->>'improvementCaseId' AND row->>'status'='NEW'
    AND row->>'case_type'='DEVELOPMENT_IMPROVEMENT_CANDIDATE' AND NOT row ? 'accepted_sha')
  THEN RAISE EXCEPTION 'Improvement bypassed existing Work/Acceptance'; END IF;
  SELECT count(*) INTO work_count FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_type'='DEVELOPMENT_IMPROVEMENT_CANDIDATE';
  IF work_count<>1 THEN RAISE EXCEPTION 'Improvement Work duplicated'; END IF;
  BEGIN
    PERFORM axtn_case_work(owner,'transition',jsonb_build_object(
      'caseId',improvement->>'improvementCaseId','transitionKey','unpromoted-start',
      'eventType','STARTED','reasonCode','SYNTHETIC_TEST','references',evidence,'_principal',human));
    RAISE EXCEPTION 'Unpromoted improvement started';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Improvement Candidate requires explicit promotion' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_work(owner,'transition',jsonb_build_object(
      'caseId',improvement->>'improvementCaseId','transitionKey','automated-promotion',
      'eventType','PROMOTED','reasonCode','SYNTHETIC_TEST','references',evidence,'_principal',machine));
    RAISE EXCEPTION 'Autonomous promotion accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Human responsibility requires an authenticated user session' THEN RAISE; END IF;
  END;
  PERFORM axtn_case_work(owner,'transition',jsonb_build_object(
    'caseId',improvement->>'improvementCaseId','transitionKey','explicit-synthetic-human-promotion',
    'eventType','PROMOTED','reasonCode','AUTHORIZED_SYNTHETIC_INTERVENTION',
    'references',evidence,'_principal',human));
  PERFORM axtn_case_work(owner,'transition',jsonb_build_object(
    'caseId',improvement->>'improvementCaseId','transitionKey','promoted-start',
    'eventType','STARTED','reasonCode','AUTHORIZED_SYNTHETIC_INTERVENTION',
    'references',evidence,'_principal',human));
  IF NOT EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset
    AND row->>'case_id'=improvement->>'improvementCaseId' AND row->>'status'='OPEN'
    AND row->>'promoted'='true' AND NOT row ? 'accepted_sha')
  THEN RAISE EXCEPTION 'Existing explicit promotion/Work gate lost'; END IF;
  IF EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset AND row->>'case_id'=root->>'case_id'
    AND (row->>'status'<>'OPEN' OR row ? 'accepted_sha'))
  THEN RAISE EXCEPTION 'Usage accepted or closed original work'; END IF;
  BEGIN
    PERFORM axtn_case_pattern(other,'pattern_view',jsonb_build_object('caseId',root->>'case_id',
      'offset',0,'limit',50,'_principal',jsonb_build_object('kind','user_session','id',other)));
    RAISE EXCEPTION 'Foreign Pattern scope exposed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_ACCESS_DENIED' THEN RAISE; END IF;
  END;
  INSERT INTO pattern_fixture VALUES(owner,(root->>'case_id')::uuid,dataset,usage_id);
  RAISE NOTICE 'PASS: exact-version Pattern Usage, two synthetic reuses/negative result, evidence classes/assurance history, paging/full totals, native idempotent Improvement Work without promotion/Acceptance';
END;
$$;
GRANT SELECT ON pattern_fixture TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE fixture pattern_fixture%ROWTYPE;
BEGIN
  SELECT * INTO fixture FROM pattern_fixture;
  BEGIN
    UPDATE user_data_rows SET row=row||'{"pattern_usages":[]}' WHERE table_id=fixture.dataset_id
      AND row->>'case_id'=fixture.case_id::text;
    RAISE EXCEPTION 'Direct usage erase accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PROCESSING_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE audit_events SET detail='{}' WHERE user_id=fixture.owner_id AND action LIKE 'axtn_case_pattern.%';
    RAISE EXCEPTION 'Pattern audit altered';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PATTERN_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  IF has_function_privilege('authenticated','axtn_case_pattern(uuid,text,jsonb)','EXECUTE')
    OR has_function_privilege('service_role','axtn_case_canonical_reference(jsonb,boolean)','EXECUTE')
  THEN RAISE EXCEPTION 'Private pattern delegate exposed'; END IF;
  RAISE NOTICE 'PASS: actual native service-row/audit bypass denial, private delegate, no browser RPC authority';
END;
$$;
RESET ROLE;
ROLLBACK;
