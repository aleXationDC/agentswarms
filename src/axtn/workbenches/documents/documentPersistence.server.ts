import { createHash } from "node:crypto";
import { z } from "zod";
import {
  CaseBoundRegistrationAck,
  DocumentRegistrationIngress,
  DOCUMENT_MANAGEMENT_SWARM_ID,
} from "./documentRegistrationAck";
import {
  DocumentInputManifest,
  DocumentRevision,
  DocumentWorkIdentity,
} from "./documentWorkContract";
import { documentInputHash } from "./documentWork.server";

export const DocumentMinimizedIngress = z
  .object({
    schemaVersion: z.literal("document-minimized-ingress-v1"),
    owner_scope_hash: DocumentRevision,
    business_request_hash: DocumentRevision,
    delivery_hash: DocumentRevision,
    source_ref_hash: DocumentRevision,
    source_revision_hash: DocumentRevision,
    source_kind: DocumentInputManifest.shape.sourceKind,
    content_hash: DocumentRevision,
    privacy_status: DocumentInputManifest.shape.privacyStatus,
    input_hash: DocumentRevision,
  })
  .strict();

export const DocumentMinimizedRegistrationAck = z
  .object({
    schemaVersion: z.literal("document-minimized-registration-ack-v1"),
    accepted: z.literal(true),
    case_id: z.string().uuid(),
    input_hash: DocumentRevision,
    document_id_hash: DocumentRevision,
    source_ref_hash: DocumentRevision,
    processing_status: z.literal("registered"),
    processing_route: z.literal("privacy_hold"),
    registry_outcome: CaseBoundRegistrationAck.shape.registry_outcome,
    next_location: z.literal("00_Review").optional(),
  })
  .strict();

export function documentScopedReferenceHash(userId: string, value: string): string {
  const scope = z.string().uuid().parse(userId).toLowerCase();
  return createHash("sha256").update(scope).update("\0").update(value).digest("hex");
}

export function documentOwnerScopeHash(userId: string): string {
  return documentScopedReferenceHash(userId, "document-persistence-owner-v1");
}

export const DOCUMENT_SUSPENDED_OUTPUT = '{"schemaVersion":"document-suspended-output-v1"}';
export const DOCUMENT_COMPLETED_OUTPUT = '{"schemaVersion":"document-completed-output-v1"}';
export const DOCUMENT_FAILED_OUTPUT = '{"schemaVersion":"document-failed-output-v1"}';

const documentFailureCodes = new Set([
  "DOCUMENT_RUN_IDEMPOTENCY_READ_FAILED",
  "DOCUMENT_RUN_CLAIM_FAILED",
  "DOCUMENT_RUN_OUTCOME_WRITE_FAILED",
  "DOCUMENT_PARENT_REGISTRATION_RUN_REQUIRED",
  "DOCUMENT_PARENT_REGISTRATION_RUN_READ",
  "DOCUMENT_PARENT_REGISTRATION_OWNED_RUN_REQUIRED",
  "DOCUMENT_PARENT_REGISTRATION_CHECKPOINT_REQUIRED",
  "DOCUMENT_PARENT_REGISTRATION_CACHED_RESPONSE_REQUIRED",
  "DOCUMENT_PARENT_REGISTRATION_COMPLETED_INTAKE_REQUIRED",
  "DOCUMENT_PARENT_REGISTRATION_REQUEST_BINDING_REQUIRED",
  "DOCUMENT_PARENT_REGISTRATION_DATASET_READ",
  "DOCUMENT_PARENT_REGISTRATION_OWNED_DATASET_REQUIRED",
  "DOCUMENT_PARENT_REGISTRATION_ROW_READ",
  "DOCUMENT_PARENT_REGISTRATION_PERSISTED_ROWS_REQUIRED",
  "DOCUMENT_PARENT_REGISTRATION_MINIMIZED_BINDING_REQUIRED",
  "DOCUMENT_PARENT_REGISTRATION_PERSISTED_BINDING_REQUIRED",
  "DOCUMENT_PARENT_REGISTRATION_FIRST_CASE_REQUIRED",
  "DOCUMENT_CHECKPOINT_COMPLETE_STATE_REQUIRED",
  "DOCUMENT_CHECKPOINT_WRITE_FAILED",
  "DOCUMENT_CHECKPOINT_READ_FAILED",
  "DOCUMENT_PROVENANCE_OWNED_PARENT_REQUIRED",
  "DOCUMENT_RESUME_SUSPENDED_PARENT_REQUIRED",
  "DOCUMENT_RESUME_GRAPH_REQUIRED",
  "DOCUMENT_RESUME_EXACT_ROUTING_REQUIRED",
  "DOCUMENT_RESUME_APPROVAL_DECISION_REQUIRED",
  "DOCUMENT_RESUME_CLAIM_FAILED",
  "DOCUMENT_RESUME_CLAIM_UNAVAILABLE",
]);

export function documentRunOutput(
  swarmId: string,
  status: "success" | "error" | "suspended",
  output: string,
): string {
  if (swarmId !== DOCUMENT_MANAGEMENT_SWARM_ID) return output;
  return status === "suspended"
    ? DOCUMENT_SUSPENDED_OUTPUT
    : status === "success"
      ? DOCUMENT_COMPLETED_OUTPUT
      : DOCUMENT_FAILED_OUTPUT;
}

export function documentRunError(swarmId: string, error: string | null): string | null;
export function documentRunError(
  swarmId: string,
  error: string | null | undefined,
): string | null | undefined;
export function documentRunError(
  swarmId: string,
  error: string | null | undefined,
): string | null | undefined {
  if (swarmId !== DOCUMENT_MANAGEMENT_SWARM_ID || error == null) return error;
  return documentFailureCodes.has(error) ? error : "DOCUMENT_RUN_FAILED";
}

export function documentSuspendedOutput(swarmId: string, output: string): string {
  return documentRunOutput(swarmId, "suspended", output);
}

export function documentIngressManifest(value: unknown) {
  const ingress = DocumentRegistrationIngress.parse(value);
  const privacy = ingress.privacy;
  return DocumentInputManifest.parse({
    sourceKind:
      ingress.source_type === "google_drive"
        ? "drive"
        : ingress.source_type === "fixture"
          ? "fixture"
          : "mail",
    sourceRef: ingress.source_ref ?? ingress.idempotency_key,
    sourceRevision:
      ingress.source_revision ||
      ingress.source_identity.provider_revision ||
      ingress.source_identity.etag,
    contentHash: ingress.technical.original_sha256 || ingress.technical.content_hash,
    privacyStatus: (typeof privacy === "string" ? privacy : (privacy.state ?? privacy.status))
      ?.trim()
      .toUpperCase(),
  });
}

export function minimizeDocumentIngress(userId: string, value: unknown) {
  const ingress = DocumentRegistrationIngress.parse(value);
  const manifest = documentIngressManifest(ingress);
  const businessId = DocumentWorkIdentity.shape.businessRequestId.parse(
    ingress.business_request_id,
  );
  const deliveryId = DocumentWorkIdentity.shape.deliveryId.parse(ingress.idempotency_key);
  return DocumentMinimizedIngress.parse({
    schemaVersion: "document-minimized-ingress-v1",
    owner_scope_hash: documentOwnerScopeHash(userId),
    business_request_hash: documentScopedReferenceHash(userId, businessId),
    delivery_hash: documentScopedReferenceHash(userId, deliveryId),
    source_ref_hash: documentScopedReferenceHash(userId, manifest.sourceRef),
    source_revision_hash: documentScopedReferenceHash(userId, manifest.sourceRevision),
    source_kind: manifest.sourceKind,
    content_hash: manifest.contentHash,
    privacy_status: manifest.privacyStatus,
    input_hash: documentInputHash(manifest),
  });
}

export function minimizeDocumentRegistrationAck(userId: string, value: unknown) {
  const ack = CaseBoundRegistrationAck.parse(value);
  return DocumentMinimizedRegistrationAck.parse({
    schemaVersion: "document-minimized-registration-ack-v1",
    accepted: true,
    case_id: ack.case_id,
    input_hash: ack.input_hash,
    document_id_hash: documentScopedReferenceHash(userId, ack.document_id),
    source_ref_hash: documentScopedReferenceHash(userId, ack.source_ref),
    processing_status: ack.processing_status,
    processing_route: ack.processing_route,
    registry_outcome: ack.registry_outcome,
    ...(ack.next_location !== undefined ? { next_location: ack.next_location } : {}),
  });
}

export function documentStoredIngress(userId: string, input: string): string {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error("DOCUMENT_PERSISTENCE_INGRESS_INVALID_JSON");
  }
  const alreadyMinimized =
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion === "document-minimized-ingress-v1";
  if (alreadyMinimized) {
    const parsed = DocumentMinimizedIngress.safeParse(value);
    if (!parsed.success) throw new Error("DOCUMENT_PERSISTENCE_MINIMIZED_CONTRACT_REQUIRED");
    if (parsed.data.owner_scope_hash !== documentOwnerScopeHash(userId))
      throw new Error("DOCUMENT_PERSISTENCE_MINIMIZED_OWNER_REQUIRED");
    return JSON.stringify(parsed.data);
  }
  const parsed = DocumentRegistrationIngress.safeParse(value);
  if (!parsed.success) throw new Error("DOCUMENT_PERSISTENCE_INGRESS_CONTRACT_REQUIRED");
  return JSON.stringify(minimizeDocumentIngress(userId, parsed.data));
}
