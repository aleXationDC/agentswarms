import type { Json } from "@/integrations/supabase/types";
import { randomBytes } from "node:crypto";
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * MCP apps explicitly authorised to invoke the Local Table mutation capability.
 *
 * Owning the target table is not sufficient. Every MCP app a user publishes
 * runs as that user, so an ownership check alone would let *any* of their apps
 * — including one written for an unrelated purpose, whose tool descriptions are
 * model-visible instructions — write to the registry. This binds the capability
 * to named app IDs instead.
 *
 * There is deliberately NO default. An unset or empty list authorises nobody,
 * so a misconfiguration disables the capability rather than widening it. App
 * IDs are opaque identifiers, not credentials: they authorise nothing on their
 * own, because the caller must still present a valid MCP key and be running in
 * a server-created runtime session that the platform itself stamped with that
 * app id.
 */
export function localTableIntegrationAuthorizedAppIds(): Set<string> {
  const configured = process.env.LOCAL_TABLE_INTEGRATION_MCP_APP_IDS ?? "";
  return new Set(
    configured
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => UUID_RE.test(value)),
  );
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

/**
 * Column names are interpolated into PostgREST JSON filters (`row->>name`), so
 * they must be inert. Declared names come from the table's own schema rather
 * than from the caller, but "not attacker-controlled today" is not a security
 * property worth relying on — a table created through some future path could
 * carry a name with a comma or paren in it and quietly widen a filter.
 */
const SAFE_COLUMN_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The only generation strategy: 96 bits of CSPRNG as 24 lowercase hex chars. */
export const HEX24_RE = /^[0-9a-f]{24}$/;

export function generateHex24(): string {
  return randomBytes(12).toString("hex");
}

/**
 * Columns whose existing value must survive an update.
 *
 * This is a generic table semantic, not a document semantic: it says "this
 * column is an identity, established once, and a later write of the same row
 * may not restate it". It exists because the underlying upsert REPLACES the
 * stored row, so without it every replay of an unchanged source item would
 * mint a new value for a column that is supposed to be stable forever.
 */
function parseImmutableColumns(value: unknown, declared: Set<string>): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new LocalTableUpsertRequestError("immutable_columns must be an array of column names.");
  }
  const out: string[] = [];
  for (const entry of value) {
    if (!isNonEmptyString(entry)) {
      throw new LocalTableUpsertRequestError(
        "immutable_columns entries must be non-empty strings.",
      );
    }
    const name = entry.trim();
    if (!declared.has(name) || !SAFE_COLUMN_RE.test(name)) {
      throw new LocalTableUpsertRequestError(
        `immutable_columns names an undeclared column "${name}".`,
      );
    }
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * Columns the broker fills with a server-generated identifier on INSERT only.
 *
 * Generation has to happen here. The function-node sandbox that builds these
 * calls is created with no host globals at all — deliberately, so a snippet
 * cannot reach the host realm — which means it has no `crypto` and therefore
 * no way to produce cryptographically secure randomness. Deriving the value
 * from data the caller already holds would defeat the point of a
 * provider-independent identity, so the value is minted on the server that
 * actually has a CSPRNG, and only when a new row is being created.
 */
function parseGenerateColumns(value: unknown, declared: Set<string>, keyColumn: string): string[] {
  if (value === undefined || value === null) return [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new LocalTableUpsertRequestError(
      "generate_columns must be an object of column -> strategy.",
    );
  }
  const out: string[] = [];
  for (const [name, strategy] of Object.entries(value as Record<string, unknown>)) {
    if (!declared.has(name) || !SAFE_COLUMN_RE.test(name)) {
      throw new LocalTableUpsertRequestError(
        `generate_columns names an undeclared column "${name}".`,
      );
    }
    if (strategy !== "hex24") {
      throw new LocalTableUpsertRequestError(
        `generate_columns supports only the "hex24" strategy (got "${String(strategy)}").`,
      );
    }
    // Generating the lookup key itself is incoherent: the key is how the row
    // is found, so a value invented here could never match anything.
    if (name === keyColumn) {
      throw new LocalTableUpsertRequestError("generate_columns must not name the key_column.");
    }
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * Mint a 24-hex value that no row in this table already carries in `column`.
 *
 * A 96-bit collision is not a real expectation; this loop exists so that the
 * failure mode is "refuse to write" rather than "silently reuse an identity
 * that already belongs to another record". Exhausting the attempts throws,
 * because inserting an identifier we could not prove unique is worse than not
 * inserting at all.
 */
async function mintUniqueHex24(tableId: string, column: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateHex24();
    const { data, error } = await supabaseAdmin
      .from("user_data_rows")
      .select("id")
      .eq("table_id", tableId)
      .eq(`row->>${column}`, candidate)
      .limit(1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return candidate;
  }
  throw new Error(`Could not mint a unique value for "${column}" after 5 attempts.`);
}

export async function localTableUpsert(args: {
  caller: PythonCaller;
  tableName: unknown;
  keyColumn: unknown;
  keyValue: unknown;
  row: unknown;
  immutableColumns?: unknown;
  generateColumns?: unknown;
}): Promise<{
  table_id: string;
  row_id: number;
  outcome: "inserted" | "updated";
  effective_columns: Record<string, string>;
}> {
  if (!args.caller.scopeUserId || !args.caller.sessionId) {
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
    .eq("id", args.caller.sessionId)
    .eq("user_id", args.caller.scopeUserId)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session?.mcp_app_id) {
    throw new LocalTableUpsertRequestError(
      "Local Table mutations are available only to MCP runtime sessions.",
    );
  }
  // `session.mcp_app_id` is trustworthy precisely because it is not an
  // argument: the platform writes it when it starts the app's service session,
  // and the sandbox reaches this code with a signed session token, so nothing
  // the tool caller controls can name a different app.
  if (!localTableIntegrationAuthorizedAppIds().has(session.mcp_app_id.toLowerCase())) {
    throw new LocalTableUpsertRequestError(
      "This MCP app is not authorized for the Local Table mutation capability.",
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
  if (!SAFE_COLUMN_RE.test(args.keyColumn)) {
    throw new LocalTableUpsertRequestError("key_column is not a usable column name.");
  }

  const immutableColumns = parseImmutableColumns(args.immutableColumns, columns);
  const generateColumns = parseGenerateColumns(args.generateColumns, columns, args.keyColumn);
  for (const name of generateColumns) {
    // A caller that both supplies and asks us to generate a value is telling us
    // two different things. Refusing is the only reading that cannot silently
    // discard whichever one the caller actually meant.
    if ((args.row as Record<string, unknown>)[name] !== undefined) {
      throw new LocalTableUpsertRequestError(
        `row must not supply "${name}" when generate_columns asks the broker to mint it.`,
      );
    }
  }

  const effectiveRow: Record<string, unknown> = { ...(args.row as Record<string, unknown>) };
  const effectiveColumns: Record<string, string> = {};

  if (immutableColumns.length > 0 || generateColumns.length > 0) {
    // Read the row this upsert will land on, identified exactly the way the
    // RPC identifies it, so "does it already exist" is answered by the same
    // predicate that decides insert-vs-update.
    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("user_data_rows")
      .select("row")
      .eq("table_id", table.id)
      .eq(`row->>${args.keyColumn}`, args.keyValue)
      .order("id")
      .limit(1);
    if (existingError) throw new Error(existingError.message);
    const existing = (existingRows?.[0]?.row ?? null) as Record<string, unknown> | null;

    for (const name of immutableColumns) {
      const prior = existing?.[name];
      if (isNonEmptyString(prior)) {
        effectiveRow[name] = prior;
        effectiveColumns[name] = prior;
      } else if (isNonEmptyString(effectiveRow[name])) {
        effectiveColumns[name] = String(effectiveRow[name]);
      }
    }

    for (const name of generateColumns) {
      const prior = existing?.[name];
      if (isNonEmptyString(prior)) {
        // Already established. Never reissued, even if the rest of the row is
        // being rewritten wholesale by this update.
        effectiveRow[name] = prior;
        effectiveColumns[name] = prior;
        continue;
      }
      const minted = await mintUniqueHex24(table.id, name);
      effectiveRow[name] = minted;
      effectiveColumns[name] = minted;
    }
  }

  const { data, error } = await supabaseAdmin.rpc("axtn_local_table_upsert", {
    _user_id: args.caller.scopeUserId,
    _table_name: args.tableName,
    _key_column: args.keyColumn,
    _key_value: args.keyValue,
    _row: effectiveRow as Json,
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
      runtime_session_id: args.caller.sessionId,
      key_column: args.keyColumn,
      key_value: args.keyValue,
      outcome: result.outcome,
      effective_columns: effectiveColumns,
    },
  });

  // The transaction already marks the Parquet cache stale. Refreshing is best
  // effort; stale reads fall back to authoritative user_data_rows.
  void refreshDatasetMirror({ userId: args.caller.scopeUserId, tableId: result.table_id }).catch(
    (error) => console.warn("[local-table-upsert] mirror refresh failed:", error),
  );
  return { ...result, effective_columns: effectiveColumns };
}
