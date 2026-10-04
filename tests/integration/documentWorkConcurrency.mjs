import assert from "node:assert/strict";
import { query } from "./documentTestDatabase.mjs";
const owner = "77777777-7777-4777-8777-777777777777";
const work = {
  businessRequestId: "concurrent-request-01",
  caseType: "DOCUMENT_PROCESSING",
  workContractRef: {
    kind: "contract",
    repository: "aXtn/aXtn-agentswarms",
    id: "tests/integration/documentWorkConcurrency.mjs",
    revision: "b".repeat(40),
  },
  scenarioClass: "regression",
  scenarioId: "concurrency-01",
  processingMode: "DETERMINISTIC",
  executionChannel: "SWARM",
  actorRef: owner,
  inputManifest: {
    sourceKind: "fixture",
    sourceRef: "fixture:concurrent-source-01",
    sourceRevision: '"etag:01"',
    contentHash: "c".repeat(64),
    privacyStatus: "NO_AI",
  },
  inputHash: "a".repeat(64),
  deliveryId: "delivery-01",
  references: [],
  _principal: { kind: "swarm", id: owner },
};
const quote = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
for (const table of ["auth.users", "public.user_data_tables", "public.audit_events"]) {
  const column = table === "auth.users" ? "id" : "user_id";
  assert.equal(
    await query(`SELECT count(*) FROM ${table} WHERE ${column}='${owner}';`),
    "0",
    "The isolated Work fixture owner and its evidence must not preexist.",
  );
}
await query(`
  INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
    VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms How-To Guide',true)
    ON CONFLICT(id) DO NOTHING;
  INSERT INTO auth.users(id,aud,role,email)
    VALUES('${owner}','authenticated','authenticated','dms-concurrent@example.invalid')
    ON CONFLICT(id) DO NOTHING;
`);
try {
  const responses = await Promise.all(
    Array.from({ length: 16 }, () =>
      query(`SELECT axtn_case_document('${owner}','document_ensure',${quote(work)});`),
    ),
  );
  const rows = responses.map((response) => JSON.parse(response));
  assert.equal(new Set(rows.map((row) => row.case_id)).size, 1);
  assert.equal(new Set(rows.map((row) => row.document_id)).size, 1);
  assert.match(rows[0].document_id, /^[a-f0-9]{24}$/);
  assert.equal(new Set(rows.map((row) => row.attempt_id)).size, 1);
  assert.equal(
    await query(`
    SELECT count(*) FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id='${owner}' AND t.name='axtn_cases'
        AND r.row->>'source_kind'='document_work';
  `),
    "1",
  );
  assert.equal(
    await query(`
    SELECT count(*) FROM audit_events WHERE user_id='${owner}'
      AND resource_type='axtn_case_work' AND detail ? 'deliveryKey';
  `),
    "1",
  );
  const replay = JSON.parse(
    await query(`SELECT axtn_case_document('${owner}','document_ensure',${quote(work)});`),
  );
  assert.deepEqual(replay, rows[0]);
  console.log(
    "PASS: 16 actual concurrent sessions + lost-response replay preserve one Case, document, attempt and delivery.",
  );
} finally {
  await query(`
    BEGIN;
    DELETE FROM user_data_tables WHERE user_id='${owner}';
    DELETE FROM auth.users WHERE id='${owner}';
    DELETE FROM audit_events WHERE user_id='${owner}';
    COMMIT;
  `);
}
