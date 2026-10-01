import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { auditEvent } from "@/utils/audit.server";
import {
  reopenOnRelevantActivity,
  validateCaseDraft,
  type CaseActor,
  type CaseDraft,
} from "./caseContract";

const DATASETS = {
  cases: {
    name: "axtn_cases",
    columns: [
      "case_id",
      "parent_case_id",
      "subject",
      "case_type",
      "status",
      "status_reason",
      "priority",
      "due_date",
      "follow_up",
      "account_id",
      "primary_contact_id",
      "related_entity",
      "created_at",
      "updated_at",
      "closed_at",
      "source_kind",
      "source_id",
    ],
  },
  accounts: {
    name: "axtn_accounts",
    columns: ["account_id", "name", "account_type", "created_at", "updated_at"],
  },
  contacts: {
    name: "axtn_contacts",
    columns: ["contact_id", "name", "email", "account_id", "created_at", "updated_at"],
  },
  relations: {
    name: "axtn_case_relations",
    columns: ["relation_id", "case_id", "relation_type", "target_id", "target_kind", "created_at"],
  },
} as const;

async function ensureDataset(userId: string, key: keyof typeof DATASETS): Promise<string> {
  const definition = DATASETS[key];
  const { data: current, error: readError } = await supabaseAdmin
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", definition.name)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (current) return current.id;
  const { data: created, error } = await supabaseAdmin
    .from("user_data_tables")
    .insert({
      user_id: userId,
      name: definition.name,
      source_filename: "aXtn SupaCase Management",
      columns: definition.columns.map((name) => ({ name, type: "string" })) as unknown as Json,
      is_sample: false,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? `Could not create ${definition.name}.`);
  return created.id;
}

async function rowsFor(userId: string, key: keyof typeof DATASETS) {
  const tableId = await ensureDataset(userId, key);
  const { data, error } = await supabaseAdmin
    .from("user_data_rows")
    .select("id, row")
    .eq("table_id", tableId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((entry) =>
    typeof entry.row === "object" && entry.row !== null ? entry.row : {},
  ) as Record<string, unknown>[];
}
async function insertRow(userId: string, key: keyof typeof DATASETS, row: Record<string, unknown>) {
  const tableId = await ensureDataset(userId, key);
  const { error } = await supabaseAdmin
    .from("user_data_rows")
    .insert({ table_id: tableId, row: row as Json });
  if (error) throw new Error(error.message);
}

export async function listCaseManagementData(userId: string) {
  const [cases, accounts, contacts, relations] = await Promise.all([
    rowsFor(userId, "cases"),
    rowsFor(userId, "accounts"),
    rowsFor(userId, "contacts"),
    rowsFor(userId, "relations"),
  ]);
  return { cases, accounts, contacts, relations };
}

export async function createCaseForUser(userId: string, data: CaseDraft & { actor?: CaseActor }) {
  validateCaseDraft(data, data.actor ?? "human");
  const now = new Date().toISOString();
  const caseId = crypto.randomUUID();
  await insertRow(userId, "cases", {
    case_id: caseId,
    parent_case_id: data.parent_case_id ?? null,
    subject: data.subject.trim(),
    case_type: data.case_type ?? "TODO",
    status: data.status ?? "NEW",
    status_reason: data.status_reason ?? null,
    priority: data.priority ?? 3,
    due_date: data.due_date ?? null,
    follow_up: data.follow_up ?? null,
    account_id: data.account_id ?? null,
    primary_contact_id: data.primary_contact_id ?? null,
    related_entity: data.related_entity ?? null,
    created_at: now,
    updated_at: now,
    closed_at: data.status === "CLOSED" ? now : null,
    source_kind: "manual",
    source_id: userId,
  });
  auditEvent({
    userId,
    action: "axtn_case.create",
    resourceType: "axtn_case",
    resourceId: caseId,
    detail: { priority: data.priority ?? 3 },
  });
  return { caseId };
}

export async function assignDocument(userId: string, caseId: string, documentId: string) {
  const cases = await rowsFor(userId, "cases");
  if (!cases.some((row) => row.case_id === caseId)) throw new Error("Case not found.");
  const relations = await rowsFor(userId, "relations");
  const existing = relations.find(
    (row) => row.target_kind === "document" && row.target_id === documentId,
  );
  if (existing && existing.case_id !== caseId)
    throw new Error("Document is already assigned to another Case.");
  if (!existing)
    await insertRow(userId, "relations", {
      relation_id: crypto.randomUUID(),
      case_id: caseId,
      relation_type: "related_document",
      target_id: documentId,
      target_kind: "document",
      created_at: new Date().toISOString(),
    });
  return { ok: true };
}

export async function updateCaseForUser(
  userId: string,
  data: CaseDraft & { case_id: string; actor?: CaseActor; relevant_activity?: boolean },
) {
  const tableId = await ensureDataset(userId, "cases");
  const { data: rows, error } = await supabaseAdmin
    .from("user_data_rows")
    .select("id, row")
    .eq("table_id", tableId);
  if (error) throw new Error(error.message);
  const current = (rows ?? []).find(
    (entry) => (entry.row as Record<string, unknown>)?.case_id === data.case_id,
  );
  if (!current || typeof current.row !== "object" || current.row === null)
    throw new Error("Case not found.");
  const before = current.row as Record<string, unknown>;
  const {
    case_id,
    actor,
    relevant_activity,
    access_token: _accessToken,
    ...patch
  } = data as CaseDraft & {
    case_id: string;
    actor?: CaseActor;
    relevant_activity?: boolean;
    access_token?: string;
  };
  const currentStatus = typeof before.status === "string" ? before.status : "NEW";
  const reopened =
    relevant_activity && currentStatus === "CLOSED" ? reopenOnRelevantActivity("CLOSED") : null;
  const next = {
    ...before,
    ...patch,
    case_id,
    status: reopened?.status ?? patch.status ?? currentStatus,
    status_reason: reopened?.status_reason ?? patch.status_reason ?? before.status_reason ?? null,
    priority: patch.priority ?? (typeof before.priority === "number" ? before.priority : 3),
    updated_at: new Date().toISOString(),
    closed_at:
      (reopened?.status ?? patch.status ?? currentStatus) === "CLOSED"
        ? (before.closed_at ?? new Date().toISOString())
        : null,
  } as Record<string, unknown>;
  if (actor === "automation" && before.priority === 0 && next.priority !== 0)
    throw new Error("Automation cannot overwrite Human Critical priority 0.");
  validateCaseDraft(next as CaseDraft, actor ?? "human");
  const { error: updateError } = await supabaseAdmin
    .from("user_data_rows")
    .update({ row: next as Json })
    .eq("id", current.id);
  if (updateError) throw new Error(updateError.message);
  return { caseId: data.case_id, status: next.status };
}

export async function createAccountForUser(
  userId: string,
  name: string,
  accountType: string | null,
) {
  const accountId = crypto.randomUUID();
  const now = new Date().toISOString();
  await insertRow(userId, "accounts", {
    account_id: accountId,
    name: name.trim(),
    account_type: accountType,
    created_at: now,
    updated_at: now,
  });
  return { accountId };
}
export async function createContactForUser(
  userId: string,
  name: string,
  email: string | null,
  accountId: string | null,
) {
  const contactId = crypto.randomUUID();
  const now = new Date().toISOString();
  await insertRow(userId, "contacts", {
    contact_id: contactId,
    name: name.trim(),
    email,
    account_id: accountId,
    created_at: now,
    updated_at: now,
  });
  return { contactId };
}

export async function ensureCaseForAcceptance(args: {
  userId: string;
  documentId: string;
  canonical: Record<string, unknown>;
}) {
  const relations = await rowsFor(args.userId, "relations");
  const existingRelation = relations.find(
    (row) => row.target_kind === "document" && row.target_id === args.documentId,
  );
  if (
    typeof existingRelation?.case_id === "string" &&
    typeof existingRelation.relation_id === "string"
  )
    return {
      caseId: existingRelation.case_id,
      relationId: existingRelation.relation_id,
      created: false,
    };
  const now = new Date().toISOString();
  const caseId = crypto.randomUUID();
  const draft: CaseDraft = {
    subject: String(
      args.canonical.subject ??
        args.canonical.canonical_filename ??
        args.canonical.filename ??
        `Document ${args.documentId}`,
    ),
    case_type: "TODO",
    status: "OPEN",
    priority: 3,
    account_id: typeof args.canonical.account_id === "string" ? args.canonical.account_id : null,
    primary_contact_id:
      typeof args.canonical.primary_contact_id === "string"
        ? args.canonical.primary_contact_id
        : null,
    related_entity:
      typeof args.canonical.related_entity === "string" ? args.canonical.related_entity : null,
  };
  validateCaseDraft(draft, "automation");
  await insertRow(args.userId, "cases", {
    case_id: caseId,
    parent_case_id: null,
    ...draft,
    status_reason: "Created at filing acceptance",
    due_date: null,
    follow_up: null,
    created_at: now,
    updated_at: now,
    closed_at: null,
    source_kind: "dms_document",
    source_id: args.documentId,
  });
  const relationId = crypto.randomUUID();
  await insertRow(args.userId, "relations", {
    relation_id: relationId,
    case_id: caseId,
    relation_type: "related_document",
    target_id: args.documentId,
    target_kind: "document",
    created_at: now,
  });
  return { caseId, relationId, created: true };
}
