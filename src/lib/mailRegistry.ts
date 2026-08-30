// The Mail Registry — operational metadata about ingested emails (DMS-D1-0003 §6).
//
// Like `document_registry`, this is an owner-scoped native AgentSwarms Dataset
// (backed by `user_data_tables` / `user_data_rows`) using the existing Dataset/RLS
// pattern. This makes it queryable by the `sql_query` tool in headless swarm
// runs, the SQL workspace, BI tables, and the semantic layer with no custom DB.
//
// Registries:
//   - `mail_registry`: operational mail metadata, physical locators, staging/filing state.
//   - `mail_source_registry`: non-secret source configuration / provenance.
//   - `mail_attachment_relations`: exact relation from mail_id -> document_id (Drive file ID).
//   - `mail_entity_relations`: exact relation from mail_id -> canonical_id.
//   - `mail_thread_relations`: exact message-ID / in-reply-to / thread links.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

export const MAIL_REGISTRY_DATASET = "mail_registry";
export const MAIL_SOURCE_REGISTRY_DATASET = "mail_source_registry";
export const MAIL_ATTACHMENT_RELATIONS_DATASET = "mail_attachment_relations";
export const MAIL_ENTITY_RELATIONS_DATASET = "mail_entity_relations";
export const MAIL_THREAD_RELATIONS_DATASET = "mail_thread_relations";

export const MAIL_REGISTRY_COLUMNS: { name: string; type: "string" | "number" | "date" }[] = [
  // ---- identity ----
  { name: "mail_id", type: "string" },
  { name: "mail_account_id", type: "string" },
  { name: "raw_sha256", type: "string" },
  { name: "raw_size", type: "number" },
  // ---- source & imap locators ----
  { name: "source_mailbox_path", type: "string" },
  { name: "source_context_path", type: "string" },
  { name: "current_mailbox_path", type: "string" },
  { name: "current_uid", type: "string" },
  { name: "current_uidvalidity", type: "string" },
  // ---- threading facts ----
  { name: "message_id", type: "string" },
  { name: "in_reply_to", type: "string" },
  { name: "references_json", type: "string" },
  // ---- dates ----
  { name: "message_date", type: "date" },
  { name: "ingested_at", type: "date" },
  // ---- attachments ----
  { name: "attachment_count", type: "number" },
  // ---- drive staging & archival provenance ----
  { name: "drive_eml_file_id", type: "string" },
  { name: "drive_eml_path", type: "string" },
  { name: "drive_eml_hash", type: "string" },
  { name: "drive_staging_status", type: "string" }, // pending | staged | failed | verified
  { name: "staged_at", type: "date" },
  { name: "reviewed_at", type: "date" },
  { name: "finalized_at", type: "date" },
  { name: "last_verified_at", type: "date" },
  // ---- classification & filing outcome ----
  { name: "document_type", type: "string" },
  { name: "primary_domain_id", type: "string" },
  { name: "primary_domain", type: "string" },
  { name: "para_class", type: "string" },
  { name: "proposed_path", type: "string" },
  { name: "approved_path", type: "string" },
  { name: "canonical_eml_filename", type: "string" },
  { name: "summary", type: "string" },
  // ---- entity & obligation relations ----
  { name: "sender_entity_id", type: "string" },
  { name: "recipient_entity_ids", type: "string" },
  { name: "deadlines_json", type: "string" },
  { name: "todos_json", type: "string" },
  { name: "obligations_json", type: "string" },
  // ---- governance & review ----
  { name: "classification_status", type: "string" }, // discovered | processing | pending_approval | approved | rejected | error | finalized
  { name: "human_review_status", type: "string" }, // pending | approved | rejected | manual
  { name: "confidence", type: "number" },
  // ---- privacy metadata (DMS-D1-0003 §8) ----
  { name: "privacy_class", type: "string" },
  { name: "pii_processing_status", type: "string" },
  { name: "external_processing_policy", type: "string" },
  { name: "privacy_policy_version", type: "string" },
];

export const MAIL_SOURCE_REGISTRY_COLUMNS: { name: string; type: "string" | "number" | "date" }[] = [
  { name: "mail_account_id", type: "string" },
  { name: "display_label", type: "string" },
  { name: "provider_type", type: "string" },
  { name: "import_root", type: "string" },
  { name: "status", type: "string" },
  { name: "config_metadata", type: "string" },
  { name: "last_synced_at", type: "date" },
];

export const MAIL_ATTACHMENT_RELATIONS_COLUMNS: { name: string; type: "string" | "number" | "date" }[] = [
  { name: "mail_id", type: "string" },
  { name: "document_id", type: "string" },
  { name: "attachment_index", type: "number" },
  { name: "attachment_hash", type: "string" },
  { name: "attachment_filename", type: "string" },
  { name: "mime_type", type: "string" },
  { name: "file_size", type: "number" },
  { name: "disposition", type: "string" },
  { name: "content_id", type: "string" },
  { name: "created_at", type: "date" },
];

export const MAIL_ENTITY_RELATIONS_COLUMNS: { name: string; type: "string" | "number" | "date" }[] = [
  { name: "mail_id", type: "string" },
  { name: "canonical_id", type: "string" },
  { name: "role", type: "string" }, // sender | recipient | mentioned
  { name: "source_field", type: "string" }, // from | to | cc | body
  { name: "created_at", type: "date" },
];

export const MAIL_THREAD_RELATIONS_COLUMNS: { name: string; type: "string" | "number" | "date" }[] = [
  { name: "mail_id", type: "string" },
  { name: "related_mail_id", type: "string" },
  { name: "relation_type", type: "string" }, // in_reply_to | references | thread
  { name: "created_at", type: "date" },
];

export type MailRegistryRow = {
  mail_id: string;
  mail_account_id: string;
  raw_sha256: string;
  raw_size: number;
  source_mailbox_path: string;
  source_context_path: string;
  current_mailbox_path: string;
  current_uid: string;
  current_uidvalidity: string;
  message_id: string | null;
  in_reply_to: string | null;
  references_json: string;
  message_date: string;
  ingested_at: string;
  attachment_count: number;
  drive_eml_file_id: string | null;
  drive_eml_path: string | null;
  drive_eml_hash: string | null;
  drive_staging_status: "pending" | "staged" | "failed" | "verified";
  staged_at: string | null;
  reviewed_at: string | null;
  finalized_at: string | null;
  last_verified_at: string | null;
  document_type: string | null;
  primary_domain_id: string | null;
  primary_domain: string | null;
  para_class: string | null;
  proposed_path: string | null;
  approved_path: string | null;
  canonical_eml_filename: string | null;
  summary: string | null;
  sender_entity_id: string | null;
  recipient_entity_ids: string;
  deadlines_json: string;
  todos_json: string;
  obligations_json: string;
  classification_status:
    | "discovered"
    | "processing"
    | "pending_approval"
    | "approved"
    | "rejected"
    | "error"
    | "finalized";
  human_review_status: "pending" | "approved" | "rejected" | "manual";
  confidence: number | null;
  privacy_class: string;
  pii_processing_status: string;
  external_processing_policy: string;
  privacy_policy_version: string;
};

/** Ensure the mail_registry dataset exists and return its ID. */
export async function ensureMailRegistryDataset(
  sb: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: existing } = await sb
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", MAIL_REGISTRY_DATASET)
    .maybeSingle();
  if (existing?.id) {
    await sb
      .from("user_data_tables")
      .update({ columns: MAIL_REGISTRY_COLUMNS as unknown as Json })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: created, error } = await sb
    .from("user_data_tables")
    .insert({
      user_id: userId,
      name: MAIL_REGISTRY_DATASET,
      source_filename: "aleXation Mail Registry",
      columns: MAIL_REGISTRY_COLUMNS as unknown as Json,
      is_sample: false,
    })
    .select("id")
    .single();
  if (error || !created)
    throw new Error(error?.message ?? "Could not create the mail_registry dataset");
  return created.id;
}

/** Ensure the mail_attachment_relations dataset exists and return its ID. */
export async function ensureMailAttachmentRelationsDataset(
  sb: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: existing } = await sb
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", MAIL_ATTACHMENT_RELATIONS_DATASET)
    .maybeSingle();
  if (existing?.id) {
    await sb
      .from("user_data_tables")
      .update({ columns: MAIL_ATTACHMENT_RELATIONS_COLUMNS as unknown as Json })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: created, error } = await sb
    .from("user_data_tables")
    .insert({
      user_id: userId,
      name: MAIL_ATTACHMENT_RELATIONS_DATASET,
      source_filename: "aleXation Mail Attachment Relations",
      columns: MAIL_ATTACHMENT_RELATIONS_COLUMNS as unknown as Json,
      is_sample: false,
    })
    .select("id")
    .single();
  if (error || !created)
    throw new Error(error?.message ?? "Could not create mail_attachment_relations dataset");
  return created.id;
}

/** Ensure the mail_entity_relations dataset exists and return its ID. */
export async function ensureMailEntityRelationsDataset(
  sb: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: existing } = await sb
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", MAIL_ENTITY_RELATIONS_DATASET)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await sb
    .from("user_data_tables")
    .insert({
      user_id: userId,
      name: MAIL_ENTITY_RELATIONS_DATASET,
      source_filename: "aleXation Mail Entity Relations",
      columns: MAIL_ENTITY_RELATIONS_COLUMNS as unknown as Json,
      is_sample: false,
    })
    .select("id")
    .single();
  if (error || !created)
    throw new Error(error?.message ?? "Could not create mail_entity_relations dataset");
  return created.id;
}

/** Upsert a row in mail_registry, keyed by mail_id. */
export async function upsertMailRegistryRow(
  sb: SupabaseClient<Database>,
  userId: string,
  row: Partial<MailRegistryRow> & { mail_id: string },
): Promise<void> {
  const tableId = await ensureMailRegistryDataset(sb, userId);

  const { data: hit } = await sb
    .from("user_data_rows")
    .select("id, row")
    .eq("table_id", tableId)
    .eq("row->>mail_id", row.mail_id)
    .maybeSingle();

  if (hit?.id) {
    const prev = (hit.row ?? {}) as Record<string, unknown>;
    await sb
      .from("user_data_rows")
      .update({
        row: {
          ...prev,
          ...row,
        } as unknown as Json,
      })
      .eq("id", hit.id);
    return;
  }

  await sb.from("user_data_rows").insert({
    table_id: tableId,
    row: row as unknown as Json,
  });
}

/** Retrieve a row from mail_registry by mail_id. */
export async function getMailRegistryRow(
  sb: SupabaseClient<Database>,
  userId: string,
  mailId: string,
): Promise<MailRegistryRow | null> {
  const tableId = await ensureMailRegistryDataset(sb, userId);
  const { data: hit } = await sb
    .from("user_data_rows")
    .select("row")
    .eq("table_id", tableId)
    .eq("row->>mail_id", mailId)
    .maybeSingle();

  return (hit?.row as MailRegistryRow) ?? null;
}

/** Record an attachment relation: mail_id -> document_id (drive:<id>). */
export async function recordMailAttachmentRelation(
  sb: SupabaseClient<Database>,
  userId: string,
  relation: {
    mail_id: string;
    document_id: string;
    attachment_index: number;
    attachment_hash: string;
    attachment_filename: string;
    mime_type: string;
    file_size: number;
    disposition?: string | null;
    content_id?: string | null;
  },
): Promise<void> {
  const tableId = await ensureMailAttachmentRelationsDataset(sb, userId);
  const nowIso = new Date().toISOString();

  const { data: hit } = await sb
    .from("user_data_rows")
    .select("id")
    .eq("table_id", tableId)
    .eq("row->>mail_id", relation.mail_id)
    .eq("row->>document_id", relation.document_id)
    .maybeSingle();

  const rowData = {
    ...relation,
    disposition: relation.disposition ?? "attachment",
    content_id: relation.content_id ?? null,
    created_at: nowIso,
  };

  if (hit?.id) {
    await sb
      .from("user_data_rows")
      .update({ row: rowData as unknown as Json })
      .eq("id", hit.id);
  } else {
    await sb.from("user_data_rows").insert({
      table_id: tableId,
      row: rowData as unknown as Json,
    });
  }
}

/** Record an entity relation: mail_id -> canonical_id. */
export async function recordMailEntityRelation(
  sb: SupabaseClient<Database>,
  userId: string,
  relation: {
    mail_id: string;
    canonical_id: string;
    role: "sender" | "recipient" | "mentioned";
    source_field: string;
  },
): Promise<void> {
  const tableId = await ensureMailEntityRelationsDataset(sb, userId);
  const nowIso = new Date().toISOString();

  await sb.from("user_data_rows").insert({
    table_id: tableId,
    row: {
      ...relation,
      created_at: nowIso,
    } as unknown as Json,
  });
}
