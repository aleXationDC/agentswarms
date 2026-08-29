/**
 * Surfacing domain decisions to a human through the NATIVE approval inbox.
 *
 * THE GAP THIS BRIDGES
 * `domainRegistry` already refuses to promote anything without
 * `confirmedByHuman: true`. That was correct but unreachable: the only way to
 * say yes was to call the function from a script, so candidates accumulated in
 * a table nobody looks at. Governance that cannot be exercised is not
 * governance.
 *
 * WHY THE APPROVAL INBOX AND NOT A NEW UI
 * `approvals` already is the product's human gate: it renders a title, a
 * description and Approve/Reject, it has realtime updates, and `swarm_run_id`
 * is nullable — so an approval that belongs to no run simply records a decision
 * and stops, which is exactly the semantics of "should this become a domain?".
 * No new page, no new decision framework.
 *
 * WHAT IS CUSTOM HERE
 * Two things, both small and both genuinely missing natively:
 *   1. composing the approval (nothing native knows what a domain candidate is)
 *   2. reacting to the decision — the inbox writes `status` and, without a
 *      `swarm_run_id`, nothing else happens. There is no native
 *      "on approval decided" server hook, so the decision has to be applied
 *      when it is read back.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * No auto-confirmation, no confidence threshold that promotes on its own, and
 * no promotion as a side effect of approving a DOCUMENT. Approving a filing
 * says "this document goes there"; it never says "this domain is now global
 * truth". Those are separate approvals on purpose.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { confirmDomain, mergeDomains, DOMAIN_DATASET } from "@/lib/domainRegistry";

export const DOMAIN_ACTION_TYPE = "domain_promotion";

type DomainRow = Record<string, string | number | null>;

type SourceDocument = {
  documentId: string;
  driveFileId: string | null;
  filename: string;
};

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/**
 * Human-readable name for the document a domain was first seen in.
 *
 * The registry stores a Drive id, which tells a human nothing. Falls back to
 * the raw id when the document is unknown — an opaque reference is still
 * better than claiming a filename we did not look up.
 */
async function documentLabel(
  sb: SupabaseClient<Database>,
  userId: string,
  documentId: string | null,
): Promise<SourceDocument | null> {
  if (!documentId) return null;
  const { data: t } = await sb
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "document_registry")
    .maybeSingle();
  if (!t?.id) return { documentId, driveFileId: null, filename: documentId };
  const { data } = await sb
    .from("user_data_rows")
    .select("row")
    .eq("table_id", t.id)
    .eq("row->>document_id", documentId)
    .maybeSingle();
  const row = (data as { row: Record<string, unknown> } | null)?.row;
  const name = row ? str(row.original_filename ?? row.canonical_filename) : null;
  return {
    documentId,
    driveFileId: row ? str(row.drive_file_id) : null,
    filename: name ?? documentId,
  };
}

async function domainTableId(
  sb: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data } = await sb
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", DOMAIN_DATASET)
    .maybeSingle();
  return data?.id ?? null;
}

async function loadDomain(
  sb: SupabaseClient<Database>,
  userId: string,
  domainId: string,
): Promise<DomainRow | null> {
  const tableId = await domainTableId(sb, userId);
  if (!tableId) return null;
  const { data } = await sb
    .from("user_data_rows")
    .select("id,row")
    .eq("table_id", tableId)
    .eq("row->>domain_id", domainId)
    .maybeSingle();
  return (data as { row: DomainRow } | null)?.row ?? null;
}

/**
 * Ask a human whether a candidate domain should become authoritative.
 *
 * Idempotent per domain: a document that keeps resolving to the same candidate
 * must not produce one approval per run. Repeated *observations* are exactly
 * what the instruction "do not ask me to approve harmless repeated
 * observations" rules out.
 */
export async function requestDomainPromotion(
  sb: SupabaseClient<Database>,
  args: {
    userId: string;
    domainId: string;
    /**
     * Why the classifier thinks this is a domain and not merely a topic.
     * Omitted when the run gave no reason — an empty section is honest, an
     * invented one is not.
     */
    reason?: string | null;
    /**
     * Best existing confirmed domain, when resolution found a near miss.
     * Must come from the resolution of THIS domain. Passing a match belonging
     * to some other candidate produces a card that argues for a merge the
     * system never actually considered.
     */
    nearest?: { domainId: string; canonicalName: string; similarity: number } | null;
    sourceFilename?: string | null;
  },
): Promise<{ created: boolean; approvalId?: string; reason?: string }> {
  const domain = await loadDomain(sb, args.userId, args.domainId);
  if (!domain) return { created: false, reason: "unknown_domain" };
  if (str(domain.status) !== "candidate") return { created: false, reason: "not_a_candidate" };

  const { data: open } = await sb
    .from("approvals")
    .select("id")
    .eq("user_id", args.userId)
    .eq("action_type", DOMAIN_ACTION_TYPE)
    .eq("status", "pending")
    .eq("payload->>domain_id", args.domainId)
    .maybeSingle();
  if (open?.id) return { created: false, approvalId: open.id, reason: "already_pending" };

  const name = String(domain.canonical_name ?? "");

  // Provenance is read back from the registry row rather than taken from the
  // caller. The row records the document this domain was actually first seen
  // in; a caller-supplied filename can silently be the wrong document, which
  // makes the card argue from evidence that does not belong to it.
  const sourceDocument = await documentLabel(
    sb,
    args.userId,
    str(domain.source_document_id),
  );
  const sourceFilename = args.sourceFilename ?? sourceDocument?.filename ?? null;

  const lines: string[] = [
    `Candidate domain:\n${name}`,
    sourceFilename ? `Detected from:\n${sourceFilename}` : "",
    args.reason ? `Reason:\n${args.reason}` : "",
    args.nearest
      ? `Possible existing match:\n${args.nearest.canonicalName}\nSimilarity:\n${args.nearest.similarity.toFixed(2)}`
      : "",
    // The recommendation is advice, never a default action. Rejecting leaves
    // the candidate exactly as it is — detected, usable for this document, and
    // still not global knowledge.
    args.nearest && args.nearest.similarity >= 0.8
      ? `Recommended action:\nMERGE WITH EXISTING — approve to merge into "${args.nearest.canonicalName}".`
      : `Recommended action:\nCONFIRM AS NEW DOMAIN — approve to make this a trusted classification anchor.\nRejecting keeps it as a candidate; the document keeps its classification either way.`,
    `Documents seen so far:\n${Number(domain.document_count ?? 0)}`,
  ].filter(Boolean);

  const merge = Boolean(args.nearest && args.nearest.similarity >= 0.8);

  const { data: inserted, error } = await sb
    .from("approvals")
    .insert({
      user_id: args.userId,
      agent_name: "Document Classification & Filing",
      agent_avatar: "🗂️",
      action_type: DOMAIN_ACTION_TYPE,
      action_title: merge
        ? `Merge domain "${name}" into "${args.nearest?.canonicalName}"?`
        : `Confirm "${name}" as a filing domain?`,
      description: lines.join("\n\n"),
      // Medium, not low: this decision changes how future documents are
      // classified, which is harder to notice going wrong than a single filing.
      risk_level: "medium",
      status: "pending",
      payload: {
        kind: "domain_promotion",
        domain_id: args.domainId,
        canonical_name: name,
        operation: merge ? "merge" : "confirm",
        merge_into_domain_id: merge ? args.nearest?.domainId : null,
        similarity: args.nearest?.similarity ?? null,
        source_document_id: str(domain.source_document_id),
        // A domain candidate caused by a document must be discussable through
        // the same native clarification conversation as that document. The
        // inbox intentionally recognises a document proposal, not a custom
        // domain conversation type, so preserve this stable document identity.
        proposal: sourceDocument
          ? {
              document_id: sourceDocument.documentId,
              drive_file_id: sourceDocument.driveFileId,
              source_filename: sourceDocument.filename,
            }
          : null,
      } as unknown as Json,
    })
    .select("id")
    .maybeSingle();

  if (error || !inserted) return { created: false, reason: error?.message ?? "insert_failed" };
  return { created: true, approvalId: (inserted as { id: string }).id };
}

/**
 * Apply a decided domain approval.
 *
 * Called when the inbox reports a decision. Approving performs the operation
 * the card described — and nothing beyond it. Rejecting is a real outcome, not
 * a no-op deferral: the candidate stays a candidate, so the document keeps its
 * provisional classification while the domain never becomes a trusted anchor.
 */
export async function applyDomainDecision(
  sb: SupabaseClient<Database>,
  args: { userId: string; approvalId: string },
): Promise<{ applied: boolean; outcome?: string; reason?: string }> {
  const { data: approval } = await sb
    .from("approvals")
    .select("id,user_id,status,payload,action_type")
    .eq("id", args.approvalId)
    .maybeSingle();

  if (!approval) return { applied: false, reason: "approval_not_found" };
  if (approval.user_id !== args.userId) return { applied: false, reason: "not_owner" };
  if (approval.action_type !== DOMAIN_ACTION_TYPE) {
    return { applied: false, reason: "not_a_domain_approval" };
  }

  const payload = (approval.payload ?? {}) as Record<string, unknown>;
  const domainId = str(payload.domain_id);
  if (!domainId) return { applied: false, reason: "no_domain_id" };

  if (approval.status === "rejected") {
    await stampApplied(sb, approval.id, payload, "kept_as_candidate");
    return { applied: true, outcome: "kept_as_candidate" };
  }
  if (approval.status !== "approved") return { applied: false, reason: "not_decided" };

  // The human confirmation flag is set from the APPROVAL STATUS — a value only
  // a human can write through the inbox — not from anything a model produced.
  if (payload.operation === "merge") {
    const target = str(payload.merge_into_domain_id);
    if (!target) return { applied: false, reason: "no_merge_target" };
    const res = await mergeDomains(sb, {
      userId: args.userId,
      sourceDomainId: domainId,
      targetDomainId: target,
      confirmedByHuman: true,
    });
    if (!res.merged) return { applied: false, reason: res.reason };
    await stampApplied(sb, approval.id, payload, "merged");
    return { applied: true, outcome: "merged" };
  }

  const res = await confirmDomain(sb, {
    userId: args.userId,
    domainId,
    confirmedByHuman: true,
    sourceApprovalId: approval.id,
  });
  if (!res.confirmed) return { applied: false, reason: res.reason };
  await stampApplied(sb, approval.id, payload, "confirmed");
  return { applied: true, outcome: "confirmed" };
}

/**
 * Mark a decision as carried out.
 *
 * Written by `applyDomainDecision` itself rather than by its callers, so every
 * entry point records it. It previously lived only in the reconciliation sweep,
 * which meant a decision made in the inbox took effect but left no trace that
 * it had — indistinguishable, on inspection, from one that never ran.
 */
async function stampApplied(
  sb: SupabaseClient<Database>,
  approvalId: string,
  payload: Record<string, unknown>,
  outcome: string,
): Promise<void> {
  await sb
    .from("approvals")
    .update({
      payload: { ...payload, applied_at: new Date().toISOString(), outcome } as Json,
    })
    .eq("id", approvalId);
}

/**
 * Apply every decided-but-unapplied domain approval for a user.
 *
 * A reconciliation sweep rather than an event handler, because there is no
 * native server-side hook on an approval decision: the inbox updates the row
 * from the browser. Running this when the inbox loads makes the decision take
 * effect without inventing a parallel notification path.
 */
export async function reconcileDomainDecisions(
  sb: SupabaseClient<Database>,
  userId: string,
): Promise<{ applied: number }> {
  const { data } = await sb
    .from("approvals")
    .select("id,status,payload")
    .eq("user_id", userId)
    .eq("action_type", DOMAIN_ACTION_TYPE)
    .in("status", ["approved", "rejected"])
    .limit(200);

  let applied = 0;
  for (const a of (data ?? []) as { id: string; status: string; payload: unknown }[]) {
    const p = (a.payload ?? {}) as Record<string, unknown>;
    if (p.applied_at) continue;
    const res = await applyDomainDecision(sb, { userId, approvalId: a.id });
    if (res.applied) applied += 1;
  }
  return { applied };
}
