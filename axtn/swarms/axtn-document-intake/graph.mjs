// Recovered from the last committed DMS R1 graph definition at
// 7123d0ef167e72b39ee39a944e418003a253f50f and adapted to the current
// accepted AgentSwarms candidate.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const SWARM_ID = "62bbd9a0-2fb3-4241-828d-584fa76edc74";
export const SWARM_NAME = "aXtn Document Intake";

export const AGENT_IDS = Object.freeze({
  triage: "54edaad4-4726-4781-ae07-5df795434837",
  processing: "02482fe8-1970-447a-97d7-8898ab8abaae",
});

export const AGENT_NAMES = Object.freeze({
  triage: "aXtn Agent — Document Triage",
  processing: "aXtn Agent — Document Processing",
});

const STAGE_INPUT_CODE = `const raw = ctx.vars.ingress;
let env;
try { env = typeof raw === "string" ? JSON.parse(raw) : raw; } catch (e) { env = {}; }
const technical = env && typeof env.technical === "object" ? env.technical : {};
const text = env.document_text ?? env.text ?? env.content ?? "";
return JSON.stringify({
  document_text: typeof text === "string" ? text : String(text || ""),
  filename: technical.original_name || technical.original_filename || env.filename || null,
  mime_type: technical.mime_type || env.mime_type || null,
  extraction_status: technical.extraction_status || env.extraction_status || null,
});`;

const INITIAL_PRIVACY_CODE = `let plan = {};
try { plan = JSON.parse(String(ctx.vars.envelope || "{}")); } catch (e) { plan = {}; }
const state = String(plan.row && plan.row.privacy_status || "").trim().toUpperCase();
if (!["UNRESOLVED", "NO_AI"].includes(state)) {
  throw new Error("PRIVACY_GATE_UNRESOLVED: " + (state || "(empty)"));
}
return state;`;

const LOOKUP_SQL_CODE = `let env = {};
try { env = JSON.parse(String(ctx.vars.ingress || "{}")); } catch (e) { env = {}; }
const sourceRef = String(env.idempotency_key || "").trim();
if (!sourceRef) throw new Error("REGISTRY_LOOKUP_SOURCE_REF_MISSING");
const escaped = sourceRef.replace(/'/g, "''");
return "SELECT * FROM axtn_document_registry WHERE source_ref = '" + escaped + "' LIMIT 1";`;

const CANONICAL_STATE_CODE = `let response = {};
try { response = JSON.parse(String(ctx.vars.registry_row || "{}")); } catch (e) { response = {}; }
const row = response && Array.isArray(response.rows) ? response.rows[0] : null;
if (!row || typeof row !== "object") throw new Error("REGISTRY_STATE_NOT_FOUND");
const privacy_status = String(row.privacy_status || "").trim().toUpperCase();
const next_route = row.next_route == null ? "" : String(row.next_route).trim().toUpperCase();
const final_review_required = row.final_review_required === true || String(row.final_review_required).toLowerCase() === "true";
if (!["UNRESOLVED", "ELIGIBLE", "NO_AI"].includes(privacy_status)) {
  throw new Error("PRIVACY_UNSUPPORTED_STATE: " + (privacy_status || "(empty)"));
}
if (!["STAGE_1", "STAGE_2", "FINALIZE"].includes(next_route)) {
  throw new Error("PRIVACY_ROUTE_UNRESOLVED: " + (next_route || "(empty)"));
}
if (privacy_status === "NO_AI" && ["STAGE_1", "STAGE_2"].includes(next_route)) {
  throw new Error("NO_AI_ROUTE_FORBIDDEN: " + next_route);
}
return JSON.stringify({
  privacy_status,
  next_route,
  final_review_required,
  canonical_filename: typeof row.canonical_filename === "string" ? row.canonical_filename : null,
  document_date: typeof row.document_date === "string" ? row.document_date : null,
  original_filename: typeof row.original_filename === "string" ? row.original_filename : null,
});`;

// Vite bundles this module into dist/server/assets; the versioned node files
// remain in the application root for both the server and the seed CLI.
const nodeSource = (name) => resolve("axtn/swarms/axtn-document-intake/nodes", name);
const intakeValidate = readFileSync(nodeSource("validate-envelope.js"), "utf8");
const intakeAck = readFileSync(nodeSource("registration-ack.js"), "utf8");
const intakeWorkRequest = readFileSync(nodeSource("work-request.js"), "utf8");
const intakeRegistryPlan = readFileSync(nodeSource("registry-plan.js"), "utf8");

function node(id, type, data, x, y) {
  return { id, type, position: { x, y }, data: { id, ...data } };
}

function edge(id, source, target, label) {
  return label === undefined ? { id, source, target } : { id, source, target, label };
}

function registrySqlNode(id, x, y) {
  return node(
    id,
    "function",
    {
      kind: "function",
      label: "Build canonical Registry lookup",
      inputs: [],
      outputVar: "registry_sql",
      functionCode: LOOKUP_SQL_CODE,
      functionTimeoutMs: 3000,
    },
    x,
    y,
  );
}

function registryReadNode(id, x, y) {
  return node(
    id,
    "tool",
    {
      kind: "tool",
      label: "Read canonical Registry state",
      inputs: [],
      toolId: "sql_query",
      toolArgs: { sql: "{{registry_sql}}" },
      toolConfigs: { sql_table_names: ["axtn_document_registry"] },
      outputVar: "registry_row",
    },
    x,
    y,
  );
}

function registryStateNode(id, x, y) {
  return node(
    id,
    "function",
    {
      kind: "function",
      label: "Validate canonical Registry route",
      inputs: ["registry_row"],
      outputVar: "canonical_state",
      functionCode: CANONICAL_STATE_CODE,
      functionTimeoutMs: 3000,
    },
    x,
    y,
  );
}

function stateProjectionNode(id, x, y) {
  return node(
    id,
    "set_var",
    {
      kind: "set_var",
      label: "Use canonical Registry corrections",
      inputs: ["canonical_state"],
      outputVar: "canonical_fields",
      stateAssignments: [
        { key: "privacy_status", value: "{{canonical_state.privacy_status}}" },
        { key: "canonical_filename", value: "{{canonical_state.canonical_filename}}" },
        { key: "document_date", value: "{{canonical_state.document_date}}" },
        { key: "next_route", value: "{{canonical_state.next_route}}" },
        { key: "final_review_required", value: "{{canonical_state.final_review_required}}" },
      ],
    },
    x,
    y,
  );
}

function exactRouteNode(id, label, inputs, outputVar, x, y) {
  return node(
    id,
    "router",
    {
      kind: "router",
      label,
      inputs,
      outputVar,
      routerMode: "exact",
    },
    x,
    y,
  );
}

function approvalNode(id, label, title, inputs, outputVar, x, y) {
  return node(
    id,
    "approval",
    {
      kind: "approval",
      label,
      approvalTitle: title,
      approvalRisk: "medium",
      inputs,
      outputVar,
    },
    x,
    y,
  );
}

function agentSnapshot(config, expectedId, expectedName) {
  if (
    !config ||
    config.id !== expectedId ||
    config.name !== expectedName ||
    config.is_active !== true
  ) {
    throw new Error(`Agent verification failed for ${expectedName}.`);
  }
  const tools = config.tools && typeof config.tools === "object" ? config.tools : {};
  const skillIds = Array.isArray(tools.skillIds)
    ? tools.skillIds.filter((value) => typeof value === "string" && value.length > 0)
    : [];
  const guardrails =
    tools.guardrails && typeof tools.guardrails === "object" ? tools.guardrails : undefined;
  return {
    agentId: expectedId,
    provider: String(config.llm_provider),
    model: String(config.llm_model),
    systemPrompt: config.system_prompt == null ? "" : String(config.system_prompt),
    temperature: Number(config.temperature),
    knowledgeBaseId: config.knowledge_base_id ?? null,
    skillIds,
    enabledTools: [],
    ...(guardrails ? { guardrails } : {}),
  };
}

export function buildLegacyFullLifecycleGraph(agentConfigs = {}) {
  const triageAgent = agentSnapshot(agentConfigs.triage, AGENT_IDS.triage, AGENT_NAMES.triage);
  const processingAgent = agentSnapshot(
    agentConfigs.processing,
    AGENT_IDS.processing,
    AGENT_NAMES.processing,
  );
  const nodes = [
    node(
      "intake_in",
      "input",
      {
        kind: "input",
        label: "Ingress registration envelope",
        outputVar: "ingress",
      },
      0,
      0,
    ),
    node(
      "intake_validate",
      "function",
      {
        kind: "function",
        label: "Privacy Preflight and technical validation",
        inputs: ["ingress"],
        outputVar: "envelope",
        functionCode: intakeValidate,
        functionTimeoutMs: 3000,
      },
      240,
      0,
    ),
    node(
      "intake_register",
      "tool",
      {
        kind: "tool",
        label: "Registry upsert (Local Table MCP)",
        inputs: ["envelope"],
        toolId: "mcp_call_tool",
        toolArgs: {
          arguments: "{{envelope}}",
          tool_name: "local_table_upsert",
          server_name: "aXtn Local Table Integration",
        },
        toolConfigs: { mcp_server_names: ["aXtn Local Table Integration"] },
        outputVar: "registration",
      },
      480,
      0,
    ),
    node(
      "intake_ack",
      "function",
      {
        kind: "function",
        label: "Deterministic registration ACK",
        outputVar: "ack",
        functionCode: intakeAck,
        functionTimeoutMs: 3000,
      },
      720,
      0,
    ),
    node(
      "privacy_initial",
      "function",
      {
        kind: "function",
        label: "Read initial privacy state",
        outputVar: "privacy_initial",
        functionCode: INITIAL_PRIVACY_CODE,
        functionTimeoutMs: 3000,
      },
      960,
      0,
    ),
    exactRouteNode(
      "privacy_gate_route",
      "Privacy action route",
      ["privacy_initial"],
      "privacy_gate_route",
      1200,
      0,
    ),
    approvalNode(
      "gate2_privacy",
      "Privacy review",
      "Confirm canonical privacy status and next route",
      ["ack", "privacy_initial"],
      "privacy_approval",
      1440,
      -100,
    ),
    registrySqlNode("privacy_registry_sql", 1680, -100),
    registryReadNode("privacy_registry_read", 1920, -100),
    registryStateNode("privacy_registry_state", 2160, -100),
    stateProjectionNode("privacy_state_projection", 2400, -100),
    node(
      "stage_input",
      "function",
      {
        kind: "function",
        label: "Build provider-safe stage input",
        outputVar: "stage_input",
        functionCode: STAGE_INPUT_CODE,
        functionTimeoutMs: 3000,
      },
      2640,
      -100,
    ),
    exactRouteNode(
      "privacy_exact_route",
      "Exact canonical route",
      ["next_route"],
      "privacy_exact_route",
      2880,
      -100,
    ),
    node(
      "stage1_triage",
      "agent",
      {
        kind: "agent",
        label: AGENT_NAMES.triage,
        ...triageAgent,
        inputs: ["stage_input"],
        outputVar: "stage1_output",
      },
      3120,
      -220,
    ),
    approvalNode(
      "gate_stage1_dev",
      "Stage 1 DEV review",
      "Inspect Stage 1 triage and choose the canonical next route",
      ["stage1_output"],
      "stage1_approval",
      3360,
      -220,
    ),
    registrySqlNode("stage1_registry_sql", 3600, -220),
    registryReadNode("stage1_registry_read", 3840, -220),
    registryStateNode("stage1_registry_state", 4080, -220),
    stateProjectionNode("stage1_state_projection", 4320, -220),
    exactRouteNode(
      "stage1_exact_route",
      "Exact Stage 1 next route",
      ["next_route"],
      "stage1_exact_route",
      4560,
      -220,
    ),
    node(
      "stage2_processing",
      "agent",
      {
        kind: "agent",
        label: AGENT_NAMES.processing,
        ...processingAgent,
        inputs: ["stage_input", "stage1_output"],
        outputVar: "stage2_output",
      },
      4800,
      0,
    ),
    approvalNode(
      "gate_stage2_dev",
      "Stage 2 DEV review",
      "Inspect the existing minimal Stage 2 output and choose FINALIZE",
      ["stage2_output"],
      "stage2_approval",
      5040,
      0,
    ),
    registrySqlNode("stage2_registry_sql", 5280, 0),
    registryReadNode("stage2_registry_read", 5520, 0),
    registryStateNode("stage2_registry_state", 5760, 0),
    stateProjectionNode("stage2_state_projection", 6000, 0),
    exactRouteNode(
      "stage2_exact_route",
      "Exact Stage 2 next route",
      ["next_route"],
      "stage2_exact_route",
      6240,
      0,
    ),
    exactRouteNode(
      "final_review_route",
      "Final Review decision",
      ["final_review_required"],
      "final_review_route",
      6720,
      0,
    ),
    approvalNode(
      "gate_final_review",
      "Final Review",
      "Approve the final filing proposal before READY_FOR_FILING",
      ["canonical_state", "stage1_output", "stage2_output"],
      "final_review_approval",
      6960,
      120,
    ),
    node(
      "ready_for_filing",
      "output",
      {
        kind: "output",
        label: "READY_FOR_FILING (deterministic)",
        inputs: ["final_review_approval", "stage2_output", "stage1_output"],
      },
      7200,
      0,
    ),
  ];

  const edges = [
    edge("e-intake-validate", "intake_in", "intake_validate"),
    edge("e-validate-register", "intake_validate", "intake_register"),
    edge("e-register-ack", "intake_register", "intake_ack"),
    edge("e-ack-privacy", "intake_ack", "privacy_initial"),
    edge("e-privacy-route", "privacy_initial", "privacy_gate_route"),
    edge("e-privacy-unresolved", "privacy_gate_route", "gate2_privacy", "UNRESOLVED"),
    edge("e-privacy-no-ai", "privacy_gate_route", "gate2_privacy", "NO_AI"),
    edge("e-privacy-sql", "gate2_privacy", "privacy_registry_sql"),
    edge("e-privacy-read", "privacy_registry_sql", "privacy_registry_read"),
    edge("e-privacy-state", "privacy_registry_read", "privacy_registry_state"),
    edge("e-privacy-project", "privacy_registry_state", "privacy_state_projection"),
    edge("e-privacy-stage-input", "privacy_state_projection", "stage_input"),
    edge("e-privacy-exact", "stage_input", "privacy_exact_route"),
    edge("e-route-stage1", "privacy_exact_route", "stage1_triage", "STAGE_1"),
    edge("e-route-stage2", "privacy_exact_route", "stage2_processing", "STAGE_2"),
    edge("e-route-finalize", "privacy_exact_route", "final_review_route", "FINALIZE"),
    edge("e-stage1-gate", "stage1_triage", "gate_stage1_dev"),
    edge("e-stage1-sql", "gate_stage1_dev", "stage1_registry_sql"),
    edge("e-stage1-read", "stage1_registry_sql", "stage1_registry_read"),
    edge("e-stage1-state", "stage1_registry_read", "stage1_registry_state"),
    edge("e-stage1-project", "stage1_registry_state", "stage1_state_projection"),
    edge("e-stage1-route", "stage1_state_projection", "stage1_exact_route"),
    edge("e-stage1-stage2", "stage1_exact_route", "stage2_processing", "STAGE_2"),
    edge("e-stage1-finalize", "stage1_exact_route", "final_review_route", "FINALIZE"),
    edge("e-stage2-gate", "stage2_processing", "gate_stage2_dev"),
    edge("e-stage2-sql", "gate_stage2_dev", "stage2_registry_sql"),
    edge("e-stage2-read", "stage2_registry_sql", "stage2_registry_read"),
    edge("e-stage2-state", "stage2_registry_read", "stage2_registry_state"),
    edge("e-stage2-project", "stage2_registry_state", "stage2_state_projection"),
    edge("e-stage2-route", "stage2_state_projection", "stage2_exact_route"),
    edge("e-stage2-finalize", "stage2_exact_route", "final_review_route", "FINALIZE"),
    edge("e-finalize-ready", "final_review_route", "ready_for_filing", "false"),
    edge("e-finalize-review", "final_review_route", "gate_final_review", "true"),
    edge("e-review-ready", "gate_final_review", "ready_for_filing"),
  ];

  return { nodes, edges };
}

// Kept for existing unit consumers while the live applier now uses the
// intentionally smaller buildIntakeGraph target.
export const buildDmsGraph = buildLegacyFullLifecycleGraph;

// Intake owns only the deterministic ingress contract and registration ACK.
// Privacy decisions, approvals, routing, agents, and filing remain in the
// parent graph so the top-level run can park and resume natively.
export function buildIntakeGraph() {
  return {
    nodes: [
      node(
        "intake_in",
        "input",
        {
          kind: "input",
          label: "Ingress registration envelope",
          outputVar: "ingress",
        },
        0,
        0,
      ),
      node(
        "intake_validate",
        "function",
        {
          kind: "function",
          label: "Deterministic envelope and NO_AI validation",
          inputs: ["ingress"],
          outputVar: "envelope",
          functionCode: intakeValidate,
          functionTimeoutMs: 3000,
        },
        240,
        0,
      ),
      node(
        "intake_register",
        "tool",
        {
          kind: "tool",
          label: "Registry registration (Local Table MCP)",
          inputs: ["envelope"],
          toolId: "mcp_call_tool",
          toolArgs: {
            arguments: "{{envelope}}",
            tool_name: "local_table_upsert",
            server_name: "aXtn Local Table Integration",
          },
          toolConfigs: { mcp_server_names: ["aXtn Local Table Integration"] },
          outputVar: "registration",
        },
        480,
        0,
      ),
      node(
        "intake_ack",
        "function",
        {
          kind: "function",
          label: "Deterministic registration ACK",
          inputs: ["registration"],
          outputVar: "ack",
          functionCode: intakeAck,
          functionTimeoutMs: 3000,
        },
        720,
        0,
      ),
      node(
        "intake_out",
        "output",
        {
          kind: "output",
          label: "Registration ACK",
          inputs: ["ack"],
        },
        960,
        0,
      ),
    ],
    edges: [
      edge("ie1", "intake_in", "intake_validate"),
      edge("ie2", "intake_validate", "intake_register"),
      edge("ie3", "intake_register", "intake_ack"),
      edge("ie4", "intake_ack", "intake_out"),
    ],
  };
}

export const LEGACY_NODE_IDS = Object.freeze([
  "intake_in",
  "intake_validate",
  "intake_register",
  "intake_ack",
  "intake_out",
]);

export function buildCaseBoundIntakeGraph() {
  const graph = buildIntakeGraph();
  const nodes = [
    ...graph.nodes.slice(0, 2),
    node(
      "intake_work_request",
      "function",
      {
        kind: "function",
        label: "Build minimized document Work input",
        inputs: ["envelope"],
        outputVar: "intake_work_request",
        functionCode: intakeWorkRequest,
        functionTimeoutMs: 3000,
      },
      480,
      0,
    ),
    node(
      "intake_case",
      "tool",
      {
        kind: "tool",
        label: "Atomic native document Case ensure",
        inputs: ["intake_work_request"],
        outputVar: "intake_case",
        toolId: "case_work",
        toolArgs: { request: "{{intake_work_request}}" },
      },
      720,
      0,
    ),
    node(
      "intake_registry_plan",
      "function",
      {
        kind: "function",
        label: "Bind persisted Case and document before registration",
        inputs: ["intake_case"],
        outputVar: "envelope",
        functionCode: intakeRegistryPlan,
        functionTimeoutMs: 3000,
      },
      960,
      0,
    ),
    ...graph.nodes
      .slice(2)
      .map((item, index) => ({ ...item, position: { x: 1200 + index * 240, y: 0 } })),
  ];
  return {
    nodes,
    edges: nodes
      .slice(1)
      .map((item, index) => edge(`case-intake-${index + 1}`, nodes[index].id, item.id)),
  };
}

export function canonicalNodeIds() {
  return [
    "intake_in",
    "intake_validate",
    "intake_register",
    "intake_ack",
    "privacy_initial",
    "privacy_gate_route",
    "gate2_privacy",
    "privacy_registry_sql",
    "privacy_registry_read",
    "privacy_registry_state",
    "privacy_state_projection",
    "stage_input",
    "privacy_exact_route",
    "stage1_triage",
    "gate_stage1_dev",
    "stage1_registry_sql",
    "stage1_registry_read",
    "stage1_registry_state",
    "stage1_state_projection",
    "stage1_exact_route",
    "stage2_processing",
    "gate_stage2_dev",
    "stage2_registry_sql",
    "stage2_registry_read",
    "stage2_registry_state",
    "stage2_state_projection",
    "stage2_exact_route",
    "final_review_route",
    "gate_final_review",
    "ready_for_filing",
  ];
}

export function intakeNodeIds() {
  return ["intake_in", "intake_validate", "intake_register", "intake_ack", "intake_out"];
}

export function intakeEdgeIds() {
  return ["ie1", "ie2", "ie3", "ie4"];
}

export function canonicalEdgeIds() {
  return [
    "e-intake-validate",
    "e-validate-register",
    "e-register-ack",
    "e-ack-privacy",
    "e-privacy-route",
    "e-privacy-unresolved",
    "e-privacy-no-ai",
    "e-privacy-sql",
    "e-privacy-read",
    "e-privacy-state",
    "e-privacy-project",
    "e-privacy-stage-input",
    "e-privacy-exact",
    "e-route-stage1",
    "e-route-stage2",
    "e-route-finalize",
    "e-stage1-gate",
    "e-stage1-sql",
    "e-stage1-read",
    "e-stage1-state",
    "e-stage1-project",
    "e-stage1-route",
    "e-stage1-stage2",
    "e-stage1-finalize",
    "e-stage2-gate",
    "e-stage2-sql",
    "e-stage2-read",
    "e-stage2-state",
    "e-stage2-project",
    "e-stage2-route",
    "e-stage2-finalize",
    "e-finalize-ready",
    "e-finalize-review",
    "e-review-ready",
  ];
}
