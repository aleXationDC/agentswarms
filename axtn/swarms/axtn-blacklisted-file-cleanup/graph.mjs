export const CLEANUP_ID = "d0c6b64b-6a54-4db3-93ab-11be9d8d93a5";
export const CLEANUP_NAME = "aXtn Swarm — Blacklisted File Cleanup";

function node(id, type, data, x, y) {
  return { id, type, position: { x, y }, data: { id, ...data } };
}

function edge(id, source, target) {
  return { id, source, target };
}

const LOOKUP_SQL_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const input = parse(ctx.vars.cleanup_input);
const verified = parse(input.filing_verified);
const rowResponse = parse(input.filing_registry_row);
const row = Array.isArray(rowResponse.rows) ? rowResponse.rows[0] : rowResponse;
const sourceRef = String((row && row.source_ref) || verified.source_ref || "").trim();
const documentId = String((row && row.document_id) || verified.document_id || "").trim();
const contentHash = String((row && row.content_hash) || verified.content_hash || "").trim();
if (!sourceRef && !documentId && !contentHash) throw new Error("BLACKLIST_CLEANUP_IDENTITY_MISSING");
const clauses = [];
const quote = (value) => "'" + value.replace(/'/g, "''") + "'";
if (sourceRef) clauses.push("source_ref = " + quote(sourceRef));
if (documentId) clauses.push("document_id = " + quote(documentId));
if (contentHash) clauses.push("content_hash = " + quote(contentHash));
return "SELECT * FROM axtn_document_registry WHERE " + clauses.join(" OR ");`;

const SCOPE_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const input = parse(ctx.vars.cleanup_input);
const verified = parse(input.filing_verified);
const rowResponse = parse(input.filing_registry_row);
const registryRows = parse(ctx.vars.cleanup_registry_rows);
const primary = Array.isArray(rowResponse.rows) ? rowResponse.rows[0] : rowResponse;
const rows = Array.isArray(registryRows.rows) ? registryRows.rows : [];
const sourceRows = rows.length ? rows : (primary && typeof primary === "object" ? [primary] : []);
const physical = (row) => String(row.drive_file_id || row.provider_file_id || String(row.source_ref || "").replace(/^drive:/, "")).trim();
const candidates = sourceRows.map((row) => ({
  document_id: String(row.document_id || verified.document_id || "").trim(),
  drive_file_id: physical(row) || String(verified.drive_file_id || "").trim(),
  expected_current_location: String(row.current_path || verified.current_location || "").trim(),
  filename: String(row.canonical_filename || row.current_filename || row.original_filename || verified.canonical_filename || "").trim(),
  content_hash: String(row.content_hash || verified.content_hash || "").trim(),
  source_ref: String(row.source_ref || verified.source_ref || "").trim(),
  cleanup_config: row.cleanup_config && typeof row.cleanup_config === "object" ? row.cleanup_config : verified.cleanup_config,
})).filter((row) => row.document_id && row.drive_file_id && row.expected_current_location);
const unique = Array.from(new Map(candidates.map((row) => [row.drive_file_id, row])).values());
if (!unique.length) throw new Error("BLACKLIST_CLEANUP_NO_VALID_CANDIDATES");
const config = unique.find((row) => row.cleanup_config && typeof row.cleanup_config === "object")?.cleanup_config;
if (!config || typeof config.drive_folder_id !== "string" || typeof config.drive_folder_path !== "string") throw new Error("BLACKLIST_CLEANUP_CONFIG_MISSING");
return JSON.stringify({ candidates: unique, candidate_count: unique.length, cleanup_config: config, source: "axtn_document_registry" });`;

const INSTRUCTION_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const scope = parse(ctx.vars.cleanup_scope);
const candidates = Array.isArray(scope.candidates) ? scope.candidates : [];
const approval = parse(ctx.vars.cleanup_approval);
const hasResumeSelection = typeof ctx.vars.selected_physical_ids === "string";
let selectedFromResume;
try { selectedFromResume = hasResumeSelection ? JSON.parse(ctx.vars.selected_physical_ids) : undefined; } catch (e) { selectedFromResume = []; }
const hasApprovalSelection = Array.isArray(approval.selected_physical_ids);
const requested = hasResumeSelection ? (Array.isArray(selectedFromResume) ? selectedFromResume : []) : (hasApprovalSelection ? approval.selected_physical_ids : []);
if (!requested.length || requested.some((id) => typeof id !== "string" || !id)
  || new Set(requested).size !== requested.length
  || requested.some((id) => !candidates.some((item) => item.drive_file_id === id))) {
  throw new Error("BLACKLIST_CLEANUP_EXPLICIT_SELECTION_REQUIRED");
}
const selected = candidates.filter((item) => requested.includes(item.drive_file_id));
const approvalId = String(ctx.vars.cleanup_approval_id || "").trim();
if (!approvalId) throw new Error("BLACKLIST_CLEANUP_APPROVAL_BINDING_REQUIRED");
return JSON.stringify({ selected_physical_ids: selected.map((item) => item.drive_file_id), candidates: selected, cleanup_config: scope.cleanup_config, approval_id: approvalId });`;

const DELETE_RESULT_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const result = parse(ctx.vars.delete_result);
const payload = result && result.result && typeof result.result === "object" ? result.result : result;
if (payload.deleted !== true) throw new Error("BLACKLIST_CLEANUP_DELETE_NOT_CONFIRMED");
return JSON.stringify(payload);`;

const REGISTRY_PROJECTION_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const scope = parse(ctx.vars.cleanup_scope);
const result = parse(ctx.vars.cleanup_result);
const rows = Array.isArray(scope.candidates) ? scope.candidates : [];
const primary = rows[0];
if (!primary || !primary.source_ref) throw new Error("BLACKLIST_CLEANUP_REGISTRY_IDENTITY_MISSING");
const row = { ...primary, processing_status: "BLACKLISTED_CLEANED", blacklisted_cleanup_status: "DELETED", blacklisted_deleted_physical_ids: Array.isArray(result.selected_physical_ids) ? result.selected_physical_ids : [], blacklisted_cleanup_completed_at: new Date().toISOString() };
return JSON.stringify({ table_name: "axtn_document_registry", key_column: "source_ref", key_value: primary.source_ref, row, immutable_columns: ["document_id", "privacy_status"] });`;

const REGISTRY_VERIFY_CODE = `
const parse = (value) => { try { return JSON.parse(String(value || "{}")); } catch (e) { return {}; } };
const response = parse(ctx.vars.cleanup_registry_write);
const result = response && response.result ? response.result : response;
const structured = result && result.structuredContent ? result.structuredContent : null;
if (!structured || !["inserted", "updated"].includes(String(structured.outcome || ""))) throw new Error("BLACKLIST_CLEANUP_REGISTRY_WRITE_FAILED");
return JSON.stringify({ registry_outcome: structured.outcome, blacklisted_cleanup_status: "DELETED" });`;

export function buildCleanupGraph() {
  return {
    nodes: [
      node(
        "cleanup_input",
        "input",
        { kind: "input", label: "Blacklisted Registry candidates", outputVar: "cleanup_input" },
        0,
        0,
      ),
      node(
        "cleanup_lookup_sql",
        "function",
        {
          kind: "function",
          label: "Resolve exact duplicate physical instances",
          inputs: ["cleanup_input"],
          outputVar: "cleanup_lookup_sql",
          functionCode: LOOKUP_SQL_CODE,
          functionTimeoutMs: 3000,
        },
        240,
        0,
      ),
      node(
        "cleanup_registry_rows",
        "tool",
        {
          kind: "tool",
          label: "Read duplicate Registry instances",
          inputs: ["cleanup_lookup_sql"],
          toolId: "sql_query",
          toolArgs: { sql: "{{cleanup_lookup_sql}}" },
          toolConfigs: { sql_table_names: ["axtn_document_registry"] },
          outputVar: "cleanup_registry_rows",
        },
        480,
        0,
      ),
      node(
        "cleanup_scope",
        "function",
        {
          kind: "function",
          label: "Build checkbox deletion scope",
          inputs: ["cleanup_input", "cleanup_registry_rows"],
          outputVar: "cleanup_scope",
          functionCode: SCOPE_CODE,
          functionTimeoutMs: 3000,
        },
        720,
        0,
      ),
      node(
        "cleanup_approval",
        "approval",
        {
          kind: "approval",
          label: "Blacklisted file deletion approval",
          approvalTitle: "Select the Blacklisted Drive files to delete",
          approvalRisk: "high",
          approvalFields: [
            {
              key: "selected_physical_ids",
              type: "multi_select",
              label: "Physical Drive instances to delete",
            },
          ],
          inputs: ["cleanup_scope"],
          outputVar: "cleanup_approval",
        },
        960,
        0,
      ),
      node(
        "cleanup_instruction",
        "function",
        {
          kind: "function",
          label: "Build approved deletion instruction",
          inputs: ["cleanup_scope", "cleanup_approval"],
          outputVar: "cleanup_instruction",
          functionCode: INSTRUCTION_CODE,
          functionTimeoutMs: 3000,
        },
        1200,
        0,
      ),
      node(
        "run_delete",
        "tool",
        {
          kind: "tool",
          label: "Execute approved Drive deletion",
          inputs: ["cleanup_instruction"],
          toolId: "n8n_run_workflow",
          toolArgs: { workflow_id: "axtnDriveDeletionExecutor", input: "{{cleanup_instruction}}" },
          toolConfigs: { n8n_workflow_ids: ["axtnDriveDeletionExecutor"] },
          outputVar: "delete_result",
        },
        1440,
        0,
      ),
      node(
        "delete_verify",
        "function",
        {
          kind: "function",
          label: "Verify Drive deletion",
          inputs: ["delete_result"],
          outputVar: "cleanup_result",
          functionCode: DELETE_RESULT_CODE,
          functionTimeoutMs: 3000,
        },
        1680,
        0,
      ),
      node(
        "cleanup_registry_projection",
        "function",
        {
          kind: "function",
          label: "Project Blacklisted cleanup outcome",
          inputs: ["cleanup_scope", "cleanup_result"],
          outputVar: "cleanup_registry_projection",
          functionCode: REGISTRY_PROJECTION_CODE,
          functionTimeoutMs: 3000,
        },
        1920,
        0,
      ),
      node(
        "cleanup_registry_write",
        "tool",
        {
          kind: "tool",
          label: "Persist Blacklisted cleanup audit",
          inputs: ["cleanup_registry_projection"],
          toolId: "mcp_call_tool",
          toolArgs: {
            arguments: "{{cleanup_registry_projection}}",
            tool_name: "local_table_upsert",
            server_name: "aXtn Local Table Integration",
          },
          toolConfigs: { mcp_server_names: ["aXtn Local Table Integration"] },
          outputVar: "cleanup_registry_write",
        },
        2160,
        0,
      ),
      node(
        "cleanup_registry_verify",
        "function",
        {
          kind: "function",
          label: "Verify cleanup Registry projection",
          inputs: ["cleanup_registry_write"],
          outputVar: "cleanup_registry_status",
          functionCode: REGISTRY_VERIFY_CODE,
          functionTimeoutMs: 3000,
        },
        2400,
        0,
      ),
      node(
        "cleanup_complete",
        "output",
        {
          kind: "output",
          label: "Blacklisted cleanup complete; Registry tombstone retained",
          inputs: ["cleanup_registry_status"],
        },
        2640,
        0,
      ),
    ],
    edges: [
      edge("cleanup-1", "cleanup_input", "cleanup_scope"),
      edge("cleanup-2", "cleanup_input", "cleanup_lookup_sql"),
      edge("cleanup-2b", "cleanup_lookup_sql", "cleanup_registry_rows"),
      edge("cleanup-2c", "cleanup_registry_rows", "cleanup_scope"),
      edge("cleanup-2d", "cleanup_scope", "cleanup_approval"),
      edge("cleanup-3", "cleanup_approval", "cleanup_instruction"),
      edge("cleanup-4", "cleanup_instruction", "run_delete"),
      edge("cleanup-5", "run_delete", "delete_verify"),
      edge("cleanup-6", "delete_verify", "cleanup_registry_projection"),
      edge("cleanup-7", "cleanup_registry_projection", "cleanup_registry_write"),
      edge("cleanup-8", "cleanup_registry_write", "cleanup_registry_verify"),
      edge("cleanup-9", "cleanup_registry_verify", "cleanup_complete"),
    ],
  };
}
