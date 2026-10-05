import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CaseEnvironmentRequest,
  ExternalCaseReference,
} from "@/axtn/workbenches/cases/caseEnvironmentContract";
import { CaseRequest } from "@/axtn/workbenches/documents/documentWorkContract";
import { executeCaseWork } from "@/axtn/workbenches/cases/work.server";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
const owner = "11111111-1111-4111-8111-111111111111";
const caseId = "22222222-2222-4222-8222-222222222222";
const request = {
  operation: "external_references",
  caseId,
  transitionKey: "reference-01",
  expectedVersion: 0,
  patch: {
    external_environment_id: "  Env-01 ",
    external_ref_id: "0001/Ä",
    external_parent_ref_id: null,
  },
};

describe("one native Case external environment contract", () => {
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: { case_id: caseId }, error: null }));
  it("uses the existing authenticated Case entrypoint and exact opaque strings", async () => {
    expect(CaseRequest.safeParse(request).success).toBe(true);
    await executeCaseWork(owner, request, { kind: "user_session", id: owner });
    expect(rpc).toHaveBeenCalledWith("axtn_case_environment", {
      p_user_id: owner,
      p_operation: "external_references",
      p_payload: {
        caseId,
        transitionKey: request.transitionKey,
        expectedVersion: 0,
        patch: request.patch,
        _principal: { kind: "user_session", id: owner },
      },
    });
  });
  it.each([
    "",
    " ",
    "\u00a0",
    "\ufeff",
    "ref\n",
    "ref\u007f",
    "ref\u0085",
    "x".repeat(501),
    "😀".repeat(501),
  ])("rejects invalid opaque value %j without normalization", (value) => {
    expect(ExternalCaseReference.safeParse(value).success).toBe(false);
  });
  it("retains absence, explicit null, independent external parent and length boundary", () => {
    const value = CaseEnvironmentRequest.parse({
      ...request,
      patch: { external_parent_ref_id: "External Parent 0001" },
    });
    expect(value).toEqual({
      ...request,
      patch: { external_parent_ref_id: "External Parent 0001" },
    });
    expect(ExternalCaseReference.parse("x".repeat(500))).toHaveLength(500);
    expect(ExternalCaseReference.parse("😀".repeat(500))).toBe("😀".repeat(500));
  });
  it.each(["owner", "actor", "accepted", "credentialId", "userId"])(
    "rejects forged %s",
    async (field) => {
      await expect(executeCaseWork(owner, { ...request, [field]: owner })).rejects.toThrow();
      expect(rpc).not.toHaveBeenCalled();
    },
  );
  it("rejects a foreign session and automated integration confirmation before RPC", async () => {
    await expect(
      executeCaseWork(owner, request, { kind: "user_session", id: caseId }),
    ).rejects.toThrow("PRINCIPAL_DENIED");
    await expect(
      executeCaseWork(
        owner,
        {
          operation: "environment_binding",
          integrationId: caseId,
          environmentId: "Env",
          expectedVersion: 0,
          transitionKey: "bind",
          enabled: true,
        },
        { kind: "swarm", id: owner },
      ),
    ).rejects.toThrow("AUTHENTICATED_HUMAN_REQUIRED");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("surfaces native denial rather than a successful empty result", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "CASE_ENVIRONMENT_VERSION_CONFLICT" } });
    await expect(executeCaseWork(owner, request)).rejects.toThrow("VERSION_CONFLICT");
  });
});
