import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testCandidateFixture } from "./documentCandidateConcurrency.mjs";

await testCandidateFixture(
  async ({ stored, state, call, denied, query, owner, principal, quote }) => {
    const family = {
      family: "fixture-family",
      sampleCount: 1,
      predictionCount: 1,
      correctCount: 1,
      precision: 1,
      precisionInterval95: [0.20654931437723745, 1],
      severeWrongTargetCount: 0,
      correctionCount: 0,
      correctionRate: 0,
      exceptionCount: 0,
      exceptionRate: 0,
      abstentionCount: 0,
      coverage: 1,
      estimatedHumanInteractionsPerDocument: 0,
    };
    const metric = {
      families: [family],
      sampleCount: 1,
      macroF1: 1,
      accuracy: 1,
      uncertainty: "BINOMIAL_UNADJUSTED_FOR_WITHIN_SPLIT_GROUPING",
      severeWrongTargetCount: 0,
      abstentionCount: 0,
      elapsedMs: 1,
      modelCalls: 0,
      providerWrites: 0,
      monetaryCost: null,
    };
    const report = {
      schemaVersion: "document-evaluation-evidence-v1",
      candidateId: stored.candidate_id,
      caseId: state.case_id,
      baselineSHA: stored.document_learning_candidate.baseline.revision,
      candidateSHA: "b".repeat(40),
      evaluatorRevision: "c".repeat(64),
      datasetRevision: "d".repeat(64),
      splitRevision: "e".repeat(64),
      featureSchemaRevision: "f".repeat(64),
      vocabularyRevision: "0".repeat(64),
      baselineRuleRevision: "1".repeat(64),
      candidateRuleRevision: "2".repeat(64),
      evaluatedSplit: "test",
      authority: "UNATTESTED_MINIMIZED_INPUT",
      baseline: metric,
      candidate: metric,
      hardGates: {
        privacyInputContract: true,
        rightsInputContract: true,
        independentSplit: true,
        boundedScope: true,
        severeWrongTarget: true,
        familyRegression: true,
      },
      verdict: "REVIEW_REQUIRED",
      promotionAuthorized: false,
      evidence: stored.document_learning_candidate.evidence,
    };
    const payload = {
      evaluationId: randomUUID(),
      candidateRevision: stored.revision,
      attemptId: state.attempt_id,
      inputHash: state.input_hash,
      evaluation: report,
      caseId: state.case_id,
      evaluationRevision: "3".repeat(64),
      _principal: principal,
    };
    for (const [change, expected] of [
      [{ approved: true }, /REGISTERED_CONTRACT_REQUIRED/],
      [{ evaluation: { ...report, original: "leak-marker" } }, /UNATTESTED_CONTRACT_REQUIRED/],
      [{ evaluation: { ...report, authority: "PROTECTED" } }, /UNATTESTED_CONTRACT_REQUIRED/],
      [{ evaluation: { ...report, promotionAuthorized: true } }, /UNATTESTED_CONTRACT_REQUIRED/],
      [{ evaluation: { ...report, baselineSHA: "0".repeat(40) } }, /CURRENT_CANDIDATE_REQUIRED/],
      [{ candidateRevision: "0".repeat(64) }, /CURRENT_CANDIDATE_REQUIRED/],
      [{ attemptId: randomUUID() }, /CURRENT_CANDIDATE_REQUIRED/],
      [{ evaluation: { ...report, candidateSHA: "wrong" } }, /REVISION_REQUIRED/],
      [{ evaluation: { ...report, verdict: "FAIL" } }, /GATE_VERDICT_CONFLICT/],
      [
        { evaluation: { ...report, candidate: { ...metric, sampleCount: 2 } } },
        /METRIC_COUNT_CONFLICT/,
      ],
      [
        {
          evaluation: {
            ...report,
            candidate: { ...metric, families: [{ ...family, correctCount: 2 }] },
          },
        },
        /METRIC_COUNT_CONFLICT/,
      ],
      [
        {
          evaluation: {
            ...report,
            candidate: { ...metric, families: [{ ...family, precisionInterval95: [1, 0] }] },
          },
        },
        /METRIC_COUNT_CONFLICT/,
      ],
      [
        { evaluation: { ...report, candidate: { ...metric, original: "leak-marker" } } },
        /MINIMIZED_METRICS_REQUIRED/,
      ],
      [
        { evaluation: { ...report, candidate: { ...metric, providerWrites: 1 } } },
        /MINIMIZED_METRICS_REQUIRED/,
      ],
      [
        {
          evaluation: {
            ...report,
            candidate: { ...metric, families: [{ ...family, prompt: "leak-marker" }] },
          },
        },
        /MINIMIZED_METRICS_REQUIRED/,
      ],
      [
        {
          evaluation: {
            ...report,
            candidate: { ...metric, families: [{ ...family, precision: "raw" }] },
          },
        },
        /MINIMIZED_METRICS_REQUIRED/,
      ],
      [
        {
          evaluation: {
            ...report,
            evidence: [
              {
                kind: "evidence",
                repository: "aXtn/aXtn-agentswarms",
                id: "https://outside.invalid",
              },
            ],
          },
        },
        /MINIMIZED_EVIDENCE_REQUIRED/,
      ],
      [{ _principal: { kind: "swarm", id: owner } }, /CURRENT_CANDIDATE_REQUIRED/],
    ])
      await denied("document_evaluation", { ...payload, ...change }, expected);
    const results = await Promise.allSettled(
      Array.from({ length: 16 }, (_, index) =>
        call("document_evaluation", {
          ...payload,
          evaluationId: randomUUID(),
          evaluationRevision: String(index % 10).repeat(64),
          evaluation: {
            ...report,
            baseline: { ...metric, elapsedMs: index + 1 },
            candidate: { ...metric, elapsedMs: index + 2 },
            evidence:
              index % 2 ? [...report.evidence].reverse().concat(report.evidence) : report.evidence,
          },
        }),
      ),
    );
    for (const result of results)
      assert.equal(
        result.status,
        "fulfilled",
        result.status === "rejected" ? String(result.reason) : "",
      );
    const canonical = results[0].value;
    for (const result of results) assert.deepEqual(result.value, canonical);
    const replay = {
      ...payload,
      evaluationId: canonical.evaluation_id,
      evaluationRevision: canonical.revision,
      evaluation: canonical.document_evaluation,
    };
    assert.deepEqual(await call("document_evaluation", replay), canonical);
    assert.equal(canonical.promotion_authorized, false);
    assert.equal(canonical.improvement_case_id, stored.improvement_case_id);
    assert.equal(canonical.principal.kind, "user_session");
    await denied(
      "document_evaluation",
      { ...replay, evaluationRevision: "9".repeat(64) },
      /IMMUTABLE/,
    );
    assert.deepEqual(
      await call("document_evaluations", { caseId: state.case_id, _principal: principal }),
      [canonical],
    );
    assert.equal(
      await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}'
    AND action='axtn_work.DOCUMENT_EVALUATION_RECORDED';`),
      "1",
    );
    for (const sql of [
      `UPDATE user_data_rows SET row=row||'{"promotion_authorized":true}'::jsonb WHERE table_id IN(
      SELECT id FROM user_data_tables WHERE user_id='${owner}' AND name='axtn_document_evaluations')`,
      `DELETE FROM user_data_tables WHERE user_id='${owner}' AND name='axtn_document_evaluations'`,
      `UPDATE user_data_tables SET name='eval-shadow' WHERE user_id='${owner}' AND name='axtn_document_evaluations'`,
      `INSERT INTO user_data_rows(table_id,row) SELECT id,'{"evaluation_id":"marker-omitted"}'::jsonb
      FROM user_data_tables WHERE user_id='${owner}' AND name='axtn_document_evaluations'`,
    ])
      await assert.rejects(
        query(`SET ROLE service_role; ${sql};`),
        /DOCUMENT_EVALUATION_NATIVE_CONTRACT_REQUIRED/,
      );
    await assert.rejects(
      query(`SET ROLE authenticated;
        SELECT set_config('request.jwt.claims','{"sub":"${owner}","role":"authenticated"}',false);
        UPDATE user_data_rows SET row=row||'{"promotion_authorized":true}'::jsonb WHERE table_id IN(
          SELECT id FROM user_data_tables WHERE user_id='${owner}' AND name='axtn_document_evaluations');`),
      /DOCUMENT_EVALUATION_NATIVE_CONTRACT_REQUIRED/,
    );
    await assert.rejects(
      query(`SET ROLE service_role; SELECT * FROM axtn_local_table_upsert(
    '${owner}','axtn_document_evaluations','evaluation_id','${canonical.evaluation_id}',${quote(canonical)});`),
      /DOCUMENT_EVALUATION_NATIVE_CONTRACT_REQUIRED/,
    );
    await assert.rejects(
      query(`SET ROLE service_role; SELECT axtn_case_document_before_evaluation(
    '${owner}','document_evaluations',${quote({ caseId: state.case_id, _principal: principal })});`),
      /permission denied/,
    );
    const swarmId = randomUUID();
    const keyId = randomUUID();
    await query(`INSERT INTO swarms(id,user_id,name,nodes,edges) VALUES(
      '${swarmId}','${owner}','Isolated evaluation list key','[]'::jsonb,'[]'::jsonb);
      INSERT INTO swarm_api_keys(id,user_id,swarm_id,name,key_hash,key_prefix,scopes) VALUES(
        '${keyId}','${owner}','${swarmId}','Nonfunctional fixture key','${"a".repeat(64)}','fixture',ARRAY['cases']);`);
    const machine = { kind: "swarm_api_key", id: keyId };
    assert.deepEqual(
      await call("document_evaluations", { caseId: state.case_id, _principal: machine }),
      [canonical],
    );
    for (const mutation of [
      "scopes=ARRAY['run']",
      "scopes=ARRAY['cases'],expires_at=now()-interval '1 second'",
      "expires_at=NULL,revoked_at=now()",
    ]) {
      await query(`UPDATE swarm_api_keys SET ${mutation} WHERE id='${keyId}';`);
      await denied(
        "document_evaluation",
        { ...replay, _principal: machine },
        /DOCUMENT_CASE_KEY_DENIED/,
      );
      await denied(
        "document_evaluations",
        { caseId: state.case_id, _principal: machine },
        /DOCUMENT_CASE_KEY_DENIED/,
      );
    }
    await denied(
      "document_evaluation",
      {
        ...replay,
        _principal: {
          kind: "user_session",
          id: randomUUID(),
        },
      },
      /DOCUMENT_PRINCIPAL_OWNER_DENIED/,
    );
    const parentWhere = `table_id IN(SELECT id FROM user_data_tables WHERE user_id='${owner}' AND name='axtn_cases')
    AND row->>'case_id'='${state.case_id}'`;
    const parent = await query(`SELECT row FROM user_data_rows WHERE ${parentWhere};`);
    for (const status of ["NO_AI", "UNRESOLVED"]) {
      await query(
        `UPDATE user_data_rows SET row=jsonb_set(row,'{verified_privacy_status}',to_jsonb('${status}'::text)) WHERE ${parentWhere};`,
      );
      await denied(
        "document_evaluation",
        { ...payload, evaluationId: randomUUID() },
        /PROTECTED_PRIVACY_REQUIRED/,
      );
      assert.deepEqual(await call("document_evaluation", replay), canonical);
    }
    await query(`UPDATE user_data_rows SET row=${quote(JSON.parse(parent))} WHERE ${parentWhere};`);
    console.log(
      "PASS: actual 16-session minimized unattested evaluation dedup, one append-only report/audit, scoped exact recovery after privacy drift, native Candidate/Child binding and role/broker/injection denial.",
    );
  },
);
