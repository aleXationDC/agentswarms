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
  assert(agent.systemPrompt.includes("Use input.owner and input.repository exactly as supplied"));
  assert(agent.systemPrompt.includes("exact source transformation stated in the required input.request"));
  assert(agent.systemPrompt.includes("If input.request is absent, empty or ambiguous, stop before any write"));
  assert(!agent.systemPrompt.includes("input.task"));
  assert(!agent.systemPrompt.includes("do not imitate formatter output manually"));
  assert(!agent.systemPrompt.includes("parent_case_id"));
  assert(agent.systemPrompt.includes("Do not write the candidate evidence file"));
  assert(!JSON.stringify(graph).includes("caseAssignment"));
  assert(!JSON.stringify(graph).includes("cases.tsx"));
  assert.deepEqual(
    graph.nodes
      .filter((n) => n.data.kind === "function")
      .map((n) => n.id)
      .sort(),
    [
      "branch_error_projection",
      "candidate_evidence_readback_error_projection",
      "candidate_evidence_write_error_projection",
      "candidate_report_error_projection",
      "candidate_source_error_projection",
    ].sort(),
  );
  assert(!graph.nodes.some((n) => ["loop", "condition", "evaluate"].includes(n.data.kind)));
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
  for (const source of ["source", "work_order", "format_config"]) {
    assert(graph.edges.some((e) => e.source === source && e.target === "payloads"));
  }
  assert(graph.edges.some((e) => e.source === "branch_success" && e.target === "payloads"));
});

test("a failed effect-bound branch write exits before Builder or candidate calls", () => {
  const graph = builderGraph({ builderSnapshot, serverName });
  const branchProjection = graph.nodes.find((n) => n.id === "branch_error_projection").data;
  assert.equal(branchProjection.kind, "function");
  assert(branchProjection.functionCode.includes("JSON.parse(ctx.vars.branch_result)"));
  assert(branchProjection.functionCode.includes('if ("error" in wire) return true;'));
  assert(branchProjection.functionCode.includes("return wire.result.isError === true;"));
  const projectError = new Function("ctx", branchProjection.functionCode);
  assert.equal(
    projectError({ vars: { branch_result: JSON.stringify({ result: { content: [] } }) } }),
    false,
    "an omitted MCP isError flag is a successful response",
  );
  assert.equal(
    projectError({
      vars: {
        branch_result: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { content: [], isError: false },
        }),
      },
    }),
    false,
    "the actual successful MCP response envelope passes the branch gate",
  );
  assert.equal(
    projectError({
      vars: { branch_result: JSON.stringify({ result: { isError: true, content: [] } }) },
    }),
    true,
  );
  assert.equal(
    projectError({ vars: { branch_result: JSON.stringify({ error: "scope denied" }) } }),
    true,
  );
  assert.throws(() => projectError({ vars: { branch_result: "{}" } }), /missing result/);

  const branchGate = graph.nodes.find((n) => n.id === "branch_gate").data;
  assert.equal(branchGate.routerMode, "exact");
  assert.deepEqual(branchGate.inputs, ["branch_error_projection_is_error"]);
  assert.deepEqual(
    graph.edges.filter((edge) => edge.source === "branch_gate").map((edge) => [
      edge.target,
      edge.label,
    ]),
    [
      ["branch_success", "false"],
      ["branch_failed", "true"],
    ],
  );
  assert(!graph.edges.some((edge) => edge.source === "branch" && edge.target === "payloads"));
  assert(
    graph.nodes
      .find((node) => node.id === "branch_success")
      .data.stateAssignments.some(
        (assignment) =>
          assignment.key === "branch_payload" &&
          assignment.value === "{{branch_result.result.content[0].text}}",
      ),
  );
  assert.deepEqual(
    graph.edges.filter((edge) => edge.source === "branch_failed"),
    [],
    "a branch failure must be terminal",
  );
  assert.deepEqual(
    graph.edges.filter((edge) => edge.target === "builder").map((edge) => edge.source),
    ["context"],
  );
  assert.deepEqual(
    graph.edges.filter((edge) => edge.target === "candidate_source").map((edge) => edge.source),
    ["builder"],
  );
  assert.deepEqual(
    graph.edges.filter((edge) => edge.target === "candidate_report").map((edge) => edge.source),
    ["source_delta_gate"],
    "an unchanged source must stop before evidence fetch or write",
  );
  for (const target of ["source", "work_order", "format_config"]) {
    assert.deepEqual(
      graph.edges.filter((edge) => edge.target === target).map((edge) => [
        edge.source,
        edge.label,
      ]),
      [["branch_success", undefined]],
    );
    assert(!graph.edges.some((edge) => edge.source === "input" && edge.target === target));
  }
  assert.deepEqual(
    graph.edges.filter((edge) => edge.target === "payloads").map((edge) => [
      edge.source,
      edge.label,
    ]),
    [
      ["branch_success", undefined],
      ["source", undefined],
      ["work_order", undefined],
      ["format_config", undefined],
    ],
  );
});

test("native evidence write, exact readback, and no-op gate qualify only this changed source", () => {
  const graph = builderGraph({ builderSnapshot, serverName });
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  for (const edge of graph.edges) {
    assert(nodeIds.has(edge.source), `missing edge source ${edge.source}`);
    assert(nodeIds.has(edge.target), `missing edge target ${edge.target}`);
  }
  for (const router of graph.nodes.filter((n) => n.data.kind === "router")) {
    const targets = graph.edges.filter((e) => e.source === router.id).map((e) => e.target);
    assert.equal(
      new Set(targets).size,
      targets.length,
      `router ${router.id} routes must use distinct destinations`,
    );
  }
  assert.equal(
    graph.nodes.find((n) => n.id === "candidate_report").data.toolArgs.tool_name,
    "fetch",
  );
  assert.equal(
    graph.nodes.find((n) => n.id === "candidate_source").data.toolArgs.tool_name,
    "fetch",
  );
  const reportGate = graph.nodes.find((n) => n.id === "candidate_gate").data;
  assert.equal(reportGate.routerMode, "exact");
  assert.deepEqual(reportGate.inputs, ["candidate_report_error_projection_is_error"]);
  assert.deepEqual(
    graph.edges.filter((e) => e.source === "candidate_gate").map((e) => [e.target, e.label]),
    [
      ["candidate_report_metadata", "false"],
      ["report_read_error", "true"],
    ],
  );
  const sourceGate = graph.nodes.find((n) => n.id === "candidate_source_gate").data;
  assert.equal(sourceGate.routerMode, "exact");
  assert.deepEqual(sourceGate.inputs, ["candidate_source_error_projection_is_error"]);
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
  assert(
    graph.nodes
      .find((n) => n.id === "candidate_report_metadata")
      .data.stateAssignments.some((a) => a.key === "candidate_report_base_sha"),
  );

  const sourceDeltaGate = graph.nodes.find((n) => n.id === "source_delta_gate").data;
  assert.equal(sourceDeltaGate.routerMode, "exact");
  assert.equal(sourceDeltaGate.routerInputMode, "compare");
  assert.equal(sourceDeltaGate.routerComparison.left, "source_blob");
  assert.equal(sourceDeltaGate.routerComparison.right, "candidate_source_sha");
  assert.deepEqual(
    graph.edges.filter((e) => e.source === "source_delta_gate").map((e) => [e.target, e.label]),
    [
      ["no_source_change_status", "unchanged"],
      ["candidate_report", "changed"],
    ],
  );
  const noSourceChangeStatus = graph.nodes.find((n) => n.id === "no_source_change_status").data;
  assert.equal(
    noSourceChangeStatus.stateAssignments[0].value,
    "NO CANDIDATE: primary source is unchanged; candidate evidence and exact-SHA CI were skipped.",
  );
  const noSourceChangeOutput = graph.nodes.find((n) => n.id === "no_source_change").data;
  assert.deepEqual(noSourceChangeOutput.inputs, [
    "no_source_change_status",
    "source_blob",
    "candidate_source_sha",
  ]);
  assert.deepEqual(
    graph.edges.filter((e) => e.source === "no_source_change_status").map((e) => e.target),
    ["no_source_change"],
  );

  const evidenceFields = graph.nodes.find((n) => n.id === "candidate_evidence_fields").data;
  for (const key of [
    "owner",
    "repository",
    "branch",
    "path",
    "message",
    "current_sha",
    "effect",
  ]) {
    assert(evidenceFields.stateAssignments.some((a) => a.key === key));
  }
  const evidenceContent = evidenceFields.stateAssignments.find(
    (a) => a.key === "content",
  ).value;
  for (const field of [
    "{{input.caseId}}",
    "{{input.effect.attempt_id}}",
    "{{input.effect.operation_id}}-candidate-evidence",
    "{{input.baseline}}",
    "{{input.primarySourcePath}}",
    "{{source_blob}}",
    "{{candidate_source_sha}}",
    "{{candidate_source_last_commit_sha}}",
    "{{created_branch}}",
    "{{input.effect.case_id}}",
    "{{input.effect.attempt_id}}",
  ]) {
    assert(evidenceContent.includes(field));
  }
  assert(evidenceContent.includes('"changedPaths": ["{{input.primarySourcePath}}"]'));
  const evidenceEffect = evidenceFields.stateAssignments.find((a) => a.key === "effect").value;
  assert(evidenceEffect.includes('"case_id":"{{input.effect.case_id}}"'));
  assert(evidenceEffect.includes('"attempt_id":"{{input.effect.attempt_id}}"'));
  assert(evidenceEffect.includes('"operation_id":"{{input.effect.operation_id}}-candidate-evidence"'));

  const evidenceMerge = graph.nodes.find((n) => n.id === "candidate_evidence_arguments").data;
  assert.equal(evidenceMerge.kind, "merge");
  assert.equal(evidenceMerge.mergeMode, "object");
  for (const field of [
    "owner",
    "repository",
    "branch",
    "path",
    "content",
    "message",
    "current_sha",
    "effect",
  ]) {
    assert(evidenceMerge.inputs.includes(field));
  }
  assert.equal(
    graph.nodes.find((n) => n.id === "candidate_evidence_write").data.toolArgs.arguments,
    "{{candidate_evidence_arguments}}",
  );

  for (const [gateId, falseTarget, trueTarget] of [
    ["candidate_evidence_write_gate", "candidate_evidence_readback", "candidate_evidence_write_error"],
    [
      "candidate_evidence_readback_gate",
      "candidate_evidence_lineage_projection",
      "candidate_evidence_readback_error",
    ],
  ]) {
    assert.equal(graph.nodes.find((n) => n.id === gateId).data.routerMode, "exact");
    assert.deepEqual(
      graph.edges.filter((e) => e.source === gateId).map((e) => [e.target, e.label]),
      [
        [falseTarget, "false"],
        [trueTarget, "true"],
      ],
    );
  }
  const evidenceReadback = graph.nodes.find(
    (n) => n.id === "candidate_evidence_readback_projection",
  ).data;
  assert.deepEqual(
    evidenceReadback.stateAssignments.map((assignment) => assignment.key),
    ["candidate_evidence_readback_payload"],
    "readback payload must be available before dependent projections run",
  );
  const lineageProjection = graph.nodes.find(
    (n) => n.id === "candidate_evidence_lineage_projection",
  ).data;
  assert.deepEqual(
    lineageProjection.stateAssignments.map((assignment) => [
      assignment.key,
      assignment.value,
    ]),
    [
      [
        "candidate_report_content",
        "{{candidate_evidence_readback_payload.decoded_content}}",
      ],
      [
        "candidate_report_commit",
        "{{candidate_evidence_readback_payload.last_commit_sha}}",
      ],
    ],
  );
  assert.deepEqual(
    graph.edges
      .filter((edge) => edge.target === "candidate_lineage_gate")
      .map((edge) => edge.source),
    ["candidate_evidence_lineage_projection"],
  );

  const lineageGate = graph.nodes.find((n) => n.id === "candidate_lineage_gate").data;
  assert.equal(lineageGate.routerMode, "exact");
  assert.equal(lineageGate.routerInputMode, "compare");
  assert.equal(lineageGate.routerComparison.left, "candidate_report_content");
  assert.equal(lineageGate.routerComparison.right, "content");
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
      ["stale_report", "stale"],
      ["candidate_ci", "current"],
    ],
  );
  assert.deepEqual(
    graph.edges.filter((e) => e.target === "report_head_gate").map((e) => e.source),
    ["branch_head"],
  );
  assert.deepEqual(
    graph.edges.filter((e) => e.target === "candidate_ci").map((e) => [e.source, e.label]),
    [["report_head_gate", "current"]],
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
  assert(evidenceContent.includes('"sourceChangeSha"'));
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
