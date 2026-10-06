import type { Database } from "@/integrations/supabase/types";
import { createNativeDevelopmentSwarm, DEVELOPMENT_AGENT_ROLES } from "./axtnDevelopmentSwarm";
import { agentToNodePatch } from "./agentToSwarmNode";
import { canonicalJson } from "@/utils/provenance/canonical";

type Agent = Omit<Database["public"]["Tables"]["agents"]["Insert"], "user_id">;

export const DEVELOPMENT_AGENT_IDS = {
  builder: "306c6741-09aa-46e8-965e-e89a1f6b9254",
  security: "8955bfae-7816-4e07-9994-3780dbe783db",
  contract: "35b790c1-a936-4a57-97d5-d5d6e3198a7c",
  maintainability: "72fbffb0-7137-444e-a3be-0729a13ae476",
} as const;

/** Provision the current native roles, not hypothetical general Development agents. */
export function createNativeDevelopmentAgents(
  config: Parameters<typeof createNativeDevelopmentSwarm>[0],
) {
  const graph = createNativeDevelopmentSwarm(config);
  return DEVELOPMENT_AGENT_ROLES.map((role) => {
    const id = DEVELOPMENT_AGENT_IDS[role];
    const node = graph.nodes.find((value) => value.id === role);
    if (!node || node.data.kind !== "agent" || !node.data.systemPrompt)
      throw new Error(`Native Development role missing: ${role}`);
    const agent = {
      id,
      name: `aXtn Development · ${node.data.label}`,
      description:
        `Native ${role} role for the bounded Python normalization acceptance slice. ` +
        "Input: immutable Task/Candidate; output: strict typed proposal/review JSON. " +
        "No direct tools, credentials, file effects, verification receipt or Acceptance. " +
        "Imported nodes are independent snapshots; general use requires an exact locally accepted Solution Contract.",
      system_prompt: node.data.systemPrompt,
      llm_provider: config.provider,
      llm_model: config.model,
      temperature: node.data.temperature ?? 0,
      max_tokens: node.data.maxTokens ?? 4096,
      knowledge_base_id: null,
      n8n_webhook_url: null,
      tools: { builtInTools: {}, skillIds: [], guardrails: {}, toolConfigs: {} },
      is_active: true,
    } satisfies Agent;
    const memory = {
      stm_enabled: node.data.memory?.stm_enabled ?? false,
      stm_window_messages: 20,
      ltm_enabled: node.data.memory?.ltm_enabled ?? false,
      stm_summarize: false,
      ltm_auto_extract: false,
    };
    const imported = agentToNodePatch({ ...agent, memory });
    if (imported.dropped.length)
      throw new Error(`Unrepresentable native Development role settings: ${role}`);
    for (const field of [
      "systemPrompt",
      "provider",
      "model",
      "temperature",
      "enabledTools",
    ] as const) {
      if (canonicalJson(imported.patch[field]) !== canonicalJson(node.data[field]))
        throw new Error(`Native role import parity failed: ${role}.${field}`);
    }
    return { role, agent, memory };
  });
}
