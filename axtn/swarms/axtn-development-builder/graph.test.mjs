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
  assert.equal(
    graph.nodes.find((n) => n.id === "candidate_source").data.toolArgs.tool_name,
    "fetch",
  );
  assert.equal(graph.nodes.find((n) => n.id === "candidate_gate").data.routerMode, "exact");
  assert.deepEqual(
    graph.edges.filter((e) => e.source === "candidate_gate").map((e) => [e.target, e.label]),
    [
      ["candidate_source_gate", "false"],
      ["report_read_error", "true"],
    ],
  );
  assert.equal(graph.nodes.find((n) => n.id === "candidate_source_gate").data.routerMode, "exact");
  assert.deepEqual(
    graph.edges.filter((e) => e.source === "candidate_source_gate").map((e) => [e.target, e.label]),
    [
      ["candidate_metadata", "false"],
      ["source_read_error", "true"],
    ],
  );
  const metadata = graph.nodes.find((n) => n.id === "candidate_metadata").data;
  assert(metadata.stateAssignments.some((a) => a.key === "candidate_source_sha"));
  assert(metadata.stateAssignments.some((a) => a.key === "candidate_source_last_commit_sha"));
  const lineage = graph.nodes.find((n) => n.id === "candidate_lineage_projection").data;
  assert(lineage.stateAssignments.some((a) => a.key === "reported_lineage"));
  assert(lineage.stateAssignments.some((a) => a.key === "expected_lineage"));
  const reportedLineage = lineage.stateAssignments.find((a) => a.key === "reported_lineage").value;
  const expectedLineage = lineage.stateAssignments.find((a) => a.key === "expected_lineage").value;
  for (const field of [
    "caseId",
    "attemptId",
    "operationId",
    "baselineSha",
    "primarySourcePath",
    "baselineSourceBlobSha",
    "resultSourceBlobSha",
    "sourceChangeSha",
    "effect.case_id",
    "effect.attempt_id",
    "effect.operation_id",
  ]) {
    assert(reportedLineage.includes(`candidate_report_content.${field}`));
  }
  for (const field of [
    "input.caseId",
    "input.attemptId",
    "input.baseline",
    "input.primarySourcePath",
    "source_blob",
    "candidate_source_sha",
    "candidate_source_last_commit_sha",
    "input.effect.case_id",
    "input.effect.attempt_id",
    "input.effect.operation_id",
  ]) {
    assert(expectedLineage.includes(`{{${field}}}`));
  }
  assert(expectedLineage.includes("-candidate-evidence"));
  const lineageGate = graph.nodes.find((n) => n.id === "candidate_lineage_gate").data;
  assert.equal(lineageGate.routerMode, "exact");
  assert.equal(lineageGate.routerInputMode, "compare");
  assert.equal(lineageGate.routerComparison.left, "reported_lineage");
  assert.equal(lineageGate.routerComparison.right, "expected_lineage");
  assert.deepEqual(
    graph.edges
      .filter((e) => e.source === "candidate_lineage_gate")
      .map((e) => [e.target, e.label]),
    [
      ["branch_head", "match"],
      ["lineage_mismatch", "mismatch"],
    ],
  );
  const branchHead = graph.nodes.find((n) => n.id === "branch_head").data;
  assert.equal(branchHead.httpResponsePath, "commit.id");
  assert(branchHead.httpUrl.endsWith("/branches/{{created_branch}}"));
  assert(branchHead.httpHeaders[0].value.includes("{{secret:MODULAR_GITEA_CI_READ}}"));
  const reportHeadGate = graph.nodes.find((n) => n.id === "report_head_gate").data;
  assert.equal(reportHeadGate.routerMode, "exact");
  assert.equal(reportHeadGate.routerInputMode, "compare");
  assert.equal(reportHeadGate.routerComparison.left, "candidate_report_commit");
  assert.equal(reportHeadGate.routerComparison.right, "candidate_head_sha");
  assert.deepEqual(
    graph.edges.filter((e) => e.source === "report_head_gate").map((e) => [e.target, e.label]),
    [
      ["source_delta_gate", "current"],
      ["stale_report", "stale"],
    ],
  );
  const sourceDeltaGate = graph.nodes.find((n) => n.id === "source_delta_gate").data;
  assert.equal(sourceDeltaGate.routerMode, "exact");
  assert.equal(sourceDeltaGate.routerInputMode, "compare");
  assert.equal(sourceDeltaGate.routerComparison.left, "source_blob");
  assert.equal(sourceDeltaGate.routerComparison.right, "candidate_source_sha");
  assert.deepEqual(
    graph.edges.filter((e) => e.source === "source_delta_gate").map((e) => [e.target, e.label]),
    [
      ["candidate_ci", "changed"],
      ["no_source_change", "unchanged"],
    ],
  );
  assert.deepEqual(
    graph.edges.filter((e) => e.target === "candidate_ci").map((e) => [e.source, e.label]),
    [["source_delta_gate", "changed"]],
  );
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
  assert(graph.nodes.find((n) => n.id === "builder").data.systemPrompt.includes("sourceChangeSha"));
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
