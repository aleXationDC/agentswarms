import type { Database } from "@/integrations/supabase/types";

export type NativeApproval = Database["public"]["Tables"]["approvals"]["Row"];

export type ReviewStatus = "pending" | "approved" | "rejected";

export function isReviewStatus(value: string): value is ReviewStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

export function reviewSearchText(approval: NativeApproval): string {
  return [
    approval.agent_name,
    approval.action_title,
    approval.description,
    approval.action_type,
    approval.risk_level,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}
