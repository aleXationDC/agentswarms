\set ON_ERROR_STOP on
BEGIN;
SET LOCAL statement_timeout='30s';
INSERT INTO knowledge_bases(id,user_id,name,is_sample)
  VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
  ON CONFLICT(id) DO NOTHING;
CREATE TEMP TABLE processing_fixture(owner_id uuid,case_id uuid,dataset_id uuid,legacy_id uuid);
DO $$
DECLARE owner uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); human jsonb; machine jsonb;
  root jsonb; child jsonb; parent jsonb; result jsonb; replay jsonb; request jsonb;
  dataset uuid; foreign_parent jsonb; before_count bigint; legacy_id uuid:=gen_random_uuid(); i integer;
BEGIN
  INSERT INTO auth.users(id,email,invited_at) VALUES(
    owner,owner::text||'@pilot.invalid',now()),(other,other::text||'@pilot.invalid',now());
  human:=jsonb_build_object('kind','user_session','id',owner);
  machine:=jsonb_build_object('kind','swarm','id',owner);
  request:=jsonb_build_object('row',jsonb_build_object('subject','Synthetic Processing',
    'case_type','TODO','status','NEW','priority',3,'source_kind','manual','source_id',owner,
    'external_ref_id','0001 Ä','external_environment_id','Fixture A'),
    'transitionKey','manual-root','expectedVersion',0,'_principal',human);
  root:=axtn_case_manual(owner,'create',request);
  IF root->>'external_ref_id'<>'0001 Ä' OR root->>'case_version'<>'1'
    OR axtn_case_manual(owner,'create',request) IS DISTINCT FROM root
  THEN RAISE EXCEPTION 'Atomic create/triple/generated identity/replay failed'; END IF;
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=owner AND name='axtn_cases';
  request:=jsonb_build_object('caseId',root->>'case_id','expectedVersion',0,'transitionKey','processing-root',
    'reasonCode','SYNTHETIC_TEST','patch',jsonb_build_object('processing_stage','WAITING_EXTERNAL_CAPABILITY',
      'required_capability_ref',jsonb_build_object('kind','contract','repository','aXtn/aXtn-agentswarms',
        'id','tests/integration/caseProcessing.sql','revision',repeat('a',40)),
      'primary_pattern_ref',jsonb_build_object('kind','contract','repository','aXtn/aXtn-agentswarms',
        'id','tests/fixtures/foo..bar.mjs','revision',repeat('a',40))),'_principal',human);
  result:=axtn_case_processing(owner,'processing',request);
  IF result->>'waiting_reason'<>'UNKNOWN'
    OR result->>'status'<>'NEW' OR result->>'source_id'<>owner::text
    OR result->>'external_ref_id'<>'0001 Ä'
    OR axtn_case_processing(owner,'processing',request) IS DISTINCT FROM result
  THEN RAISE EXCEPTION 'Native processing changed lifecycle/custody/binding or replay'; END IF;
  before_count:=(SELECT count(*) FROM audit_events WHERE user_id=owner);
  BEGIN
    PERFORM axtn_case_processing(owner,'processing',request||jsonb_build_object(
      'transitionKey','path-traversal','expectedVersion',1,
      'patch',jsonb_build_object('required_capability_ref',jsonb_build_object(
        'kind','contract','repository','aXtn/aXtn-agentswarms','id','tests/../private.sql'))));
    RAISE EXCEPTION 'Parent traversal accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PROCESSING_PATCH_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_processing(owner,'processing',request||
      '{"transitionKey":"stale-processing","expectedVersion":0}');
    RAISE EXCEPTION 'Stale processing accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PROCESSING_VERSION_CONFLICT' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_processing(owner,'processing',request||
      '{"patch":{"accepted":true},"expectedVersion":1}');
    RAISE EXCEPTION 'Processing forged Acceptance';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PROCESSING_PATCH_REQUIRED' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM audit_events WHERE user_id=owner)<>before_count
  THEN RAISE EXCEPTION 'Failed mutation changed audit'; END IF;
  parent:=root;
  FOR i IN 1..128 LOOP
    child:=axtn_case_manual(owner,'create',jsonb_build_object('row',jsonb_build_object(
      'subject','Synthetic depth '||i,'status','OPEN','priority',3,'source_kind','manual','source_id',owner,
      'parent_case_id',parent->>'case_id'),'expectedVersion',0,
      'transitionKey','deep-'||i,'_principal',human));
    IF child ? 'external_ref_id' THEN RAISE EXCEPTION 'External reference inherited'; END IF;
    parent:=child;
  END LOOP;
  result:=axtn_case_processing(owner,'subtree',jsonb_build_object('caseId',root->>'case_id',
    'offset',0,'limit',50,'_principal',human));
  IF result->>'total'<>'129' OR jsonb_array_length(result->'cases')<>50
    OR result->>'complete'<>'false' OR result->'viewRoots'<>jsonb_build_array(root->>'case_id')
    OR result->>'forecastStatus'<>'UNKNOWN' OR result->'consumptionHours'<>'null'::jsonb
    OR result->>'durationCoverage'<>'RECORDED_NATIVE_PROCESSING_EVENTS_ONLY'
    OR (result->'processingDurationHours'->>'WAITING_EXTERNAL_CAPABILITY')::numeric<0
  THEN RAISE EXCEPTION 'Subtree/paging/view-root/full-total/unknown forecast failed'; END IF;
  IF axtn_case_processing(owner,'subtree',jsonb_build_object(
    'caseId',child->>'case_id','offset',0,'limit',50,'_principal',human))->>'total'<>'1'
  THEN RAISE EXCEPTION 'Descendant query leaked ancestors'; END IF;
  BEGIN
    PERFORM axtn_case_manual(owner,'update',jsonb_build_object('row',root||
      jsonb_build_object('parent_case_id',child->>'case_id'),'expectedVersion',1,
      'transitionKey','cycle','_principal',human));
    RAISE EXCEPTION 'Cycle accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT IN ('CASE_PARENT_CYCLE_DENIED','CASE_MANUAL_PROTECTED_FIELD_DENIED') THEN RAISE; END IF;
  END;
  SELECT row INTO root FROM user_data_rows WHERE table_id=dataset AND row->>'case_id'=root->>'case_id';
  BEGIN
    PERFORM axtn_case_manual(owner,'update',jsonb_build_object('row',root||
      jsonb_build_object('parent_case_id',child->>'case_id'),'expectedVersion',1,
      'transitionKey','cycle-current','_principal',human));
    RAISE EXCEPTION 'Current-row cycle accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PARENT_CYCLE_DENIED' THEN RAISE; END IF;
  END;
  foreign_parent:=axtn_case_manual(other,'create',jsonb_build_object('row',jsonb_build_object(
    'subject','Not visible','status','NEW','priority',3,'source_kind','manual','source_id',other),
    'transitionKey','other-root','expectedVersion',0,
    '_principal',jsonb_build_object('kind','user_session','id',other)));
  BEGIN
    PERFORM axtn_case_manual(owner,'update',jsonb_build_object('row',root||
      jsonb_build_object('parent_case_id',foreign_parent->>'case_id'),'expectedVersion',1,
      'transitionKey','foreign','_principal',human));
    RAISE EXCEPTION 'Foreign parent accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_OWNED_PARENT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_case_processing(owner,'subtree',jsonb_build_object(
      'caseId',foreign_parent->>'case_id','offset',0,'limit',50,'_principal',human));
    RAISE EXCEPTION 'Foreign root leaked';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_VIEW_AUTHORIZED_ROOT_REQUIRED' THEN RAISE; END IF;
  END;
  child:=axtn_case_manual(owner,'update',jsonb_build_object(
    'row',child||'{"parent_case_id":null,"status":"CLOSED"}','expectedVersion',1,
    'transitionKey','reparent-close','_principal',human));
  IF child->>'status'<>'CLOSED' OR child->>'closed_at' IS NULL
    OR axtn_case_processing(owner,'subtree',jsonb_build_object('caseId',root->>'case_id',
      'offset',0,'limit',200,'_principal',human))->>'total'<>'128'
  THEN RAISE EXCEPTION 'Atomic reparent/close failed'; END IF;
  child:=axtn_case_manual(owner,'update',jsonb_build_object(
    'row',child||'{"status":"OPEN","status_reason":"Relevant synthetic activity"}',
    'expectedVersion',2,'transitionKey','reopen','_principal',human));
  IF child->>'closed_at' IS NOT NULL THEN RAISE EXCEPTION 'Reopen retained closed_at'; END IF;
  UPDATE user_data_rows SET row=row||'{"processing_mode":"HUMAN"}' WHERE table_id=dataset
    AND row->>'case_id'=root->>'case_id';
  BEGIN
    PERFORM axtn_case_processing(owner,'processing',request||
      jsonb_build_object('expectedVersion',1,'transitionKey','machine-takeover','_principal',machine));
    RAISE EXCEPTION 'Automation crossed Human takeover';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PROCESSING_HUMAN_TAKEOVER_FENCED' THEN RAISE; END IF;
  END;
  INSERT INTO user_data_rows(table_id,row) VALUES(dataset,jsonb_build_object(
    'case_id',legacy_id,'subject','Readable legacy Case','status','NEW','priority',3));
  INSERT INTO user_data_tables(user_id,name,source_filename,columns,is_sample)
    VALUES(owner,'pilot_generic','Synthetic generic compatibility fixture',
      '[{"name":"id","type":"string"},{"name":"case_version","type":"number"},{"name":"external_ref_id","type":"string"},{"name":"processing_stage","type":"string"}]',
      false);
  INSERT INTO processing_fixture VALUES(owner,(root->>'case_id')::uuid,dataset,legacy_id);
  RAISE NOTICE 'PASS: native atomic manual CRUD/triple/generated replay, processing/Capability/history, depth128/paging/multiple roots, cycle/foreign/reparent, close/reopen, no fabricated forecast/Acceptance';
END;
$$;
GRANT SELECT ON processing_fixture TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE fixture processing_fixture%ROWTYPE; generic_dataset uuid;
BEGIN
  SELECT * INTO fixture FROM processing_fixture;
  PERFORM * FROM axtn_local_table_upsert(fixture.owner_id,'pilot_generic','id','one',
    '{"id":"one","case_version":4,"external_ref_id":"ordinary generic data","processing_stage":"unrelated"}');
  SELECT id INTO generic_dataset FROM user_data_tables
    WHERE user_id=fixture.owner_id AND name='pilot_generic';
  UPDATE user_data_rows SET row=row||'{"external_ref_id":"still generic","processing_stage":"ordinary update"}'
    WHERE table_id=generic_dataset;
  IF NOT EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=generic_dataset
    AND row->>'external_ref_id'='still generic' AND row->>'case_version'='4')
  THEN RAISE EXCEPTION 'Case guards broke unrelated generic field names'; END IF;
  BEGIN
    UPDATE user_data_rows SET table_id=generic_dataset WHERE table_id=fixture.dataset_id
      AND row->>'case_id'=fixture.legacy_id::text;
    RAISE EXCEPTION 'Legacy Case moved out of protected custody through generic rows';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PROCESSING_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE user_data_rows SET row=row||'{"status":"CLOSED"}' WHERE table_id=fixture.dataset_id
      AND row->>'case_id'=fixture.legacy_id::text;
    RAISE EXCEPTION 'Legacy Case escaped native atomic contract';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PROCESSING_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE user_data_rows SET row=row||'{"status":"CLOSED"}' WHERE table_id=fixture.dataset_id
      AND row->>'case_id'=fixture.case_id::text;
    RAISE EXCEPTION 'Direct Case mutation accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PROCESSING_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM * FROM axtn_local_table_upsert(fixture.owner_id,'axtn_cases','case_id',
      fixture.case_id::text,jsonb_build_object('case_id',fixture.case_id,'status','CLOSED'));
    RAISE EXCEPTION 'LocalTable bypass accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PROCESSING_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM audit_events WHERE user_id=fixture.owner_id AND action LIKE 'axtn_case_processing.%';
    RAISE EXCEPTION 'Processing history erased';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'CASE_PROCESSING_NATIVE_CONTRACT_REQUIRED' THEN RAISE; END IF;
  END;
  RAISE NOTICE 'PASS: actual service-role direct/manual/LocalTable/history bypass rejected';
END;
$$;
RESET ROLE;
ROLLBACK;
