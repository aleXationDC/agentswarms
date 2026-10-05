import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeCaseWork } from "@/axtn/workbenches/cases/work.server";
import { CaseRequest } from "@/axtn/workbenches/documents/documentWorkContract";
import { documentInputHash } from "@/axtn/workbenches/documents/documentWork.server";
import {
  DisabledDocumentAutomationPolicy,
  DisabledDocumentAutomationPolicyRecord,
} from "@/axtn/workbenches/documents/documentAutomationPolicyContract";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));

const policy = {
  schemaVersion: "document-automation-policy-v1",
  policyId: randomUUID(),
  caseId: randomUUID(),
  candidateId: randomUUID(),
  candidateRevision: "a".repeat(64),
  evaluationId: randomUUID(),
  evaluationRevision: "b".repeat(64),
  family: "fixture",
  sourceKind: "fixture",
  targetId: null,
  operation: "CLASSIFY",
  ruleRevision: "c".repeat(64),
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
  evidence: [
    {
      kind: "evidence",
      repository: "aXtn/aXtn-agentswarms",
      id: "tests/unit/documentAutomationPolicy.test.ts",
    },
  ],
};
describe("immutable disabled Document Automation Policy shape", () => {
  it("allows a disabled draft without inventing a QualityProfile or approval", () => {
    expect(DisabledDocumentAutomationPolicy.safeParse(policy).success).toBe(true);
  });

  describe("same native policy service without activation or orchestration", () => {
    const owner = randomUUID();
    const submission = { policy, attemptId: randomUUID(), inputHash: "f".repeat(64) };
    beforeEach(() => rpc.mockReset().mockResolvedValue({ data: { enabled: false }, error: null }));
    it("derives owner/principal/revision server-side and canonicalizes safety/evidence references", async () => {
      const request = CaseRequest.parse({ operation: "document_policy", submission });
      await executeCaseWork(owner, request, { kind: "user_session", id: owner });
      const normalized = {
        ...submission,
        caseId: policy.caseId,
        policy: {
          ...policy,
          reviewTriggers: [...policy.reviewTriggers].sort(),
          evidence: policy.evidence,
        },
      };
      expect(rpc).toHaveBeenCalledExactlyOnceWith("axtn_case_document", {
        p_user_id: owner,
        p_operation: "document_policy",
        p_payload: {
          ...normalized,
          policyRevision: documentInputHash(normalized),
          actorRef: owner,
          _principal: { kind: "user_session", id: owner },
        },
      });
    });
    it("uses identical revision for reordered or repeated minimized references", async () => {
      for (const value of [
        submission,
        {
          ...submission,
          policy: {
            ...policy,
            reviewTriggers: [...policy.reviewTriggers].reverse(),
            evidence: [...policy.evidence, policy.evidence[0]],
          },
        },
      ])
        await executeCaseWork(
          owner,
          CaseRequest.parse({ operation: "document_policy", submission: value }),
          { kind: "user_session", id: owner },
        );
      expect(rpc.mock.calls[0][1].p_payload).toEqual(rpc.mock.calls[1][1].p_payload);
    });
    it("rejects foreign Human identity before any native write", async () => {
      await expect(
        executeCaseWork(owner, CaseRequest.parse({ operation: "document_policy", submission }), {
          kind: "user_session",
          id: randomUUID(),
        }),
      ).rejects.toThrow(/owner mismatch/);
      expect(rpc).not.toHaveBeenCalled();
    });
    it("binds a machine to its actual principal; it cannot invent approval", async () => {
      const principal = { kind: "swarm_api_key" as const, id: randomUUID() };
      await executeCaseWork(
        owner,
        CaseRequest.parse({ operation: "document_policy", submission }),
        principal,
      );
      expect(rpc.mock.calls[0][1].p_payload._principal).toEqual(principal);
      expect(rpc.mock.calls[0][1].p_payload.policy.enabled).toBe(false);
      expect(rpc.mock.calls[0][1].p_payload.policy.promotionCaseId).toBeNull();
    });
    it("lists native drafts on the same protected read path", async () => {
      await executeCaseWork(
        owner,
        CaseRequest.parse({ operation: "document_policies", caseId: policy.caseId }),
        { kind: "user_session", id: owner },
      );
      expect(rpc).toHaveBeenCalledExactlyOnceWith("axtn_case_document", {
        p_user_id: owner,
        p_operation: "document_policies",
        p_payload: {
          caseId: policy.caseId,
          actorRef: owner,
          _principal: { kind: "user_session", id: owner },
        },
      });
    });
    it("surfaces native drift/guard errors rather than returning a disabled success fallback", async () => {
      rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "DOCUMENT_POLICY_CURRENT_CANDIDATE_EVALUATION_REQUIRED" },
      });
      await expect(
        executeCaseWork(owner, CaseRequest.parse({ operation: "document_policy", submission }), {
          kind: "user_session",
          id: owner,
        }),
      ).rejects.toThrow("DOCUMENT_POLICY_CURRENT_CANDIDATE_EVALUATION_REQUIRED");
    });
  });
  it.each([
    { enabled: true },
    { authority: "APPROVED" },
    { promotionCaseId: randomUUID() },
    { operation: "FILE" },
    { operation: "DELETE" },
    { sourceKind: "*" },
    { family: "original text" },
    { family: "fixture\n" },
    { targetId: "https://outside.invalid" },
    { ruleRevision: "a".repeat(64) + "\n" },
    { validUntil: policy.validFrom },
    { validFrom: policy.validUntil },
    { reviewTriggers: ["HUMAN_OVERRIDE"] },
    { reviewTriggers: [...policy.reviewTriggers.slice(1), "HUMAN_OVERRIDE"] },
    { qualityProfile: { kind: "contract", repository: "aXtn/aXtn-agentswarms", id: "quality" } },
    {
      qualityProfile: {
        kind: "contract",
        repository: "aXtn/foreign",
        id: "quality",
        revision: "a".repeat(40),
      },
    },
    { approved: true },
    { confidence: 0.99 },
    { prompt: "original text" },
    { providerCredential: "forbidden" },
    { evidence: [] },
  ])("rejects activation/scope/authority/leakage or incomplete safety contract %j", (change) => {
    expect(DisabledDocumentAutomationPolicy.safeParse({ ...policy, ...change }).success).toBe(
      false,
    );
  });
  it("accepts an exact reference but does not treat it as protected quality authority", () => {
    const parsed = DisabledDocumentAutomationPolicy.parse({
      ...policy,
      qualityProfile: {
        kind: "contract",
        repository: "aXtn/aXtn-agentswarms",
        id: "contracts/quality-fixture",
        revision: "a".repeat(40),
      },
    });
    expect(parsed.authority).toBe("UNAPPROVED_DISABLED_DRAFT");
    expect(parsed.enabled).toBe(false);
    expect(parsed.promotionCaseId).toBeNull();
  });
  it("binds inactive readback to the source Case and independently existing Child", () => {
    const record = {
      policy_id: policy.policyId,
      policy_key: "d".repeat(64),
      case_id: policy.caseId,
      improvement_case_id: randomUUID(),
      attempt_id: randomUUID(),
      input_hash: "f".repeat(64),
      revision: "e".repeat(64),
      document_automation_policy: policy,
      principal: { kind: "user_session", id: randomUUID() },
      created_at: "2026-10-05T00:00:00Z",
      enabled: false,
    };
    expect(DisabledDocumentAutomationPolicyRecord.safeParse(record).success).toBe(true);
    for (const change of [
      { policy_id: randomUUID() },
      { case_id: randomUUID() },
      { improvement_case_id: policy.caseId },
      { enabled: true },
      { approved: true },
    ])
      expect(
        DisabledDocumentAutomationPolicyRecord.safeParse({ ...record, ...change }).success,
      ).toBe(false);
  });
});
