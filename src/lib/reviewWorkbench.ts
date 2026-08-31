// Review Workbench — a thin composition layer over CANONICAL objects.
//
// This file adds no state of its own. It reads and groups rows already held
// in `approvals`, `clarification_cases` (src/lib/clarificationLoop.ts) and the
// `document_registry` dataset (src/lib/documentRegistry.ts), so the Review
// Workbench (/review, /review/$approvalId) can render one coherent "review
// item" per document instead of the raw approval-cycle rows those tables
// store individually.
//
// WHY GROUPING IS NECESSARY
// A single document can produce many `approvals` rows over its lifetime: one
// per proposal cycle, plus separate side-approvals such as a domain-promotion
// question (see clarification_cases.proposals in the migration comments). A
// practical queue must show ONE row per document reflecting its CURRENT
// state, not one row per historical approval. Grouping key is the document
// identity derived the same way `clarificationLoop.subjectKeyFromEnvelope`
// derives it — reused here, not reimplemented.
//
// WHAT THIS FILE DOES NOT DO
// It does not decide anything, does not write `approvals` or
// `clarification_cases`, and does not talk to Drive or a swarm run directly.
// Decisions remain in swarmResume.functions.ts / clarification.functions.ts /
// domainGovernance.functions.ts, invoked through useApprovalActions.
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  subjectKeyFromEnvelope,
  findCaseForApproval,
  type ClarificationCase,
} from "@/lib/clarificationLoop";
import { REGISTRY_DATASET, type RegistryRow } from "@/lib/documentRegistry";
import { MAIL_REGISTRY_DATASET, type MailRegistryRow } from "@/lib/mailRegistry";
import { buildCanonicalFilename } from "@/lib/canonicalFilename";

export const CANONICAL_PARA_ROOTS = [
  "01_Projects",
  "02_Areas",
  "03_Resources",
  "04_Archive",
] as const;

export const EDITABLE_PROPOSAL_FIELDS = new Set([
  "document_type",
  "document_family",
  "primary_domain",
  "sender_or_issuer",
  "organization_id",
  "document_date",
  "document_date_source",
  "proposed_folder_path",
  "proposed_folder_id",
  "canonical_filename",
  "topics",
  "summary",
  "duplicate_decision",
  "target_canonical_document_id",
]);

export const IMMUTABLE_IDENTITY_FIELDS = new Set([
  "document_id",
  "mail_id",
  "drive_file_id",
  "drive_eml_file_id",
  "content_hash",
  "raw_sha256",
  "mime_type",
  "original_filename",
  "file_size",
  "source_mailbox_path",
  "provider_message_id",
  "provider_type",
]);

/**
 * Validate that a relative folder path resides under one of the 4 canonical PARA roots.
 * Rejects 00_Inbox, empty strings, and foreign paths.
 */
export function validateParaFolderPath(folderPath: unknown): { valid: boolean; error?: string; cleanPath?: string } {
  if (typeof folderPath !== "string" || !folderPath.trim()) {
    return { valid: false, error: "Target folder path is required" };
  }
  const clean = folderPath.trim().replace(/^\/+|\/+$/g, "");
  const root = clean.split("/")[0];
  if (!CANONICAL_PARA_ROOTS.includes(root as any)) {
    return {
      valid: false,
      error: `Folder path root "${root}" is not allowed. Must start with one of: ${CANONICAL_PARA_ROOTS.join(", ")}`,
    };
  }
  return { valid: true, cleanPath: clean };
}

export type ProposalOverrideEdits = {
  document_type?: string;
  document_family?: string;
  primary_domain?: string;
  sender_or_issuer?: string;
  organization_id?: string;
  document_date?: string;
  document_date_source?: string;
  proposed_folder_path?: string;
  proposed_folder_id?: string;
  canonical_filename?: string;
  topics?: string[];
  summary?: string;
  duplicate_decision?: "separate" | "duplicate" | "new_version" | "related_successor";
  target_canonical_document_id?: string;
  [key: string]: unknown;
};

export type BulkFieldApply<T> = {
  apply: boolean;
  value: T;
};

export type BulkTopicsApply = {
  apply: boolean;
  mode: "add" | "remove" | "replace";
  values: string[];
};

export type BulkProposalOverridePatch = {
  document_type?: BulkFieldApply<string>;
  document_family?: BulkFieldApply<string>;
  sender_or_issuer?: BulkFieldApply<string>;
  organization_id?: BulkFieldApply<string>;
  primary_domain?: BulkFieldApply<string>;
  document_date?: BulkFieldApply<string>;
  proposed_folder_path?: BulkFieldApply<string>;
  proposed_folder_id?: BulkFieldApply<string>;
  topics?: BulkTopicsApply;
  summary?: BulkFieldApply<string>;
  [key: string]: unknown;
};

export type BulkFieldAnalysis = {
  fieldName: string;
  isMixed: boolean;
  commonValue?: string;
  uniqueValues: string[];
  totalCount: number;
};

/**
 * Analyze field values across multiple proposal items to detect uniform vs mixed values (DMS-D1-0003-REVIEW-v2 §14.3).
 */
export function analyzeBulkFieldValues(
  items: Array<{ approval: { payload: unknown } }>,
): Record<string, BulkFieldAnalysis> {
  const fields = [
    "document_type",
    "document_family",
    "sender_or_issuer",
    "primary_domain",
    "document_date",
    "proposed_folder_path",
    "summary",
  ];

  const result: Record<string, BulkFieldAnalysis> = {};

  for (const field of fields) {
    const rawValues = items.map((item) => {
      const p = ((item.approval?.payload as any)?.proposal ?? {}) as Record<string, any>;
      const val = p[field];
      return val != null && val !== "" ? String(val) : "";
    });

    const uniqueSet = new Set(rawValues.filter(Boolean));
    const uniqueValues = Array.from(uniqueSet);
    const isMixed = uniqueValues.length > 1;
    const commonValue = uniqueValues.length === 1 ? uniqueValues[0] : undefined;

    result[field] = {
      fieldName: field,
      isMixed,
      commonValue,
      uniqueValues,
      totalCount: items.length,
    };
  }

  // Topics analysis
  const allTopicSets = items.map((item) => {
    const p = ((item.approval?.payload as any)?.proposal ?? {}) as Record<string, any>;
    const t = Array.isArray(p.topics) ? p.topics.map(String).sort().join(",") : "";
    return t;
  });
  const uniqueTopicSets = Array.from(new Set(allTopicSets.filter(Boolean)));
  result["topics"] = {
    fieldName: "topics",
    isMixed: uniqueTopicSets.length > 1,
    commonValue: uniqueTopicSets.length === 1 ? uniqueTopicSets[0] : undefined,
    uniqueValues: uniqueTopicSets,
    totalCount: items.length,
  };

  return result;
}

/**
 * Apply Bulk Human Override to multiple native approval proposals (DMS-D1-0003-REVIEW-v2 §14).
 * - Full pre-validation of all targets before any persistence (no silent partial updates).
 * - Zero LLM calls for direct bulk edit.
 * - Rejects any immutable identity fields.
 * - Respects explicit apply / not-apply flags per field.
 * - Supports Topics add / remove / replace.
 * - Recomputes canonical filenames and records Human Override provenance per proposal.
 */
export async function applyBulkProposalOverride(
  sb: SupabaseClient,
  userId: string,
  approvalIds: string[],
  patch: BulkProposalOverridePatch,
): Promise<{ ok: boolean; error?: string; count?: number; invalidId?: string }> {
  if (!approvalIds || approvalIds.length === 0) {
    return { ok: false, error: "No approvals selected for bulk edit" };
  }

  // Check for immutable field modification attempts in patch keys
  for (const key of Object.keys(patch)) {
    if (IMMUTABLE_IDENTITY_FIELDS.has(key)) {
      return {
        ok: false,
        error: `Field "${key}" is an immutable identity/source field and cannot be modified by bulk override.`,
      };
    }
  }

  // Fetch all target approvals
  const { data: approvals, error: fetchErr } = await sb
    .from("approvals")
    .select("*")
    .in("id", approvalIds)
    .eq("user_id", userId);

  if (fetchErr || !approvals) {
    return { ok: false, error: fetchErr?.message || "Failed to fetch approvals" };
  }

  if (approvals.length !== approvalIds.length) {
    return {
      ok: false,
      error: `Could only find ${approvals.length} of ${approvalIds.length} requested approvals.`,
    };
  }

  // Ensure all approvals are in "pending" status
  for (const appr of approvals) {
    if (appr.status !== "pending") {
      return {
        ok: false,
        error: `Item ${appr.id.slice(0, 8)} is in "${appr.status}" state. Only pending items can be bulk-edited.`,
        invalidId: appr.id,
      };
    }
  }

  // Phase 1: In-memory simulation and full-set validation
  const simulatedUpdates: Array<{
    approvalId: string;
    updatedPayload: Record<string, any>;
    updatedProposal: Record<string, any>;
  }> = [];

  for (const appr of approvals) {
    const payload = (appr.payload || {}) as Record<string, any>;
    const currentProposal = (payload.proposal || {}) as Record<string, any>;
    const envelope = (payload.envelope || {}) as Record<string, any>;

    // Folder path validation
    let finalFolderPath = currentProposal.proposed_folder_path || "04_Archive";
    if (patch.proposed_folder_path?.apply) {
      const val = validateParaFolderPath(patch.proposed_folder_path.value);
      if (!val.valid) {
        return {
          ok: false,
          error: `Invalid folder path for item ${appr.id.slice(0, 8)}: ${val.error}`,
          invalidId: appr.id,
        };
      }
      finalFolderPath = val.cleanPath!;
    }

    // Topics computation
    let finalTopics = Array.isArray(currentProposal.topics) ? [...currentProposal.topics] : [];
    if (patch.topics?.apply) {
      const targetValues = patch.topics.values || [];
      if (patch.topics.mode === "replace") {
        finalTopics = [...targetValues];
      } else if (patch.topics.mode === "add") {
        const set = new Set(finalTopics);
        for (const t of targetValues) {
          if (t && t.trim()) set.add(t.trim());
        }
        finalTopics = Array.from(set);
      } else if (patch.topics.mode === "remove") {
        const removeSet = new Set(targetValues.map((t) => t.trim().toLowerCase()));
        finalTopics = finalTopics.filter((t) => !removeSet.has(t.trim().toLowerCase()));
      }
    }

    // Date & Canonical Filename computation
    const originalFilename =
      envelope.source_filename ||
      currentProposal.source_filename ||
      envelope.original_filename ||
      "document.pdf";

    const docDate = patch.document_date?.apply
      ? patch.document_date.value
      : currentProposal.document_date ?? envelope.message_date;

    const docDateSource = patch.document_date?.apply
      ? "explicit_document"
      : currentProposal.document_date_source ?? "explicit_document";

    let canonicalName = currentProposal.canonical_eml_filename || currentProposal.canonical_filename;
    if (patch.document_date?.apply || !canonicalName) {
      const built = buildCanonicalFilename({
        originalFilename,
        documentDate: docDate,
        documentDateSource: docDateSource,
      });
      canonicalName = built.canonicalFilename;
    }

    // Build prospective updated proposal
    const updatedProposal: Record<string, any> = {
      ...currentProposal,
      ...(patch.document_type?.apply ? { document_type: patch.document_type.value } : {}),
      ...(patch.document_family?.apply ? { document_family: patch.document_family.value } : {}),
      ...(patch.sender_or_issuer?.apply ? { sender_or_issuer: patch.sender_or_issuer.value } : {}),
      ...(patch.organization_id?.apply ? { organization_id: patch.organization_id.value } : {}),
      ...(patch.primary_domain?.apply ? { primary_domain: patch.primary_domain.value } : {}),
      ...(patch.proposed_folder_path?.apply ? { proposed_folder_path: finalFolderPath } : {}),
      ...(patch.proposed_folder_id?.apply ? { proposed_folder_id: patch.proposed_folder_id.value } : {}),
      ...(patch.topics?.apply ? { topics: finalTopics } : {}),
      ...(patch.summary?.apply ? { summary: patch.summary.value } : {}),
      document_date: docDate,
      document_date_source: docDateSource,
      canonical_filename: canonicalName,
      human_overridden: true,
      bulk_overridden: true,
      overridden_at: new Date().toISOString(),
    };

    const updatedPayload = {
      ...payload,
      proposal: updatedProposal,
    };

    simulatedUpdates.push({
      approvalId: appr.id,
      updatedPayload,
      updatedProposal,
    });
  }

  // Phase 2: Persistence across all validated targets
  for (const sim of simulatedUpdates) {
    const { error: updateErr } = await sb
      .from("approvals")
      .update({ payload: sim.updatedPayload })
      .eq("id", sim.approvalId)
      .eq("user_id", userId);

    if (updateErr) {
      return {
        ok: false,
        error: `Failed to update approval ${sim.approvalId.slice(0, 8)}: ${updateErr.message}`,
        invalidId: sim.approvalId,
      };
    }

    // Append clarification history if case exists
    const docId = docIdFromPayload(sim.updatedPayload);
    const kase = await findCaseForApproval(sb, userId, sim.approvalId, docId);
    if (kase) {
      const history = Array.isArray(kase.proposals) ? [...kase.proposals] : [];
      history.push({
        cycle: (kase.cycle_count || 1) + 1,
        proposal: sim.updatedProposal,
        approval_id: sim.approvalId,
        decision: null,
        rejection_note: "Bulk Human Override applied",
      });
      await sb
        .from("clarification_cases")
        .update({
          proposals: history,
          cycle_count: (kase.cycle_count || 1) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", kase.id);
    }
  }

  return { ok: true, count: simulatedUpdates.length };
}

/**
 * Apply direct Human Override to the current native approval proposal (DMS-D1-0003-REVIEW §7.7).
 * - Modifies approvals.payload.proposal with zero LLM calls.
 * - Rejects any attempt to mutate immutable identity/source fields.
 * - Validates PARA folder roots and canonical filename.
 * - Preserves prior proposal history in clarification_cases if present.
 */
export async function applyHumanProposalOverride(
  sb: SupabaseClient,
  userId: string,
  approvalId: string,
  edits: ProposalOverrideEdits,
): Promise<{ ok: boolean; error?: string; proposal?: Record<string, unknown> }> {
  // Check for immutable field modification attempts
  for (const key of Object.keys(edits)) {
    if (IMMUTABLE_IDENTITY_FIELDS.has(key)) {
      return {
        ok: false,
        error: `Field "${key}" is an immutable identity/source field and cannot be modified by human override.`,
      };
    }
  }

  // Handle manual document items (no approval row in database)
  if (approvalId.startsWith("manual:")) {
    const docId = approvalId.replace(/^manual:/, "");
    const { data: table } = await sb
      .from("user_data_tables")
      .select("id")
      .eq("user_id", userId)
      .eq("name", REGISTRY_DATASET)
      .maybeSingle();
    if (!table?.id) return { ok: false, error: "Registry table not found" };
    const { data: hit } = await sb
      .from("user_data_rows")
      .select("id, row")
      .eq("table_id", table.id)
      .eq("row->>document_id", docId)
      .maybeSingle();
    if (!hit?.id) return { ok: false, error: "Document not found" };
    const current = (hit.row ?? {}) as RegistryRow;

    let finalFolderPath = edits.proposed_folder_path || current.proposed_path || "04_Archive";
    if (edits.proposed_folder_path) {
      const val = validateParaFolderPath(edits.proposed_folder_path);
      if (!val.valid) return { ok: false, error: val.error };
      finalFolderPath = val.cleanPath!;
    }

    const originalFilename = String(current.original_filename || current.filename || "document.pdf");
    const docDate = edits.document_date ?? (current.document_date ? String(current.document_date) : null);
    const docDateSource = edits.document_date_source ?? (current.document_date_source ? String(current.document_date_source) : "explicit_document");
    let canonicalName = current.canonical_filename ? String(current.canonical_filename) : null;
    if (edits.canonical_filename) {
      const built = buildCanonicalFilename({
        originalFilename: edits.canonical_filename,
        documentDate: docDate,
        documentDateSource: docDateSource,
      });
      canonicalName = built.canonicalFilename;
    } else if (edits.document_date || !canonicalName) {
      const built = buildCanonicalFilename({
        originalFilename,
        documentDate: docDate,
        documentDateSource: docDateSource,
      });
      canonicalName = built.canonicalFilename;
    }

    const updatedRow: RegistryRow = {
      ...current,
      document_type: edits.document_type !== undefined ? edits.document_type : (current.document_type ? String(current.document_type) : null),
      document_family: edits.document_family !== undefined ? edits.document_family : (current.document_family ? String(current.document_family) : null),
      organization: edits.sender_or_issuer !== undefined ? edits.sender_or_issuer : (current.organization ? String(current.organization) : null),
      primary_domain: edits.primary_domain !== undefined ? edits.primary_domain : (current.primary_domain ? String(current.primary_domain) : null),
      document_date: docDate,
      document_date_source: docDateSource,
      canonical_filename: canonicalName,
      proposed_path: finalFolderPath,
      last_verified_at: new Date().toISOString(),
    };

    await sb.from("user_data_rows").update({ row: updatedRow as any }).eq("id", hit.id);
    return { ok: true, proposal: updatedRow as any };
  }

  // Fetch current approval
  const { data: approval, error: fetchErr } = await sb
    .from("approvals")
    .select("*")
    .eq("id", approvalId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr || !approval) {
    return { ok: false, error: fetchErr?.message || "Approval not found" };
  }

  if (approval.status !== "pending") {
    return { ok: false, error: `Cannot override an approval in "${approval.status}" state` };
  }

  const payload = (approval.payload || {}) as Record<string, any>;
  const currentProposal = (payload.proposal || {}) as Record<string, any>;
  const envelope = (payload.envelope || {}) as Record<string, any>;

  // Validate proposed folder path if edited
  let finalFolderPath = currentProposal.proposed_folder_path || "04_Archive";
  if (edits.proposed_folder_path) {
    const val = validateParaFolderPath(edits.proposed_folder_path);
    if (!val.valid) {
      return { ok: false, error: val.error };
    }
    finalFolderPath = val.cleanPath!;
  }

  // Build / validate canonical filename if edited or date changed
  const originalFilename =
    envelope.source_filename || currentProposal.source_filename || envelope.original_filename || "document.pdf";
  const docDate = edits.document_date ?? currentProposal.document_date ?? envelope.message_date;
  const docDateSource = edits.document_date_source ?? currentProposal.document_date_source ?? "explicit_document";

  let canonicalName = currentProposal.canonical_eml_filename || currentProposal.canonical_filename;
  if (edits.canonical_filename) {
    const built = buildCanonicalFilename({
      originalFilename: edits.canonical_filename,
      documentDate: docDate,
      documentDateSource: docDateSource,
    });
    canonicalName = built.canonicalFilename;
  } else if (edits.document_date || !canonicalName) {
    const built = buildCanonicalFilename({
      originalFilename,
      documentDate: docDate,
      documentDateSource: docDateSource,
    });
    canonicalName = built.canonicalFilename;
  }

  const updatedProposal: Record<string, any> = {
    ...currentProposal,
    ...Object.fromEntries(
      Object.entries(edits).filter(([k]) => EDITABLE_PROPOSAL_FIELDS.has(k)),
    ),
    proposed_folder_path: finalFolderPath,
    canonical_filename: canonicalName,
    document_date: docDate,
    document_date_source: docDateSource,
    human_overridden: true,
    overridden_at: new Date().toISOString(),
  };

  const updatedPayload = {
    ...payload,
    proposal: updatedProposal,
  };

  const { error: updateErr } = await sb
    .from("approvals")
    .update({ payload: updatedPayload })
    .eq("id", approvalId)
    .eq("user_id", userId);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  // If a clarification case exists, append proposal history
  const docId = docIdFromPayload(updatedPayload);
  const kase = await findCaseForApproval(sb, userId, approvalId, docId);
  if (kase) {
    const history = Array.isArray(kase.proposals) ? [...kase.proposals] : [];
    history.push({
      cycle: (kase.cycle_count || 1) + 1,
      proposal: updatedProposal,
      approval_id: approvalId,
      decision: null,
      rejection_note: "Direct Human Override applied",
    });
    await sb
      .from("clarification_cases")
      .update({
        proposals: history,
        cycle_count: (kase.cycle_count || 1) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", kase.id);
  }

  return { ok: true, proposal: updatedProposal };
}

export type DuplicateCandidate = {
  documentId: string;
  driveFileId?: string;
  driveUrl?: string;
  canonicalFilename?: string;
  originalFilename?: string;
  documentDate?: string;
  documentType?: string;
  organization?: string;
  proposedPath?: string;
  matchType: "exact_hash" | "semantic_candidate";
  matchReason: string;
};

/**
 * Find exact duplicates and candidate matches in document_registry (DMS-D1-0003-REVIEW §9).
 * Zero LLM calls for exact hash match.
 */
export async function findDuplicateCandidates(
  sb: SupabaseClient,
  userId: string,
  criteria: {
    currentDocumentId?: string;
    contentHash?: string;
    senderOrIssuer?: string;
    documentType?: string;
    documentDate?: string;
  },
): Promise<DuplicateCandidate[]> {
  const { currentDocumentId, contentHash, senderOrIssuer, documentType, documentDate } = criteria;
  const results: DuplicateCandidate[] = [];

  const { data: docTable } = await sb
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", REGISTRY_DATASET)
    .maybeSingle();

  if (!docTable?.id) return [];

  const { data: rows } = await sb
    .from("user_data_rows")
    .select("row")
    .eq("table_id", docTable.id)
    .limit(1000);

  for (const r of rows ?? []) {
    const row = r.row as RegistryRow;
    if (!row || row.document_id === currentDocumentId) continue;

    // Exact byte hash match
    if (contentHash && row.content_hash && String(row.content_hash) === contentHash) {
      const driveFileId = row.drive_file_id ? String(row.drive_file_id) : undefined;
      const driveUrl = row.drive_url
        ? String(row.drive_url)
        : driveFileId
          ? `https://drive.google.com/file/d/${driveFileId}/view`
          : undefined;
      results.push({
        documentId: String(row.document_id),
        driveFileId,
        driveUrl,
        canonicalFilename: row.canonical_filename ? String(row.canonical_filename) : undefined,
        originalFilename: row.original_filename ? String(row.original_filename) : undefined,
        documentDate: row.document_date ? String(row.document_date) : undefined,
        documentType: row.document_type ? String(row.document_type) : undefined,
        organization: row.organization ? String(row.organization) : undefined,
        proposedPath: (row.proposed_path || row.approved_path) ? String(row.proposed_path || row.approved_path) : undefined,
        matchType: "exact_hash",
        matchReason: `Exact byte content match (SHA-256: ${contentHash.slice(0, 12)}…)`,
      });
      continue;
    }

    // Semantic candidate match: same sender/issuer + same date or same doc type
    let matches = 0;
    const reasons: string[] = [];

    const rowOrg = row.organization != null ? String(row.organization) : "";
    const rowDocType = row.document_type != null ? String(row.document_type) : "";
    const rowDocDate = row.document_date != null ? String(row.document_date) : "";

    if (senderOrIssuer && rowOrg && rowOrg.toLowerCase() === senderOrIssuer.toLowerCase()) {
      matches += 1;
      reasons.push("same issuer");
    }
    if (documentType && rowDocType && rowDocType === documentType) {
      matches += 1;
      reasons.push("same document type");
    }
    if (documentDate && rowDocDate && rowDocDate === documentDate) {
      matches += 1;
      reasons.push("same document date");
    }

    if (matches >= 2) {
      const driveFileId = row.drive_file_id ? String(row.drive_file_id) : undefined;
      const driveUrl = row.drive_url
        ? String(row.drive_url)
        : driveFileId
          ? `https://drive.google.com/file/d/${driveFileId}/view`
          : undefined;
      results.push({
        documentId: String(row.document_id),
        driveFileId,
        driveUrl,
        canonicalFilename: row.canonical_filename ? String(row.canonical_filename) : undefined,
        originalFilename: row.original_filename ? String(row.original_filename) : undefined,
        documentDate: row.document_date ? String(row.document_date) : undefined,
        documentType: row.document_type ? String(row.document_type) : undefined,
        organization: row.organization ? String(row.organization) : undefined,
        proposedPath: (row.proposed_path || row.approved_path) ? String(row.proposed_path || row.approved_path) : undefined,
        matchType: "semantic_candidate",
        matchReason: `Candidate match (${reasons.join(", ")})`,
      });
    }
  }

  return results;
}

export type ApprovalRow = {
  id: string;
  user_id: string;
  agent_name: string;
  agent_avatar: string | null;
  action_type: string;
  action_title: string;
  description: string | null;
  payload: any;
  risk_level: string;
  status: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  created_at: string;
  swarm_run_id: string | null;
};

/** What a human is being asked to do about this document or mail right now. */
export type ReviewStatus =
  | "pending"
  | "clarifying"
  | "consensus"
  | "approved"
  | "rejected"
  | "abandoned";

export type ReviewItemKind = "approval_item" | "manual_document_item";

export type ReviewQueueItem = {
  /** The approval id the /review/$approvalId route resolves. */
  approvalId: string;
  itemKind?: ReviewItemKind;
  documentId: string | null;
  manualReason?: string;
  subjectKind?: string;
  reviewStatus: ReviewStatus;
  approval: ApprovalRow;
  caseId: string | null;
  cycleCount: number | null;
  registryRow: RegistryRow | MailRegistryRow | null;
  createdAt: string;
  decidedAt: string | null;
};

function docIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const proposal = p.proposal as Record<string, unknown> | undefined;
  if (proposal) {
    const key = subjectKeyFromEnvelope(proposal);
    if (key) return key;
  }
  const envelope = p.envelope as Record<string, unknown> | undefined;
  if (envelope) {
    const key = subjectKeyFromEnvelope(envelope);
    if (key) return key;
  }
  if (typeof p.mail_id === "string" && p.mail_id.trim()) return p.mail_id.trim();
  if (typeof p.document_id === "string" && p.document_id.trim()) return p.document_id.trim();
  if (typeof p.subject_key === "string" && p.subject_key.trim()) return p.subject_key.trim();
  return null;
}

/** Maps a clarification_cases.status onto the human-facing review status. */
function statusFromCase(
  approvalStatus: string,
  caseStatus: ClarificationCase["status"] | null,
): ReviewStatus {
  switch (caseStatus) {
    case "resolved":
      return "approved";
    case "abandoned":
      return "abandoned";
    case "clarifying":
      return "clarifying";
    case "consensus":
      return "consensus";
    case "open":
    case null:
    default:
      return approvalStatus === "pending"
        ? "pending"
        : approvalStatus === "approved"
          ? "approved"
          : "rejected";
  }
}

/**
 * Fetch and group approvals into one item per document (or per standalone
 * approval, for the ones that carry no document identity — e.g. an n8n
 * webhook or MCP tool call).
 *
 * `sinceDays` bounds the window the same way the Observability list bounds
 * `swarm_runs` (30 days) — a review queue is for open/recent work, not an
 * unbounded historical export.
 */
export async function fetchReviewQueue(
  sb: SupabaseClient,
  userId: string,
  opts?: { sinceDays?: number; limit?: number },
): Promise<{ items: ReviewQueueItem[]; error: string | null }> {
  const since = new Date(Date.now() - (opts?.sinceDays ?? 60) * 86400000).toISOString();
  const limit = opts?.limit ?? 500;

  const [{ data: approvals, error: approvalsError }, { data: cases, error: casesError }] =
    await Promise.all([
      sb
        .from("approvals")
        .select(
          "id, user_id, agent_name, agent_avatar, action_type, action_title, description, payload, risk_level, status, decided_at, decided_by, decision_note, created_at, swarm_run_id",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(limit),
      sb
        .from("clarification_cases")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(limit),
    ]);

  if (approvalsError) return { items: [], error: approvalsError.message };
  if (casesError) return { items: [], error: casesError.message };

  const allApprovals = (approvals ?? []) as ApprovalRow[];
  const allCases = (cases ?? []) as ClarificationCase[];

  // Any approval id that appears anywhere in a case's history (its current
  // `approval_id` pointer, or any historical proposal cycle) resolves to that
  // case — a document's domain-promotion side-question and its filing-cycle
  // approvals are different `action_type`s but the same document, and both
  // must resolve to the one case tracking it.
  const caseByApprovalId = new Map<string, ClarificationCase>();
  const caseBySubjectKey = new Map<string, ClarificationCase>();
  for (const c of allCases) {
    caseBySubjectKey.set(c.subject_key, c);
    if (c.approval_id) caseByApprovalId.set(c.approval_id, c);
    for (const p of c.proposals ?? []) {
      if (p.approval_id) caseByApprovalId.set(p.approval_id, c);
    }
  }

  // Group approvals by document identity; approvals with no document identity
  // stand alone (one item per approval).
  const groups = new Map<string, ApprovalRow[]>();
  for (const a of allApprovals) {
    const docId = docIdFromPayload(a.payload);
    const key = docId ?? `approval:${a.id}`;
    const list = groups.get(key) ?? [];
    list.push(a);
    groups.set(key, list);
  }

  // Registry rows, fetched once and matched by document id / mail id
  const registryByDocId = new Map<string, RegistryRow | MailRegistryRow>();
  const { data: docTable } = await sb
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", REGISTRY_DATASET)
    .maybeSingle();
  if (docTable?.id) {
    const { data: rows } = await sb
      .from("user_data_rows")
      .select("row")
      .eq("table_id", docTable.id)
      .limit(1000);
    for (const r of rows ?? []) {
      const row = r.row as RegistryRow;
      const docId = row?.document_id;
      if (typeof docId === "string") registryByDocId.set(docId, row);
    }
  }

  const { data: mailTable } = await sb
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", MAIL_REGISTRY_DATASET)
    .maybeSingle();
  if (mailTable?.id) {
    const { data: rows } = await sb
      .from("user_data_rows")
      .select("row")
      .eq("table_id", mailTable.id)
      .limit(1000);
    for (const r of rows ?? []) {
      const row = r.row as MailRegistryRow;
      const mailId = row?.mail_id;
      if (typeof mailId === "string") registryByDocId.set(mailId, row);
    }
  }

  const items: ReviewQueueItem[] = [];
  const coveredDocIds = new Set<string>();

  for (const [key, list] of groups) {
    // Most recent approval in the group is the current representative.
    const representative = list.reduce((a, b) =>
      new Date(a.created_at) > new Date(b.created_at) ? a : b,
    );
    const docId = key.startsWith("approval:") ? null : key;
    if (docId) coveredDocIds.add(docId);
    const kase =
      caseByApprovalId.get(representative.id) ??
      (docId ? (caseBySubjectKey.get(docId) ?? null) : null);
    items.push({
      approvalId: representative.id,
      itemKind: "approval_item",
      documentId: docId,
      reviewStatus: statusFromCase(representative.status, kase?.status ?? null),
      approval: representative,
      caseId: kase?.id ?? null,
      cycleCount: kase?.cycle_count ?? null,
      registryRow: docId ? (registryByDocId.get(docId) ?? null) : null,
      createdAt: representative.created_at,
      decidedAt: representative.decided_at,
    });
  }

  // Include registry-only human_review_status=manual documents (DMS-D1-0005-DOCUMENTS-v3R §6)
  for (const [docId, row] of registryByDocId) {
    if (!coveredDocIds.has(docId)) {
      const reg = row as RegistryRow;
      if (reg.human_review_status === "manual") {
        const manualReason =
          reg.no_ai_detected === "true"
            ? "NO_AI_POLICY"
            : reg.classification_status === "error"
              ? "PRIVACY_ERROR"
              : reg.extraction_status && reg.extraction_status !== "ok"
                ? "EXTRACTION_FAILED"
                : reg.privacy_class === "restricted" || reg.external_processing_policy === "blocked"
                  ? "PRIVACY_RESTRICTED"
                  : "MANUAL_REVIEW";

        const envelope = {
          document_id: reg.document_id,
          drive_file_id: reg.drive_file_id,
          drive_url: reg.drive_url,
          filename: reg.original_filename || reg.filename,
          source_filename: reg.original_filename || reg.filename,
          mime_type: reg.mime_type,
          file_size: reg.file_size,
          created_time: reg.created_time,
          modified_time: reg.modified_time,
          no_ai_detected: reg.no_ai_detected,
          ai_processing_allowed: reg.ai_processing_allowed,
        };
        const proposal = {
          document_id: reg.document_id,
          document_type: reg.document_type,
          document_family: reg.document_family,
          primary_domain: reg.primary_domain,
          proposed_folder_path: reg.proposed_path || "04_Archive",
          canonical_filename: reg.canonical_filename,
          document_date: reg.document_date,
          confidence: reg.confidence,
          summary: reg.organization ? `Document from ${reg.organization}` : null,
        };
        const syntheticApproval: ApprovalRow = {
          id: `manual:${reg.document_id}`,
          user_id: userId,
          agent_name: "Manual Review",
          agent_avatar: "📋",
          action_type: "manual_document_review",
          action_title: (reg.original_filename || reg.filename || "Manual Document") as string,
          description: `Manual review required (${manualReason})`,
          payload: { envelope, proposal },
          risk_level: "low",
          status: "pending",
          decided_at: null,
          decided_by: null,
          decision_note: null,
          created_at: (reg.ingested_at || reg.created_time || new Date().toISOString()) as string,
          swarm_run_id: null,
        };

        items.push({
          approvalId: `manual:${reg.document_id}`,
          itemKind: "manual_document_item",
          documentId: reg.document_id ? String(reg.document_id) : null,
          manualReason,
          reviewStatus: "pending",
          approval: syntheticApproval,
          caseId: null,
          cycleCount: null,
          registryRow: reg,
          createdAt: (reg.ingested_at || reg.created_time || new Date().toISOString()) as string,
          decidedAt: null,
        });
      }
    }
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { items, error: null };
}

export type ReviewDetail = {
  itemKind?: ReviewItemKind;
  manualReason?: string;
  approval: ApprovalRow;
  documentId: string | null;
  reviewStatus: ReviewStatus;
  case: ClarificationCase | null;
  registryRow: RegistryRow | MailRegistryRow | null;
  /** Every approval belonging to this document's clarification case, oldest first — the cycle history. */
  history: ApprovalRow[];
};

/** Load one review item's full detail, keyed by the approval id in the URL. */
export async function fetchReviewDetail(
  sb: SupabaseClient,
  userId: string,
  approvalId: string,
): Promise<{ detail: ReviewDetail | null; error: string | null }> {
  if (approvalId.startsWith("manual:")) {
    const docId = approvalId.replace(/^manual:/, "");
    const { data: table } = await sb
      .from("user_data_tables")
      .select("id")
      .eq("user_id", userId)
      .eq("name", REGISTRY_DATASET)
      .maybeSingle();
    if (!table?.id) return { detail: null, error: "Registry not found" };
    const { data: row } = await sb
      .from("user_data_rows")
      .select("row")
      .eq("table_id", table.id)
      .eq("row->>document_id", docId)
      .maybeSingle();
    if (!row?.row) return { detail: null, error: "Document not found" };
    const reg = row.row as RegistryRow;
    const manualReason =
      reg.no_ai_detected === "true"
        ? "NO_AI_POLICY"
        : reg.classification_status === "error"
          ? "PRIVACY_ERROR"
          : reg.extraction_status && reg.extraction_status !== "ok"
            ? "EXTRACTION_FAILED"
            : reg.privacy_class === "restricted" || reg.external_processing_policy === "blocked"
              ? "PRIVACY_RESTRICTED"
              : "MANUAL_REVIEW";

    const envelope = {
      document_id: reg.document_id,
      drive_file_id: reg.drive_file_id,
      drive_url: reg.drive_url,
      filename: reg.original_filename || reg.filename,
      source_filename: reg.original_filename || reg.filename,
      mime_type: reg.mime_type,
      file_size: reg.file_size,
      created_time: reg.created_time,
      modified_time: reg.modified_time,
      no_ai_detected: reg.no_ai_detected,
      ai_processing_allowed: reg.ai_processing_allowed,
    };
    const proposal = {
      document_id: reg.document_id,
      document_type: reg.document_type,
      document_family: reg.document_family,
      primary_domain: reg.primary_domain,
      proposed_folder_path: reg.proposed_path || "04_Archive",
      canonical_filename: reg.canonical_filename,
      document_date: reg.document_date,
      confidence: reg.confidence,
      summary: reg.organization ? `Document from ${reg.organization}` : null,
    };
    const syntheticApproval: ApprovalRow = {
      id: approvalId,
      user_id: userId,
      agent_name: "Manual Review",
      agent_avatar: "📋",
      action_type: "manual_document_review",
      action_title: (reg.original_filename || reg.filename || "Manual Document") as string,
      description: `Manual review required (${manualReason})`,
      payload: { envelope, proposal },
      risk_level: "low",
      status: reg.human_review_status === "manual" ? "pending" : "approved",
      decided_at: null,
      decided_by: null,
      decision_note: null,
      created_at: (reg.ingested_at || reg.created_time || new Date().toISOString()) as string,
      swarm_run_id: null,
    };

    return {
      detail: {
        itemKind: "manual_document_item",
        manualReason,
        approval: syntheticApproval,
        documentId: docId,
        reviewStatus: reg.human_review_status === "manual" ? "pending" : "approved",
        case: null,
        registryRow: reg,
        history: [],
      },
      error: null,
    };
  }

  const { data: approval, error } = await sb
    .from("approvals")
    .select(
      "id, user_id, agent_name, agent_avatar, action_type, action_title, description, payload, risk_level, status, decided_at, decided_by, decision_note, created_at, swarm_run_id",
    )
    .eq("id", approvalId)
    .maybeSingle();
  if (error) return { detail: null, error: error.message };
  if (!approval) return { detail: null, error: null };

  const docId = docIdFromPayload(approval.payload);
  const kase = await findCaseForApproval(sb, userId, approvalId, docId);

  let history: ApprovalRow[] = [];
  const historyIds = (kase?.proposals ?? [])
    .map((p) => p.approval_id)
    .filter((id): id is string => Boolean(id));
  if (historyIds.length > 0) {
    const { data: historyRows } = await sb
      .from("approvals")
      .select(
        "id, user_id, agent_name, agent_avatar, action_type, action_title, description, payload, risk_level, status, decided_at, decided_by, decision_note, created_at, swarm_run_id",
      )
      .in("id", historyIds);
    const byId = new Map((historyRows ?? []).map((r) => [r.id, r as ApprovalRow]));
    history = historyIds.map((id) => byId.get(id)).filter((r): r is ApprovalRow => Boolean(r));
  }

  let registryRow: RegistryRow | MailRegistryRow | null = null;
  if (docId) {
    if (docId.startsWith("mail:")) {
      const { data: table } = await sb
        .from("user_data_tables")
        .select("id")
        .eq("user_id", userId)
        .eq("name", MAIL_REGISTRY_DATASET)
        .maybeSingle();
      if (table?.id) {
        const { data: row } = await sb
          .from("user_data_rows")
          .select("row")
          .eq("table_id", table.id)
          .eq("row->>mail_id", docId)
          .maybeSingle();
        registryRow = (row?.row as MailRegistryRow) ?? null;
      }
    } else {
      const { data: table } = await sb
        .from("user_data_tables")
        .select("id")
        .eq("user_id", userId)
        .eq("name", REGISTRY_DATASET)
        .maybeSingle();
      if (table?.id) {
        const { data: row } = await sb
          .from("user_data_rows")
          .select("row")
          .eq("table_id", table.id)
          .eq("row->>document_id", docId)
          .maybeSingle();
        registryRow = (row?.row as RegistryRow) ?? null;
      }
    }
  }

  return {
    detail: {
      approval: approval as ApprovalRow,
      documentId: docId,
      reviewStatus: statusFromCase(approval.status, kase?.status ?? null),
      case: kase,
      registryRow,
      history,
    },
    error: null,
  };
}

/** Small counters for the queue's KPI header — all derived, nothing stored. */
export function computeReviewKpis(items: ReviewQueueItem[]) {
  const todayKey = new Date().toDateString();
  let pending = 0;
  let clarifying = 0;
  let approvedToday = 0;
  let needsAttention = 0;
  for (const item of items) {
    if (item.reviewStatus === "pending") pending += 1;
    if (item.reviewStatus === "clarifying" || item.reviewStatus === "consensus") clarifying += 1;
    if (item.reviewStatus === "abandoned") needsAttention += 1;
    if (
      item.reviewStatus === "approved" &&
      item.decidedAt &&
      new Date(item.decidedAt).toDateString() === todayKey
    ) {
      approvedToday += 1;
    }
  }
  return { pending, clarifying, approvedToday, needsAttention };
}
