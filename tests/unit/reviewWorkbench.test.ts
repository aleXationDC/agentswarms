// Unit tests for Productive Review Workbench & Direct Human Override (DMS-D1-0003-REVIEW §6, §7, §9, §12).
import { describe, it, expect, vi } from "vitest";
import {
  applyHumanProposalOverride,
  applyBulkProposalOverride,
  analyzeBulkFieldValues,
  findDuplicateCandidates,
  validateParaFolderPath,
  fetchReviewQueue,
  CANONICAL_PARA_ROOTS,
} from "@/lib/reviewWorkbench";
import { REGISTRY_DATASET } from "@/lib/documentRegistry";
import { MAIL_REGISTRY_DATASET } from "@/lib/mailRegistry";

function createMockSupabase() {
  const tables = new Map<string, any>();
  const rows = new Map<string, any[]>();
  const approvals = new Map<string, any>();
  const cases = new Map<string, any>();

  return {
    from: vi.fn((table: string) => {
      let filterEq = new Map<string, any>();
      let filterGte = new Map<string, any>();
      let filterIn = new Map<string, any[]>();

      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: any) => {
          filterEq.set(col, val);
          return builder;
        }),
        in: vi.fn((col: string, val: any[]) => {
          filterIn.set(col, val);
          return builder;
        }),
        gte: vi.fn((col: string, val: any) => {
          filterGte.set(col, val);
          return builder;
        }),
        order: vi.fn(() => builder),
        then: (resolve: any) => {
          if (table === "approvals") {
            let list = Array.from(approvals.values());
            if (filterIn.has("id")) {
              const ids = new Set(filterIn.get("id"));
              list = list.filter((a) => ids.has(a.id));
            }
            if (filterEq.has("user_id")) {
              list = list.filter((a) => a.user_id === filterEq.get("user_id"));
            }
            return resolve({ data: list, error: null });
          }
          return resolve({ data: [], error: null });
        },
        limit: vi.fn(() => {
          if (table === "approvals") {
            const list = Array.from(approvals.values());
            return Promise.resolve({ data: list, error: null });
          }
          if (table === "clarification_cases") {
            const list = Array.from(cases.values());
            return Promise.resolve({ data: list, error: null });
          }
          if (table === "user_data_rows") {
            const tId = filterEq.get("table_id");
            return Promise.resolve({ data: rows.get(tId) || [], error: null });
          }
          return Promise.resolve({ data: [], error: null });
        }),
        maybeSingle: vi.fn(() => {
          if (table === "approvals") {
            const id = filterEq.get("id");
            return Promise.resolve({ data: approvals.get(id) || null, error: null });
          }
          if (table === "clarification_cases") {
            const id = filterEq.get("id");
            const approvalId = filterEq.get("approval_id");
            const subjectKey = filterEq.get("subject_key");
            for (const c of cases.values()) {
              if (id && c.id === id) return Promise.resolve({ data: c, error: null });
              if (approvalId && c.approval_id === approvalId) return Promise.resolve({ data: c, error: null });
              if (subjectKey && c.subject_key === subjectKey) return Promise.resolve({ data: c, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          }
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
        insert: vi.fn((data: any) => {
          if (table === "approvals") {
            const id = data.id || `appr-${Math.random().toString(36).slice(2, 8)}`;
            const item = { id, ...data };
            approvals.set(id, item);
            return Promise.resolve({ data: item, error: null });
          }
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
          return Promise.resolve({ data: null, error: null });
        }),
        update: vi.fn((data: any) => {
          const updateBuilder: any = {
            eq: vi.fn((col: string, val: any) => {
              if (table === "approvals") {
                const id = filterEq.get("id") || (col === "id" ? val : null);
                if (id && approvals.has(id)) {
                  Object.assign(approvals.get(id), data);
                }
              }
              if (table === "clarification_cases") {
                const id = filterEq.get("id") || (col === "id" ? val : null);
                if (id && cases.has(id)) {
                  Object.assign(cases.get(id), data);
                }
              }
              return updateBuilder;
            }),
            then: (resolve: any) => resolve({ data: null, error: null }),
          };
          return updateBuilder;
        }),
      };
      return builder;
    }),
    _mockData: { tables, rows, approvals, cases },
  } as any;
}

describe("Review Workbench & Direct Human Override", () => {
  it("validates allowed PARA roots and rejects 00_Inbox and foreign roots", () => {
    for (const root of CANONICAL_PARA_ROOTS) {
      const res = validateParaFolderPath(`${root}/Subfolder/Item`);
      expect(res.valid).toBe(true);
      expect(res.cleanPath).toBe(`${root}/Subfolder/Item`);
    }

    const inboxRes = validateParaFolderPath("00_Inbox/Subfolder");
    expect(inboxRes.valid).toBe(false);
    expect(inboxRes.error).toMatch(/not allowed/);

    const emptyRes = validateParaFolderPath("");
    expect(emptyRes.valid).toBe(false);
  });

  it("applies direct Human Override to allowed proposal fields with zero LLM calls", async () => {
    const sb = createMockSupabase();
    const approvalId = "appr-001";
    sb._mockData.approvals.set(approvalId, {
      id: approvalId,
      user_id: "user-1",
      status: "pending",
      payload: {
        envelope: {
          source_filename: "2026-08-30 Invoice.pdf",
          document_id: "drive:file-123",
        },
        proposal: {
          document_type: "contract",
          proposed_folder_path: "04_Archive",
          sender_or_issuer: "Old Sender",
        },
      },
    });

    const overrideRes = await applyHumanProposalOverride(sb, "user-1", approvalId, {
      document_type: "invoice",
      sender_or_issuer: "Deutsche Telekom",
      proposed_folder_path: "02_Areas/Finanzen/Telekommunikation",
      document_date: "2026-08-30",
    });

    expect(overrideRes.ok).toBe(true);
    expect(overrideRes.proposal?.document_type).toBe("invoice");
    expect(overrideRes.proposal?.sender_or_issuer).toBe("Deutsche Telekom");
    expect(overrideRes.proposal?.proposed_folder_path).toBe("02_Areas/Finanzen/Telekommunikation");
    expect(overrideRes.proposal?.human_overridden).toBe(true);

    const updatedApproval = sb._mockData.approvals.get(approvalId);
    expect(updatedApproval.payload.proposal.document_type).toBe("invoice");
    expect(updatedApproval.payload.proposal.sender_or_issuer).toBe("Deutsche Telekom");
  });

  it("rejects attempt to modify immutable identity/source fields", async () => {
    const sb = createMockSupabase();
    const approvalId = "appr-002";
    sb._mockData.approvals.set(approvalId, {
      id: approvalId,
      user_id: "user-1",
      status: "pending",
      payload: {
        envelope: { document_id: "drive:file-original" },
        proposal: { document_type: "invoice" },
      },
    });

    const overrideRes = await applyHumanProposalOverride(sb, "user-1", approvalId, {
      document_id: "drive:file-tampered",
    } as any);

    expect(overrideRes.ok).toBe(false);
    expect(overrideRes.error).toMatch(/immutable identity\/source field/);
  });

  it("detects exact duplicate by content_hash without an LLM call", async () => {
    const sb = createMockSupabase();
    const tableId = "table-doc-reg";
    sb._mockData.tables.set(tableId, { name: REGISTRY_DATASET, user_id: "user-1" });
    sb._mockData.rows.set(tableId, [
      {
        id: "r1",
        table_id: tableId,
        row: {
          document_id: "drive:file-existing",
          content_hash: "hash-exact-match-12345",
          canonical_filename: "2026-08-01_Invoice_Telekom.pdf",
          organization: "Deutsche Telekom",
          document_type: "invoice",
          document_date: "2026-08-01",
        },
      },
    ]);

    const candidates = await findDuplicateCandidates(sb, "user-1", {
      currentDocumentId: "drive:file-new",
      contentHash: "hash-exact-match-12345",
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0].matchType).toBe("exact_hash");
    expect(candidates[0].documentId).toBe("drive:file-existing");
    expect(candidates[0].matchReason).toMatch(/Exact byte content match/);
  });

  it("does not classify different hash as duplicate solely on superficial properties", async () => {
    const sb = createMockSupabase();
    const tableId = "table-doc-reg";
    sb._mockData.tables.set(tableId, { name: REGISTRY_DATASET, user_id: "user-1" });
    sb._mockData.rows.set(tableId, [
      {
        id: "r1",
        table_id: tableId,
        row: {
          document_id: "drive:file-existing",
          content_hash: "hash-original",
          organization: "Different Org",
          document_type: "contract",
          document_date: "2025-01-01",
        },
      },
    ]);

    const candidates = await findDuplicateCandidates(sb, "user-1", {
      currentDocumentId: "drive:file-new",
      contentHash: "hash-different",
      senderOrIssuer: "Deutsche Telekom",
      documentType: "invoice",
    });

    expect(candidates).toHaveLength(0);
  });

  it("analyzes field values across multiple items and detects mixed values (DMS-D1-0003-REVIEW-v2 §14.3)", () => {
    const items = [
      {
        approval: {
          payload: {
            proposal: {
              document_type: "invoice",
              sender_or_issuer: "Deutsche Telekom",
              proposed_folder_path: "02_Areas/Finanzen",
              topics: ["telecom", "billing"],
            },
          },
        },
      },
      {
        approval: {
          payload: {
            proposal: {
              document_type: "invoice",
              sender_or_issuer: "Vodafone",
              proposed_folder_path: "02_Areas/Finanzen",
              topics: ["telecom"],
            },
          },
        },
      },
    ];

    const analysis = analyzeBulkFieldValues(items);
    expect(analysis.document_type.isMixed).toBe(false);
    expect(analysis.document_type.commonValue).toBe("invoice");

    expect(analysis.sender_or_issuer.isMixed).toBe(true);
    expect(analysis.sender_or_issuer.uniqueValues).toEqual(["Deutsche Telekom", "Vodafone"]);

    expect(analysis.proposed_folder_path.isMixed).toBe(false);
    expect(analysis.proposed_folder_path.commonValue).toBe("02_Areas/Finanzen");

    expect(analysis.topics.isMixed).toBe(true);
  });

  it("applies bulk classification patch to multiple items with zero LLM calls and topics add/remove/replace", async () => {
    const sb = createMockSupabase();
    sb._mockData.approvals.set("appr-b1", {
      id: "appr-b1",
      user_id: "user-1",
      status: "pending",
      payload: {
        envelope: { source_filename: "2026-08-01 Bill 1.pdf" },
        proposal: {
          document_type: "contract",
          sender_or_issuer: "Old Org",
          proposed_folder_path: "04_Archive",
          topics: ["old_topic"],
        },
      },
    });
    sb._mockData.approvals.set("appr-b2", {
      id: "appr-b2",
      user_id: "user-1",
      status: "pending",
      payload: {
        envelope: { source_filename: "2026-08-02 Bill 2.pdf" },
        proposal: {
          document_type: "receipt",
          sender_or_issuer: "Old Org",
          proposed_folder_path: "04_Archive",
          topics: ["existing_topic"],
        },
      },
    });

    const bulkRes = await applyBulkProposalOverride(sb, "user-1", ["appr-b1", "appr-b2"], {
      document_type: { apply: true, value: "invoice" },
      sender_or_issuer: { apply: true, value: "Deutsche Telekom" },
      proposed_folder_path: { apply: true, value: "02_Areas/Finanzen/Telekommunikation" },
      topics: { apply: true, mode: "add", values: ["telecom", "monthly"] },
      document_family: { apply: false, value: "Ignored" },
    });

    expect(bulkRes.ok).toBe(true);
    expect(bulkRes.count).toBe(2);

    const updated1 = sb._mockData.approvals.get("appr-b1").payload.proposal;
    expect(updated1.document_type).toBe("invoice");
    expect(updated1.sender_or_issuer).toBe("Deutsche Telekom");
    expect(updated1.proposed_folder_path).toBe("02_Areas/Finanzen/Telekommunikation");
    expect(updated1.topics).toContain("old_topic");
    expect(updated1.topics).toContain("telecom");
    expect(updated1.topics).toContain("monthly");
    expect(updated1.bulk_overridden).toBe(true);
    expect(updated1.document_family).toBeUndefined(); // unapplied field untouched

    const updated2 = sb._mockData.approvals.get("appr-b2").payload.proposal;
    expect(updated2.document_type).toBe("invoice");
    expect(updated2.sender_or_issuer).toBe("Deutsche Telekom");
    expect(updated2.topics).toContain("existing_topic");
    expect(updated2.topics).toContain("telecom");
  });

  it("fails full-set validation and creates NO partial updates if any item has invalid PARA folder", async () => {
    const sb = createMockSupabase();
    sb._mockData.approvals.set("appr-valid", {
      id: "appr-valid",
      user_id: "user-1",
      status: "pending",
      payload: {
        envelope: { source_filename: "doc1.pdf" },
        proposal: { document_type: "invoice", proposed_folder_path: "04_Archive" },
      },
    });
    sb._mockData.approvals.set("appr-invalid", {
      id: "appr-invalid",
      user_id: "user-1",
      status: "pending",
      payload: {
        envelope: { source_filename: "doc2.pdf" },
        proposal: { document_type: "invoice", proposed_folder_path: "04_Archive" },
      },
    });

    // Test invalid PARA root
    const bulkRes = await applyBulkProposalOverride(sb, "user-1", ["appr-valid", "appr-invalid"], {
      proposed_folder_path: { apply: true, value: "00_Inbox/Subfolder" },
    });

    expect(bulkRes.ok).toBe(false);
    expect(bulkRes.error).toMatch(/not allowed/);

    // Confirm that NO approval was updated in database (no partial updates)
    const after1 = sb._mockData.approvals.get("appr-valid").payload.proposal;
    expect(after1.proposed_folder_path).toBe("04_Archive");
  });

  it("fails full-set validation if any selected approval is not pending", async () => {
    const sb = createMockSupabase();
    sb._mockData.approvals.set("appr-p1", {
      id: "appr-p1",
      user_id: "user-1",
      status: "pending",
      payload: { proposal: { document_type: "invoice" } },
    });
    sb._mockData.approvals.set("appr-p2", {
      id: "appr-p2",
      user_id: "user-1",
      status: "approved", // already approved
      payload: { proposal: { document_type: "invoice" } },
    });

    const bulkRes = await applyBulkProposalOverride(sb, "user-1", ["appr-p1", "appr-p2"], {
      document_type: { apply: true, value: "receipt" },
    });

    expect(bulkRes.ok).toBe(false);
    expect(bulkRes.error).toMatch(/approved.*state/);

    const afterP1 = sb._mockData.approvals.get("appr-p1").payload.proposal;
    expect(afterP1.document_type).toBe("invoice");
  });
});
