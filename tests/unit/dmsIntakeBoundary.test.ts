// Native DMS intake boundary — pure parts (DMS-D1-0002 §3). Envelope
// construction and routing decisions must be verifiable without a database or
// network call, since they carry the identity-safety and fail-closed
// guarantees the rest of the pipeline depends on.
import { describe, expect, it } from "vitest";

import { buildIntakeEnvelope, decideIntakeRoute, documentIdFor } from "@/lib/dmsIntake.server";

describe("documentIdFor", () => {
  it("mints the authoritative drive:<id> document_id", () => {
    expect(documentIdFor("abc123")).toBe("drive:abc123");
  });
});

const drive = {
  driveFileId: "abc123",
  driveUrl: "https://drive.example/abc123",
  filename: "test.pdf",
  mimeType: "application/pdf",
  parentFolderIds: ["folder-1"],
  createdTime: "2024-01-01T00:00:00Z",
  modifiedTime: "2024-01-02T00:00:00Z",
  size: 1024,
};

describe("buildIntakeEnvelope", () => {
  it("carries only deterministic identity/metadata facts, never model output", () => {
    const env = buildIntakeEnvelope({
      drive,
      contentHash: "deadbeef",
      extraction: { status: "ok", error: null },
      pseudonymizedText: "Hello PERSON-abc123.",
      sensitivity: { tier: "personal", externalProcessingAllowed: true },
    });
    expect(env.document_id).toBe("drive:abc123");
    expect(env.content_hash).toBe("deadbeef");
    expect(env.text).toBe("Hello PERSON-abc123.");
    expect(env.privacy_class).toBe("personal");
    expect(env.external_processing_policy).toBe("sanitized_allowed");
  });

  it("marks external_processing_policy blocked when sensitivity forbids it", () => {
    const env = buildIntakeEnvelope({
      drive,
      contentHash: "deadbeef",
      extraction: { status: "ok", error: null },
      pseudonymizedText: "",
      sensitivity: { tier: "restricted", externalProcessingAllowed: false },
    });
    expect(env.external_processing_policy).toBe("blocked");
  });

  it("preserves the extraction status/error even when extraction failed", () => {
    const env = buildIntakeEnvelope({
      drive,
      contentHash: "deadbeef",
      extraction: { status: "extraction_failed", error: "corrupt PDF" },
      pseudonymizedText: "",
      sensitivity: { tier: "restricted", externalProcessingAllowed: false },
    });
    expect(env.extraction_status).toBe("extraction_failed");
    expect(env.extraction_error).toBe("corrupt PDF");
    expect(env.text).toBe("");
  });
});

describe("decideIntakeRoute", () => {
  it("routes readable + privacy-allowed content to the swarm", () => {
    const route = decideIntakeRoute({
      extractionStatus: "ok",
      sensitivityTier: "personal",
      externalProcessingAllowed: true,
    });
    expect(route.path).toBe("swarm");
  });

  it("routes standard (no PII) content to the swarm too", () => {
    const route = decideIntakeRoute({
      extractionStatus: "ok",
      sensitivityTier: "standard",
      externalProcessingAllowed: true,
    });
    expect(route.path).toBe("swarm");
  });

  it("routes unreadable content to manual review, never the swarm", () => {
    const route = decideIntakeRoute({
      extractionStatus: "extraction_failed",
      sensitivityTier: "standard",
      externalProcessingAllowed: true,
    });
    expect(route.path).toBe("manual_review");
  });

  it("routes unsupported content type to manual review", () => {
    const route = decideIntakeRoute({
      extractionStatus: "unsupported_content_type",
      sensitivityTier: "standard",
      externalProcessingAllowed: true,
    });
    expect(route.path).toBe("manual_review");
  });

  it("routes restricted-tier content to manual review even if extraction succeeded", () => {
    const route = decideIntakeRoute({
      extractionStatus: "ok",
      sensitivityTier: "restricted",
      externalProcessingAllowed: false,
    });
    expect(route.path).toBe("manual_review");
  });

  it("never routes to the swarm when externalProcessingAllowed is false, regardless of tier label", () => {
    const route = decideIntakeRoute({
      extractionStatus: "ok",
      sensitivityTier: "personal",
      externalProcessingAllowed: false,
    });
    expect(route.path).toBe("manual_review");
  });
});
