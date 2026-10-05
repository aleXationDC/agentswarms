\set ON_ERROR_STOP on
BEGIN;
INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
  VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
  ON CONFLICT(id) DO NOTHING;
INSERT INTO auth.users(id,aud,role,email,invited_at) VALUES
  ('11111111-1111-4111-8111-111111111111','authenticated','authenticated','registry-fixture@example.invalid',now()),
  ('22222222-2222-4222-8222-222222222222','authenticated','authenticated','registry-other@example.invalid',now())
  ON CONFLICT(id) DO NOTHING;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  owner uuid := '11111111-1111-4111-8111-111111111111';
  other uuid := '22222222-2222-4222-8222-222222222222';
  first jsonb;
  again jsonb;
  saved jsonb;
  dataset uuid;
  metadata jsonb;
  audit_count bigint;
BEGIN
  first := axtn_seed_document_registries(owner);
  IF jsonb_array_length(first->'datasets')<>3 OR first->>'classificationValuesInserted'<>'6'
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(first->'datasets') d WHERE d->>'created'<>'true')
  THEN RAISE EXCEPTION 'Fresh native Registry seed incomplete'; END IF;
  SELECT id INTO dataset FROM user_data_tables WHERE user_id=owner AND name='axtn_document_registry';
  IF EXISTS(SELECT 1 FROM user_data_rows WHERE table_id=dataset)
  THEN RAISE EXCEPTION 'Seed created business documents'; END IF;
  INSERT INTO user_data_rows(table_id,row) VALUES(dataset,
    '{"record_kind":"document","document_id":"opaque-operator","source_ref":"fixture:operator","operator":"untouched"}');
  SELECT jsonb_agg(row ORDER BY id) INTO saved FROM user_data_rows WHERE table_id=dataset;
  UPDATE user_data_tables SET source_filename='Operator-owned metadata',
    columns=columns||'[{"name":"operator_column","type":"number","extra":{"keep":true}}]'
    WHERE id=dataset;
  SELECT columns INTO metadata FROM user_data_tables WHERE id=dataset;
  SELECT count(*) INTO audit_count FROM audit_events WHERE user_id=owner;
  again := axtn_seed_document_registries(owner);
  IF again->>'classificationValuesInserted'<>'0'
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(again->'datasets') d
      WHERE d->>'created'<>'false' OR d->>'reconciled'<>'false')
    OR (SELECT count(*) FROM audit_events WHERE user_id=owner)<>audit_count
  THEN RAISE EXCEPTION 'Second seed was not a no-op'; END IF;
  IF metadata IS DISTINCT FROM (SELECT columns FROM user_data_tables WHERE id=dataset)
    OR (SELECT source_filename FROM user_data_tables WHERE id=dataset)<>'Operator-owned metadata'
    OR saved IS DISTINCT FROM (SELECT jsonb_agg(row ORDER BY id) FROM user_data_rows WHERE table_id=dataset)
  THEN RAISE EXCEPTION 'Operator data changed'; END IF;
  -- Missing metadata is added without replacing custom entries or documents.
  UPDATE user_data_tables SET columns='[{"name":"operator_column","type":"number"}]' WHERE id=dataset;
  again := axtn_seed_document_registries(owner);
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(again->'datasets') d
    WHERE d->>'name'='axtn_document_registry' AND d->>'reconciled'='true')
    OR NOT EXISTS(SELECT 1 FROM user_data_tables t,jsonb_array_elements(t.columns) c
      WHERE t.id=dataset AND c->>'name'='operator_column' AND c->>'type'='number')
  THEN RAISE EXCEPTION 'Metadata reconciliation lost existing custom column'; END IF;
  again := axtn_seed_document_registries(other);
  IF again->>'classificationValuesInserted'<>'6'
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(first->'datasets') a,
      jsonb_array_elements(again->'datasets') b WHERE a->>'id'=b->>'id')
  THEN RAISE EXCEPTION 'Seed crossed owner scope'; END IF;
  UPDATE user_data_tables SET is_sample=true WHERE id=dataset;
  BEGIN
    PERFORM axtn_seed_document_registries(owner);
    RAISE EXCEPTION 'Sample dataset was repurposed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_REGISTRY_NON_SAMPLE_OWNED_DATASET_REQUIRED' THEN RAISE; END IF;
  END;
  UPDATE user_data_tables SET is_sample=false,columns='{}' WHERE id=dataset;
  BEGIN
    PERFORM axtn_seed_document_registries(owner);
    RAISE EXCEPTION 'Malformed metadata was overwritten';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_REGISTRY_METADATA_INVALID' THEN RAISE; END IF;
  END;
  UPDATE user_data_tables SET columns='[{"name":"source_ref"},{"name":"source_ref"}]' WHERE id=dataset;
  BEGIN
    PERFORM axtn_seed_document_registries(owner);
    RAISE EXCEPTION 'Duplicate metadata was silently accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_REGISTRY_METADATA_INVALID' THEN RAISE; END IF;
  END;
  UPDATE user_data_tables SET columns=metadata WHERE id=dataset;
  SELECT id INTO dataset FROM user_data_tables
    WHERE user_id=owner AND name='axtn_document_classification_values';
  INSERT INTO user_data_rows(table_id,row) VALUES(dataset,'{"kind":"document_type","value":" RECHNUNG "}');
  BEGIN
    PERFORM axtn_seed_document_registries(owner);
    RAISE EXCEPTION 'Ambiguous taxonomy was silently deduplicated';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_REGISTRY_TAXONOMY_AMBIGUOUS' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM axtn_seed_document_registries('33333333-3333-4333-8333-333333333333');
    RAISE EXCEPTION 'Unowned seed accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'DOCUMENT_REGISTRY_AUTHENTICATED_OWNER_REQUIRED' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
  BEGIN
    PERFORM axtn_seed_document_registries('11111111-1111-4111-8111-111111111111');
    RAISE EXCEPTION 'Authenticated caller bypassed bootstrap endpoint';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM axtn_seed_document_registries('11111111-1111-4111-8111-111111111111');
    RAISE EXCEPTION 'Anonymous caller seeded datasets';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
ROLLBACK;
