// DMS-LIVE-0002-A: aXtn Documents must show the canonical registered-document
// lifecycle, not the optional demo dataset.
//
// The defect these tests lock down: the workbench was bound to the optional
// "axtn_documents" dataset, so a document that intake had genuinely registered
// in "axtn_document_registry" was invisible in the UI while its approval was
// already waiting in the inbox.
import { describe, expect, it } from "vitest";

import {
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

  it("still gives an unnamed registered document a usable identity in lists", () => {
    expect(normalizeWorkbenchDocument(REGISTERED_ROW, "14930").displayName).toBe(
      "1F8F2UoPXxj51XZarRMMQ9IqFH1UYz7TR",
    );
    expect(
      normalizeWorkbenchDocument({ ...REGISTERED_ROW, canonical_filename: "Invoice.pdf" }, "1")
        .displayName,
    ).toBe("Invoice.pdf");
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
