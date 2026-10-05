import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { testCandidateFixture } from "./documentCandidateConcurrency.mjs";
import {
  documentEvaluationRevision,
  evaluateDocumentCandidate,
} from "@/axtn/workbenches/documents/documentEvaluation";
import { DocumentEvaluationRecord } from "@/axtn/workbenches/documents/documentEvaluationContract";
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
await testCandidateFixture(async ({ stored, state, call, principal }) => {
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
  const evaluation = evaluateDocumentCandidate({
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
  // Actual fuzzy matcher compares whole strings; this bounded change may regress.
  // The native report stores that measured verdict, never an invented PASS.
  const submission = {
    evaluationId: randomUUID(),
    candidateRevision: stored.revision,
    attemptId: state.attempt_id,
    inputHash: state.input_hash,
    evaluation,
  };
  const payload = {
    ...submission,
    caseId: state.case_id,
    evaluationRevision: documentInputHash(submission),
    _principal: principal,
  };
  const persisted = DocumentEvaluationRecord.parse(await call("document_evaluation", payload));
  assert.deepEqual(persisted.document_evaluation, evaluation);
  assert.equal(persisted.promotion_authorized, false);
  assert.equal(persisted.improvement_case_id, stored.improvement_case_id);
  assert.deepEqual(await call("document_evaluation", payload), persisted);
  assert.deepEqual(
    await call("document_evaluations", { caseId: state.case_id, _principal: principal }),
    [persisted],
  );
  console.log(
    "PASS: actual bounded recognizer verdict -> protected native append-only report -> exact lost-response readback; numeric features stay out of stored report and no promotion authority is created.",
  );
}, documentEvaluationRevision(rule));
