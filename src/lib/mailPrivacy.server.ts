// Shared Privacy Firewall & Provider-Safe Projection for Mail Intake (DMS-D1-0003 §8).
//
// Binding local order:
//   raw RFC822 -> local MIME/header parse -> local Entity Resolution
//   -> local privacy/sensitivity processing -> pseudonymization/provider-safe projection
//   -> semantic Swarm/provider/embedding
//
// Entity Resolution occurs BEFORE pseudonymization and reuses the canonical entity IDs
// from the shared local resolver foundation (entityResolution.server.ts).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveEntity, registerCandidateEntity } from "@/lib/privacy/entityResolution.server";
import { detectPii } from "@/lib/privacy/piiDetection.server";
import { pseudonymizeDocumentText } from "@/lib/privacy/pseudonymize.server";
import {
  classifySensitivity,
  derivePiiProcessingStatus,
  type PiiProcessingStatus,
} from "@/lib/privacy/sensitivityPolicy";
import { PRIVACY_POLICY_VERSION } from "@/lib/documentRegistry";
import type { ParsedMailEnvelope } from "@/lib/mailParser.server";

export type ResolvedMailEntities = {
  senderCanonicalId: string | null;
  recipientCanonicalIds: string[];
};

export type MailPrivacyResult = {
  pseudonymizedSubject: string;
  pseudonymizedBody: string;
  senderCanonicalId: string | null;
  recipientCanonicalIds: string[];
  privacyClass: string;
  piiProcessingStatus: PiiProcessingStatus;
  externalProcessingPolicy: "sanitized_allowed" | "blocked";
  privacyPolicyVersion: string;
  privacyFirewallError: string | null;
};

export type ProviderSafeMailInput = {
  subject: string;
  body: string;
  sender_entity_id: string | null;
  recipient_entity_ids: string[];
  message_date: string;
  source_context_path: string;
  attachment_proposals: unknown[];
  privacy_class: string;
  pii_processing_status: PiiProcessingStatus;
  external_processing_policy: "sanitized_allowed" | "blocked";
  privacy_policy_version: string;
};

/**
 * Resolve sender and recipient entities using the shared entity resolution foundation
 * BEFORE pseudonymization. Never guesses: unknown entities are registered as candidates.
 */
export async function resolveMailEntities(
  sb: SupabaseClient<Database>,
  userId: string,
  mail: ParsedMailEnvelope,
): Promise<ResolvedMailEntities> {
  let senderCanonicalId: string | null = null;
  if (mail.from?.address) {
    const res = await resolveEntity(sb, userId, {
      entityType: "email",
      rawValue: mail.from.address,
    });
    if (res.status === "matched") {
      senderCanonicalId = res.canonicalId;
    } else {
      const reg = await registerCandidateEntity(sb, userId, {
        entityType: "email",
        rawValue: mail.from.address,
      });
      senderCanonicalId = reg.canonicalId;
    }
  }

  const recipientCanonicalIds: string[] = [];
  const allRecipients = [...mail.to, ...mail.cc];
  for (const rec of allRecipients) {
    if (!rec.address) continue;
    const res = await resolveEntity(sb, userId, {
      entityType: "email",
      rawValue: rec.address,
    });
    if (res.status === "matched") {
      recipientCanonicalIds.push(res.canonicalId);
    } else {
      const reg = await registerCandidateEntity(sb, userId, {
        entityType: "email",
        rawValue: rec.address,
      });
      recipientCanonicalIds.push(reg.canonicalId);
    }
  }

  return { senderCanonicalId, recipientCanonicalIds };
}

/**
 * Run the shared local privacy pipeline on mail content:
 * Entity resolution -> PII detection -> Privacy Vault pseudonymization -> sensitivity classification.
 */
export async function runMailPrivacyPipeline(
  sb: SupabaseClient<Database>,
  userId: string,
  mail: ParsedMailEnvelope,
): Promise<MailPrivacyResult> {
  // Step 1: Entity Resolution before pseudonymization
  const { senderCanonicalId, recipientCanonicalIds } = await resolveMailEntities(sb, userId, mail);

  // Step 2: PII Detection on text and subject
  const fullTextToScan = `Subject: ${mail.subject}\n\n${mail.body_text}`;
  const detection = await detectPii(fullTextToScan);

  let pseudonymizedSubject = mail.subject;
  let pseudonymizedBody = mail.body_text;
  let privacyFirewallError: string | null = null;

  if (detection?.ok) {
    try {
      if (mail.body_text.trim()) {
        const resBody = await pseudonymizeDocumentText(sb, userId, mail.body_text, detection.findings);
        pseudonymizedBody = resBody.pseudonymizedText;
      }
      if (mail.subject.trim()) {
        const resSub = await pseudonymizeDocumentText(sb, userId, mail.subject, detection.findings);
        pseudonymizedSubject = resSub.pseudonymizedText;
      }
    } catch (e) {
      privacyFirewallError =
        e instanceof Error ? e.message : "Privacy Vault pseudonymization failed";
    }
  }

  const detectionOk = (detection?.ok ?? false) && !privacyFirewallError;
  const sensitivity = classifySensitivity({
    findings: detection?.ok ? detection.findings : [],
    contentUnknown: false,
    sanitizerFailed: !detectionOk,
  });

  const piiProcessingStatus = derivePiiProcessingStatus({
    extractionOk: true,
    detectionOk,
    tier: sensitivity.tier,
    hasFindings: (detection?.ok ? detection.findings.length : 0) > 0,
  });

  return {
    pseudonymizedSubject,
    pseudonymizedBody,
    senderCanonicalId,
    recipientCanonicalIds,
    privacyClass: sensitivity.tier,
    piiProcessingStatus,
    externalProcessingPolicy: sensitivity.externalProcessingAllowed ? "sanitized_allowed" : "blocked",
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    privacyFirewallError,
  };
}

/**
 * Build the explicit provider-safe input JSON for the Mail Intake Swarm.
 * Allows ONLY safe pseudonymized and canonical fields — no raw emails, no clear names, no Drive IDs.
 */
export function buildProviderSafeMailInput(args: {
  privacy: MailPrivacyResult;
  messageDate: string;
  sourceContextPath: string;
  attachmentProposals: unknown[];
}): string {
  const safe: ProviderSafeMailInput = {
    subject: args.privacy.pseudonymizedSubject,
    body: args.privacy.pseudonymizedBody,
    sender_entity_id: args.privacy.senderCanonicalId,
    recipient_entity_ids: args.privacy.recipientCanonicalIds,
    message_date: args.messageDate,
    source_context_path: args.sourceContextPath,
    attachment_proposals: args.attachmentProposals,
    privacy_class: args.privacy.privacyClass,
    pii_processing_status: args.privacy.piiProcessingStatus,
    external_processing_policy: args.privacy.externalProcessingPolicy,
    privacy_policy_version: args.privacy.privacyPolicyVersion,
  };
  return JSON.stringify(safe);
}
