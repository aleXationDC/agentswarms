import { describe, expect, it } from "vitest";

import {
  filterAndSortWorkbenchDocuments,
  normalizeWorkbenchDocument,
} from "@/axtn/workbenches/documents/documentsWorkbench";
import { reviewContext } from "@/axtn/workbenches/reviews/reviewWorkbench";
import {
  allowlistedMetadataEdits,
  applyMetadataEdits,
} from "@/axtn/workbenches/shared/metadataEdit";
import type { NativeApproval } from "@/hooks/use-approval-decision";

describe("aXtn Documents adapter", () => {
  it("normalizes optional metadata without inventing missing values", () => {
    const document = normalizeWorkbenchDocument(
      {
        document_id: "document-1",
        canonical_filename: "2026-contract.pdf",
        original_filename: "contract.pdf",
        document_type: "Contract",
        document_family: "Legal",
        issuer: "Example Ltd",
        domain: "Legal",
        document_date: "2026-08-31",
        proposed_path: "01_Projects/example",
        para_class: "01_Projects",
        review_status: "pending",
        confidence: 0.92,
        topics: "contract, example",
        drive_url: "https://drive.example.test/document-1",
        mime_type: "application/pdf",
        file_size: 128,
        modified_time: "2026-08-31T12:00:00Z",
        ingested_at: "2026-08-31T11:00:00Z",
        privacy_class: "internal",
      },
      "fallback",
    );

    expect(document).toMatchObject({
      id: "document-1",
      canonicalFilename: "2026-contract.pdf",
      organization: "Example Ltd",
      primaryDomain: "Legal",
      sourceUrl: "https://drive.example.test/document-1",
      confidence: 0.92,
    });
    expect(normalizeWorkbenchDocument({}, "fallback").documentType).toBeNull();
  });

  it("filters and sorts declared document values", () => {
    const first = normalizeWorkbenchDocument(
      { document_id: "1", canonical_filename: "Zeta", primary_domain: "Finance" },
      "1",
    );
    const second = normalizeWorkbenchDocument(
      { document_id: "2", canonical_filename: "Alpha", primary_domain: "Legal" },
      "2",
    );
    expect(
      filterAndSortWorkbenchDocuments([first, second], {
        primaryDomain: "Legal",
        sort: "name",
      }).map((item) => item.id),
    ).toEqual(["2"]);
  });
});

describe("aXtn Reviews adapter", () => {
  it("presents optional native payload context without a second state model", () => {
    const approval = {
      payload: {
        proposal: {
          canonical_filename: "contract.pdf",
          document_type: "Contract",
          primary_domain: "Legal",
          confidence: 0.8,
        },
      },
    } as NativeApproval;
    expect(reviewContext(approval)).toMatchObject({
      subject: "contract.pdf",
      documentType: "Contract",
      primaryDomain: "Legal",
      confidence: 0.8,
      organization: null,
    });

    describe("aXtn metadata edits", () => {
      it("merges only allowlisted fields and records human bulk provenance", () => {
        const edits = allowlistedMetadataEdits({
          document_type: "Contract",
          topics: "legal, renewal",
          source_url: "https://immutable.example",
          swarm_run_id: "immutable-run",
          status: "approved",
        });
        expect(edits).toEqual({ document_type: "Contract", topics: "legal, renewal" });

        expect(
          applyMetadataEdits(
            {
              source_url: "https://immutable.example",
              swarm_run_id: "immutable-run",
              status: "pending",
            },
            edits,
            "user-1",
            true,
          ),
        ).toMatchObject({
          source_url: "https://immutable.example",
          swarm_run_id: "immutable-run",
          status: "pending",
          document_type: "Contract",
          topics: "legal, renewal",
          human_overridden: true,
          human_overridden_by: "user-1",
          bulk_overridden: true,
        });
      });
    });
  });
});
