import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { query } from "./documentTestDatabase.mjs";

const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
assert.match(revision, /^[a-f0-9]{40}$/);
const owner = randomUUID();
const integration = randomUUID();
const principal = { kind: "user_session", id: owner };
const reference = (kind, id) => ({
  kind,
  repository: "aXtn/aXtn-agentswarms",
  id,
  revision,
});
const contract = reference("contract", "tests/fixtures/environment-pattern/portable-skill.json");
const proof = reference("evidence", "tests/integration/environmentPatternLearning.mjs");
const literal = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const call = async (rpc, operation, payload) =>
  JSON.parse(
    await query(
      `SELECT ${rpc}('${owner}','${operation}',${literal({ ...payload, _principal: principal })});`,
    ),
  );
const measurements = [];
try {
  await query(`INSERT INTO auth.users(id,email,invited_at)
    VALUES('${owner}','${owner}@learning.invalid',now());
    INSERT INTO integrations(id,user_id,type,name,is_active,config)
    VALUES('${integration}','${owner}','notification','Synthetic learning ticket fixture',true,'{}');`);
  const root = await call("axtn_case_manual", "create", {
    row: {
      subject: "Synthetic measured native Learning cycle",
      status: "OPEN",
      priority: 3,
      source_kind: "manual",
      source_id: owner,
    },
    expectedVersion: 0,
    transitionKey: "root",
  });
  await call("axtn_case_environment", "environment_binding", {
    integrationId: integration,
    environmentId: "Synthetic measured ticket environment",
    enabled: true,
    expectedVersion: 0,
    transitionKey: "binding",
  });
  const exact = {
    external_environment_id: "Synthetic measured ticket environment",
    external_ref_id: "  0001/Ä  ",
    external_parent_ref_id: "Foreign parent, not a local Case",
  };
  await call("axtn_case_environment", "external_references", {
    caseId: root.case_id,
    patch: exact,
    expectedVersion: 0,
    transitionKey: "references",
  });
  const measure = async (cohort, transform) => {
    const started = performance.now();
    const handedOver = await call("axtn_case_environment", "external_handover", {
      caseId: root.case_id,
      integrationId: integration,
      expectedVersion: 1,
    });
    const observed = transform(handedOver);
    const result = await call("axtn_case_environment", "external_correlate", {
      integrationId: integration,
      ...observed,
    });
    const measurement = {
      cohort,
      sampleSize: 1,
      exactRoundtrip:
        Object.keys(observed).length === Object.keys(exact).length &&
        Object.entries(exact).every(([key, value]) => observed[key] === value),
      status: result.status,
      latencyMs: performance.now() - started,
      payloadBytes: Buffer.byteLength(JSON.stringify(observed)),
    };
    measurements.push(measurement);
    return measurement;
  };
  // An explicitly injected legacy adapter defect, not a claim about production.
  const baseline = await measure("synthetic-fault-injected-baseline", (triple) => ({
    ...triple,
    external_ref_id: triple.external_ref_id.trim(),
  }));
  assert.equal(baseline.status, "NO_MATCH");
  assert.equal(baseline.exactRoundtrip, false);
  const usageId = randomUUID();
  const usage = {
    caseId: root.case_id,
    usageId,
    expectedVersion: 0,
    transitionKey: "negative-signal",
    artifact: reference("contract", "tests/integration/environmentPatternLearning.mjs"),
    purpose: "CAPABILITY_UPLIFT",
    outcome: "NEGATIVE",
    rClass: "R1",
    eClass: "E1",
    iClass: "I1",
    evidence: [proof],
  };
  await call("axtn_case_pattern", "pattern_usage", usage);
  const candidate = await call("axtn_case_pattern", "pattern_improvement", {
    caseId: root.case_id,
    usageId,
    expectedVersion: 1,
    transitionKey: "improvement",
    hypothesis: "PATTERN_DRIFT",
    scenarioClass: "synthetic_acceptance",
    signal: proof,
  });
  assert.equal(candidate.promotionEnabled, false);
  const transition = (eventType, transitionKey, reasonCode, extra = {}) =>
    call("axtn_case_work", "transition", {
      caseId: candidate.improvementCaseId,
      eventType,
      transitionKey,
      reasonCode,
      actorRef: owner,
      references: [proof],
      ...extra,
    });
  await assert.rejects(
    transition("STARTED", "before-authorization", "SYNTHETIC_INTERVENTION"),
    /Improvement Candidate requires explicit promotion/,
  );
  await transition(
    "PROMOTED",
    "explicit-synthetic-authorization",
    "AUTHORIZED_SYNTHETIC_INTERVENTION",
  );
  await transition("STARTED", "start", "AUTHORIZED_SYNTHETIC_INTERVENTION");

  const verified = await measure("native-exact-reference-intervention", (triple) => triple);
  assert.equal(verified.exactRoundtrip, true);
  assert.equal(verified.status, "MATCHED");
  for (let index = 0; index < 2; index++) {
    const reuse = await measure(`synthetic-reuse-${index + 1}`, (triple) => triple);
    assert.equal(reuse.status, "MATCHED");
    assert.equal(reuse.exactRoundtrip, true);
    const child = await call("axtn_case_manual", "create", {
      row: {
        subject: `Synthetic verified reuse ${index + 1}`,
        parent_case_id: root.case_id,
        status: "OPEN",
        priority: 3,
        source_kind: "manual",
        source_id: owner,
      },
      expectedVersion: 0,
      transitionKey: `reuse-case-${index}`,
    });
    await call("axtn_case_pattern", "pattern_usage", {
      ...usage,
      caseId: child.case_id,
      usageId: randomUUID(),
      artifact: contract,
      outcome: "POSITIVE",
      transitionKey: `positive-reuse-${index}`,
    });
  }
  const measurementHash = createHash("sha256").update(JSON.stringify(measurements)).digest("hex");
  await transition("CANDIDATE_UPDATED", "measured-candidate", "MEASURED_SYNTHETIC_VERIFICATION", {
    candidateSHA: revision,
    references: [proof, reference("evidence", `synthetic-measurement/sha256/${measurementHash}`)],
  });
  const completed = await transition("COMPLETED", "completed", "MEASURED_SYNTHETIC_VERIFICATION");
  assert.equal(completed.status, "CLOSED");
  assert.equal(completed.accepted_sha, undefined);
  const assurance = await call("axtn_case_pattern", "pattern_assurance", {
    caseId: root.case_id,
    usageId,
    expectedVersion: 2,
    transitionKey: "measured-assurance",
    rClass: "R2",
    eClass: "E1",
    iClass: "I1",
    evidence: [proof, reference("evidence", `synthetic-measurement/sha256/${measurementHash}`)],
  });
  assert.equal(assurance.outcome, "NEGATIVE");
  const view = await call("axtn_case_pattern", "pattern_view", {
    caseId: root.case_id,
    offset: 0,
    limit: 50,
  });
  assert.equal(view.total, 3);
  assert.equal(view.acceptanceGranted, false);
  assert.equal(view.roi, null);
  const work = await call("axtn_case_work", "list", {});
  assert.equal(work.cases.filter((row) => row.case_id === candidate.improvementCaseId).length, 1);
  assert.ok(
    work.events.some(
      (event) =>
        event.caseId === candidate.improvementCaseId && event.action === "axtn_work.COMPLETED",
    ),
  );
  console.log(
    JSON.stringify(
      {
        status: "PASS",
        revision,
        measurements,
        measurementHash,
        scope: "SYNTHETIC_FAULT_INJECTION_AND_NATIVE_INTERVENTION",
        promotion: "EXPLICIT_SYNTHETIC_AUTHENTICATED_HUMAN",
        independentAcceptance: "NOT_GRANTED",
        hours: "NOT_MEASURED",
        roi: "UNKNOWN",
      },
      null,
      2,
    ),
  );
} finally {
  await query(`DELETE FROM audit_events WHERE user_id='${owner}';
    DELETE FROM user_data_rows WHERE table_id IN (SELECT id FROM user_data_tables WHERE user_id='${owner}');
    DELETE FROM user_data_tables WHERE user_id='${owner}';
    DELETE FROM integrations WHERE user_id='${owner}';
    DELETE FROM auth.users WHERE id='${owner}';`);
}
