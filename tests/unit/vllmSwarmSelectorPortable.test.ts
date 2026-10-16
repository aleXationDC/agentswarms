// aXtn vLLM Swarm Selector: the per-node gateway opt-in survives export and
// import, and a node without it stays on the direct provider path.
import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";

import { exportSwarm, importSwarm } from "@/lib/swarmPortable";
import type { SwarmNodeData } from "@/lib/swarmRuntime";

const node = (id: string, data: Partial<SwarmNodeData>): Node<SwarmNodeData> => ({
  id,
  type: "agent",
  position: { x: 0, y: 0 },
  data: { label: id, kind: "agent", status: "idle", ...data } as SwarmNodeData,
});

describe("aXtn vLLM Swarm Selector portable round trip", () => {
  const exported = exportSwarm({
    name: "selector",
    nodes: [
      node("direct", { provider: "vllm", model: "model-a" }),
      node("gateway", { provider: "vllm", model: "model-b", routeThroughGateway: true }),
    ],
    edges: [],
  });

  it("exports the flag only for the opted-in node", () => {
    expect(exported.nodes[0]).not.toHaveProperty("routeThroughGateway");
    expect(exported.nodes[1].routeThroughGateway).toBe(true);
  });

  it("imports with the same per-node intent and models", () => {
    const { nodes } = importSwarm(JSON.parse(JSON.stringify(exported)));
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n.data]));
    expect(byId.direct.routeThroughGateway).toBeUndefined();
    expect(byId.direct.model).toBe("model-a");
    expect(byId.gateway.routeThroughGateway).toBe(true);
    expect(byId.gateway.model).toBe("model-b");
    expect(byId.gateway.provider).toBe("vllm");
  });
});
