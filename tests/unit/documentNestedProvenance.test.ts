import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeSwarmServer, resumeSwarmRun } from "@/utils/swarmExecute.server";
import { DOCUMENT_MANAGEMENT_SWARM_ID } from "@/axtn/workbenches/documents/documentRegistrationAck";

const state = vi.hoisted(() => ({
  parentFound: true,
  parentError: false,
  queries: [] as { table: string; filters: Record<string, unknown> }[],
  graphs: new Map<string, unknown>(),
  tool: vi.fn(),
  begin: vi.fn(),
  tracer: vi.fn(),
  checkpoint: vi.fn(),
  load: vi.fn(),
  resumedRun: null as Record<string, unknown> | null,
}));
const owner = "11111111-1111-4111-8111-111111111111";
const runId = "33333333-3333-4333-8333-333333333333";
const childId = "44444444-4444-4444-8444-444444444444";
const grandchildId = "55555555-5555-4555-8555-555555555555";
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      state.queries.push({ table, filters });
      const chain = {
        select: () => chain,
        update: () => chain,
        eq(key: string, value: unknown) {
          filters[key] = value;
          return chain;
        },
        async maybeSingle() {
          if (table === "swarm_runs")
            return {
              data: state.resumedRun ?? (state.parentFound ? { id: runId } : null),
              error: state.parentError ? { message: "ORIGINAL_DATABASE_MARKER" } : null,
            };
          if (table === "swarms")
            return { data: state.graphs.get(String(filters.id)) ?? null, error: null };
          throw new Error(`Unexpected native query: ${table}`);
        },
        then(resolve: (value: { error: null }) => unknown) {
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return chain;
    },
  },
}));
vi.mock("@/utils/provenance/decision.server", () => ({ beginDecision: state.begin }));
vi.mock("@/utils/swarmCheckpoint.server", () => ({
  saveCheckpoint: state.checkpoint,
  clearCheckpoint: vi.fn(),
  loadCheckpoint: state.load,
}));
vi.mock("@/utils/observability/serverTracer.server", () => ({
  createServerSwarmTracer: state.tracer,
}));
vi.mock("@/utils/swarmNodes.server", () => ({
  runHttpNodeCore: vi.fn(),
  runToolNodeCore: state.tool,
}));
vi.mock("@/utils/internalOrigin.server", () => ({ internalRunSecret: () => "fixture-secret" }));
vi.mock("@/utils/jsSandbox.server", () => ({
  jsSandboxConfigured: async () => false,
  runSandboxedServer: vi.fn(),
  JS_SANDBOX_UNAVAILABLE: "fixture-unavailable",
}));
vi.mock("@/utils/rateLimit.server", () => ({
  envInt: (_key: string, fallback: number) => fallback,
}));
vi.mock("@/utils/swarmWorkApproval.server", () => ({ createNativeWorkApproval: vi.fn() }));
vi.mock("@/lib/chatStream", () => ({
  readChatStream: async () => "fixture-model-output",
  toolNodeEvents: () => [],
}));
const node = (id: string, data: Record<string, unknown>) => ({
  id,
  type: "swarmNode",
  position: { x: 0, y: 0 },
  data,
});
const nested = (id: string, nodes: ReturnType<typeof node>[]) => ({
  id,
  name: "fixture-child",
  user_id: owner,
  nodes,
  edges: [],
  published_nodes: nodes,
  published_edges: [],
  published_at: "2026-10-05T00:00:00Z",
});
const args = () => ({
  swarm: {
    id: DOCUMENT_MANAGEMENT_SWARM_ID,
    name: "fixture-parent",
    nodes: [node("child", { kind: "subswarm", subSwarmId: childId })],
    edges: [],
  },
  userId: owner,
  origin: "http://localhost:3000",
  input: "fixture-input",
  rejectApprovals: false,
  source: "api" as const,
});
beforeEach(() => {
  state.parentFound = true;
  state.parentError = false;
  state.queries = [];
  state.resumedRun = null;
  state.load.mockReset();
  state.graphs.clear();
  state.graphs.set(
    childId,
    nested(childId, [node("grandchild", { kind: "subswarm", subSwarmId: grandchildId })]),
  );
  state.graphs.set(
    grandchildId,
    nested(grandchildId, [
      node("agent", { kind: "agent", model: "existing-model", provider: "existing-provider" }),
    ]),
  );
  state.begin.mockReset();
  state.tool.mockReset().mockResolvedValue({ ok: true, result: "fixture-tool-output" });
  state.checkpoint.mockReset().mockResolvedValue(undefined);
  state.tracer.mockReset().mockResolvedValue({
    runId,
    startStep: vi.fn(),
    finishStep: vi.fn(),
    recordEdge: vi.fn(),
    finish: vi.fn(),
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("fixture-stream")));
});

const parked = () => ({
  id: runId,
  user_id: owner,
  swarm_id: DOCUMENT_MANAGEMENT_SWARM_ID,
  swarm_name: "fixture-parent",
  status: "suspended",
  input_prompt: "unchanged",
  swarm_snapshot: {
    nodes: [
      node("intake", { kind: "tool", toolId: "sql_query" }),
      node("approval", { kind: "approval" }),
    ],
    edges: [{ id: "route", source: "intake", target: "approval" }],
  },
});
const checkpoint = () => ({
  ctx: { input: "unchanged", registration_ack: "fixture" },
  lastOutput: "unchanged",
  completedNodeIds: ["intake"],
  skippedNodeIds: [] as string[],
  deadEdgeIds: [] as string[],
  levelIndex: 2,
  suspendedNodeId: "approval",
});
describe("actual native DMS resume fails before effectful execution on routing loss", () => {
  beforeEach(() => {
    state.resumedRun = parked();
    state.load.mockResolvedValue(checkpoint());
  });
  it.each([
    { completedNodeIds: ["unknown"] },
    { completedNodeIds: ["intake", "intake"] },
    { completedNodeIds: ["approval"] },
    { skippedNodeIds: ["approval"] },
    { skippedNodeIds: ["intake"] },
    { deadEdgeIds: ["unknown"] },
    { levelIndex: 9 },
    { levelIndex: 0 },
    { levelIndex: 1 },
    { completedNodeIds: [] },
    { suspendedNodeId: "intake" },
    { suspendedNodeId: null },
  ])("refuses stale/inconsistent routing %#", async (patch) => {
    state.load.mockResolvedValue({ ...checkpoint(), ...patch });
    await expect(
      resumeSwarmRun({ runId, userId: owner, origin: "http://localhost" }),
    ).rejects.toThrow("DOCUMENT_RESUME_EXACT_ROUTING_REQUIRED");
    expect(state.load).toHaveBeenCalledWith(runId, owner, "document");
    expect(state.tracer).not.toHaveBeenCalled();
    expect(state.tool).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it("refuses an absent DMS checkpoint without a new run", async () => {
    state.load.mockResolvedValue(null);
    await expect(
      resumeSwarmRun({ runId, userId: owner, origin: "http://localhost" }),
    ).rejects.toThrow("DOCUMENT_CHECKPOINT_COMPLETE_STATE_REQUIRED");
    expect(state.tracer).not.toHaveBeenCalled();
  });
  it("refuses a DMS run that is no longer suspended", async () => {
    state.resumedRun = { ...parked(), status: "running" };
    await expect(
      resumeSwarmRun({ runId, userId: owner, origin: "http://localhost" }),
    ).rejects.toThrow("DOCUMENT_RESUME_SUSPENDED_PARENT_REQUIRED");
    expect(state.load).not.toHaveBeenCalled();
  });
  it("refuses a missing DMS graph without executing", async () => {
    state.resumedRun = { ...parked(), swarm_snapshot: { nodes: [], edges: [] } };
    await expect(
      resumeSwarmRun({ runId, userId: owner, origin: "http://localhost" }),
    ).rejects.toThrow("DOCUMENT_RESUME_GRAPH_REQUIRED");
    expect(state.tracer).not.toHaveBeenCalled();
  });
  it("preserves generic missing-checkpoint behavior", async () => {
    state.resumedRun = { ...parked(), swarm_id: owner };
    state.load.mockResolvedValue(null);
    expect(await resumeSwarmRun({ runId, userId: owner, origin: "http://localhost" })).toBeNull();
    expect(state.load).toHaveBeenCalledWith(runId, owner, false);
  });
  it("resumes the same valid parked run without repeating completed Intake effects", async () => {
    const result = await resumeSwarmRun({
      runId,
      userId: owner,
      origin: "http://localhost",
      decision: { approved: true },
    });
    expect(result).toMatchObject({ status: "success", runId, output: "unchanged" });
    expect(state.tool).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(state.begin).not.toHaveBeenCalled();
    expect(state.tracer).toHaveBeenCalledOnce();
    expect(state.tracer.mock.calls[0][0].resumeRunId).toBe(runId);
    expect(state.checkpoint.mock.calls.at(-1)?.[0].checkpoint).toMatchObject({
      ctx: { input: "unchanged", registration_ack: "fixture" },
      completedNodeIds: ["intake", "approval"],
      skippedNodeIds: [],
      deadEdgeIds: [],
      levelIndex: 2,
    });
  });
  it("round-trips an actual executor suspension checkpoint and does not repeat the preceding tool", async () => {
    const snapshot = parked().swarm_snapshot;
    snapshot.nodes[1].data.approvalWork = { fixture: true };
    const initial = await executeSwarmServer({
      ...args(),
      swarm: { id: DOCUMENT_MANAGEMENT_SWARM_ID, name: "fixture", ...snapshot },
    });
    expect(initial).toMatchObject({ status: "suspended", runId });
    expect(state.tool).toHaveBeenCalledOnce();
    const stored = state.checkpoint.mock.calls.at(-1)?.[0].checkpoint;
    expect(stored).toMatchObject({
      completedNodeIds: ["intake"],
      levelIndex: 2,
      suspendedNodeId: "approval",
    });
    state.resumedRun = { ...parked(), swarm_snapshot: snapshot };
    state.load.mockResolvedValue(stored);
    const resumed = await resumeSwarmRun({
      runId,
      userId: owner,
      origin: "http://localhost",
      decision: { approved: true },
    });
    expect(resumed).toMatchObject({ status: "success", runId });
    expect(state.tool).toHaveBeenCalledOnce();
    expect(state.begin).toHaveBeenCalledOnce();
    expect(state.tracer).toHaveBeenCalledTimes(2);
    expect(state.tracer.mock.calls[1][0].resumeRunId).toBe(runId);
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("actual nested native headless DMS provenance", () => {
  it("retains the owned Parent run through two nested Swarms into the actual chat request", async () => {
    const result = await executeSwarmServer(args());
    expect(result).toMatchObject({ status: "success", runId, output: "fixture-model-output" });
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(request).toMatchObject({
      decisionId: runId,
      internalUserId: owner,
      model: "existing-model",
      provider: "existing-provider",
    });
    expect(state.queries.filter((query) => query.table === "swarm_runs")).toEqual([
      {
        table: "swarm_runs",
        filters: { id: runId, user_id: owner, swarm_id: DOCUMENT_MANAGEMENT_SWARM_ID },
      },
      {
        table: "swarm_runs",
        filters: { id: runId, user_id: owner, swarm_id: DOCUMENT_MANAGEMENT_SWARM_ID },
      },
    ]);
    expect(state.tracer).toHaveBeenCalledTimes(1);
    expect(state.begin).toHaveBeenCalledTimes(1);
    expect(state.begin).toHaveBeenCalledWith({
      userId: owner,
      kind: "swarm_run",
      id: runId,
      rootRef: runId,
    });
  });
  it("preserves generic nested chat behavior without inventing a DMS identity", async () => {
    const options = args();
    options.swarm.id = owner;
    expect((await executeSwarmServer(options)).status).toBe("success");
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(request).not.toHaveProperty("decisionId");
    expect(state.queries.filter((query) => query.table === "swarm_runs")).toEqual([]);
    expect(state.tracer).toHaveBeenCalledTimes(1);
  });
  it.each(["tool", "retrieve"])(
    "retains Parent provenance and existing owner-scoped %s authority in a nested call",
    async (kind) => {
      state.graphs.set(
        grandchildId,
        nested(grandchildId, [
          node("data", { kind, toolId: "sql_query", knowledgeBaseId: childId }),
        ]),
      );
      expect(await executeSwarmServer(args())).toMatchObject({
        status: "success",
        runId,
        output: "fixture-tool-output",
      });
      expect(state.tool).toHaveBeenCalledTimes(1);
      expect(state.tool.mock.calls[0][0]).toMatchObject({
        userId: owner,
        scopeUserId: owner,
        decisionId: runId,
      });
      expect(state.tool.mock.calls[0][1].tool_id).toBe(kind === "tool" ? "sql_query" : "kb_search");
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it.each(["missing", "error"])(
    "refuses a %s persisted Parent before nested model effects",
    async (failure) => {
      state.parentFound = failure !== "missing";
      state.parentError = failure === "error";
      const result = await executeSwarmServer(args());
      expect(result.status).toBe("error");
      expect(result.error).toContain("DOCUMENT_PROVENANCE_OWNED_PARENT_REQUIRED");
      expect(result.error).not.toContain("ORIGINAL_DATABASE_MARKER");
      expect(fetch).not.toHaveBeenCalled();
      expect(state.tracer).toHaveBeenCalledTimes(1);
    },
  );
});
