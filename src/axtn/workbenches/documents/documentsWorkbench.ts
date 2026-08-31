import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

const DOCUMENTS_DATASET_NAME = "axtn_documents";

export type WorkbenchDocument = {
  id: string;
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

export function normalizeWorkbenchDocument(
  row: Record<string, unknown>,
  fallbackId: string,
): WorkbenchDocument {
  return {
    id: readString(row, "id", "document_id") ?? fallbackId,
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
    privacyClass: readString(row, "privacy_class", "privacyClass"),
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

  return (rows ?? []).map((row) =>
    normalizeWorkbenchDocument(
      typeof row.row === "object" && row.row !== null ? (row.row as Record<string, unknown>) : {},
      String(row.id),
    ),
  );
}
