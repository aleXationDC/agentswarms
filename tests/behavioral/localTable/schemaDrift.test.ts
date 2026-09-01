// Guards the behavioural subset against production drift.
//
// bootstrap.sql reproduces a HAND-PICKED subset of the real schema so the suite
// can run against a throwaway database. That is a copy, and copies rot: if a
// migration renames or drops a column the broker depends on, the behavioural
// suite would keep passing against a schema that no longer exists in
// production — the exact failure mode the suite was written to prevent.
//
// So each column the subset reproduces is pinned here to the migration that
// owns it. This needs no containers and runs in the normal unit suite budget.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bootstrap = readFileSync("tests/behavioral/localTable/bootstrap.sql", "utf8");

/** table → [column, owning migration file] */
const PINS: Record<string, Array<[string, string]>> = {
  user_data_tables: [
    ["user_id", "20260420163812_1327feff-90cf-4545-b3a6-80822bd89dcf.sql"],
    ["name", "20260420163812_1327feff-90cf-4545-b3a6-80822bd89dcf.sql"],
    ["columns", "20260420163812_1327feff-90cf-4545-b3a6-80822bd89dcf.sql"],
    ["data_loaded_at", "20260768000000_dataset_data_loaded_at.sql"],
    ["parquet_synced_at", "20260770000000_dataset_parquet.sql"],
  ],
  user_data_rows: [
    ["table_id", "20260420163812_1327feff-90cf-4545-b3a6-80822bd89dcf.sql"],
    ["row", "20260420163812_1327feff-90cf-4545-b3a6-80822bd89dcf.sql"],
  ],
  mcp_apps: [["user_id", "20260756000000_mcp_apps.sql"]],
  notebook_runtime_sessions: [
    ["user_id", "20260730000000_notebook_runtime.sql"],
    ["mcp_app_id", "20260756000000_mcp_apps.sql"],
  ],
  audit_events: [
    ["action", "20260723300000_audit_log.sql"],
    ["resource_type", "20260723300000_audit_log.sql"],
    ["resource_id", "20260723300000_audit_log.sql"],
    ["detail", "20260723300000_audit_log.sql"],
    ["actor_email", "20260781000000_audit_integrity.sql"],
  ],
};

describe("behavioural schema subset", () => {
  for (const [table, pins] of Object.entries(PINS)) {
    describe(table, () => {
      for (const [column, migration] of pins) {
        it(`still gets ${column} from ${migration}`, () => {
          const sql = readFileSync(`supabase/migrations/${migration}`, "utf8");
          // The owning migration must still create/add this column...
          expect(sql).toMatch(new RegExp(`\\b${column}\\b`));
          // ...and the subset must still reproduce it.
          expect(bootstrap).toMatch(new RegExp(`\\b${column}\\b`));
        });
      }
    });
  }

  it("reproduces every table the broker reads", () => {
    for (const table of Object.keys(PINS)) {
      expect(bootstrap).toContain(`public.${table}`);
    }
  });

  it("keeps row level security enabled on the subset", () => {
    // service_role carries BYPASSRLS, so the broker still works; a subset with
    // RLS off would silently excuse a missing policy in production.
    for (const table of Object.keys(PINS)) {
      expect(bootstrap).toContain(`alter table public.${table} enable row level security`);
    }
  });
});
