import type { Node, Edge } from "@xyflow/react";
import type { SwarmNodeData } from "./swarmRuntime";
import { agentToNodePatch, type ImportableAgentRow } from "./agentToSwarmNode";

export const CASE_WORK_SWARM_ID = "e50fd50b-edab-45fb-802a-cd9c7ad1094d";
export const CASE_WORK_PROPOSAL_SWARM_ID = "50df9276-d044-441a-bd89-9e6d75b21de6";
export const CASE_WORK_AGENT_ID = "034b6764-bbf8-43c2-8a82-b1e8743a1f67";

export function caseWorkAgent(provider: string, model: string) {
  if (!provider || !model) throw new Error("Explicit existing Case provider/model required");
  return {
    id: CASE_WORK_AGENT_ID,
    name: "aXtn Case Work · Processing Proposal",
    description:
      "Input: minimized user work intent. Output: strict ACTIVE or VALIDATION_REVIEW processing proposal. No tools, credentials, Acceptance or provider effects. Used by the visible Case Work Proposal sub-Swarm through an independent snapshot.",
    system_prompt:
      'Propose a bounded processing-stage change for the supplied work intent. Return ONLY {"processing_stage":"ACTIVE"} or {"processing_stage":"VALIDATION_REVIEW"}. ' +
      "Do not include identities, commands, credentials or extra fields. Do not claim execution, result verification, closure or Acceptance.",
    llm_provider: provider,
    llm_model: model,
    temperature: 0,
    max_tokens: 4096,
    knowledge_base_id: null,
    n8n_webhook_url: null,
    tools: { builtInTools: {}, skillIds: [], guardrails: {}, toolConfigs: {} },
    is_active: true,
  };
}

export function createNativeCaseWorkSwarms(agent: ImportableAgentRow) {
  const imported = agentToNodePatch(agent);
  if (imported.dropped.length) throw new Error("Case Work snapshot has unsupported settings");
  const nodes: Node<SwarmNodeData>[] = [
    {
      id: "intent",
      type: "input",
      position: { x: -300, y: 0 },
      data: { kind: "input", label: "Explicit minimized Case work intent", outputVar: "intent" },
    },
    {
      id: "scope",
      type: "tool",
      position: { x: 0, y: 0 },
      data: {
        kind: "tool",
        label: "Authenticated same-Case scope / current version",
        outputVar: "scope",
        toolId: "case_work",
        toolArgs: {
          request: '{"operation":"subtree","caseId":"{{case_id}}","offset":0,"limit":1}',
        },
      },
    },
    {
      id: "preflight",
      type: "function",
      position: { x: 300, y: 0 },
      data: {
        kind: "function",
        label: "Minimized intent / persisted version / machine eligibility",
        outputVar: "task",
        inputs: ["intent"],
        functionCode: `
const scope=JSON.parse(ctx.vars.scope);
const row=scope.rootCase;
if (!row || row.case_id!==ctx.vars.case_id || !Number.isInteger(row.processing_version)) throw new Error("CASE_WORK_VERSION_REQUIRED");
if (row.status==="CLOSED" || row.processing_mode==="HUMAN") throw new Error("CASE_EXECUTION_INACTIVE");
const intent=ctx.input.trim();
if (!intent || intent.length>8000) throw new Error("CASE_WORK_BOUNDED_INTENT_REQUIRED");
return {intent, expectedVersion: row.processing_version};
`,
      },
    },
    {
      id: "proposal",
      type: "subswarm",
      position: { x: 600, y: 0 },
      data: {
        kind: "subswarm",
        label: "Saved Case Worker snapshot → proposal sub-Swarm",
        subSwarmId: CASE_WORK_PROPOSAL_SWARM_ID,
        inputs: ["task"],
        outputVar: "proposal",
      },
    },
    {
      id: "validate",
      type: "function",
      position: { x: 900, y: 0 },
      data: {
        kind: "function",
        label: "Validate proposal / fixed same-Case operation",
        outputVar: "effect",
        functionCode: `
const patch=JSON.parse(ctx.vars.proposal);
if (!patch || Object.keys(patch).length!==1 || !["ACTIVE","VALIDATION_REVIEW"].includes(patch.processing_stage)) throw new Error("CASE_WORK_PROPOSAL_REJECTED");
return {operation:"processing",caseId:ctx.vars.case_id,expectedVersion:JSON.parse(ctx.vars.task).expectedVersion,
transitionKey:"case-work:"+ctx.vars.case_run_id,patch,reasonCode:"NATIVE_CASE_WORK_PROPOSAL"};
`,
      },
    },
    {
      id: "apply",
      type: "tool",
      position: { x: 1200, y: 0 },
      data: {
        kind: "tool",
        label: "Native scope/version/fence enforcement and persisted readback",
        outputVar: "readback",
        toolId: "case_work",
        toolArgs: { request: "{{effect}}" },
      },
    },
    {
      id: "result",
      type: "output",
      position: { x: 1500, y: 0 },
      data: {
        kind: "output",
        label: "Same-Case native result / Run evidence (not Acceptance)",
        inputs: ["readback"],
      },
    },
  ];
  const edges: Edge[] = nodes.slice(1).map((node, index) => ({
    id: `${nodes[index].id}-${node.id}`,
    source: nodes[index].id,
    target: node.id,
  }));
  return {
    parent: {
      id: CASE_WORK_SWARM_ID,
      name: "aXtn Case Work · Native Processing",
      description:
        "Explicit user start on the same authorized Case. Reads current scope/version, minimizes intent, invokes the saved Case Worker through a visible proposal sub-Swarm, validates its bounded proposal, applies the native guarded processing operation and persists Run/result. Human takeover and changed versions fence late machine writes; no closure or independent Acceptance.",
      nodes,
      edges,
    },
    proposal: {
      id: CASE_WORK_PROPOSAL_SWARM_ID,
      name: "aXtn Case Work · Proposal (sub-Swarm)",
      description:
        "Reusable native sub-Swarm: minimized intent → saved Processing Proposal Agent snapshot → strict processing patch. No Case or external effect. Parent validates and applies through native scope/version guards. No automatic adoption of later Agent changes.",
      nodes: [
        {
          id: "propose",
          type: "agent",
          position: { x: 0, y: 0 },
          data: {
            ...imported.patch,
            kind: "agent",
            label: agent.name,
            outputVar: "proposal",
            memory: { stm_enabled: false, ltm_enabled: false, ltm_scope: "none" },
          },
        },
        {
          id: "output",
          type: "output",
          position: { x: 320, y: 0 },
          data: {
            kind: "output",
            label: "Unaccepted proposal only",
            inputs: ["proposal"],
          },
        },
      ] satisfies Node<SwarmNodeData>[],
      edges: [{ id: "propose-output", source: "propose", target: "output" }] satisfies Edge[],
    },
  };
}
