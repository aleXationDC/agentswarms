import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

const DOCUMENTS_DATASET_NAME = "axtn_documents";

export type WorkbenchDocument = {
  id: string;
  name: string;
  type: string | null;
  sourceUrl: string | null;
  updatedAt: string | null;
  metadata: Record<string, unknown>;
};

function readString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function parseDocument(row: Record<string, unknown>, fallbackId: string): WorkbenchDocument {
  return {
    id: readString(row, "id") ?? readString(row, "document_id") ?? fallbackId,
    name: readString(row, "name") ?? readString(row, "filename") ?? "Untitled document",
    type: readString(row, "type") ?? readString(row, "document_type"),
    sourceUrl: readString(row, "source_url") ?? readString(row, "url"),
    updatedAt: readString(row, "updated_at") ?? readString(row, "modified_at"),
    metadata: row,
  };
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
    .eq("table_id", dataset.id)
    .order("created_at", { ascending: false });
  if (rowsError) throw rowsError;

  return (rows ?? []).map((row) =>
    parseDocument(
      typeof row.row === "object" && row.row !== null ? (row.row as Record<string, unknown>) : {},
      String(row.id),
    ),
  );
}
