import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { resumeApprovedSwarmRun } from "@/utils/swarmResume.functions";

export type NativeApproval = Database["public"]["Tables"]["approvals"]["Row"];
export type ApprovalDecision = "approved" | "rejected";

/**
 * Shared client-side entry point for the native ApprovalInbox decision flow.
 * A saved decision remains canonical even if resuming an attached run fails.
 */
export function useApprovalDecision() {
  const resumeRunFn = useServerFn(resumeApprovedSwarmRun);

  return useCallback(
    async (approval: NativeApproval, decision: ApprovalDecision): Promise<boolean> => {
      const { error } = await supabase
        .from("approvals")
        .update({
          status: decision,
          decided_at: new Date().toISOString(),
          decided_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        })
        .eq("id", approval.id)
        .eq("status", "pending");
      if (error) {
        toast.error("Failed to update approval");
        return false;
      }

      if (decision === "approved") {
        toast.success(`Approved: ${approval.action_title}`, {
          description: `${approval.agent_name} is resuming.`,
        });
      } else {
        toast.error(`Rejected: ${approval.action_title}`, {
          description: `${approval.agent_name} has been halted.`,
        });
      }

      if (approval.swarm_run_id) {
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            const result = await resumeRunFn({
              data: { access_token: session.access_token, approval_id: approval.id },
            });
            if (!result.ok) {
              toast.warning("Decision saved, but the run could not be resumed", {
                description: result.error,
                duration: 9000,
              });
            }
          }
        } catch (error) {
          toast.warning("Decision saved, but the run could not be resumed", {
            description: error instanceof Error ? error.message : "Resume failed",
            duration: 9000,
          });
        }
      }

      return true;
    },
    [resumeRunFn],
  );
}
