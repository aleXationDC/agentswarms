// Shared decision/resume wiring for approvals.
//
// Both `ApprovalInbox` (the global compact quick-action layer) and the Review
// Workbench (`/review`, `/review/$approvalId`) let a human decide an approval.
// The DECISION LOGIC — recording the outcome, resuming a parked swarm run,
// applying a domain promotion, handing a rejection to the Clarification Agent
// — is canonical and lives server-side in `swarmResume.functions.ts`,
// `domainGovernance.functions.ts` and `clarification.functions.ts`. This hook
// is only the one place the CLIENT calls those, so the two surfaces can never
// drift into two different notions of "what happens when you approve".
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { resumeApprovedSwarmRun } from "@/utils/swarmResume.functions";
import { startClarification } from "@/utils/clarification.functions";
import { applyDomainApproval } from "@/utils/domainGovernance.functions";

// Mirrors domainGovernance.ts's DOMAIN_ACTION_TYPE, kept as a literal: that
// module transitively imports a server-only embedding tool
// (domainRegistry.ts -> utils/tools/embedding.server), so importing it here
// would leak a server-only module into the client bundle.
const DOMAIN_ACTION_TYPE = "domain_promotion";

export type ApprovalLike = {
  id: string;
  user_id: string;
  agent_name: string;
  action_type: string;
  action_title: string;
  payload: unknown;
  swarm_run_id: string | null;
};

/**
 * A proposal about a specific document can be argued with; a generic approval
 * cannot. The clarification loop needs a stable subject identity to attach the
 * conversation to, so "Discuss" only applies when the payload carries one.
 */
export function canClarifyApproval(ap: Pick<ApprovalLike, "payload">): boolean {
  const p = (ap.payload as { proposal?: { document_id?: unknown; drive_file_id?: unknown } })
    ?.proposal;
  return Boolean(p && (p.document_id || p.drive_file_id));
}

export function isDomainPromotionApproval(ap: Pick<ApprovalLike, "action_type">): boolean {
  return ap.action_type === DOMAIN_ACTION_TYPE;
}

type ClarifyResult =
  | { ok: true; conversation_id: string; agent_id: string; case_id: string; approval_id: string }
  | { ok: false; error: string };

export function useApprovalActions() {
  const { user } = useAuth();
  const resumeRunFn = useServerFn(resumeApprovedSwarmRun);
  const clarifyFn = useServerFn(startClarification);
  const applyDomainFn = useServerFn(applyDomainApproval);
  const [busy, setBusy] = useState(false);

  /**
   * Plain approve/reject — no clarification dialogue. Records the decision,
   * then resumes the parked swarm run and/or applies a domain-promotion
   * decision, exactly as the original ApprovalInbox card does.
   */
  const decide = async (approval: ApprovalLike, status: "approved" | "rejected") => {
    if (approval.id.startsWith("manual:")) {
      const docId = approval.id.replace(/^manual:/, "");
      if (user) {
        try {
          const { data: table } = await supabase
            .from("user_data_tables")
            .select("id")
            .eq("user_id", user.id)
            .eq("name", "document_registry")
            .maybeSingle();
          if (table?.id) {
            const { data: hit } = await supabase
              .from("user_data_rows")
              .select("id, row")
              .eq("table_id", table.id)
              .eq("row->>document_id", docId)
              .maybeSingle();
            if (hit?.id) {
              const current = (hit.row ?? {}) as Record<string, any>;
              const updated = {
                ...current,
                human_review_status: status,
                classification_status: status === "approved" ? "classified" : "rejected",
                last_verified_at: new Date().toISOString(),
              };
              await supabase.from("user_data_rows").update({ row: updated }).eq("id", hit.id);
            }
          }
        } catch (err) {
          console.error("Failed to update manual review document:", err);
        }
      }
      if (status === "approved") {
        toast.success(`Approved: ${approval.action_title}`, {
          description: "Manual review document marked approved.",
        });
      } else {
        toast.error(`Rejected: ${approval.action_title}`, {
          description: "Manual review document marked rejected.",
        });
      }
      return { ok: true as const };
    }

    const { error } = await supabase
      .from("approvals")
      .update({ status, decided_at: new Date().toISOString(), decided_by: user?.id ?? null })
      .eq("id", approval.id);
    if (error) {
      toast.error("Failed to update approval");
      return { ok: false as const };
    }
    if (status === "approved") {
      toast.success(`Approved: ${approval.action_title}`, {
        description: `${approval.agent_name} is resuming.`,
      });
    } else {
      toast.error(`Rejected: ${approval.action_title}`, {
        description: `${approval.agent_name} has been halted.`,
      });
    }

    // A headless run (API key / schedule) parks at its approval node with a
    // checkpoint and cannot continue itself — recording the decision is only
    // half the job. Runs started from the canvas ignore this: they are still
    // waiting in the tab that started them.
    if (approval.swarm_run_id) {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (token) {
          const res = await resumeRunFn({
            data: { access_token: token, approval_id: approval.id },
          });
          if (!res.ok) {
            toast.warning("Decision saved, but the run could not be resumed", {
              description: res.error,
              duration: 9000,
            });
          }
        }
      } catch (e) {
        toast.warning("Decision saved, but the run could not be resumed", {
          description: (e as Error).message,
          duration: 9000,
        });
      }
    }

    // A domain decision belongs to no run, so recording the status is not the
    // whole job either: the confirm/merge it authorises still has to happen.
    if (isDomainPromotionApproval(approval)) {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        if (token) {
          const res = await applyDomainFn({
            data: { access_token: token, approval_id: approval.id },
          });
          if (res.ok) {
            if (res.outcome === "confirmed") {
              toast.success("Domain confirmed", {
                description: "Future documents can now be filed against it.",
              });
            } else if (res.outcome === "merged") {
              toast.success("Domains merged");
            } else if (res.outcome === "kept_as_candidate") {
              toast.info("Kept as a candidate", {
                description: "It stays available for this document but is not global knowledge.",
              });
            }
          } else {
            toast.warning("Decision saved, but the domain was not updated", {
              description: res.error,
              duration: 9000,
            });
          }
        }
      } catch (e) {
        toast.warning("Decision saved, but the domain was not updated", {
          description: (e as Error).message,
          duration: 9000,
        });
      }
    }
    return { ok: true as const };
  };

  /**
   * Reject with a reason: records the decision, then hands the disagreement to
   * the Clarification Agent. Deliberately does NOT resume the swarm run — a
   * rejected proposal has nothing to continue; the next cycle is a fresh run
   * once the two of them agree. Does NOT navigate — callers decide whether to
   * jump into the conversation immediately (the inbox does) or stay put and
   * offer an "Open conversation" link (the Review detail page does).
   */
  const rejectWithReason = async (approval: ApprovalLike, note: string): Promise<ClarifyResult> => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("approvals")
        .update({
          status: "rejected",
          decided_at: new Date().toISOString(),
          decided_by: user?.id ?? null,
        })
        .eq("id", approval.id);
      if (error) {
        toast.error("Failed to record the rejection");
        return { ok: false, error: error.message };
      }

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        toast.error("Session expired");
        return { ok: false, error: "Session expired" };
      }
      const res = await clarifyFn({
        data: { access_token: token, approval_id: approval.id, note: note.trim() || undefined },
      });
      if (!res.ok) {
        toast.error("Could not start the clarification", {
          description: res.error,
          duration: 9000,
        });
        return { ok: false, error: res.error };
      }
      toast.info("Clarification started", { description: "The agent has a question for you." });
      return {
        ok: true,
        conversation_id: res.conversation_id,
        agent_id: res.agent_id,
        case_id: res.case_id,
        approval_id: res.approval_id,
      };
    } catch (e) {
      const message = (e as Error).message;
      toast.error("Could not start the clarification", { description: message });
      return { ok: false, error: message };
    } finally {
      setBusy(false);
    }
  };

  return { decide, rejectWithReason, busy };
}
