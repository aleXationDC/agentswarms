// Documents Workbench — lifetime canonical inventory, detail, correction & preview.
//
// Operates over the native `document_registry` dataset stored in `user_data_tables`
// and `user_data_rows`. No secondary database or search store.
//
// DMS-D1-0005-DOCUMENTS-v2 §10 - §13
import type { SupabaseClient } from "@supabase/supabase-js";
import { REGISTRY_DATASET, type RegistryRow } from "@/lib/documentRegistry";
import { buildCanonicalFilename } from "@/lib/canonicalFilename";
import { CANONICAL_PARA_ROOTS, validateParaFolderPath } from "@/lib/reviewWorkbench";

export type DocumentListItem = {
  documentId: string;
  driveFileId: string | null;
  driveUrl: string | null;
  canonicalFilename: string | null;
  originalFilename: string | null;
  documentType: string | null;
  documentFamily: string | null;
  organization: string | null;
  primaryDomain: string | null;
  documentDate: string | null;
  documentDateSource: string | null;
  currentPath: string | null;
  proposedPath: string | null;
  paraClass: string | null;
  status: string | null;
  confidence: number | null;
  ingestedAt: string | null;
  modifiedTime: string | null;
  topics: string | null;
  fileSize: number | null;
  mimeType: string | null;
  contentHash: string | null;
  privacyClass: string | null;
};

export type DocumentFilterOptions = {
  search?: string;
  documentType?: string;
  documentFamily?: string;
  organization?: string;
  primaryDomain?: string;
  paraClass?: string;
  status?: string;
  year?: string;
  sortBy?: "document_date" | "canonical_filename" | "organization" | "document_type" | "ingested_at";
  sortOrder?: "asc" | "desc";
};

export type DocumentDetail = {
  document: DocumentListItem;
  history: Array<{
    id: string;
    action_title: string;
    status: string;
    created_at: string;
  }>;
  relatedMail: Array<{
    mailId: string;
    subject: string;
    from: string;
    date: string;
  }>;
};

export type ImpactPreview = {
  actionType: "metadata_only" | "rename" | "move" | "rename_and_move";
  currentFilename: string;
  targetFilename: string;
  currentPath: string;
  targetPath: string;
  hasFilenameChange: boolean;
  hasPathChange: boolean;
};

export type DocumentCorrectionEdits = {
  document_type?: string;
  document_family?: string;
  organization?: string;
  primary_domain?: string;
  document_date?: string;
  document_date_source?: string;
  proposed_path?: string;
  canonical_filename?: string;
  topics?: string;
  summary?: string;
};

/**
 * Fetch documents inventory from document_registry with search, filter, and sort.
 */
export async function fetchDocumentsInventory(
  sb: SupabaseClient,
  userId: string,
  filters: DocumentFilterOptions = {},
): Promise<{ items: DocumentListItem[]; totalCount: number; error?: string }> {
  try {
    const { data: table } = await sb
      .from("user_data_tables")
      .select("id")
      .eq("user_id", userId)
      .eq("name", REGISTRY_DATASET)
      .maybeSingle();

    if (!table?.id) {
      return { items: [], totalCount: 0 };
    }

    const { data: rows, error } = await sb
      .from("user_data_rows")
      .select("row")
      .eq("table_id", table.id)
      .limit(2000);

    if (error) {
      return { items: [], totalCount: 0, error: error.message };
    }

    let items: DocumentListItem[] = (rows ?? []).map((r) => {
      const row = (r.row ?? {}) as RegistryRow;
      const driveFileId = row.drive_file_id ? String(row.drive_file_id) : null;
      const driveUrl = row.drive_url
        ? String(row.drive_url)
        : driveFileId
          ? `https://drive.google.com/file/d/${driveFileId}/view`
          : null;

      return {
        documentId: String(row.document_id ?? ""),
        driveFileId,
        driveUrl,
        canonicalFilename: row.canonical_filename ? String(row.canonical_filename) : null,
        originalFilename: row.original_filename ? String(row.original_filename) : (row.filename ? String(row.filename) : null),
        documentType: row.document_type ? String(row.document_type) : null,
        documentFamily: row.document_family ? String(row.document_family) : null,
        organization: row.organization ? String(row.organization) : null,
        primaryDomain: row.primary_domain ? String(row.primary_domain) : null,
        documentDate: row.document_date ? String(row.document_date) : null,
        documentDateSource: row.document_date_source ? String(row.document_date_source) : null,
        currentPath: row.current_path ? String(row.current_path) : null,
        proposedPath: row.proposed_path ? String(row.proposed_path) : null,
        paraClass: row.para_class ? String(row.para_class) : null,
        status: row.human_review_status ? String(row.human_review_status) : (row.classification_status ? String(row.classification_status) : null),
        confidence: typeof row.confidence === "number" ? row.confidence : null,
        ingestedAt: row.ingested_at ? String(row.ingested_at) : null,
        modifiedTime: row.modified_time ? String(row.modified_time) : null,
        topics: row.topics ? String(row.topics) : null,
        fileSize: typeof row.file_size === "number" ? row.file_size : null,
        mimeType: row.mime_type ? String(row.mime_type) : null,
        contentHash: row.content_hash ? String(row.content_hash) : null,
        privacyClass: row.privacy_class ? String(row.privacy_class) : null,
      };
    });

    // Exclude trashed items from standard inventory list unless explicitly filtered
    if (filters.status !== "trashed") {
      items = items.filter((item) => item.status !== "trashed");
    }

    // Apply filters
    if (filters.search?.trim()) {
      const q = filters.search.trim().toLowerCase();
      items = items.filter((item) => {
        const text = [
          item.canonicalFilename,
          item.originalFilename,
          item.documentType,
          item.documentFamily,
          item.organization,
          item.primaryDomain,
          item.topics,
          item.documentId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return text.includes(q);
      });
    }

    if (filters.documentType) {
      items = items.filter((i) => i.documentType?.toLowerCase() === filters.documentType?.toLowerCase());
    }

    if (filters.documentFamily) {
      items = items.filter((i) => i.documentFamily?.toLowerCase() === filters.documentFamily?.toLowerCase());
    }

    if (filters.organization) {
      items = items.filter((i) => i.organization?.toLowerCase() === filters.organization?.toLowerCase());
    }

    if (filters.primaryDomain) {
      items = items.filter((i) => i.primaryDomain?.toLowerCase() === filters.primaryDomain?.toLowerCase());
    }

    if (filters.paraClass) {
      items = items.filter((i) => {
        const path = i.proposedPath || i.currentPath || "";
        return i.paraClass?.toLowerCase() === filters.paraClass?.toLowerCase() ||
          path.toLowerCase().startsWith(filters.paraClass!.toLowerCase());
      });
    }

    if (filters.status) {
      items = items.filter((i) => i.status?.toLowerCase() === filters.status?.toLowerCase());
    }

    if (filters.year) {
      items = items.filter((i) => i.documentDate?.startsWith(filters.year!));
    }

    // Sorting
    const sortBy = filters.sortBy || "document_date";
    const sortOrder = filters.sortOrder || "desc";
    const mult = sortOrder === "desc" ? -1 : 1;

    items.sort((a, b) => {
      let valA: string | number = "";
      let valB: string | number = "";
      if (sortBy === "document_date") {
        valA = a.documentDate || a.ingestedAt || "";
        valB = b.documentDate || b.ingestedAt || "";
      } else if (sortBy === "canonical_filename") {
        valA = a.canonicalFilename || a.originalFilename || "";
        valB = b.canonicalFilename || b.originalFilename || "";
      } else if (sortBy === "organization") {
        valA = a.organization || "";
        valB = b.organization || "";
      } else if (sortBy === "document_type") {
        valA = a.documentType || "";
        valB = b.documentType || "";
      } else if (sortBy === "ingested_at") {
        valA = a.ingestedAt || "";
        valB = b.ingestedAt || "";
      }
      if (valA < valB) return -1 * mult;
      if (valA > valB) return 1 * mult;
      return 0;
    });

    return { items, totalCount: items.length };
  } catch (e) {
    return { items: [], totalCount: 0, error: (e as Error).message };
  }
}

/**
 * Fetch a single canonical document detail.
 */
export async function fetchDocumentDetail(
  sb: SupabaseClient,
  userId: string,
  documentId: string,
): Promise<{ detail: DocumentDetail | null; error?: string }> {
  try {
    const { items, error } = await fetchDocumentsInventory(sb, userId, {});
    if (error) return { detail: null, error };

    const doc = items.find((i) => i.documentId === documentId);
    if (!doc) return { detail: null, error: "Document not found" };

    // Fetch approval history if attached
    const { data: approvals } = await sb
      .from("approvals")
      .select("id, action_title, status, created_at")
      .eq("user_id", userId)
      .eq("payload->proposal->>document_id", documentId)
      .order("created_at", { ascending: false });

    return {
      detail: {
        document: doc,
        history: approvals ?? [],
        relatedMail: [],
      },
    };
  } catch (e) {
    return { detail: null, error: (e as Error).message };
  }
}

/**
 * Preview consequences of editing a document's filename or PARA folder path.
 */
export function previewDocumentImpact(
  current: DocumentListItem,
  edits: DocumentCorrectionEdits,
): ImpactPreview {
  const currentFilename = current.canonicalFilename || current.originalFilename || "document.pdf";
  const currentPath = current.currentPath || current.proposedPath || "04_Archive";

  let targetFilename = currentFilename;
  if (edits.canonical_filename?.trim()) {
    targetFilename = edits.canonical_filename.trim();
  } else if (edits.document_date && edits.document_date !== current.documentDate) {
    const built = buildCanonicalFilename({
      originalFilename: current.originalFilename || currentFilename,
      documentDate: edits.document_date,
      documentDateSource: edits.document_date_source || current.documentDateSource || "explicit_document",
    });
    if (built.canonicalFilename) targetFilename = built.canonicalFilename;
  }

  let targetPath = currentPath;
  if (edits.proposed_path?.trim()) {
    const validated = validateParaFolderPath(edits.proposed_path);
    if (validated.valid && validated.cleanPath) {
      targetPath = validated.cleanPath;
    }
  }

  const hasFilenameChange = targetFilename !== currentFilename;
  const hasPathChange = targetPath !== currentPath;

  let actionType: ImpactPreview["actionType"] = "metadata_only";
  if (hasFilenameChange && hasPathChange) actionType = "rename_and_move";
  else if (hasFilenameChange) actionType = "rename";
  else if (hasPathChange) actionType = "move";

  return {
    actionType,
    currentFilename,
    targetFilename,
    currentPath,
    targetPath,
    hasFilenameChange,
    hasPathChange,
  };
}

/**
 * Apply direct Human Correction to a canonical document (zero LLM calls).
 */
export async function applyDocumentCorrection(
  sb: SupabaseClient,
  userId: string,
  documentId: string,
  edits: DocumentCorrectionEdits,
): Promise<{ ok: boolean; error?: string; preview?: ImpactPreview }> {
  try {
    const { data: table } = await sb
      .from("user_data_tables")
      .select("id")
      .eq("user_id", userId)
      .eq("name", REGISTRY_DATASET)
      .maybeSingle();

    if (!table?.id) return { ok: false, error: "Registry dataset not found" };

    const { data: hit } = await sb
      .from("user_data_rows")
      .select("id, row")
      .eq("table_id", table.id)
      .eq("row->>document_id", documentId)
      .maybeSingle();

    if (!hit?.id) return { ok: false, error: "Document row not found in registry" };

    const current = (hit.row ?? {}) as RegistryRow;
    const docItem: DocumentListItem = {
      documentId,
      driveFileId: current.drive_file_id ? String(current.drive_file_id) : null,
      driveUrl: current.drive_url ? String(current.drive_url) : null,
      canonicalFilename: current.canonical_filename ? String(current.canonical_filename) : null,
      originalFilename: current.original_filename ? String(current.original_filename) : null,
      documentType: current.document_type ? String(current.document_type) : null,
      documentFamily: current.document_family ? String(current.document_family) : null,
      organization: current.organization ? String(current.organization) : null,
      primaryDomain: current.primary_domain ? String(current.primary_domain) : null,
      documentDate: current.document_date ? String(current.document_date) : null,
      documentDateSource: current.document_date_source ? String(current.document_date_source) : null,
      currentPath: current.current_path ? String(current.current_path) : null,
      proposedPath: current.proposed_path ? String(current.proposed_path) : null,
      paraClass: current.para_class ? String(current.para_class) : null,
      status: current.human_review_status ? String(current.human_review_status) : null,
      confidence: typeof current.confidence === "number" ? current.confidence : null,
      ingestedAt: current.ingested_at ? String(current.ingested_at) : null,
      modifiedTime: current.modified_time ? String(current.modified_time) : null,
      topics: current.topics ? String(current.topics) : null,
      fileSize: typeof current.file_size === "number" ? current.file_size : null,
      mimeType: current.mime_type ? String(current.mime_type) : null,
      contentHash: current.content_hash ? String(current.content_hash) : null,
      privacyClass: current.privacy_class ? String(current.privacy_class) : null,
    };

    const preview = previewDocumentImpact(docItem, edits);

    const updatedRow: RegistryRow = {
      ...current,
      document_type: edits.document_type !== undefined ? edits.document_type : current.document_type,
      document_family: edits.document_family !== undefined ? edits.document_family : current.document_family,
      organization: edits.organization !== undefined ? edits.organization : current.organization,
      primary_domain: edits.primary_domain !== undefined ? edits.primary_domain : current.primary_domain,
      document_date: edits.document_date !== undefined ? edits.document_date : current.document_date,
      document_date_source: edits.document_date_source !== undefined ? edits.document_date_source : current.document_date_source,
      canonical_filename: preview.targetFilename,
      proposed_path: preview.targetPath,
      topics: edits.topics !== undefined ? edits.topics : current.topics,
      last_verified_at: new Date().toISOString(),
    };

    await sb
      .from("user_data_rows")
      .update({ row: updatedRow as any })
      .eq("id", hit.id);

    return { ok: true, preview };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Move a canonical document to reversible Trash (DMS-D1-0005 §13).
 */
export async function moveDocumentToTrash(
  sb: SupabaseClient,
  userId: string,
  documentId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: table } = await sb
      .from("user_data_tables")
      .select("id")
      .eq("user_id", userId)
      .eq("name", REGISTRY_DATASET)
      .maybeSingle();

    if (!table?.id) return { ok: false, error: "Registry dataset not found" };

    const { data: hit } = await sb
      .from("user_data_rows")
      .select("id, row")
      .eq("table_id", table.id)
      .eq("row->>document_id", documentId)
      .maybeSingle();

    if (!hit?.id) return { ok: false, error: "Document not found" };

    const current = (hit.row ?? {}) as RegistryRow;
    const trashedRow: RegistryRow = {
      ...current,
      human_review_status: "trashed",
      classification_status: "trashed",
      last_verified_at: new Date().toISOString(),
    };

    await sb
      .from("user_data_rows")
      .update({ row: trashedRow as any })
      .eq("id", hit.id);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
