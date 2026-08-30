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
      results.push({
        documentId: String(row.document_id),
        driveFileId: row.drive_file_id ? String(row.drive_file_id) : undefined,
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
      results.push({
        documentId: String(row.document_id),
        driveFileId: row.drive_file_id ? String(row.drive_file_id) : undefined,
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

export type ReviewQueueItem = {
  /** The approval id the /review/$approvalId route resolves. */
  approvalId: string;
  documentId: string | null;
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
  for (const [key, list] of groups) {
    // Most recent approval in the group is the current representative.
    const representative = list.reduce((a, b) =>
      new Date(a.created_at) > new Date(b.created_at) ? a : b,
    );
    const docId = key.startsWith("approval:") ? null : key;
    const kase =
      caseByApprovalId.get(representative.id) ??
      (docId ? (caseBySubjectKey.get(docId) ?? null) : null);
    items.push({
      approvalId: representative.id,
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

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { items, error: null };
}

export type ReviewDetail = {
  approval: ApprovalRow;
  documentId: string | null;
  reviewStatus: ReviewStatus;
  case: ClarificationCase | null;
  registryRow: RegistryRow | null;
  /** Every approval belonging to this document's clarification case, oldest first — the cycle history. */
  history: ApprovalRow[];
};

/** Load one review item's full detail, keyed by the approval id in the URL. */
export async function fetchReviewDetail(
  sb: SupabaseClient,
  userId: string,
  approvalId: string,
): Promise<{ detail: ReviewDetail | null; error: string | null }> {
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
