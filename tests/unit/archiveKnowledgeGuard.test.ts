// Archive Knowledge (DMS-D1-0002 §10) — the guard that must never write an
// empty/garbage chunk is pure and DB-independent; verify it directly.
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/tools/embedTarget.server", () => ({ resolveEmbedArgs: vi.fn() }));
vi.mock("@/utils/tools/embedding.server", () => ({ embedAndStoreDocuments: vi.fn() }));

import { indexArchiveDocument } from "@/lib/archiveKnowledge.server";

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
