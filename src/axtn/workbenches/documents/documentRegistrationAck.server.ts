import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadCheckpoint } from "@/utils/swarmCheckpoint.server";
import {
  CaseBoundRegistrationAck,
  DocumentRegistrationIngress,
  DOCUMENT_MANAGEMENT_SWARM_ID,
} from "./documentRegistrationAck";
import { DocumentInputManifest } from "./documentWorkContract";
import { documentInputHash } from "./documentWork.server";
import {
  DocumentMinimizedIngress,
  DocumentMinimizedRegistrationAck,
  documentIngressManifest,
  documentScopedReferenceHash,
  documentOwnerScopeHash,
} from "./documentPersistence.server";

const PARENT_ID = DOCUMENT_MANAGEMENT_SWARM_ID;
const INTAKE_ID = "62bbd9a0-2fb3-4241-828d-584fa76edc74";
const Snapshot = z.object({
  nodes: z.array(
    z.object({
      id: z.string().min(1),
      data: z.object({
        kind: z.string(),
        outputVar: z.string().optional(),
        subSwarmId: z.string().optional(),
      }),
    }),
  ),
});
const StoredCase = z.object({
  case_id: z.string().uuid(),
  source_kind: z.literal("document_work"),
  case_type: z.literal("DOCUMENT_PROCESSING"),
  document_id: z.string().min(1),
  input_hash: z.string().regex(/^[a-f0-9]{64}$/),
  document_input: DocumentInputManifest,
  document_work_identity: z.object({ businessRequestId: z.string().min(1) }),
});
const StoredRegistration = z.object({
  document_id: z.string().min(1),
  source_ref: z.string().min(1),
  intake_case_id: z.string().uuid(),
});

function parseJson(value: string, code: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(code);
  }
}

/** Registration readback only; an ACK never completes the parked workflow. */
export async function readDocumentParentRegistrationAck(args: {
  userId: string;
  swarmId: string;
  runId: string | null;
}) {
  if (args.swarmId !== PARENT_ID) return null;
  if (!args.runId) throw new Error("DOCUMENT_PARENT_REGISTRATION_RUN_REQUIRED");
  const { data: run, error: runError } = await supabaseAdmin
    .from("swarm_runs")
    .select("id, status, input_prompt, swarm_snapshot")
    .eq("id", args.runId)
    .eq("user_id", args.userId)
    .eq("swarm_id", PARENT_ID)
    .maybeSingle();
  if (runError) throw new Error(`DOCUMENT_PARENT_REGISTRATION_RUN_READ: ${runError.message}`);
  if (!run) throw new Error("DOCUMENT_PARENT_REGISTRATION_OWNED_RUN_REQUIRED");
  if (run.status !== "suspended") return null;
  const checkpoint = await loadCheckpoint(args.runId, args.userId, "document");
  if (!checkpoint) throw new Error("DOCUMENT_PARENT_REGISTRATION_CHECKPOINT_REQUIRED");
  const snapshot = Snapshot.parse(run.swarm_snapshot);
  const writers = snapshot.nodes.filter((node) => node.data.outputVar === "registration_ack");
  const intake = writers[0];
  if (
    writers.length !== 1 ||
    intake.data.kind !== "subswarm" ||
    intake.data.subSwarmId !== INTAKE_ID ||
    !checkpoint.completedNodeIds.includes(intake.id) ||
    checkpoint.skippedNodeIds.includes(intake.id) ||
    !checkpoint.suspendedNodeId ||
    !snapshot.nodes.some(
      (node) => node.id === checkpoint.suspendedNodeId && node.data.kind === "approval",
    )
  )
    throw new Error("DOCUMENT_PARENT_REGISTRATION_COMPLETED_INTAKE_REQUIRED");
  const rawAck = parseJson(
    checkpoint.ctx.registration_ack,
    "DOCUMENT_PARENT_REGISTRATION_ACK_INVALID_JSON",
  );
  const minimizedAck =
    rawAck &&
    typeof rawAck === "object" &&
    "schemaVersion" in rawAck &&
    rawAck.schemaVersion === "document-minimized-registration-ack-v1"
      ? DocumentMinimizedRegistrationAck.parse(rawAck)
      : null;
  const storedAck = minimizedAck ?? CaseBoundRegistrationAck.parse(rawAck);
  const rawIngress = parseJson(
    run.input_prompt ?? "",
    "DOCUMENT_PARENT_REGISTRATION_INGRESS_INVALID_JSON",
  );
  const minimizedIngress =
    rawIngress &&
    typeof rawIngress === "object" &&
    "schemaVersion" in rawIngress &&
    rawIngress.schemaVersion === "document-minimized-ingress-v1"
      ? DocumentMinimizedIngress.parse(rawIngress)
      : null;
  const ingress = minimizedIngress ? null : DocumentRegistrationIngress.parse(rawIngress);
  const expectedManifest = ingress ? documentIngressManifest(ingress) : null;
  if (
    expectedManifest &&
    (documentInputHash(expectedManifest) !== storedAck.input_hash ||
      storedAck.next_location !==
        (expectedManifest.sourceKind === "mail" ? "00_Review" : undefined))
  )
    throw new Error("DOCUMENT_PARENT_REGISTRATION_REQUEST_BINDING_REQUIRED");
  async function dataset(name: string) {
    const { data, error } = await supabaseAdmin
      .from("user_data_tables")
      .select("id")
      .eq("user_id", args.userId)
      .eq("name", name)
      .maybeSingle();
    if (error) throw new Error(`DOCUMENT_PARENT_REGISTRATION_DATASET_READ: ${error.message}`);
    if (!data) throw new Error("DOCUMENT_PARENT_REGISTRATION_OWNED_DATASET_REQUIRED");
    return data.id;
  }
  const [caseDataset, registryDataset] = await Promise.all([
    dataset("axtn_cases"),
    dataset("axtn_document_registry"),
  ]);
  const caseResult = await supabaseAdmin
    .from("user_data_rows")
    .select("row")
    .eq("table_id", caseDataset)
    .eq("row->>case_id", storedAck.case_id)
    .maybeSingle();
  if (caseResult.error)
    throw new Error(`DOCUMENT_PARENT_REGISTRATION_ROW_READ: ${caseResult.error.message}`);
  if (!caseResult.data) throw new Error("DOCUMENT_PARENT_REGISTRATION_PERSISTED_ROWS_REQUIRED");
  const work = StoredCase.parse(caseResult.data.row);
  const ack = minimizedAck
    ? CaseBoundRegistrationAck.parse({
        accepted: minimizedAck.accepted,
        case_id: minimizedAck.case_id,
        input_hash: minimizedAck.input_hash,
        document_id: work.document_id,
        source_ref: work.document_input.sourceRef,
        processing_status: minimizedAck.processing_status,
        processing_route: minimizedAck.processing_route,
        registry_outcome: minimizedAck.registry_outcome,
        ...(minimizedAck.next_location !== undefined
          ? { next_location: minimizedAck.next_location }
          : {}),
      })
    : CaseBoundRegistrationAck.parse(rawAck);
  const scopedHash = (value: string) => documentScopedReferenceHash(args.userId, value);
  if (
    (minimizedAck &&
      (minimizedAck.document_id_hash !== scopedHash(work.document_id) ||
        minimizedAck.source_ref_hash !== scopedHash(work.document_input.sourceRef))) ||
    (minimizedIngress &&
      (minimizedIngress.owner_scope_hash !== documentOwnerScopeHash(args.userId) ||
        minimizedIngress.business_request_hash !==
          scopedHash(work.document_work_identity.businessRequestId) ||
        minimizedIngress.source_ref_hash !== scopedHash(work.document_input.sourceRef) ||
        minimizedIngress.source_revision_hash !== scopedHash(work.document_input.sourceRevision) ||
        minimizedIngress.input_hash !== work.input_hash ||
        minimizedIngress.content_hash !== work.document_input.contentHash ||
        minimizedIngress.source_kind !== work.document_input.sourceKind ||
        minimizedIngress.privacy_status !== work.document_input.privacyStatus ||
        (minimizedIngress.source_kind === "mail" && ack.next_location !== "00_Review") ||
        (minimizedIngress.source_kind !== "mail" && ack.next_location !== undefined)))
  )
    throw new Error("DOCUMENT_PARENT_REGISTRATION_MINIMIZED_BINDING_REQUIRED");
  const registryResult = await supabaseAdmin
    .from("user_data_rows")
    .select("row")
    .eq("table_id", registryDataset)
    .eq("row->>source_ref", work.document_input.sourceRef)
    .maybeSingle();
  if (registryResult.error)
    throw new Error(`DOCUMENT_PARENT_REGISTRATION_ROW_READ: ${registryResult.error.message}`);
  if (!registryResult.data) throw new Error("DOCUMENT_PARENT_REGISTRATION_PERSISTED_ROWS_REQUIRED");
  const registration = StoredRegistration.parse(registryResult.data.row);
  if (
    work.case_id !== ack.case_id ||
    work.document_id !== ack.document_id ||
    work.input_hash !== ack.input_hash ||
    documentInputHash(work.document_input) !== ack.input_hash ||
    (ingress && work.document_work_identity.businessRequestId !== ingress.business_request_id) ||
    work.document_input.sourceRef !== ack.source_ref ||
    registration.document_id !== ack.document_id ||
    registration.source_ref !== ack.source_ref
  )
    throw new Error("DOCUMENT_PARENT_REGISTRATION_PERSISTED_BINDING_REQUIRED");
  // The Registry retains its first Intake Case; another explicit request for
  // the same document has its own Case, not a rewritten primary pointer.
  if (registration.intake_case_id !== ack.case_id) {
    const { data, error } = await supabaseAdmin
      .from("user_data_rows")
      .select("row")
      .eq("table_id", caseDataset)
      .eq("row->>case_id", registration.intake_case_id)
      .maybeSingle();
    if (error) throw new Error(`DOCUMENT_PARENT_REGISTRATION_FIRST_CASE_READ: ${error.message}`);
    if (!data) throw new Error("DOCUMENT_PARENT_REGISTRATION_FIRST_CASE_REQUIRED");
    const first = StoredCase.parse(data.row);
    if (
      first.case_id !== registration.intake_case_id ||
      first.document_id !== ack.document_id ||
      first.document_input.sourceRef !== ack.source_ref ||
      documentInputHash(first.document_input) !== first.input_hash
    )
      throw new Error("DOCUMENT_PARENT_REGISTRATION_PERSISTED_BINDING_REQUIRED");
  }
  return ack;
}
