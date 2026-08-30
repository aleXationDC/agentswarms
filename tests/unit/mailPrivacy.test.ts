// Unit tests for mail privacy firewall & provider-safe projection (DMS-D1-0003 §8).
import { describe, it, expect, vi } from "vitest";
import {
  buildProviderSafeMailInput,
  type MailPrivacyResult,
} from "@/lib/mailPrivacy.server";
import { normalizeSourceContextPath } from "@/lib/mailIntake.server";

describe("MailPrivacy & Provider-Safe Projection", () => {
  it("normalizes source context path recursively relative to 00_Import root", () => {
    expect(normalizeSourceContextPath("00_aleXation/00_Import")).toBe("");
    expect(normalizeSourceContextPath("00_aleXation/00_Import/")).toBe("");
    expect(normalizeSourceContextPath("00_aleXation/00_Import/Contracts")).toBe("Contracts");
    expect(normalizeSourceContextPath("00_aleXation/00_Import/Contracts/2026/Q3")).toBe("Contracts/2026/Q3");
    expect(normalizeSourceContextPath("00_aleXation\\00_Import\\Immobilien\\Miete")).toBe("Immobilien/Miete");
  });

  it("builds provider-safe projection excluding raw headers, clear emails, and Drive IDs", () => {
    const privacy: MailPrivacyResult = {
      pseudonymizedSubject: "Monthly Report from [PERSON_1]",
      pseudonymizedBody: "Hello [PERSON_2], please review [EMAIL_1].",
      senderCanonicalId: "PERSON-a1b2c3d4",
      recipientCanonicalIds: ["PERSON-e5f6g7h8"],
      privacyClass: "personal",
      piiProcessingStatus: "redacted",
      externalProcessingPolicy: "sanitized_allowed",
      privacyPolicyVersion: "2026-08-30",
      privacyFirewallError: null,
    };

    const safeJsonStr = buildProviderSafeMailInput({
      privacy,
      messageDate: "2026-08-30",
      sourceContextPath: "Contracts/2026",
      attachmentProposals: [
        {
          attachmentIndex: 1,
          filename: "report.pdf",
          proposal: { document_type: "invoice", primary_domain: "Finances" },
        },
      ],
    });

    const parsed = JSON.parse(safeJsonStr) as Record<string, unknown>;

    // Allowed fields
    expect(parsed.subject).toBe("Monthly Report from [PERSON_1]");
    expect(parsed.body).toBe("Hello [PERSON_2], please review [EMAIL_1].");
    expect(parsed.sender_entity_id).toBe("PERSON-a1b2c3d4");
    expect(parsed.recipient_entity_ids).toEqual(["PERSON-e5f6g7h8"]);
    expect(parsed.message_date).toBe("2026-08-30");
    expect(parsed.source_context_path).toBe("Contracts/2026");
    expect(parsed.privacy_class).toBe("personal");
    expect(parsed.pii_processing_status).toBe("redacted");
    expect(parsed.external_processing_policy).toBe("sanitized_allowed");

    // Must NOT contain forbidden fields
    expect(parsed.drive_file_id).toBeUndefined();
    expect(parsed.drive_url).toBeUndefined();
    expect(parsed.from).toBeUndefined();
    expect(parsed.to).toBeUndefined();
    expect(parsed.raw_bytes).toBeUndefined();
  });
});
