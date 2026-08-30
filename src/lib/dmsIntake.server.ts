// The native AgentSwarms raw document-intake boundary (DMS-D1-0002 §3).
//
// This is the ONE place n8n is allowed to reach into AgentSwarms for D1: it
// takes the raw bytes n8n already downloaded from Drive, plus deterministic
// Drive metadata, and does everything the architecture requires locally,
// before anything ever reaches an external provider:
//
//   authenticate -> size bound -> SHA-256 -> document_id -> extraction
//   -> envelope -> entity resolution -> Privacy Firewall -> registry upsert
//   -> (readable+allowed) synchronous swarm run until Approval suspension
//      | (unreadable/restricted) native manual-review, no external LLM
//
// Split into pure/testable pieces (buildEnvelope, decideRoute) and one async
// orchestrator (processIntake) that does the actual DB/network work, so the
// identity-safety and routing logic can be verified without a live database.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { extractDocumentText } from "@/lib/fileParsers.server";
import { detectPii } from "@/lib/privacy/piiDetection.server";
import { pseudonymizeDocumentText } from "@/lib/privacy/pseudonymize.server";
import { classifySensitivity } from "@/lib/privacy/sensitivityPolicy";
import {
  buildRegistryRow,
  ensureRegistryDataset,
  PRIVACY_POLICY_VERSION,
  upsertRegistryRow,
  type RegistryRow,
} from "@/lib/documentRegistry";
import { executeSwarmServer, type ExecuteResult } from "@/utils/swarmExecute.server";

export type DriveMetadata = {
  driveFileId: string;
  driveUrl?: string | null;
  filename: string;
  mimeType: string;
  parentFolderIds?: string[];
  createdTime?: string | null;
  modifiedTime?: string | null;
  size?: number | null;
};

/** `drive:<drive_file_id>` — the one and only place this identity is minted. */
export function documentIdFor(driveFileId: string): string {
  return `drive:${driveFileId}`;
}

export type IntakeEnvelope = {
  document_id: string;
  drive_file_id: string;
  drive_url: string | null;
  filename: string;
  source_filename: string;
  mime_type: string;
  file_size: number;
  content_hash: string;
  parent_folders: string[];
  created_time: string | null;
  modified_time: string | null;
  ingested_at: string;
  // extraction (§4)
  extraction_status: string;
  extraction_error: string | null;
  // Text is ALWAYS the pseudonymised representation once the Privacy Firewall
  // has run — never raw extracted text — so nothing downstream (swarm nodes,
  // KB embedding) can accidentally see clear PII just because it read the
  // envelope instead of calling the vault.
  text: string;
  // privacy (§5/§7)
  privacy_class: string;
  pii_processing_status: string;
  external_processing_policy: "sanitized_allowed" | "blocked";
  privacy_policy_version: string;
};

/**
 * Build the authoritative, deterministic envelope. Every field here comes
 * from the request's own bytes/metadata or from the local pipeline outputs
 * passed in — never from a model. This is the single place downstream code
 * (registry rows, the swarm run's `input`) gets identity facts from.
 */
export function buildIntakeEnvelope(args: {
  drive: DriveMetadata;
  contentHash: string;
  extraction: { status: string; error: string | null };
  pseudonymizedText: string;
  sensitivity: { tier: string; externalProcessingAllowed: boolean };
}): IntakeEnvelope {
  const { drive, contentHash, extraction, pseudonymizedText, sensitivity } = args;
  return {
    document_id: documentIdFor(drive.driveFileId),
    drive_file_id: drive.driveFileId,
    drive_url: drive.driveUrl ?? null,
    filename: drive.filename,
    source_filename: drive.filename,
    mime_type: drive.mimeType,
    file_size: args.drive.size ?? 0,
    content_hash: contentHash,
    parent_folders: drive.parentFolderIds ?? [],
    created_time: drive.createdTime ?? null,
    modified_time: drive.modifiedTime ?? null,
    ingested_at: new Date().toISOString(),
    extraction_status: extraction.status,
    extraction_error: extraction.error,
    text: pseudonymizedText,
    privacy_class: sensitivity.tier,
    pii_processing_status: "passed",
    external_processing_policy: sensitivity.externalProcessingAllowed
      ? "sanitized_allowed"
      : "blocked",
    privacy_policy_version: PRIVACY_POLICY_VERSION,
  };
}

export type IntakeRoute =
  | { path: "swarm"; reason: string }
  | { path: "manual_review"; reason: string };

/**
 * Decide whether the readable+privacy-allowed path (invoke the Document
 * Intake Swarm) or the unreadable/restricted path (native manual review, no
 * external LLM) applies. Pure — the only inputs are extraction and privacy
 * outcomes already computed locally.
 */
export function decideIntakeRoute(args: {
  extractionStatus: string;
  sensitivityTier: string;
  externalProcessingAllowed: boolean;
}): IntakeRoute {
  if (args.extractionStatus !== "ok") {
    return {
      path: "manual_review",
      reason: `Extraction status "${args.extractionStatus}" — content is unreadable/unsupported.`,
    };
  }
  if (!args.externalProcessingAllowed || args.sensitivityTier === "restricted") {
    return {
      path: "manual_review",
      reason: `Sensitivity tier "${args.sensitivityTier}" does not allow external processing.`,
    };
  }
  return { path: "swarm", reason: "Readable and privacy-allowed." };
}

export type IntakeResult =
  | { status: "swarm_invoked"; documentId: string; route: "swarm"; runResult: ExecuteResult }
  | { status: "manual_review"; documentId: string; route: "manual_review"; reason: string }
  | { status: "duplicate"; documentId: string; reason: string };

/**
 * The full pipeline. `documentIntakeSwarm` is the already-resolved graph to
 * run (the caller — the route handler — looks it up via the API key's
 * swarm_id, exactly like /api/swarm/run does) so this function stays testable
 * without needing a real swarms table row.
 */
export async function processIntake(
  sb: SupabaseClient<Database>,
  args: {
    userId: string;
    bytes: Uint8Array;
    drive: DriveMetadata;
    origin: string;
    documentIntakeSwarm: { id: string; name: string; nodes: unknown; edges: unknown };
  },
): Promise<IntakeResult> {
  const { userId, bytes, drive } = args;
  const documentId = documentIdFor(drive.driveFileId);

  const contentHashBuf = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  const contentHash = [...new Uint8Array(contentHashBuf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // ── Idempotency ──────────────────────────────────────────────────────────
  // Repeated submission of the same Drive file/content must be idempotent
  // (§3). Same document_id AND same content_hash as an already-registered row
  // means this exact submission was already processed — do not re-run the
  // swarm (and re-bill it) or re-write the registry.
  const tableId = await ensureRegistryDataset(sb, userId);
  const { data: existingHit } = await sb
    .from("user_data_rows")
    .select("row")
    .eq("table_id", tableId)
    .eq("row->>document_id", documentId)
    .maybeSingle();
  if (existingHit?.row) {
    const existing = existingHit.row as RegistryRow;
    if (existing.content_hash === contentHash) {
      return {
        status: "duplicate",
        documentId,
        reason: "Identical document_id + content_hash already registered.",
      };
    }
  }

  const extraction = await extractDocumentText({
    bytes,
    mimeType: drive.mimeType,
    filename: drive.filename,
  });
  const rawText = (extraction.status === "ok" ? extraction.text : "") ?? "";

  const detection = extraction.status === "ok" ? await detectPii(rawText) : null;
  const sensitivity = classifySensitivity({
    findings: detection?.ok ? detection.findings : [],
    contentUnknown: extraction.status !== "ok",
    sanitizerFailed: extraction.status === "ok" && detection !== null && !detection.ok,
  });

  const { pseudonymizedText } =
    extraction.status === "ok" && detection?.ok
      ? await pseudonymizeDocumentText(sb, userId, rawText, detection.findings)
      : { pseudonymizedText: "" };

  const envelope = buildIntakeEnvelope({
    drive,
    contentHash,
    extraction: { status: extraction.status, error: extraction.error ?? null },
    pseudonymizedText,
    sensitivity,
  });

  const route = decideIntakeRoute({
    extractionStatus: extraction.status,
    sensitivityTier: sensitivity.tier,
    externalProcessingAllowed: sensitivity.externalProcessingAllowed,
  });

  if (route.path === "manual_review") {
    // No proposal exists yet — this document never reaches the swarm, so
    // nothing calls buildRegistryRow/upsertRegistryRow for it automatically
    // (that only happens inside the Approval-suspension path in
    // swarmExecute.server.ts). Register it here, directly, as discovered.
    await upsertRegistryRow(
      sb,
      userId,
      buildRegistryRow({
        envelope: envelope as unknown as Record<string, unknown>,
        proposal: {},
        humanReviewStatus: "manual",
        classificationStatus: "discovered",
        extraction: { status: envelope.extraction_status, error: envelope.extraction_error },
        privacy: {
          privacyClass: envelope.privacy_class,
          piiProcessingStatus: envelope.pii_processing_status,
          externalProcessingPolicy: envelope.external_processing_policy,
          policyVersion: envelope.privacy_policy_version,
        },
      }),
    );
    return { status: "manual_review", documentId, route: "manual_review", reason: route.reason };
  }

  // Readable + privacy-allowed: invoke the Document Intake Swarm synchronously
  // with the SANITIZED envelope as input. Registry upsert-on-proposal already
  // happens inside executeSwarmServer's Approval-suspension handling (see
  // swarmExecute.server.ts) once the swarm reaches its Approval node — this
  // function must not duplicate that write.
  const runResult = await executeSwarmServer({
    swarm: args.documentIntakeSwarm,
    userId,
    origin: args.origin,
    input: JSON.stringify(envelope),
    rejectApprovals: false,
    source: "api",
  });

  return { status: "swarm_invoked", documentId, route: "swarm", runResult };
}
