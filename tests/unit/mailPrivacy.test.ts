// Unit tests for mail privacy firewall & provider-safe projection (DMS-D1-0003 §8).
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildProviderSafeMailInput,
  runMailPrivacyPipeline,
  type MailPrivacyResult,
} from "@/lib/mailPrivacy.server";
import { normalizeSourceContextPath } from "@/lib/mailIntake.server";
import type { ParsedMailEnvelope } from "@/lib/mailParser.server";
import * as piiDetection from "@/lib/privacy/piiDetection.server";
import * as pseudonymize from "@/lib/privacy/pseudonymize.server";
import * as entityResolution from "@/lib/privacy/entityResolution.server";

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

describe("runMailPrivacyPipeline — Independent Subject and Body PII Handling", () => {
  const dummySb = {} as any;
  const dummyUserId = "user-123";

  const makeMail = (subject: string, bodyText: string): ParsedMailEnvelope => ({
    mail_id: "mail:test:1",
    mail_account_id: "primary",
    raw_sha256: "abc",
    raw_size: 100,
    message_id: "<test@example.com>",
    in_reply_to: null,
    references: [],
    from: { text: "sender@example.com", address: "sender@example.com", name: "Sender" },
    to: [{ text: "recipient@example.com", address: "recipient@example.com", name: "Recipient" }],
    cc: [],
    reply_to: null,
    subject,
    message_date: "2026-08-30T12:00:00Z",
    message_date_source: "header",
    body_text: bodyText,
    body_html: null,
    attachment_count: 0,
    attachments: [],
    canonical_eml_filename: "2026-08-30_MAIL_Test.eml",
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(entityResolution, "resolveEntity").mockResolvedValue({
      status: "matched",
      canonicalId: "ENTITY-1",
      entityType: "email",
    });
  });

  it("1. subject PII pseudonymization works", async () => {
    const mail = makeMail("Rechnung von Max Mustermann", "Hier ist der Text ohne PII.");

    vi.spyOn(piiDetection, "detectPii").mockImplementation(async (text: string) => {
      if (text === mail.subject) {
        return {
          ok: true,
          findings: [{ entity_type: "PERSON", start: 13, end: 27, score: 0.95, text: "Max Mustermann" }],
        };
      }
      return { ok: true, findings: [] };
    });

    vi.spyOn(pseudonymize, "pseudonymizeDocumentText").mockImplementation(async (_sb, _uid, text, _findings) => {
      if (text === mail.subject) {
        return {
          pseudonymizedText: "Rechnung von PERSON-1",
          tokensUsed: [{ token: "PERSON-1", entityType: "person", rawValue: "Max Mustermann", label: "PERSON" }],
        };
      }
      return { pseudonymizedText: text, tokensUsed: [] };
    });

    const res = await runMailPrivacyPipeline(dummySb, dummyUserId, mail);
    expect(res.privacyFirewallError).toBeNull();
    expect(res.pseudonymizedSubject).toBe("Rechnung von PERSON-1");
    expect(res.pseudonymizedBody).toBe("Hier ist der Text ohne PII.");
    expect(res.piiProcessingStatus).toBe("redacted");
  });

  it("2. body PII pseudonymization works", async () => {
    const mail = makeMail("Allgemeine Anfrage", "Bitte kontaktieren Sie Erika Musterfrau unter info@test.de.");

    vi.spyOn(piiDetection, "detectPii").mockImplementation(async (text: string) => {
      if (text === mail.body_text) {
        return {
          ok: true,
          findings: [{ entity_type: "PERSON", start: 27, end: 43, score: 0.95, text: "Erika Musterfrau" }],
        };
      }
      return { ok: true, findings: [] };
    });

    vi.spyOn(pseudonymize, "pseudonymizeDocumentText").mockImplementation(async (_sb, _uid, text, _findings) => {
      if (text === mail.body_text) {
        return {
          pseudonymizedText: "Bitte kontaktieren Sie PERSON-2 unter info@test.de.",
          tokensUsed: [{ token: "PERSON-2", entityType: "person", rawValue: "Erika Musterfrau", label: "PERSON" }],
        };
      }
      return { pseudonymizedText: text, tokensUsed: [] };
    });

    const res = await runMailPrivacyPipeline(dummySb, dummyUserId, mail);
    expect(res.privacyFirewallError).toBeNull();
    expect(res.pseudonymizedSubject).toBe("Allgemeine Anfrage");
    expect(res.pseudonymizedBody).toBe("Bitte kontaktieren Sie PERSON-2 unter info@test.de.");
    expect(res.piiProcessingStatus).toBe("redacted");
  });

  it("3. PII in both subject and body works simultaneously", async () => {
    const mail = makeMail("Vertrag für Max", "Hallo Erika, anbei der Vertrag.");

    vi.spyOn(piiDetection, "detectPii").mockImplementation(async (text: string) => {
      if (text === mail.subject) {
        return {
          ok: true,
          findings: [{ entity_type: "PERSON", start: 12, end: 15, score: 0.95, text: "Max" }],
        };
      }
      if (text === mail.body_text) {
        return {
          ok: true,
          findings: [{ entity_type: "PERSON", start: 6, end: 11, score: 0.95, text: "Erika" }],
        };
      }
      return { ok: true, findings: [] };
    });

    vi.spyOn(pseudonymize, "pseudonymizeDocumentText").mockImplementation(async (_sb, _uid, text, _findings) => {
      if (text === mail.subject) {
        return {
          pseudonymizedText: "Vertrag für PERSON-1",
          tokensUsed: [{ token: "PERSON-1", entityType: "person", rawValue: "Max", label: "PERSON" }],
        };
      }
      if (text === mail.body_text) {
        return {
          pseudonymizedText: "Hallo PERSON-2, anbei der Vertrag.",
          tokensUsed: [{ token: "PERSON-2", entityType: "person", rawValue: "Erika", label: "PERSON" }],
        };
      }
      return { pseudonymizedText: text, tokensUsed: [] };
    });

    const res = await runMailPrivacyPipeline(dummySb, dummyUserId, mail);
    expect(res.privacyFirewallError).toBeNull();
    expect(res.pseudonymizedSubject).toBe("Vertrag für PERSON-1");
    expect(res.pseudonymizedBody).toBe("Hallo PERSON-2, anbei der Vertrag.");
  });

  it("4. spans cannot cross string boundaries (independent scanning calls detectPii separately per string)", async () => {
    const mail = makeMail("Kurzer Betreff", "Längerer Body Text mit Inhalt.");
    const scannedTexts: string[] = [];

    vi.spyOn(piiDetection, "detectPii").mockImplementation(async (text: string) => {
      scannedTexts.push(text);
      return { ok: true, findings: [] };
    });

    await runMailPrivacyPipeline(dummySb, dummyUserId, mail);

    expect(scannedTexts).toHaveLength(2);
    expect(scannedTexts[0]).toBe("Kurzer Betreff");
    expect(scannedTexts[1]).toBe("Längerer Body Text mit Inhalt.");
    expect(scannedTexts.some((t) => t.includes("Subject: "))).toBe(false);
  });

  it("5. privacy still fails closed on genuine processing failure (detection failure)", async () => {
    const mail = makeMail("Betreff", "Body");

    vi.spyOn(piiDetection, "detectPii").mockResolvedValue({
      ok: false,
      error: "Presidio unreachable",
    });

    const res = await runMailPrivacyPipeline(dummySb, dummyUserId, mail);
    expect(res.privacyFirewallError).toBe("Presidio unreachable");
    expect(res.externalProcessingPolicy).toBe("blocked");
    expect(res.privacyClass).toBe("restricted");
  });

  it("5b. privacy still fails closed on genuine processing failure (vault exception)", async () => {
    const mail = makeMail("Betreff", "Body mit Max");

    vi.spyOn(piiDetection, "detectPii").mockResolvedValue({
      ok: true,
      findings: [{ entity_type: "PERSON", start: 9, end: 12, score: 0.95, text: "Max" }],
    });

    vi.spyOn(pseudonymize, "pseudonymizeDocumentText").mockRejectedValue(
      new Error("Privacy Vault connection refused"),
    );

    const res = await runMailPrivacyPipeline(dummySb, dummyUserId, mail);
    expect(res.privacyFirewallError).toBe("Privacy Vault connection refused");
    expect(res.externalProcessingPolicy).toBe("blocked");
    expect(res.privacyClass).toBe("restricted");
  });
});
