const node = (id, kind, data, x = 0, y = 0) => ({
  id,
  position: { x, y },
  data: { id, kind, onError: "fail", retryCount: 0, ...data },
});
const edge = (source, target, label) => ({
  id: `${source}-${target}`,
  source,
  target,
  ...(label === undefined ? {} : { label }),
});
const mcp = (id, tool, args, outputVar, serverName) =>
  node(id, "tool", {
    label: `${tool}: ${id}`,
    toolId: "mcp_call_tool",
    outputVar,
    toolArgs: { server_name: serverName, tool_name: tool, arguments: args },
    toolConfigs: { mcp_server_names: [serverName] },
  });

export function builderGraph({
  builderSnapshot,
  serverName,
  model = builderSnapshot.model,
  maxTokens = builderSnapshot.maxTokens,
}) {
  const nodes = [
    node("input", "input", {
      label: "Authorized Git work order and Case Attempt",
      outputVar: "input",
    }),
    mcp(
      "branch",
      "create_branch",
      '{"owner":"{{input.owner}}","repository":"{{input.repository}}","branch":"{{input.branchPrefix}}","from_ref":"{{input.baseline}}","effect":{{input.effect}}}',
      "branch_result",
      serverName,
    ),
    mcp(
      "source",
      "fetch",
      '{"owner":"{{input.owner}}","repository":"{{input.repository}}","target":"file","identifier":"{{input.primarySourcePath}}","ref":"{{input.baseline}}"}',
      "source_result",
      serverName,
    ),
    mcp(
      "work_order",
      "fetch",
      '{"owner":"{{input.owner}}","repository":"{{input.repository}}","target":"file","identifier":"{{input.workOrderPath}}","ref":"{{input.workOrderRevision}}"}',
      "work_order_result",
      serverName,
    ),
    mcp(
      "format_config",
      "fetch",
      '{"owner":"{{input.owner}}","repository":"{{input.repository}}","target":"file","identifier":"{{input.formatConfigPath}}","ref":"{{input.baseline}}"}',
      "format_config_result",
      serverName,
    ),
    node("payloads", "set_var", {
      label: "Native MCP response projections",
      stateAssignments: [
        { key: "source_payload", value: "{{source_result.result.content[0].text}}" },
        { key: "branch_payload", value: "{{branch_result.result.content[0].text}}" },
        { key: "work_order_payload", value: "{{work_order_result.result.content[0].text}}" },
        { key: "format_config_payload", value: "{{format_config_result.result.content[0].text}}" },
      ],
    }),
    node("context", "set_var", {
      label: "Complete primary source and actual effect branch",
      stateAssignments: [
        { key: "source_text", value: "{{source_payload.decoded_content}}" },
        { key: "source_blob", value: "{{source_payload.sha}}" },
        { key: "created_branch", value: "{{branch_payload.name}}" },
        { key: "work_order_text", value: "{{work_order_payload.decoded_content}}" },
        { key: "format_config_text", value: "{{format_config_payload.decoded_content}}" },
      ],
    }),
    node("builder", "agent", {
      ...structuredClone(builderSnapshot),
      model,
      maxTokens,
      id: "builder",
      kind: "agent",
      label: "Standalone Development Builder",
      inputs: [
        "input",
        "source_text",
        "source_blob",
        "created_branch",
        "work_order_text",
        "format_config_text",
      ],
      outputVar: "builder_result",
      enabledTools: ["mcp_call_tool"],
      toolConfigs: { mcp_server_names: [serverName] },
      onError: "fail",
      retryCount: 0,
      temperature: 0.2,
      systemPrompt: [
        "You are the native Development Builder. Execute the authorized Git work order supplied in input, using only your dedicated scoped MCP server.",
        'Every mcp_call_tool invocation MUST have exactly three top-level fields: {"server_name":"<dedicated server>","tool_name":"fetch or upsert_file","arguments":{...}}. `arguments` MUST be the remote tool\'s JSON object, never a JSON-encoded string. Never omit tool_name. Never repeat an identical invalid-parameters call: stop and report the exact malformed argument instead.',
        "The native source node supplies the complete primary source and its Git blob. The branch node already created the actual effect-derived branch. Never create a second branch or invent a ref. Additional necessary sources must be read from the pinned Git work order/baseline. Repository paths belong in task input and Git, never in this reusable process definition.",
        "The pinned work order and actual repository formatting configuration are already supplied as complete decoded native projections. Do not spend tool calls rediscovering or refetching them. Fetch only genuinely missing small related sources, then perform the authorized writes.",
        "Use real tool calls. Independently fetch the work order and related small sources; batch independent reads within the existing tool-round budget. Do not refetch a large primary file: the model's tool transcript is capped, but the supplied native projection is complete. Stop if any required source is incomplete.",
        "Implement only the authorized task; preserve existing code, tests, Case identities and history. Do not invent a product defect to demonstrate a write. For every upsert_file use the actual current_sha, full UTF-8 content, actual created_branch, and exactly the effect keys case_id, attempt_id, operation_id. Derive each file's distinct operation_id from input.effect.operation_id plus a stable file suffix. Never put AXTN-EFFECT markers in messages.",
        "Intermediate writes use [skip ci] in their commit message. The final candidate evidence write does not: it triggers the existing standard Gitea Dev workflow. Read back every changed file and branch. Do not claim formatting, lint, behavior tests, typecheck, build, CI, UAT or approval passed based on model reasoning or Git success.",
        "Return exact candidate branch/SHA and Git evidence references; CI remains pending until the separately callable native Dev verifier reads the exact-commit result. At most three causal correction cycles are permitted by the work contract, but this single invocation never silently restarts itself, changes its Effect payload or grants its own acceptance. Stop on scope denial, uncertain write or exhausted tool budget.",
      ].join("\n\n"),
    }),
    mcp(
      "candidate_report",
      "fetch",
      '{"owner":"{{input.owner}}","repository":"{{input.repository}}","target":"file","identifier":"{{input.candidateEvidencePath}}","ref":"{{created_branch}}"}',
      "candidate_report_result",
      serverName,
    ),
    node("candidate_projection", "set_var", {
      label: "Do not report an unwritten candidate artifact as successful work",
      stateAssignments: [
        { key: "candidate_is_error", value: "{{candidate_report_result.result.isError}}" },
      ],
    }),
    node("candidate_gate", "router", {
      label: "Require actual persisted candidate evidence before returning a candidate",
      routerMode: "exact",
      inputs: ["candidate_is_error"],
      outputVar: "candidate_verified",
    }),
    mcp(
      "head",
      "fetch",
      '{"owner":"{{input.owner}}","repository":"{{input.repository}}","target":"branch","identifier":"{{created_branch}}"}',
      "candidate_head",
      serverName,
    ),
    node("output", "output", {
      label: "Actual Git candidate; asynchronous Dev result not yet acceptance",
      inputs: ["builder_result", "candidate_head"],
      outputVar: "output",
    }),
  ];
  const edges = [
    edge("input", "branch"),
    edge("input", "source"),
    edge("input", "work_order"),
    edge("input", "format_config"),
    edge("branch", "payloads"),
    edge("source", "payloads"),
    edge("work_order", "payloads"),
    edge("format_config", "payloads"),
    edge("payloads", "context"),
    edge("context", "builder"),
    edge("builder", "candidate_report"),
    edge("candidate_report", "candidate_projection"),
    edge("candidate_projection", "candidate_gate"),
    edge("candidate_gate", "head", "false"),
    edge("head", "output"),
  ];
  return { nodes, edges };
}

export function devVerificationGraph({ serverName, approverUserIds }) {
  const nodes = [
    node("input", "input", {
      label: "Actual immutable candidate and Case Attempt",
      outputVar: "input",
    }),
    node("ci", "http", {
      label: "Read standard Gitea CI state for the exact requested commit",
      inputs: ["input"],
      outputVar: "ci_result",
      httpMethod: "GET",
      httpUrl:
        "http://axtn-gitea:3000/api/v1/repos/aXtn/axtn-agentswarms/commits/{{input.candidateSha}}/status",
      httpHeaders: [{ key: "Authorization", value: "token {{secret:MODULAR_GITEA_CI_READ}}" }],
      httpTimeoutMs: 30000,
    }),
    node("ci_projection", "set_var", {
      label: "Project actual CI state without a model judge",
      stateAssignments: [{ key: "ci_state", value: "{{ci_result.state}}" }],
    }),
    node("ci_gate", "router", {
      label: "Only actual successful Dev checks may request result review",
      routerMode: "exact",
      inputs: ["ci_state"],
      outputVar: "ci_gate",
    }),
    node("evidence_fields", "set_var", {
      label: "Construct real CI evidence using native projections",
      stateAssignments: [
        { key: "owner", value: "{{input.owner}}" },
        { key: "repository", value: "{{input.repository}}" },
        { key: "branch", value: "{{input.branch}}" },
        { key: "path", value: "{{input.evidencePath}}" },
        {
          key: "content",
          value: "# Native exact-commit Dev evidence\n\n```json\n{{ci_result}}\n```\n",
        },
        { key: "message", value: "docs: persist actual exact-commit Builder Dev result [skip ci]" },
        { key: "effect", value: "{{input.effect}}" },
      ],
    }),
    node("evidence_arguments", "merge", {
      label: "Native typed argument composition",
      mergeMode: "object",
      inputs: ["owner", "repository", "branch", "path", "content", "message", "effect"],
      outputVar: "evidence_arguments",
    }),
    mcp(
      "evidence_write",
      "upsert_file",
      "{{evidence_arguments}}",
      "evidence_write_result",
      serverName,
    ),
    node("write_projection", "set_var", {
      label: "Check the actual MCP write response",
      stateAssignments: [
        { key: "write_is_error", value: "{{evidence_write_result.result.isError}}" },
      ],
    }),
    node("write_gate", "router", {
      label: "No result approval after a failed evidence write",
      routerMode: "exact",
      inputs: ["write_is_error"],
      outputVar: "write_gate",
    }),
    mcp(
      "evidence_read",
      "fetch",
      '{"owner":"{{input.owner}}","repository":"{{input.repository}}","target":"file","identifier":"{{input.evidencePath}}","ref":"{{input.branch}}"}',
      "evidence_read_result",
      serverName,
    ),
    node("read_projection", "set_var", {
      label: "Verify native evidence fetch success",
      stateAssignments: [
        { key: "read_is_error", value: "{{evidence_read_result.result.isError}}" },
        { key: "evidence_payload", value: "{{evidence_read_result.result.content[0].text}}" },
      ],
    }),
    node("read_gate", "router", {
      label: "No result approval without persisted evidence readback",
      routerMode: "exact",
      inputs: ["read_is_error"],
      outputVar: "read_gate",
    }),
    node("summary", "set_var", {
      label: "Revision-bound Builder result decision summary",
      stateAssignments: [
        {
          key: "result_review",
          value: [
            "Temporäres Builder-Ergebnisreview, keine erneute Planfreigabe.",
            "Case: {{input.caseId}}",
            "Geprüfter Kandidat: {{ci_result.sha}}",
            "CI: {{ci_result.state}}; Prüfkontexte: {{ci_result.total_count}}",
            "Kandidat: https://git.alexation.com/aXtn/axtn-agentswarms/src/commit/{{ci_result.sha}}",
            "Prüfbeleg: {{evidence_payload.path}}",
            "Evidence-Commit: {{evidence_payload.last_commit_sha}}; Blob: {{evidence_payload.sha}}",
            "Auftrag: {{input.workOrderPath}}@{{input.workOrderRevision}}",
            "Erforderliche unabhängige Reviews, Audit, Integration, UAT und Produktionsfreigabe bleiben separat.",
          ].join("\n"),
        },
      ],
    }),
    node("result_review", "approval", {
      label: "Temporary Builder result review",
      approvalTitle: "Builder-Ergebnis und echte Dev-Prüfbelege prüfen",
      approvalRisk: "medium",
      inputs: ["result_review"],
      outputVar: "builder_result_review",
      approverUserIds,
      approverGroupIds: [],
      approvalTimeoutMs: 0,
    }),
    node("output", "output", {
      label: "Builder result review continued",
      inputs: ["result_review"],
      outputVar: "output",
    }),
    node("pending", "output", {
      label: "Dev checks still pending; no result approval",
      inputs: ["ci_result"],
      outputVar: "output",
    }),
    node("failed", "output", {
      label: "Dev checks failed; retain same work for bounded correction",
      inputs: ["ci_result"],
      outputVar: "output",
    }),
    node("error", "output", {
      label: "Dev status API returned an error; no result approval",
      inputs: ["ci_result"],
      outputVar: "output",
    }),
  ];
  const edges = [
    edge("input", "ci"),
    edge("ci", "ci_projection"),
    edge("ci_projection", "ci_gate"),
    edge("ci_gate", "evidence_fields", "success"),
    edge("ci_gate", "pending", "pending"),
    edge("ci_gate", "failed", "failure"),
    edge("ci_gate", "error", "error"),
    edge("evidence_fields", "evidence_arguments"),
    edge("evidence_arguments", "evidence_write"),
    edge("evidence_write", "write_projection"),
    edge("write_projection", "write_gate"),
    edge("write_gate", "evidence_read", "false"),
    edge("evidence_read", "read_projection"),
    edge("read_projection", "read_gate"),
    edge("read_gate", "summary", "false"),
    edge("summary", "result_review"),
    edge("result_review", "output"),
  ];
  return { nodes, edges };
}
