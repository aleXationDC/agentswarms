import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resumeApprovedSwarmRun } from "@/utils/swarmResume.functions";
import {
  documentStoredIngress,
  DOCUMENT_SUSPENDED_OUTPUT,
} from "@/axtn/workbenches/documents/documentPersistence.server";

const state = vi.hoisted(() => ({
  payload: null as unknown,
  input: "",
  output: "READY_FOR_FILING",
  ensure: vi.fn(),
  status: "success",
  swarmId: "9b9ea6c2-a554-4fa7-9c40-908dad632ae7",
  resume: vi.fn(),
  load: vi.fn(),
}));
const owner = "11111111-1111-4111-8111-111111111111";
const reviewer = "66666666-6666-4666-8666-666666666666";
const caseId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const approvalId = "44444444-4444-4444-8444-444444444444";
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = { inputValidator: () => chain, handler: (handler: unknown) => handler };
    return chain;
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: reviewer } } }) },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data: {
            id: approvalId,
            status: "approved",
            swarm_run_id: runId,
            user_id: owner,
            payload: state.payload,
            decided_by: reviewer,
          },
        }),
      };
      return chain;
    },
  }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data: {
            id: runId,
            user_id: owner,
            status: state.status,
            swarm_id: state.swarmId,
            input_prompt: state.input,
            final_output: state.output,
            swarm_snapshot: {},
          },
        }),
      };
      return chain;
    },
  },
}));
vi.mock("@/axtn/workbenches/cases/caseManagement.server", () => ({
  ensureCaseForAcceptance: state.ensure,
}));
vi.mock("@/utils/swarmExecute.server", () => ({ resumeSwarmRun: state.resume }));
vi.mock("@/utils/swarmCheckpoint.server", () => ({ loadCheckpoint: state.load }));
vi.mock("@/utils/swarmWorkApproval.server", () => ({
  assertNativeApprovalResume: vi.fn(),
  createNativeWorkApproval: vi
    .fn()
    .mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444" }),
}));
const binding = {
  caseId,
  attemptId: "55555555-5555-4555-8555-555555555555",
  inputHash: "a".repeat(64),
  documentId: "fixture-document",
  sourceRef: "fixture:source",
  sourceRevision: "v1",
  decisionId: "77777777-7777-4777-8777-777777777777",
  decisionRevision: "b".repeat(64),
  policyRevision: null,
  graphHash: "c".repeat(64),
  evidenceHash: "d".repeat(64),
  operationId: "fixture-file",
  proposalOperation: "FILE",
  nodeId: "review",
};
beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "http://localhost");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "nonfunctional-fixture");
  state.payload = { axtnDocument: binding };
  state.status = "success";
  state.swarmId = "9b9ea6c2-a554-4fa7-9c40-908dad632ae7";
  state.load.mockReset().mockResolvedValue({ suspendedNodeId: "review", ctx: {} });
  state.resume.mockReset().mockResolvedValue({
    status: "suspended",
    runId,
    output: "ORIGINAL_PENDING_LEAKAGE_MARKER",
    error: null,
  });
  state.input = documentStoredIngress(
    owner,
    JSON.stringify({
      business_request_id: "fixture-request",
      idempotency_key: "fixture-delivery",
      source_type: "fixture",
      source_ref: "fixture:source",
      source_revision: "v1",
      source_identity: {},
      privacy: "NO_AI",
      technical: { original_sha256: "e".repeat(64) },
    }),
  );
  state.output = "READY_FOR_FILING";
  state.ensure.mockReset().mockResolvedValue({ caseId, reusedIntakeCase: true });
});
afterEach(() => vi.unstubAllEnvs());
const read = () =>
  resumeApprovedSwarmRun({
    data: { access_token: "nonfunctional-fixture", approval_id: approvalId },
  });
describe("actual resume handler native filing lineage with minimized ingress", () => {
  it("omits DMS free output when continuation parks at another native Approval", async () => {
    state.status = "suspended";
    expect(await read()).toEqual({
      ok: true,
      status: "suspended",
      runId,
      output: DOCUMENT_SUSPENDED_OUTPUT,
    });
    expect(state.ensure).not.toHaveBeenCalled();
  });
  it("preserves non-DMS pending continuation output", async () => {
    state.status = "suspended";
    state.swarmId = owner;
    state.payload = {};
    expect(await read()).toEqual({
      ok: true,
      status: "suspended",
      runId,
      output: "ORIGINAL_PENDING_LEAKAGE_MARKER",
    });
    expect(state.ensure).not.toHaveBeenCalled();
  });
  it("recovers the existing Intake Case from protected native approval, not minimized prompt guesses", async () => {
    expect(await read()).toEqual({ ok: true, status: "success", runId, output: "" });
    expect(state.ensure).toHaveBeenCalledExactlyOnceWith({
      userId: owner,
      documentId: binding.documentId,
      canonical: { document_id: binding.documentId, intake_case_id: caseId },
    });
    expect(state.ensure.mock.calls[0][0].userId).not.toBe(reviewer);
  });
  it("ignores conflicting caller/prompt identities when protected native binding exists", async () => {
    state.input = JSON.stringify({ document_id: "forged-document", intake_case_id: approvalId });
    expect((await read()).ok).toBe(true);
    expect(state.ensure.mock.calls[0][0].canonical.intake_case_id).toBe(caseId);
    expect(state.ensure.mock.calls[0][0].documentId).toBe(binding.documentId);
  });
  it("rejects malformed native binding explicitly rather than falling back to raw prompt identity", async () => {
    state.payload = { axtnDocument: { ...binding, inputHash: "wrong" } };
    state.input = JSON.stringify({ document_id: "forged-document" });
    expect(await read()).toEqual({
      ok: false,
      error: "Filing acceptance had no valid native Document binding.",
    });
    expect(state.ensure).not.toHaveBeenCalled();
  });
  it("does not invent an Intake Case when the native owner-bound projection fails", async () => {
    state.ensure.mockRejectedValueOnce(new Error("DOCUMENT_INTAKE_CASE_REQUIRED"));
    expect(await read()).toEqual({
      ok: false,
      error: "Case acceptance failed: DOCUMENT_INTAKE_CASE_REQUIRED",
    });
  });
  it("keeps legacy non-DMS acceptance-context compatibility", async () => {
    state.payload = {};
    state.input = JSON.stringify({
      nested: { document_id: binding.documentId, intake_case_id: caseId },
    });
    expect((await read()).ok).toBe(true);
    expect(state.ensure).toHaveBeenCalledExactlyOnceWith({
      userId: owner,
      documentId: binding.documentId,
      canonical: { document_id: binding.documentId, intake_case_id: caseId },
    });
  });
  it("does not treat an ordinary completed outcome as a Filing acceptance", async () => {
    state.output = "completed without filing";
    expect((await read()).ok).toBe(true);
    expect(state.ensure).not.toHaveBeenCalled();
  });
});
