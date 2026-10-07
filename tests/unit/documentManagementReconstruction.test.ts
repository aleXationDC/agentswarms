import { describe, expect, it } from "vitest";
import {
  DMS_AGENT_DEFINITIONS,
  DMS_KB_CONTENT,
  DMS_KNOWLEDGE_BASE_ID,
  DMS_RECONSTRUCTION_VERSION,
  DMS_SKILLS,
} from "../../axtn/swarms/axtn-document-management/reconstruction-v1.mjs";
import { buildParentGraph } from "../../axtn/swarms/axtn-document-management/graph.mjs";

describe("native DMS Reconstruction v1 definitions", () => {
  it("labels reconstructed Agents and Skills as new versions, not historical recovery", () => {
    expect(DMS_RECONSTRUCTION_VERSION).toBe("reconstruction-v1");
    expect(DMS_AGENT_DEFINITIONS.triage.name).toContain("Reconstruction v1");
    expect(DMS_AGENT_DEFINITIONS.processing.name).toContain("Reconstruction v1");
    expect(DMS_AGENT_DEFINITIONS.triage.id).not.toBe("54edaad4-4726-4781-ae07-5df795434837");
    expect(DMS_AGENT_DEFINITIONS.processing.id).not.toBe("02482fe8-1970-447a-97d7-8898ab8abaae");
    expect(DMS_SKILLS).toHaveLength(2);
    expect(DMS_SKILLS.every((skill) => skill.name.includes("reconstruction v1"))).toBe(true);
    expect(DMS_SKILLS.map((skill) => skill.id)).toContain(DMS_AGENT_DEFINITIONS.triage.skill_id);
    expect(DMS_SKILLS.map((skill) => skill.id)).toContain(
      DMS_AGENT_DEFINITIONS.processing.skill_id,
    );
  });

  it("limits the owner KB to evidenced proposal contracts and non-authority boundaries", () => {
    expect(DMS_KB_CONTENT).toContain("Reconstruction v1");
    expect(DMS_KB_CONTENT).toContain(
      "Rechnung, Vertrag, Vertragsanpassung, Mahnung, Bescheid and Nachweis",
    );
    expect(DMS_KB_CONTENT).toContain("not privacy analyzers");
    expect(DMS_KB_CONTENT).toContain("reviewers, filing providers or cleanup authorities");
    expect(DMS_KNOWLEDGE_BASE_ID).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("pins saved Agent version provenance and faithfully imports KB, Skill and guardrail settings", () => {
    const snapshot = (agentId: string, versionId: string) => ({
      agentId,
      versionId,
      configHash: "a".repeat(64),
    });
    const buildAgent = (role: "triage" | "processing") => {
      const definition = DMS_AGENT_DEFINITIONS[role];
      return {
        nodePatch: {
          agentId: null,
          provider: definition.llm_provider,
          model: definition.llm_model,
          systemPrompt: definition.system_prompt,
          temperature: definition.temperature,
          maxTokens: definition.max_tokens,
          knowledgeBaseId: DMS_KNOWLEDGE_BASE_ID,
          enabledTools: ["kb_search"],
          skillIds: [definition.skill_id],
          guardrails: { blockPII: true, piiMode: "block", piiApplyTo: "both" },
        },
        agentSnapshot: snapshot(definition.id, `version-${role}`),
      };
    };
    const graph = buildParentGraph({
      triage: buildAgent("triage"),
      processing: buildAgent("processing"),
    }) as {
      nodes: Array<{
        id: string;
        data: Record<string, unknown>;
      }>;
    };
    for (const [id, role] of [
      ["stage1_triage", "triage"],
      ["stage2_processing", "processing"],
    ] as const) {
      const definition = DMS_AGENT_DEFINITIONS[role];
      const node = graph.nodes.find((candidate) => candidate.id === id);
      expect(node?.data).toMatchObject({
        kind: "agent",
        agentId: null,
        agentSnapshot: {
          agentId: definition.id,
          versionId: `version-${role}`,
          configHash: "a".repeat(64),
        },
        knowledgeBaseId: DMS_KNOWLEDGE_BASE_ID,
        enabledTools: ["kb_search"],
        skillIds: [definition.skill_id],
        guardrails: { blockPII: true, piiMode: "block", piiApplyTo: "both" },
      });
    }
  });
});
