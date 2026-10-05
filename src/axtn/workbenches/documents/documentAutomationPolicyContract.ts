import { z } from "zod";
import { WorkReference } from "../cases/workContract";
import { DocumentFeedbackEvent, DocumentFeedbackRecord } from "./documentFeedbackContract";

const revision = DocumentFeedbackEvent.shape.decisionRevision;
const identifier = DocumentFeedbackEvent.shape.before.shape.family.unwrap();

export const DisabledDocumentAutomationPolicy = z
  .object({
    schemaVersion: z.literal("document-automation-policy-v1"),
    policyId: z.string().uuid(),
    caseId: z.string().uuid(),
    candidateId: z.string().uuid(),
    candidateRevision: revision,
    evaluationId: z.string().uuid(),
    evaluationRevision: revision,
    family: identifier,
    sourceKind: z.enum(["drive", "mail", "fixture"]),
    targetId: identifier.nullable(),
    operation: z.literal("CLASSIFY"),
    ruleRevision: revision,
    qualityProfile: WorkReference.refine(
      (reference) =>
        reference.kind === "contract" &&
        reference.repository === "aXtn/aXtn-agentswarms" &&
        reference.revision?.length === 40,
    ).nullable(),
    reviewTriggers: z
      .array(
        z.enum([
          "UNKNOWN_FAMILY",
          "AMBIGUOUS_TARGET",
          "SOURCE_RIGHTS_DRIFT",
          "PRIVACY_DRIFT",
          "RULE_DRIFT",
          "QUALITY_DRIFT",
          "HUMAN_OVERRIDE",
        ]),
      )
      .length(7)
      .refine(
        (triggers) => new Set(triggers).size === 7,
        "All fail-closed review triggers required",
      ),
    validFrom: z.string().datetime({ offset: true }),
    validUntil: z.string().datetime({ offset: true }),
    promotionCaseId: z.null(),
    authority: z.literal("UNAPPROVED_DISABLED_DRAFT"),
    enabled: z.literal(false),
    evidence: z
      .array(WorkReference)
      .min(1)
      .max(50)
      .refine(
        (references) => references.some((reference) => reference.kind === "evidence"),
        "Minimized policy Evidence required",
      ),
  })
  .strict()
  .superRefine((policy, ctx) => {
    if (Date.parse(policy.validUntil) <= Date.parse(policy.validFrom))
      ctx.addIssue({ code: "custom", message: "Policy validity interval must be ordered" });
  });

export const DisabledDocumentAutomationPolicyRecord = z
  .object({
    policy_id: z.string().uuid(),
    policy_key: revision,
    case_id: z.string().uuid(),
    improvement_case_id: z.string().uuid(),
    attempt_id: z.string().uuid(),
    input_hash: revision,
    revision,
    document_automation_policy: DisabledDocumentAutomationPolicy,
    principal: DocumentFeedbackRecord.shape.principal,
    created_at: z.string().datetime({ offset: true }),
    enabled: z.literal(false),
  })
  .strict()
  .superRefine((record, ctx) => {
    if (
      record.policy_id !== record.document_automation_policy.policyId ||
      record.case_id !== record.document_automation_policy.caseId ||
      record.improvement_case_id === record.case_id
    )
      ctx.addIssue({ code: "custom", message: "Disabled policy native readback binding mismatch" });
  });

export const DisabledDocumentAutomationPolicySubmission = z
  .object({
    policy: DisabledDocumentAutomationPolicy,
    attemptId: z.string().uuid(),
    inputHash: revision,
  })
  .strict();
