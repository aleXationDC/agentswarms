import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ rpc: vi.fn(), readFile: vi.fn(), slug: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: fixture.readFile }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: fixture.rpc },
}));
vi.mock("@/utils/mcpApps/keys", () => ({ generateMcpSlug: fixture.slug }));
import { seedDocumentLocalTable } from "@/axtn/workbenches/documents/documentLocalTableSeed.server";

const source = readFileSync("axtn/mcp-servers/axtn-local-table-integration/server.py", "utf8");
const owner = "11111111-1111-4111-8111-111111111111";
const result = {
  schemaVersion: "document-local-table-seed-v1",
  appId: "22222222-2222-4222-8222-222222222222",
  slug: "axtn-local-table-integration-abc123",
  created: true,
  status: "draft",
  registeredServerId: null,
  runtimeActivated: false,
};
beforeEach(() => {
  fixture.readFile.mockReset().mockResolvedValue(source);
  fixture.slug.mockReset().mockReturnValue(result.slug);
  fixture.rpc.mockReset().mockResolvedValue({ data: result, error: null });
});
describe("canonical native Local Table MCP Builder draft seed", () => {
  it("submits only the verified versioned source and authenticated owner", async () => {
    expect(await seedDocumentLocalTable(owner)).toEqual(result);
    expect(fixture.rpc).toHaveBeenCalledExactlyOnceWith("axtn_seed_document_local_table", {
      p_user_id: owner,
      p_slug: result.slug,
      p_source: source,
    });
  });
  it("refuses source drift before any metadata write", async () => {
    fixture.readFile.mockResolvedValue(`${source}\n`);
    await expect(seedDocumentLocalTable(owner)).rejects.toThrow(
      "DOCUMENT_LOCAL_TABLE_CANONICAL_SOURCE_REQUIRED",
    );
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it("refuses missing source instead of creating a sample MCP app", async () => {
    fixture.readFile.mockRejectedValue(new Error("ENOENT"));
    await expect(seedDocumentLocalTable(owner)).rejects.toThrow("ENOENT");
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it("requires an actual owner identifier before reading source", async () => {
    await expect(seedDocumentLocalTable("client-owner")).rejects.toThrow();
    expect(fixture.readFile).not.toHaveBeenCalled();
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it("does not disguise native database conflicts as successful seed", async () => {
    fixture.rpc.mockResolvedValue({
      data: null,
      error: { message: "DOCUMENT_LOCAL_TABLE_APP_AMBIGUOUS" },
    });
    await expect(seedDocumentLocalTable(owner)).rejects.toThrow(
      "DOCUMENT_LOCAL_TABLE_APP_AMBIGUOUS",
    );
  });
  it.each([
    null,
    { ...result, runtimeActivated: true },
    { ...result, appId: "another-app" },
    { ...result, credential: "unexpected-field" },
  ])("rejects malformed or activation-shaped result %j", async (data) => {
    fixture.rpc.mockResolvedValue({ data, error: null });
    await expect(seedDocumentLocalTable(owner)).rejects.toThrow();
  });
});
