import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeSwarmServer } from "@/utils/swarmExecute.server";
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
        eq(key: string, value: unknown) {
          filters[key] = value;
          return chain;
        },
        async maybeSingle() {
          if (table === "swarm_runs")
            return {
              data: state.parentFound ? { id: runId } : null,
              error: state.parentError ? { message: "ORIGINAL_DATABASE_MARKER" } : null,
            };
          if (table === "swarms")
            return { data: state.graphs.get(String(filters.id)) ?? null, error: null };
          throw new Error(`Unexpected native query: ${table}`);
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
  loadCheckpoint: vi.fn(),
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
