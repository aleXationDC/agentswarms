\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE capacity_fixture(owner_id uuid,case_id uuid,dataset_id uuid,record_id uuid,other_id uuid);
DO $$
DECLARE owner uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); human jsonb; machine jsonb;
  root jsonb; child jsonb; target jsonb; request jsonb; result jsonb; view jsonb; allocation uuid:=gen_random_uuid();
  commitment uuid:=gen_random_uuid(); consumption uuid:=gen_random_uuid(); corrected uuid:=gen_random_uuid();
  dataset uuid; before_audit bigint; extra_provider integer; extra_allocation uuid; extra_commitment uuid;
BEGIN
  INSERT INTO auth.users(id,email,invited_at) VALUES
    (owner,owner::text||'@capacity.invalid',now()),(other,other::text||'@capacity.invalid',now());
  human:=jsonb_build_object('kind','user_session','id',owner);
  machine:=jsonb_build_object('kind','swarm','id',owner);
  root:=axtn_case_manual(owner,'create',jsonb_build_object('row',jsonb_build_object(
    'subject','Synthetic project','status','OPEN','priority',3,'source_kind','manual','source_id',owner),'expectedVersion',0,
    'transitionKey','project','_principal',human));
  child:=axtn_case_manual(owner,'create',jsonb_build_object('row',jsonb_build_object(
    'subject','Synthetic delivery','status','OPEN','priority',3,'source_kind','manual','source_id',owner,
    'parent_case_id',root->>'case_id'),
    'expectedVersion',0,'transitionKey','delivery','_principal',human));
  target:=axtn_case_manual(other,'create',jsonb_build_object('row',jsonb_build_object(
    'subject','Not shared','status','OPEN','priority',3,'source_kind','manual','source_id',other),
    'expectedVersion',0,'transitionKey','other','_principal',
    jsonb_build_object('kind','user_session','id',other)));
  BEGIN
    PERFORM axtn_case_capacity(owner,'capacity_view',jsonb_build_object('caseId',target->>'case_id',
      'scope','CURRENT','offset',0,'limit',50,'_principal',human));
    RAISE EXCEPTION 'Foreign capacity scope exposed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_CAPACITY_AUTHORIZED_CASE_REQUIRED' THEN RAISE; END IF;
  END;
  request:=jsonb_build_object('allocationId',allocation,'contextCaseId',root->>'case_id',
    'providerRef','synthetic:human-specialist','poolRef','synthetic:review-pool',
    'startsOn','2026-10-01','endsOn','2026-10-31','availableHours',20,'unavailableHours',5,
    'expectedVersion',0,'transitionKey','allocation','_principal',human);
  result:=axtn_case_capacity(owner,'capacity_allocation',request);
  IF axtn_case_capacity(owner,'capacity_allocation',request) IS DISTINCT FROM result
  THEN RAISE EXCEPTION 'Allocation replay changed'; END IF;
  before_audit:=(SELECT count(*) FROM audit_events WHERE user_id=owner);
  BEGIN
    PERFORM axtn_case_capacity(owner,'capacity_allocation',request||jsonb_build_object(
      'allocationId',gen_random_uuid(),'transitionKey','overlap','poolRef','other-pool'));
    RAISE EXCEPTION 'Same human counted twice through different pool';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_CAPACITY_PROVIDER_OVERLAP_DENIED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_capacity(owner,'capacity_allocation',request||jsonb_build_object(
      'allocationId',gen_random_uuid(),'transitionKey','negative','availableHours',-1));
    RAISE EXCEPTION 'Negative units accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_CAPACITY_NONNEGATIVE_HOURS_REQUIRED' THEN RAISE; END IF;
  END;
  request:=jsonb_build_object('commitmentId',commitment,'allocationId',allocation,
    'caseId',root->>'case_id','hours',10,'expectedVersion',0,'transitionKey','commitment','_principal',human);
  result:=axtn_case_capacity(owner,'capacity_commitment',request);
  BEGIN
    PERFORM axtn_case_capacity(owner,'capacity_commitment',request||jsonb_build_object(
      'commitmentId',gen_random_uuid(),'transitionKey','overcommit','hours',6));
    RAISE EXCEPTION 'Overcommit net availability accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_CAPACITY_COMMITMENT_LIMIT' THEN RAISE; END IF;
  END;
  request:=jsonb_build_object('consumptionId',consumption,'commitmentId',commitment,
    'caseId',child->>'case_id','bookedOn','2026-10-05','hours',1.5,'purpose','DELIVERY',
    'capabilityRef','synthetic:review','expectedVersion',0,'transitionKey','booking','_principal',human);
  result:=axtn_case_capacity(owner,'capacity_consumption',request);
  IF axtn_case_capacity(owner,'capacity_consumption',request) IS DISTINCT FROM result
    OR NOT result->'recordedScope' ? (root->>'case_id')
  THEN RAISE EXCEPTION 'Consumption replay/historical binding failed'; END IF;
  BEGIN
    PERFORM axtn_case_capacity(owner,'capacity_consumption',request||jsonb_build_object(
      'consumptionId',gen_random_uuid(),'transitionKey','automated','_principal',machine));
    RAISE EXCEPTION 'Automated hours silently accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_CAPACITY_AUTHENTICATED_HUMAN_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_capacity(owner,'capacity_consumption',request||jsonb_build_object(
      'consumptionId',gen_random_uuid(),'transitionKey','overconsume','hours',9));
    RAISE EXCEPTION 'Consumed beyond commitment';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_CAPACITY_CONSUMPTION_LIMIT' THEN RAISE; END IF;
  END;
  view:=axtn_case_capacity(owner,'capacity_view',jsonb_build_object('caseId',root->>'case_id',
    'scope','CURRENT','offset',0,'limit',1,'_principal',human));
  IF view->>'actualHours'<>'1.5' OR view->>'total'<>'3'
    OR jsonb_array_length(view->'records')<>1 OR view->>'stateDurationIsConsumption'<>'false'
    OR view->'capacityPeriods'->0->>'netAvailableHours'<>'15'
    OR view->'capacityPeriods'->0->>'committedHours'<>'10'
    OR view->>'forecastStatus'<>'UNKNOWN'
  THEN RAISE EXCEPTION 'Recursive totals/paging/net-once/explicit unknown failed: %',view; END IF;
  -- Synthetic 20h native event clock fixture, not measured Human consumption.
  UPDATE audit_events SET created_at=clock_timestamp()-interval '20 hours'
    WHERE user_id=owner AND action='axtn_case_processing.MANUAL_CREATE'
      AND resource_id=(child->>'case_id')::uuid;
  view:=axtn_case_processing(owner,'subtree',jsonb_build_object('caseId',child->>'case_id',
    'offset',0,'limit',50,'_principal',human));
  IF (view->'processingDurationHours'->>'UNKNOWN')::numeric<20
    OR view->>'stateDurationIsConsumption'<>'false'
  THEN RAISE EXCEPTION 'Calendar 20h incorrectly used as explicit 1.5h consumption'; END IF;
  request:=request||jsonb_build_object('consumptionId',corrected,'supersedes',consumption,
    'hours',2,'purpose','ASSURANCE','transitionKey','correct');
  PERFORM axtn_case_capacity(owner,'capacity_consumption',request);
  BEGIN
    PERFORM axtn_case_capacity(owner,'capacity_consumption',request||jsonb_build_object(
      'consumptionId',gen_random_uuid(),'transitionKey','correction-fork'));
    RAISE EXCEPTION 'Correction fork accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_CAPACITY_CORRECTION_CONFLICT' THEN RAISE; END IF;
  END;
  view:=axtn_case_capacity(owner,'capacity_view',jsonb_build_object('caseId',root->>'case_id',
    'scope','CURRENT','offset',0,'limit',200,'_principal',human));
  IF (view->>'actualHours')::numeric<>2 OR (view->'purposeHours'->>'ASSURANCE')::numeric<>2
    OR view->'purposeHours' ? 'DELIVERY'
  THEN RAISE EXCEPTION 'Correction double counted old record'; END IF;
  child:=axtn_case_manual(owner,'update',jsonb_build_object('row',child||'{"parent_case_id":null}',
    'expectedVersion',1,'transitionKey','reparent','_principal',human));
  view:=axtn_case_capacity(owner,'capacity_view',jsonb_build_object('caseId',root->>'case_id',
    'scope','CURRENT','offset',0,'limit',200,'_principal',human));
  IF (view->>'actualHours')::numeric<>0 THEN RAISE EXCEPTION 'Current subtree ignored reparent'; END IF;
  view:=axtn_case_capacity(owner,'capacity_view',jsonb_build_object('caseId',root->>'case_id',
    'scope','RECORDED','offset',0,'limit',200,'_principal',human));
  IF (view->>'actualHours')::numeric<>2 THEN RAISE EXCEPTION 'Historical booking scope changed'; END IF;
  request:=request||jsonb_build_object('consumptionId',gen_random_uuid(),'supersedes',corrected,
    'hours',1.5,'transitionKey','correct-after-reparent');
  PERFORM axtn_case_capacity(owner,'capacity_consumption',request);
  view:=axtn_case_capacity(owner,'capacity_view',jsonb_build_object('caseId',root->>'case_id',
    'scope','RECORDED','offset',0,'limit',200,'_principal',human));
  IF (view->>'actualHours')::numeric<>1.5
  THEN RAISE EXCEPTION 'Correction after reparent lost original scope'; END IF;
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=owner AND name='axtn_case_capacity';
  IF (SELECT count(*) FROM user_data_rows WHERE table_id=dataset AND row->>'kind'='consumption')<>3
  THEN RAISE EXCEPTION 'Original booking removed'; END IF;
  FOR extra_provider IN 2..3 LOOP
    extra_allocation:=gen_random_uuid(); extra_commitment:=gen_random_uuid();
    PERFORM axtn_case_capacity(owner,'capacity_allocation',jsonb_build_object(
      'allocationId',extra_allocation,'contextCaseId',root->>'case_id',
      'providerRef','synthetic:provider-'||extra_provider,'poolRef','synthetic:review-pool',
      'startsOn','2026-10-01','endsOn','2026-10-31','availableHours',8,'unavailableHours',2,
      'expectedVersion',0,'transitionKey','allocation-provider-'||extra_provider,'_principal',human));
    PERFORM axtn_case_capacity(owner,'capacity_commitment',jsonb_build_object(
      'commitmentId',extra_commitment,'allocationId',extra_allocation,'caseId',root->>'case_id',
      'hours',6,'expectedVersion',0,'transitionKey','commit-provider-'||extra_provider,'_principal',human));
    PERFORM axtn_case_capacity(owner,'capacity_consumption',jsonb_build_object(
      'consumptionId',gen_random_uuid(),'commitmentId',extra_commitment,'caseId',root->>'case_id',
      'hours',1,'purpose',CASE extra_provider WHEN 2 THEN 'CAPABILITY_UPLIFT' ELSE 'DELIVERY' END,
      'capabilityRef','synthetic:review','bookedOn','2026-10-05','expectedVersion',0,
      'transitionKey','book-provider-'||extra_provider,'_principal',human));
  END LOOP;
  view:=axtn_case_capacity(owner,'capacity_view',jsonb_build_object('caseId',root->>'case_id',
    'scope','RECORDED','offset',0,'limit',200,'_principal',human));
  IF (view->>'actualHours')::numeric<>3.5 OR jsonb_array_length(view->'capacityPeriods')<>3
    OR (view->'purposeHours'->>'CAPABILITY_UPLIFT')::numeric<>1
    OR (view->'purposeHours'->>'DELIVERY')::numeric<>1
    OR (view->'purposeHours'->>'ASSURANCE')::numeric<>1.5
  THEN RAISE EXCEPTION 'Multiple providers/purposes or recursive totals counted incorrectly'; END IF;
  INSERT INTO iam_resource_grants(resource_type,resource_id,principal_type,principal_id,created_by)
    VALUES('data_table',dataset,'user',other,owner);
  INSERT INTO capacity_fixture VALUES(owner,(root->>'case_id')::uuid,dataset,consumption,other);
  RAISE NOTICE 'PASS: native explicit availability, net once, commitment/consumption limits, replay, correction, purpose, recursive full totals/paging and historical reparent scope';
END;
$$;
GRANT SELECT ON capacity_fixture TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE fixture capacity_fixture%ROWTYPE;
BEGIN
  SELECT * INTO fixture FROM capacity_fixture;
  BEGIN
    UPDATE user_data_rows SET row=row||'{"hours":99}' WHERE table_id=fixture.dataset_id;
    RAISE EXCEPTION 'Direct capacity write accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_CAPACITY_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM axtn_local_table_upsert(fixture.owner_id,'axtn_case_capacity','id',
      fixture.record_id::text,jsonb_build_object('id',fixture.record_id,'hours',99));
    RAISE EXCEPTION 'LocalTable capacity bypass accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_CAPACITY_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM audit_events WHERE user_id=fixture.owner_id AND action LIKE 'axtn_case_capacity.%';
    RAISE EXCEPTION 'Native capacity audit erased';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_CAPACITY_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  IF has_function_privilege('authenticated','axtn_case_capacity(uuid,text,jsonb)','EXECUTE')
    OR has_function_privilege('service_role',
      'axtn_local_table_upsert_before_capacity(uuid,text,text,text,jsonb)','EXECUTE')
  THEN RAISE EXCEPTION 'Private/browser delegate exposed'; END IF;
  RAISE NOTICE 'PASS: actual service-role direct row/LocalTable/audit bypass denial and private delegate';
END;
$$;
RESET ROLE;
GRANT SELECT ON capacity_fixture TO authenticated;
DO $$
DECLARE fixture capacity_fixture%ROWTYPE;
BEGIN
  SELECT * INTO fixture FROM capacity_fixture;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',fixture.other_id,'role','authenticated')::text,true);
END;
$$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE fixture capacity_fixture%ROWTYPE;
BEGIN
  SELECT * INTO fixture FROM capacity_fixture;
  IF EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=fixture.dataset_id)
    OR EXISTS(SELECT 1 FROM user_data_tables WHERE id=fixture.dataset_id)
  THEN RAISE EXCEPTION 'Generic table grant exposed private calendar/capacity'; END IF;
  RAISE NOTICE 'PASS: real authenticated generic table grant exposes neither capacity rows nor private calendar dataset';
END;
$$;
RESET ROLE;
ROLLBACK;
