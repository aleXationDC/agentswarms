import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resumeApprovedSwarmRun } from "@/utils/swarmResume.functions";
import {
  documentStoredIngress,
  DOCUMENT_SUSPENDED_OUTPUT,
  DOCUMENT_COMPLETED_OUTPUT,
  DOCUMENT_FAILED_OUTPUT,
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
  writes: [] as Record<string, unknown>[],
  writeError: false,
  writeThrow: false,
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
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        update: (value: Record<string, unknown>) => {
          if (table === "swarm_run_idempotency") state.writes.push(value);
          return chain;
        },
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
        then<A = { error: { message: string } | null }, B = never>(
          resolve?: ((value: { error: { message: string } | null }) => A | PromiseLike<A>) | null,
          reject?: ((reason: unknown) => B | PromiseLike<B>) | null,
        ) {
          const result = state.writeThrow
            ? Promise.reject(new Error("ORIGINAL_DATABASE_LEAKAGE_MARKER"))
            : Promise.resolve({
                error: state.writeError ? { message: "ORIGINAL_DATABASE_LEAKAGE_MARKER" } : null,
              });
          return result.then(resolve, reject);
        },
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
  state.writes = [];
  state.writeError = false;
  state.writeThrow = false;
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
  it("minimizes successful continuation/cache while retaining native Filing preparation and Intake Case", async () => {
    state.status = "suspended";
    state.resume.mockResolvedValue({
      status: "success",
      runId,
      output: "READY_FOR_FILING ORIGINAL_TERMINAL_LEAKAGE_MARKER",
      error: null,
    });
    expect(await read()).toEqual({
      ok: true,
      status: "success",
      runId,
      output: DOCUMENT_COMPLETED_OUTPUT,
    });
    expect(state.writes).toEqual([
      expect.objectContaining({
        status: "completed",
        response: {
          status: "success",
          output: DOCUMENT_COMPLETED_OUTPUT,
          runId,
          error: null,
        },
      }),
    ]);
    expect(JSON.stringify(state.writes)).not.toContain("LEAKAGE_MARKER");
    expect(state.ensure).toHaveBeenCalledExactlyOnceWith({
      userId: owner,
      documentId: binding.documentId,
      canonical: { document_id: binding.documentId, intake_case_id: caseId },
    });
  });
  it("minimizes a failed continuation and native failed cache without Filing preparation", async () => {
    state.status = "suspended";
    state.resume.mockResolvedValue({
      status: "error",
      runId,
      output: "ORIGINAL_TERMINAL_LEAKAGE_MARKER",
      error: "ORIGINAL_ERROR_LEAKAGE_MARKER",
    });
    expect(await read()).toEqual({
      ok: true,
      status: "error",
      runId,
      output: DOCUMENT_FAILED_OUTPUT,
    });
    expect(state.writes[0]).toMatchObject({
      status: "failed",
      response: {
        status: "error",
        output: DOCUMENT_FAILED_OUTPUT,
        runId,
        error: "DOCUMENT_RUN_FAILED",
      },
    });
    expect(JSON.stringify(state.writes)).not.toContain("LEAKAGE_MARKER");
    expect(state.ensure).not.toHaveBeenCalled();
  });
  it.each(["returned", "thrown"])(
    "bounds a %s native terminal-cache persistence failure without exposing database text",
    async (failure) => {
      state.status = "suspended";
      state.writeError = failure === "returned";
      state.writeThrow = failure === "thrown";
      state.resume.mockResolvedValue({
        status: "success",
        runId,
        output: "ORIGINAL_TERMINAL_LEAKAGE_MARKER",
        error: null,
      });
      const result = await read();
      expect(result).toEqual({
        ok: false,
        error: "DOCUMENT_RUN_OUTCOME_WRITE_FAILED",
      });
      expect(JSON.stringify(result) + JSON.stringify(state.writes)).not.toContain("LEAKAGE_MARKER");
      expect(state.ensure).not.toHaveBeenCalled();
    },
  );
  it("bounds a thrown continuation error, including a fake code prefix", async () => {
    state.status = "suspended";
    state.resume.mockRejectedValue(
      new Error("DOCUMENT_RESUME_CLAIM_FAILED ORIGINAL_ERROR_LEAKAGE_MARKER"),
    );
    expect(await read()).toEqual({ ok: false, error: "DOCUMENT_RUN_FAILED" });
    expect(state.writes).toEqual([]);
    expect(state.ensure).not.toHaveBeenCalled();
  });
  it("preserves exact generic terminal continuation and cached bodies", async () => {
    state.status = "suspended";
    state.swarmId = owner;
    state.payload = {};
    state.resume.mockResolvedValue({
      status: "success",
      runId,
      output: "GENERIC_TERMINAL_BODY",
      error: null,
    });
    expect(await read()).toEqual({
      ok: true,
      status: "success",
      runId,
      output: "GENERIC_TERMINAL_BODY",
    });
    expect(state.writes[0]).toMatchObject({
      response: { status: "success", output: "GENERIC_TERMINAL_BODY", runId, error: null },
    });
  });
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
      error: "DOCUMENT_FILING_CASE_PROJECTION_FAILED",
    });
    expect(state.ensure).not.toHaveBeenCalled();
  });
  it("does not invent an Intake Case when the native owner-bound projection fails", async () => {
    state.ensure.mockRejectedValueOnce(new Error("DOCUMENT_INTAKE_CASE_REQUIRED"));
    expect(await read()).toEqual({
      ok: false,
      error: "DOCUMENT_FILING_CASE_PROJECTION_FAILED",
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
