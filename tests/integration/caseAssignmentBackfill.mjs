import { readFile } from "node:fs/promises";
import { query } from "./documentTestDatabase.mjs";

const migration = await readFile(
  new URL("../../supabase/migrations/20261005200000_case_responsibility.sql", import.meta.url),
  "utf8",
);
await query(`BEGIN;
  INSERT INTO knowledge_bases(id,user_id,name,is_sample)
    VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
    ON CONFLICT(id) DO NOTHING;
  CREATE TEMP TABLE legacy_assignment_fixture(owner_id uuid,dataset_id uuid,root_id uuid,child_id uuid);
  CREATE TEMP TABLE legacy_assignment_snapshot(row_id bigint PRIMARY KEY,value jsonb);
  DO $fixture$
  DECLARE actor uuid:=gen_random_uuid(); dataset uuid:=gen_random_uuid(); root uuid:=gen_random_uuid();
    child jsonb;
  BEGIN
    INSERT INTO auth.users(id,email,invited_at) VALUES(actor,actor||'@assignment-backfill.invalid',now());
    INSERT INTO user_data_tables(id,user_id,name,source_filename,columns,is_sample)
      VALUES(dataset,actor,'axtn_cases','Synthetic pre-assignment Case dataset','[]',false);
    INSERT INTO user_data_rows(table_id,row) VALUES(dataset,jsonb_build_object(
      'case_id',root,'subject','Synthetic legacy manual root','status','OPEN','priority',3,
      'case_version',1,'source_kind','manual','source_id',actor,
      'references',jsonb_build_array(jsonb_build_object('kind','evidence',
        'repository','aXtn/aXtn-agentswarms','id','tests/integration/caseAssignmentBackfill.mjs',
        'revision',repeat('a',40)))));
    child:=axtn_case_work(actor,'ensure',jsonb_build_object(
      'sourceId','synthetic-legacy-child:'||actor,'subject','Synthetic legacy Work child',
      'caseType','DEVELOPMENT_VERIFY','parentCaseId',root,
      'workContractRef',jsonb_build_object('kind','contract','repository','aXtn/aXtn-agentswarms',
        'id','tests/integration/caseAssignmentBackfill.mjs','revision',repeat('a',40)),
      'scenarioClass','regression','scenarioId','synthetic-backfill',
      'processingMode','DETERMINISTIC','executionChannel','COPILOT_CLI','actorRef',actor,
      'requiredDependencies','[]'::jsonb,'references','[]'::jsonb,
      '_principal',jsonb_build_object('kind','user_session','id',actor)));
    INSERT INTO legacy_assignment_fixture VALUES(actor,dataset,root,(child->>'case_id')::uuid);
    INSERT INTO legacy_assignment_snapshot SELECT id,row FROM user_data_rows WHERE table_id=dataset;
  END;
  $fixture$;
  ${migration}
  DO $proof$
  DECLARE fields text[]:=ARRAY['responsible_principal_type','responsible_principal_id','assignee_user_id',
    'assignment_policy','assignment_inheritance','assignment_version','assignment_updated_at',
    'assignment_updated_by','semantic_route_mode','semantic_route_provider_id',
    'semantic_route_model_id','semantic_route_version'];
  BEGIN
    IF EXISTS(SELECT 1 FROM legacy_assignment_snapshot s LEFT JOIN user_data_rows r ON r.id=s.row_id
      WHERE r.id IS NULL OR r.row-fields IS DISTINCT FROM s.value)
      OR (SELECT count(*) FROM user_data_rows WHERE table_id=(SELECT dataset_id FROM legacy_assignment_fixture))<>2
    THEN RAISE EXCEPTION 'Backfill changed identity, lineage, evidence, content or copied rows'; END IF;
    IF EXISTS(SELECT 1 FROM user_data_rows r CROSS JOIN legacy_assignment_fixture f
      WHERE r.table_id=f.dataset_id AND (r.row->>'responsible_principal_id'<>f.owner_id::text
        OR r.row->>'assignment_version'<>'1'))
      OR NOT EXISTS(SELECT 1 FROM audit_events a CROSS JOIN legacy_assignment_fixture f
        WHERE a.user_id=f.owner_id AND a.resource_id=f.child_id
          AND a.action='axtn_case_assignment.NATIVE_BACKFILL_INHERITED'
          AND a.detail->'from'->>'responsible_principal_type'='SYSTEM'
          AND a.detail->'to'->>'responsible_principal_id'=f.owner_id::text)
      OR NOT EXISTS(SELECT 1 FROM user_data_tables t CROSS JOIN legacy_assignment_fixture f
        CROSS JOIN LATERAL jsonb_array_elements(t.columns) c WHERE t.id=f.dataset_id
          AND c->>'name'='assignment_version')
    THEN RAISE EXCEPTION 'Backfill defaults/inheritance/final audit/schema metadata failed'; END IF;
  END;
  $proof$;
  ROLLBACK;`);
console.log(
  "PASS: actual additive responsibility migration on pre-existing native manual/Work Cases preserves row IDs, Case IDs, custody, parent lineage, immutable work identity and evidence byte-for-byte; final inherited assignment and schema metadata are audited; isolated migration transaction rolled back",
);
