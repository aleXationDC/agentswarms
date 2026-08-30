// Boundary & integration tests for Mail Intake (DMS-D1-0003 §5, §6, §8, §10, §14, §17).
import { describe, it, expect, vi } from "vitest";
import {
  processMailDiscovery,
  processMailStagingReadback,
  processMailReviewReadback,
  processMailSemantic,
} from "@/lib/mailIntake.server";
import { parseRfc822Bytes } from "@/lib/mailParser.server";

function createMockSupabase() {
  const tables = new Map<string, any>();
  const rows = new Map<string, any[]>();

  return {
    from: vi.fn((table: string) => {
      let currentTableId: string | null = null;
      let filterEq = new Map<string, any>();

      const builder: any = {
        select: vi.fn((cols: string) => builder),
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
          if (table === "clarification_cases") {
            return {
              select: () => ({
                maybeSingle: () => Promise.resolve({ data: { id: "case-1", ...data }, error: null }),
              }),
            };
          }
          return Promise.resolve({ data: null, error: null });
        }),
        update: vi.fn((data: any) => {
          return {
            eq: vi.fn((col: string, val: any) => {
              if (table === "user_data_rows") {
                for (const [tId, rowList] of rows.entries()) {
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
            const entityKey = filterEq.get("row->>entity_key");
            const rowList = rows.get(tId) || [];

            for (const r of rowList) {
              if (docId && r.row?.document_id === docId) return Promise.resolve({ data: r, error: null });
              if (mailId && r.row?.mail_id === mailId) return Promise.resolve({ data: r, error: null });
              if (entityKey && r.row?.entity_key === entityKey) return Promise.resolve({ data: r, error: null });
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

describe("MailIntakeBoundary", () => {
  const boundary = "----=_Part_999";
  const rawEml = [
    "From: Partner Support <support@partner.org>",
    "To: Me <alex@example.com>",
    "Subject: Service Contract 2026",
    "Date: Sun, 30 Aug 2026 14:00:00 +0200",
    "Message-ID: <service-contract-99@partner.org>",
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Hi Alex,\nAttached is the service contract for your properties.\nThanks,\nPartner Team",
    "",
    `--${boundary}`,
    "Content-Type: application/pdf; name=\"contract_properties.pdf\"",
    "Content-Disposition: attachment; filename=\"contract_properties.pdf\"",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from("%PDF-1.4 sample contract pdf").toString("base64"),
    "",
    `--${boundary}--`,
  ].join("\r\n");
  const bytes = new TextEncoder().encode(rawEml);

  it("Step 1 (Discovery): registers mechanical mail row and extracts attachment manifest", async () => {
    const sb = createMockSupabase();
    const result = await processMailDiscovery(sb, {
      userId: "user-1",
      bytes,
      mailAccountId: "primary",
      sourceMailboxPath: "00_aleXation/00_Import/Immobilien/Vertraege",
      sourceUid: "101",
      sourceUidValidity: "12345",
    });

    expect(result.status).toBe("discovered");
    if (result.status === "discovered") {
      expect(result.mailId).toMatch(/^mail:primary:sha256:/);
      expect(result.attachmentCount).toBe(1);
      expect(result.attachments[0].filename).toBe("contract_properties.pdf");
      expect(result.attachments[0].contentBase64).toBeDefined();
    }
  });

  it("Step 2 (Staging Readback): records Drive .eml provenance and creates document_registry attachment row", async () => {
    const sb = createMockSupabase();
    const disc = await processMailDiscovery(sb, {
      userId: "user-1",
      bytes,
      mailAccountId: "primary",
      sourceMailboxPath: "00_aleXation/00_Import/Immobilien/Vertraege",
    });
    expect(disc.status).toBe("discovered");
    if (disc.status !== "discovered") return;

    const stagingRes = await processMailStagingReadback(sb, {
      userId: "user-1",
      mailId: disc.mailId,
      driveEml: {
        driveFileId: "drive-eml-file-1",
        filename: disc.canonicalEmlFilename,
        contentHash: disc.rawSha256,
        size: bytes.byteLength,
      },
      driveAttachments: [
        {
          attachmentIndex: 1,
          driveFileId: "drive-att-file-2",
          filename: "contract_properties.pdf",
          contentHash: disc.attachments[0].contentHash,
          size: disc.attachments[0].size,
        },
      ],
    });

    expect(stagingRes.status).toBe("staged_verified");
    if (stagingRes.status === "staged_verified") {
      expect(stagingRes.driveEmlFileId).toBe("drive-eml-file-1");
      expect(stagingRes.attachmentDocumentIds).toContain("drive:drive-att-file-2");
    }
  });

  it("Step 3 (Review Readback): updates IMAP locator to 00_Review", async () => {
    const sb = createMockSupabase();
    const disc = await processMailDiscovery(sb, {
      userId: "user-1",
      bytes,
      mailAccountId: "primary",
      sourceMailboxPath: "00_aleXation/00_Import",
    });
    if (disc.status !== "discovered") return;

    const rev = await processMailReviewReadback(sb, {
      userId: "user-1",
      mailId: disc.mailId,
      reviewMailboxPath: "00_aleXation/00_Review",
      reviewUid: "505",
      reviewUidValidity: "12345",
    });

    expect(rev.status).toBe("review_recorded");
    expect(rev.mailId).toBe(disc.mailId);
  });
});
