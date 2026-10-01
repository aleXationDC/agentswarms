export const CASE_STATUSES = ["NEW", "OPEN", "WAITING_CONTACT", "CLOSED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];
export type CaseActor = "human" | "automation";

export type CaseDraft = {
  subject: string;
  case_type?: string | null;
  status?: CaseStatus;
  status_reason?: string | null;
  priority?: number;
  due_date?: string | null;
  follow_up?: string | null;
  account_id?: string | null;
  primary_contact_id?: string | null;
  related_entity?: string | null;
  parent_case_id?: string | null;
};

export function validateCaseDraft(draft: CaseDraft, actor: CaseActor = "human"): void {
  if (!draft.subject.trim()) throw new Error("Case Subject is required.");
  if (draft.subject.trim().length > 500) throw new Error("Case Subject is too long.");
  const priority = draft.priority ?? 3;
  if (!Number.isInteger(priority) || priority < 0 || priority > 3) {
    throw new Error("Priority must be an integer from 0 to 3.");
  }
  if (priority === 0 && actor !== "human") {
    throw new Error("Only a human can set Human Critical priority 0.");
  }
  const status = draft.status ?? "NEW";
  if (!CASE_STATUSES.includes(status)) throw new Error(`Unsupported case status: ${status}`);
  if (status === "WAITING_CONTACT") {
    if (!draft.primary_contact_id) throw new Error("WAITING_CONTACT requires a primary Contact.");
    if (!draft.follow_up) throw new Error("WAITING_CONTACT requires a follow-up date.");
  }
}

export function effectiveCaseStatus(
  status: CaseStatus,
  followUp: string | null | undefined,
  now = new Date(),
): CaseStatus {
  if (status !== "CLOSED" && followUp && new Date(followUp).getTime() <= now.getTime()) {
    return "OPEN";
  }
  return status;
}

export function reopenOnRelevantActivity(
  status: CaseStatus,
  reason = "Relevant new activity",
): { status: CaseStatus; status_reason: string } {
  return status === "CLOSED"
    ? { status: "OPEN", status_reason: reason }
    : { status, status_reason: reason };
}
