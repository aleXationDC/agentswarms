// DMS-LIVE-0002-A: aXtn Documents must show the canonical registered-document
// lifecycle, not the optional demo dataset.
//
// The defect these tests lock down: the workbench was bound to the optional
// "axtn_documents" dataset, so a document that intake had genuinely registered
// in "axtn_document_registry" was invisible in the UI while its approval was
// already waiting in the inbox.
import { describe, expect, it } from "vitest";

import {
  UNRESOLVED_FILENAME_LABEL,
  findWorkbenchDocumentByDocumentId,
  isRegisteredDocumentRow,
  listWorkbenchDocuments,
  normalizeWorkbenchDocument,
} from "@/axtn/workbenches/documents/documentsWorkbench";

// A real registered row, copied from a live intake run. Note how sparse it is:
// registration records provenance and lifecycle state, nothing semantic yet.
const REGISTERED_ROW = {
  source_ref: "drive:1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR",
  document_id: "google_drive:drive:1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR",
  record_kind: "document",
  source_type: "google_drive",
  artifact_type: "mail",
  privacy_status: "UNRESOLVED",
  schema_version: "axtn-drive-document-intake-v1",
  processing_status: "registered",
};

// The registry declares its own shape in a seed row. It is not a document.
const SCHEMA_SEED_ROW = {
  record_kind: "schema_seed",
  document_id: "schema_seed",
  source_ref: "schema_seed",
};

function fakeSupabase(rows: Array<{ id: string; row: unknown }>, datasetName: string) {
  const seen: Record<string, unknown> = {};
  const client = {
    from(table: string) {
      if (table === "user_data_tables") {
        const filters: Record<string, string> = {};
        const builder = {
          select: () => builder,
          eq: (column: string, value: string) => {
            filters[column] = value;
            return builder;
          },
          maybeSingle: async () => {
            seen.requestedDataset = filters.name;
            seen.requestedUser = filters.user_id;
            return filters.name === datasetName
              ? { data: { id: "table-1" }, error: null }
              : { data: null, error: null };
          },
        };
        return builder;
      }
      const builder = {
        select: () => builder,
        eq: async () => ({ data: rows, error: null }),
      };
      return builder;
    },
  };
  return { client, seen };
}

describe("aXtn Documents registry binding", () => {
  it("reads the canonical document registry, not the optional demo dataset", async () => {
    const { client, seen } = fakeSupabase(
      [{ id: "1", row: REGISTERED_ROW }],
      "axtn_document_registry",
    );
    const documents = await listWorkbenchDocuments(client as never, "user-1");

    expect(seen.requestedDataset).toBe("axtn_document_registry");
    expect(seen.requestedUser).toBe("user-1");
    expect(documents).toHaveLength(1);
  });

  it("shows a document that intake has registered", async () => {
    const { client } = fakeSupabase(
      [{ id: "14930", row: REGISTERED_ROW }],
      "axtn_document_registry",
    );
    const [document] = await listWorkbenchDocuments(client as never, "user-1");

    expect(document.id).toBe("google_drive:drive:1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR");
    expect(document.rowId).toBe("14930");
    expect(document.processingStatus).toBe("registered");
  });

  it("excludes the schema seed and other non-document rows", async () => {
    const { client } = fakeSupabase(
      [
        { id: "14905", row: SCHEMA_SEED_ROW },
        { id: "14930", row: REGISTERED_ROW },
      ],
      "axtn_document_registry",
    );
    const documents = await listWorkbenchDocuments(client as never, "user-1");

    expect(documents.map((entry) => entry.rowId)).toEqual(["14930"]);
    expect(isRegisteredDocumentRow(SCHEMA_SEED_ROW)).toBe(false);
    expect(isRegisteredDocumentRow(REGISTERED_ROW)).toBe(true);
  });

  it("rejects rows without a document identity", () => {
    expect(isRegisteredDocumentRow({ record_kind: "document" })).toBe(false);
  });

  it("maps the registry's own field names onto the workbench contract", () => {
    const document = normalizeWorkbenchDocument(
      { ...REGISTERED_ROW, content_hash: "abc123", hash_algorithm: "sha256" },
      "14930",
    );

    expect(document.sourceType).toBe("google_drive");
    expect(document.sourceRef).toBe("drive:1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR");
    expect(document.contentHash).toBe("abc123");
    expect(document.hashAlgorithm).toBe("sha256");
    expect(document.privacyClass).toBe("UNRESOLVED");
    expect(document.schemaVersion).toBe("axtn-drive-document-intake-v1");
    expect(document.recordKind).toBe("document");
  });

  it("recovers the provider file id from the identifiers the registry stores", () => {
    expect(normalizeWorkbenchDocument(REGISTERED_ROW, "1").providerFileId).toBe(
      "1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR",
    );
    // An explicitly recorded id always wins over the derived one.
    expect(
      normalizeWorkbenchDocument({ ...REGISTERED_ROW, drive_file_id: "explicit" }, "1")
        .providerFileId,
    ).toBe("explicit");
  });

  it("leaves fields the registration stage never produced unresolved", () => {
    const document = normalizeWorkbenchDocument(REGISTERED_ROW, "14930");

    // These are genuinely absent at registration time. Guessing them would be
    // worse than showing nothing.
    expect(document.documentType).toBeNull();
    expect(document.organization).toBeNull();
    expect(document.primaryDomain).toBeNull();
    expect(document.confidence).toBeNull();
    expect(document.proposedPath).toBeNull();
    expect(document.canonicalFilename).toBeNull();
  });

  it("never presents a provider file id as the document's filename", () => {
    // The defect: a row with no filename displayed its Drive file id under a
    // column header that says "Filename", so a source locator was shown as the
    // document's name.
    const unnamed = normalizeWorkbenchDocument(REGISTERED_ROW, "14930");

    expect(unnamed.filename).toBeNull();
    expect(unnamed.filenameUnavailable).toBe(true);
    expect(unnamed.displayName).toBe(UNRESOLVED_FILENAME_LABEL);
    expect(unnamed.displayName).not.toBe("1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR");
    // The provider id is not hidden — it is shown in the field that is about
    // the provider.
    expect(unnamed.providerFileId).toBe("1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR");
  });

  it("uses the real filename when the registration recorded one", () => {
    const named = normalizeWorkbenchDocument(
      { ...REGISTERED_ROW, original_filename: "Rechnung-2026-01.pdf" },
      "1",
    );

    expect(named.filename).toBe("Rechnung-2026-01.pdf");
    expect(named.filenameUnavailable).toBe(false);
    expect(named.displayName).toBe("Rechnung-2026-01.pdf");
    expect(
      normalizeWorkbenchDocument({ ...REGISTERED_ROW, canonical_filename: "Invoice.pdf" }, "1")
        .displayName,
    ).toBe("Invoice.pdf");
  });

  it("keeps a canonical 24-hex identity distinct from the provider id", () => {
    const document = normalizeWorkbenchDocument(
      {
        ...REGISTERED_ROW,
        document_id: "0f1e2d3c4b5a69788796a5b4",
        source_ref: "drive:1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR",
        drive_file_id: "1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR",
      },
      "1",
    );

    expect(document.id).toMatch(/^[0-9a-f]{24}$/);
    expect(document.id).not.toBe(document.providerFileId);
    expect(document.providerFileId).toBe("1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR");
    // A 24-hex identity carries no provider namespace to mis-parse.
    expect(document.id).not.toContain(":");
  });

  it("exposes a Drive link for a registered Drive document", () => {
    const document = normalizeWorkbenchDocument(
      {
        ...REGISTERED_ROW,
        drive_url: "https://drive.google.com/file/d/1F8F2Uo/view",
      },
      "1",
    );

    expect(document.sourceUrl).toBe("https://drive.google.com/file/d/1F8F2Uo/view");
    expect(document.sourceType).toBe("google_drive");
  });

  it("keeps the registry read-only: the workbench never writes", async () => {
    const written: string[] = [];
    const client = {
      from(table: string) {
        const result = { data: [{ id: "1", row: REGISTERED_ROW }], error: null };
        const builder: Record<string, unknown> = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: async () => ({ data: { id: "table-1" }, error: null }),
          // Supabase query builders are thenable; awaiting one runs the query.
          then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
        };
        for (const verb of ["insert", "update", "upsert", "delete"]) {
          builder[verb] = () => {
            written.push(`${table}.${verb}`);
            return builder;
          };
        }
        return builder;
      },
    };

    await listWorkbenchDocuments(client as never, "user-1");
    expect(written).toEqual([]);
  });
});

describe("resolving a single registered document", () => {
  const ROW = {
    ...REGISTERED_ROW,
    original_filename: "Rechnung-2026-01.pdf",
    mime_type: "application/pdf",
    content_hash: "e3b0c442",
    hash_algorithm: "sha256",
  };

  it("resolves the registry row behind a registration approval", async () => {
    const { client } = fakeSupabase([{ id: "14930", row: ROW }], "axtn_document_registry");
    const document = await findWorkbenchDocumentByDocumentId(
      client as never,
      "user-1",
      "google_drive:drive:1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR",
    );

    expect(document?.originalFilename).toBe("Rechnung-2026-01.pdf");
    expect(document?.mimeType).toBe("application/pdf");
    expect(document?.contentHash).toBe("e3b0c442");
    expect(document?.hashAlgorithm).toBe("sha256");
  });

  it("returns nothing rather than a guess for an unknown identity", async () => {
    const { client } = fakeSupabase([{ id: "14930", row: ROW }], "axtn_document_registry");

    expect(
      await findWorkbenchDocumentByDocumentId(client as never, "user-1", "google_drive:drive:none"),
    ).toBeNull();
    expect(await findWorkbenchDocumentByDocumentId(client as never, "user-1", "  ")).toBeNull();
  });

  it("never resolves a seed row as a document", async () => {
    const { client } = fakeSupabase(
      [{ id: "14905", row: SCHEMA_SEED_ROW }],
      "axtn_document_registry",
    );

    expect(
      await findWorkbenchDocumentByDocumentId(client as never, "user-1", "schema_seed"),
    ).toBeNull();
  });
});

// DMS-LIVE-0003-A-R1 §2.4: the empty technical fields on a Stage-0 document.
//
// Each was investigated against the registry contract. "Ingested" was a
// mapping defect — the registry declares `discovered_at` and the workbench
// read `ingested_at`/`created_at`, columns the registry does not have. The
// rest are genuinely not persisted at this stage and must stay unresolved
// rather than be filled with a plausible-looking substitute.
describe("Stage-0 technical fields", () => {
  const stage0 = {
    document_id: "b64b00c064ab0cba3fc3c733",
    record_kind: "document",
    source_type: "google_drive",
    source_ref: "drive:1WzrMnmvfvc_8Sejt5Dm7Wl8-itzSZWTr",
    original_filename: "2026-03-22_Scan_ 1.pdf",
    current_filename: "2026-03-22_Scan_ 1.pdf",
    mime_type: "application/pdf",
    content_hash: "d46804f6",
    hash_algorithm: "sha256",
    current_path: "00_Inbox",
    processing_status: "registered",
    privacy_status: "UNRESOLVED",
  };

  it("reads Ingested from the column the registry actually declares", () => {
    const document = normalizeWorkbenchDocument(
      { ...stage0, discovered_at: "2026-09-03T02:20:18Z" },
      "1",
    );

    expect(document.ingestedAt).toBe("2026-09-03T02:20:18Z");
  });

  it("leaves technical fields the transport never supplied unresolved", () => {
    const document = normalizeWorkbenchDocument(stage0, "1");

    // Not guesses: file size and modified time would need the n8n envelope to
    // carry them, and an originating run id would need the registration write
    // to record one. Neither exists at this stage, so neither is invented.
    expect(document.fileSize).toBeNull();
    expect(document.modifiedAt).toBeNull();
    expect(document.ingestedAt).toBeNull();
    expect(document.sourceSwarmRunId).toBeNull();
    expect(document.sourceApprovalId).toBeNull();
  });

  it("keeps semantic classification unresolved on a freshly registered row", () => {
    const document = normalizeWorkbenchDocument(stage0, "1");

    expect(document.documentType).toBeNull();
    expect(document.documentFamily).toBeNull();
    expect(document.organization).toBeNull();
    expect(document.primaryDomain).toBeNull();
    expect(document.paraClass).toBeNull();
    expect(document.proposedPath).toBeNull();
    expect(document.confidence).toBeNull();
    expect(document.topics).toBeNull();
  });

  it("still resolves every technical fact the registration did establish", () => {
    const document = normalizeWorkbenchDocument(stage0, "1");

    expect(document.filename).toBe("2026-03-22_Scan_ 1.pdf");
    expect(document.mimeType).toBe("application/pdf");
    expect(document.contentHash).toBe("d46804f6");
    expect(document.currentPath).toBe("00_Inbox");
    expect(document.processingStatus).toBe("registered");
    expect(document.providerFileId).toBe("1WzrMnmvfvc_8Sejt5Dm7Wl8-itzSZWTr");
    expect(document.id).toBe("b64b00c064ab0cba3fc3c733");
  });

  it("does not mine the opaque identity for a provider file id", () => {
    const { source_ref: _dropped, ...withoutSourceRef } = stage0;

    expect(normalizeWorkbenchDocument(withoutSourceRef, "1").providerFileId).toBeNull();
  });
});
