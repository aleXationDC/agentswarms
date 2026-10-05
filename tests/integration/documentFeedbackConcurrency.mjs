import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "./documentTestDatabase.mjs";

const owner = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const quote = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const principal = { kind: "user_session", id: owner };
const evidence = {
  kind: "evidence",
  repository: "aXtn/aXtn-agentswarms",
  id: "tests/integration/documentFeedbackConcurrency.mjs",
  revision: "a".repeat(40),
};
const secondEvidence = { ...evidence, id: "tests/integration/documentFeedback.sql" };
for (const table of ["auth.users", "public.user_data_tables", "public.audit_events"]) {
  assert.equal(
    await query(
      `SELECT count(*) FROM ${table} WHERE ${table === "auth.users" ? "id" : "user_id"}='${owner}';`,
    ),
    "0",
    "Isolated feedback fixture owner must not preexist.",
  );
}
await query(`
  INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
    VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms How-To Guide',true)
    ON CONFLICT(id) DO NOTHING;
  INSERT INTO auth.users(id,aud,role,email)
    VALUES('${owner}','authenticated','authenticated','dms-feedback-concurrent@example.invalid');
`);
const call = async (operation, payload) =>
  JSON.parse(
    await query(
      `SET ROLE service_role; SELECT axtn_case_document('${owner}','${operation}',${quote(payload)});`,
    ),
  );
try {
  let state = await call("document_ensure", {
    businessRequestId: "feedback-concurrency",
    caseType: "DOCUMENT_PROCESSING",
    workContractRef: { ...evidence, kind: "contract" },
    scenarioClass: "regression",
    scenarioId: "feedback-concurrency",
    processingMode: "HUMAN",
    executionChannel: "HUMAN",
    inputManifest: {
      sourceKind: "fixture",
      sourceRef: "fixture:feedback-concurrency",
      sourceRevision: '"etag:0001"',
      contentHash: "a".repeat(64),
      privacyStatus: "NO_AI",
    },
    deliveryId: "feedback-concurrency",
    inputHash: "b".repeat(64),
    references: [],
    _principal: principal,
  });
  state = await call("document_transition", {
    caseId: state.case_id,
    attemptId: state.attempt_id,
    inputHash: state.input_hash,
    eventType: "STARTED",
    reasonCode: "HUMAN_FIXTURE",
    transitionKey: "feedback-start",
    references: [],
    _principal: principal,
  });
  const decision = await call("document_propose", {
    schemaVersion: "document-decision-v1",
    decisionId: randomUUID(),
    caseId: state.case_id,
    attemptId: state.attempt_id,
    inputHash: state.input_hash,
    documentId: state.document_id,
    sourceRef: state.document_input.sourceRef,
    sourceRevision: state.document_input.sourceRevision,
    graphRevision: null,
    ruleRevision: null,
    featureSchemaRevision: "document-features-v1",
    family: "fixture",
    operation: "CLASSIFY",
    target: null,
    automationMode: "ASSISTED",
    evidence: [evidence, secondEvidence],
    decisionRevision: "c".repeat(64),
    _principal: principal,
  });
  const event = {
    schemaVersion: "document-feedback-v1",
    eventId: randomUUID(),
    caseId: state.case_id,
    decisionId: decision.decision_id,
    decisionRevision: decision.revision,
    attemptId: state.attempt_id,
    inputHash: state.input_hash,
    sourceRevision: state.document_input.sourceRevision,
    eventType: "VERIFIED_CORRECT",
    before: { family: "fixture", targetId: null },
    after: { family: "fixture", targetId: null },
    reasonCode: "HUMAN_CONFIRMED",
    supersedesEventId: null,
    evidence: [evidence],
    feedbackRevision: "d".repeat(64),
    _principal: principal,
  };
  const settled = await Promise.allSettled(
    Array.from({ length: 16 }, (_, index) =>
      call("document_feedback", {
        ...event,
        eventId: index === 0 ? event.eventId : randomUUID(),
        evidence: index % 2 ? [secondEvidence, evidence, evidence] : [evidence, secondEvidence],
      }),
    ),
  );
  for (const response of settled)
    assert.equal(
      response.status,
      "fulfilled",
      response.status === "rejected" ? String(response.reason) : "",
    );
  const responses = settled.map((response) => response.value);
  for (const response of responses) assert.deepEqual(response, responses[0]);
  const original = responses[0];
  assert.deepEqual(
    await call("document_feedback", {
      ...original.document_feedback,
      feedbackRevision: original.revision,
      _principal: principal,
    }),
    original,
  );
  assert.equal(
    await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}'
    AND action='axtn_work.DOCUMENT_FEEDBACK_RECORDED';`),
    "1",
  );
  const correction = {
    ...event,
    eventType: "CORRECTION",
    reasonCode: "WRONG_FAMILY",
    supersedesEventId: original.feedback_id,
    before: original.document_feedback.after,
    after: { family: "corrected", targetId: null },
    feedbackRevision: "e".repeat(64),
  };
  const corrections = await Promise.allSettled(
    Array.from({ length: 16 }, () =>
      call("document_feedback", { ...correction, eventId: randomUUID() }),
    ),
  );
  for (const response of corrections)
    assert.equal(
      response.status,
      "fulfilled",
      response.status === "rejected" ? String(response.reason) : "",
    );
  const corrected = corrections.map((response) => response.value);
  for (const response of corrected) assert.deepEqual(response, corrected[0]);
  const competing = await Promise.allSettled(
    Array.from({ length: 8 }, (_, index) =>
      call("document_feedback", {
        ...correction,
        eventId: randomUUID(),
        after: { family: `competing-${index}`, targetId: null },
      }),
    ),
  );
  assert(
    competing.every(
      (response) =>
        response.status === "rejected" &&
        String(response.reason).includes("DOCUMENT_FEEDBACK_CONFIRMED_PREDECESSOR_REQUIRED"),
    ),
  );
  assert.equal(
    await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}'
    AND action='axtn_work.DOCUMENT_FEEDBACK_RECORDED';`),
    "2",
  );
  const readback = await call("document_feedback_events", {
    caseId: state.case_id,
    _principal: principal,
  });
  assert.equal(readback.length, 2);
  assert.deepEqual(readback[0], original);
  assert.deepEqual(readback[1], corrected[0]);
  console.log(
    "PASS: actual service-role 16-session feedback dedup, 16-session correction dedup, eight competing successors denied, durable new-session readback and exactly two events/audits.",
  );
} finally {
  await query(`BEGIN;
    DELETE FROM user_data_tables WHERE user_id='${owner}';
    DELETE FROM auth.users WHERE id='${owner}';
    DELETE FROM audit_events WHERE user_id='${owner}';
    COMMIT;`);
}
