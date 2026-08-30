// Unit tests for local RFC822/MIME parsing and identity (DMS-D1-0003 §5, §6, §9).
import { describe, it, expect } from "vitest";
import {
  mailIdFor,
  computeSha256Hex,
  parseRfc822Bytes,
  buildCanonicalMailFilename,
} from "@/lib/mailParser.server";

describe("MailParser & Identity", () => {
  it("derives deterministic canonical mail_id from account_id and raw sha256", () => {
    const rawSha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const mailId = mailIdFor("primary", rawSha256);
    expect(mailId).toBe(`mail:primary:sha256:${rawSha256}`);
  });

  it("produces deterministic canonical .eml filename", () => {
    const fn = buildCanonicalMailFilename({
      messageDate: "2026-08-30",
      subject: "Important Contract Renewal",
      senderAddress: "partner@example.com",
      rawSha256: "abcdef0123456789",
    });
    expect(fn).toBe("2026-08-30_MAIL_Important_Contract_Renewal_abcdef01.eml");
  });

  it("parses a synthetic RFC822 mail message with headers, body, and attachments", async () => {
    const boundary = "----=_Part_12345_67890";
    const rawEml = [
      "From: Alice Developer <alice@example.com>",
      "To: Bob Manager <bob@example.com>",
      "Cc: Carol Legal <carol@example.com>",
      "Subject: Monthly Report and Invoice",
      "Date: Sun, 30 Aug 2026 10:00:00 +0200",
      "Message-ID: <msg-1001@example.com>",
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Hello Bob,\n\nPlease find the attached invoice for August 2026.\n\nBest,\nAlice",
      "",
      `--${boundary}`,
      "Content-Type: application/pdf; name=\"invoice_august_2026.pdf\"",
      "Content-Disposition: attachment; filename=\"invoice_august_2026.pdf\"",
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from("%PDF-1.4 synthetic invoice pdf content").toString("base64"),
      "",
      `--${boundary}--`,
    ].join("\r\n");

    const bytes = new TextEncoder().encode(rawEml);
    const parsed = await parseRfc822Bytes({
      bytes,
      mailAccountId: "primary",
    });

    expect(parsed.mail_id).toMatch(/^mail:primary:sha256:[a-f0-9]{64}$/);
    expect(parsed.from?.address).toBe("alice@example.com");
    expect(parsed.from?.name).toBe("Alice Developer");
    expect(parsed.to[0].address).toBe("bob@example.com");
    expect(parsed.cc[0].address).toBe("carol@example.com");
    expect(parsed.subject).toBe("Monthly Report and Invoice");
    expect(parsed.message_id).toBe("<msg-1001@example.com>");
    expect(parsed.body_text).toContain("Please find the attached invoice for August 2026.");
    expect(parsed.attachment_count).toBe(1);
    expect(parsed.attachments[0].filename).toBe("invoice_august_2026.pdf");
    expect(parsed.attachments[0].mimeType).toBe("application/pdf");
    expect(parsed.attachments[0].size).toBeGreaterThan(0);
    expect(parsed.attachments[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
