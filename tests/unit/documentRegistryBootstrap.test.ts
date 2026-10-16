import { AuthApiError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (args: { request: Request }) => Promise<Response>;
const fixture = vi.hoisted(() => ({
  handler: null as Handler | null,
  auth: vi.fn(),
  admin: vi.fn(),
  seed: vi.fn(),
  localTable: vi.fn(),
  intake: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { server: { handlers: { POST: Handler } } }) => {
    fixture.handler = config.server.handlers.POST;
    return config;
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { auth: { getUser: fixture.auth } },
}));
vi.mock("@/utils/iam.server", () => ({ requireSuperadmin: fixture.admin }));
vi.mock("@/axtn/workbenches/documents/documentRegistries.server", () => ({
  seedDocumentRegistries: fixture.seed,
}));
vi.mock("@/axtn/workbenches/documents/documentLocalTableSeed.server", () => ({
  seedDocumentLocalTable: fixture.localTable,
}));
vi.mock("@/utils/axtnDocumentIntakeSeed.server", () => ({
  applyAxtnDocumentIntake: fixture.intake,
  seedAxtnDocumentIntake: fixture.intake,
  seedAxtnDocumentCaseIntake: fixture.intake,
}));
import "@/routes/api/axtn.document-intake";

const owner = "11111111-1111-4111-8111-111111111111";
async function request(body: unknown = { action: "seed_registries" }, bearer = true) {
  if (!fixture.handler) throw new Error("fixture handler missing");
  return fixture.handler({
    request: new Request("http://localhost/api/axtn/document-intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: "Bearer synthetic-session" } : {}),
      },
      body: JSON.stringify(body),
    }),
  });
}
beforeEach(() => {
  vi.stubEnv("ADMIN_EMAIL", "bootstrap@example.invalid");
  fixture.auth.mockReset().mockResolvedValue({
    data: { user: { id: owner, email: "bootstrap@example.invalid" } },
    error: null,
  });
  fixture.admin.mockReset().mockResolvedValue({ ok: true, userId: owner });
  fixture.seed.mockReset().mockResolvedValue({ schemaVersion: "document-registry-seed-v1" });
  fixture.localTable.mockReset().mockResolvedValue({
    schemaVersion: "document-local-table-seed-v1",
    runtimeActivated: false,
  });
  fixture.intake
    .mockReset()
    .mockResolvedValue({ created: false, changed: false, published: false });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
describe("existing bootstrap authorization for explicit Registry provisioning", () => {
  it("seeds the existing native Builder draft without accepting client owner/configuration", async () => {
    const response = await request({
      action: "seed_local_table",
      userId: "another-owner",
      source: "untrusted",
    });
    expect(response.status).toBe(200);
    expect(fixture.localTable).toHaveBeenCalledExactlyOnceWith(owner);
    expect(fixture.seed).not.toHaveBeenCalled();
    expect(fixture.intake).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ runtimeActivated: false });
  });
  it.each(["missing-session", "revoked", "wrong-admin", "not-superadmin"])(
    "denies Local Table provisioning through %s",
    async (condition) => {
      if (condition === "revoked")
        fixture.auth.mockResolvedValue({
          data: { user: null },
          error: new AuthApiError("revoked", 401, "bad_jwt"),
        });
      if (condition === "wrong-admin")
        fixture.auth.mockResolvedValue({
          data: { user: { id: owner, email: "other@example.invalid" } },
          error: null,
        });
      if (condition === "not-superadmin") fixture.admin.mockResolvedValue({ ok: false });
      const response = await request(
        { action: "seed_local_table" },
        condition !== "missing-session",
      );
      expect(response.status).toBe(
        condition === "missing-session" || condition === "revoked" ? 401 : 403,
      );
      expect(fixture.localTable).not.toHaveBeenCalled();
    },
  );
  it("returns an explicit failure on native Local Table conflict", async () => {
    fixture.localTable.mockRejectedValue(new Error("DOCUMENT_LOCAL_TABLE_APP_AMBIGUOUS"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await request({ action: "seed_local_table" })).status).toBe(500);
    expect(log).toHaveBeenCalledTimes(1);
  });
  it("uses authenticated bootstrap identity, never a client owner field", async () => {
    const response = await request({ action: "seed_registries", userId: "another-owner" });
    expect(response.status).toBe(200);
    expect(fixture.seed).toHaveBeenCalledExactlyOnceWith(owner);
    expect(fixture.intake).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({
      message: "Document registries reconciled; no recognition or automation activated.",
    });
  });
  it("denies missing or rejected session without any provisioning", async () => {
    expect((await request(undefined, false)).status).toBe(401);
    fixture.auth.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("revoked", 401, "bad_jwt"),
    });
    expect((await request()).status).toBe(401);
    expect(fixture.seed).not.toHaveBeenCalled();
  });
  it("does not expand ordinary or different superadmin authority", async () => {
    fixture.auth.mockResolvedValue({
      data: { user: { id: owner, email: "another-admin@example.invalid" } },
      error: null,
    });
    expect((await request()).status).toBe(403);
    expect(fixture.admin).not.toHaveBeenCalled();
    expect(fixture.seed).not.toHaveBeenCalled();
  });
  it.each([{ ok: false }, { ok: true, userId: "different-authenticated-user" }])(
    "requires current superadmin and exact authenticated owner %j",
    async (admin) => {
      fixture.admin.mockResolvedValue(admin);
      expect((await request()).status).toBe(403);
      expect(fixture.seed).not.toHaveBeenCalled();
    },
  );
  it("logs native errors and returns failure rather than seed success", async () => {
    fixture.seed.mockRejectedValue(new Error("DOCUMENT_REGISTRY_METADATA_INVALID"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await request();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Document Intake seed/apply failed; inspect the server log.",
    });
    expect(log).toHaveBeenCalledTimes(1);
  });
  it("does not add registry side effects to existing seed/apply reads", async () => {
    for (const action of ["seed", "seed_case", "apply"]) {
      expect((await request({ action })).status).toBe(200);
    }
    expect(fixture.intake).toHaveBeenCalledTimes(3);
    expect(fixture.seed).not.toHaveBeenCalled();
  });
});
