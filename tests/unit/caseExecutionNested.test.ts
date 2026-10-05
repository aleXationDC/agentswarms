import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SwarmCheckpoint } from "@/lib/swarmCheckpoint";
import type { CaseRunContext } from "@/axtn/workbenches/cases/caseExecution.server";

const fixture = vi.hoisted(() => ({
  runs: new Map<string, Record<string, unknown>>(),
  checkpoints: new Map<string, { checkpoint: SwarmCheckpoint; depth: number }>(),
  swarms: new Map<string, Record<string, unknown>>(),
  effects: vi.fn(async () => ({ ok: true, result: "synthetic effect" })),
  fetch: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => {
  class Query {
    private filters: Record<string, unknown> = {};
    private changes: Record<string, unknown> | null = null;
    constructor(private table: string) {}
    select() {
      return this;
    }
    eq(key: string, value: unknown) {
      this.filters[key] = value;
      return this;
    }
    update(changes: Record<string, unknown>) {
      this.changes = changes;
      return this;
    }
    async insert() {
      return { error: null };
    }
    async maybeSingle() {
      let rows: Record<string, unknown>[] =
        this.table === "swarm_runs"
          ? [...fixture.runs.values()]
          : this.table === "swarms"
            ? [...fixture.swarms.values()]
            : this.table === "swarm_run_checkpoints"
              ? [...fixture.checkpoints].map(([id, value]) => ({
                  run_id: id,
                  user_id: fixture.runs.get(id)?.user_id,
                  depth: value.depth,
                }))
              : [];
      rows = rows.filter((row) =>
        Object.entries(this.filters).every(([key, value]) => row[key] === value),
      );
      const row = rows[0] ?? null;
      if (row && this.changes) Object.assign(row, this.changes);
      return { data: row, error: null };
    }
    then(resolve: (value: unknown) => unknown) {
      return this.maybeSingle().then(resolve);
    }
  }
  return { supabaseAdmin: { from: (table: string) => new Query(table) } };
});
vi.mock("@/utils/observability/serverTracer.server", () => ({
  createServerSwarmTracer: async (args: {
    userId: string;
    swarmId: string;
    swarmSnapshot: unknown;
    inputPrompt: string;
    resumeRunId?: string;
  }) => {
    const id = args.resumeRunId ?? crypto.randomUUID();
    const row = fixture.runs.get(id) ?? {
      id,
      user_id: args.userId,
      swarm_id: args.swarmId,
      swarm_snapshot: args.swarmSnapshot,
      input_prompt: args.inputPrompt,
      cancel_requested: false,
    };
    row.status = "running";
    fixture.runs.set(id, row);
    return {
      runId: id,
      startStep: vi.fn(),
      finishStep: vi.fn(),
      recordEdge: vi.fn(),
      finish: async (result: { status: string; finalOutput?: string }) => {
        row.status = result.status;
        row.output_summary = result.finalOutput?.slice(0, 32);
      },
    };
  },
}));
vi.mock("@/utils/swarmCheckpoint.server", () => ({
  saveCheckpoint: async (args: { runId: string; checkpoint: SwarmCheckpoint; depth: number }) => {
    fixture.checkpoints.set(args.runId, {
      checkpoint: structuredClone(args.checkpoint),
      depth: args.depth,
    });
  },
  loadCheckpoint: async (id: string) => fixture.checkpoints.get(id)?.checkpoint ?? null,
  clearCheckpoint: async (id: string) => {
    fixture.checkpoints.delete(id);
  },
}));
vi.mock("@/axtn/workbenches/cases/caseExecution.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/axtn/workbenches/cases/caseExecution.server")>()),
  blockCaseRun: vi.fn(),
  registerCaseRun: async (_user: string, id: string, context: CaseRunContext) => {
    Object.assign(fixture.runs.get(id) ?? {}, {
      case_id: context.caseId,
      case_parent_run_id: context.parentRunId ?? null,
      case_parent_node_id: context.parentNodeId ?? null,
      context,
    });
  },
  readCaseRunContext: async (_user: string, id: string) => fixture.runs.get(id)?.context ?? null,
}));
vi.mock("@/utils/swarmNodes.server", () => ({
  runToolNodeCore: fixture.effects,
  runHttpNodeCore: vi.fn(),
}));
vi.mock("@/utils/provenance/decision.server", () => ({
  beginDecision: (args: { id?: string }) => args.id ?? crypto.randomUUID(),
}));
const { executeSwarmServer, resumeSwarmRun } = await import("@/utils/swarmExecute.server");
const { blockCaseRun } = await import("@/axtn/workbenches/cases/caseExecution.server");

const owner = "88111111-1111-4111-8111-111111111111";
const parentSwarm = "88222222-2222-4222-8222-222222222222";
const childSwarm = "88333333-3333-4333-8333-333333333333";
const fullResult = "synthetic-result-".repeat(500);
const context: CaseRunContext = {
  caseId: "88444444-4444-4444-8444-444444444444",
  principal: { kind: "user_session", id: owner },
};
const node = (id: string, data: Record<string, unknown>) => ({
  id,
  position: { x: 0, y: 0 },
  data,
});
const childNodes = [
  node("effect", { kind: "tool", label: "Synthetic side effect", toolId: "sql_query" }),
  node("review", { kind: "approval", label: "Synthetic flow approval", approvalStrategy: "human" }),
  node("result", {
    kind: "set_var",
    label: "Full result",
    stateAssignments: [{ key: "result", value: fullResult }],
  }),
];
const childEdges = [
  { id: "e1", source: "effect", target: "review" },
  { id: "e2", source: "review", target: "result" },
];
const parent = {
  id: parentSwarm,
  name: "Synthetic parent",
  nodes: [node("child", { kind: "subswarm", label: "Native child", subSwarmId: childSwarm })],
  edges: [],
};

describe("Case-bound native subswarm checkpoint/readback", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.runs.clear();
    fixture.checkpoints.clear();
    fixture.swarms.clear();
    fixture.swarms.set(childSwarm, {
      id: childSwarm,
      name: "Synthetic child",
      user_id: owner,
      nodes: childNodes,
      edges: childEdges,
    });
    vi.stubGlobal("fetch", fixture.fetch);
  });
  it("parks both runs and does not re-create or approve a parked child when the parent resumes", async () => {
    const first = await executeSwarmServer({
      swarm: parent,
      userId: owner,
      origin: "http://fixture.invalid",
      input: "",
      source: "api",
      caseExecution: context,
    });
    expect(first.status).toBe("suspended");
    expect(first.runId).toBeTruthy();
    expect(fixture.runs.size).toBe(2);
    expect(fixture.effects).toHaveBeenCalledTimes(1);
    const rootId = first.runId!;
    const child = [...fixture.runs.values()].find((row) => row.case_parent_run_id === rootId);
    expect(child).toMatchObject({ status: "suspended", case_parent_node_id: "child" });
    const parentAgain = await resumeSwarmRun({
      runId: rootId,
      userId: owner,
      origin: "http://fixture.invalid",
    });
    expect(parentAgain?.status).toBe("suspended");
    expect(child?.status).toBe("suspended");
    expect(fixture.runs.size).toBe(2);
    expect(fixture.effects).toHaveBeenCalledTimes(1);
    expect(fixture.fetch).not.toHaveBeenCalled();
  });
  it("continues from the same child, retaining full output instead of the truncated trace summary", async () => {
    const first = await executeSwarmServer({
      swarm: parent,
      userId: owner,
      origin: "http://fixture.invalid",
      input: "",
      source: "api",
      caseExecution: context,
    });
    const rootId = first.runId!;
    const childId = [...fixture.runs].find(([, row]) => row.case_parent_run_id === rootId)![0];
    const child = await resumeSwarmRun({
      runId: childId,
      userId: owner,
      origin: "http://fixture.invalid",
      decision: { approved: true },
    });
    expect(child?.status).toBe("success");
    expect(child?.output).toContain(fullResult);
    expect(fixture.checkpoints.get(childId)?.depth).toBe(1);
    const parentResult = await resumeSwarmRun({
      runId: rootId,
      userId: owner,
      origin: "http://fixture.invalid",
    });
    expect(parentResult?.status).toBe("success");
    expect(parentResult?.output).toBe(child?.output);
    expect(parentResult?.output.length).toBeGreaterThan(4000);
    expect(fixture.runs.size).toBe(2);
    expect(fixture.effects).toHaveBeenCalledTimes(1);
    expect(fixture.fetch).not.toHaveBeenCalled();
  });
  it("a typed stream failure blocks the same Case instead of continuing with partial success", async () => {
    vi.stubEnv("INTERNAL_RUN_SECRET", "synthetic-unit-run-secret");
    fixture.fetch.mockResolvedValue(
      new Response(
        'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n' +
          'event: error\ndata: {"error":"PERSONAL_PLAN_LIMIT_REACHED"}\n\n',
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    const result = await executeSwarmServer({
      swarm: {
        ...parent,
        nodes: [node("agent", { kind: "agent", label: "Synthetic failure", onError: "continue" })],
      },
      userId: owner,
      origin: "http://fixture.invalid",
      input: "",
      source: "api",
      caseExecution: context,
    });
    expect(result.status).toBe("error");
    expect(result.error).toBe("PERSONAL_PLAN_LIMIT_REACHED");
    expect(blockCaseRun).toHaveBeenCalledWith(owner, result.runId, "PERSONAL_PLAN_LIMIT_REACHED");
    expect(fixture.fetch).toHaveBeenCalledOnce();
    expect(fixture.effects).not.toHaveBeenCalled();
  });
});
