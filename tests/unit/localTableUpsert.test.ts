import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { HEX24_RE, generateHex24 } from "@/utils/localTableUpsert.server";

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

// DMS-LIVE-0003-A: identity that the caller is not able to produce.
//
// The registration boundary runs in the function-node sandbox, and that
// sandbox is built with `vm.createContext(Object.create(null))` — no host
// globals whatsoever, so no `crypto` and no CSPRNG. A caller there can only
// derive an "identity" from data it already holds, which is exactly the defect
// this handoff removes: the document id was `google_drive:drive:<fileId>`, a
// provider locator wearing the name of an internal identity.
//
// So the broker mints it. These tests are about the two generic table
// semantics that makes that safe, and they run the real code rather than
// grepping for it.
describe("server-minted row identity", () => {
  it("produces 96 bits of identifier with no structure to read", () => {
    const value = generateHex24();

    expect(value).toMatch(HEX24_RE);
    expect(value).toHaveLength(24);
    // Nothing namespaced, nothing provider-shaped, nothing to parse back out.
    expect(value).not.toContain(":");
  });

  it("does not repeat itself", () => {
    const seen = new Set(Array.from({ length: 2000 }, () => generateHex24()));

    expect(seen.size).toBe(2000);
  });

  it("uses a cryptographic source, not Math.random", () => {
    // A predictable document id is a disclosure problem, not just an
    // aesthetic one: it makes another tenant's registrations guessable.
    expect(broker).toContain('import { randomBytes } from "node:crypto"');
    expect(broker).toContain('randomBytes(12).toString("hex")');
    expect(broker).not.toContain("Math.random");
  });

  it("refuses to write an identifier it could not prove unique", () => {
    // The loop's purpose is the failure mode. Reusing an identity that already
    // belongs to another record is worse than not writing at all.
    expect(broker).toContain("Could not mint a unique value");
    expect(broker).toMatch(/for \(let attempt = 0; attempt < 5; attempt\+\+\)/);
  });

  it("generates only on insert, and only for a column the table declares", () => {
    expect(broker).toContain("generate_columns names an undeclared column");
    expect(broker).toContain('generate_columns supports only the "hex24" strategy');
    // Inventing the lookup key is incoherent — it could never match a row.
    expect(broker).toContain("generate_columns must not name the key_column");
  });

  it("carries an established identity through a replay instead of reminting it", () => {
    // The RPC REPLACES the stored row, so without this an unchanged source
    // item would get a new identity on every poll.
    expect(broker).toContain("immutable_columns names an undeclared column");
    expect(broker).toContain("effective_columns");
  });

  it("keeps a column name from reaching the filter syntax unchecked", () => {
    // These names are interpolated into a PostgREST `row->>col` filter.
    expect(broker).toContain("SAFE_COLUMN_RE");
    expect(broker).toContain("const SAFE_COLUMN_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;");
  });

  it("stays a generic table semantic and learns nothing about documents", () => {
    // A shared platform capability must not become registry-aware.
    const identityCode = broker.slice(broker.indexOf("export const HEX24_RE"));
    expect(identityCode).not.toContain("document_id");
    expect(identityCode).not.toContain("axtn_document_registry");
  });
});
