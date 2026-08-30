// Mail Filing Plan & Physical Projection (DMS-D1-0003 §11, §14, §16, DMS-D1-0003W §7).
//
// One logical relative PARA path (e.g. `02_Areas/Immobilien/Elektro`) is produced by
// AgentSwarms and approved by a human. After approval, the exact same relative path
// is projected to the active physical stores:
//   - Google Drive: `<managed_root>/02_Areas/Immobilien/Elektro/...`
//   - IMAP: `00_aleXation/02_Areas/Immobilien/Elektro/...`
//   - Gmail: `aleXation/PARA/02_Areas/Immobilien/Elektro`
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildCanonicalFilename } from "@/lib/canonicalFilename";
import {
  getMailRegistryRow,
  upsertMailRegistryRow,
  type MailRegistryRow,
} from "@/lib/mailRegistry";
import { indexArchiveDocument } from "@/lib/archiveKnowledge.server";

export const GMAIL_IMPORT_LABEL = "aleXation/State/Import";
export const GMAIL_REVIEW_LABEL = "aleXation/State/Review";
export const GMAIL_PARA_PREFIX = "aleXation/PARA/";

export type ApprovedAttachmentFilingItem = {
  document_id: string;
  drive_file_id: string;
  original_filename: string;
  approved_filename: string;
  approved_target_folder: string;
};

export type ApprovedMailFilingPlan = {
  mail_id: string;
  drive_eml_file_id: string | null;
  approved_target_folder: string;
  approved_eml_filename: string;
  imap_target_folder: string;
  gmail_target_label: string;
  gmail_labels_to_add: string[];
  gmail_labels_to_remove: string[];
  attachments: ApprovedAttachmentFilingItem[];
  approval_id: string | null;
};

/**
 * Prefix a relative PARA path with the canonical IMAP root `00_aleXation/`.
 */
export function buildImapTargetFolder(relativeParaPath: string): string {
  const clean = relativeParaPath.trim().replace(/^\/+|\/+$/g, "");
  return `00_aleXation/${clean}`;
}

/**
 * Prefix a relative PARA path with the canonical Gmail label prefix `aleXation/PARA/`.
 */
export function buildGmailTargetLabel(relativeParaPath: string): string {
  const clean = relativeParaPath.trim().replace(/^\/+|\/+$/g, "");
  return `${GMAIL_PARA_PREFIX}${clean}`;
}

/**
 * Build the deterministic approved filing plan for a mail and all its attachments.
 */
export function buildApprovedMailFilingPlan(args: {
  mailId: string;
  proposal: Record<string, unknown>;
  envelope: Record<string, unknown>;
  attachments?: Array<{
    document_id: string;
    drive_file_id: string;
    original_filename: string;
    proposed_folder_path?: string;
    document_date?: string;
    document_date_source?: string;
  }>;
  approvalId?: string | null;
}): ApprovedMailFilingPlan {
  const { mailId, proposal, envelope, attachments = [], approvalId = null } = args;
  const rawTargetFolder = typeof proposal.proposed_folder_path === "string"
    ? proposal.proposed_folder_path.trim()
    : "04_Archive";
  const approvedTargetFolder = rawTargetFolder.replace(/^\/+|\/+$/g, "");

  const emlCanonicalName = typeof envelope.canonical_eml_filename === "string" && envelope.canonical_eml_filename.trim()
    ? envelope.canonical_eml_filename.trim()
    : typeof proposal.canonical_eml_filename === "string" && proposal.canonical_eml_filename.trim()
      ? proposal.canonical_eml_filename.trim()
      : `${envelope.message_date || "2026-08-30"}_MAIL_${mailId.slice(0, 16)}.eml`;

  const approvedAttachments: ApprovedAttachmentFilingItem[] = attachments.map((att) => {
    const naming = buildCanonicalFilename({
      originalFilename: att.original_filename,
      documentDate: att.document_date ?? proposal.document_date,
      documentDateSource: att.document_date_source ?? proposal.document_date_source,
      arrivalDate: envelope.ingested_at ?? envelope.message_date,
    });
    return {
      document_id: att.document_id,
      drive_file_id: att.drive_file_id,
      original_filename: att.original_filename,
      approved_filename: naming.canonicalFilename || att.original_filename,
      approved_target_folder: att.proposed_folder_path?.trim() || approvedTargetFolder,
    };
  });

  const gmailTargetLabel = buildGmailTargetLabel(approvedTargetFolder);

  return {
    mail_id: mailId,
    drive_eml_file_id: typeof envelope.drive_eml_file_id === "string" ? envelope.drive_eml_file_id : null,
    approved_target_folder: approvedTargetFolder,
    approved_eml_filename: emlCanonicalName,
    imap_target_folder: buildImapTargetFolder(approvedTargetFolder),
    gmail_target_label: gmailTargetLabel,
    gmail_labels_to_add: [gmailTargetLabel],
    gmail_labels_to_remove: [GMAIL_REVIEW_LABEL],
    attachments: approvedAttachments,
    approval_id: approvalId,
  };
}

/**
 * Finalize canonical mail state and persist sanitized Archive Knowledge
 * ONLY after approval (DMS-D1-0003 §16, DMS-D1-0003W §7).
 */
export async function finalizeMailIntake(
  sb: SupabaseClient<Database>,
  userId: string,
  args: {
    mailId: string;
    approvedPath: string;
    finalImapPath?: string;
    finalImapUid?: string;
    finalGmailLabel?: string;
    providerLabelsJson?: string;
    approvalId?: string | null;
    swarmRunId?: string | null;
    pseudonymizedText?: string;
  },
): Promise<void> {
  const {
    mailId,
    approvedPath,
    finalImapPath,
    finalImapUid,
    finalGmailLabel,
    providerLabelsJson,
    approvalId,
    swarmRunId,
  } = args;
  const nowIso = new Date().toISOString();

  const mailRow = await getMailRegistryRow(sb, userId, mailId);

  const updates: Partial<MailRegistryRow> & { mail_id: string } = {
    mail_id: mailId,
    approved_path: approvedPath,
    classification_status: "finalized",
    human_review_status: "approved",
    finalized_at: nowIso,
    last_verified_at: nowIso,
  };

  if (finalImapPath) {
    updates.current_mailbox_path = finalImapPath;
    updates.current_uid = finalImapUid ?? mailRow?.current_uid ?? "0";
  }
  if (providerLabelsJson) {
    updates.provider_labels_json = providerLabelsJson;
  } else if (finalGmailLabel) {
    updates.provider_labels_json = JSON.stringify([finalGmailLabel]);
  }

  await upsertMailRegistryRow(sb, userId, updates);

  // Persist sanitized Archive Knowledge using mail_id + raw_sha256 idempotency key
  const textToIndex = args.pseudonymizedText ?? mailRow?.summary ?? "";
  if (textToIndex.trim() && mailRow?.raw_sha256) {
    try {
      await indexArchiveDocument(sb, userId, {
        documentId: mailId,
        driveFileId: mailRow.drive_eml_file_id ?? "",
        contentHash: mailRow.raw_sha256,
        sourceFilename: mailRow.canonical_eml_filename ?? mailId,
        pseudonymizedText: textToIndex,
        provenance: {
          approvalId: approvalId ?? null,
          swarmRunId: swarmRunId ?? null,
        },
      });
    } catch (e) {
      console.warn("[finalizeMailIntake] Archive Knowledge indexing failed:", (e as Error).message);
    }
  }
}
