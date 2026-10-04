import type { Node, Edge } from "@xyflow/react";
import type { SwarmNodeData } from "@/lib/swarmRuntime";

// Native Function snippets only validate/shape data. Execution order, fan-out,
// joining, checkpoints and Approval remain in the existing graph runtimes.
const parse = `
const read = value => {
  if (typeof value !== "string") return value;
  const text = value.trim().replace(/^\\x60\\x60\\x60(?:json)?\\s*|\\s*\\x60\\x60\\x60$/g, "");
  return JSON.parse(text);
};
const required = (test, message) => { if (!test) throw new Error(message); };
const wire = value => {
  const envelope = read(value);
  required(!envelope.error && envelope.result && !envelope.result.isError, "MCP operation failed");
  if (envelope.result.structuredContent !== undefined) return envelope.result.structuredContent;
  required(envelope.result.content?.length === 1 && envelope.result.content[0].type === "text", "Malformed MCP result");
  return read(envelope.result.content[0].text);
};
`;

const taskCode = `${parse}
const task = read(ctx.input);
required(task.schema === "axtn.development.task/v1", "Typed Task required");
required(task.repository === "aXtn/development-swarm-acceptance", "Repository denied");
required(/^[a-f0-9]{40}$/.test(task.baseSHA), "Immutable base required");
required(/^[a-f0-9-]{36}$/.test(task.caseId), "Case required");
required(["taskId", "attemptId"].every(k => /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(task[k])), "Task/Attempt required");
required(typeof task.request === "string" && task.request.length > 0 && task.request.length <= 8000, "Bounded request required");
required(task.path === "src/normalize_score.py", "Slice path denied");
required(Object.keys(task).every(k => ["schema","repository","baseSHA","caseId","taskId","attemptId","request","path"].includes(k)), "Unexpected Task field");
return {...task, verifyRequest: {operation: "ensure", work: {
  sourceId: task.taskId + ":verify", subject: "Native deterministic Candidate verification",
  caseType: "DEVELOPMENT_VERIFY", parentCaseId: task.caseId,
  workContractRef: {kind: "contract", repository: "aXtn/aXtn-agentswarms",
    id: "handoffs/requests/AXTN-DEVELOPMENT-SWARM-NATIVE-0002.md"},
  scenarioClass: "synthetic_acceptance", scenarioId: task.taskId,
  processingMode: "DETERMINISTIC", executionChannel: "SWARM", actorRef: "native-verify",
  taskId: task.taskId, inputRevision: task.baseSHA, testProfile: "python-normalization-v1",
  requiredDependencies: [], references: []
}}};
`;

const branchCode = `${parse}
const task = read(ctx.vars.task), builder = read(ctx.vars.builder);
required(builder.schema === "axtn.development.candidate-content/v1", "Typed Builder output required");
required(Object.keys(builder).every(k => ["schema","path","content"].includes(k)), "Unexpected Builder field");
required(builder.path === task.path && typeof builder.content === "string" && builder.content.length > 0 &&
  builder.content.length <= 16000, "Bounded Candidate content required");
return {owner: "aXtn", repository: "development-swarm-acceptance", branch: "work/native-slice-v1",
  from_ref: task.baseSHA, effect: {case_id: task.caseId, attempt_id: task.attemptId, operation_id: "branch"}};
`;

const fileCode = `${parse}
const task = read(ctx.vars.task), builder = read(ctx.vars.builder), branch = wire(ctx.vars.branch);
required(typeof branch.name === "string" && branch.name.startsWith("work/") && branch.base_sha === task.baseSHA,
  "Effect-bound branch readback required");
return {owner: "aXtn", repository: "development-swarm-acceptance", branch: branch.name,
  path: task.path, content: builder.content, message: "Native Development Swarm Candidate",
  effect: {case_id: task.caseId, attempt_id: task.attemptId, operation_id: "candidate-file"}};
`;

const candidateCode = `${parse}
const task = read(ctx.vars.task), builder = read(ctx.vars.builder), file = wire(ctx.vars.file), branch = wire(ctx.vars.branch);
required(/^[a-f0-9]{40}$/.test(file.commit?.sha) && /^[a-f0-9]{40}$/.test(file.content?.sha),
  "Immutable Candidate commit/content readback required");
const verifyCase = read(ctx.vars.verify_work);
required(typeof verifyCase.case_id === "string", "Native Verify Case identity required");
const transition = (caseId, operationId, eventType, processingMode = "SEMANTIC") => ({operation: "transition", transition: {
  caseId, transitionKey: task.attemptId + ":" + operationId,
  eventType, reasonCode: "NATIVE_CANDIDATE_MATERIALIZED", actorRef: "native-builder",
  candidateSHA: file.commit.sha, attemptId: task.attemptId,
  processingMode, executionChannel: "SWARM",
  references: [{kind: "repository", repository: task.repository, id: branch.name, revision: file.commit.sha}]
}});
return {schema: "axtn.development.candidate/v1", caseId: task.caseId, taskId: task.taskId, attemptId: task.attemptId,
  repository: task.repository, baseSHA: task.baseSHA, candidateSHA: file.commit.sha, branch: branch.name,
  files: [{path: builder.path, content: builder.content, contentHash: file.content.sha}],
  parentUpdate: transition(task.caseId, "candidate", "CANDIDATE_UPDATED"),
  parentStart: transition(task.caseId, "work-start", "STARTED"),
  verifyUpdate: transition(verifyCase.case_id, "verify-candidate", "CANDIDATE_UPDATED"),
  verifyStart: transition(verifyCase.case_id, "verify-start", "STARTED", "DETERMINISTIC"),
  verifyCall: {operation: "verify", caseId: verifyCase.case_id, transitionKey: task.attemptId + ":verify"}
};
`;

export const nativeDevelopmentGateCode = `${parse}
const joined = read(ctx.input), candidate = read(ctx.vars.candidate);
required(joined && ["security","contract","maintainability","verify"].every(k => k in joined), "All four joined results required");
const findings = [];
for (const role of ["security","contract","maintainability"]) {
  const review = read(joined[role]);
  required(review.schema === "axtn.development.review/v1" && review.role === role &&
    review.candidateSHA === candidate.candidateSHA && review.contentHash === candidate.files[0].contentHash &&
    Array.isArray(review.findings) && review.findings.length <= 30, "Immutable typed " + role + " review required");
  required(Object.keys(review).every(k => ["schema","role","candidateSHA","contentHash","findings"].includes(k)), "Unexpected Review field");
  for (const finding of review.findings) {
    required(["LOW","MEDIUM","HIGH","CRITICAL"].includes(finding.severity) &&
      typeof finding.blocking === "boolean" && typeof finding.accepted === "boolean" &&
      typeof finding.summary === "string" && finding.summary.length > 0 && finding.summary.length <= 1000 &&
      Object.keys(finding).every(k => ["severity","blocking","accepted","summary"].includes(k)), "Typed Finding required");
    findings.push({...finding, role});
  }
}
const verify = read(joined.verify), evidence = verify.evidence;
const deterministicPass = verify.status === "COMPLETED" && evidence?.schema === "axtn.development.verify/v1" &&
  evidence.candidateSHA === candidate.candidateSHA && evidence.attemptId === candidate.attemptId &&
  evidence.taskId === candidate.taskId && evidence.baseSHA === candidate.baseSHA &&
  evidence.sessionId === verify.sessionId && /^sha256:[a-f0-9]{64}$/.test(evidence.image) &&
  /^[a-f0-9]{64}$/.test(evidence.inputHash) && /^[a-f0-9]{64}$/.test(evidence.harnessHash) &&
  evidence.gateVerdict === "PASS" && evidence.candidate?.pass === true &&
  evidence.candidate.compileExitCode === 0 && evidence.candidate.testsRun > 0;
const blocked = findings.some(f => f.accepted && f.blocking && f.severity !== "LOW");
const verdict = deterministicPass && !blocked ? "PASS" : "BLOCKED";
const references = evidence ? [
  {kind: "run", repository: "aXtn/aXtn-agentswarms", id: evidence.sessionId},
  {kind: "evidence", repository: "aXtn/aXtn-agentswarms",
    id: "notebook-runtime/" + evidence.sessionId + "/receipt", revision: candidate.candidateSHA}
] : [];
return {schema: "axtn.development.gate/v1", caseId: candidate.caseId, candidateSHA: candidate.candidateSHA,
  attemptId: candidate.attemptId, verdict, findings, evidence: evidence || null,
  checksTransition: {operation: "transition", transition: {
    caseId: candidate.caseId, transitionKey: candidate.attemptId + ":deterministic-checks",
    eventType: deterministicPass ? "CHECKS_PASSED" : "CHECKS_FAILED", reasonCode: "NATIVE_DETERMINISTIC_RECEIPT",
    actorRef: "native-verify", candidateSHA: candidate.candidateSHA, attemptId: candidate.attemptId,
    processingMode: "DETERMINISTIC", executionChannel: "SWARM", references,
    ...(evidence ? {runId: evidence.sessionId} : {})
  }},
  verifyComplete: {operation: "transition", transition: {
    caseId: read(ctx.vars.verify_work).case_id, transitionKey: candidate.attemptId + ":verify-complete",
    eventType: "COMPLETED", reasonCode: "NATIVE_DETERMINISTIC_RECEIPT", actorRef: "native-verify",
    candidateSHA: candidate.candidateSHA, attemptId: candidate.attemptId, references
  }},
  caseTransition: {operation: "transition", transition: {
    caseId: candidate.caseId, transitionKey: candidate.attemptId + ":review-gate", eventType: verdict === "PASS" ? "REVIEWED" : "BLOCKED",
    reasonCode: verdict === "PASS" ? "NATIVE_REVIEW_GATE_PASS" : "NATIVE_REVIEW_GATE_BLOCKED",
    actorRef: "native-review", candidateSHA: candidate.candidateSHA, attemptId: candidate.attemptId,
    processingMode: "DETERMINISTIC", executionChannel: "SWARM",
    references
  }}
};
`;

const hardGateCode = `${parse}
const gate = read(ctx.vars.gate);
required(gate.verdict === "PASS", JSON.stringify({outcome: "BLOCKED", findings: gate.findings, evidence: gate.evidence}));
return gate;
`;

const pullCode = `${parse}
required(ctx.vars.approved_approved === "yes", "Native independent Approval required");
const candidate = read(ctx.vars.candidate);
return {owner: "aXtn", repository: "development-swarm-acceptance", action: "create",
  title: "Native Development Swarm: " + candidate.taskId, body: "Reviewed immutable Candidate " + candidate.candidateSHA,
  head: candidate.branch, base: "main", expected_head_sha: candidate.candidateSHA,
  effect: {case_id: candidate.caseId, attempt_id: candidate.attemptId, operation_id: "pr"}};
`;

const resultCode = `${parse}
const candidate = read(ctx.vars.candidate), pull = wire(ctx.vars.pull);
required(pull.head?.sha === candidate.candidateSHA && pull.state === "open" && !pull.merged &&
  Number.isInteger(pull.number) && pull.number > 0, "Exact open PR readback required");
return {schema: "axtn.development.result/v1", outcome: "PR_READY", ...candidate, pullRequest: pull.number,
  evidence: read(ctx.vars.gate).evidence,
  acceptRequest: {operation: "accept", caseId: candidate.caseId,
    transitionKey: candidate.attemptId + ":independent-acceptance",
    candidateSHA: candidate.candidateSHA, approvalId: ctx.vars.approved_approval_id},
  completeRequest: {operation: "transition", transition: {
    caseId: candidate.caseId, transitionKey: candidate.attemptId + ":complete",
    eventType: "COMPLETED", reasonCode: "NATIVE_PR_READY_VERIFIED", actorRef: "native-builder",
    candidateSHA: candidate.candidateSHA,
    references: [
      {kind: "pull_request", repository: candidate.repository, id: String(pull.number), revision: candidate.candidateSHA},
      {kind: "evidence", repository: "aXtn/aXtn-agentswarms",
        id: "notebook-runtime/" + read(ctx.vars.gate).evidence.sessionId + "/receipt", revision: candidate.candidateSHA}
    ]
  }},
  caseTransition: {operation: "transition", transition: {
    caseId: candidate.caseId, transitionKey: candidate.attemptId + ":pr-ready", eventType: "PR_CREATED",
    reasonCode: "NATIVE_REVIEWABLE_PR_READY", actorRef: "native-integration",
    candidateSHA: candidate.candidateSHA, attemptId: candidate.attemptId,
    processingMode: "DETERMINISTIC", executionChannel: "SWARM",
    references: [{kind: "pull_request", repository: candidate.repository, id: String(pull.number), revision: candidate.candidateSHA}]
  }}
};
`;

export function createNativeDevelopmentSwarm(config: {
  provider: string;
  model: string;
  reviewerUserIds?: string[];
  reviewerGroupIds?: string[];
}): { nodes: Node<SwarmNodeData>[]; edges: Edge[] } {
  if (!config.provider || !config.model)
    throw new Error("Explicit existing provider/model required");
  if (!config.reviewerUserIds?.length && !config.reviewerGroupIds?.length) {
    throw new Error("Explicit existing reviewer assignment required");
  }
  const nodes: Node<SwarmNodeData>[] = [];
  const edges: Edge[] = [];
  const add = (
    id: string,
    kind: SwarmNodeData["kind"],
    label: string,
    data: Partial<SwarmNodeData>,
    parents: string[],
  ) => {
    nodes.push({
      id,
      type: kind,
      position: { x: nodes.length * 180, y: 240 },
      data: { kind, label, outputVar: id, onError: "fail", retryCount: 0, ...data },
    });
    for (const parent of parents) edges.push({ id: `${parent}-${id}`, source: parent, target: id });
  };
  const fn = (id: string, label: string, code: string, parents: string[]) =>
    add(id, "function", label, { functionCode: code }, parents);
  const work = (id: string, label: string, request: string, parents: string[]) =>
    add(id, "tool", label, { toolId: "case_work", toolArgs: { request } }, parents);
  const mcp = (id: string, label: string, tool: string, argumentsVar: string, parents: string[]) =>
    add(
      id,
      "tool",
      label,
      {
        toolId: "mcp_call_tool",
        toolArgs: {
          server_name: "aXtn Development Gitea",
          tool_name: tool,
          arguments: `{{${argumentsVar}}}`,
        },
        toolConfigs: { mcp_server_names: ["aXtn Development Gitea"] },
      },
      parents,
    );
  const agentConfig = {
    provider: config.provider,
    model: config.model,
    temperature: 0,
    enabledTools: [],
    memory: { stm_enabled: false, ltm_enabled: false, ltm_scope: "none" as const },
  };
  add("input", "input", "Development Task", {}, []);
  fn("task", "Validate immutable Task", taskCode, ["input"]);
  work("verify_work", "Ensure native Verify Work", "{{task.verifyRequest}}", ["task"]);
  add(
    "builder",
    "agent",
    "Builder",
    {
      ...agentConfig,
      inputs: ["task"],
      systemPrompt:
        "Implement only the requested Python normalize_score function. Return strict JSON only: " +
        '{"schema":"axtn.development.candidate-content/v1","path":"src/normalize_score.py","content":"complete Python source"}. ' +
        "Do not claim verification, approval or acceptance. Do not include any credentials.",
    },
    ["task"],
  );
  fn("branch_args", "Validate Builder / bind branch effect", branchCode, ["builder"]);
  mcp("branch", "Create task branch (effect-bound)", "create_branch", "branch_args", [
    "branch_args",
  ]);
  fn("file_args", "Bind immutable file effect", fileCode, ["branch"]);
  mcp("file", "Materialize Candidate (effect-bound)", "upsert_file", "file_args", ["file_args"]);
  fn("candidate", "Bind immutable Candidate readback", candidateCode, ["file", "verify_work"]);
  work("candidate_case", "Bind Candidate to Work", "{{candidate.parentUpdate}}", ["candidate"]);
  work("candidate_started", "Start native Candidate Work", "{{candidate.parentStart}}", [
    "candidate_case",
  ]);
  work("verify_candidate", "Bind Candidate to Verify Work", "{{candidate.verifyUpdate}}", [
    "candidate_started",
  ]);
  work("verify_started", "Start native Verify Work", "{{candidate.verifyStart}}", [
    "verify_candidate",
  ]);
  for (const role of ["security", "contract", "maintainability"]) {
    add(
      role,
      "agent",
      `${role[0].toUpperCase()}${role.slice(1)} Breaker`,
      {
        ...agentConfig,
        inputs: ["candidate"],
        systemPrompt:
          `Independently inspect the exact immutable Candidate and file content. Your role is ${role}. ` +
          'Return strict JSON only: {"schema":"axtn.development.review/v1","role":"' +
          role +
          '","candidateSHA":"exact supplied Candidate SHA","contentHash":"exact supplied file contentHash",' +
          '"findings":[{"severity":"LOW|MEDIUM|HIGH|CRITICAL","blocking":true,"accepted":true,"summary":"finding"}]}. ' +
          "Use an empty findings array when no supported findings exist. Never invent a PASS receipt or Approval.",
      },
      ["verify_started"],
    );
  }
  work("verify", "Deterministic Developer Runtime Verify", "{{candidate.verifyCall}}", [
    "verify_started",
  ]);
  add(
    "join",
    "merge",
    "Join three reviews and Verify",
    {
      inputs: ["security", "contract", "maintainability", "verify"],
      mergeMode: "object",
    },
    ["security", "contract", "maintainability", "verify"],
  );
  fn("gate", "Validate findings and deterministic Evidence", nativeDevelopmentGateCode, ["join"]);
  work("checks_case", "Persist deterministic Work checks", "{{gate.checksTransition}}", ["gate"]);
  work("review_case", "Persist native review / blocking result", "{{gate.caseTransition}}", [
    "checks_case",
  ]);
  fn("hard_gate", "Fail-closed hard gate", hardGateCode, ["review_case"]);
  work("verify_completed", "Complete native Verify Work", "{{gate.verifyComplete}}", ["hard_gate"]);
  add(
    "approved",
    "approval",
    "Independent SupaCase Approval",
    {
      inputs: ["hard_gate"],
      approvalTitle: "Review exact Development Candidate",
      approvalRisk: "high",
      approverUserIds: config.reviewerUserIds ?? [],
      approverGroupIds: config.reviewerGroupIds ?? [],
      approvalWork: {
        caseId: "{{candidate.caseId}}",
        runtimeSessionId: "{{verify.sessionId}}",
        operationId: "approve-v1",
      },
    },
    ["verify_completed"],
  );
  fn("pull_args", "Bind approved PR effect", pullCode, ["approved"]);
  mcp("pull", "Create reviewable PR (effect-bound)", "pull_request", "pull_args", ["pull_args"]);
  fn("result", "Validate exact PR_READY readback", resultCode, ["pull"]);
  work("pr_case", "Persist native PR_READY result", "{{result.caseTransition}}", ["result"]);
  work("accept_case", "Record existing independent native Acceptance", "{{result.acceptRequest}}", [
    "pr_case",
  ]);
  work("work_completed", "Complete native Work result", "{{result.completeRequest}}", [
    "accept_case",
  ]);
  add("output", "output", "Development Result / Evidence", { inputs: ["result"] }, [
    "work_completed",
  ]);
  // Keep the native parallel level readable on the canvas.
  for (const [index, id] of ["security", "contract", "maintainability", "verify"].entries()) {
    const node = nodes.find((n) => n.id === id);
    if (node) node.position = { x: 2400, y: index * 200 };
  }
  return { nodes, edges };
}
