import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { refreshDatasetMirror } from "@/utils/data/parquet.server";
import type { PythonCaller } from "@/utils/notebookRuntime/caller.server";
import { auditEvent } from "@/utils/audit.server";

const DEFAULT_ALLOWED_TABLES = ["axtn_document_registry"];

export class LocalTableUpsertRequestError extends Error {}

export function localTableIntegrationAllowedTables(): Set<string> {
  const configured = process.env.LOCAL_TABLE_INTEGRATION_ALLOWLIST;
  const values = (configured ? configured.split(",") : DEFAULT_ALLOWED_TABLES)
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(values);
}

export function declaredLocalTableColumns(columns: Json): Set<string> {
  if (!Array.isArray(columns)) throw new Error("The Local Table has no declared column schema.");
  const names = columns
    .filter(
      (column): column is { name: string } =>
        !!column && typeof column === "object" && "name" in column,
    )
    .map((column) => column.name)
    .filter(Boolean);
  if (!names.length) throw new Error("The Local Table has no declared column schema.");
  return new Set(names);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function localTableUpsert(args: {
  caller: PythonCaller;
  tableName: unknown;
  keyColumn: unknown;
  keyValue: unknown;
  row: unknown;
}): Promise<{ table_id: string; row_id: number; outcome: "inserted" | "updated" }> {
  if (!args.caller.scopeUserId || !args.caller.runtimeSessionId) {
    throw new LocalTableUpsertRequestError(
      "Local Table mutations require an authenticated runtime session.",
    );
  }
  if (
    !isNonEmptyString(args.tableName) ||
    !localTableIntegrationAllowedTables().has(args.tableName)
  ) {
    throw new LocalTableUpsertRequestError(
      "This Local Table is not permitted for MCP integration.",
    );
  }
  if (!isNonEmptyString(args.keyColumn) || !isNonEmptyString(args.keyValue)) {
    throw new LocalTableUpsertRequestError("key_column and key_value must be non-empty strings.");
  }
  if (!args.row || typeof args.row !== "object" || Array.isArray(args.row)) {
    throw new LocalTableUpsertRequestError("row must be an object.");
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("notebook_runtime_sessions")
    .select("mcp_app_id, user_id")
    .eq("id", args.caller.runtimeSessionId)
    .eq("user_id", args.caller.scopeUserId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session?.mcp_app_id) {
    throw new LocalTableUpsertRequestError(
      "Local Table mutations are available only to MCP runtime sessions.",
    );
  }

  const { data: table, error: tableError } = await supabaseAdmin
    .from("user_data_tables")
    .select("id, columns")
    .eq("user_id", args.caller.scopeUserId)
    .eq("name", args.tableName)
    .maybeSingle();
  if (tableError) throw new Error(tableError.message);
  if (!table) {
    throw new LocalTableUpsertRequestError(
      "The permitted Local Table does not exist or is not owned by this caller.",
    );
  }

  const columns = declaredLocalTableColumns(table.columns);
  if (!columns.has(args.keyColumn)) {
    throw new LocalTableUpsertRequestError("key_column is not declared by this Local Table.");
  }
  for (const column of Object.keys(args.row)) {
    if (!columns.has(column)) {
      throw new LocalTableUpsertRequestError(`row contains undeclared column "${column}".`);
    }
  }
  if (!isNonEmptyString((args.row as Record<string, unknown>)[args.keyColumn])) {
    throw new LocalTableUpsertRequestError("row must include a non-empty value for key_column.");
  }
  if ((args.row as Record<string, unknown>)[args.keyColumn] !== args.keyValue) {
    throw new LocalTableUpsertRequestError("key_value must match row[key_column].");
  }

  const { data, error } = await supabaseAdmin.rpc("axtn_local_table_upsert", {
    _user_id: args.caller.scopeUserId,
    _table_name: args.tableName,
    _key_column: args.keyColumn,
    _key_value: args.keyValue,
    _row: args.row as Json,
  });
  if (error) throw new Error(error.message);
  const result = data?.[0];
  if (!result) throw new Error("The Local Table upsert returned no result.");

  auditEvent({
    userId: args.caller.scopeUserId,
    action: "local_table.upsert",
    resourceType: "user_data_table",
    resourceId: result.table_id,
    resourceName: args.tableName,
    detail: {
      mcp_app_id: session.mcp_app_id,
      runtime_session_id: args.caller.runtimeSessionId,
      key_column: args.keyColumn,
      key_value: args.keyValue,
      outcome: result.outcome,
    },
  });

  // The transaction already marks the Parquet cache stale. Refreshing is best
  // effort; stale reads fall back to authoritative user_data_rows.
  void refreshDatasetMirror({ userId: args.caller.scopeUserId, tableId: result.table_id }).catch(
    (error) => console.warn("[local-table-upsert] mirror refresh failed:", error),
  );
  return result;
}
