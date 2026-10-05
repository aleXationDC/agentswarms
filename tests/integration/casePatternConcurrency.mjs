import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "./documentTestDatabase.mjs";

const owner = randomUUID();
const human = { kind: "user_session", id: owner };
const sql = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const artifact = {
  kind: "contract",
  repository: "aXtn/aXtn-agentswarms",
  id: "tests/integration/casePatternConcurrency.mjs",
  revision: "a".repeat(40),
};
const call = async (operation, payload) =>
  JSON.parse(
    await query(
      `SELECT axtn_case_pattern('${owner}','${operation}',${sql({ ...payload, _principal: human })});`,
    ),
  );
try {
  await query(
    `INSERT INTO auth.users(id,email,invited_at) VALUES('${owner}','${owner}@pattern.invalid',now());`,
  );
  const root = JSON.parse(
    await query(
      `SELECT axtn_case_manual('${owner}','create',${sql({
        row: {
          subject: "Synthetic Pattern races",
          status: "OPEN",
          priority: 3,
          source_kind: "manual",
          source_id: owner,
        },
        expectedVersion: 0,
        transitionKey: `root:${owner}`,
        _principal: human,
      })});`,
    ),
  );
  const usage = {
    caseId: root.case_id,
    usageId: randomUUID(),
    transitionKey: `usage:${owner}`,
    expectedVersion: 0,
    artifact,
    purpose: "CAPABILITY_UPLIFT",
    rClass: "R1",
    eClass: "E0",
    iClass: "I0",
    outcome: "NEGATIVE",
    evidence: [{ ...artifact, kind: "evidence" }],
  };
  const replays = await Promise.all(Array.from({ length: 16 }, () => call("pattern_usage", usage)));
  assert.ok(replays.every((item) => JSON.stringify(item) === JSON.stringify(replays[0])));
  const { artifact: _artifact, outcome: _outcome, purpose: _purpose, ...assurance } = usage;
  const races = await Promise.allSettled(
    Array.from({ length: 16 }, (_, index) =>
      call("pattern_assurance", {
        ...assurance,
        expectedVersion: 1,
        rClass: "R2",
        transitionKey: `assure:${owner}:${index}`,
      }),
    ),
  );
  assert.equal(races.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(
    races.filter(
      (item) =>
        item.status === "rejected" && item.reason.message.includes("CASE_PATTERN_VERSION_CONFLICT"),
    ).length,
    15,
  );
  const improvement = {
    caseId: root.case_id,
    usageId: usage.usageId,
    expectedVersion: 2,
    transitionKey: `improve:${owner}`,
    hypothesis: "REWORK",
    scenarioClass: "synthetic_acceptance",
    signal: { ...artifact, kind: "evidence" },
  };
  const candidates = await Promise.all(
    Array.from({ length: 16 }, () => call("pattern_improvement", improvement)),
  );
  assert.ok(candidates.every((item) => JSON.stringify(item) === JSON.stringify(candidates[0])));
  assert.equal(candidates[0].promotionEnabled, false);
  const view = await call("pattern_view", { caseId: root.case_id, offset: 0, limit: 1 });
  assert.equal(view.total, 1);
  assert.equal(view.usages[0].version, 3);
  assert.equal(view.usages[0].outcome, "NEGATIVE");
  const counts = JSON.parse(
    await query(`SELECT jsonb_build_object(
    'events',(SELECT count(*) FROM audit_events WHERE user_id='${owner}' AND action LIKE 'axtn_case_pattern.%'),
    'candidates',(SELECT count(*) FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id='${owner}' AND t.name='axtn_cases' AND r.row->>'case_type'='DEVELOPMENT_IMPROVEMENT_CANDIDATE'));`),
  );
  assert.deepEqual(counts, { events: 3, candidates: 1 });
  console.log(
    "PASS: 48 independent Pattern sessions: usage replay, one-winner optimistic assurance, same native Improvement Work under concurrent replay; durable versions/audit and no promotion/Acceptance",
  );
} finally {
  await query(`DELETE FROM audit_events WHERE user_id='${owner}';
    DELETE FROM user_data_rows WHERE table_id IN (SELECT id FROM user_data_tables WHERE user_id='${owner}');
    DELETE FROM user_data_tables WHERE user_id='${owner}';
    DELETE FROM auth.users WHERE id='${owner}';`);
}
