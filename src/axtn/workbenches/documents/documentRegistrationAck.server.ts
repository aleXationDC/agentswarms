import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadCheckpoint } from "@/utils/swarmCheckpoint.server";
import { CaseBoundRegistrationAck } from "./documentRegistrationAck";
import { DocumentInputManifest } from "./documentWorkContract";
import { documentInputHash } from "./documentWork.server";

const PARENT_ID = "9b9ea6c2-a554-4fa7-9c40-908dad632ae7";
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
const Ingress = z.object({
  business_request_id: z.string().min(1),
  idempotency_key: z.string().trim().min(1),
  source_ref: z
    .string()
    .min(1)
    .max(500)
    .refine(
      (value) =>
        !!value.trim() &&
        !Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
    )
    .optional(),
  source_type: z.enum(["google_drive", "imap", "gmail", "mail", "fixture"]),
  source_revision: z.string().optional(),
  source_identity: z.object({
    provider_revision: z.string().optional(),
    etag: z.string().optional(),
  }),
  privacy: z.union([
    z.string(),
    z.object({ state: z.string().optional(), status: z.string().optional() }),
  ]),
  technical: z.object({
    original_sha256: z.string().optional(),
    content_hash: z.string().optional(),
  }),
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
  const checkpoint = await loadCheckpoint(args.runId, args.userId, true);
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
  const ack = CaseBoundRegistrationAck.parse(
    parseJson(checkpoint.ctx.registration_ack, "DOCUMENT_PARENT_REGISTRATION_ACK_INVALID_JSON"),
  );
  const ingress = Ingress.parse(
    parseJson(run.input_prompt ?? "", "DOCUMENT_PARENT_REGISTRATION_INGRESS_INVALID_JSON"),
  );
  const privacy = ingress.privacy;
  const expectedManifest = DocumentInputManifest.parse({
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
  if (
    documentInputHash(expectedManifest) !== ack.input_hash ||
    ack.next_location !== (expectedManifest.sourceKind === "mail" ? "00_Review" : undefined)
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
  const [caseResult, registryResult] = await Promise.all([
    supabaseAdmin
      .from("user_data_rows")
      .select("row")
      .eq("table_id", caseDataset)
      .eq("row->>case_id", ack.case_id)
      .maybeSingle(),
    supabaseAdmin
      .from("user_data_rows")
      .select("row")
      .eq("table_id", registryDataset)
      .eq("row->>source_ref", ack.source_ref)
      .maybeSingle(),
  ]);
  if (caseResult.error || registryResult.error)
    throw new Error(
      `DOCUMENT_PARENT_REGISTRATION_ROW_READ: ${
        caseResult.error?.message ?? registryResult.error?.message
      }`,
    );
  if (!caseResult.data || !registryResult.data)
    throw new Error("DOCUMENT_PARENT_REGISTRATION_PERSISTED_ROWS_REQUIRED");
  const work = StoredCase.parse(caseResult.data.row);
  const registration = StoredRegistration.parse(registryResult.data.row);
  if (
    work.case_id !== ack.case_id ||
    work.document_id !== ack.document_id ||
    work.input_hash !== ack.input_hash ||
    documentInputHash(work.document_input) !== ack.input_hash ||
    work.document_work_identity.businessRequestId !== ingress.business_request_id ||
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
