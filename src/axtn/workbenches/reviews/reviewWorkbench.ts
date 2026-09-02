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
  /**
   * Registration approvals carry the technical intake acknowledgement instead of
   * a semantic classification proposal. When that is what the run produced, the
   * technical facts are the real context and are exposed separately so the UI
   * never has to present a semantic decision that does not exist yet.
   */
  registration: RegistrationContext | null;
};

export type RegistrationContext = {
  documentId: string | null;
  accepted: boolean | null;
  processingStatus: string | null;
  processingRoute: string | null;
  registryOutcome: string | null;
  nextLocation: string | null;
  sourceType: string | null;
  providerFileId: string | null;
};

export function isReviewStatus(value: string): value is ReviewStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

export function hasEditableReviewProposal(approval: NativeApproval): boolean {
  return (
    approval.status === "pending" &&
    typeof approval.payload === "object" &&
    approval.payload !== null &&
    typeof (approval.payload as Record<string, unknown>).proposal === "object" &&
    (approval.payload as Record<string, unknown>).proposal !== null
  );
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

/**
 * Intake writes the acknowledgement as a JSON string in `last_output`, falling
 * back to the approval description. Anything that is not that shape yields null
 * rather than a partially guessed record.
 */
function parseLastOutput(
  payload: Record<string, unknown>,
  description: string | null,
): Record<string, unknown> | null {
  const candidates = [payload.last_output, payload.lastOutput, description];
  for (const candidate of candidates) {
    if (typeof candidate === "object" && candidate !== null) {
      return candidate as Record<string, unknown>;
    }
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, unknown>;
    } catch {
      // Not a JSON acknowledgement; try the next candidate.
    }
  }
  return null;
}

/**
 * Document ids are namespaced as "<source_type>:<source_ref>", where the source
 * reference itself is "<provider>:<fileId>". Both parts are read back out of the
 * identifier the run actually produced; nothing is invented.
 */
function splitDocumentId(documentId: string | null): {
  sourceType: string | null;
  providerFileId: string | null;
} {
  if (!documentId) return { sourceType: null, providerFileId: null };
  const parts = documentId.split(":").filter(Boolean);
  if (parts.length < 2) return { sourceType: null, providerFileId: null };
  return { sourceType: parts[0], providerFileId: parts[parts.length - 1] };
}

export function registrationContext(approval: NativeApproval): RegistrationContext | null {
  const payload =
    typeof approval.payload === "object" && approval.payload !== null
      ? (approval.payload as Record<string, unknown>)
      : {};
  const ack = parseLastOutput(payload, approval.description ?? null);
  if (!ack) return null;
  const documentId = stringValue(ack, "document_id", "documentId");
  const processingStatus = stringValue(ack, "processing_status", "processingStatus");
  if (!documentId && !processingStatus) return null;
  const { sourceType, providerFileId } = splitDocumentId(documentId);
  return {
    documentId,
    accepted: typeof ack.accepted === "boolean" ? ack.accepted : null,
    processingStatus,
    processingRoute: stringValue(ack, "processing_route", "processingRoute"),
    registryOutcome: stringValue(ack, "registry_outcome", "registryOutcome"),
    nextLocation: stringValue(ack, "next_location", "nextLocation"),
    sourceType,
    providerFileId,
  };
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
    registration: registrationContext(approval),
  };
}

/**
 * A review can only be acted on while it is still pending. Decided reviews are
 * read-only history.
 */
export function isActionableReview(approval: NativeApproval): boolean {
  return approval.status === "pending";
}
