import { describe, expect, it } from "vitest";
import {
  caseWorkAgent,
  createNativeCaseWorkSwarms,
  CASE_WORK_PROPOSAL_SWARM_ID,
} from "@/lib/axtnCaseWorkSwarm";

const execute = (code: string, input: string, vars: Record<string, string>) =>
  new Function("ctx", code)({ input, vars });

describe("native visible Case Work parent/sub-Swarm composition", () => {
  const graphs = createNativeCaseWorkSwarms(caseWorkAgent("openai", "gpt-4.1-mini"));
  const preflight = graphs.parent.nodes.find((node) => node.id === "preflight")!.data.functionCode!;
  const validate = graphs.parent.nodes.find((node) => node.id === "validate")!.data.functionCode!;
  const caseId = "a8753929-d860-4391-a551-4f0d1d90b8f0";
  const variables = {
    case_id: caseId,
    case_run_id: "same-native-run",
    scope: JSON.stringify({ rootCase: { case_id: caseId, status: "OPEN", processing_version: 7 } }),
  };
  it("uses a saved Agent snapshot through a visible native sub-Swarm, not a dispatcher", () => {
    expect(graphs.parent.nodes.find((node) => node.id === "proposal")?.data.subSwarmId).toBe(
      CASE_WORK_PROPOSAL_SWARM_ID,
    );
    expect(graphs.proposal.nodes[0].data.agentId).toBeNull();
    expect(graphs.proposal.nodes[0].data.enabledTools).toEqual([]);
    expect(graphs.proposal.nodes[0].data.memory).toMatchObject({
      stm_enabled: false,
      ltm_enabled: false,
    });
    expect(
      graphs.parent.nodes
        .filter((node) => node.data.kind === "tool")
        .map((node) => node.data.toolId),
    ).toEqual(["case_work", "case_work"]);
  });
  it("binds the authenticated same Case, exact read version and stable native Run to the effect", () => {
    const task = execute(preflight, "Bounded user intent", variables);
    expect(task).toEqual({ intent: "Bounded user intent", expectedVersion: 7 });
    const effect = execute(validate, "", {
      ...variables,
      task: JSON.stringify(task),
      proposal: '{"processing_stage":"VALIDATION_REVIEW"}',
    });
    expect(effect).toEqual({
      operation: "processing",
      caseId,
      expectedVersion: 7,
      transitionKey: "case-work:same-native-run",
      patch: { processing_stage: "VALIDATION_REVIEW" },
      reasonCode: "NATIVE_CASE_WORK_PROPOSAL",
    });
  });
  it("rejects model identity/revision/closure injection before any effect", () => {
    for (const proposal of [
      { processing_stage: "ACTIVE", caseId: "foreign-case" },
      { processing_stage: "ACTIVE", expectedVersion: 999 },
      { processing_stage: "CLOSED" },
      { accepted: true },
    ])
      expect(() =>
        execute(validate, "", {
          ...variables,
          task: '{"expectedVersion":7}',
          proposal: JSON.stringify(proposal),
        }),
      ).toThrow("CASE_WORK_PROPOSAL_REJECTED");
  });
  it("rejects missing versions, inaccessible Cases and human takeover", () => {
    for (const row of [
      { case_id: caseId, status: "OPEN" },
      { case_id: "foreign-case", status: "OPEN", processing_version: 7 },
      { case_id: caseId, status: "CLOSED", processing_version: 7 },
      { case_id: caseId, status: "OPEN", processing_version: 7, processing_mode: "HUMAN" },
    ])
      expect(() =>
        execute(preflight, "intent", {
          ...variables,
          scope: JSON.stringify({ rootCase: row }),
        }),
      ).toThrow();
  });
});
