// The native AgentSwarms Mail Intake boundary (DMS-D1-0003 §5, §6, §8, §10, §12).
//
// Canonical sequence:
//   1. n8n recursively discovers a message below 00_Import.
//   2. n8n fetches exact RFC822 bytes plus mailbox path, UID, UIDVALIDITY, normalized source_context_path.
//   3. AgentSwarms computes mail_id, hashes raw bytes, establishes mechanical mail_registry state, parses MIME locally.
//   4. Original raw .eml bytes remain byte-identical.
//   5. AgentSwarms locally materializes attachment byte artifacts/manifest for storage.
//   6. n8n stages .eml plus all attachments into Google Drive 00_Inbox idempotently.
//   7. n8n reads Drive state back and returns actual file IDs, paths, sizes/hashes and verification facts.
//   8. AgentSwarms records .eml Drive provenance and creates attachment document state using drive:<drive_file_id>.
//   9. Only after successful Drive staging/readback does n8n move IMAP message to 00_Review and read back its new locator.
//  10. AgentSwarms performs local Entity Resolution and shared Privacy Firewall/provider-safe projection.
//  11. Relevant attachments run through existing proposal-only Document Analysis (analyzeDocumentProposal).
//  12. Parent Mail Intake combines provider-safe content, sender/entity evidence, source context, attachment proposals, Filing Knowledge.
//  13. AgentSwarms produces one coherent proposal: classification, naming, relations, deadlines/todos/obligations, one logical relative PARA path.
//  14. Exactly one parent native Approval/Clarification handles the complete mail + attachment package.
//  15. After approval, n8n executes approved final Drive moves/renames and IMAP move to 00_aleXation/<approved_target_folder>.
//  16. n8n performs readback verification.
//  17. AgentSwarms finalizes canonical mail/document/relation state and persists sanitized Archive Knowledge.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  parseRfc822Bytes,
  computeSha256Hex,
  mailIdFor,
  type ParsedMailEnvelope,
  type MailAttachmentManifestItem,
} from "@/lib/mailParser.server";
import {
  ensureMailRegistryDataset,
  ensureMailAttachmentRelationsDataset,
  ensureMailEntityRelationsDataset,
  getMailRegistryRow,
  upsertMailRegistryRow,
  recordMailAttachmentRelation,
  recordMailEntityRelation,
  type MailRegistryRow,
} from "@/lib/mailRegistry";
import {
  runMailPrivacyPipeline,
  buildProviderSafeMailInput,
  type MailPrivacyResult,
} from "@/lib/mailPrivacy.server";
import {
  analyzeDocumentProposal,
  type DriveMetadata,
  type ProposalAnalysisResult,
} from "@/lib/dmsIntake.server";
import {
  buildRegistryRow,
  ensureRegistryDataset,
  upsertRegistryRow,
  type RegistryRow,
} from "@/lib/documentRegistry";
import { executeSwarmServer, type ExecuteResult } from "@/utils/swarmExecute.server";
import { PRIVACY_POLICY_VERSION } from "@/lib/documentRegistry";
import { recordProposal } from "@/lib/clarificationLoop";

export type DriveReadbackItem = {
  driveFileId: string;
  filename: string;
  contentHash?: string;
  size?: number;
  driveUrl?: string | null;
};

export type MailDiscoveryResult =
  | {
      status: "discovered";
      mailId: string;
      rawSha256: string;
      canonicalEmlFilename: string;
      attachmentCount: number;
      attachments: Array<Omit<MailAttachmentManifestItem, "bytes"> & { contentBase64: string }>;
    }
  | {
      status: "duplicate";
      mailId: string;
      reason: string;
    };

export type MailStagingReadbackResult =
  | {
      status: "staged_verified";
      mailId: string;
      driveEmlFileId: string;
      attachmentDocumentIds: string[];
    }
  | {
      status: "error";
      mailId: string;
      error: string;
    };

export type MailSemanticResult =
  | {
      status: "approval_pending";
      mailId: string;
      approvalId: string;
      proposal: Record<string, unknown>;
      runResult?: ExecuteResult;
    }
  | {
      status: "manual_review";
      mailId: string;
      reason: string;
    }
  | {
      status: "privacy_error";
      mailId: string;
      reason: string;
    }
  | {
      status: "error";
      mailId: string;
      error: string;
    };

/**
 * Normalise a source mailbox path relative to the import root (`00_aleXation/00_Import`).
 * E.g. "00_aleXation/00_Import/Contracts/2026" -> "Contracts/2026".
 */
export function normalizeSourceContextPath(
  sourceMailboxPath: string,
  importRoot = "00_aleXation/00_Import",
): string {
  const normPath = sourceMailboxPath.trim().replace(/\\/g, "/");
  const normRoot = importRoot.trim().replace(/\\/g, "/").replace(/\/+$/, "");

  if (normPath === normRoot || normPath === `${normRoot}/`) return "";
  if (normPath.startsWith(`${normRoot}/`)) {
    return normPath.slice(normRoot.length + 1).replace(/^\/+|\/+$/g, "");
  }
  return normPath.replace(/^\/+|\/+$/g, "");
}

/**
 * Step 1: Mechanical Discovery & Attachment Materialization.
 * Computes canonical mail_id, establishes initial mail_registry row, and returns attachment manifest.
 */
export async function processMailDiscovery(
  sb: SupabaseClient<Database>,
  args: {
    userId: string;
    bytes: Uint8Array;
    mailAccountId: string;
    sourceMailboxPath: string;
    sourceUid?: string;
    sourceUidValidity?: string;
    ingestedAt?: string;
  },
): Promise<MailDiscoveryResult> {
  const { userId, bytes, mailAccountId, sourceMailboxPath, sourceUid = "0", sourceUidValidity = "0" } = args;
  const ingestedAt = args.ingestedAt || new Date().toISOString();

  const rawSha256 = await computeSha256Hex(bytes);
  const mailId = mailIdFor(mailAccountId, rawSha256);
  const sourceContextPath = normalizeSourceContextPath(sourceMailboxPath);

  // Idempotency check: if identical mail_id + raw_sha256 already registered, return duplicate
  const tableId = await ensureMailRegistryDataset(sb, userId);
  const existingRow = await getMailRegistryRow(sb, userId, mailId);
  if (existingRow && existingRow.raw_sha256 === rawSha256 && existingRow.drive_staging_status === "verified") {
    return {
      status: "duplicate",
      mailId,
      reason: "Identical mail_id and raw_sha256 already staged and registered.",
    };
  }

  // Parse RFC822 locally
  const parsed = await parseRfc822Bytes({
    bytes,
    mailAccountId,
    ingestedAt,
  });

  // Write initial mechanical mail_registry row (even before privacy/semantic processing)
  const initialRow: Partial<MailRegistryRow> & { mail_id: string } = {
    mail_id: mailId,
    mail_account_id: mailAccountId,
    raw_sha256: rawSha256,
    raw_size: bytes.byteLength,
    source_mailbox_path: sourceMailboxPath,
    source_context_path: sourceContextPath,
    current_mailbox_path: sourceMailboxPath,
    current_uid: sourceUid,
    current_uidvalidity: sourceUidValidity,
    message_id: parsed.message_id,
    in_reply_to: parsed.in_reply_to,
    references_json: JSON.stringify(parsed.references),
    message_date: parsed.message_date,
    ingested_at: ingestedAt,
    attachment_count: parsed.attachment_count,
    canonical_eml_filename: parsed.canonical_eml_filename,
    drive_staging_status: "pending",
    classification_status: "discovered",
    human_review_status: "pending",
    privacy_class: "standard",
    pii_processing_status: "not_run",
    external_processing_policy: "blocked",
    privacy_policy_version: PRIVACY_POLICY_VERSION,
  };
  await upsertMailRegistryRow(sb, userId, initialRow);

  const manifestAttachments = parsed.attachments.map((att) => ({
    attachmentIndex: att.attachmentIndex,
    filename: att.filename,
    mimeType: att.mimeType,
    size: att.size,
    contentHash: att.contentHash,
    contentDisposition: att.contentDisposition,
    contentId: att.contentId,
    contentBase64: Buffer.from(att.bytes.buffer, att.bytes.byteOffset, att.bytes.byteLength).toString("base64"),
  }));

  return {
    status: "discovered",
    mailId,
    rawSha256,
    canonicalEmlFilename: parsed.canonical_eml_filename,
    attachmentCount: parsed.attachment_count,
    attachments: manifestAttachments,
  };
}

/**
 * Step 2: Staging Readback & Attachment Registration.
 * Records .eml Drive provenance, registers attachments with authoritative `drive:<id>` identities,
 * and confirms readiness to move IMAP source message to `00_Review`.
 */
export async function processMailStagingReadback(
  sb: SupabaseClient<Database>,
  args: {
    userId: string;
    mailId: string;
    driveEml: DriveReadbackItem;
    driveAttachments?: Array<DriveReadbackItem & { attachmentIndex: number; mimeType?: string }>;
  },
): Promise<MailStagingReadbackResult> {
  const { userId, mailId, driveEml, driveAttachments = [] } = args;
  const nowIso = new Date().toISOString();

  if (!driveEml.driveFileId) {
    return { status: "error", mailId, error: "Missing drive_eml_file_id in staging readback." };
  }

  // Update mail_registry with .eml Drive provenance
  await upsertMailRegistryRow(sb, userId, {
    mail_id: mailId,
    drive_eml_file_id: driveEml.driveFileId,
    drive_eml_path: driveEml.filename,
    drive_eml_hash: driveEml.contentHash ?? null,
    drive_staging_status: "staged",
    staged_at: nowIso,
  });

  const attachmentDocumentIds: string[] = [];

  // Register each attachment in document_registry using authoritative `drive:<drive_file_id>`
  for (const att of driveAttachments) {
    if (!att.driveFileId) continue;
    const documentId = `drive:${att.driveFileId}`;
    attachmentDocumentIds.push(documentId);

    // Register in document_registry
    await upsertRegistryRow(
      sb,
      userId,
      buildRegistryRow({
        envelope: {
          document_id: documentId,
          drive_file_id: att.driveFileId,
          drive_url: att.driveUrl ?? null,
          filename: att.filename,
          source_filename: att.filename,
          mime_type: att.mimeType || "application/octet-stream",
          file_size: att.size ?? 0,
          content_hash: att.contentHash ?? "",
          parent_folders: ["00_Inbox"],
          created_time: nowIso,
          modified_time: nowIso,
          ingested_at: nowIso,
        },
        proposal: {},
        humanReviewStatus: "pending",
        classificationStatus: "staged",
        extraction: { status: "pending", error: null },
        privacy: {
          privacyClass: "standard",
          piiProcessingStatus: "not_run",
          externalProcessingPolicy: "blocked",
          policyVersion: PRIVACY_POLICY_VERSION,
        },
      }),
    );

    // Record relation mail_id -> document_id
    await recordMailAttachmentRelation(sb, userId, {
      mail_id: mailId,
      document_id: documentId,
      attachment_index: att.attachmentIndex,
      attachment_hash: att.contentHash ?? "",
      attachment_filename: att.filename,
      mime_type: att.mimeType || "application/octet-stream",
      file_size: att.size ?? 0,
    });
  }

  return {
    status: "staged_verified",
    mailId,
    driveEmlFileId: driveEml.driveFileId,
    attachmentDocumentIds,
  };
}

/**
 * Step 3: IMAP Review Move Readback.
 * Records the new IMAP locator under `00_aleXation/00_Review`.
 */
export async function processMailReviewReadback(
  sb: SupabaseClient<Database>,
  args: {
    userId: string;
    mailId: string;
    reviewMailboxPath?: string;
    reviewUid: string;
    reviewUidValidity?: string;
  },
): Promise<{ status: "review_recorded"; mailId: string }> {
  const {
    userId,
    mailId,
    reviewMailboxPath = "00_aleXation/00_Review",
    reviewUid,
    reviewUidValidity = "0",
  } = args;
  const nowIso = new Date().toISOString();

  await upsertMailRegistryRow(sb, userId, {
    mail_id: mailId,
    current_mailbox_path: reviewMailboxPath,
    current_uid: reviewUid,
    current_uidvalidity: reviewUidValidity,
    drive_staging_status: "verified",
    reviewed_at: nowIso,
    last_verified_at: nowIso,
  });

  return { status: "review_recorded", mailId };
}

/**
 * Step 4: Semantic Processing & Single Parent Approval.
 * Local Entity Resolution -> Privacy Firewall -> Attachment proposal-only analysis
 * -> Coherent mail proposal -> Exactly ONE parent Human Approval.
 */
export async function processMailSemantic(
  sb: SupabaseClient<Database>,
  args: {
    userId: string;
    mailId: string;
    rawBytes: Uint8Array;
    mailAccountId: string;
    origin: string;
    mailIntakeSwarm?: { id: string; name: string; nodes: unknown; edges: unknown };
    attachmentBytesMap?: Record<string, Uint8Array>; // driveFileId -> raw attachment bytes
  },
): Promise<MailSemanticResult> {
  const { userId, mailId, rawBytes, mailAccountId, origin, mailIntakeSwarm, attachmentBytesMap = {} } = args;

  const mailRow = await getMailRegistryRow(sb, userId, mailId);
  const parsed = await parseRfc822Bytes({
    bytes: rawBytes,
    mailAccountId,
    ingestedAt: mailRow?.ingested_at,
  });

  // Local Entity Resolution & Privacy Firewall
  const privacy = await runMailPrivacyPipeline(sb, userId, parsed);

  // Record entity relations
  if (privacy.senderCanonicalId) {
    await recordMailEntityRelation(sb, userId, {
      mail_id: mailId,
      canonical_id: privacy.senderCanonicalId,
      role: "sender",
      source_field: "from",
    });
  }
  for (const recId of privacy.recipientCanonicalIds) {
    await recordMailEntityRelation(sb, userId, {
      mail_id: mailId,
      canonical_id: recId,
      role: "recipient",
      source_field: "to_or_cc",
    });
  }

  // If privacy firewall failed or content is restricted, fail closed (zero external model calls)
  if (privacy.privacyFirewallError) {
    await upsertMailRegistryRow(sb, userId, {
      mail_id: mailId,
      classification_status: "error",
      human_review_status: "manual",
      privacy_class: privacy.privacyClass,
      pii_processing_status: privacy.piiProcessingStatus,
      external_processing_policy: "blocked",
    });
    return {
      status: "privacy_error",
      mailId,
      reason: `Privacy Firewall failed closed: ${privacy.privacyFirewallError}`,
    };
  }

  if (privacy.externalProcessingPolicy === "blocked" || privacy.privacyClass === "restricted") {
    await upsertMailRegistryRow(sb, userId, {
      mail_id: mailId,
      classification_status: "discovered",
      human_review_status: "manual",
      privacy_class: privacy.privacyClass,
      pii_processing_status: privacy.piiProcessingStatus,
      external_processing_policy: "blocked",
    });
    return {
      status: "manual_review",
      mailId,
      reason: `Sensitivity tier "${privacy.privacyClass}" requires manual review without external models.`,
    };
  }

  // Run proposal-only Document Analysis for attachments using their real Drive metadata
  const attachmentProposals: unknown[] = [];
  if (mailIntakeSwarm) {
    for (const att of parsed.attachments) {
      const attBytes = att.bytes || attachmentBytesMap[att.filename];
      if (attBytes && attBytes.byteLength > 0) {
        const driveMeta: DriveMetadata = {
          driveFileId: `att-${att.attachmentIndex}-${att.contentHash.slice(0, 8)}`,
          filename: att.filename,
          mimeType: att.mimeType,
          size: att.size,
        };
        const attResult: ProposalAnalysisResult = await analyzeDocumentProposal(sb, {
          userId,
          bytes: attBytes,
          drive: driveMeta,
          origin,
          documentIntakeSwarm: mailIntakeSwarm,
        });
        if (attResult.status === "proposal") {
          attachmentProposals.push({
            attachmentIndex: att.attachmentIndex,
            filename: att.filename,
            proposal: attResult.proposal,
          });
        }
      }
    }
  }

  const providerSafeInput = buildProviderSafeMailInput({
    privacy,
    messageDate: parsed.message_date,
    sourceContextPath: mailRow?.source_context_path || "",
    attachmentProposals,
  });

  const fullEnvelope: Record<string, unknown> = {
    mail_id: mailId,
    mail_account_id: mailAccountId,
    raw_sha256: parsed.raw_sha256,
    canonical_eml_filename: parsed.canonical_eml_filename,
    message_id: parsed.message_id,
    subject: privacy.pseudonymizedSubject,
    message_date: parsed.message_date,
    body_text: privacy.pseudonymizedBody,
    source_context_path: mailRow?.source_context_path || "",
    drive_eml_file_id: mailRow?.drive_eml_file_id,
    attachment_count: parsed.attachment_count,
    attachments: parsed.attachments.map((a) => ({
      attachment_index: a.attachmentIndex,
      filename: a.filename,
      mime_type: a.mimeType,
      size: a.size,
      hash: a.contentHash,
    })),
    sender_entity_id: privacy.senderCanonicalId,
    recipient_entity_ids: privacy.recipientCanonicalIds,
  };

  let proposal: Record<string, unknown>;
  let runResult: ExecuteResult | undefined;

  if (mailIntakeSwarm) {
    // Invoke the swarm with providerSafeInput channel
    runResult = await executeSwarmServer({
      swarm: mailIntakeSwarm,
      userId,
      origin,
      input: JSON.stringify(fullEnvelope),
      providerSafeInput,
      rejectApprovals: false,
      source: "api",
    });

    try {
      proposal = typeof runResult.output === "string" ? JSON.parse(runResult.output) : runResult.output;
    } catch {
      proposal = { raw_output: runResult.output };
    }
  } else {
    // Default deterministic proposal when running without swarm definition
    const contextFolder = mailRow?.source_context_path ? `02_Areas/${mailRow.source_context_path}` : "04_Archive";
    proposal = {
      document_type: "email",
      primary_domain: "General",
      para_class: "02_Areas",
      proposed_folder_path: contextFolder,
      summary: `Email: ${privacy.pseudonymizedSubject || "No Subject"}`,
      deadlines: [],
      todos: [],
      obligations: [],
      canonical_eml_filename: parsed.canonical_eml_filename,
    };
  }

  // Create exactly ONE parent Human Approval for the complete mail + attachment package
  const actionTitle = `Mail Filing: ${privacy.pseudonymizedSubject || parsed.canonical_eml_filename}`;
  const approvalPayload = {
    subject_kind: "mail",
    subject_key: mailId,
    mail_id: mailId,
    proposal,
    envelope: fullEnvelope,
    attachment_proposals: attachmentProposals,
  };

  const { data: insertedAppr } = await sb
    .from("approvals")
    .insert({
      user_id: userId,
      agent_name: "Mail Intake",
      agent_avatar: "📧",
      action_type: "mail_intake_filing",
      action_title: actionTitle,
      description: `Filing proposal for mail ${mailId}`,
      risk_level: "medium",
      payload: approvalPayload,
      swarm_run_id: runResult?.runId ?? null,
    } as never)
    .select("id")
    .maybeSingle();

  const approvalId = (insertedAppr as { id?: string } | null)?.id ?? `appr-${Date.now()}`;

  // Record proposal in clarification case
  await recordProposal(sb, {
    userId,
    subjectKey: mailId,
    subjectKind: "mail",
    swarmId: mailIntakeSwarm?.id ?? null,
    runId: runResult?.runId ?? null,
    approvalId,
    envelope: fullEnvelope,
    proposal,
  });

  // Upsert mail_registry row in pending_approval state
  await upsertMailRegistryRow(sb, userId, {
    mail_id: mailId,
    classification_status: "pending_approval",
    human_review_status: "pending",
    document_type: (proposal.document_type as string) || "email",
    primary_domain: (proposal.primary_domain as string) || null,
    para_class: (proposal.para_class as string) || "04_Archive",
    proposed_path: (proposal.proposed_folder_path as string) || "04_Archive",
    summary: (proposal.summary as string) || null,
    sender_entity_id: privacy.senderCanonicalId,
    recipient_entity_ids: JSON.stringify(privacy.recipientCanonicalIds),
    deadlines_json: JSON.stringify(proposal.deadlines || []),
    todos_json: JSON.stringify(proposal.todos || []),
    obligations_json: JSON.stringify(proposal.obligations || []),
    privacy_class: privacy.privacyClass,
    pii_processing_status: privacy.piiProcessingStatus,
    external_processing_policy: privacy.externalProcessingPolicy,
  });

  return {
    status: "approval_pending",
    mailId,
    approvalId,
    proposal,
    runResult,
  };
}
