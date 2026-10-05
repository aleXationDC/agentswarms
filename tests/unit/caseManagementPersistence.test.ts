import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, fromMock, rpc } = vi.hoisted(() => ({
  store: {
    tables: [] as Array<Record<string, unknown>>,
    rows: [] as Array<Record<string, unknown>>,
    failNextRelationInsert: false,
  },
  fromMock: vi.fn<(table: string) => QueryBuilder>(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: fromMock, rpc },
}));
vi.mock("@/utils/audit.server", () => ({ auditEvent: vi.fn() }));

type QueryResult = { data: unknown; error: { message: string } | null };

class QueryBuilder {
  private action: "select" | "insert" | "update" = "select";
  private filters: Array<[string, unknown]> = [];
  private payload: unknown;
  private window: [number, number] | null = null;

  constructor(private readonly table: string) {}

  select() {
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters.push([key, value]);
    return this;
  }
  order() {
    return this;
  }
  range(start: number, end: number) {
    this.window = [start, end];
    return this;
  }

  insert(payload: unknown) {
    this.action = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.action = "update";
    this.payload = payload;
    return this;
  }

  maybeSingle() {
    return Promise.resolve(this.execute(true));
  }

  single() {
    return Promise.resolve(this.execute(true));
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  private execute(single = false): QueryResult {
    const records = this.table === "user_data_tables" ? store.tables : store.rows;
    if (this.action === "insert") {
      const payload = this.asRecord(this.payload);
      if (this.table === "user_data_rows") {
        const table = store.tables.find((item) => item.id === payload.table_id);
        if (table?.name === "axtn_case_relations" && store.failNextRelationInsert) {
          store.failNextRelationInsert = false;
          return { data: null, error: { message: "simulated relation write failure" } };
        }
      }
      const inserted = { id: crypto.randomUUID(), ...payload };
      records.push(inserted);
      return { data: single ? inserted : [inserted], error: null };
    }
    if (this.action === "update") {
      const update = this.asRecord(this.payload);
      const matching = this.window
        ? this.filtered(records).slice(this.window[0], this.window[1] + 1)
        : this.filtered(records);
      for (const record of matching) Object.assign(record, update);
      return { data: matching, error: null };
    }
    const matching = this.window
      ? this.filtered(records).slice(this.window[0], this.window[1] + 1)
      : this.filtered(records);
    return { data: single ? (matching[0] ?? null) : matching, error: null };
  }

  private filtered(records: Array<Record<string, unknown>>) {
    return records.filter((record) =>
      this.filters.every(([key, value]) => {
        const [column, field] = key.split("->>");
        const nested = record[column];
        return field
          ? nested &&
              typeof nested === "object" &&
              Object.entries(nested).some(([name, item]) => name === field && item === value)
          : record[column] === value;
      }),
    );
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Expected an object payload.");
    }
    return value as Record<string, unknown>;
  }
}

fromMock.mockImplementation((table) => new QueryBuilder(table));

import {
  assignDocument,
  createAccountForUser,
  createCaseForUser,
  createCaseRelationForUser,
  createContactForUser,
  ensureCaseForAcceptance,
  listCaseManagementData,
  updateCaseForUser,
} from "@/axtn/workbenches/cases/caseManagement.server";

describe("SupaCase acceptance persistence", () => {
  beforeEach(() => {
    store.tables.length = 0;
    store.rows.length = 0;
    store.failNextRelationInsert = false;
    rpc.mockReset().mockImplementation(
      async (
        name: string,
        args: {
          p_user_id: string;
          p_operation: string;
          p_payload: {
            row: Record<string, unknown>;
            expectedVersion: number;
            caseId?: string;
            offset?: number;
            limit?: number;
          };
        },
      ) => {
        if (name === "axtn_case_assignment") {
          const ownedIds = store.tables
            .filter((table) => table.name === "axtn_cases" && table.user_id === args.p_user_id)
            .map((table) => table.id);
          const cases = store.rows.flatMap((entry) => {
            if (!entry.row || typeof entry.row !== "object" || Array.isArray(entry.row)) return [];
            const row = entry.row as Record<string, unknown>;
            if (
              (!ownedIds.includes(entry.table_id) &&
                row.responsible_principal_id !== args.p_user_id) ||
              (args.p_payload.caseId && row.case_id !== args.p_payload.caseId)
            )
              return [];
            const owned = ownedIds.includes(entry.table_id);
            return [
              {
                ...(owned
                  ? row
                  : Object.fromEntries(
                      Object.entries(row).filter(
                        ([key]) => !["private_payload", "parent_case_id"].includes(key),
                      ),
                    )),
                case_access_mode: owned ? "CUSTODIAN" : "RESPONSIBLE",
              },
            ];
          });
          return {
            data: {
              scope: "AUTHORIZED_CASES",
              total: cases.length,
              cases: cases.slice(
                args.p_payload.offset ?? 0,
                (args.p_payload.offset ?? 0) + (args.p_payload.limit ?? 200),
              ),
            },
            error: null,
          };
        }
        if (name !== "axtn_case_manual") return { data: { ok: true }, error: null };
        let table = store.tables.find(
          (item) => item.user_id === args.p_user_id && item.name === "axtn_cases",
        );
        if (!table) {
          table = { id: crypto.randomUUID(), name: "axtn_cases", user_id: args.p_user_id };
          store.tables.push(table);
        }
        const input = args.p_payload.row;
        const tableId = table.id;
        const row = {
          ...input,
          case_id: input.case_id ?? crypto.randomUUID(),
          case_version: args.p_payload.expectedVersion + 1,
          closed_at: input.status === "CLOSED" ? new Date().toISOString() : null,
        };
        const existing = store.rows.find(
          (item) =>
            item.table_id === tableId &&
            item.row &&
            typeof item.row === "object" &&
            "case_id" in item.row &&
            item.row.case_id === row.case_id,
        );
        if (existing) existing.row = row;
        else store.rows.push({ id: crypto.randomUUID(), table_id: tableId, row });
        return { data: row, error: null };
      },
    );
  });

  it("routes protected document assignment through the shared authenticated native profile", async () => {
    const owner = "11111111-1111-4111-8111-111111111111";
    const caseId = "33333333-3333-4333-8333-333333333333";
    await listCaseManagementData(owner);
    const casesTable = store.tables.find((table) => table.name === "axtn_cases")!;
    store.rows.push({
      id: "work-row",
      table_id: casesTable.id,
      row: {
        case_id: caseId,
        source_kind: "document_work",
        document_id: "opaque-document",
      },
    });
    const before = structuredClone(store.rows);
    expect(await assignDocument(owner, caseId, "opaque-document")).toEqual({ ok: true });
    expect(store.rows).toEqual(before);
    expect(rpc).toHaveBeenCalledWith(
      "axtn_case_document",
      expect.objectContaining({
        p_user_id: owner,
        p_operation: "document_assign",
        p_payload: expect.objectContaining({
          caseId,
          documentId: "opaque-document",
          _principal: { kind: "user_session", id: owner },
        }),
      }),
    );
    rpc.mockResolvedValue({
      data: null,
      error: { message: "DOCUMENT_PRIMARY_BUSINESS_RELATION_CONFLICT" },
    });
    await expect(assignDocument(owner, caseId, "opaque-document")).rejects.toThrow(
      "DOCUMENT_PRIMARY_BUSINESS_RELATION_CONFLICT",
    );
  });
  it("reuses the Intake Work Case without replacing its primary Business Case relation", async () => {
    const args = {
      userId: "owner-1",
      documentId: "document-1",
      canonical: { subject: "Accepted document" },
    };
    await expect(ensureCaseForAcceptance(args)).rejects.toThrow("DOCUMENT_INTAKE_CASE_REQUIRED");
    const casesTable = store.tables.find((table) => table.name === "axtn_cases")!;
    const relationsTable = store.tables.find((table) => table.name === "axtn_case_relations")!;
    store.rows.push(
      { id: "business-row", table_id: casesTable.id, row: { case_id: "business-1" } },
      {
        id: "intake-row",
        table_id: casesTable.id,
        row: {
          case_id: "intake-1",
          case_type: "DOCUMENT_PROCESSING",
          source_kind: "document_work",
          document_id: args.documentId,
        },
      },
      {
        id: "relation-row",
        table_id: relationsTable.id,
        row: {
          relation_id: "primary-1",
          case_id: "business-1",
          relation_type: "related_document",
          target_kind: "document",
          target_id: args.documentId,
        },
      },
    );
    const before = structuredClone(store.rows);
    const reused = await ensureCaseForAcceptance(args);
    const replayed = await ensureCaseForAcceptance(args);
    expect(reused).toEqual({
      caseId: "intake-1",
      primaryCaseId: "business-1",
      relationId: "primary-1",
      created: false,
    });
    expect(replayed).toEqual(reused);
    expect(store.rows).toEqual(before);
    store.rows.push({
      id: "other-work",
      table_id: casesTable.id,
      row: {
        case_id: "intake-2",
        case_type: "DOCUMENT_PROCESSING",
        source_kind: "document_work",
        document_id: args.documentId,
      },
    });
    await expect(ensureCaseForAcceptance(args)).rejects.toThrow("DOCUMENT_INTAKE_CASE_AMBIGUOUS");
    expect(
      await ensureCaseForAcceptance({
        ...args,
        canonical: { intake_case_id: "intake-1" },
      }),
    ).toEqual(reused);
  });

  it("keeps case datasets scoped to their authenticated owner", async () => {
    await createCaseForUser("owner-1", { subject: "Owner one" });
    await createCaseForUser("owner-2", { subject: "Owner two" });

    const ownerOne = await listCaseManagementData("owner-1");

    expect(ownerOne.cases).toHaveLength(1);
    expect(ownerOne.cases[0].subject).toBe("Owner one");
  });
  it("does not silently truncate Case totals at the native REST page limit", async () => {
    await listCaseManagementData("owner-1");
    const table = store.tables.find(
      (item) => item.user_id === "owner-1" && item.name === "axtn_cases",
    )!;
    for (let i = 0; i < 1001; i++)
      store.rows.push({
        id: `row-${i}`,
        table_id: table.id,
        row: { case_id: crypto.randomUUID(), subject: `Case ${i}` },
      });
    expect((await listCaseManagementData("owner-1")).cases).toHaveLength(1001);
  });

  it("creates explicit, owner-scoped Case relations idempotently", async () => {
    const { caseId } = await createCaseForUser("owner-1", { subject: "Primary" });
    const { caseId: relatedCaseId } = await createCaseForUser("owner-1", {
      subject: "Related",
    });
    const { accountId } = await createAccountForUser("owner-1", "Acme", null);
    const { contactId } = await createContactForUser("owner-1", "Ada", null, accountId);

    const relatedCase = await createCaseRelationForUser("owner-1", caseId, "case", relatedCaseId);
    const sameCase = await createCaseRelationForUser("owner-1", caseId, "case", relatedCaseId);
    const relatedAccount = await createCaseRelationForUser("owner-1", caseId, "account", accountId);
    const relatedContact = await createCaseRelationForUser("owner-1", caseId, "contact", contactId);

    expect(relatedCase.created).toBe(true);
    expect(sameCase).toEqual({ relationId: relatedCase.relationId, created: false });
    expect(relatedAccount.created).toBe(true);
    expect(relatedContact.created).toBe(true);
    const ownerOne = await listCaseManagementData("owner-1");
    expect(ownerOne.relations).toHaveLength(3);

    await expect(
      createCaseRelationForUser("owner-2", caseId, "case", relatedCaseId),
    ).rejects.toThrow("Case not found.");
    await expect(createCaseRelationForUser("owner-1", caseId, "case", caseId)).rejects.toThrow(
      "cannot be related to itself",
    );
  });

  it("supports manual close and reopen updates while preserving the Case contract", async () => {
    const { caseId } = await createCaseForUser("owner-1", {
      subject: "Follow up",
      priority: 2,
    });

    const common = {
      case_id: caseId,
      subject: "Follow up",
      actor: "human" as const,
    };

    await updateCaseForUser("owner-1", {
      ...common,
      case_version: 1,
      status: "CLOSED",
      status_reason: "Resolved",
    });
    const closed = await listCaseManagementData("owner-1");
    expect(closed.cases[0].status).toBe("CLOSED");
    expect(closed.cases[0].closed_at).toEqual(expect.any(String));

    await updateCaseForUser("owner-1", {
      ...common,
      case_version: 2,
      status: "OPEN",
      status_reason: "Reopened by user",
    });
    const reopened = await listCaseManagementData("owner-1");
    expect(reopened.cases[0].status).toBe("OPEN");
    expect(reopened.cases[0].closed_at).toBeNull();
    expect(reopened.cases[0].status_reason).toBe("Reopened by user");

    await updateCaseForUser("owner-1", {
      ...common,
      case_version: 3,
      status: "OPEN",
      status_reason: null,
    });
    const cleared = await listCaseManagementData("owner-1");
    expect(cleared.cases[0].status_reason).toBeNull();
  });

  it("passes a shared partial update with actual actor and without masked parent/private fields", async () => {
    const owner = "11111111-1111-4111-8111-111111111111";
    const actor = "22222222-2222-4222-8222-222222222222";
    const { caseId } = await createCaseForUser(owner, { subject: "Shared Case" });
    const entry = store.rows.find(
      (item) =>
        item.row &&
        typeof item.row === "object" &&
        "case_id" in item.row &&
        item.row.case_id === caseId,
    )!;
    entry.row = {
      ...(entry.row as Record<string, unknown>),
      responsible_principal_id: actor,
      parent_case_id: "33333333-3333-4333-8333-333333333333",
      private_payload: "SYNTHETIC_PRIVATE",
    };
    await updateCaseForUser(actor, {
      case_id: caseId,
      subject: "Manual collaboration",
      case_version: 1,
    });
    const manual = rpc.mock.calls.filter(([name]) => name === "axtn_case_manual").at(-1)!;
    expect(manual[1].p_user_id).toBe(actor);
    expect(manual[1].p_payload._principal).toEqual({ kind: "user_session", id: actor });
    expect(manual[1].p_payload.row).not.toHaveProperty("parent_case_id");
    expect(manual[1].p_payload.row).not.toHaveProperty("private_payload");
    expect(manual[1].p_payload.row).not.toHaveProperty("case_access_mode");
  });

  it("requires an owned Contact and follow-up before entering WAITING_CONTACT", async () => {
    const { caseId } = await createCaseForUser("owner-1", { subject: "Contact required" });
    await expect(
      updateCaseForUser("owner-1", {
        case_id: caseId,
        subject: "Contact required",
        status: "WAITING_CONTACT",
      }),
    ).rejects.toThrow("WAITING_CONTACT requires a primary Contact");
    await expect(
      updateCaseForUser("owner-1", {
        case_id: caseId,
        subject: "Contact required",
        status: "WAITING_CONTACT",
        primary_contact_id: crypto.randomUUID(),
        follow_up: "2026-10-02",
      }),
    ).rejects.toThrow("Contact not found.");
    const { contactId } = await createContactForUser("owner-1", "Ada", null, null);
    await expect(
      updateCaseForUser("owner-1", {
        case_id: caseId,
        subject: "Contact required",
        case_version: 1,
        status: "WAITING_CONTACT",
        primary_contact_id: contactId,
        follow_up: "2026-10-02",
      }),
    ).resolves.toMatchObject({ caseId, status: "WAITING_CONTACT" });
  });
});
