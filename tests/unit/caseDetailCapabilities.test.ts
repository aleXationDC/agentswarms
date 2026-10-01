import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("src/routes/_authenticated/cases_.$caseId.tsx", "utf8");
const functions = readFileSync("src/axtn/workbenches/cases/caseManagement.functions.ts", "utf8");
const server = readFileSync("src/axtn/workbenches/cases/caseManagement.server.ts", "utf8");

describe("SupaCase detail capabilities", () => {
  it("exposes edit, close and reopen controls wired to the owner-authenticated update function", () => {
    expect(route).toContain("const updateFn = useServerFn(updateCase)");
    expect(route).toContain("subject: patch.subject ?? record?.subject");
    expect(route).toContain("status: patch.status ?? record?.status");
    expect(route).toContain("Close Case");
    expect(route).toContain("Reopen Case");
    expect(functions).toContain("export const updateCase = createServerFn");
  });

  it("creates explicit related Case, Account and Contact records through the server boundary", () => {
    expect(route).toContain("const relateFn = useServerFn(createCaseRelation)");
    expect(route).toContain('<option value="case">Related Case</option>');
    expect(route).toContain('<option value="account">Related Account</option>');
    expect(route).toContain('<option value="contact">Related Contact</option>');
    expect(functions).toContain("export const createCaseRelation = createServerFn");
    expect(server).toContain("createCaseRelationForUser");
    expect(server).toContain("relation_type: `related_${targetKind}`");
    expect(server).toContain('targetKind: "case" | "account" | "contact"');
  });
});
