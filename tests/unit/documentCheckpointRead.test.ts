import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCheckpoint } from "@/utils/swarmCheckpoint.server";

const state = vi.hoisted(() => ({
  row: null as unknown,
  error: null as { message: string } | null,
  filters: {} as Record<string, unknown>,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      const chain = {
        select: () => chain,
        eq(key: string, value: unknown) {
          state.filters[key] = value;
          return chain;
        },
        maybeSingle: async () => ({ data: state.row, error: state.error }),
      };
      return chain;
    },
  },
}));
const valid = () => ({
  ctx: { input: "unchanged-input", registration_ack: "unchanged-ack" },
  last_output: "unchanged-output",
  completed_node_ids: ["intake"],
  skipped_node_ids: ["other"],
  dead_edge_ids: ["dead"],
  level_index: 2,
  suspended_node_id: "approval",
});
beforeEach(() => {
  state.row = valid();
  state.error = null;
  state.filters = {};
});
describe("actual strict owned native DMS checkpoint read", () => {
  it("retains every exact context/routing value without hydration or restart", async () => {
    expect(await loadCheckpoint("run", "owner", "document")).toEqual({
      ctx: valid().ctx,
      lastOutput: "unchanged-output",
      completedNodeIds: ["intake"],
      skippedNodeIds: ["other"],
      deadEdgeIds: ["dead"],
      levelIndex: 2,
      suspendedNodeId: "approval",
    });
    expect(state.filters).toEqual({ run_id: "run", user_id: "owner" });
  });
  it.each([
    null,
    {},
    { ...valid(), ctx: [] },
    { ...valid(), ctx: { input: { original: "LEAKAGE_MARKER" } } },
    { ...valid(), last_output: null },
    { ...valid(), completed_node_ids: null },
    { ...valid(), skipped_node_ids: [null] },
    { ...valid(), dead_edge_ids: [""] },
    { ...valid(), level_index: -1 },
    { ...valid(), level_index: 0.5 },
    { ...valid(), level_index: "2" },
    { ...valid(), suspended_node_id: undefined },
  ])(
    "rejects incomplete/malformed native state instead of legacy restart fallback %#",
    async (row) => {
      state.row = row;
      await expect(loadCheckpoint("run", "owner", "document")).rejects.toThrow(
        "DOCUMENT_CHECKPOINT_COMPLETE_STATE_REQUIRED",
      );
    },
  );
  it("surfaces read failure without disclosing raw database text", async () => {
    state.error = { message: "ORIGINAL_DATABASE_LEAKAGE_MARKER" };
    await expect(loadCheckpoint("run", "owner", "document")).rejects.toThrow(
      "DOCUMENT_CHECKPOINT_READ_FAILED",
    );
  });
  it("preserves the legacy generic defensive conversion", async () => {
    state.row = { ctx: { input: 7 }, level_index: -1 };
    expect(await loadCheckpoint("run", "owner")).toMatchObject({
      ctx: { input: "7" },
      lastOutput: "",
      completedNodeIds: [],
      levelIndex: 0,
    });
  });
  it("preserves generic absence behavior", async () => {
    state.row = null;
    expect(await loadCheckpoint("run", "owner")).toBeNull();
  });
});
