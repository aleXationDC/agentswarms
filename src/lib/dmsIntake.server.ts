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
import { classifySensitivity, derivePiiProcessingStatus, type PiiProcessingStatus } from "@/lib/privacy/sensitivityPolicy";
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
  pii_processing_status: PiiProcessingStatus;
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
  // DMS-D1-0002R Phase A3: the caller (processIntake) already knows exactly
  // what happened to the Privacy Firewall for this document — passed in
  // rather than re-derived here so buildIntakeEnvelope stays a pure, total
  // function of its inputs (no hidden "passed" default that quietly hides a
  // sanitizer error or a never-run detector).
  piiProcessingStatus: PiiProcessingStatus;
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
    pii_processing_status: args.piiProcessingStatus,
    external_processing_policy: sensitivity.externalProcessingAllowed
      ? "sanitized_allowed"
      : "blocked",
    privacy_policy_version: PRIVACY_POLICY_VERSION,
  };
}

// DMS-D1-0002R Phase A1. `input: JSON.stringify(envelope)` used to be the
// swarm's ONLY input channel, so every agent/LLM node saw Drive identity
// (drive_file_id, drive_url, filename, parent_folders, content_hash,
// timestamps) alongside the pseudonymised text — none of that is provider-
// safe, all of it is either Drive-identifying or purely local-operational.
// This allow-list is the one place that draws the line: everything the
// agent-visible channel is permitted to see, and nothing else. `opts.input`
// (the full envelope) still goes to executeSwarmServer unchanged, for
// identity reconciliation / the approval card / archival — see
// swarmExecute.server.ts's `providerSafeInput` doc comment.
const PROVIDER_SAFE_ENVELOPE_FIELDS = [
  "mime_type",
  "extraction_status",
  "extraction_error",
  "text",
  "privacy_class",
  "pii_processing_status",
  "external_processing_policy",
  "privacy_policy_version",
] as const satisfies readonly (keyof IntakeEnvelope)[];

/** The explicit, allow-listed projection of `envelope` that may reach an agent/LLM node. */
export function buildProviderSafeInput(envelope: IntakeEnvelope): string {
  const projected: Record<string, unknown> = {};
  for (const key of PROVIDER_SAFE_ENVELOPE_FIELDS) projected[key] = envelope[key];
  return JSON.stringify(projected);
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
  | { status: "duplicate"; documentId: string; reason: string }
  // DMS-D1-0002R Phase A4: the Privacy Firewall itself failed (Vault
  // lookup/insert error, sanitizer error) — distinct from "manual_review",
  // which means detection/pseudonymization succeeded but the content is
  // restricted/unreadable. A human seeing "privacy_error" knows the pipeline
  // itself broke, not merely that this document needs a human's eyes.
  | { status: "privacy_error"; documentId: string; reason: string };

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

  // DMS-D1-0002R Phase A4: the Privacy Vault call inside
  // pseudonymizeDocumentText throws on lookup/insert/config failure (by
  // design — privacyVault.server.ts fails closed). Left unguarded, that
  // exception propagated straight out of processIntake with NOTHING
  // registered: no truthful row, no record the document was ever seen. It
  // never reached an external call either way (the throw happens before
  // executeSwarmServer), but "no external call" is not the same as
  // "governed" — this makes the failure visible and terminal instead of a
  // silent gap in the registry.
  let pseudonymizedText = "";
  let privacyFirewallError: string | null = null;
  if (extraction.status === "ok" && detection?.ok) {
    try {
      ({ pseudonymizedText } = await pseudonymizeDocumentText(
        sb,
        userId,
        rawText,
        detection.findings,
      ));
    } catch (e) {
      privacyFirewallError =
        e instanceof Error ? e.message : "Privacy Vault pseudonymization failed";
    }
  }

  const detectionOk = extraction.status === "ok" && (detection?.ok ?? false) && !privacyFirewallError;
  const sensitivity = classifySensitivity({
    findings: detection?.ok ? detection.findings : [],
    contentUnknown: extraction.status !== "ok",
    sanitizerFailed: extraction.status === "ok" && !detectionOk,
  });

  const piiProcessingStatus: PiiProcessingStatus = derivePiiProcessingStatus({
    extractionOk: extraction.status === "ok",
    detectionOk,
    tier: sensitivity.tier,
    hasFindings: (detection?.ok ? detection.findings.length : 0) > 0,
  });

  const envelope = buildIntakeEnvelope({
    drive,
    contentHash,
    extraction: { status: extraction.status, error: extraction.error ?? null },
    pseudonymizedText,
    sensitivity,
    piiProcessingStatus,
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
    //
    // A privacy-firewall failure (Vault/sanitizer error) is registered with
    // its OWN classification_status ("error") rather than "discovered" — a
    // human reviewing "discovered" rows should never have to guess whether a
    // document is merely unreadable/restricted, or actively broken.
    await upsertRegistryRow(
      sb,
      userId,
      buildRegistryRow({
        envelope: envelope as unknown as Record<string, unknown>,
        proposal: {},
        humanReviewStatus: "manual",
        classificationStatus: privacyFirewallError ? "error" : "discovered",
        extraction: { status: envelope.extraction_status, error: envelope.extraction_error },
        privacy: {
          privacyClass: envelope.privacy_class,
          piiProcessingStatus: envelope.pii_processing_status,
          externalProcessingPolicy: envelope.external_processing_policy,
          policyVersion: envelope.privacy_policy_version,
        },
      }),
    );
    if (privacyFirewallError) {
      return {
        status: "privacy_error",
        documentId,
        reason: `Privacy Firewall failed closed: ${privacyFirewallError}`,
      };
    }
    return { status: "manual_review", documentId, route: "manual_review", reason: route.reason };
  }

  // Archive Knowledge (§10 / execution contract) is deliberately NOT indexed
  // here: the contract requires ingestion "only after keep/approval semantics
  // permit it". Indexing happens in resumeApprovedSwarmRun
  // (swarmResume.functions.ts) once a human has actually approved the
  // proposal, reading the pseudonymised text back out of the swarm run's
  // persisted input_prompt (the tracer already stores the full envelope
  // there — no extra plumbing needed).

  // DMS-D1-0002R Phase B: register the physical object BEFORE the Swarm call,
  // not only afterward inside the Approval-suspension path. A run that dies,
  // times out, or is killed between here and the Approval node used to leave
  // NO registry row at all for a document that was nonetheless read and sent
  // out for classification — "every disposition gets a row" (§3) did not
  // actually hold for the one path that reaches an external provider. The
  // later Approval-suspension write (swarmExecute.server.ts) still runs and
  // upserts this same document_id with the real proposal once the swarm gets
  // there; this is a native dataset upsert, never a duplicate insert.
  await upsertRegistryRow(
    sb,
    userId,
    buildRegistryRow({
      envelope: envelope as unknown as Record<string, unknown>,
      proposal: {},
      humanReviewStatus: "pending",
      classificationStatus: "processing",
      extraction: { status: envelope.extraction_status, error: envelope.extraction_error },
      privacy: {
        privacyClass: envelope.privacy_class,
        piiProcessingStatus: envelope.pii_processing_status,
        externalProcessingPolicy: envelope.external_processing_policy,
        policyVersion: envelope.privacy_policy_version,
      },
    }),
  );

  // Readable + privacy-allowed: invoke the Document Intake Swarm synchronously.
  // Every agent/LLM node only ever sees the explicit provider-safe projection
  // (Phase A1) — never Drive identity, never raw envelope metadata. `input`
  // stays the full envelope for identity reconciliation / the approval card /
  // archival, which read it directly rather than through the agent-visible
  // channel; see swarmExecute.server.ts's `providerSafeInput` doc comment.
  const runResult = await executeSwarmServer({
    swarm: args.documentIntakeSwarm,
    userId,
    origin: args.origin,
    input: JSON.stringify(envelope),
    providerSafeInput: buildProviderSafeInput(envelope),
    rejectApprovals: false,
    source: "api",
  });

  return { status: "swarm_invoked", documentId, route: "swarm", runResult };
}
