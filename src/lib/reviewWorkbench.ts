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

/** What a human is being asked to do about this document right now. */
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
  reviewStatus: ReviewStatus;
  approval: ApprovalRow;
  caseId: string | null;
  cycleCount: number | null;
  registryRow: RegistryRow | null;
  createdAt: string;
  decidedAt: string | null;
};

function docIdFromPayload(payload: unknown): string | null {
  const proposal = (payload as { proposal?: Record<string, unknown> } | null | undefined)
    ?.proposal;
  if (!proposal) return null;
  return subjectKeyFromEnvelope(proposal);
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

  // Registry rows, fetched once and matched by document id — the dataset
  // engine has no bulk multi-key lookup, so filtering client-side over one
  // table read is simpler and cheaper than N lookups.
  const registryByDocId = new Map<string, RegistryRow>();
  const { data: table } = await sb
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", REGISTRY_DATASET)
    .maybeSingle();
  if (table?.id) {
    const { data: rows } = await sb
      .from("user_data_rows")
      .select("row")
      .eq("table_id", table.id)
      .limit(1000);
    for (const r of rows ?? []) {
      const row = r.row as RegistryRow;
      const docId = row?.document_id;
      if (typeof docId === "string") registryByDocId.set(docId, row);
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

  let registryRow: RegistryRow | null = null;
  if (docId) {
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
