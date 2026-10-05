import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkSwarmApproval } from "@/utils/swarmApprovals.functions";
import { DOCUMENT_MANAGEMENT_SWARM_ID } from "@/axtn/workbenches/documents/documentRegistrationAck";

const state = vi.hoisted(() => ({
  owner: "11111111-1111-4111-8111-111111111111",
  auth: true,
  run: null as { swarm_id: string } | null,
  readError: false,
  suspendError: false,
  filters: {} as Record<string, unknown>,
  approval: vi.fn(),
  checkpoint: vi.fn(),
  updates: [] as Record<string, unknown>[],
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = { inputValidator: () => chain, handler: (handler: unknown) => handler };
    return chain;
  },
}));
vi.mock("@/lib/email/mailer.server", () => ({ sendMail: vi.fn() }));
vi.mock("@/utils/swarmWorkApproval.server", () => ({
  createNativeWorkApproval: state.approval,
}));
vi.mock("@/utils/swarmCheckpoint.server", () => ({
  saveCheckpoint: state.checkpoint,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      getUser: async () => ({
        data: { user: state.auth ? { id: state.owner } : null },
        error: null,
      }),
    },
    from: () => {
      const filters: Record<string, unknown> = {};
      const chain = {
        select: () => chain,
        eq(key: string, value: unknown) {
          filters[key] = value;
          return chain;
        },
        maybeSingle: async () => {
          state.filters = filters;
          return {
            data: state.run,
            error: state.readError ? { message: "ORIGINAL_DATABASE_MARKER" } : null,
          };
        },
        update(value: Record<string, unknown>) {
          state.updates.push(value);
          return chain;
        },
        then(resolve: (value: { error: { message: string } | null }) => unknown) {
          return Promise.resolve({
            error: state.suspendError ? { message: "ORIGINAL_DATABASE_MARKER" } : null,
          }).then(resolve);
        },
      };
      return chain;
    },
  },
}));
const runId = "22222222-2222-4222-8222-222222222222";
const approvalId = "33333333-3333-4333-8333-333333333333";
const input = () => ({
  data: {
    access_token: "nonfunctional-fixture",
    run_id: runId,
    node_id: "review",
    context: { case: "fixture" },
    content: "fixture-pending",
    checkpoint: {
      ctx: { case: "fixture" },
      lastOutput: "fixture-pending",
      completedNodeIds: ["intake"],
      skippedNodeIds: [],
      deadEdgeIds: [],
      levelIndex: 1,
      suspendedNodeId: "review",
    },
  },
});
beforeEach(() => {
  state.auth = true;
  state.run = { swarm_id: DOCUMENT_MANAGEMENT_SWARM_ID };
  state.readError = false;
  state.suspendError = false;
  state.filters = {};
  state.updates = [];
  state.approval.mockReset().mockResolvedValue({ id: approvalId });
  state.checkpoint.mockReset().mockResolvedValue(undefined);
});
describe("actual native Canvas Approval DMS checkpoint binding", () => {
  it("derives DMS from authenticated owned run and retains native checkpoint/cursor", async () => {
    expect(await createWorkSwarmApproval(input())).toEqual({ id: approvalId });
    expect(state.filters).toEqual({ id: runId, user_id: state.owner });
    expect(state.checkpoint).toHaveBeenCalledExactlyOnceWith({
      userId: state.owner,
      runId,
      source: "canvas",
      depth: 0,
      checkpoint: input().data.checkpoint,
      required: "document",
    });
    expect(state.approval.mock.calls[0][0].principal).toEqual({
      kind: "user_session",
      id: state.owner,
    });
    expect(state.updates).toEqual([{ status: "suspended" }]);
  });
  it("preserves Development's required boolean checkpoint contract", async () => {
    state.run = { swarm_id: state.owner };
    await createWorkSwarmApproval(input());
    expect(state.checkpoint.mock.calls[0][0].required).toBe(true);
  });
  it.each(["missing", "error"])(
    "refuses %s owned run before Approval or checkpoint effects",
    async (failure) => {
      state.run = failure === "missing" ? null : state.run;
      state.readError = failure === "error";
      await expect(createWorkSwarmApproval(input())).rejects.toThrow("NATIVE_APPROVAL_RUN_DENIED");
      expect(state.approval).not.toHaveBeenCalled();
      expect(state.checkpoint).not.toHaveBeenCalled();
      expect(state.updates).toEqual([]);
    },
  );
  it("refuses unauthenticated input before reading the run", async () => {
    state.auth = false;
    await expect(createWorkSwarmApproval(input())).rejects.toThrow("Invalid session");
    expect(state.filters).toEqual({});
    expect(state.approval).not.toHaveBeenCalled();
  });
  it("refuses a mismatched parked node before effects", async () => {
    const args = input();
    args.data.checkpoint.suspendedNodeId = "other";
    await expect(createWorkSwarmApproval(args)).rejects.toThrow(
      "NATIVE_APPROVAL_CHECKPOINT_NODE_MISMATCH",
    );
    expect(state.approval).not.toHaveBeenCalled();
  });
  it("does not mark suspension successful when required checkpoint fails", async () => {
    state.checkpoint.mockRejectedValueOnce(new Error("DOCUMENT_CHECKPOINT_WRITE_FAILED"));
    await expect(createWorkSwarmApproval(input())).rejects.toThrow(
      "DOCUMENT_CHECKPOINT_WRITE_FAILED",
    );
    expect(state.updates).toEqual([]);
  });
  it("bounds DMS suspension storage errors", async () => {
    state.suspendError = true;
    await expect(createWorkSwarmApproval(input())).rejects.toThrow(
      "DOCUMENT_APPROVAL_SUSPENSION_FAILED",
    );
  });
  it("retains Development suspension error behavior", async () => {
    state.run = { swarm_id: state.owner };
    state.suspendError = true;
    await expect(createWorkSwarmApproval(input())).rejects.toThrow(
      "Native Approval suspension failed: ORIGINAL_DATABASE_MARKER",
    );
  });
});
