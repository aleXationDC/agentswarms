// buildRegistryRow — extraction/privacy fields (DMS-D1-0002 §4/§5/§7). Pure
// function, no DB/network dependency.
import { describe, expect, it } from "vitest";

import { buildRegistryRow, PRIVACY_POLICY_VERSION } from "@/lib/documentRegistry";

const envelope = {
  document_id: "drive:abc123",
  drive_file_id: "abc123",
  source_filename: "test.pdf",
  mime_type: "application/pdf",
};

describe("buildRegistryRow — extraction status", () => {
  it("records an explicit extraction status/error, never fabricating content", () => {
    const row = buildRegistryRow({
      envelope,
      proposal: {},
      humanReviewStatus: "manual",
      extraction: { status: "extraction_failed", error: "unsupported binary content" },
    });
    expect(row.extraction_status).toBe("extraction_failed");
    expect(row.extraction_error).toBe("unsupported binary content");
  });

  it("leaves extraction fields null when extraction was not attempted/reported", () => {
    const row = buildRegistryRow({ envelope, proposal: {}, humanReviewStatus: "pending" });
    expect(row.extraction_status).toBeNull();
    expect(row.extraction_error).toBeNull();
  });
});

describe("buildRegistryRow — privacy metadata", () => {
  it("records privacy class, PII status and external-processing policy", () => {
    const row = buildRegistryRow({
      envelope,
      proposal: {},
      humanReviewStatus: "pending",
      privacy: {
        privacyClass: "personal",
        piiProcessingStatus: "passed",
        externalProcessingPolicy: "sanitized_allowed",
      },
    });
    expect(row.privacy_class).toBe("personal");
    expect(row.pii_processing_status).toBe("passed");
    expect(row.external_processing_policy).toBe("sanitized_allowed");
    expect(row.privacy_policy_version).toBe(PRIVACY_POLICY_VERSION);
  });

  it("defaults pii_processing_status to not_run when the firewall has not evaluated the document", () => {
    const row = buildRegistryRow({ envelope, proposal: {}, humanReviewStatus: "pending" });
    expect(row.pii_processing_status).toBe("not_run");
    expect(row.privacy_class).toBeNull();
    expect(row.external_processing_policy).toBeNull();
  });

  it("never places a clear PII value or a pseudonym-vault field on the row", () => {
    const row = buildRegistryRow({
      envelope,
      proposal: {},
      humanReviewStatus: "pending",
      privacy: {
        privacyClass: "restricted",
        piiProcessingStatus: "failed",
        externalProcessingPolicy: "blocked",
      },
    });
    const keys = Object.keys(row);
    expect(keys).not.toContain("pseudonym_token");
    expect(keys).not.toContain("clear_value");
    expect(keys).not.toContain("entity_key");
  });

  it("accepts the 'manual' human_review_status for unreadable/restricted content", () => {
    const row = buildRegistryRow({ envelope, proposal: {}, humanReviewStatus: "manual" });
    expect(row.human_review_status).toBe("manual");
  });
});
