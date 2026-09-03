import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

// The canonical registered-document lifecycle backbone. Intake writes here, so
// this is the only source that can show a document from REGISTERED onward.
const DOCUMENTS_DATASET_NAME = "axtn_document_registry";

// Rows the registry uses to declare its own shape rather than to describe a
// document. They are never documents and must never reach the inventory.
const NON_DOCUMENT_RECORD_KINDS = new Set(["schema_seed", "seed", "system"]);

export type WorkbenchDocument = {
  id: string;
  rowId: string;
  canonicalFilename: string | null;
  originalFilename: string | null;
  documentType: string | null;
  documentFamily: string | null;
  organization: string | null;
  primaryDomain: string | null;
  documentDate: string | null;
  currentPath: string | null;
  proposedPath: string | null;
  paraClass: string | null;
  status: string | null;
  confidence: number | null;
  topics: string | null;
  sourceUrl: string | null;
  mimeType: string | null;
  fileSize: number | null;
  modifiedAt: string | null;
  ingestedAt: string | null;
  privacyClass: string | null;
  displayName: string;
  recordKind: string | null;
  sourceType: string | null;
  sourceRef: string | null;
  providerFileId: string | null;
  contentHash: string | null;
  hashAlgorithm: string | null;
  processingStatus: string | null;
  extractionStatus: string | null;
  schemaVersion: string | null;
  sourceSwarmRunId: string | null;
  sourceApprovalId: string | null;
  metadata: Record<string, unknown>;
};

export type DocumentFilters = {
  search?: string;
  documentType?: string;
  primaryDomain?: string;
  paraClass?: string;
  status?: string;
  sort?: "document-date" | "name" | "organization" | "updated";
};

function readString(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function readNumber(row: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

/**
 * Drive intake records provenance as a source reference such as
 * "drive:<fileId>" and a document id such as "google_drive:drive:<fileId>".
 * When the dedicated provider column is not populated, read the identifier back
 * out of those existing values instead of leaving the field unresolved. This
 * parses what the registry already stores; it never invents an identifier.
 */
function readProviderFileId(row: Record<string, unknown>): string | null {
  const explicit = readString(row, "drive_file_id", "provider_file_id", "provider_message_id");
  if (explicit) return explicit;
  const reference = readString(row, "source_ref", "document_id");
  if (!reference) return null;
  const tail = reference.split(":").pop();
  return tail && tail !== reference ? tail : null;
}

/**
 * A registry row describes a real document only when it is a document record
 * that carries a document identity. Seed and system rows are excluded.
 */
export function isRegisteredDocumentRow(row: Record<string, unknown>): boolean {
  const recordKind = readString(row, "record_kind");
  if (recordKind && NON_DOCUMENT_RECORD_KINDS.has(recordKind)) return false;
  for (const key of ["source_type", "processing_status", "artifact_type", "privacy_status"]) {
    const value = row[key];
    if (typeof value === "string" && NON_DOCUMENT_RECORD_KINDS.has(value)) return false;
  }
  return Boolean(readString(row, "document_id"));
}

export function normalizeWorkbenchDocument(
  row: Record<string, unknown>,
  fallbackId: string,
): WorkbenchDocument {
  return {
    id: readString(row, "id", "document_id") ?? fallbackId,
    rowId: fallbackId,
    canonicalFilename: readString(row, "canonical_filename", "canonicalFilename", "name"),
    originalFilename: readString(row, "original_filename", "originalFilename", "filename"),
    documentType: readString(row, "document_type", "documentType", "type"),
    documentFamily: readString(row, "document_family", "documentFamily", "family"),
    organization: readString(row, "organization", "issuer", "sender_or_issuer"),
    primaryDomain: readString(row, "primary_domain", "primaryDomain", "domain"),
    documentDate: readString(row, "document_date", "documentDate", "date"),
    currentPath: readString(row, "current_path", "currentPath"),
    proposedPath: readString(row, "proposed_path", "proposedPath"),
    paraClass: readString(row, "para_class", "paraClass"),
    status: readString(row, "status", "review_status", "human_review_status"),
    confidence: readNumber(row, "confidence", "classification_confidence"),
    topics: readString(row, "topics"),
    sourceUrl: readString(row, "source_url", "sourceUrl", "drive_url", "url"),
    mimeType: readString(row, "mime_type", "mimeType"),
    fileSize: readNumber(row, "file_size", "fileSize", "size"),
    modifiedAt: readString(row, "modified_time", "modified_at", "updated_at"),
    ingestedAt: readString(row, "ingested_at", "created_at"),
    privacyClass: readString(row, "privacy_class", "privacyClass", "privacy_status"),
    displayName:
      readString(row, "canonical_filename", "canonicalFilename") ??
      readString(row, "original_filename", "originalFilename") ??
      readString(row, "current_filename") ??
      readProviderFileId(row) ??
      readString(row, "document_id") ??
      fallbackId,
    recordKind: readString(row, "record_kind"),
    sourceType: readString(row, "source_type", "provider_type"),
    sourceRef: readString(row, "source_ref"),
    providerFileId: readProviderFileId(row),
    contentHash: readString(row, "content_hash", "original_sha256", "sha256"),
    hashAlgorithm: readString(row, "hash_algorithm"),
    processingStatus: readString(row, "processing_status"),
    extractionStatus: readString(row, "extraction_status"),
    schemaVersion: readString(row, "schema_version"),
    sourceSwarmRunId: readString(row, "source_swarm_run_id"),
    sourceApprovalId: readString(row, "source_approval_id"),
    metadata: row,
  };
}

export function filterAndSortWorkbenchDocuments(
  documents: WorkbenchDocument[],
  filters: DocumentFilters,
): WorkbenchDocument[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  const result = documents.filter((document) => {
    const content = [
      document.canonicalFilename,
      document.originalFilename,
      document.documentType,
      document.documentFamily,
      document.organization,
      document.primaryDomain,
      document.topics,
      document.id,
      document.sourceType,
      document.providerFileId,
      document.processingStatus,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (
      (!search || content.includes(search)) &&
      (!filters.documentType || document.documentType === filters.documentType) &&
      (!filters.primaryDomain || document.primaryDomain === filters.primaryDomain) &&
      (!filters.paraClass || document.paraClass === filters.paraClass) &&
      (!filters.status || document.status === filters.status)
    );
  });

  return result.sort((left, right) => {
    const field =
      filters.sort === "name"
        ? "canonicalFilename"
        : filters.sort === "organization"
          ? "organization"
          : filters.sort === "updated"
            ? "modifiedAt"
            : "documentDate";
    const comparison = (left[field] ?? "").localeCompare(right[field] ?? "");
    return filters.sort === "name" || filters.sort === "organization" ? comparison : -comparison;
  });
}

export async function listWorkbenchDocuments(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<WorkbenchDocument[]> {
  const { data: dataset, error: datasetError } = await supabase
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", DOCUMENTS_DATASET_NAME)
    .maybeSingle();
  if (datasetError) throw datasetError;
  if (!dataset) return [];

  const { data: rows, error: rowsError } = await supabase
    .from("user_data_rows")
    .select("id, row")
    .eq("table_id", dataset.id);
  if (rowsError) throw rowsError;

  return (rows ?? [])
    .map((row) => ({
      fields:
        typeof row.row === "object" && row.row !== null ? (row.row as Record<string, unknown>) : {},
      rowId: String(row.id),
    }))
    .filter((entry) => isRegisteredDocumentRow(entry.fields))
    .map((entry) => normalizeWorkbenchDocument(entry.fields, entry.rowId));
}

/**
 * Resolves a single registered document by its canonical `document_id`.
 *
 * Read-only, and deliberately reusing the same dataset binding, RLS path and
 * normalisation as the inventory: a Review that resolved documents through a
 * second query shape could disagree with what /documents shows for the same
 * row. Returns null when the identity has no registry row, which is a normal
 * state (for example a registration whose write did not happen) and must not
 * be presented as missing data on the approval itself.
 */
export async function findWorkbenchDocumentByDocumentId(
  supabase: SupabaseClient<Database>,
  userId: string,
  documentId: string,
): Promise<WorkbenchDocument | null> {
  if (!documentId.trim()) return null;
  const documents = await listWorkbenchDocuments(supabase, userId);
  return documents.find((document) => document.id === documentId) ?? null;
}
