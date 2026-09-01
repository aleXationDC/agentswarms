import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const broker = readFileSync("src/utils/localTableUpsert.server.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260901000000_axtn_local_table_upsert.sql",
  "utf8",
);
const helper = readFileSync("docker/notebook-runtime/agentswarms_helper.py", "utf8");
const server = readFileSync("axtn/mcp-servers/axtn-local-table-integration/server.py", "utf8");
const edge = readFileSync("src/routes/api/mcp.s.$slug.ts", "utf8");

describe("native Local Table MCP upsert boundary", () => {
  it("requires a runtime-backed MCP identity and server-side allowlist", () => {
    expect(broker).toContain("runtimeSessionId");
    expect(broker).toContain("session?.mcp_app_id");
    expect(broker).toContain('DEFAULT_ALLOWED_TABLES = ["axtn_document_registry"]');
    expect(broker).toContain("LOCAL_TABLE_INTEGRATION_ALLOWLIST");
  });

  it("rejects undeclared columns and inconsistent keys before persistence", () => {
    expect(broker).toContain("row contains undeclared column");
    expect(broker).toContain("row must include a non-empty value for key_column");
    expect(broker).toContain("key_value must match row[key_column]");
  });

  it("uses only the broker from the sandbox and keeps database credentials out", () => {
    expect(helper).toContain('"/api/python-agent"');
    expect(helper).toContain('"action": "local_table_upsert"');
    expect(helper).not.toMatch(/SUPABASE_(URL|SERVICE_ROLE_KEY)/);
  });

  it("exposes exactly the approved registry table in the versioned MCP source", () => {
    expect(server).toContain('ALLOWED_TABLES = {"axtn_document_registry"}');
    expect(server).toContain("local_table_upsert_tool");
    expect(server).not.toContain("supabase");
  });

  it("keeps upserts atomic, owner-bound, non-replacing, and mirror-safe", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("auth.role()");
    expect(migration).toContain("where user_id = _user_id and name = _table_name");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("where table_id = v_table_id and row->>_key_column = _key_value");
    expect(migration).toContain("set data_loaded_at = now(), parquet_synced_at = null");
    expect(migration).toContain("to service_role");
  });

  it("attributes the external MCP app, scoped key and target without logging row data", () => {
    expect(edge).toContain('action: "mcp_app.tool_call"');
    expect(edge).toContain("key_id: key.id");
    expect(edge).toContain("key_prefix: key.key_prefix");
    expect(edge).toContain("table_name: localTableArgs?.table_name");
    expect(edge).not.toContain("row: localTableArgs");
    expect(broker).toContain('action: "local_table.upsert"');
    expect(broker).toContain("mcp_app_id: session.mcp_app_id");
  });
});
