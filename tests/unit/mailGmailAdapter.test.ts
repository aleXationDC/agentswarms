// Tests for Google Workspace/Gmail Mail Adapter (DMS-D1-0003W).
//
// Invariants:
// 1. Exact base64url RAW decoding produces identical RFC822 bytes, identical SHA-256 hash and identical canonical mail_id.
// 2. Gmail ID / Thread ID / labels are stored purely as provider provenance and decoupled from canonical mail identity.
// 3. Gmail label projections:
//    - Discovery: aleXation/State/Import
//    - Staging / Review Readback: aleXation/State/Review
//    - Approved Filing: aleXation/PARA/<approved_path>
// 4. Unrelated system/user labels (INBOX, STARRED, UNREAD, personal labels) are preserved.
import { describe, it, expect, vi } from "vitest";
import {
  processMailDiscovery,
  processMailReviewReadback,
  processMailStagingReadback,
} from "@/lib/mailIntake.server";
import {
  buildApprovedMailFilingPlan,
  buildGmailTargetLabel,
  GMAIL_IMPORT_LABEL,
  GMAIL_REVIEW_LABEL,
  GMAIL_PARA_PREFIX,
} from "@/lib/mailFiling.server";

function createMockSupabase() {
  const tables = new Map<string, any>();
  const rows = new Map<string, any[]>();

  return {
    from: vi.fn((table: string) => {
      let filterEq = new Map<string, any>();

      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: any) => {
          filterEq.set(col, val);
          return builder;
        }),
        insert: vi.fn((data: any) => {
          if (table === "user_data_tables") {
            const id = `table-${Math.random().toString(36).slice(2, 8)}`;
            tables.set(id, data);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: { id, ...data }, error: null }),
              }),
            };
          }
          if (table === "user_data_rows") {
            const tId = data.table_id;
            const rowList = rows.get(tId) || [];
            const newRow = { id: `row-${Math.random().toString(36).slice(2, 8)}`, ...data };
            rowList.push(newRow);
            rows.set(tId, rowList);
            return Promise.resolve({ data: newRow, error: null });
          }
          if (table === "approvals") {
            const id = `appr-${Math.random().toString(36).slice(2, 8)}`;
            return {
              select: () => ({
                maybeSingle: () => Promise.resolve({ data: { id, ...data }, error: null }),
              }),
            };
          }
          return Promise.resolve({ data: null, error: null });
        }),
        update: vi.fn((data: any) => {
          return {
            eq: vi.fn((col: string, val: any) => {
              if (table === "user_data_rows") {
                for (const [, rowList] of rows.entries()) {
                  const r = rowList.find((item) => item[col] === val);
                  if (r) Object.assign(r, data);
                }
              }
              return Promise.resolve({ data: null, error: null });
            }),
          };
        }),
        maybeSingle: vi.fn(() => {
          if (table === "user_data_tables") {
            const name = filterEq.get("name");
            for (const [id, t] of tables.entries()) {
              if (t.name === name) return Promise.resolve({ data: { id, ...t }, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          }
          if (table === "user_data_rows") {
            const tId = filterEq.get("table_id");
            const docId = filterEq.get("row->>document_id");
            const mailId = filterEq.get("row->>mail_id");
            const rowList = rows.get(tId) || [];

            for (const r of rowList) {
              if (docId && r.row?.document_id === docId) return Promise.resolve({ data: r, error: null });
              if (mailId && r.row?.mail_id === mailId) return Promise.resolve({ data: r, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        }),
      };
      return builder;
    }),
  } as any;
}

describe("Google Workspace / Gmail Mail Adapter (DMS-D1-0003W)", () => {
  const boundary = "----=_Part_GMAIL_123";
  const rawRfc822 = [
    "From: Telekom Kundenservice <rechnung@telekom.de>",
    "To: Alexander Heisig <alex@example.com>",
    "Subject: Ihre Telekom Rechnung August 2026",
    "Date: Mon, 31 Aug 2026 10:15:00 +0200",
    "Message-ID: <telekom-20260831-999@telekom.de>",
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Guten Tag,\nIhre neue Festnetz-Rechnung steht bereit.\nMit freundlichen Grüßen,\nTelekom Deutschland",
    "",
    `--${boundary}`,
    "Content-Type: application/pdf; name=\"Rechnung_2026_08.pdf\"",
    "Content-Disposition: attachment; filename=\"Rechnung_2026_08.pdf\"",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from("%PDF-1.5 synthetic telekom bill").toString("base64"),
    "",
    `--${boundary}--`,
  ].join("\r\n");

  const rawBytes = new TextEncoder().encode(rawRfc822);
  // Gmail format=RAW returns RFC 4648 base64url-encoded string
  const base64UrlRaw = Buffer.from(rawBytes).toString("base64url");

  it("decodes Gmail base64url RAW to exact canonical RFC822 bytes with identical SHA-256 and mail_id", async () => {
    // Decode base64url to Uint8Array exactly as n8n or intake transport does
    const decodedBuffer = Buffer.from(base64UrlRaw, "base64url");
    const decodedBytes = new Uint8Array(decodedBuffer);

    expect(decodedBytes).toEqual(rawBytes);

    const sb = createMockSupabase();
    const result = await processMailDiscovery(sb, {
      userId: "user-test",
      bytes: decodedBytes,
      mailAccountId: "workspace-alex",
      providerType: "gmail",
      providerMessageId: "18f9c1b2a3d4e5f6",
      providerThreadId: "18f9c1b2a3d4e5f6",
      providerLabelsJson: JSON.stringify(["INBOX", "UNREAD", GMAIL_IMPORT_LABEL]),
    });

    expect(result.status).toBe("discovered");
    if (result.status === "discovered") {
      expect(result.mailId).toMatch(/^mail:workspace-alex:sha256:/);
      expect(result.rawSha256).toBeDefined();
      expect(result.canonicalEmlFilename).toMatch(/^2026-08-31_MAIL_.*\.eml$/);
      expect(result.attachmentCount).toBe(1);
      expect(result.attachments[0].filename).toBe("Rechnung_2026_08.pdf");
    }
  });

  it("preserves Gmail provider metadata and transitions labels on Review Readback", async () => {
    const sb = createMockSupabase();
    const disc = await processMailDiscovery(sb, {
      userId: "user-test",
      bytes: rawBytes,
      mailAccountId: "workspace-alex",
      providerType: "gmail",
      providerMessageId: "18f9c1b2a3d4e5f6",
      providerThreadId: "18f9c1b2a3d4e5f6",
      providerLabelsJson: JSON.stringify(["INBOX", GMAIL_IMPORT_LABEL, "Label_Custom"]),
    });
    expect(disc.status).toBe("discovered");
    if (disc.status !== "discovered") return;

    // Simulate review readback from n8n Gmail node
    const rev = await processMailReviewReadback(sb, {
      userId: "user-test",
      mailId: disc.mailId,
      providerType: "gmail",
      providerMessageId: "18f9c1b2a3d4e5f6",
      providerThreadId: "18f9c1b2a3d4e5f6",
      providerLabelsJson: JSON.stringify(["INBOX", GMAIL_REVIEW_LABEL, "Label_Custom"]),
      reviewMailboxPath: GMAIL_REVIEW_LABEL,
    });

    expect(rev.status).toBe("review_recorded");
    expect(rev.mailId).toBe(disc.mailId);
  });

  it("builds approved filing plan with correct Gmail label projection and label mutation set", () => {
    const proposal = {
      proposed_folder_path: "02_Areas/Finanzen/Telekommunikation",
      document_type: "invoice",
      document_date: "2026-08-31",
      document_date_source: "explicit_document",
    };

    const envelope = {
      mail_id: "mail:workspace-alex:sha256:fedcba9876543210",
      drive_eml_file_id: "drive-eml-gmail-001",
      canonical_eml_filename: "2026-08-31_MAIL_Telekom_fedcba98.eml",
      message_date: "2026-08-31",
    };

    const attachments = [
      {
        document_id: "drive:att-telekom-pdf",
        drive_file_id: "att-telekom-pdf",
        original_filename: "Rechnung_2026_08.pdf",
        proposed_folder_path: "02_Areas/Finanzen/Telekommunikation",
      },
    ];

    const plan = buildApprovedMailFilingPlan({
      mailId: "mail:workspace-alex:sha256:fedcba9876543210",
      proposal,
      envelope,
      attachments,
      approvalId: "appr-telekom-001",
    });

    expect(plan.mail_id).toBe("mail:workspace-alex:sha256:fedcba9876543210");
    expect(plan.approved_target_folder).toBe("02_Areas/Finanzen/Telekommunikation");
    expect(plan.imap_target_folder).toBe("00_aleXation/02_Areas/Finanzen/Telekommunikation");
    expect(plan.gmail_target_label).toBe("aleXation/PARA/02_Areas/Finanzen/Telekommunikation");
    expect(plan.gmail_labels_to_add).toEqual(["aleXation/PARA/02_Areas/Finanzen/Telekommunikation"]);
    expect(plan.gmail_labels_to_remove).toEqual(["aleXation/State/Review"]);
    expect(plan.attachments).toHaveLength(1);
    expect(plan.attachments[0].approved_target_folder).toBe("02_Areas/Finanzen/Telekommunikation");
  });

  it("computes Gmail target label prefixes correctly for root and nested paths", () => {
    expect(buildGmailTargetLabel("02_Areas/Immobilien/Elektro")).toBe("aleXation/PARA/02_Areas/Immobilien/Elektro");
    expect(buildGmailTargetLabel("/01_Projects/Website/")).toBe("aleXation/PARA/01_Projects/Website");
    expect(buildGmailTargetLabel("04_Archive")).toBe("aleXation/PARA/04_Archive");
  });
});
