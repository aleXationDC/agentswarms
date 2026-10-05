import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaseRequest } from "@/axtn/workbenches/documents/documentWorkContract";
import { executeCaseWork } from "@/axtn/workbenches/cases/work.server";
import { CaseAssignmentRequest } from "@/axtn/workbenches/cases/caseAssignmentContract";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
const actor = "11111111-1111-4111-8111-111111111111";
const assignee = "22222222-2222-4222-8222-222222222222";
const request = {
  operation: "case_assignment",
  caseId: "33333333-3333-4333-8333-333333333333",
  expectedVersion: 1,
  transitionKey: "assign-1",
  responsiblePrincipalType: "USER",
  responsiblePrincipalId: assignee,
  assigneeUserId: assignee,
  assignmentPolicy: "MANUAL",
  assignmentInheritance: "OVERRIDE",
  semanticRouteMode: "SYSTEM_INTEGRATION",
  semanticRouteProviderId: null,
  semanticRouteModelId: null,
};
describe("native Case responsibility contract", () => {
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: { ok: true }, error: null }));
  it("routes assignment with actual authenticated actor, never custodian substitution", async () => {
    expect(CaseRequest.parse(request)).toEqual(request);
    await executeCaseWork(actor, request, { kind: "user_session", id: actor });
    const { operation, ...payload } = request;
    expect(rpc).toHaveBeenCalledWith("axtn_case_assignment", {
      p_user_id: actor,
      p_operation: operation,
      p_payload: { ...payload, _principal: { kind: "user_session", id: actor } },
    });
  });
  it.each(["userId", "custodian", "owner_ref", "credentialId", "accepted", "_principal"])(
    "rejects client authority %s before RPC",
    async (key) => {
      await expect(executeCaseWork(actor, { ...request, [key]: assignee })).rejects.toThrow();
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("denies foreign Human and automation assignment", async () => {
    await expect(
      executeCaseWork(actor, request, { kind: "user_session", id: assignee }),
    ).rejects.toThrow("PRINCIPAL_DENIED");
    await expect(executeCaseWork(actor, request)).rejects.toThrow("AUTHENTICATED_HUMAN_REQUIRED");
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each([
    { assigneeUserId: actor },
    { responsiblePrincipalId: null },
    { semanticRouteModelId: "model", semanticRouteProviderId: null },
    { responsiblePrincipalType: "SYSTEM" },
    { semanticRouteProviderId: { credential: "hidden" } },
    { expectedVersion: 0 },
  ])("rejects inconsistent or invalid assignment %j", (patch) => {
    expect(CaseAssignmentRequest.safeParse({ ...request, ...patch }).success).toBe(false);
  });
  it("bounds authorized views and preserves native errors", async () => {
    expect(CaseAssignmentRequest.parse({ operation: "case_access" })).toEqual({
      operation: "case_access",
      sharedOnly: false,
      offset: 0,
      limit: 50,
    });
    expect(CaseAssignmentRequest.safeParse({ operation: "case_access", limit: 201 }).success).toBe(
      false,
    );
    rpc.mockResolvedValue({ data: null, error: { message: "CASE_ASSIGNMENT_VERSION_CONFLICT" } });
    await expect(
      executeCaseWork(actor, request, { kind: "user_session", id: actor }),
    ).rejects.toThrow("VERSION_CONFLICT");
  });
});
