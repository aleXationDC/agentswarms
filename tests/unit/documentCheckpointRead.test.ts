import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadCheckpoint, saveCheckpoint } from "@/utils/swarmCheckpoint.server";

const state = vi.hoisted(() => ({
  row: null as unknown,
  error: null as { message: string } | null,
  filters: {} as Record<string, unknown>,
  thrown: false,
  writes: [] as { row: Record<string, unknown>; options: unknown }[],
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      const chain = {
        select: () => chain,
        upsert(row: Record<string, unknown>, options: unknown) {
          state.writes.push({ row, options });
          return chain;
        },
        eq(key: string, value: unknown) {
          state.filters[key] = value;
          return chain;
        },
        async maybeSingle() {
          if (state.thrown) throw new Error("ORIGINAL_DATABASE_LEAKAGE_MARKER");
          return { data: state.row, error: state.error };
        },
        then(
          resolve: (value: { error: typeof state.error }) => unknown,
          reject: (error: Error) => unknown,
        ) {
          return (
            state.thrown
              ? Promise.reject(new Error("ORIGINAL_DATABASE_LEAKAGE_MARKER"))
              : Promise.resolve({ error: state.error })
          ).then(resolve, reject);
        },
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
  state.thrown = false;
  state.writes = [];
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
  it("converts thrown DMS read errors to content-free codes", async () => {
    state.thrown = true;
    await expect(loadCheckpoint("run", "owner", "document")).rejects.toThrow(
      "DOCUMENT_CHECKPOINT_READ_FAILED",
    );
  });
});

const writeArgs = () => ({
  runId: "run",
  userId: "owner",
  source: "api",
  depth: 0,
  required: "document" as const,
  checkpoint: {
    ctx: valid().ctx,
    lastOutput: valid().last_output,
    completedNodeIds: valid().completed_node_ids,
    skippedNodeIds: valid().skipped_node_ids,
    deadEdgeIds: valid().dead_edge_ids,
    levelIndex: 2,
    suspendedNodeId: "approval",
  },
});
describe("actual required native DMS checkpoint write", () => {
  it("preserves exact native routing/context and the same run-key upsert", async () => {
    await saveCheckpoint(writeArgs());
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({
      row: { ...valid(), run_id: "run", user_id: "owner", source: "api", depth: 0 },
      options: { onConflict: "run_id" },
    });
  });
  it("accepts an intermediate DMS checkpoint without a suspended node", async () => {
    await saveCheckpoint({
      ...writeArgs(),
      checkpoint: { ...writeArgs().checkpoint, suspendedNodeId: null },
    });
    expect(state.writes[0].row.suspended_node_id).toBeNull();
    expect(state.writes[0].row.suspended_at).toBeNull();
  });
  it("rejects invalid state before any write", async () => {
    await expect(
      saveCheckpoint({
        ...writeArgs(),
        checkpoint: { ...writeArgs().checkpoint, levelIndex: -1 },
      }),
    ).rejects.toThrow("DOCUMENT_CHECKPOINT_COMPLETE_STATE_REQUIRED");
    expect(state.writes).toEqual([]);
  });
  it.each(["answer", "throw"])(
    "surfaces %s storage failure without raw text/logging",
    async (failure) => {
      state.thrown = failure === "throw";
      state.error = failure === "answer" ? { message: "ORIGINAL_DATABASE_LEAKAGE_MARKER" } : null;
      const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
      try {
        await expect(saveCheckpoint(writeArgs())).rejects.toThrow(
          "DOCUMENT_CHECKPOINT_WRITE_FAILED",
        );
        expect(log).not.toHaveBeenCalled();
      } finally {
        log.mockRestore();
      }
    },
  );
  it("preserves generic best-effort write failure notification", async () => {
    state.error = { message: "generic-storage-failure" };
    const log = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      await expect(saveCheckpoint({ ...writeArgs(), required: false })).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledWith("[swarmCheckpoint] save failed:", "generic-storage-failure");
    } finally {
      log.mockRestore();
    }
  });
  it("preserves protected Development required failures", async () => {
    state.error = { message: "development-storage-failure" };
    await expect(saveCheckpoint({ ...writeArgs(), required: true })).rejects.toThrow(
      "Native Approval checkpoint failed: development-storage-failure",
    );
  });
});
