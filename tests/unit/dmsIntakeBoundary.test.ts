// Native DMS intake boundary — pure parts (DMS-D1-0002 §3). Envelope
// construction and routing decisions must be verifiable without a database or
// network call, since they carry the identity-safety and fail-closed
// guarantees the rest of the pipeline depends on.
import { describe, expect, it } from "vitest";

import {
  buildIntakeEnvelope,
  buildProviderSafeInput,
  decideIntakeRoute,
  documentIdFor,
} from "@/lib/dmsIntake.server";
import { derivePiiProcessingStatus } from "@/lib/privacy/sensitivityPolicy";

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
      piiProcessingStatus: "redacted",
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
      piiProcessingStatus: "blocked",
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
      piiProcessingStatus: "not_run",
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

  it("routes NO AI items to manual review with stage0_only", () => {
    const route = decideIntakeRoute({
      extractionStatus: "no_ai_excluded",
      sensitivityTier: "restricted",
      externalProcessingAllowed: false,
      isNoAi: true,
    });
    expect(route.path).toBe("manual_review");
    expect(route.stage).toBe("stage0_only");
    expect(route.reason).toContain("NO AI:");
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

// DMS-D1-0002R Phase A3: pii_processing_status must be reachable, disjoint,
// and truthful — not the previous hardcoded "passed".
describe("derivePiiProcessingStatus", () => {
  it("is not_run when extraction never produced text to scan", () => {
    expect(
      derivePiiProcessingStatus({
        extractionOk: false,
        detectionOk: false,
        tier: "restricted",
        hasFindings: false,
      }),
    ).toBe("not_run");
  });

  it("is error when the sanitizer itself failed, even if the tier fell back to restricted", () => {
    expect(
      derivePiiProcessingStatus({
        extractionOk: true,
        detectionOk: false,
        tier: "restricted",
        hasFindings: false,
      }),
    ).toBe("error");
  });

  it("is blocked when detection succeeded but the tier forbids external processing", () => {
    expect(
      derivePiiProcessingStatus({
        extractionOk: true,
        detectionOk: true,
        tier: "restricted",
        hasFindings: true,
      }),
    ).toBe("blocked");
  });

  it("is redacted when detection succeeded, findings exist, and the tier allows external processing", () => {
    expect(
      derivePiiProcessingStatus({
        extractionOk: true,
        detectionOk: true,
        tier: "personal",
        hasFindings: true,
      }),
    ).toBe("redacted");
  });

  it("is passed when detection succeeded and found nothing", () => {
    expect(
      derivePiiProcessingStatus({
        extractionOk: true,
        detectionOk: true,
        tier: "standard",
        hasFindings: false,
      }),
    ).toBe("passed");
  });
});

// DMS-D1-0002R Phase A1: the provider-safe projection must never leak Drive
// identity or raw envelope metadata into the agent-visible channel.
describe("buildProviderSafeInput", () => {
  const envelope = buildIntakeEnvelope({
    drive,
    contentHash: "deadbeef",
    extraction: { status: "ok", error: null },
    pseudonymizedText: "Hello PERSON-abc123.",
    sensitivity: { tier: "personal", externalProcessingAllowed: true },
    piiProcessingStatus: "redacted",
  });

  it("excludes every Drive-identifying / raw-metadata field", () => {
    const projected = JSON.parse(buildProviderSafeInput(envelope));
    for (const forbidden of [
      "document_id",
      "drive_file_id",
      "drive_url",
      "filename",
      "source_filename",
      "parent_folders",
      "created_time",
      "modified_time",
      "content_hash",
      "file_size",
      "ingested_at",
    ]) {
      expect(projected).not.toHaveProperty(forbidden);
    }
  });

  it("keeps exactly the allow-listed operational/content fields", () => {
    const projected = JSON.parse(buildProviderSafeInput(envelope));
    expect(projected).toEqual({
      mime_type: "application/pdf",
      extraction_status: "ok",
      extraction_error: null,
      text: "Hello PERSON-abc123.",
      privacy_class: "personal",
      pii_processing_status: "redacted",
      external_processing_policy: "sanitized_allowed",
      privacy_policy_version: envelope.privacy_policy_version,
    });
  });

  it("never contains the Drive file id as a substring anywhere in the serialized output", () => {
    const distinctEnvelope = buildIntakeEnvelope({
      drive: { ...drive, driveFileId: "drive-id-should-never-leak-9f8e7d" },
      contentHash: "deadbeef",
      extraction: { status: "ok", error: null },
      pseudonymizedText: "Hello PERSON-abc123.",
      sensitivity: { tier: "personal", externalProcessingAllowed: true },
      piiProcessingStatus: "redacted",
    });
    const serialized = buildProviderSafeInput(distinctEnvelope);
    expect(serialized).not.toContain("drive-id-should-never-leak-9f8e7d");
  });
});
