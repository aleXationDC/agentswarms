import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeCaseWork } from "@/axtn/workbenches/cases/work.server";
import { documentInputHash } from "@/axtn/workbenches/documents/documentWork.server";
import {
  DocumentEvaluationEvidence,
  DocumentEvaluationRecord,
} from "@/axtn/workbenches/documents/documentEvaluationContract";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
const owner = "11111111-1111-4111-8111-111111111111";
const caseId = "22222222-2222-4222-8222-222222222222";
const candidateId = "33333333-3333-4333-8333-333333333333";
const evaluationId = "44444444-4444-4444-8444-444444444444";
const family = {
  family: "fixture",
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
const evaluation = {
  schemaVersion: "document-evaluation-evidence-v1",
  candidateId,
  caseId,
  baselineSHA: "a".repeat(40),
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
  evidence: [
    {
      kind: "evidence",
      repository: "aXtn/aXtn-agentswarms",
      id: "tests/unit/documentEvaluationPersistence.test.ts",
    },
  ],
};
const submission = {
  evaluationId,
  candidateRevision: "3".repeat(64),
  attemptId: owner,
  inputHash: "4".repeat(64),
  evaluation,
};

describe("append-only minimized unattested reports through native Case seam", () => {
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: {}, error: null }));
  it("binds identity and exact report revision server-side, not computed/protected authority", async () => {
    await executeCaseWork(
      owner,
      { operation: "document_evaluation", submission },
      { kind: "user_session", id: owner },
    );
    expect(rpc).toHaveBeenCalledExactlyOnceWith("axtn_case_document", {
      p_user_id: owner,
      p_operation: "document_evaluation",
      p_payload: {
        ...submission,
        caseId,
        evaluationRevision: documentInputHash(submission),
        actorRef: owner,
        _principal: { kind: "user_session", id: owner },
      },
    });
  });
  it.each([
    "owner",
    "_principal",
    "actorRef",
    "verified",
    "approved",
    "original",
    "evaluationRevision",
  ])("rejects caller-injected submission %s before RPC", async (field) => {
    await expect(
      executeCaseWork(
        owner,
        {
          operation: "document_evaluation",
          submission: { ...submission, [field]: "forbidden" },
        },
        { kind: "user_session", id: owner },
      ),
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    { authority: "PROTECTED" },
    { promotionAuthorized: true },
    { verdict: "PASS" },
    { verdict: "FAIL" },
    { samples: [] },
    { original: "leak-marker" },
    { baseline: { ...metric, sampleCount: 0 } },
    { candidate: { ...metric, sampleCount: 2 } },
    { candidate: { ...metric, modelCalls: 1 } },
    { candidate: { ...metric, providerWrites: 1 } },
    { candidate: { ...metric, families: [{ ...family, family: "original text" }] } },
    { candidate: { ...metric, families: [{ ...family, precision: Number.NaN }] } },
    { candidate: { ...metric, families: [{ ...family, precisionInterval95: [0, 2] }] } },
    { candidate: { ...metric, families: [{ ...family, precisionInterval95: [1, 0] }] } },
    { candidate: { ...metric, families: [{ ...family, correctCount: 2 }] } },
    { candidate: { ...metric, families: [{ ...family, coverage: 0 }] } },
    { candidate: { ...metric, families: [{ ...family, correctionRate: 1 }] } },
    { candidate: { ...metric, families: [family, family] } },
    { candidate: { ...metric, severeWrongTargetCount: 1 } },
    { hardGates: { ...evaluation.hardGates, familyRegression: false } },
    { evidence: [] },
    { evidence: [{ ...evaluation.evidence[0], id: "https://outside.invalid" }] },
    { candidateSHA: "b".repeat(40) + "\n" },
  ])("rejects authority/leakage/count/gate/verdict conflicts %j", (change) => {
    expect(DocumentEvaluationEvidence.safeParse({ ...evaluation, ...change }).success).toBe(false);
  });
  it("records a FAIL as descriptive evidence, never forces PASS", () => {
    expect(
      DocumentEvaluationEvidence.safeParse({
        ...evaluation,
        verdict: "FAIL",
        hardGates: { ...evaluation.hardGates, familyRegression: false },
      }).success,
    ).toBe(true);
  });
  it("lists through the same authenticated Case service", async () => {
    await executeCaseWork(
      owner,
      { operation: "document_evaluations", caseId },
      { kind: "swarm_api_key", id: candidateId },
    );
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_user_id: owner,
      p_operation: "document_evaluations",
      p_payload: {
        caseId,
        actorRef: candidateId,
        _principal: { kind: "swarm_api_key", id: candidateId },
      },
    });
  });
  it("surfaces immutable/current-candidate native denial", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "DOCUMENT_EVALUATION_IMMUTABLE" } });
    await expect(
      executeCaseWork(
        owner,
        { operation: "document_evaluation", submission },
        { kind: "user_session", id: owner },
      ),
    ).rejects.toThrow("DOCUMENT_EVALUATION_IMMUTABLE");
  });
  it("validates exact Parent/Candidate/Child readback binding", () => {
    const record = {
      evaluation_id: evaluationId,
      evaluation_key: "5".repeat(64),
      candidate_id: candidateId,
      candidate_revision: submission.candidateRevision,
      case_id: caseId,
      improvement_case_id: owner,
      attempt_id: owner,
      input_hash: submission.inputHash,
      revision: "6".repeat(64),
      document_evaluation: evaluation,
      principal: { kind: "user_session", id: owner },
      created_at: "2026-10-05T03:00:00+00:00",
      promotion_authorized: false,
    };
    expect(DocumentEvaluationRecord.safeParse(record).success).toBe(true);
    for (const change of [
      { candidate_id: owner },
      { case_id: owner },
      { improvement_case_id: caseId },
      { promotion_authorized: true },
      { approved: true },
    ])
      expect(DocumentEvaluationRecord.safeParse({ ...record, ...change }).success).toBe(false);
  });
});
