import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { query } from "./documentTestDatabase.mjs";

export async function testCandidateFixture(
  onCandidate = async () => {},
  patternRevision = "e".repeat(64),
) {
  const owner = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const quote = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
  const principal = { kind: "user_session", id: owner };
  const evidence = {
    kind: "evidence",
    repository: "aXtn/aXtn-agentswarms",
    id: "tests/integration/documentCandidateConcurrency.mjs",
    revision: "a".repeat(40),
  };
  const secondEvidence = { ...evidence, id: "tests/unit/documentCandidate.test.ts" };
  for (const table of ["auth.users", "public.user_data_tables", "public.audit_events"])
    assert.equal(
      await query(
        `SELECT count(*) FROM ${table} WHERE ${table === "auth.users" ? "id" : "user_id"}='${owner}';`,
      ),
      "0",
      "The dedicated isolated Candidate fixture must not preexist.",
    );
  await query(`
  INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
    VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms How-To Guide',true)
    ON CONFLICT(id) DO NOTHING;
  INSERT INTO auth.users(id,aud,role,email)
    VALUES('${owner}','authenticated','authenticated','dms-candidate-fixture@example.invalid');
`);
  const call = async (operation, payload) =>
    JSON.parse(
      await query(`SET ROLE service_role;
    SELECT axtn_case_document('${owner}','${operation}',${quote(payload)});`),
    );
  const rows = async () =>
    query(`SELECT jsonb_agg(row ORDER BY id) FROM user_data_rows WHERE table_id IN
    (SELECT id FROM user_data_tables WHERE user_id='${owner}');`);
  const auditCount = () => query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}';`);
  const denied = async (operation, payload, error) => {
    const before = await rows();
    const audit = await auditCount();
    await assert.rejects(call(operation, payload), error);
    assert.equal(
      await rows(),
      before,
      "Denial must not mutate Candidate, Feedback, Approval or Case.",
    );
    assert.equal(await auditCount(), audit, "Denial must not append a success audit.");
  };
  try {
    let state = await call("document_ensure", {
      businessRequestId: "candidate-native-concurrency",
      caseType: "DOCUMENT_PROCESSING",
      workContractRef: { ...evidence, kind: "contract" },
      scenarioClass: "regression",
      scenarioId: "candidate-native-concurrency",
      processingMode: "HUMAN",
      executionChannel: "HUMAN",
      inputManifest: {
        sourceKind: "fixture",
        sourceRef: "fixture:candidate-concurrency",
        sourceRevision: '"etag:0001"',
        contentHash: "a".repeat(64),
        privacyStatus: "ELIGIBLE",
        privacyRevision: "f".repeat(64),
      },
      deliveryId: "candidate-native-concurrency",
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
      transitionKey: "candidate-fixture-start",
      references: [],
      _principal: principal,
    });
    const parentWhere = `table_id IN(SELECT id FROM user_data_tables WHERE user_id='${owner}' AND name='axtn_cases')
    AND row->>'case_id'='${state.case_id}'`;
    const proposal = {
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
      family: "fixture-family",
      operation: "CLASSIFY",
      target: null,
      automationMode: "ASSISTED",
      evidence: [evidence],
      decisionRevision: "c".repeat(64),
      _principal: principal,
    };
    const decision = await call("document_propose", proposal);
    const feedbackPayload = {
      schemaVersion: "document-feedback-v1",
      eventId: randomUUID(),
      caseId: state.case_id,
      decisionId: decision.decision_id,
      decisionRevision: decision.revision,
      attemptId: state.attempt_id,
      inputHash: state.input_hash,
      sourceRevision: state.document_input.sourceRevision,
      eventType: "VERIFIED_CORRECT",
      before: { family: "fixture-family", targetId: null },
      after: { family: "fixture-family", targetId: null },
      reasonCode: "HUMAN_CONFIRMED",
      supersedesEventId: null,
      evidence: [evidence],
      feedbackRevision: "d".repeat(64),
      _principal: principal,
    };
    const feedback = await call("document_feedback", feedbackPayload);
    const candidate = {
      schemaVersion: "document-learning-candidate-v1",
      candidateId: randomUUID(),
      caseId: state.case_id,
      decisionId: decision.decision_id,
      decisionRevision: decision.revision,
      attemptId: state.attempt_id,
      inputHash: state.input_hash,
      baseline: { ...evidence, kind: "repository" },
      feedback: [{ eventId: feedback.feedback_id, revision: feedback.revision }],
      hypothesis: "MATCH_TOO_NARROW",
      risks: ["FAMILY_REGRESSION", "PRIVACY_LEAKAGE"],
      testProfile: { ...evidence, kind: "contract" },
      changeManifest: {
        schemaVersion: "document-rule-change-v1",
        patternId: "fixture-rule",
        patternRevision,
        conditionChanges: [
          { index: 0, matchMode: "fuzzy", maxDeviationPercent: 10 },
          { index: 1, matchMode: "exact", maxDeviationPercent: 0 },
        ],
        family: "fixture-family",
        targetId: null,
        sourceKind: "fixture",
        operation: "CLASSIFY",
        enabled: false,
      },
      evidence: [evidence, secondEvidence],
      candidateRevision: "e".repeat(64),
      _principal: principal,
    };
    await denied("document_candidate", candidate, /DOCUMENT_CANDIDATE_PROTECTED_PRIVACY_REQUIRED/);
    // Explicit privileged synthetic receipt fixture; not a runtime coverage/privacy proof.
    await query(`UPDATE user_data_rows SET row=row||jsonb_build_object(
    'verified_privacy_status','ELIGIBLE','privacy_evidence_revision','${"f".repeat(64)}') WHERE ${parentWhere};`);
    const originalParent = await query(`SELECT row FROM user_data_rows WHERE ${parentWhere};`);
    for (const [change, error] of [
      [{ enabled: true }, /DOCUMENT_CANDIDATE_REGISTERED_CONTRACT_REQUIRED/],
      [{ candidateRevision: "wrong" }, /DOCUMENT_CANDIDATE_REVISION_REQUIRED/],
      [{ attemptId: randomUUID() }, /DOCUMENT_CANDIDATE_CURRENT_CASE_SCOPE_REQUIRED/],
      [{ inputHash: "0".repeat(64) }, /DOCUMENT_CANDIDATE_CURRENT_CASE_SCOPE_REQUIRED/],
      [
        { _principal: { kind: "user_session", id: randomUUID() } },
        /DOCUMENT_PRINCIPAL_OWNER_DENIED/,
      ],
      [
        { _principal: { kind: "swarm", id: owner } },
        /DOCUMENT_CANDIDATE_CURRENT_CASE_SCOPE_REQUIRED/,
      ],
      [
        { feedback: [{ eventId: feedback.feedback_id, revision: "0".repeat(64) }] },
        /DOCUMENT_CANDIDATE_VERIFIED_FEEDBACK_REQUIRED/,
      ],
      [
        { feedback: [...candidate.feedback, ...candidate.feedback] },
        /DOCUMENT_CANDIDATE_VERIFIED_FEEDBACK_REQUIRED/,
      ],
      [{ risks: ["IGNORE_PRIVACY"] }, /DOCUMENT_CANDIDATE_TEST_PROFILE_REQUIRED/],
      [
        { testProfile: { ...candidate.testProfile, revision: "short" } },
        /DOCUMENT_CANDIDATE_TEST_PROFILE_REQUIRED/,
      ],
      [
        { baseline: { ...candidate.baseline, repository: "aXtn/foreign" } },
        /DOCUMENT_CANDIDATE_PROVENANCE_REQUIRED/,
      ],
      [
        { evidence: [{ ...evidence, id: "https://outside.invalid/original" }] },
        /DOCUMENT_CANDIDATE_MINIMIZED_EVIDENCE_REQUIRED/,
      ],
      ...[
        { enabled: true },
        { operation: "DELETE" },
        { family: "original body text" },
        { prompt: "leak-marker" },
        {
          conditionChanges: [
            { ...candidate.changeManifest.conditionChanges[0], value: "original body" },
          ],
        },
        { conditionChanges: [{ index: 32, matchMode: "exact", maxDeviationPercent: 0 }] },
      ].map((change) => [
        { changeManifest: { ...candidate.changeManifest, ...change } },
        /DOCUMENT_CANDIDATE_BOUNDED_MANIFEST_REQUIRED/,
      ]),
      [
        { changeManifest: { ...candidate.changeManifest, sourceKind: "mail" } },
        /DOCUMENT_CANDIDATE_CURRENT_CASE_SCOPE_REQUIRED/,
      ],
      [
        { changeManifest: { ...candidate.changeManifest, family: "unconfirmed" } },
        /DOCUMENT_CANDIDATE_CONFIRMED_ASSIGNMENT_CONFLICT/,
      ],
    ])
      await denied("document_candidate", { ...candidate, ...change }, error);

    const observed = await call("document_feedback", {
      ...feedbackPayload,
      eventId: randomUUID(),
      eventType: "UNVERIFIED",
      reasonCode: "UNVERIFIED_OBSERVATION",
    });
    await denied(
      "document_candidate",
      {
        ...candidate,
        feedback: [{ eventId: observed.feedback_id, revision: observed.revision }],
      },
      /DOCUMENT_CANDIDATE_VERIFIED_FEEDBACK_REQUIRED/,
    );

    for (const status of ["NO_AI", "UNRESOLVED"]) {
      await query(
        `UPDATE user_data_rows SET row=jsonb_set(row,'{verified_privacy_status}',to_jsonb('${status}'::text)) WHERE ${parentWhere};`,
      );
      await denied(
        "document_candidate",
        candidate,
        /DOCUMENT_CANDIDATE_PROTECTED_PRIVACY_REQUIRED/,
      );
    }
    await query(`UPDATE user_data_rows SET row=row||jsonb_build_object(
    'verified_privacy_status','ELIGIBLE','privacy_evidence_revision','${"0".repeat(64)}') WHERE ${parentWhere};`);
    await denied("document_candidate", candidate, /DOCUMENT_CANDIDATE_PROTECTED_PRIVACY_REQUIRED/);
    await query(`UPDATE user_data_rows SET row=row||jsonb_build_object(
    'privacy_evidence_revision','${"f".repeat(64)}') WHERE ${parentWhere};`);
    const exception = await call("document_feedback", {
      ...feedbackPayload,
      eventId: randomUUID(),
      eventType: "EXCEPTION",
      reasonCode: "SOURCE_EXCEPTION",
    });
    const correctionPayload = {
      ...feedbackPayload,
      eventId: randomUUID(),
      eventType: "CORRECTION",
      reasonCode: "WRONG_FAMILY",
      supersedesEventId: exception.feedback_id,
      after: { family: "fixture-second", targetId: null },
      feedbackRevision: "0".repeat(64),
    };
    const correction = await call("document_feedback", correctionPayload);
    await denied(
      "document_candidate",
      candidate,
      /DOCUMENT_CANDIDATE_CONFIRMED_ASSIGNMENT_CONFLICT/,
    );
    await call("document_feedback", {
      ...correctionPayload,
      eventId: randomUUID(),
      supersedesEventId: correction.feedback_id,
      before: correction.document_feedback.after,
      after: feedback.document_feedback.after,
      feedbackRevision: "1".repeat(64),
    });
    await denied(
      "document_candidate",
      {
        ...candidate,
        feedback: [{ eventId: exception.feedback_id, revision: exception.revision }],
      },
      /DOCUMENT_CANDIDATE_VERIFIED_FEEDBACK_REQUIRED/,
    );
    const settled = await Promise.allSettled(
      Array.from({ length: 16 }, (_, index) =>
        call("document_candidate", {
          ...candidate,
          candidateId: randomUUID(),
          risks: index % 2 ? [...candidate.risks].reverse() : candidate.risks,
          evidence: index % 2 ? [secondEvidence, evidence, evidence] : candidate.evidence,
          changeManifest: {
            ...candidate.changeManifest,
            conditionChanges:
              index % 2
                ? [...candidate.changeManifest.conditionChanges].reverse()
                : candidate.changeManifest.conditionChanges,
          },
        }),
      ),
    );
    for (const result of settled)
      assert.equal(
        result.status,
        "fulfilled",
        result.status === "rejected" ? String(result.reason) : "",
      );
    const responses = settled.map((result) => result.value);
    const stored = responses[0];
    for (const result of responses) assert.deepEqual(result, stored);
    const replay = {
      ...stored.document_learning_candidate,
      candidateRevision: stored.revision,
      _principal: principal,
    };
    assert.deepEqual(await call("document_candidate", replay), stored);
    await denied(
      "document_candidate",
      { ...replay, candidateRevision: "0".repeat(64) },
      /DOCUMENT_CANDIDATE_IMMUTABLE/,
    );
    assert.equal(
      await query(`SELECT count(*) FROM user_data_rows WHERE table_id IN
    (SELECT id FROM user_data_tables WHERE user_id='${owner}' AND name='axtn_cases')
    AND row->>'case_type'='DOCUMENT_IMPROVEMENT_CANDIDATE';`),
      "1",
    );
    const child = JSON.parse(
      await query(`SELECT row FROM user_data_rows WHERE table_id IN
    (SELECT id FROM user_data_tables WHERE user_id='${owner}' AND name='axtn_cases')
    AND row->>'case_id'='${stored.improvement_case_id}';`),
    );
    assert.equal(child.status, "NEW");
    assert.equal(child.parent_case_id, state.case_id);
    assert.equal(child.input_hash, state.input_hash);
    assert.equal(stored.enabled, false);
    assert.equal(
      await query(`SELECT row FROM user_data_rows WHERE ${parentWhere};`),
      originalParent,
    );
    assert.equal(
      await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}'
    AND action='axtn_work.DOCUMENT_CANDIDATE_CREATED';`),
      "1",
    );
    assert.deepEqual(
      await call("document_candidates", { caseId: state.case_id, _principal: principal }),
      [stored],
    );
    await onCandidate({ stored, state, call, denied, query, owner, principal, quote });
    for (const sql of [
      `UPDATE user_data_rows SET row=row||'{"enabled":true}'::jsonb WHERE table_id IN
      (SELECT id FROM user_data_tables WHERE user_id='${owner}' AND name='axtn_document_learning_candidates')`,
      `DELETE FROM user_data_tables WHERE user_id='${owner}' AND name='axtn_document_learning_candidates'`,
      `UPDATE user_data_tables SET name='learning-shadow' WHERE user_id='${owner}' AND name='axtn_document_learning_candidates'`,
      `INSERT INTO user_data_rows(table_id,row) SELECT id,'{"candidate_id":"marker-omitted"}'::jsonb
      FROM user_data_tables WHERE user_id='${owner}' AND name='axtn_document_learning_candidates'`,
      `INSERT INTO user_data_tables(user_id,name,columns) VALUES('${owner}','axtn_document_learning_candidates','[]'::jsonb)`,
    ])
      await assert.rejects(
        query(`SET ROLE service_role; ${sql};`),
        /DOCUMENT_FEEDBACK_NATIVE_CONTRACT_REQUIRED/,
      );
    await assert.rejects(
      query(`SET ROLE service_role; SELECT * FROM axtn_local_table_upsert(
    '${owner}','axtn_document_learning_candidates','candidate_id','${stored.candidate_id}',${quote(stored)});`),
      /DOCUMENT_LEARNING_NATIVE_CONTRACT_REQUIRED/,
    );
    await assert.rejects(
      query(`SET ROLE service_role; SELECT axtn_case_document_before_candidate(
    '${owner}','document_candidates',${quote({ caseId: state.case_id, _principal: principal })});`),
      /permission denied/,
    );
    await assert.rejects(
      query(`SET ROLE authenticated;
    SELECT set_config('request.jwt.claims','{"sub":"${owner}","role":"authenticated"}',false);
    UPDATE user_data_rows SET row=row||'{"enabled":true}'::jsonb WHERE table_id IN(
      SELECT id FROM user_data_tables WHERE user_id='${owner}' AND name='axtn_document_learning_candidates');`),
      /DOCUMENT_FEEDBACK_NATIVE_CONTRACT_REQUIRED/,
    );
    for (const role of ["anon", "authenticated"])
      assert.equal(
        await query(`SELECT has_function_privilege('${role}',
      'public.axtn_case_document(uuid,text,jsonb)','EXECUTE');`),
        "f",
      );

    // Changing responsibility/Attempt does not erase verified historical Feedback
    // or create a second independently identical Improvement Child.
    state = await call("document_transition", {
      caseId: state.case_id,
      attemptId: state.attempt_id,
      inputHash: state.input_hash,
      eventType: "RELEASE",
      reasonCode: "FIXTURE_RELEASE",
      transitionKey: "candidate-release",
      processingMode: "DETERMINISTIC",
      executionChannel: "SWARM",
      references: [],
      _principal: principal,
    });
    const swarmId = randomUUID();
    const keyId = randomUUID();
    await query(`INSERT INTO swarms(id,user_id,name,nodes,edges)
    VALUES('${swarmId}','${owner}','Isolated inactive Candidate key fixture','[]'::jsonb,'[]'::jsonb);
    INSERT INTO swarm_api_keys(id,user_id,swarm_id,name,key_hash,key_prefix,scopes)
    VALUES('${keyId}','${owner}','${swarmId}','Nonfunctional isolated key fixture',
      '${"f".repeat(64)}','fixture',ARRAY['cases']);`);
    const machine = { kind: "swarm_api_key", id: keyId };
    state = await call("document_transition", {
      caseId: state.case_id,
      attemptId: state.attempt_id,
      inputHash: state.input_hash,
      eventType: "STARTED",
      reasonCode: "FIXTURE_MACHINE_START",
      transitionKey: "candidate-machine-start",
      references: [],
      _principal: machine,
    });
    assert.deepEqual(
      await call("document_candidate", {
        ...candidate,
        candidateId: randomUUID(),
        attemptId: state.attempt_id,
        _principal: machine,
      }),
      stored,
    );
    assert.equal(
      await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}'
    AND action='axtn_work.DOCUMENT_CANDIDATE_CREATED';`),
      "1",
    );
    for (const mutation of [
      "scopes=ARRAY['run']",
      "scopes=ARRAY['cases'],expires_at=now()-interval '1 second'",
      "expires_at=NULL,revoked_at=now()",
    ]) {
      await query(`UPDATE swarm_api_keys SET ${mutation} WHERE id='${keyId}';`);
      await denied(
        "document_candidate",
        { ...candidate, _principal: machine },
        /DOCUMENT_CASE_KEY_DENIED/,
      );
      await denied(
        "document_candidates",
        { caseId: state.case_id, _principal: machine },
        /DOCUMENT_CASE_KEY_DENIED/,
      );
    }
    await query(
      `UPDATE swarm_api_keys SET scopes=ARRAY['cases'],expires_at=NULL,revoked_at=NULL WHERE id='${keyId}';`,
    );
    await call("document_propose", {
      ...proposal,
      decisionId: randomUUID(),
      decisionRevision: "0".repeat(64),
      attemptId: state.attempt_id,
      _principal: machine,
    });
    await denied(
      "document_candidate",
      {
        ...candidate,
        candidateId: randomUUID(),
        attemptId: state.attempt_id,
        _principal: machine,
      },
      /DOCUMENT_CANDIDATE_VERIFIED_FEEDBACK_REQUIRED/,
    );
    assert.deepEqual(
      await call("document_candidate", replay),
      stored,
      "Exact replay remains readback-only after Decision drift.",
    );
  } finally {
    await query(`BEGIN; DELETE FROM public.swarm_api_keys WHERE user_id='${owner}';
    DELETE FROM public.swarms WHERE user_id='${owner}';
    DELETE FROM public.user_data_tables WHERE user_id='${owner}';
    DELETE FROM auth.users WHERE id='${owner}';
    DELETE FROM public.audit_events WHERE user_id='${owner}'; COMMIT;`);
  }
  console.log(
    "PASS: actual 16-session Candidate/content dedup, one immutable NEW Child/audit, lost-response readback, protected privacy/verified feedback/current fences, direct-role/broker denial and same Child across responsibility handoff.",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await testCandidateFixture();
