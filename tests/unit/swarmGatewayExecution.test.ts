import type { Node } from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  checkpoint: vi.fn(),
  from: vi.fn(),
  beginDecision: vi.fn(),
  trace: {
    runId: "synthetic-run",
    startStep: vi.fn(),
    finishStep: vi.fn(),
    finish: vi.fn(),
    recordEdge: vi.fn(),
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic-session" } } }),
    },
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: mocks.from },
}));
vi.mock("@/utils/observability/serverTracer.server", () => ({
  createServerSwarmTracer: async () => mocks.trace,
}));
vi.mock("@/utils/internalOrigin.server", () => ({
  internalRunSecret: () => "synthetic-internal-secret",
}));
vi.mock("@/utils/provenance/decision.server", () => ({ beginDecision: mocks.beginDecision }));
vi.mock("@/axtn/workbenches/cases/caseExecution.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/axtn/workbenches/cases/caseExecution.server")>()),
  readCaseRunContext: vi.fn(async () => null),
}));
vi.mock("@/utils/swarmNodes.server", () => ({
  runHttpNodeCore: vi.fn(),
  runToolNodeCore: vi.fn(),
}));
vi.mock("@/utils/jsSandbox.server", () => ({
  jsSandboxConfigured: () => false,
  runSandboxedServer: vi.fn(),
  JS_SANDBOX_UNAVAILABLE: "mock",
}));
vi.mock("@/utils/swarmCheckpoint.server", () => ({
  clearCheckpoint: vi.fn(),
  loadCheckpoint: vi.fn(),
  saveCheckpoint: mocks.checkpoint,
}));
import { runSwarm, type SwarmNodeData, type SwarmRunEvent } from "@/lib/swarmRuntime";
import { executeSwarmServer } from "@/utils/swarmExecute.server";
import { agentToNodePatch } from "@/lib/agentToSwarmNode";
import { resolveDeployedGraph } from "@/lib/swarmPublish";

const snapshot = agentToNodePatch({
  name: "Synthetic Development Builder",
  llm_provider: "openai",
  llm_model: "GLM-5.2",
  system_prompt: "Synthetic probe",
  temperature: 0.1,
  tools: {
    routeThroughGateway: true,
    builtInTools: { calculator: true },
    guardrails: { blockPII: true },
  },
}).patch;
function node(kind: SwarmNodeData["kind"], routeThroughGateway: boolean): Node<SwarmNodeData> {
  return {
    id: "probe",
    position: { x: 0, y: 0 },
    data: {
      label: "Synthetic probe",
      ...snapshot,
      kind,
      routeThroughGateway,
      evalMetrics: [
        {
          id: "coherence",
          name: "Coherence",
          enabled: true,
          weight: 1,
          description: "Synthetic metric",
        },
      ],
    },
  };
}
function stream(text = "YES"): Response {
  return new Response(
    `event: cost\ndata: {"model":"GLM-5.2","costUsd":0.002,"tokensIn":4,"tokensOut":2}\n\n` +
      `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n` +
      "data: [DONE]\n\n",
    { headers: { "Content-Type": "text/event-stream" } },
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetch.mockImplementation(async () => stream());
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe("real native executors, mocked HTTP/storage (MOCK)", () => {
  it.each(["agent", "condition", "evaluate"] as const)(
    "%s forwards the same immutable gateway/model/tools snapshot in canvas and headless",
    async (kind) => {
      const nodes = [node(kind, true)];
      if (kind === "evaluate") {
        mocks.fetch.mockImplementation(async () =>
          stream(
            JSON.stringify({
              metrics: { coherence: { score: 1, reason: "Synthetic" } },
              overall_score: 1,
              pass: true,
              summary: "Synthetic test result",
            }),
          ),
        );
      }
      const events: SwarmRunEvent[] = [];
      await runSwarm(nodes, [], {
        initialInput: "Synthetic probe",
        onEvent: (e) => events.push(e),
      });
      await executeSwarmServer({
        swarm: { id: "synthetic-swarm", name: "Synthetic", nodes, edges: [] },
        userId: "runner-a",
        origin: "https://mock.invalid",
        input: "Synthetic probe",
        source: "api",
        rejectApprovals: false,
      });
      expect(mocks.fetch).toHaveBeenCalledTimes(2);
      for (const [, options] of mocks.fetch.mock.calls) {
        const body = JSON.parse(options.body);
        expect(body).toMatchObject({
          provider: "openai",
          model: "GLM-5.2",
          routeThroughGateway: true,
        });
        expect(body.guardrails).toMatchObject({ blockPII: true });
        expect(body.enabledTools).toEqual(["calculator"]);
      }
      expect(events.some((e) => e.type === "node_done")).toBe(true);
    },
  );

  it("keeps two nodes on their own exact model IDs and opt-in flags in one run", async () => {
    const a = { ...node("agent", true), id: "a" };
    const b = {
      ...node("agent", false),
      id: "b",
      data: { ...node("agent", false).data, model: "Other-Model-1" },
    };
    const edges = [{ id: "e", source: "a", target: "b" }];
    await executeSwarmServer({
      swarm: { id: "synthetic-swarm", name: "Synthetic", nodes: [a, b], edges },
      userId: "runner-a",
      origin: "https://mock.invalid",
      input: "Synthetic probe",
      source: "api",
      rejectApprovals: false,
    });
    const bodies = mocks.fetch.mock.calls.map(([, o]) => JSON.parse(o.body));
    expect(bodies.map((x) => x.model)).toEqual(["GLM-5.2", "Other-Model-1"]);
    expect(bodies.map((x) => x.routeThroughGateway === true)).toEqual([true, false]);
  });

  it("keeps explicit false, headless owner authentication and measured model usage", async () => {
    const result = await executeSwarmServer({
      swarm: { id: "synthetic-swarm", name: "Synthetic", nodes: [node("agent", false)], edges: [] },
      userId: "runner-b",
      origin: "https://mock.invalid",
      input: "Synthetic probe",
      source: "schedule",
      rejectApprovals: false,
    });
    expect(result.status).toBe("success");
    const [, options] = mocks.fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      routeThroughGateway: false,
      internalUserId: "runner-b",
    });
    expect(options.headers["x-internal-run-secret"]).toBe("synthetic-internal-secret");
    expect(mocks.trace.finishStep).toHaveBeenCalledWith(
      "probe",
      expect.objectContaining({
        llmModel: "GLM-5.2",
        tokensIn: 4,
        tokensOut: 2,
        costUsd: 0.002,
      }),
    );
  });

  it("executes the selected published snapshot, not a modified draft", async () => {
    const published = [node("agent", true)];
    const graph = resolveDeployedGraph({
      nodes: [node("agent", false)],
      edges: [],
      published_nodes: published,
      published_edges: [],
    });
    await executeSwarmServer({
      swarm: {
        id: "synthetic-published",
        name: "Synthetic",
        nodes: graph.nodes,
        edges: graph.edges,
      },
      userId: "runner-a",
      origin: "https://mock.invalid",
      input: "Synthetic probe",
      source: "api",
      rejectApprovals: false,
    });
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).routeThroughGateway).toBe(true);
  });

  it("resolves a nested child's published gateway snapshot under the parent owner", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "synthetic-child",
          name: "Synthetic child",
          user_id: "runner-a",
          nodes: [node("agent", false)],
          edges: [],
          published_nodes: [node("agent", true)],
          published_edges: [],
        },
      }),
    };
    mocks.from.mockReturnValue(query);
    const result = await executeSwarmServer({
      swarm: {
        id: "synthetic-parent",
        name: "Synthetic parent",
        nodes: [
          {
            id: "child",
            position: { x: 0, y: 0 },
            data: { kind: "subswarm", label: "Child", subSwarmId: "synthetic-child" },
          },
        ],
        edges: [],
      },
      userId: "runner-a",
      origin: "https://mock.invalid",
      input: "Synthetic probe",
      source: "api",
      rejectApprovals: false,
    });
    expect(result.status).toBe("success");
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject({
      internalUserId: "runner-a",
      routeThroughGateway: true,
      model: "GLM-5.2",
    });
    expect(query.eq).toHaveBeenCalledWith("id", "synthetic-child");
  });

  it("denies a nested child owned by another user before any model request", async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "synthetic-child",
          name: "Synthetic child",
          user_id: "another-owner",
          nodes: [node("agent", true)],
          edges: [],
        },
      }),
    });
    const result = await executeSwarmServer({
      swarm: {
        id: "synthetic-parent",
        name: "Synthetic parent",
        nodes: [
          {
            id: "child",
            position: { x: 0, y: 0 },
            data: { kind: "subswarm", label: "Child", subSwarmId: "synthetic-child" },
          },
        ],
        edges: [],
      },
      userId: "runner-a",
      origin: "https://mock.invalid",
      input: "Synthetic probe",
      source: "api",
      rejectApprovals: false,
    });
    expect(result.status).toBe("error");
    expect(result.error).toContain("not owned by you");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("suspends at a human gate and keeps gateway/model intent across a simulated resume", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({
      insert,
      update: vi.fn().mockReturnThis(),
      eq: vi.fn(function eq(): unknown {
        return Object.assign(Promise.resolve({ error: null }), { eq });
      }),
    });
    const nodes: Node<SwarmNodeData>[] = [
      {
        id: "human",
        position: { x: 0, y: 0 },
        data: { kind: "approval", label: "Human gate" },
      },
      node("agent", true),
    ];
    const opts = {
      swarm: {
        id: "synthetic-approval",
        name: "Synthetic",
        nodes,
        edges: [{ id: "after-human", source: "human", target: "probe" }],
      },
      userId: "runner-a",
      origin: "https://mock.invalid",
      input: "Synthetic probe",
      source: "api" as const,
      rejectApprovals: false,
    };
    expect((await executeSwarmServer(opts)).status).toBe("suspended");
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "runner-a",
        swarm_run_id: "synthetic-run",
      }),
    );
    expect(insert.mock.calls[0][0]).not.toHaveProperty("decided_by");
    const { checkpoint } = mocks.checkpoint.mock.calls.at(-1)![0];
    expect(checkpoint.suspendedNodeId).toBe("human");
    expect(
      (
        await executeSwarmServer({
          ...opts,
          resume: { runId: "synthetic-run", checkpoint, decision: { approved: true } },
        })
      ).status,
    ).toBe("success");
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject({
      routeThroughGateway: true,
      model: "GLM-5.2",
    });
  });

  it.each([400, 401, 429, 504])(
    "records upstream HTTP %i as a run error without fallback",
    async (status) => {
      mocks.fetch.mockResolvedValue(new Response("Synthetic rejection", { status }));
      const result = await executeSwarmServer({
        swarm: {
          id: "synthetic-error",
          name: "Synthetic",
          nodes: [node("agent", true)],
          edges: [],
        },
        userId: "runner-a",
        origin: "https://mock.invalid",
        input: "Synthetic probe",
        source: "api",
        rejectApprovals: false,
      });
      expect(result.status).toBe("error");
      expect(result.error).toContain(String(status));
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
    },
  );
});
