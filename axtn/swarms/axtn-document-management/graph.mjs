import { AGENT_IDS, AGENT_NAMES } from "../axtn-document-intake/graph.mjs";

export const PARENT_ID = "9b9ea6c2-a554-4fa7-9c40-908dad632ae7";
export const PARENT_NAME = "aXtn Swarm — Document Management";
export const PRIVACY_ID = "6dcd7938-f9fb-4254-be9e-6f9a06793f0e";
export const PRIVACY_NAME = "aXtn SubSwarm — Privacy Preflight";
export const CLEANUP_ID = "d0c6b64b-6a54-4db3-93ab-11be9d8d93a5";
export const CLEANUP_NAME = "aXtn Swarm — Blacklisted File Cleanup";

const REGISTRY_SQL_CODE = `let ack = {};
try { ack = JSON.parse(String(ctx.vars.registration_ack || ctx.input || "{}")); } catch (e) { ack = {}; }
const sourceRef = String(ack.source_ref || "").trim();
if (!sourceRef) throw new Error("REGISTRY_LOOKUP_SOURCE_REF_MISSING");
const escaped = sourceRef.replace(/'/g, "''");
return "SELECT * FROM axtn_document_registry WHERE source_ref = '" + escaped + "' LIMIT 1";`;

const PRIVACY_PROJECTION_SQL_CODE = `let ack = {};
try { ack = JSON.parse(String(ctx.vars.registration_ack || "{}")); } catch (e) { ack = {}; }
const sourceRef = String(ack.source_ref || "").trim();
if (!sourceRef) throw new Error("REGISTRY_LOOKUP_SOURCE_REF_MISSING");
const escaped = sourceRef.replace(/'/g, "''");
return "SELECT * FROM axtn_document_registry WHERE source_ref = '" + escaped + "' LIMIT 1";`;

const PRIVACY_PROJECTION_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const ack = parse(ctx.vars.registration_ack);
const preflight = parse(ctx.vars.privacy_state);
const registryResponse = parse(ctx.vars.privacy_registry_before);
const existing = Array.isArray(registryResponse.rows) ? registryResponse.rows[0] : null;
if (!existing || typeof existing !== "object") throw new Error("REGISTRY_STATE_NOT_FOUND");
const source_ref = String(ack.source_ref || existing.source_ref || "").trim();
if (!source_ref || existing.source_ref !== source_ref) throw new Error("REGISTRY_SOURCE_REF_MISMATCH");
const privacy_status = String(preflight.privacy_status || "").trim().toUpperCase();
const next_route = String(preflight.next_route || "").trim().toUpperCase();
const final_review_required = preflight.final_review_required === true;
if (!["ELIGIBLE", "NO_AI"].includes(privacy_status)) throw new Error("PRIVACY_PREFLIGHT_NOT_TERMINAL");
if (!["STAGE_1", "STAGE_2", "FINALIZE"].includes(next_route)) throw new Error("PRIVACY_ROUTE_UNRESOLVED");
if (privacy_status === "NO_AI" && next_route !== "FINALIZE") throw new Error("NO_AI_ROUTE_FORBIDDEN");
const row = {
  ...existing,
  privacy_status,
  next_route,
  final_review_required,
  processing_status: "PREFLIGHT",
};
return JSON.stringify({
  table_name: "axtn_document_registry",
  key_column: "source_ref",
  key_value: source_ref,
  row,
  immutable_columns: ["document_id"]
});`;

const PRIVACY_PROJECTION_VERIFY_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const response = parse(ctx.vars.privacy_registry_write);
const result = response && response.result ? response.result : response;
const structured = result && result.structuredContent ? result.structuredContent : null;
const outcome = String(structured && structured.outcome || "");
if (!["inserted", "updated"].includes(outcome)) throw new Error("REGISTRY_PRIVACY_PROJECTION_FAILED");
const ack = parse(ctx.vars.registration_ack);
const preflight = parse(ctx.vars.privacy_state);
return JSON.stringify({
  registry_outcome: outcome,
  document_id: structured && structured.effective_columns ? structured.effective_columns.document_id || null : null,
  privacy_status: preflight.privacy_status,
  next_route: preflight.next_route,
  final_review_required: preflight.final_review_required,
  processing_status: "PREFLIGHT",
  canonical_filename: parse(ctx.vars.privacy_projection).canonical_filename || null,
  document_date: parse(ctx.vars.privacy_projection).document_date || null,
  source_ref: ack.source_ref || null
});`;

const PRIVACY_GATE_CONTEXT_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const ack = parse(ctx.vars.registration_ack);
const preflight = parse(ctx.vars.privacy_state);
const write = parse(ctx.vars.privacy_projection_ack);
const safeContent = typeof preflight.provider_safe_content === "string"
  ? preflight.provider_safe_content
  : "";
return JSON.stringify({
  document_id: ack.document_id || null,
  source_ref: ack.source_ref || null,
  source_type: preflight.source_type || null,
  filename: preflight.filename || null,
  mime_type: preflight.mime_type || null,
  extraction_status: preflight.extraction_status || null,
  canonical_filename: write.canonical_filename || null,
  document_date: write.document_date || null,
  privacy_status: preflight.privacy_status || null,
  next_route: preflight.next_route || null,
  final_review_required: preflight.final_review_required === true,
  pii_detected: preflight.pii_detected === true,
  pii_finding_count: Number(preflight.pii_finding_count || 0),
  pii_findings: Array.isArray(preflight.pii_findings) ? preflight.pii_findings : [],
  pii_processing_status: preflight.pii_processing_status || null,
  provider_safe_content: safeContent,
  provider_safe_content_preview: safeContent.slice(0, 5000),
  preflight_judgement: preflight.preflight_judgement || preflight.recommendation || null,
  registry_outcome: write.registry_outcome || null
});`;

const INITIAL_PRIVACY_CODE = `let raw = {};
try { raw = JSON.parse(String(ctx.input || "{}")); } catch (e) { raw = {}; }
const rows = Array.isArray(raw.rows) ? raw.rows : [];
const row = rows[0];
if (!row || typeof row !== "object") throw new Error("REGISTRY_STATE_NOT_FOUND");
const state = String(row.privacy_status || "").trim().toUpperCase();
if (!["UNRESOLVED", "ELIGIBLE", "NO_AI"].includes(state)) {
  throw new Error("PRIVACY_UNSUPPORTED_STATE: " + (state || "(empty)"));
}
if (state === "NO_AI") return "NO_AI";
if (state === "UNRESOLVED") return "UNRESOLVED";
const route = String(row.next_route || "").trim().toUpperCase();
if (!["STAGE_1", "STAGE_2", "FINALIZE"].includes(route)) {
  throw new Error("PRIVACY_ROUTE_UNRESOLVED: " + (route || "(empty)"));
}
return state;`;

const CANONICAL_STATE_CODE = `let raw = {};
try { raw = JSON.parse(String(ctx.input || "{}")); } catch (e) { raw = {}; }
const rows = Array.isArray(raw.rows) ? raw.rows : [];
const row = rows[0];
if (!row || typeof row !== "object") throw new Error("REGISTRY_STATE_NOT_FOUND");
const privacy_status = String(row.privacy_status || "").trim().toUpperCase();
const next_route = String(row.next_route || "").trim().toUpperCase();
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
const business_context = {};
for (const key of ["para", "para_class", "project", "area", "vorgang", "object", "domain", "primary_domain", "labels", "organization"]) {
  if (typeof row[key] === "string" && row[key].trim()) business_context[key] = row[key];
}
return JSON.stringify({
  privacy_status,
  next_route,
  final_review_required,
  canonical_filename: typeof row.canonical_filename === "string" ? row.canonical_filename : null,
  document_date: typeof row.document_date === "string" ? row.document_date : null,
  original_filename: typeof row.original_filename === "string" ? row.original_filename : null,
  business_context,
});`;

const STAGE_INPUT_CODE = `let raw = {};
try { raw = JSON.parse(String(ctx.vars.ingress || "{}")); } catch (e) { raw = {}; }
let privacy = {};
try { privacy = JSON.parse(String(ctx.vars.privacy_state || ctx.vars.no_ai_fields || "{}")); } catch (e) { privacy = {}; }
let canonical = {};
try { canonical = JSON.parse(String(ctx.vars.canonical_state || "{}")); } catch (e) { canonical = {}; }
const technical = raw && typeof raw.technical === "object" ? raw.technical : {};
const noAi = String(privacy.privacy_status || "").trim().toUpperCase() === "NO_AI";
const text = noAi ? "" : (privacy.provider_safe_content ?? "");
if (!noAi && typeof text !== "string") throw new Error("PROVIDER_SAFE_CONTENT_MISSING");
const recognized = ctx.vars.recognition_context ? JSON.parse(String(ctx.vars.recognition_context || "{}")) : {};
const recognized_context = recognized.recognized_facts && typeof recognized.recognized_facts === "object"
  ? recognized.recognized_facts
  : {};
const business_context = {
  ...recognized_context,
  ...(privacy.business_context && typeof privacy.business_context === "object" ? privacy.business_context : {}),
  ...(canonical.business_context && typeof canonical.business_context === "object" ? canonical.business_context : {}),
};
return JSON.stringify({
  document_text: text,
  filename: privacy.filename || technical.original_name || technical.original_filename || raw.filename || null,
  canonical_filename: canonical.canonical_filename || null,
  document_date: canonical.document_date || null,
  mime_type: privacy.mime_type || technical.mime_type || raw.mime_type || null,
  extraction_status: privacy.extraction_status || technical.extraction_status || raw.extraction_status || null,
  pii_detected: privacy.pii_detected === true,
  pii_findings: Array.isArray(privacy.pii_findings) ? privacy.pii_findings : [],
  pii_processing_status: privacy.pii_processing_status || (noAi ? "not_run" : null),
  recognition: recognized,
  business_context,
});`;

const RECOGNITION_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const privacy = parse(ctx.vars.privacy_state);
const canonical = parse(ctx.vars.canonical_state);
const safe = typeof privacy.provider_safe_content === "string" ? privacy.provider_safe_content : "";
const normalized = safe.replace(/\\b(?:PERSON|EMAIL|ADDRESS|PHONE|LOCATION)_\\d+\\b/gi, (token) => token.replace(/_\\d+$/i, "_X")).toLowerCase().replace(/\\s+/g, " ").trim();
const recognized = {};
let match = null;
if (normalized.includes("invoice number")) {
  match = { pattern_id: "invoice-characteristic-header-v1", name: "Invoice characteristic header", match_mode: "exact", match_percent: 100, confidence: 0.86 };
  Object.assign(recognized, { document_family: "Invoice", document_type: "Invoice", primary_domain: "Finance", para_class: "10_Areas", labels: "billing, vendor" });
}
const existing = canonical.business_context && typeof canonical.business_context === "object" ? canonical.business_context : {};
for (const key of Object.keys(existing)) if (existing[key]) delete recognized[key];
return JSON.stringify({ matched: Boolean(match), match, applied_fields: Object.keys(recognized), recognized_facts: recognized });`;

const INGRESS_PRIVACY_CODE = `let raw = {};
try { raw = JSON.parse(String(ctx.input || "{}")); } catch (e) { raw = {}; }
const privacy = raw && typeof raw.privacy === "object" ? raw.privacy : {};
const state = String((privacy.state ?? privacy.status ?? privacy) || "").trim().toUpperCase();
if (!["UNRESOLVED", "NO_AI"].includes(state)) throw new Error("PRIVACY_UNSUPPORTED_STATE: " + (state || "(empty)"));
return state;`;

const BLACKLIST_ROUTE_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const privacy = parse(ctx.vars.privacy_state);
const identity = privacy.identity_resolution && typeof privacy.identity_resolution === "object"
  ? privacy.identity_resolution : {};
return String(identity.status || "").toLowerCase() === "blacklisted" ? "BLACKLISTED" : "NORMAL";`;

const BLACKLIST_INSTRUCTION_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const privacy = parse(ctx.vars.privacy_state);
const ack = parse(ctx.vars.registration_ack);
const ingress = parse(ctx.vars.ingress);
const identity = privacy.identity_resolution && typeof privacy.identity_resolution === "object"
  ? privacy.identity_resolution : {};
if (String(identity.status || "").toLowerCase() !== "blacklisted") throw new Error("BLACKLIST_ROUTE_MISMATCH");
const target_folder_id = String(privacy.blacklisted_target_folder_id || ingress.blacklisted_target_folder_id || "").trim();
if (!target_folder_id) throw new Error("BLACKLIST_TARGET_FOLDER_MISSING");
const drive_file_id = String(ack.drive_file_id || String(ack.source_ref || "").replace(/^drive:/, "")).trim();
const document_id = String(ack.document_id || "").trim();
const canonical_filename = String(privacy.filename || ingress.filename || "blacklisted-file").trim();
if (!drive_file_id || !document_id) throw new Error("BLACKLIST_INSTRUCTION_INCOMPLETE");
return JSON.stringify({ document_id, drive_file_id, canonical_filename, target_folder_id, target_folder_path: "00_Inbox/Blacklisted", collision: false, cleanup_reason: identity.reason });`;

function node(id, type, data, x, y) {
  return { id, type, position: { x, y }, data: { id, ...data } };
}
function edge(id, source, target, label) {
  return label === undefined ? { id, source, target } : { id, source, target, label };
}
function router(id, label, inputs, outputVar, x, y) {
  return node(
    id,
    "router",
    { kind: "router", label, inputs, outputVar, routerMode: "exact" },
    x,
    y,
  );
}
function approval(id, label, title, inputs, outputVar, x, y) {
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
function sqlNode(id, x, y, outputVar = "registry_sql") {
  return node(
    id,
    "function",
    {
      kind: "function",
      label: "Build canonical Registry lookup",
      inputs: ["registration_ack"],
      outputVar,
      functionCode: REGISTRY_SQL_CODE,
      functionTimeoutMs: 3000,
    },
    x,
    y,
  );
}
function readNode(id, x, y, outputVar = "registry_row", sqlVar = "registry_sql") {
  return node(
    id,
    "tool",
    {
      kind: "tool",
      label: "Read canonical Registry state",
      inputs: [sqlVar],
      toolId: "sql_query",
      toolArgs: { sql: `{{${sqlVar}}}` },
      toolConfigs: { sql_table_names: ["axtn_document_registry"] },
      outputVar,
    },
    x,
    y,
  );
}
function stateNode(id, x, y) {
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
function projectNode(id, x, y) {
  return node(
    id,
    "set_var",
    {
      kind: "set_var",
      label: "Use canonical Registry corrections",
      inputs: ["canonical_state"],
      outputVar: "canonical_fields",
      stateAssignments: [
        { key: "next_route", value: "{{canonical_state.next_route}}" },
        { key: "final_review_required", value: "{{canonical_state.final_review_required}}" },
        { key: "privacy_status", value: "{{canonical_state.privacy_status}}" },
      ],
    },
    x,
    y,
  );
}

function stageProjectionCode(stage) {
  const outputVar = `${stage}_output`;
  return `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const response = parse(ctx.vars.registry_row);
const existing = Array.isArray(response.rows) ? response.rows[0] : null;
if (!existing || typeof existing !== "object") throw new Error("REGISTRY_STATE_NOT_FOUND");
const ack = parse(ctx.vars.registration_ack);
const outputValue = parse(ctx.vars.${outputVar});
const output = outputValue && typeof outputValue.output === "object" ? outputValue.output
  : outputValue && typeof outputValue.result === "object" ? outputValue.result
  : outputValue;
const text = (value) => typeof value === "string" && value.trim() ? value.trim() : null;
const canonicalPara = (value) => {
  const key = text(value)?.toLowerCase();
  return ({ project: "01_Projects", projects: "01_Projects", area: "02_Areas", areas: "02_Areas",
    resource: "03_Resources", resources: "03_Resources", archive: "04_Archive" })[key] || text(value);
};
const labels = Array.isArray(output.labels)
  ? output.labels.filter((value) => typeof value === "string" && value.trim()).join(", ")
  : text(output.labels);
const routeValue = text(output.next_route || output.route_recommendation || output.recommendation);
const allowed = ["STAGE_2", "FINALIZE"];
const existingRoute = text(existing.next_route)?.toUpperCase();
const needsStage2 = output.needs_stage_2 === true || String(output.needs_stage_2).toLowerCase() === "true"
  || (output.needs_stage_2 === undefined && existingRoute === "STAGE_1");
let next_route = "FINALIZE";
if ("${stage}" === "stage1") {
  if (existing.human_overridden === true && allowed.includes(existingRoute)) next_route = existingRoute;
  else if (routeValue && allowed.includes(routeValue.toUpperCase())) next_route = routeValue.toUpperCase();
  else next_route = needsStage2 ? "STAGE_2" : "FINALIZE";
} else {
  next_route = "FINALIZE";
}
const humanConfirmed = existing.human_overridden === true;
const protectedFields = new Set(
  Array.isArray(existing.human_overridden_fields)
    ? existing.human_overridden_fields.filter((key) => typeof key === "string")
    : humanConfirmed
      ? [
          "canonical_filename", "document_type", "document_family", "document_date", "organization",
          "primary_domain", "domain", "para_class", "labels", "summary", "confidence",
          "related_entity", "proposed_path",
        ]
      : [],
);
const completedAt = text(output.completed_at || output.completedAt || existing["${stage}_completed_at"]) || new Date().toISOString();
const row = {
  ...existing,
  next_route,
  processing_status: "${stage === "stage1" ? "STAGE_1" : "STAGE_2"}",
  ["${stage}_completed_at"]: completedAt,
};
{
  const candidateFields = [
    "canonical_filename", "document_type", "document_family", "document_date", "organization",
    "primary_domain", "domain", "para_class", "labels", "summary", "confidence",
    "related_entity", "needs_stage_2",
  ];
  for (const key of candidateFields) {
    if (protectedFields.has(key)) continue;
    const value = key === "primary_domain" ? output.primary_domain || output.domain
      : key === "para_class" ? canonicalPara(output.para_class)
      : key === "labels" ? labels
      : output[key];
    if (value !== undefined && value !== null && value !== "") row[key] = value;
  }
  if (!protectedFields.has("proposed_path") && !row.proposed_path) {
    const path = [row.para_class, row.primary_domain, row.related_entity]
      .map((value) => text(value)).filter(Boolean).join("/");
    if (path) row.proposed_path = path;
  }
}
const source_ref = text(ack.source_ref || existing.source_ref);
if (!source_ref || existing.source_ref !== source_ref) throw new Error("REGISTRY_SOURCE_REF_MISMATCH");
return JSON.stringify({
  table_name: "axtn_document_registry",
  key_column: "source_ref",
  key_value: source_ref,
  row,
  immutable_columns: ["document_id", "privacy_status"],
});`;
}

function stageProjectionVerifyCode(stage) {
  return `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const response = parse(ctx.vars.${stage}_registry_write);
const result = response && response.result ? response.result : response;
const structured = result && result.structuredContent ? result.structuredContent : null;
const outcome = String(structured && structured.outcome || "");
if (!["inserted", "updated"].includes(outcome)) throw new Error("REGISTRY_${stage.toUpperCase()}_PROJECTION_FAILED");
const projection = parse(ctx.vars.${stage}_projection);
const route = projection.row && String(projection.row.next_route || "").trim().toUpperCase();
if (!["STAGE_2", "FINALIZE"].includes(route)) throw new Error("STAGE_POST_ROUTE_INVALID");
return route;`;
}

function stageProjectionNodes(stage, x, y) {
  return [
    node(
      `${stage}_state_projection`,
      "function",
      {
        kind: "function",
        label: `Project ${stage === "stage1" ? "Stage 1" : "Stage 2"} canonical state`,
        inputs: ["registry_row", `${stage}_output`, "canonical_state"],
        outputVar: `${stage}_projection`,
        functionCode: stageProjectionCode(stage),
        functionTimeoutMs: 3000,
      },
      x,
      y,
    ),
    node(
      `${stage}_registry_write`,
      "tool",
      {
        kind: "tool",
        label: `Persist ${stage === "stage1" ? "Stage 1" : "Stage 2"} canonical state`,
        inputs: [`${stage}_projection`],
        toolId: "mcp_call_tool",
        toolArgs: {
          arguments: `{{${stage}_projection}}`,
          tool_name: "local_table_upsert",
          server_name: "aXtn Local Table Integration",
        },
        toolConfigs: { mcp_server_names: ["aXtn Local Table Integration"] },
        outputVar: `${stage}_registry_write`,
      },
      x + 240,
      y,
    ),
    node(
      `${stage}_projection_verify`,
      "function",
      {
        kind: "function",
        label: `Verify ${stage === "stage1" ? "Stage 1" : "Stage 2"} canonical state`,
        inputs: [`${stage}_registry_write`, `${stage}_projection`],
        outputVar: `${stage}_route_value`,
        functionCode: stageProjectionVerifyCode(stage),
        functionTimeoutMs: 3000,
      },
      x + 480,
      y,
    ),
  ];
}

const FILING_INSTRUCTION_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const response = parse(ctx.vars.filing_registry_row);
const row = Array.isArray(response.rows) ? response.rows[0] : null;
const ack = parse(ctx.vars.registration_ack);
if (!row || typeof row !== "object") throw new Error("REGISTRY_STATE_NOT_FOUND");
const document_id = String(row.document_id || ack.document_id || "").trim();
const drive_file_id = String(row.drive_file_id || String(row.source_ref || ack.source_ref || "").replace(/^drive:/, "")).trim();
const canonical_filename = String(row.canonical_filename || row.current_filename || row.original_filename || "").trim();
const proposed_path = String(row.proposed_path || "").trim();
const target_folder_id = String(row.target_folder_id || "").trim();
if (!document_id || !drive_file_id || !canonical_filename) throw new Error("FILING_INSTRUCTION_INCOMPLETE");
if (!target_folder_id) throw new Error("FILING_TARGET_MISSING");
return JSON.stringify({
  document_id,
  drive_file_id,
  canonical_filename,
  target_folder_id,
  target_folder_path: proposed_path || null,
  collision: row.filing_collision === true,
});`;

const FILING_RESULT_VERIFY_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const response = parse(ctx.vars.filing_result);
const result = response && response.result && typeof response.result === "object" ? response.result : response;
const candidate = result && Array.isArray(result.data) && result.data[0] && result.data[0].json
  ? result.data[0].json : result;
if (!candidate || candidate.filed !== true) throw new Error("FILING_PROVIDER_WRITE_NOT_CONFIRMED");
const instruction = parse(ctx.vars.filing_instruction);
const provider = candidate.provider;
if (!instruction.document_id || !instruction.drive_file_id || !instruction.canonical_filename
  || !instruction.target_folder_id || !provider || typeof provider !== "object"
  || provider.id !== instruction.drive_file_id || provider.name !== instruction.canonical_filename
  || !Array.isArray(provider.parents) || provider.parents.length !== 1
  || provider.parents[0] !== instruction.target_folder_id
  || candidate.drive_file_id !== instruction.drive_file_id
  || candidate.canonical_filename !== instruction.canonical_filename
  || candidate.target_folder_id !== instruction.target_folder_id
  || candidate.current_location !== (instruction.target_folder_path || instruction.target_folder_id)
  || (candidate.document_id !== undefined && candidate.document_id !== instruction.document_id)) {
  throw new Error("FILING_PROVIDER_READBACK_MISMATCH");
}
return JSON.stringify(candidate);`;

const FILING_PROJECTION_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const response = parse(ctx.vars.filing_registry_row);
const existing = Array.isArray(response.rows) ? response.rows[0] : null;
const result = parse(ctx.vars.filing_verified);
if (!existing || typeof existing !== "object") throw new Error("REGISTRY_STATE_NOT_FOUND");
if (result.filed !== true || !result.current_location) throw new Error("FILING_READBACK_INCOMPLETE");
const row = {
  ...existing,
  current_path: result.current_location,
  current_parent_folder_id: result.target_folder_id || existing.current_parent_folder_id || null,
  canonical_filename: result.canonical_filename || existing.canonical_filename,
  processing_status: "FILED",
  filed_at: result.filed_at || new Date().toISOString(),
};
return JSON.stringify({
  table_name: "axtn_document_registry",
  key_column: "source_ref",
  key_value: existing.source_ref,
  row,
  immutable_columns: ["document_id", "privacy_status"],
});`;

const FILING_PROJECTION_VERIFY_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const response = parse(ctx.vars.filing_registry_write);
const result = response && response.result ? response.result : response;
const structured = result && result.structuredContent ? result.structuredContent : null;
if (!["inserted", "updated"].includes(String(structured && structured.outcome || ""))) {
  throw new Error("REGISTRY_FILING_PROJECTION_FAILED");
}
return "FILED";`;

const FILING_RESULT_ROUTE_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const candidate = parse(ctx.vars.filing_verified);
const value = String(candidate.filing_result || candidate.result_status || candidate.status || candidate.route || "").trim().toUpperCase();
return value === "BLACKLISTED" ? "BLACKLISTED" : "NORMAL";`;

export function buildPrivacyGraph() {
  return {
    nodes: [
      node(
        "pp_in",
        "input",
        { kind: "input", label: "Registered document envelope", outputVar: "privacy_input" },
        0,
        0,
      ),
      node(
        "pp_preflight",
        "tool",
        {
          kind: "tool",
          label: "Local Presidio privacy preflight",
          inputs: ["privacy_input"],
          toolId: "privacy_preflight",
          toolArgs: { input: "{{privacy_input}}" },
          outputVar: "privacy_result",
        },
        320,
        0,
      ),
      node(
        "pp_out",
        "output",
        {
          kind: "output",
          label: "Privacy findings and provider-safe content",
          inputs: ["privacy_result"],
        },
        640,
        0,
      ),
    ],
    edges: [edge("pe1", "pp_in", "pp_preflight"), edge("pe2", "pp_preflight", "pp_out")],
  };
}

export function buildParentGraph(agentConfigs) {
  const triage = agentConfigs.triage;
  const processing = agentConfigs.processing;
  const agent = (id, label, config, outputVar, inputs, x, y) =>
    node(
      id,
      "agent",
      {
        kind: "agent",
        label,
        agentId: config.id,
        provider: String(config.llm_provider),
        model: String(config.llm_model),
        systemPrompt: config.system_prompt == null ? "" : String(config.system_prompt),
        temperature: Number(config.temperature),
        knowledgeBaseId: config.knowledge_base_id ?? null,
        skillIds: Array.isArray(config.tools?.skillIds) ? config.tools.skillIds : [],
        enabledTools: [],
        inputs,
        outputVar,
      },
      x,
      y,
    );
  const nodes = [
    node(
      "ingress",
      "input",
      { kind: "input", label: "Ingress envelope", outputVar: "ingress" },
      0,
      0,
    ),
    node(
      "run_intake",
      "subswarm",
      {
        kind: "subswarm",
        label: "aXtn SubSwarm — Document Intake",
        subSwarmId: "62bbd9a0-2fb3-4241-828d-584fa76edc74",
        outputVar: "registration_ack",
        inputs: ["ingress"],
      },
      240,
      0,
    ),
    node(
      "privacy_initial",
      "function",
      {
        kind: "function",
        label: "Deterministic privacy state",
        inputs: ["ingress"],
        outputVar: "privacy_initial",
        functionCode: INGRESS_PRIVACY_CODE,
        functionTimeoutMs: 3000,
      },
      480,
      0,
    ),
    router(
      "privacy_route",
      "Deterministic privacy route",
      ["privacy_initial"],
      "privacy_route",
      720,
      0,
    ),
    node(
      "run_privacy",
      "subswarm",
      {
        kind: "subswarm",
        label: "aXtn SubSwarm — Privacy Preflight",
        subSwarmId: PRIVACY_ID,
        outputVar: "privacy_state",
        inputs: ["ingress"],
      },
      960,
      0,
    ),
    node(
      "privacy_projection_sql",
      "function",
      {
        kind: "function",
        label: "Build preflight Registry lookup",
        inputs: ["registration_ack"],
        outputVar: "privacy_projection_sql",
        functionCode: PRIVACY_PROJECTION_SQL_CODE,
        functionTimeoutMs: 3000,
      },
      1200,
      0,
    ),
    node(
      "privacy_registry_before",
      "tool",
      {
        kind: "tool",
        label: "Read Registry before preflight projection",
        inputs: ["privacy_projection_sql"],
        toolId: "sql_query",
        toolArgs: { sql: "{{privacy_projection_sql}}" },
        toolConfigs: { sql_table_names: ["axtn_document_registry"] },
        outputVar: "privacy_registry_before",
      },
      1440,
      0,
    ),
    node(
      "privacy_projection_build",
      "function",
      {
        kind: "function",
        label: "Build canonical preflight projection",
        inputs: ["privacy_registry_before", "privacy_state"],
        outputVar: "privacy_projection",
        functionCode: PRIVACY_PROJECTION_CODE,
        functionTimeoutMs: 3000,
      },
      1680,
      0,
    ),
    node(
      "privacy_registry_write",
      "tool",
      {
        kind: "tool",
        label: "Project successful Privacy Preflight",
        inputs: ["privacy_projection"],
        toolId: "mcp_call_tool",
        toolArgs: {
          arguments: "{{privacy_projection}}",
          tool_name: "local_table_upsert",
          server_name: "aXtn Local Table Integration",
        },
        toolConfigs: { mcp_server_names: ["aXtn Local Table Integration"] },
        outputVar: "privacy_registry_write",
      },
      1920,
      0,
    ),
    node(
      "privacy_projection_verify",
      "function",
      {
        kind: "function",
        label: "Verify preflight Registry projection",
        inputs: ["privacy_registry_write", "privacy_state"],
        outputVar: "privacy_projection_ack",
        functionCode: PRIVACY_PROJECTION_VERIFY_CODE,
        functionTimeoutMs: 3000,
      },
      2160,
      0,
    ),
    node(
      "privacy_gate_context",
      "function",
      {
        kind: "function",
        label: "Build Privacy DEV gate context",
        inputs: ["privacy_state", "privacy_projection_ack"],
        outputVar: "privacy_gate_context",
        functionCode: PRIVACY_GATE_CONTEXT_CODE,
        functionTimeoutMs: 3000,
      },
      2400,
      0,
    ),
    approval(
      "gate2_privacy",
      "Privacy review",
      "Inspect terminal Privacy Preflight and Registry route",
      ["registration_ack", "privacy_gate_context", "privacy_projection_ack"],
      "privacy_approval",
      2640,
      -120,
    ),
    node(
      "blacklist_route_value",
      "function",
      {
        kind: "function",
        label: "Resolve deterministic blacklist route",
        inputs: ["privacy_state"],
        outputVar: "blacklist_route_value",
        functionCode: BLACKLIST_ROUTE_CODE,
        functionTimeoutMs: 3000,
      },
      2880,
      -360,
    ),
    router(
      "blacklist_route",
      "Blacklist action route",
      ["blacklist_route_value"],
      "blacklist_route",
      3120,
      -360,
    ),
    node(
      "blacklist_instruction",
      "function",
      {
        kind: "function",
        label: "Build approved Blacklisted move instruction",
        inputs: ["privacy_state", "registration_ack", "ingress"],
        outputVar: "blacklist_instruction",
        functionCode: BLACKLIST_INSTRUCTION_CODE,
        functionTimeoutMs: 3000,
      },
      3360,
      -520,
    ),
    node(
      "run_blacklist_move",
      "tool",
      {
        kind: "tool",
        label: "Move provider file to 00_Inbox/Blacklisted",
        inputs: ["blacklist_instruction"],
        toolId: "n8n_run_workflow",
        toolArgs: { workflow_id: "axtnDriveFilingExecutor", input: "{{blacklist_instruction}}" },
        toolConfigs: { n8n_workflow_ids: ["axtnDriveFilingExecutor"] },
        outputVar: "blacklist_move_result",
      },
      3600,
      -520,
    ),
    node(
      "blacklist_move_verify",
      "function",
      {
        kind: "function",
        label: "Verify Blacklisted provider move",
        inputs: ["blacklist_move_result"],
        outputVar: "blacklist_move_verified",
        functionCode: FILING_RESULT_VERIFY_CODE,
        functionTimeoutMs: 3000,
      },
      3840,
      -520,
    ),
    node(
      "blacklist_cleanup_complete",
      "output",
      {
        kind: "output",
        label: "Blacklisted move complete; cleanup approval remains separate",
        inputs: ["blacklist_move_verified"],
      },
      4080,
      -520,
    ),
    node(
      "no_ai_defaults",
      "set_var",
      {
        kind: "set_var",
        label: "NO_AI deterministic Finalize",
        outputVar: "no_ai_fields",
        stateAssignments: [
          { key: "next_route", value: "FINALIZE" },
          { key: "final_review_required", value: "true" },
          { key: "privacy_status", value: "NO_AI" },
        ],
      },
      2640,
      120,
    ),
    sqlNode("privacy_registry_sql", 3000, -120),
    readNode("privacy_registry_read", 3240, -120),
    stateNode("privacy_registry_state", 3480, -120),
    projectNode("privacy_state_projection", 3720, -120),
    node(
      "recognition_context",
      "function",
      {
        kind: "function",
        label: "Deterministic provider-safe recognition",
        inputs: ["privacy_state", "canonical_state"],
        outputVar: "recognition_context",
        functionCode: RECOGNITION_CODE,
        functionTimeoutMs: 3000,
      },
      3960,
      -120,
    ),
    node(
      "stage_input",
      "function",
      {
        kind: "function",
        label: "Build provider-safe stage input",
        inputs: [
          "ingress",
          "privacy_state",
          "no_ai_fields",
          "canonical_state",
          "recognition_context",
        ],
        outputVar: "stage_input",
        functionCode: STAGE_INPUT_CODE,
        functionTimeoutMs: 3000,
      },
      4200,
      -120,
    ),
    router(
      "canonical_route",
      "Exact canonical route",
      ["next_route"],
      "canonical_route",
      4200,
      -120,
    ),
    agent(
      "stage1_triage",
      "aXtn Agent — Document Triage",
      triage,
      "stage1_output",
      ["stage_input"],
      4680,
      -240,
    ),
    approval(
      "gate_stage1_dev",
      "Stage 1 DEV review",
      "Inspect Stage 1 triage and confirm the canonical Registry route",
      ["registration_ack", "canonical_state", "recognition_context", "stage1_output"],
      "stage1_approval",
      4920,
      -240,
    ),
    sqlNode("stage1_registry_sql", 4920, -240),
    readNode("stage1_registry_read", 5160, -240),
    stateNode("stage1_registry_state", 5400, -240),
    ...stageProjectionNodes("stage1", 5640, -240),
    router(
      "stage1_route",
      "Exact Stage 1 next route",
      ["stage1_route_value"],
      "stage1_route",
      6360,
      -240,
    ),
    agent(
      "stage2_processing",
      "aXtn Agent — Document Processing",
      processing,
      "stage2_output",
      ["stage_input", "stage1_output"],
      6120,
      0,
    ),
    approval(
      "gate_stage2_dev",
      "Stage 2 DEV review",
      "Inspect Stage 2 output and confirm Finalize",
      ["registration_ack", "canonical_state", "stage2_output"],
      "stage2_approval",
      6360,
      0,
    ),
    sqlNode("stage2_registry_sql", 7080, 0),
    readNode("stage2_registry_read", 7320, 0),
    stateNode("stage2_registry_state", 7560, 0),
    ...stageProjectionNodes("stage2", 7800, 0),
    router(
      "stage2_route",
      "Exact Stage 2 next route",
      ["stage2_route_value"],
      "stage2_route",
      8520,
      0,
    ),
    router(
      "final_review_route",
      "final_review_required",
      ["final_review_required"],
      "final_review_route",
      7800,
      120,
    ),
    approval(
      "gate_final_review",
      "Final Review",
      "Approve the final filing proposal before READY_FOR_FILING",
      ["registration_ack", "canonical_state", "stage1_output", "stage2_output"],
      "final_review_approval",
      6240,
      240,
    ),
    sqlNode("filing_registry_sql", 6720, 240, "filing_registry_sql"),
    readNode("filing_registry_read", 6960, 240, "filing_registry_row", "filing_registry_sql"),
    node(
      "filing_instruction",
      "function",
      {
        kind: "function",
        label: "Build approved Filing instruction",
        inputs: ["filing_registry_row", "registration_ack"],
        outputVar: "filing_instruction",
        functionCode: FILING_INSTRUCTION_CODE,
        functionTimeoutMs: 3000,
      },
      7200,
      240,
    ),
    node(
      "run_filing",
      "tool",
      {
        kind: "tool",
        label: "Execute approved Drive filing",
        inputs: ["filing_instruction"],
        toolId: "n8n_run_workflow",
        toolArgs: {
          workflow_id: "axtnDriveFilingExecutor",
          input: "{{filing_instruction}}",
        },
        toolConfigs: { n8n_workflow_ids: ["axtnDriveFilingExecutor"] },
        outputVar: "filing_result",
      },
      7440,
      240,
    ),
    node(
      "filing_result_verify",
      "function",
      {
        kind: "function",
        label: "Verify Drive filing readback",
        inputs: ["filing_result", "filing_instruction"],
        outputVar: "filing_verified",
        functionCode: FILING_RESULT_VERIFY_CODE,
        functionTimeoutMs: 3000,
      },
      7680,
      240,
    ),
    node(
      "filing_projection",
      "function",
      {
        kind: "function",
        label: "Project FILED Registry state",
        inputs: ["filing_registry_row", "filing_verified"],
        outputVar: "filing_projection",
        functionCode: FILING_PROJECTION_CODE,
        functionTimeoutMs: 3000,
      },
      7920,
      240,
    ),
    node(
      "filing_registry_write",
      "tool",
      {
        kind: "tool",
        label: "Persist FILED Registry state",
        inputs: ["filing_projection"],
        toolId: "mcp_call_tool",
        toolArgs: {
          arguments: "{{filing_projection}}",
          tool_name: "local_table_upsert",
          server_name: "aXtn Local Table Integration",
        },
        toolConfigs: { mcp_server_names: ["aXtn Local Table Integration"] },
        outputVar: "filing_registry_write",
      },
      8160,
      240,
    ),
    node(
      "filing_projection_verify",
      "function",
      {
        kind: "function",
        label: "Verify FILED Registry projection",
        inputs: ["filing_registry_write"],
        outputVar: "filing_status",
        functionCode: FILING_PROJECTION_VERIFY_CODE,
        functionTimeoutMs: 3000,
      },
      8400,
      240,
    ),
    node(
      "filing_result_route",
      "function",
      {
        kind: "function",
        label: "Route verified Filing result",
        inputs: ["filing_verified"],
        outputVar: "filing_result_route",
        functionCode: FILING_RESULT_ROUTE_CODE,
        functionTimeoutMs: 3000,
      },
      8640,
      240,
    ),
    node(
      "run_blacklist_cleanup",
      "subswarm",
      {
        kind: "subswarm",
        label: CLEANUP_NAME,
        subSwarmId: CLEANUP_ID,
        inputs: ["filing_verified", "filing_registry_row"],
        outputVar: "blacklist_cleanup_result",
      },
      8880,
      360,
    ),
    node(
      "blacklist_cleanup_done",
      "output",
      {
        kind: "output",
        label: "Blacklisted cleanup completed",
        inputs: ["blacklist_cleanup_result"],
      },
      9120,
      360,
    ),
    node(
      "ready_for_filing",
      "output",
      {
        kind: "output",
        label: "FILED (deterministic)",
        inputs: ["filing_verified", "filing_status"],
      },
      8640,
      120,
    ),
  ];
  const edges = [
    edge("e1", "ingress", "run_intake"),
    edge("e2", "run_intake", "privacy_initial"),
    edge("e3", "privacy_initial", "privacy_route"),
    edge("e4", "privacy_route", "run_privacy", "UNRESOLVED"),
    edge("e5", "privacy_route", "no_ai_defaults", "NO_AI"),
    edge("e6", "run_privacy", "privacy_projection_sql"),
    edge("e7", "privacy_projection_sql", "privacy_registry_before"),
    edge("e8", "privacy_registry_before", "privacy_projection_build"),
    edge("e9", "privacy_projection_build", "privacy_registry_write"),
    edge("e10", "privacy_registry_write", "privacy_projection_verify"),
    edge("e11", "privacy_projection_verify", "privacy_gate_context"),
    edge("e12", "privacy_gate_context", "gate2_privacy"),
    edge("e13", "gate2_privacy", "privacy_registry_sql"),
    edge("e14", "privacy_registry_sql", "privacy_registry_read"),
    edge("e15", "privacy_registry_read", "privacy_registry_state"),
    edge("e16", "privacy_registry_state", "privacy_state_projection"),
    edge("e17", "privacy_state_projection", "recognition_context"),
    edge("e18", "recognition_context", "stage_input"),
    edge("e19", "stage_input", "canonical_route"),
    edge("e20", "canonical_route", "stage1_triage", "STAGE_1"),
    edge("e21", "canonical_route", "stage2_processing", "STAGE_2"),
    edge("e22", "canonical_route", "final_review_route", "FINALIZE"),
    edge("e23", "stage1_triage", "gate_stage1_dev"),
    edge("e24", "gate_stage1_dev", "stage1_registry_sql"),
    edge("e25", "stage1_registry_sql", "stage1_registry_read"),
    edge("e26", "stage1_registry_read", "stage1_registry_state"),
    edge("e27", "stage1_registry_state", "stage1_state_projection"),
    edge("e28", "stage1_state_projection", "stage1_registry_write"),
    edge("e28b", "stage1_registry_write", "stage1_projection_verify"),
    edge("e28c", "stage1_projection_verify", "stage1_route"),
    edge("e29", "stage1_route", "stage2_processing", "STAGE_2"),
    edge("e30", "stage1_route", "final_review_route", "FINALIZE"),
    edge("e31", "stage2_processing", "gate_stage2_dev"),
    edge("e32", "gate_stage2_dev", "stage2_registry_sql"),
    edge("e33", "stage2_registry_sql", "stage2_registry_read"),
    edge("e34", "stage2_registry_read", "stage2_registry_state"),
    edge("e35", "stage2_registry_state", "stage2_state_projection"),
    edge("e35b", "stage2_state_projection", "stage2_registry_write"),
    edge("e35c", "stage2_registry_write", "stage2_projection_verify"),
    edge("e36", "stage2_projection_verify", "stage2_route"),
    edge("e37", "stage2_route", "final_review_route", "FINALIZE"),
    edge("e38", "no_ai_defaults", "final_review_route"),
    edge("e39", "final_review_route", "filing_registry_sql", "false"),
    edge("e40", "final_review_route", "gate_final_review", "true"),
    edge("e41", "gate_final_review", "filing_registry_sql"),
    edge("e42", "filing_registry_sql", "filing_registry_read"),
    edge("e43", "filing_registry_read", "filing_instruction"),
    edge("e44", "filing_instruction", "run_filing"),
    edge("e45", "run_filing", "filing_result_verify"),
    edge("e46", "filing_result_verify", "filing_projection"),
    edge("e47", "filing_projection", "filing_registry_write"),
    edge("e48", "filing_registry_write", "filing_projection_verify"),
    edge("e49", "filing_projection_verify", "filing_result_route"),
    edge("e50", "filing_result_route", "ready_for_filing", "NORMAL"),
    edge("e51", "filing_result_route", "run_blacklist_cleanup", "BLACKLISTED"),
    edge("e52", "run_blacklist_cleanup", "blacklist_cleanup_done"),
  ];
  return { nodes, edges };
}

export { AGENT_IDS, AGENT_NAMES };
