// Archive Knowledge (DMS-D1-0002 §10) — the guard that must never write an
// empty/garbage chunk is pure and DB-independent; verify it directly.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/tools/embedTarget.server", () => ({ resolveEmbedArgs: vi.fn() }));
vi.mock("@/utils/tools/embedding.server", () => ({ embedAndStoreDocuments: vi.fn() }));

import { indexArchiveDocument } from "@/lib/archiveKnowledge.server";
import { resolveEmbedArgs } from "@/utils/tools/embedTarget.server";
import { embedAndStoreDocuments } from "@/utils/tools/embedding.server";

describe("indexArchiveDocument", () => {
  it("skips indexing rather than writing an empty chunk when there is no usable text", async () => {
    // No Supabase client method should ever be reached for empty text — a
    // client that throws on first use proves the guard runs before any I/O.
    const sb = {
      from() {
        throw new Error("must not touch the database for empty pseudonymised text");
      },
    } as never;

    const result = await indexArchiveDocument(sb, "user-1", {
      documentId: "drive:abc123",
      driveFileId: "abc123",
      contentHash: "deadbeef",
      sourceFilename: "test.pdf",
      pseudonymizedText: "   ",
    });
    expect(result.action).toBe("skipped_unchanged");
  });
});

// DMS-D1-0002R Phase C2/E: the embedding boundary. `content` is the ONLY
// field that reaches embedAndStoreDocuments's per-doc payload as text to be
// embedded; Drive identity/filename/provenance stay confined to `metadata`,
// which embedTexts() (embedding.server.ts) never sends externally.
describe("indexArchiveDocument — embedding boundary (Phase C2/E)", () => {
  it("embeds ONLY the pseudonymised text, never raw Drive identity/filename", async () => {
    vi.mocked(resolveEmbedArgs).mockResolvedValue({
      openaiKey: "test-key",
      endpoint: "https://api.example.com/v1",
      allowCustomModel: false,
      defaults: { model: "text-embedding-3-small", dimensions: 1536 },
    } as never);
    vi.mocked(embedAndStoreDocuments).mockResolvedValue({
      chunksInserted: 1,
    } as never);

    const inserted: Record<string, unknown>[] = [];
    const sb = {
      from(table: string) {
        if (table === "knowledge_bases") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ maybeSingle: async () => ({ data: { id: "kb-1" } }) }),
              }),
            }),
          };
        }
        if (table === "knowledge_documents") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ maybeSingle: async () => ({ data: null }) }),
              }),
            }),
            insert: (row: Record<string, unknown>) => {
              inserted.push(row);
              return {
                select: () => ({ single: async () => ({ data: { id: "doc-row-1" } }) }),
              };
            },
          };
        }
        throw new Error(`unexpected table: ${table}`);
      },
    } as never;

    await indexArchiveDocument(sb, "user-1", {
      documentId: "drive:abc123",
      driveFileId: "SECRET-DRIVE-FILE-ID",
      contentHash: "deadbeef",
      sourceFilename: "SECRET-FILENAME.pdf",
      pseudonymizedText: "Hello PERSON-abc123, your invoice is ready.",
    });

    expect(embedAndStoreDocuments).toHaveBeenCalledTimes(1);
    const call = vi.mocked(embedAndStoreDocuments).mock.calls[0][0] as {
      docs: { content: string; metadata: Record<string, unknown> }[];
    };
    expect(call.docs).toHaveLength(1);
    expect(call.docs[0].content).toBe("Hello PERSON-abc123, your invoice is ready.");
    // Drive identity/filename are real, but confined to `metadata` — never
    // concatenated into the text that gets embedded.
    expect(call.docs[0].content).not.toContain("SECRET-DRIVE-FILE-ID");
    expect(call.docs[0].content).not.toContain("SECRET-FILENAME");
    expect(call.docs[0].metadata).toMatchObject({ drive_file_id: "SECRET-DRIVE-FILE-ID" });
  });
});
