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
    // The capability is bound to named MCP apps, not merely to the owner.
    expect(broker).toContain("LOCAL_TABLE_INTEGRATION_MCP_APP_IDS");
    expect(broker).toContain("localTableIntegrationAuthorizedAppIds");
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
    expect(server).toContain("async def local_table_upsert(");
    expect(server).not.toContain("supabase");
  });

  // NOTE ON SCOPE. What this file can honestly check is that the wiring is
  // present in the source. It cannot check that the SQL WORKS: an earlier
  // version of this suite asserted `toContain("auth.role()")` and
  // `toContain("where table_id = v_table_id ...")` and passed against a
  // function that raised on every single call — once because the role guard
  // read a GUC this stack never sets, and once because `table_id` was
  // ambiguous against the function's own OUT parameter. String matching cannot
  // see either bug, and the first of those assertions eventually passed by
  // matching the COMMENT that explained the fix.
  //
  // Behaviour is therefore proven in tests/behavioral/localTable, which runs
  // the real migration against a real Postgres and PostgREST. What stays here
  // is limited to the structural facts that a grep genuinely settles.
  it("keeps the function broker-only at the grant level", () => {
    expect(migration).toContain("security definer");
    // The privilege boundary is a static fact about the DDL: no role other
    // than the broker's may execute it, whatever the body does.
    expect(migration).toMatch(/revoke all on function[\s\S]*from public, anon, authenticated/);
    expect(migration).toMatch(/grant execute on function[\s\S]*to service_role/);
    // A search_path is pinned, which is what makes `security definer` safe.
    expect(migration).toContain("set search_path = public, pg_temp");
  });

  it("still scopes the table lookup to the owner", () => {
    expect(migration).toContain("where user_id = _user_id and name = _table_name");
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
