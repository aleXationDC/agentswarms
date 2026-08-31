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
import {
  classifySensitivity,
  derivePiiProcessingStatus,
  evaluateNoAiPolicy,
  hasNoAiMarker,
  type NoAiPolicyEvaluation,
  type PiiProcessingStatus,
} from "@/lib/privacy/sensitivityPolicy";
import {
  buildRegistryRow,
  ensureRegistryDataset,
  PRIVACY_POLICY_VERSION,
  upsertRegistryRow,
  type RegistryRow,
} from "@/lib/documentRegistry";
import { executeSwarmServer, type ExecuteResult } from "@/utils/swarmExecute.server";
import { geminiChatStream } from "@/utils/providers/adapters/gemini.server";
import { resolveIntegrationConfig } from "@/utils/providers/integrationConfig.server";

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
  // canonical NO AI policy (§4)
  no_ai_detected: boolean;
  no_ai_source: string | null;
  ai_processing_allowed: boolean;
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
  noAi?: { noAiDetected: boolean; noAiSource: string | null; aiProcessingAllowed: boolean };
  pseudonymizedText: string;
  sensitivity: { tier: string; externalProcessingAllowed: boolean };
  // DMS-D1-0002R Phase A3: the caller (processIntake) already knows exactly
  // what happened to the Privacy Firewall for this document — passed in
  // rather than re-derived here so buildIntakeEnvelope stays a pure, total
  // function of its inputs (no hidden "passed" default that quietly hides a
  // sanitizer error or a never-run detector).
  piiProcessingStatus: PiiProcessingStatus;
}): IntakeEnvelope {
  const { drive, contentHash, extraction, pseudonymizedText, sensitivity, noAi } = args;
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
    no_ai_detected: noAi?.noAiDetected ?? false,
    no_ai_source: noAi?.noAiSource ?? null,
    ai_processing_allowed: noAi?.aiProcessingAllowed ?? true,
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
  | { path: "swarm"; reason: string; stage?: "stage1_triage" | "stage2_semantics" }
  | { path: "manual_review"; reason: string; stage: "stage0_only" | "stage1_triage" };

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
  isNoAi?: boolean;
}): IntakeRoute {
  if (args.isNoAi) {
    return {
      path: "manual_review",
      stage: "stage0_only",
      reason: "Excluded from AI/ML processing via NO AI: policy marker (DMS-D1-0005-DOCUMENTS-v3 §4).",
    };
  }
  if (args.extractionStatus !== "ok") {
    return {
      path: "manual_review",
      stage: "stage0_only",
      reason: `Extraction status "${args.extractionStatus}" — content is unreadable/unsupported.`,
    };
  }
  if (!args.externalProcessingAllowed || args.sensitivityTier === "restricted") {
    return {
      path: "manual_review",
      stage: "stage0_only",
      reason: `Sensitivity tier "${args.sensitivityTier}" does not allow external processing.`,
    };
  }
  return { path: "swarm", stage: "stage2_semantics", reason: "Readable and privacy-allowed." };
}

export type Stage1TriageResult = {
  documentFamily?: string;
  primaryDomain?: string;
  needsStage2: boolean;
  reason?: string;
  provider: "gemini";
  model: "gemini-3.5-flash-lite";
};

export async function runStage1Triage(args: {
  apiKey: string;
  providerSafeText: string;
  mimeType: string;
}): Promise<Stage1TriageResult> {
  const { apiKey, providerSafeText, mimeType } = args;
  try {
    const stream = await geminiChatStream({
      apiKey,
      modelId: "gemini-3.5-flash-lite",
      systemPrompt:
        "You are DMS Triage Stage 1 for aleXation One. Triage the supplied provider-safe document text excerpt. Return ONLY valid JSON with fields: document_family (string or null), primary_domain (string or null), needs_stage2 (boolean - true if full semantic analysis/proposal is required), reason (string).",
      messages: [
        {
          role: "user",
          content: `MIME: ${mimeType}\nProvider-Safe Content Excerpt:\n${providerSafeText.slice(0, 4000)}`,
        },
      ],
      temperature: 0.1,
      maxTokens: 500,
    });
    const reader = stream.body?.getReader();
    if (!reader) {
      return { needsStage2: true, provider: "gemini", model: "gemini-3.5-flash-lite", reason: "Stream unavailable" };
    }
    const decoder = new TextDecoder();
    let accumulated = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
    }
    let jsonText = "";
    for (const line of accumulated.split("\n")) {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6).trim();
        if (payload && payload !== "[DONE]") {
          try {
            const parsed = JSON.parse(payload);
            jsonText += parsed.choices?.[0]?.delta?.content || "";
          } catch {}
        }
      }
    }
    if (!jsonText) jsonText = accumulated;
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        documentFamily: parsed.document_family ?? undefined,
        primaryDomain: parsed.primary_domain ?? undefined,
        needsStage2: typeof parsed.needs_stage2 === "boolean" ? parsed.needs_stage2 : true,
        reason: parsed.reason ?? "Stage 1 triage complete",
        provider: "gemini",
        model: "gemini-3.5-flash-lite",
      };
    }
    return { needsStage2: true, provider: "gemini", model: "gemini-3.5-flash-lite", reason: "Fallback to Stage 2" };
  } catch (err: any) {
    return { needsStage2: true, provider: "gemini", model: "gemini-3.5-flash-lite", reason: `Stage 1 error: ${err.message}` };
  }
}

export type IntakeResult =
  | {
      status: "swarm_invoked";
      documentId: string;
      route: "swarm";
      runResult: ExecuteResult;
      stage: "stage2_semantics";
      triage?: Stage1TriageResult;
    }
  | {
      status: "manual_review";
      documentId: string;
      route: "manual_review";
      reason: string;
      stage: "stage0_only" | "stage1_triage";
    }
  | { status: "duplicate"; documentId: string; reason: string; stage: "stage0_only" }
  // DMS-D1-0002R Phase A4: the Privacy Firewall itself failed (Vault
  // lookup/insert error, sanitizer error) — distinct from "manual_review",
  // which means detection/pseudonymization succeeded but the content is
  // restricted/unreadable. A human seeing "privacy_error" knows the pipeline
  // itself broke, not merely that this document needs a human's eyes.
  | { status: "privacy_error"; documentId: string; reason: string; stage: "stage0_only" };

/**
 * The local pipeline shared by every intake entry point: Stage 0 deterministic
 * checks + NO-AI marker check -> extraction (if AI allowed) -> local PII detection
 * -> Privacy Firewall (entity resolution + Vault pseudonymisation, fail-closed
 * and governed) -> deterministic envelope -> route decision.
 */
async function runLocalPrivacyPipeline(
  sb: SupabaseClient<Database>,
  userId: string,
  args: { bytes: Uint8Array; drive: DriveMetadata; contentHash: string },
): Promise<{
  envelope: IntakeEnvelope;
  route: IntakeRoute;
  privacyFirewallError: string | null;
  isNoAi: boolean;
}> {
  const { bytes, drive, contentHash } = args;

  // ── Stage 0: NO AI Deterministic Policy Check ─────────────────────────────
  const noAiEvaluation = evaluateNoAiPolicy({
    filename: drive.filename,
    subject: null,
    manualFlag: false,
  });

  if (!noAiEvaluation.ai_processing_allowed) {
    const sensitivity = classifySensitivity({
      findings: [],
      isNoAi: true,
    });
    const envelope = buildIntakeEnvelope({
      drive,
      contentHash,
      extraction: {
        status: "no_ai_excluded",
        error: "Excluded from AI/ML processing via NO AI: policy marker (DMS-D1-0005-DOCUMENTS-v3 §4).",
      },
      noAi: {
        noAiDetected: noAiEvaluation.no_ai_detected,
        noAiSource: noAiEvaluation.no_ai_source,
        aiProcessingAllowed: noAiEvaluation.ai_processing_allowed,
      },
      pseudonymizedText: "",
      sensitivity,
      piiProcessingStatus: "not_run",
    });
    const route = decideIntakeRoute({
      extractionStatus: "no_ai_excluded",
      sensitivityTier: sensitivity.tier,
      externalProcessingAllowed: false,
      isNoAi: true,
    });
    return { envelope, route, privacyFirewallError: null, isNoAi: true };
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
  // exception propagated straight out with NOTHING registered: no truthful
  // row, no record the document was ever seen. It never reached an external
  // call either way (the throw happens before executeSwarmServer), but "no
  // external call" is not the same as "governed" — this makes the failure
  // visible and terminal instead of a silent gap in the registry.
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
    noAi: {
      noAiDetected: false,
      noAiSource: null,
      aiProcessingAllowed: true,
    },
    pseudonymizedText,
    sensitivity,
    piiProcessingStatus,
  });

  const route = decideIntakeRoute({
    extractionStatus: extraction.status,
    sensitivityTier: sensitivity.tier,
    externalProcessingAllowed: sensitivity.externalProcessingAllowed,
  });

  return { envelope, route, privacyFirewallError, isNoAi: false };
}

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
        stage: "stage0_only",
      };
    }
  }

  const { envelope, route, privacyFirewallError } = await runLocalPrivacyPipeline(sb, userId, {
    bytes,
    drive,
    contentHash,
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
        noAi: {
          noAiDetected: envelope.no_ai_detected,
          noAiSource: envelope.no_ai_source,
          aiProcessingAllowed: envelope.ai_processing_allowed,
        },
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
        stage: "stage0_only",
      };
    }
    return {
      status: "manual_review",
      documentId,
      route: "manual_review",
      reason: route.reason,
      stage: route.stage,
    };
  }

  // ── Stage 1: Native Flash-Lite Triage ────────────────────────────────────
  let triageResult: Stage1TriageResult | undefined;
  try {
    const { data: rows } = await sb
      .from("integrations")
      .select("config, is_active")
      .eq("user_id", userId)
      .eq("provider", "gemini")
      .eq("type", "llm_provider")
      .eq("is_active", true)
      .order("updated_at", { ascending: false });
    if (rows && rows.length > 0) {
      const cfg = await resolveIntegrationConfig(
        userId,
        "llm_provider",
        (rows[0].config ?? {}) as Record<string, unknown>,
      );
      const geminiApiKey = (cfg.api_key as string) || (cfg.apiKey as string) || "";
      if (geminiApiKey) {
        triageResult = await runStage1Triage({
          apiKey: geminiApiKey,
          providerSafeText: envelope.text,
          mimeType: envelope.mime_type,
        });
      }
    }
  } catch (err) {
    console.warn("[Stage1Triage] error during Stage 1 triage:", err);
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
      noAi: {
        noAiDetected: envelope.no_ai_detected,
        noAiSource: envelope.no_ai_source,
        aiProcessingAllowed: envelope.ai_processing_allowed,
      },
      extraction: { status: envelope.extraction_status, error: envelope.extraction_error },
      privacy: {
        privacyClass: envelope.privacy_class,
        piiProcessingStatus: envelope.pii_processing_status,
        externalProcessingPolicy: envelope.external_processing_policy,
        policyVersion: envelope.privacy_policy_version,
      },
    }),
  );

  // Readable + privacy-allowed: invoke Stage 2 (Document Intake Swarm with Google gemini-3.7-flash) synchronously.
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

  return {
    status: "swarm_invoked",
    documentId,
    route: "swarm",
    runResult,
    stage: "stage2_semantics",
    triage: triageResult,
  };
}

// ── DMS-D1-0002R Phase D ─────────────────────────────────────────────────────
export type ProposalAnalysisResult =
  | { status: "proposal"; documentId: string; proposal: string; runId: string | null }
  | { status: "manual_review"; documentId: string; reason: string }
  | { status: "privacy_error"; documentId: string; reason: string }
  | { status: "error"; documentId: string; error: string; runId: string | null };

/**
 * A genuinely standalone, independently-callable "proposal-only Document
 * Analysis": runs the SAME local privacy pipeline and the SAME classification
 * swarm as `processIntake`, but never creates a Human Approval object, never
 * writes to the document_registry, never touches Archive Knowledge, and can
 * never reach a final filing-state transition — reaching the swarm's
 * Approval node stops the run immediately (executeSwarmServer's
 * `proposalOnly` mode) rather than parking a checkpoint. That makes this safe
 * to call independently, any number of times, for N attachments (a future
 * Mail Intake use) without leaving N pending reviews or N orphaned parked
 * runs behind — the whole point of "reusable, no Approval, no mutation".
 *
 * Deliberately NOT exported from processIntake's own call path: Document
 * Intake's one top-level flow keeps using processIntake (which DOES register
 * and DOES let the swarm reach a real Approval). This function is the seam a
 * caller who wants classification WITHOUT any of that reaches for instead.
 */
export async function analyzeDocumentProposal(
  sb: SupabaseClient<Database>,
  args: {
    userId: string;
    bytes: Uint8Array;
    drive: DriveMetadata;
    origin: string;
    documentIntakeSwarm: { id: string; name: string; nodes: unknown; edges: unknown };
  },
): Promise<ProposalAnalysisResult> {
  const { userId, bytes, drive } = args;
  const documentId = documentIdFor(drive.driveFileId);

  const contentHashBuf = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  const contentHash = [...new Uint8Array(contentHashBuf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { envelope, route, privacyFirewallError } = await runLocalPrivacyPipeline(sb, userId, {
    bytes,
    drive,
    contentHash,
  });

  if (privacyFirewallError) {
    return {
      status: "privacy_error",
      documentId,
      reason: `Privacy Firewall failed closed: ${privacyFirewallError}`,
    };
  }
  if (route.path === "manual_review") {
    return { status: "manual_review", documentId, reason: route.reason };
  }

  const runResult = await executeSwarmServer({
    swarm: args.documentIntakeSwarm,
    userId,
    origin: args.origin,
    input: JSON.stringify(envelope),
    providerSafeInput: buildProviderSafeInput(envelope),
    rejectApprovals: false,
    proposalOnly: true,
    source: "api",
  });

  if (runResult.status === "proposal") {
    return { status: "proposal", documentId, proposal: runResult.output, runId: runResult.runId };
  }
  if (runResult.status === "error") {
    return {
      status: "error",
      documentId,
      error: runResult.error ?? "Document analysis run failed",
      runId: runResult.runId,
    };
  }
  // "success" (no approval node in this swarm at all) or "suspended" (should
  // be unreachable under proposalOnly, since that mode never creates a
  // checkpoint) — both surfaced as a proposal so callers have one happy path.
  return { status: "proposal", documentId, proposal: runResult.output, runId: runResult.runId };
}
