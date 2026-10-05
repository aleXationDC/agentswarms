import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaseRequest } from "@/axtn/workbenches/documents/documentWorkContract";
import { executeCaseWork } from "@/axtn/workbenches/cases/work.server";
import { CaseProcessingRequest } from "@/axtn/workbenches/cases/caseProcessingContract";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
const owner = "11111111-1111-4111-8111-111111111111";
const request = {
  operation: "processing",
  caseId: "22222222-2222-4222-8222-222222222222",
  expectedVersion: 0,
  transitionKey: "state-1",
  reasonCode: "TEST",
  patch: { processing_stage: "WAITING_APPROVAL", waiting_reason: "APPROVAL" },
};
describe("native Processing and scoped query adapter", () => {
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: { ok: true }, error: null }));
  it("uses the same native Case entrypoint with the authenticated actor", async () => {
    expect(CaseRequest.parse(request)).toEqual(request);
    await executeCaseWork(owner, request, { kind: "user_session", id: owner });
    const { operation: _operation, ...payload } = request;
    expect(rpc).toHaveBeenCalledWith("axtn_case_processing", {
      p_user_id: owner,
      p_operation: "processing",
      p_payload: { ...payload, _principal: { kind: "user_session", id: owner } },
    });
  });
  it.each(["accepted", "credentialId", "owner_ref", "status", "processing_mode"])(
    "does not turn %s into processing authority",
    async (field) => {
      await expect(
        executeCaseWork(owner, { ...request, patch: { [field]: "OPEN" } }),
      ).rejects.toThrow();
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("defaults bounded paging but never caller custody or hidden ancestors", () => {
    expect(CaseProcessingRequest.parse({ operation: "subtree" })).toEqual({
      operation: "subtree",
      offset: 0,
      limit: 50,
    });
    expect(CaseProcessingRequest.safeParse({ operation: "subtree", userId: owner }).success).toBe(
      false,
    );
    expect(CaseProcessingRequest.safeParse({ operation: "subtree", limit: 201 }).success).toBe(
      false,
    );
  });
  it("requires positive bounded ordinal version and canonical evidence references", () => {
    expect(
      CaseProcessingRequest.safeParse({ ...request, expectedVersion: Number.MAX_SAFE_INTEGER + 1 })
        .success,
    ).toBe(false);
    expect(
      CaseProcessingRequest.safeParse({
        ...request,
        patch: {
          required_capability_ref: {
            kind: "contract",
            repository: "aXtn/aXtn-agentswarms",
            id: "../secret",
          },
        },
      }).success,
    ).toBe(false);
  });
  it("does not accept a foreign human or mask native conflicts", async () => {
    await expect(
      executeCaseWork(owner, request, {
        kind: "user_session",
        id: request.caseId,
      }),
    ).rejects.toThrow("PRINCIPAL_DENIED");
    rpc.mockResolvedValue({ data: null, error: { message: "CASE_PROCESSING_VERSION_CONFLICT" } });
    await expect(executeCaseWork(owner, request)).rejects.toThrow("VERSION_CONFLICT");
  });
});
