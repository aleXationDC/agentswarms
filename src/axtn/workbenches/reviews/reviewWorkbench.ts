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
  /** The source locator the registry row is keyed by, e.g. "drive:<fileId>". */
  sourceRef: string | null;
  accepted: boolean | null;
  processingStatus: string | null;
  processingRoute: string | null;
  registryOutcome: string | null;
  nextLocation: string | null;
  sourceType: string | null;
  providerFileId: string | null;
};

/**
 * What a registration approval actually decides.
 *
 * Traced from the published "aXtn Document Management" swarm, where the
 * approval node `gate1_intake` sits AFTER the `run_intake` sub-swarm and
 * BEFORE `run_privacy`. The registry row therefore already exists by the time
 * this approval is shown, and the runtime resumes into the parked node with
 * the decision in hand: approval continues the run, rejection throws and halts
 * it. Neither outcome writes or unwinds the registry row.
 */
export const REGISTRATION_GATE_NOTE =
  "Technical registration is already complete and the registry entry exists. " +
  "Approving releases the document for further processing; rejecting halts it. " +
  "Neither decision creates or removes the registration.";

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

export function reviewSearchText(
  approval: NativeApproval,
  document?: RegisteredDocumentFacts | null,
): string {
  const registration = registrationContext(approval);
  return [
    approval.agent_name,
    approval.action_title,
    approval.description,
    approval.action_type,
    approval.risk_level,
    // A document must be findable by its NAME. The acknowledgement never
    // carries one, so the resolved registry row is what makes the queue
    // searchable the way a human actually looks for a document.
    document?.filename,
    document?.currentPath,
    document?.sourceType,
    registration?.sourceRef,
    registration?.providerFileId,
    registration?.processingStatus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * The facts a registration approval needs from the registry to be readable.
 * A structural subset of `WorkbenchDocument`, so the Reviews surface consumes
 * exactly the existing Documents contract without depending on its module.
 */
export type RegisteredDocumentFacts = {
  filename: string | null;
  sourceType: string | null;
  currentPath: string | null;
  processingStatus: string | null;
  providerFileId: string | null;
};

/**
 * The human subject of a review row.
 *
 * For registration approvals every queue entry otherwise reads "Review Intake
 * Registration", which is not triageable. The document's own filename is the
 * subject; the identifiers stay in the fields that are about identifiers.
 */
export function reviewSubject(
  approval: NativeApproval,
  document?: RegisteredDocumentFacts | null,
): string {
  const filename = document?.filename;
  if (filename && filename.trim()) return filename;
  return approval.action_title;
}

/**
 * Concise, already-established facts for one queue row. Only values that exist
 * are listed, so a row never pads itself out with placeholder dashes.
 */
export function reviewFacts(
  approval: NativeApproval,
  document?: RegisteredDocumentFacts | null,
): string[] {
  const registration = registrationContext(approval);
  if (!registration) {
    const context = reviewContext(approval);
    return [context.documentType, context.primaryDomain, context.proposedLocation].filter(
      (value): value is string => Boolean(value),
    );
  }
  return [
    "Intake registration",
    registration.sourceType ?? document?.sourceType ?? null,
    document?.currentPath ?? null,
    registration.processingStatus ?? document?.processingStatus ?? null,
    registration.processingRoute ?? null,
    approval.status === "pending" ? "pending approval" : null,
  ].filter((value): value is string => Boolean(value));
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
 * The provider's own file identifier, read back out of the source locator the
 * run actually produced ("drive:<fileId>"). It is never derived from
 * `document_id`: that is now a platform-minted opaque identity with no
 * provider information in it, and splitting it would fabricate one.
 */
function providerFileIdFromSourceRef(sourceRef: string | null): string | null {
  if (!sourceRef) return null;
  const parts = sourceRef.split(":").filter(Boolean);
  if (parts.length < 2) return null;
  return parts[parts.length - 1];
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
  const sourceRef = stringValue(ack, "source_ref", "sourceRef");
  return {
    documentId,
    sourceRef,
    accepted: typeof ack.accepted === "boolean" ? ack.accepted : null,
    processingStatus,
    processingRoute: stringValue(ack, "processing_route", "processingRoute"),
    registryOutcome: stringValue(ack, "registry_outcome", "registryOutcome"),
    nextLocation: stringValue(ack, "next_location", "nextLocation"),
    // Only ever a source kind the acknowledgement itself states. The registry
    // row supplies it otherwise; it is not guessed from an identifier.
    sourceType: stringValue(ack, "source_type", "sourceType"),
    providerFileId: providerFileIdFromSourceRef(sourceRef),
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
