// The Document Registry — operational metadata about documents that live in
// Google Drive.
//
// WHY THIS IS A NATIVE DATASET AND NOT A NEW POSTGRES TABLE
// The obvious move is `CREATE TABLE documents (...)`. It is the wrong one here.
// The platform's `sql_query` tool — the only data tool that survives a HEADLESS
// swarm run (HEADLESS_SCOPED_TOOLS in swarmExecute.server.ts) — cannot see the
// application's own schema at all. It reads exclusively from
// `user_data_tables` / `user_data_rows` (see loadUserTables in
// utils/tools/sql.server.ts). The same store backs the SQL workspace, the BI
// table widget, the semantic layer and the AI Analyst.
//
// So a bespoke table would have produced a registry that no agent could query
// and no native page could show, and we would then have written a custom API
// and a custom grid to compensate — exactly the parallel stack we are avoiding.
// Registering the registry AS a dataset makes every one of those surfaces work
// with no new UI and no new tool.
//
// WHAT BELONGS HERE
// Operational metadata only: identity, location, classification outcome, review
// state. It answers "what documents exist and where are they?".
//
// What does NOT belong here:
//   - the file itself           → Google Drive remains authoritative
//   - reusable filing rules     → native KB "aleXation Filing Knowledge"
//   - soft user preferences     → native LTM (agent_memory_items)
//   - entity relationships      → native knowledge graph
//
// Drive is the document repository. This is the index.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { buildCanonicalFilename } from "@/lib/canonicalFilename";

/** Dataset name. Stable: agents, semantic models and widgets bind to it. */
export const REGISTRY_DATASET = "document_registry";

/**
 * Registry columns.
 *
 * Deliberately flat and deliberately small. Domain-specific structure (tax
 * assignments, property links, invoice lines) must NOT be added here — those
 * become their own datasets keyed by `document_id`, so the document core stays
 * stable while specialised workflows evolve independently.
 *
 * `type` uses the dataset engine's vocabulary: number | string | date.
 */
export const REGISTRY_COLUMNS: { name: string; type: "string" | "number" | "date" }[] = [
  // ---- identity (deterministic, never LLM-authored) ----
  { name: "document_id", type: "string" },
  { name: "drive_file_id", type: "string" },
  { name: "drive_url", type: "string" },
  { name: "content_hash", type: "string" },
  { name: "filename", type: "string" },
  // The name as it exists in Drive right now. Kept distinct from
  // `canonical_filename` so a later rename can be verified against what was
  // actually there, not against what we hoped was there.
  { name: "original_filename", type: "string" },
  { name: "canonical_filename", type: "string" },
  { name: "filename_change_required", type: "string" },
  { name: "mime_type", type: "string" },
  { name: "file_size", type: "number" },
  // ---- physical location in Drive (as currently known) ----
  { name: "current_parent_folder_id", type: "string" },
  { name: "current_path", type: "string" },
  { name: "proposed_path", type: "string" },
  { name: "created_time", type: "date" },
  { name: "modified_time", type: "date" },
  { name: "ingested_at", type: "date" },
  { name: "last_verified_at", type: "date" },
  // ---- classification outcome ----
  { name: "document_type", type: "string" },
  { name: "document_family", type: "string" },
  // Stable identifier. This is the authoritative link — the string below is a
  // display cache that may be rewritten when a domain is renamed or merged.
  { name: "primary_domain_id", type: "string" },
  { name: "primary_domain", type: "string" },
  // candidate | confirmed — whether the domain above is a trusted anchor or
  // merely something detected and not yet blessed by a human.
  { name: "primary_domain_status", type: "string" },
  // The exact wording the model produced, kept when it differed from the
  // canonical name. This is the audit trail for drift.
  { name: "proposed_domain_name", type: "string" },
  { name: "primary_context", type: "string" },
  { name: "organization", type: "string" },
  { name: "topics", type: "string" },
  { name: "para_class", type: "string" },
  { name: "document_date", type: "date" },
  // How the document date was established. Distinguishes a date printed on the
  // document from one we merely inferred, and from the arrival timestamp used
  // when the document carries no date at all. Never conflate with
  // created_time / modified_time (Drive filesystem facts) or ingested_at
  // (when WE first saw it) — the four answer different questions.
  { name: "document_date_source", type: "string" },
  { name: "tax_year", type: "number" },
  { name: "related_entity", type: "string" },
  // ---- governance ----
  { name: "classification_status", type: "string" },
  { name: "human_review_status", type: "string" },
  { name: "confidence", type: "number" },
  // ---- provenance: how this row came to say what it says ----
  { name: "source_conversation_id", type: "string" },
  { name: "source_approval_id", type: "string" },
  { name: "source_swarm_run_id", type: "string" },
  { name: "classified_by", type: "string" },
];

export type RegistryRow = Record<string, string | number | null>;

/** Comma-joined list, or null. Keeps the dataset engine on scalar columns. */
function listToText(v: unknown): string | null {
  if (Array.isArray(v)) {
    const parts = v.map((x) => String(x).trim()).filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  }
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Year from an ISO-ish date, used as the tax-year default for now. */
function yearOf(v: unknown): number | null {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}

/**
 * Build a registry row.
 *
 * IDENTITY SAFETY: every identity field is read from `envelope` — the
 * deterministic n8n intake payload — and never from `proposal`, which is model
 * output. The classification fields are the only ones the model gets to fill.
 * This mirrors the guarantee already enforced for approval payloads.
 */
export function buildRegistryRow(args: {
  envelope: Record<string, unknown>;
  proposal: Record<string, unknown>;
  humanReviewStatus: "pending" | "approved" | "rejected" | "clarifying";
  classificationStatus?: string;
  /**
   * Outcome of domain resolution, when it ran. Passed in rather than resolved
   * here so this function stays synchronous and pure — resolution needs the
   * database and an embedding call, and a row builder should not own either.
   * Absent resolution simply leaves the domain as an unbound display string.
   */
  domain?: {
    domainId: string;
    canonicalName: string;
    status: string;
    proposedName: string;
  } | null;
  provenance?: {
    conversation_id?: string | null;
    approval_id?: string | null;
    swarm_run_id?: string | null;
    classified_by?: string | null;
  };
}): RegistryRow {
  const { envelope: e, proposal: p, provenance: prov } = args;
  const parents = e.parent_folders;
  const now = new Date().toISOString();

  // Deterministic naming. The model supplies WHICH date is authoritative; the
  // string itself is assembled in code so the convention holds identically for
  // every agent, including ones that ignore the skill.
  const originalFilename = str(e.source_filename) ?? str(e.filename) ?? "";
  const naming = buildCanonicalFilename({
    originalFilename,
    documentDate: p.document_date,
    documentDateSource: p.document_date_source,
    // Arrival is the fallback of last resort: the moment the document entered
    // intake. `created_time` is Drive's, which for an uploaded scan is close
    // enough to arrival to be the best available proxy.
    arrivalDate: e.ingested_at ?? e.arrival_date ?? e.created_time,
  });

  return {
    // identity — envelope only
    document_id: str(e.document_id),
    drive_file_id: str(e.drive_file_id),
    drive_url: str(e.drive_url),
    content_hash: str(e.content_hash),
    filename: str(e.source_filename) ?? str(e.filename),
    original_filename: naming.originalFilename || null,
    canonical_filename: naming.canonicalFilename || null,
    filename_change_required: naming.wouldRename ? "yes" : "no",
    mime_type: str(e.mime_type),
    file_size: num(e.file_size),
    current_parent_folder_id: Array.isArray(parents) ? (str(parents[0]) ?? null) : str(parents),
    // The document has NOT been moved — no Drive mutation is enabled — so its
    // current path is still the inbox. The agreed destination is recorded
    // separately as an intent, which is what a later filing step would consume.
    current_path: str(e.current_path) ?? str(e.source) ?? null,
    proposed_path: str(p.proposed_folder_path),
    created_time: str(e.created_time),
    modified_time: str(e.modified_time),
    ingested_at: now,
    last_verified_at: now,
    // classification — model output, reviewed by a human
    document_type: str(p.document_type),
    document_family: str(p.document_family),
    primary_domain_id: args.domain?.domainId ?? null,
    // Prefer the canonical name over the model's wording, so the registry
    // reads consistently even when the model drifted. The drift itself is
    // preserved next to it rather than discarded.
    primary_domain: args.domain?.canonicalName ?? str(p.primary_domain),
    primary_domain_status: args.domain?.status ?? null,
    proposed_domain_name:
      args.domain && args.domain.proposedName !== args.domain.canonicalName
        ? args.domain.proposedName
        : null,
    primary_context: str(p.primary_context),
    organization: str(p.sender_or_issuer) ?? str(p.organization),
    topics: listToText(p.topics) ?? listToText(p.important_entities),
    para_class: str(p.para_class) ?? str(p.proposed_container),
    document_date: naming.documentDate,
    document_date_source: naming.documentDateSource,
    tax_year: num(p.tax_year) ?? yearOf(naming.documentDate),
    related_entity: str(p.related_entity),
    // governance
    classification_status: args.classificationStatus ?? "classified",
    human_review_status: args.humanReviewStatus,
    confidence: num(p.confidence),
    // provenance
    source_conversation_id: prov?.conversation_id ?? null,
    source_approval_id: prov?.approval_id ?? null,
    source_swarm_run_id: prov?.swarm_run_id ?? null,
    classified_by: prov?.classified_by ?? null,
  };
}

/**
 * Ensure the dataset exists and return its id.
 *
 * Uses the same `user_data_tables` shape the CSV upload and the prep flows
 * produce, so the registry is indistinguishable from any other native dataset
 * to every consumer downstream.
 */
export async function ensureRegistryDataset(
  sb: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: existing } = await sb
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", REGISTRY_DATASET)
    .maybeSingle();
  if (existing?.id) {
    // Keep the declared schema current when columns are added.
    await sb
      .from("user_data_tables")
      .update({ columns: REGISTRY_COLUMNS as unknown as Json })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: created, error } = await sb
    .from("user_data_tables")
    .insert({
      user_id: userId,
      name: REGISTRY_DATASET,
      source_filename: "aleXation Document Intake",
      columns: REGISTRY_COLUMNS as unknown as Json,
      is_sample: false,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Could not create the registry dataset");
  return created.id;
}

/**
 * Insert or update one document.
 *
 * Upsert semantics keyed on `document_id`, which the native dataset store does
 * not provide: `materialisePrepOutput` replaces a dataset wholesale because it
 * exists for scheduled rebuilds. A registry accumulates one document at a time,
 * so the row is located and replaced individually here. That difference is the
 * entire reason this function exists.
 */
export async function upsertRegistryRow(
  sb: SupabaseClient<Database>,
  userId: string,
  row: RegistryRow,
): Promise<{ tableId: string; action: "inserted" | "updated" }> {
  const tableId = await ensureRegistryDataset(sb, userId);
  const docId = row.document_id;

  if (docId) {
    const { data: hit } = await sb
      .from("user_data_rows")
      .select("id, row")
      .eq("table_id", tableId)
      .eq("row->>document_id", String(docId))
      .maybeSingle();
    if (hit?.id) {
      // Preserve first-seen time across re-ingestion: `ingested_at` records
      // when the document entered the registry, not when it was last touched.
      const prev = (hit.row ?? {}) as RegistryRow;
      const merged: RegistryRow = { ...row, ingested_at: prev.ingested_at ?? row.ingested_at };
      await sb
        .from("user_data_rows")
        .update({ row: merged as unknown as Json })
        .eq("id", hit.id);
      return { tableId, action: "updated" };
    }
  }

  await sb.from("user_data_rows").insert({ table_id: tableId, row: row as unknown as Json });
  return { tableId, action: "inserted" };
}

/**
 * Update the review state of an already-registered document.
 *
 * Separate from `upsertRegistryRow` because a decision changes governance
 * fields only — it must never let a later, differently-shaped payload overwrite
 * the identity or classification a human already reviewed.
 */
export async function setReviewStatus(
  sb: SupabaseClient<Database>,
  userId: string,
  documentId: string,
  args: {
    review: "pending" | "approved" | "clarifying" | "rejected" | "manual";
    approvedPath?: string | null;
    conversationId?: string | null;
  },
): Promise<boolean> {
  const { data: table } = await sb
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", REGISTRY_DATASET)
    .maybeSingle();
  if (!table?.id) return false;

  const { data: hit } = await sb
    .from("user_data_rows")
    .select("id, row")
    .eq("table_id", table.id)
    .eq("row->>document_id", documentId)
    .maybeSingle();
  if (!hit?.id) return false;

  const prev = (hit.row ?? {}) as RegistryRow;
  const next: RegistryRow = {
    ...prev,
    human_review_status: args.review,
    last_verified_at: new Date().toISOString(),
  };
  // An approved destination is an intent, not a fact: no Drive mutation is
  // enabled, so the file has not moved. `current_path` therefore stays as it is
  // and only the agreed target is recorded.
  if (args.approvedPath) next.proposed_path = args.approvedPath;
  if (args.conversationId) next.source_conversation_id = args.conversationId;

  await sb
    .from("user_data_rows")
    .update({ row: next as unknown as Json })
    .eq("id", hit.id);
  return true;
}
