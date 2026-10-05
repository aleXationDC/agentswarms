import { beforeEach, describe, expect, it, vi } from "vitest";
import { CasePatternRequest } from "@/axtn/workbenches/cases/casePatternContract";
import { CaseRequest } from "@/axtn/workbenches/documents/documentWorkContract";
import { executeCaseWork } from "@/axtn/workbenches/cases/work.server";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
const owner = "11111111-1111-4111-8111-111111111111";
const artifact = {
  kind: "contract",
  repository: "aXtn/aXtn-agentswarms",
  id: "tests/integration/casePattern.sql",
  revision: "a".repeat(40),
};
const request = {
  operation: "pattern_usage",
  caseId: owner,
  usageId: "22222222-2222-4222-8222-222222222222",
  transitionKey: "usage",
  expectedVersion: 0,
  artifact,
  purpose: "CAPABILITY_UPLIFT",
  outcome: "NEGATIVE",
  rClass: "R2",
  eClass: "E1",
  iClass: "I0",
  evidence: [{ ...artifact, kind: "evidence" }],
};
describe("versioned native Pattern Usage", () => {
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: { version: 1 }, error: null }));
  it("uses existing versioned Git/evidence references and same Case route", async () => {
    expect(CaseRequest.parse(request)).toEqual(request);
    await executeCaseWork(owner, request, { kind: "user_session", id: owner });
    const { operation: _operation, ...payload } = request;
    expect(rpc).toHaveBeenCalledWith("axtn_case_pattern", {
      p_user_id: owner,
      p_operation: "pattern_usage",
      p_payload: { ...payload, _principal: { kind: "user_session", id: owner } },
    });
  });
  it.each(["accepted", "roi", "credentialId", "ownerId", "promotionEnabled"])(
    "refuses extra authority or unsupported claim %s",
    (field) => {
      expect(CasePatternRequest.safeParse({ ...request, [field]: true }).success).toBe(false);
    },
  );
  it("requires exact artifact and evidence versions", () => {
    expect(
      CasePatternRequest.safeParse({ ...request, artifact: { ...artifact, revision: undefined } })
        .success,
    ).toBe(false);
    expect(CasePatternRequest.safeParse({ ...request, evidence: [] }).success).toBe(false);
    expect(
      CasePatternRequest.safeParse({ ...request, artifact: { ...artifact, id: "../secret" } })
        .success,
    ).toBe(false);
  });
  it("does not multiply ordinal classes or silently accept invalid classes", () => {
    expect(CasePatternRequest.safeParse({ ...request, rClass: 4 }).success).toBe(false);
    expect(CasePatternRequest.safeParse({ ...request, eClass: "E4" }).success).toBe(false);
  });
  it("permits classification-only Assurance but rejects automated reclassification", async () => {
    const { artifact: _artifact, outcome: _outcome, purpose: _purpose, ...base } = request;
    const assurance = { ...base, operation: "pattern_assurance", expectedVersion: 1 };
    expect(CasePatternRequest.safeParse(assurance).success).toBe(true);
    await expect(executeCaseWork(owner, assurance)).rejects.toThrow("AUTHENTICATED_HUMAN_REQUIRED");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("narrows improvement to a signal and existing Work candidate, not intervention code", () => {
    const improvement = {
      operation: "pattern_improvement",
      caseId: owner,
      usageId: owner,
      transitionKey: "candidate",
      expectedVersion: 1,
      hypothesis: "REWORK",
      scenarioClass: "synthetic_acceptance",
      signal: { ...artifact, kind: "evidence" },
    };
    expect(CasePatternRequest.safeParse(improvement).success).toBe(true);
    expect(CasePatternRequest.safeParse({ ...improvement, script: "deploy" }).success).toBe(false);
  });
  it("surfaces native optimistic conflicts", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "CASE_PATTERN_VERSION_CONFLICT" } });
    await expect(executeCaseWork(owner, request)).rejects.toThrow("VERSION_CONFLICT");
  });
});
