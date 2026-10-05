import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "./documentTestDatabase.mjs";

const owner = randomUUID();
const human = { kind: "user_session", id: owner };
const sql = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
let caseId;
try {
  await query(`INSERT INTO knowledge_bases(id,user_id,name,is_sample)
    VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
    ON CONFLICT(id) DO NOTHING;
    INSERT INTO auth.users(id,email,invited_at) VALUES('${owner}','${owner}@pilot.invalid',now());`);
  const work = {
    sourceId: `pilot:concurrency:${owner}`,
    subject: "Synthetic pilot concurrency",
    caseType: "DEVELOPMENT_BUILD",
    workContractRef: {
      kind: "contract",
      repository: "aXtn/aXtn-agentswarms",
      id: "tests/integration/caseEnvironmentConcurrency.mjs",
      revision: "a".repeat(40),
    },
    scenarioClass: "regression",
    scenarioId: owner,
    processingMode: "DETERMINISTIC",
    executionChannel: "SWARM",
    actorRef: owner,
    requiredDependencies: [],
    references: [],
    _principal: human,
  };
  caseId = JSON.parse(
    await query(`SELECT axtn_case_work('${owner}','ensure',${sql(work)});`),
  ).case_id;
  const request = {
    caseId,
    transitionKey: `external:${owner}`,
    expectedVersion: 0,
    patch: {
      external_environment_id: "Fixture A",
      external_ref_id: "0001 Ä",
      external_parent_ref_id: "Ticket parent, not a local Case",
    },
    _principal: human,
  };
  const operation = (body) =>
    query(`SELECT axtn_case_environment('${owner}','external_references',${sql(body)});`);
  const replays = await Promise.allSettled(Array.from({ length: 16 }, () => operation(request)));
  assert.ok(
    replays.every((item) => item.status === "fulfilled"),
    "Concurrent same-key replay failed",
  );
  const values = replays.map((item) => JSON.parse(item.value));
  assert.ok(values.every((value) => JSON.stringify(value) === JSON.stringify(values[0])));
  assert.equal(values[0].external_reference_version, 1);
  const races = await Promise.allSettled(
    Array.from({ length: 16 }, (_, i) =>
      operation({
        ...request,
        expectedVersion: 1,
        transitionKey: `race:${owner}:${i}`,
        patch: { external_ref_id: `winner-${i}` },
      }),
    ),
  );
  assert.equal(races.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(
    races.filter(
      (item) =>
        item.status === "rejected" &&
        item.reason.message.includes("CASE_ENVIRONMENT_VERSION_CONFLICT"),
    ).length,
    15,
  );
  const readback = JSON.parse(
    await query(`SELECT jsonb_build_object(
    'rows',(SELECT count(*) FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id='${owner}' AND t.name='axtn_cases' AND r.row->>'case_id'='${caseId}'),
    'version',(SELECT r.row->'external_reference_version' FROM user_data_rows r
      JOIN user_data_tables t ON t.id=r.table_id WHERE t.user_id='${owner}'
        AND t.name='axtn_cases' AND r.row->>'case_id'='${caseId}'),
    'events',(SELECT count(*) FROM audit_events WHERE user_id='${owner}'
      AND action='axtn_case_environment.REFERENCES_CHANGED'));`),
  );
  assert.deepEqual(readback, { rows: 1, version: 2, events: 2 });
  const manualPayload = {
    row: {
      subject: "Synthetic concurrent create",
      status: "NEW",
      priority: 3,
      source_kind: "manual",
      source_id: owner,
      external_ref_id: "0001 Ä",
    },
    expectedVersion: 0,
    transitionKey: `manual:${owner}`,
    _principal: human,
  };
  const manual = (operation, body) =>
    query(`SELECT axtn_case_manual('${owner}','${operation}',${sql(body)});`);
  const creates = await Promise.all(
    Array.from({ length: 16 }, () => manual("create", manualPayload)),
  );
  assert.ok(
    creates.every((value) => value === creates[0]),
    "Same-key create duplicated identity",
  );
  const created = JSON.parse(creates[0]);
  const updates = await Promise.allSettled(
    Array.from({ length: 16 }, (_, i) =>
      manual("update", {
        row: { ...created, status: "OPEN" },
        expectedVersion: 1,
        transitionKey: `manual-race:${owner}:${i}`,
        _principal: human,
      }),
    ),
  );
  assert.equal(updates.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(
    updates.filter(
      (item) =>
        item.status === "rejected" && item.reason.message.includes("CASE_MANUAL_VERSION_CONFLICT"),
    ).length,
    15,
  );
  const processingPayload = {
    caseId,
    expectedVersion: 0,
    transitionKey: `processing:${owner}`,
    patch: { processing_stage: "ACTIVE" },
    reasonCode: "SYNTHETIC_CONCURRENCY",
    _principal: human,
  };
  const processing = (body) =>
    query(`SELECT axtn_case_processing('${owner}','processing',${sql(body)});`);
  const states = await Promise.all(Array.from({ length: 16 }, () => processing(processingPayload)));
  assert.ok(
    states.every((value) => value === states[0]),
    "Same-key processing replay changed state",
  );
  const transitions = await Promise.allSettled(
    Array.from({ length: 16 }, (_, i) =>
      processing({
        ...processingPayload,
        expectedVersion: 1,
        transitionKey: `processing-race:${owner}:${i}`,
        patch: { processing_stage: "WAITING_CUSTOMER", waiting_reason: "CUSTOMER_RESPONSE" },
      }),
    ),
  );
  assert.equal(transitions.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(
    transitions.filter(
      (item) =>
        item.status === "rejected" &&
        item.reason.message.includes("CASE_PROCESSING_VERSION_CONFLICT"),
    ).length,
    15,
  );
  const durable = JSON.parse(
    await query(`SELECT jsonb_build_object(
    'caseCount',(SELECT count(*) FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id='${owner}' AND t.name='axtn_cases'),
    'createEvents',(SELECT count(*) FROM audit_events WHERE user_id='${owner}'
      AND action='axtn_case_processing.MANUAL_CREATE'),
    'processingEvents',(SELECT count(*) FROM audit_events WHERE user_id='${owner}'
      AND action='axtn_case_processing.PROCESSING_CHANGED'),
    'monotonic',(SELECT bool_and(recorded_at>=prior_at OR prior_at IS NULL) FROM (
      SELECT created_at recorded_at,lag(created_at) OVER(ORDER BY
        (detail->>'resultVersion')::integer) prior_at FROM audit_events
      WHERE user_id='${owner}' AND action='axtn_case_processing.PROCESSING_CHANGED'
    ) ordered));`),
  );
  assert.deepEqual(durable, {
    caseCount: 2,
    createEvents: 1,
    processingEvents: 2,
    monotonic: true,
  });
  console.log(
    "PASS: exact external references, generated manual Case identity and processing/history: each 16 independent replay sessions plus 16 optimistic racers/one winner; durable new-session row/version/audit and monotonic server-time readback; no external effect",
  );
} finally {
  await query(`DELETE FROM audit_events WHERE user_id='${owner}';
    DELETE FROM user_data_rows WHERE table_id IN (SELECT id FROM user_data_tables WHERE user_id='${owner}');
    DELETE FROM user_data_tables WHERE user_id='${owner}';
    DELETE FROM auth.users WHERE id='${owner}';`);
}
