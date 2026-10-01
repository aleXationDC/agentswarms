import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("src/axtn/workbenches/cases/caseManagement.functions.ts", "utf8");
const serverSource = readFileSync("src/axtn/workbenches/cases/caseManagement.server.ts", "utf8");

describe("SupaCase persistence boundary", () => {
  it("uses only generic user datasets and explicit relation records", () => {
    expect(serverSource).toContain('"axtn_cases"');
    expect(serverSource).toContain('"axtn_accounts"');
    expect(serverSource).toContain('"axtn_contacts"');
    expect(serverSource).toContain('"axtn_case_relations"');
    expect(serverSource).toContain('from("user_data_tables")');
    expect(serverSource).toContain('from("user_data_rows")');
    expect(serverSource).not.toContain("create table");
    expect(serverSource).not.toContain("supabase/migrations");
  });

  it("keeps document relations explicit and acceptance idempotent", () => {
    expect(serverSource).toContain('target_kind === "document"');
    expect(serverSource).toContain("ensureCaseForAcceptance");
    expect(serverSource).toContain("related_document");
  });
});
