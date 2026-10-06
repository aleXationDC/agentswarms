import { describe, expect, it } from "vitest";
import { createNativeDevelopmentAgents, DEVELOPMENT_AGENT_IDS } from "@/lib/axtnDevelopmentAgents";
import { agentToNodePatch } from "@/lib/agentToSwarmNode";
import { createNativeDevelopmentSwarm } from "@/lib/axtnDevelopmentSwarm";

const config = { provider: "openai", model: "gpt-4.1-mini", reviewerUserIds: ["reviewer"] };

describe("saved native Development role composition", () => {
  it("provides four exact native semantic roles, not a synthetic Verify Agent", () => {
    const agents = createNativeDevelopmentAgents(config);
    expect(agents.map((agent) => agent.role)).toEqual(Object.keys(DEVELOPMENT_AGENT_IDS));
    expect(new Set(agents.map((agent) => agent.agent.id)).size).toBe(4);
    const graph = createNativeDevelopmentSwarm(config);
    for (const { agent, role, memory } of agents) {
      const original = graph.nodes.find((node) => node.id === role)!;
      const imported = agentToNodePatch({ ...agent, memory });
      expect(imported.dropped).toEqual([]);
      expect(imported.patch).toMatchObject({
        systemPrompt: original.data.systemPrompt,
        provider: original.data.provider,
        model: original.data.model,
        temperature: 0,
        enabledTools: [],
        agentId: null,
        memory: { stm_enabled: false, ltm_enabled: false, ltm_scope: "none" },
      });
      expect(agent.description).toContain("exact locally accepted Solution Contract");
    }
    expect(graph.nodes.find((node) => node.id === "verify")?.data.kind).toBe("tool");
  });
  it("is stable and leaves previously imported/published snapshots independent", () => {
    const first = createNativeDevelopmentAgents(config);
    expect(createNativeDevelopmentAgents(config)).toEqual(first);
    const snapshot = agentToNodePatch({ ...first[0].agent, memory: first[0].memory }).patch;
    first[0].agent.system_prompt = "later operator change";
    expect(snapshot.systemPrompt).not.toBe(first[0].agent.system_prompt);
    expect(snapshot.agentId).toBeNull();
  });
  it("requires explicit existing model and reviewer configuration", () => {
    expect(() => createNativeDevelopmentAgents({ provider: "", model: "" })).toThrow();
    expect(() =>
      createNativeDevelopmentAgents({ provider: "openai", model: "gpt-4.1-mini" }),
    ).toThrow();
  });
});
