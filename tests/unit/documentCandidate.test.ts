import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeCaseWork } from "@/axtn/workbenches/cases/work.server";
import {
  DocumentLearningCandidate,
  DocumentLearningCandidateRecord,
} from "@/axtn/workbenches/documents/documentCandidateContract";
import { documentInputHash } from "@/axtn/workbenches/documents/documentWork.server";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
const owner = "11111111-1111-4111-8111-111111111111";
const evidence = {
  kind: "evidence",
  repository: "aXtn/aXtn-agentswarms",
  id: "tests/unit/documentCandidate.test.ts",
  revision: "a".repeat(40),
};
const candidate = {
  schemaVersion: "document-learning-candidate-v1",
  candidateId: "22222222-2222-4222-8222-222222222222",
  caseId: "33333333-3333-4333-8333-333333333333",
  decisionId: "44444444-4444-4444-8444-444444444444",
  decisionRevision: "a".repeat(64),
  attemptId: "55555555-5555-4555-8555-555555555555",
  inputHash: "b".repeat(64),
  baseline: { ...evidence, kind: "repository" },
  feedback: [{ eventId: owner, revision: "c".repeat(64) }],
  hypothesis: "MATCH_TOO_NARROW",
  risks: ["FAMILY_REGRESSION"],
  testProfile: { ...evidence, kind: "contract" },
  changeManifest: {
    schemaVersion: "document-rule-change-v1",
    patternId: "fixture-rule",
    patternRevision: "d".repeat(64),
    conditionChanges: [{ index: 0, matchMode: "fuzzy", maxDeviationPercent: 10 }],
    family: "fixture-family",
    targetId: null,
    sourceKind: "fixture",
    operation: "CLASSIFY",
    enabled: false,
  },
  evidence: [evidence],
};

describe("inactive native Improvement Candidate contract", () => {
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: {}, error: null }));

  it("uses the same Case service with server identity and revision, never starts or promotes", async () => {
    await executeCaseWork(
      owner,
      { operation: "document_candidate", candidate },
      { kind: "user_session", id: owner },
    );
    expect(rpc).toHaveBeenCalledExactlyOnceWith("axtn_case_document", {
      p_user_id: owner,
      p_operation: "document_candidate",
      p_payload: {
        ...candidate,
        candidateRevision: documentInputHash(DocumentLearningCandidate.parse(candidate)),
        actorRef: owner,
        _principal: { kind: "user_session", id: owner },
      },
    });
  });

  it("normalizes reference/condition/risk order and repeated evidence before hashing", async () => {
    const request = {
      ...candidate,
      feedback: [
        ...candidate.feedback,
        { eventId: candidate.decisionId, revision: "e".repeat(64) },
      ],
      risks: ["WRONG_TARGET", "FAMILY_REGRESSION"],
      evidence: [evidence, { ...evidence, id: "axtn/fixture" }],
      changeManifest: {
        ...candidate.changeManifest,
        conditionChanges: [
          ...candidate.changeManifest.conditionChanges,
          { index: 1, matchMode: "exact", maxDeviationPercent: 0 },
        ],
      },
    };
    const principal = { kind: "user_session" as const, id: owner };
    await executeCaseWork(
      owner,
      { operation: "document_candidate", candidate: request },
      principal,
    );
    const first = rpc.mock.calls[0][1].p_payload;
    await executeCaseWork(
      owner,
      {
        operation: "document_candidate",
        candidate: {
          ...request,
          feedback: [...request.feedback].reverse(),
          risks: [...request.risks].reverse(),
          evidence: [...request.evidence].reverse().concat(evidence),
          changeManifest: {
            ...request.changeManifest,
            conditionChanges: [...request.changeManifest.conditionChanges].reverse(),
          },
        },
      },
      principal,
    );
    expect(rpc.mock.calls[1][1].p_payload).toEqual(first);
  });

  it.each(["owner", "_principal", "actorRef", "approved", "text", "prompt", "candidateRevision"])(
    "rejects injected %s before RPC",
    async (field) => {
      await expect(
        executeCaseWork(
          owner,
          { operation: "document_candidate", candidate: { ...candidate, [field]: "forbidden" } },
          { kind: "user_session", id: owner },
        ),
      ).rejects.toThrow();
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it.each([
    { baseline: { ...candidate.baseline, revision: "a".repeat(39) } },
    { baseline: { ...candidate.baseline, repository: "aXtn/foreign" } },
    { baseline: { ...candidate.baseline, kind: "evidence" } },
    { testProfile: { ...candidate.testProfile, revision: undefined } },
    { testProfile: { ...candidate.testProfile, kind: "repository" } },
    { feedback: [] },
    { feedback: [...candidate.feedback, ...candidate.feedback] },
    { feedback: [{ ...candidate.feedback[0], verified: true }] },
    { evidence: [] },
    { evidence: [{ ...evidence, id: "https://outside.invalid/raw" }] },
    { hypothesis: "RUN_ARBITRARY_CODE" },
    { risks: [] },
    { risks: ["FAMILY_REGRESSION", "FAMILY_REGRESSION"] },
    { risks: ["IGNORE_PRIVACY"] },
    { decisionRevision: "a".repeat(64) + "\n" },
    { changeManifest: { ...candidate.changeManifest, family: "Original body text" } },
    { changeManifest: { ...candidate.changeManifest, family: "fixture\n" } },
    { changeManifest: { ...candidate.changeManifest, enabled: true } },
    { changeManifest: { ...candidate.changeManifest, operation: "DELETE" } },
    { changeManifest: { ...candidate.changeManifest, sourceKind: "*" } },
    { changeManifest: { ...candidate.changeManifest, prompt: "original text" } },
    { changeManifest: { ...candidate.changeManifest, conditionChanges: [] } },
    {
      changeManifest: {
        ...candidate.changeManifest,
        conditionChanges: [
          ...candidate.changeManifest.conditionChanges,
          ...candidate.changeManifest.conditionChanges,
        ],
      },
    },
    ...[
      { index: -1 },
      { index: 32 },
      { index: 0.5 },
      { matchMode: "executable" },
      { maxDeviationPercent: Number.NaN },
      { maxDeviationPercent: Infinity },
      { maxDeviationPercent: 101 },
      { value: "original text" },
    ].map((change) => ({
      changeManifest: {
        ...candidate.changeManifest,
        conditionChanges: [{ ...candidate.changeManifest.conditionChanges[0], ...change }],
      },
    })),
  ])("rejects unbounded/unminimized/active contract %j", (change) => {
    expect(DocumentLearningCandidate.safeParse({ ...candidate, ...change }).success).toBe(false);
  });

  it("derives machine scope and supports owner-bound findability without a new engine", async () => {
    await executeCaseWork(
      owner,
      { operation: "document_candidates", caseId: candidate.caseId },
      { kind: "swarm_api_key", id: owner },
    );
    expect(rpc).toHaveBeenCalledExactlyOnceWith("axtn_case_document", {
      p_user_id: owner,
      p_operation: "document_candidates",
      p_payload: {
        caseId: candidate.caseId,
        actorRef: owner,
        _principal: { kind: "swarm_api_key", id: owner },
      },
    });
  });

  it("surfaces a protected native denial without returning success-shaped data", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "DOCUMENT_CANDIDATE_PROTECTED_PRIVACY_REQUIRED" },
    });
    await expect(
      executeCaseWork(
        owner,
        { operation: "document_candidate", candidate },
        { kind: "user_session", id: owner },
      ),
    ).rejects.toThrow("DOCUMENT_CANDIDATE_PROTECTED_PRIVACY_REQUIRED");
  });

  it("validates immutable inactive readback and Parent/Child binding", () => {
    const record = {
      candidate_id: candidate.candidateId,
      candidate_key: "e".repeat(64),
      case_id: candidate.caseId,
      improvement_case_id: owner,
      revision: "f".repeat(64),
      document_learning_candidate: candidate,
      principal: { kind: "user_session", id: owner },
      created_at: "2026-10-05T00:00:00.123456+00:00",
      status: "NEW",
      enabled: false,
    };
    expect(DocumentLearningCandidateRecord.safeParse(record).success).toBe(true);
    for (const change of [
      { candidate_id: owner },
      { case_id: owner },
      { improvement_case_id: candidate.caseId },
      { enabled: true },
      { status: "OPEN" },
      { approved: true },
    ])
      expect(DocumentLearningCandidateRecord.safeParse({ ...record, ...change }).success).toBe(
        false,
      );
  });
});
