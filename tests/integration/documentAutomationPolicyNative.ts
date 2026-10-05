import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testCandidateFixture } from "./documentCandidateConcurrency.mjs";
import {
  documentEvaluationRevision,
  evaluateDocumentCandidate,
} from "@/axtn/workbenches/documents/documentEvaluation";
import { DocumentEvaluationRecord } from "@/axtn/workbenches/documents/documentEvaluationContract";
import {
  DisabledDocumentAutomationPolicy,
  DisabledDocumentAutomationPolicyRecord,
} from "@/axtn/workbenches/documents/documentAutomationPolicyContract";
import { documentInputHash } from "@/axtn/workbenches/documents/documentWork.server";

const rule = {
  patternId: "fixture-rule",
  active: true,
  conditions: [1, 2].map((id) => ({
    featureIds: [id],
    operator: "contains",
    matchMode: "exact",
    maxDeviationPercent: 0,
  })),
  family: "fixture-family",
  targetId: null,
};
await testCandidateFixture(
  async ({ stored, state, call, denied, query, principal, owner, quote }) => {
    const samples = ["baseline", "candidate", "test"].map((split) => ({
      sampleId: randomUUID(),
      templateGroup: documentEvaluationRevision(`template:${split}`),
      requestGroup: documentEvaluationRevision(`request:${split}`),
      split,
      sourceKind: "fixture",
      privacyStatus: "ELIGIBLE",
      privacyRevision: "f".repeat(64),
      rightsVerified: true,
      verifiedFeedbackRevision: stored.document_learning_candidate.feedback[0].revision,
      featureIds: [1, 2],
      expected: { family: "fixture-family", targetId: null },
      feedbackKind: "VERIFIED_CORRECT",
    }));
    const dataset = {
      schemaVersion: "document-evaluation-dataset-v1",
      featureSchemaRevision: "a".repeat(64),
      vocabularyRevision: "b".repeat(64),
      samples,
    };
    const report = evaluateDocumentCandidate({
      candidate: stored.document_learning_candidate,
      candidateSHA: "c".repeat(40),
      evaluatorRevision: "d".repeat(64),
      rules: [rule],
      dataset: {
        ...dataset,
        datasetRevision: documentEvaluationRevision(dataset),
        splitRevision: documentEvaluationRevision(
          samples.map(({ sampleId, split, templateGroup, requestGroup }) => ({
            sampleId,
            split,
            templateGroup,
            requestGroup,
          })),
        ),
      },
    });
    const submission = {
      evaluationId: randomUUID(),
      candidateRevision: stored.revision,
      attemptId: state.attempt_id,
      inputHash: state.input_hash,
      evaluation: report,
    };
    const evaluation = DocumentEvaluationRecord.parse(
      await call("document_evaluation", {
        ...submission,
        caseId: state.case_id,
        evaluationRevision: documentInputHash(submission),
        _principal: principal,
      }),
    );
    const scope = stored.document_learning_candidate.changeManifest;
    const policy = DisabledDocumentAutomationPolicy.parse({
      schemaVersion: "document-automation-policy-v1",
      policyId: randomUUID(),
      caseId: state.case_id,
      candidateId: stored.candidate_id,
      candidateRevision: stored.revision,
      evaluationId: evaluation.evaluation_id,
      evaluationRevision: evaluation.revision,
      family: scope.family,
      sourceKind: scope.sourceKind,
      targetId: scope.targetId,
      operation: "CLASSIFY",
      ruleRevision: report.candidateRuleRevision,
      qualityProfile: null,
      reviewTriggers: [
        "UNKNOWN_FAMILY",
        "AMBIGUOUS_TARGET",
        "SOURCE_RIGHTS_DRIFT",
        "PRIVACY_DRIFT",
        "RULE_DRIFT",
        "QUALITY_DRIFT",
        "HUMAN_OVERRIDE",
      ],
      validFrom: "2026-10-05T00:00:00Z",
      validUntil: "2026-10-06T00:00:00Z",
      promotionCaseId: null,
      authority: "UNAPPROVED_DISABLED_DRAFT",
      enabled: false,
      evidence: report.evidence,
    });
    const payload = {
      policy,
      caseId: state.case_id,
      attemptId: state.attempt_id,
      inputHash: state.input_hash,
      policyRevision: documentInputHash(policy),
      _principal: principal,
    };
    for (const [change, expected] of [
      [{ policy: { ...policy, enabled: true } }, /DISABLED_CONTRACT_REQUIRED/],
      [{ policy: { ...policy, authority: "APPROVED" } }, /DISABLED_CONTRACT_REQUIRED/],
      [{ policy: { ...policy, promotionCaseId: randomUUID() } }, /DISABLED_CONTRACT_REQUIRED/],
      [{ policy: { ...policy, original: "privacy-leak-marker" } }, /DISABLED_CONTRACT_REQUIRED/],
      [{ policy: { ...policy, operation: "FILE" } }, /DISABLED_CONTRACT_REQUIRED/],
      [{ policy: { ...policy, operation: "DELETE" } }, /DISABLED_CONTRACT_REQUIRED/],
      [{ policy: { ...policy, sourceKind: "*" } }, /DISABLED_CONTRACT_REQUIRED/],
      [{ policy: { ...policy, sourceKind: "drive" } }, /CURRENT_CANDIDATE_EVALUATION_REQUIRED/],
      [{ policy: { ...policy, family: "other-family" } }, /CURRENT_CANDIDATE_EVALUATION_REQUIRED/],
      [
        { policy: { ...policy, targetId: "other-target" } },
        /CURRENT_CANDIDATE_EVALUATION_REQUIRED/,
      ],
      [
        { policy: { ...policy, ruleRevision: "0".repeat(64) } },
        /CURRENT_CANDIDATE_EVALUATION_REQUIRED/,
      ],
      [
        { policy: { ...policy, evaluationId: randomUUID() } },
        /CURRENT_CANDIDATE_EVALUATION_REQUIRED/,
      ],
      [
        { policy: { ...policy, evaluationRevision: "0".repeat(64) } },
        /CURRENT_CANDIDATE_EVALUATION_REQUIRED/,
      ],
      [
        { policy: { ...policy, candidateRevision: "0".repeat(64) } },
        /CURRENT_CANDIDATE_EVALUATION_REQUIRED/,
      ],
      [
        { policy: { ...policy, reviewTriggers: ["HUMAN_OVERRIDE"] } },
        /FAIL_CLOSED_TRIGGERS_REQUIRED/,
      ],
      [{ policy: { ...policy, validUntil: policy.validFrom } }, /VALIDITY_REQUIRED/],
      [
        {
          policy: {
            ...policy,
            qualityProfile: {
              kind: "contract",
              repository: "aXtn/aXtn-agentswarms",
              id: "quality",
            },
          },
        },
        /QUALITY_REFERENCE_REQUIRED/,
      ],
      [{ attemptId: randomUUID() }, /CURRENT_CANDIDATE_EVALUATION_REQUIRED/],
      [{ inputHash: "0".repeat(64) }, /CURRENT_CANDIDATE_EVALUATION_REQUIRED/],
      [{ _principal: { kind: "user_session", id: randomUUID() } }, /OWNER/],
      [
        {
          policy: {
            ...policy,
            evidence: [{ kind: "evidence", repository: "aXtn/aXtn-agentswarms", id: "raw text" }],
          },
        },
        /MINIMIZED_EVIDENCE_REQUIRED/,
      ],
    ])
      await denied("document_policy", { ...payload, ...change }, expected);
    const concurrent = await Promise.all(
      Array.from({ length: 16 }, (_, index) => {
        const alias = {
          ...policy,
          policyId: randomUUID(),
          reviewTriggers: index % 2 ? [...policy.reviewTriggers].reverse() : policy.reviewTriggers,
          evidence:
            index % 2 ? [...policy.evidence].reverse().concat(policy.evidence[0]) : policy.evidence,
        };
        return call("document_policy", {
          ...payload,
          policy: alias,
          policyRevision: documentInputHash(alias),
        });
      }),
    );
    const persisted = DisabledDocumentAutomationPolicyRecord.parse(concurrent[0]);
    for (const result of concurrent) assert.deepEqual(result, persisted);
    assert.equal(persisted.enabled, false);
    assert.equal(persisted.document_automation_policy.authority, "UNAPPROVED_DISABLED_DRAFT");
    assert.equal(persisted.document_automation_policy.promotionCaseId, null);
    assert.equal(persisted.improvement_case_id, stored.improvement_case_id);
    const replay = {
      ...payload,
      policy: persisted.document_automation_policy,
      policyRevision: persisted.revision,
    };
    assert.deepEqual(await call("document_policy", replay), persisted);
    assert.deepEqual(
      await call("document_policies", { caseId: state.case_id, _principal: principal }),
      [persisted],
    );
    await denied(
      "document_policy",
      {
        ...replay,
        policy: { ...persisted.document_automation_policy, validUntil: "2026-10-07T00:00:00Z" },
      },
      /IMMUTABLE/,
    );
    const uuid = (value: string) => `(${quote(value)}#>>'{}')::uuid`;
    const table = (
      await query(`SELECT id FROM user_data_tables WHERE user_id=${uuid(owner)}
    AND name='axtn_document_automation_policies'`)
    ).trim();
    for (const statement of [
      `INSERT INTO user_data_rows(table_id,row) VALUES(${uuid(table)},'{}')`,
      `UPDATE user_data_rows SET row=row||'{"enabled":true}' WHERE table_id=${uuid(table)}`,
      `DELETE FROM user_data_rows WHERE table_id=${uuid(table)}`,
      `DELETE FROM user_data_tables WHERE id=${uuid(table)}`,
      `UPDATE user_data_tables SET name='renamed' WHERE id=${uuid(table)}`,
      `SELECT * FROM axtn_local_table_upsert(${uuid(owner)},'axtn_document_automation_policies','policy_id','synthetic','{}')`,
    ]) {
      let rejected = false;
      try {
        await query(`SET ROLE service_role; ${statement};`);
      } catch (error) {
        assert.match(String(error), /DOCUMENT_POLICY_NATIVE_CONTRACT_REQUIRED/);
        rejected = true;
      }
      assert.equal(rejected, true, "Generic write must not activate or rewrite a draft");
    }
    const audit = (
      await query(`SELECT count(*) FROM audit_events WHERE user_id=${uuid(owner)}
    AND action='axtn_work.DOCUMENT_POLICY_DRAFT_RECORDED'`)
    ).trim();
    assert.equal(audit, "1");
    const parentWhere = `table_id=(SELECT id FROM user_data_tables WHERE user_id=${uuid(owner)}
      AND name='axtn_cases') AND row->>'case_id'=(${quote(state.case_id)}#>>'{}')`;
    await query(`UPDATE user_data_rows SET row=jsonb_set(row,'{privacy_evidence_revision}',
      ${quote("0".repeat(64))}) WHERE ${parentWhere}`);
    assert.deepEqual(await call("document_policy", replay), persisted);
    await denied(
      "document_policy",
      { ...payload, policy: { ...policy, policyId: randomUUID() } },
      /DOCUMENT_CANDIDATE_PROTECTED_PRIVACY_REQUIRED/,
    );
    await query(`UPDATE user_data_rows SET row=jsonb_set(row,'{privacy_evidence_revision}',
      ${quote("f".repeat(64))}) WHERE ${parentWhere}`);
    const swarmId = randomUUID();
    const keyId = randomUUID();
    await query(`INSERT INTO swarms(id,user_id,name,nodes,edges)
      VALUES(${uuid(swarmId)},${uuid(owner)},'Isolated disabled Policy key fixture','[]','[]');
      INSERT INTO swarm_api_keys(id,user_id,swarm_id,name,key_hash,key_prefix,scopes)
      VALUES(${uuid(keyId)},${uuid(owner)},${uuid(swarmId)},'Nonfunctional isolated key fixture',
      '${documentInputHash(randomUUID())}','fixture',ARRAY['cases'])`);
    const machine = { kind: "swarm_api_key", id: keyId };
    assert.deepEqual(
      await call("document_policies", { caseId: state.case_id, _principal: machine }),
      [persisted],
    );
    await denied(
      "document_policy",
      { ...payload, policy: { ...policy, policyId: randomUUID() }, _principal: machine },
      /CURRENT_CANDIDATE_EVALUATION_REQUIRED/,
    );
    for (const mutation of [
      "scopes=ARRAY['run']",
      "scopes=ARRAY['cases'],expires_at=now()-interval '1 second'",
      "expires_at=NULL,revoked_at=now()",
    ]) {
      await query(`UPDATE swarm_api_keys SET ${mutation} WHERE id=${uuid(keyId)}`);
      await denied(
        "document_policies",
        { caseId: state.case_id, _principal: machine },
        /DOCUMENT_CASE_KEY_DENIED/,
      );
      await denied(
        "document_policy",
        { ...replay, _principal: machine },
        /DOCUMENT_CASE_KEY_DENIED/,
      );
    }
    await query(`DELETE FROM swarm_api_keys WHERE id=${uuid(keyId)};
      DELETE FROM swarms WHERE id=${uuid(swarmId)}`);
    const revisionPolicy = {
      ...policy,
      policyId: randomUUID(),
      validUntil: "2026-10-07T00:00:00Z",
    };
    await query(`UPDATE user_data_tables SET columns=(SELECT jsonb_agg(value)
      FROM jsonb_array_elements(columns) WHERE value->>'name'<>'revision')||
      '[{"name":"operator_annotation","type":"string","operator_owned":true}]'
      WHERE id=${uuid(table)}`);
    const next = DisabledDocumentAutomationPolicyRecord.parse(
      await call("document_policy", {
        ...payload,
        policy: revisionPolicy,
        policyRevision: documentInputHash(revisionPolicy),
      }),
    );
    assert.notEqual(next.policy_id, persisted.policy_id);
    assert.notEqual(next.revision, persisted.revision);
    assert.equal(next.enabled, false);
    const metadata = JSON.parse(
      await query(`SELECT columns FROM user_data_tables WHERE id=${uuid(table)}`),
    );
    assert.deepEqual(
      metadata.find((column: { name: string }) => column.name === "operator_annotation"),
      { name: "operator_annotation", type: "string", operator_owned: true },
    );
    assert.equal(
      metadata.filter((column: { name: string }) => column.name === "revision").length,
      1,
    );
    console.log(
      "PASS: real Candidate/evaluator/native report -> 16 concurrent immutable disabled Policy drafts, one initial audit, exact lost-response/privacy-drift recovery, current/privacy/key scope-expiry-revocation/native-write denials, append-only new revision and lossless Dataset metadata reconciliation; no promotion or effect.",
    );
  },
  documentEvaluationRevision(rule),
);
