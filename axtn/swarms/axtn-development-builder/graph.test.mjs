import assert from "node:assert/strict";
import test from "node:test";
import { builderGraph, devVerificationGraph } from "./graph.mjs";

const serverName = "dedicated test profile";
const builderSnapshot = {
  agentId: null,
  agentSnapshot: { agentId: "existing-agent", versionId: "existing-version" },
  provider: "existing-provider",
  model: "existing-model",
  skillIds: ["existing-delivery-skill"],
  knowledgeBaseId: "existing-development-kb",
};

test("Builder retains native skills, KB and provenance but not the historical task prompt", () => {
  const graph = builderGraph({ builderSnapshot, serverName });
  const agent = graph.nodes.find((n) => n.id === "builder").data;
  assert.deepEqual(agent.agentSnapshot, builderSnapshot.agentSnapshot);
  assert.deepEqual(agent.skillIds, builderSnapshot.skillIds);
  assert.equal(agent.knowledgeBaseId, builderSnapshot.knowledgeBaseId);
  assert.deepEqual(agent.toolConfigs.mcp_server_names, [serverName]);
  assert(agent.systemPrompt.includes("Never omit tool_name"));
  assert(agent.systemPrompt.includes('"arguments":{...}'));
  assert(agent.systemPrompt.includes("never a JSON-encoded string"));
  assert(!JSON.stringify(graph).includes("caseAssignment"));
  assert(!JSON.stringify(graph).includes("cases.tsx"));
  assert(
    !graph.nodes.some((n) => ["function", "loop", "condition", "evaluate"].includes(n.data.kind)),
  );
});

test("complete decoded primary source, work order and formatting config reach the Builder natively", () => {
  const graph = builderGraph({ builderSnapshot, serverName });
  const context = graph.nodes.find((n) => n.id === "context").data;
  for (const field of ["source_text", "work_order_text", "format_config_text"]) {
    assert(
      context.stateAssignments.some((a) => a.key === field && a.value.includes(".decoded_content")),
    );
    assert(graph.nodes.find((n) => n.id === "builder").data.inputs.includes(field));
  }
  for (const source of ["source", "work_order", "format_config", "branch"]) {
    assert(graph.edges.some((e) => e.source === source && e.target === "payloads"));
  }
});

test("an incomplete or unqualified model result cannot return a branch as a candidate", () => {
  const graph = builderGraph({ builderSnapshot, serverName });
  assert.equal(
    graph.nodes.find((n) => n.id === "candidate_report").data.toolArgs.tool_name,
    "fetch",
  );
  assert.equal(graph.nodes.find((n) => n.id === "candidate_gate").data.routerMode, "exact");
  assert.deepEqual(
    graph.edges.filter((e) => e.source === "candidate_gate").map((e) => [e.target, e.label]),
    [["branch_head", "false"]],
  );
  const branchHead = graph.nodes.find((n) => n.id === "branch_head").data;
  assert.equal(branchHead.httpResponsePath, "commit.id");
  assert(branchHead.httpUrl.endsWith("/branches/{{created_branch}}"));
  assert(branchHead.httpHeaders[0].value.includes("{{secret:MODULAR_GITEA_CI_READ}}"));
  const status = graph.nodes.find((n) => n.id === "candidate_ci").data;
  assert(status.httpUrl.endsWith("/commits/{{candidate_head_sha}}/status"));
  assert.equal(status.httpResponsePath, "state");
  assert(status.httpHeaders[0].value.includes("{{secret:MODULAR_GITEA_CI_READ}}"));
  const ciGate = graph.nodes.find((n) => n.id === "candidate_ci_gate").data;
  assert.equal(ciGate.routerMode, "exact");
  assert.deepEqual(
    graph.edges.filter((e) => e.source === "candidate_ci_gate").map((e) => [e.target, e.label]),
    [
      ["output", "success"],
      ["pending", "pending"],
      ["failed", "failure"],
      ["error", "error"],
      ["warning", "warning"],
    ],
  );
  assert.equal(graph.nodes.find((n) => n.id === "output").data.kind, "output");
  assert(graph.nodes.find((n) => n.id === "output").data.inputs.includes("candidate_head_sha"));
  assert.equal(graph.nodes.find((n) => n.id === "warning").data.kind, "output");
  assert(!graph.edges.some((e) => e.source === "builder" && e.target === "output"));
  assert(
    graph.nodes.find((n) => n.id === "builder").data.systemPrompt.includes("exact-commit Dev"),
  );
});

test("only exact successful CI and successful native write/readback reach the human result gate", () => {
  const graph = devVerificationGraph({ serverName, approverUserIds: ["existing-owner"] });
  const approval = graph.nodes.find((n) => n.data.kind === "approval");
  assert.deepEqual(approval.data.approverUserIds, ["existing-owner"]);
  const incoming = (target) => graph.edges.filter((e) => e.target === target);
  assert.deepEqual(
    incoming("evidence_fields").map((e) => [e.source, e.label]),
    [["ci_gate", "success"]],
  );
  assert.deepEqual(
    incoming("evidence_read").map((e) => [e.source, e.label]),
    [["write_gate", "false"]],
  );
  assert.deepEqual(
    incoming("summary").map((e) => [e.source, e.label]),
    [["read_gate", "false"]],
  );
  assert.deepEqual(
    incoming(approval.id).map((e) => e.source),
    ["summary"],
  );
  for (const id of ["pending", "failed"]) {
    assert.equal(graph.nodes.find((n) => n.id === id).data.kind, "output");
    assert(!graph.edges.some((e) => e.source === id));
  }
  for (const node of graph.nodes.filter((n) => n.data.kind === "router")) {
    assert.equal(node.data.routerMode, "exact");
    const destinations = graph.edges.filter((e) => e.source === node.id).map((e) => e.target);
    assert.equal(
      new Set(destinations).size,
      destinations.length,
      "different exact branches cannot share a pruned target",
    );
  }
});

test("CI evidence uses standard exact-commit API and deterministic native typed argument composition", () => {
  const graph = devVerificationGraph({ serverName, approverUserIds: ["existing-owner"] });
  const ci = graph.nodes.find((n) => n.id === "ci").data;
  assert(ci.httpUrl.endsWith("/commits/{{input.candidateSha}}/status"));
  assert(ci.httpHeaders[0].value.includes("{{secret:MODULAR_GITEA_CI_READ}}"));
  const merge = graph.nodes.find((n) => n.id === "evidence_arguments").data;
  assert.equal(merge.kind, "merge");
  assert.equal(merge.mergeMode, "object");
  assert(merge.inputs.includes("effect") && merge.inputs.includes("content"));
  assert(
    !graph.nodes.some((n) =>
      ["agent", "function", "loop", "condition", "evaluate"].includes(n.data.kind),
    ),
  );
});
