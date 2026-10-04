import { runInNewContext } from "node:vm";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createNativeDevelopmentSwarm,
  nativeDevelopmentGateCode,
} from "@/lib/axtnDevelopmentSwarm";
import { topoLevelIds } from "@/lib/swarmGraph";

const graph = createNativeDevelopmentSwarm({
  provider: "openai",
  model: "gpt-4.1-mini",
  reviewerGroupIds: ["11111111-1111-4111-8111-111111111111"],
});
const candidateSHA = "a".repeat(40),
  contentHash = "b".repeat(40);
const sessionId = "22222222-2222-4222-8222-222222222222";
const candidate = {
  caseId: "33333333-3333-4333-8333-333333333333",
  taskId: "native-task",
  attemptId: "attempt-v1",
  baseSHA: "c".repeat(40),
  candidateSHA,
  files: [{ contentHash }],
};
function fixture() {
  const review = (role: string) => ({
    schema: "axtn.development.review/v1",
    role,
    candidateSHA,
    contentHash,
    findings: [] as Array<{
      severity: string;
      accepted: boolean;
      blocking: boolean;
      summary: string;
    }>,
  });
  return {
    security: review("security"),
    contract: review("contract"),
    maintainability: review("maintainability"),
    verify: {
      status: "COMPLETED",
      sessionId,
      evidence: {
        schema: "axtn.development.verify/v1",
        ...candidate,
        sessionId,
        image: `sha256:${"d".repeat(64)}`,
        harnessHash: "e".repeat(64),
        inputHash: "f".repeat(64),
        gateVerdict: "PASS",
        candidate: { pass: true, compileExitCode: 0, testsRun: 12 },
      },
    },
  };
}
function snippet(code: string, input: unknown, vars: Record<string, unknown> = {}) {
  return runInNewContext(
    `(function(ctx){${code}\n})(ctx)`,
    {
      ctx: { input: JSON.stringify(input), vars },
    },
    { timeout: 1000 },
  );
}
const gate = (input: unknown) =>
  snippet(nativeDevelopmentGateCode, input, {
    candidate: JSON.stringify(candidate),
    verify_work: JSON.stringify({ case_id: "44444444-4444-4444-8444-444444444444" }),
    evaluate: JSON.stringify({ score: 1 }),
  });

describe("visible native Development slice", () => {
  it("binds native Verify completion to typed immutable receipt Evidence", () => {
    const result = gate(fixture());
    expect(result.verifyComplete.transition.references).toContainEqual({
      kind: "evidence",
      repository: "aXtn/aXtn-agentswarms",
      id: `notebook-runtime/${sessionId}/receipt`,
      revision: candidateSHA,
    });
  });
  it("uses native kinds, not a dispatcher, controller, or sub-swarm wrapper", () => {
    const kinds = new Map(graph.nodes.map((n) => [n.id, n.data.kind]));
    expect(kinds.get("input")).toBe("input");
    for (const id of ["builder", "security", "contract", "maintainability"]) {
      expect(kinds.get(id)).toBe("agent");
    }
    expect(kinds.get("join")).toBe("merge");
    expect(kinds.get("hard_gate")).toBe("function");
    expect(kinds.get("approved")).toBe("approval");
    expect(kinds.get("output")).toBe("output");
    for (const node of graph.nodes.filter((n) => n.data.kind === "tool")) {
      expect(["case_work", "mcp_call_tool"]).toContain(node.data.toolId);
    }
    expect(JSON.stringify(graph)).not.toMatch(/development_work|controller\.server|subswarm/);
    expect(graph.nodes.some((n) => n.data.kind === "evaluate")).toBe(false);
  });
  it("runs three Breakers and actual Verify in exactly one native dependency level and joins all four", () => {
    const levels = topoLevelIds(graph.nodes, graph.edges);
    const parallel = levels.find((ids) => ids.includes("security"));
    expect(new Set(parallel)).toEqual(
      new Set(["security", "contract", "maintainability", "verify"]),
    );
    expect(
      graph.edges
        .filter((e) => e.target === "join")
        .map((e) => e.source)
        .sort(),
    ).toEqual(["contract", "maintainability", "security", "verify"]);
    expect(graph.nodes.find((n) => n.id === "join")?.data.mergeMode).toBe("object");
  });
  it("uses configurable explicit provider/model without any fallback or provider mutation", () => {
    const agents = graph.nodes.filter((n) => n.data.kind === "agent");
    expect(agents).toHaveLength(4);
    expect(
      agents.every((n) => n.data.provider === "openai" && n.data.model === "gpt-4.1-mini"),
    ).toBe(true);
    expect(agents.every((n) => n.data.enabledTools?.length === 0)).toBe(true);
    expect(() => createNativeDevelopmentSwarm({ provider: "", model: "" })).toThrow();
    expect(() =>
      createNativeDevelopmentSwarm({ provider: "openai", model: "gpt-4.1-mini" }),
    ).toThrow("reviewer");
  });
  it("every external write uses the same Case/Attempt and a distinct operation, consumes branch readback", () => {
    for (const id of ["branch_args", "file_args", "pull_args"]) {
      const code = graph.nodes.find((n) => n.id === id)?.data.functionCode;
      expect(code).toContain("case_id:");
      expect(code).toContain("attempt_id:");
      expect(code).toContain("operation_id:");
    }
    expect(graph.nodes.find((n) => n.id === "file_args")?.data.functionCode).toContain(
      "branch.name",
    );
    expect(graph.nodes.find((n) => n.id === "pull_args")?.data.functionCode).toContain(
      "expected_head_sha",
    );
    expect(graph.nodes.find((n) => n.id === "pull_args")?.data.functionCode).toContain(
      'approved_approved === "yes"',
    );
    expect(graph.nodes.find((n) => n.id === "task")?.data.functionCode).toContain(
      'sourceId: task.taskId + ":verify"',
    );
  });
  it("preserves native checkpoint and persisted Approval authority in both runtimes", () => {
    const canvas = readFileSync("src/lib/swarmRuntime.ts", "utf8");
    const headless = readFileSync("src/utils/swarmExecute.server.ts", "utf8");
    expect(canvas).toContain("createWorkSwarmApproval");
    expect(canvas).toContain("captureCheckpoint(");
    expect(canvas).toContain('type: "run_suspended"');
    expect(headless).toContain("createNativeWorkApproval");
    expect(headless).toContain("restoreTracker(graph, resumed)");
    expect(headless).toContain("completed.has(node.id)");
    const resume = readFileSync("src/utils/swarmResume.functions.ts", "utf8");
    expect(resume).toContain("assertNativeApprovalResume(");
    expect(resume).toContain("approvalId: approval.id");
    expect(resume).toContain("createNativeWorkApproval({");
  });
});

describe("deterministic native gate", () => {
  it("passes only complete exact-revision review plus runtime Evidence", () => {
    expect(gate(fixture())).toMatchObject({
      verdict: "PASS",
      caseId: candidate.caseId,
      candidateSHA,
    });
  });
  it.each(["security", "contract", "maintainability", "verify"])(
    "requires %s at native join",
    (missing) => {
      const data: Record<string, unknown> = fixture();
      delete data[missing];
      expect(() => gate(data)).toThrow("All four");
    },
  );
  it.each(["MEDIUM", "HIGH", "CRITICAL"])(
    "blocks accepted blocking %s findings regardless of evaluate",
    (severity) => {
      const data = fixture();
      data.security.findings.push({
        severity,
        blocking: true,
        accepted: true,
        summary: "Retained blocker",
      });
      expect(gate(data).verdict).toBe("BLOCKED");
    },
  );
  it("LOW findings do not become an unconfigured blocking policy", () => {
    const data = fixture();
    data.security.findings.push({
      severity: "LOW",
      blocking: true,
      accepted: true,
      summary: "Advisory",
    });
    expect(gate(data).verdict).toBe("PASS");
  });
  it.each(["FAIL", "pending", "compile", "tests", "candidate", "attempt", "session", "harness"])(
    "blocks deterministic %s regardless of evaluate",
    (variant) => {
      const data = fixture();
      if (variant === "FAIL") data.verify.evidence.gateVerdict = "FAIL";
      if (variant === "pending") data.verify.status = "PENDING";
      if (variant === "compile") data.verify.evidence.candidate.compileExitCode = 1;
      if (variant === "tests") data.verify.evidence.candidate.testsRun = 0;
      if (variant === "candidate") data.verify.evidence.candidateSHA = "d".repeat(40);
      if (variant === "attempt") data.verify.evidence.attemptId = "stale";
      if (variant === "session") data.verify.sessionId = "missing";
      if (variant === "harness") data.verify.evidence.harnessHash = "absent";
      expect(gate(data).verdict).toBe("BLOCKED");
    },
  );
  it.each(["sha", "hash", "role", "extra"])("refuses %s Review contract forgery", (variant) => {
    const data = fixture();
    if (variant === "sha") data.security.candidateSHA = "d".repeat(40);
    if (variant === "hash") data.security.contentHash = "d".repeat(40);
    if (variant === "role") data.security.role = "contract";
    if (variant === "extra") Object.assign(data.security, { approved: true });
    expect(() => gate(data)).toThrow();
  });
  it("the hard gate throws retained findings before the native Approval/PR dependency", () => {
    const data = fixture();
    data.verify.evidence.gateVerdict = "FAIL";
    const code = graph.nodes.find((n) => n.id === "hard_gate")?.data.functionCode;
    expect(code).toBeTruthy();
    expect(() => snippet(code ?? "", "", { gate: JSON.stringify(gate(data)) })).toThrow("BLOCKED");
  });
});
