import type { NativeApproval } from "@/hooks/use-approval-decision";

export type { NativeApproval } from "@/hooks/use-approval-decision";

export type ReviewStatus = "pending" | "approved" | "rejected";
export type ReviewContext = {
  subject: string | null;
  itemKind: string | null;
  documentType: string | null;
  documentFamily: string | null;
  organization: string | null;
  primaryDomain: string | null;
  proposedLocation: string | null;
  confidence: number | null;
  topics: string | null;
  summary: string | null;
  clarification: string | null;
};

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

function stringValue(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function numberValue(record: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export function reviewContext(approval: NativeApproval): ReviewContext {
  const payload =
    typeof approval.payload === "object" && approval.payload !== null
      ? (approval.payload as Record<string, unknown>)
      : {};
  const proposal =
    typeof payload.proposal === "object" && payload.proposal !== null
      ? (payload.proposal as Record<string, unknown>)
      : {};
  const context =
    typeof payload.context === "object" && payload.context !== null
      ? (payload.context as Record<string, unknown>)
      : {};
  const fields = { ...payload, ...context, ...proposal };
  return {
    subject: stringValue(fields, "subject", "filename", "canonical_filename", "title"),
    itemKind: stringValue(fields, "item_kind", "kind", "document_kind"),
    documentType: stringValue(fields, "document_type", "type"),
    documentFamily: stringValue(fields, "document_family", "family"),
    organization: stringValue(fields, "organization", "issuer", "sender_or_issuer"),
    primaryDomain: stringValue(fields, "primary_domain", "domain"),
    proposedLocation: stringValue(fields, "proposed_path", "proposed_location", "target_path"),
    confidence: numberValue(fields, "confidence", "classification_confidence"),
    topics: stringValue(fields, "topics"),
    summary: stringValue(fields, "summary"),
    clarification: stringValue(fields, "clarification", "clarification_context"),
  };
}
