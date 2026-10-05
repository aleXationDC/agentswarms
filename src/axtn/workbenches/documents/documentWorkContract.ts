import { z } from "zod";
import { WorkReference, WorkRequest } from "../cases/workContract";
import { DocumentFeedbackEvent } from "./documentFeedbackContract";
import { DocumentLearningCandidate } from "./documentCandidateContract";
import { DocumentEvaluationSubmission } from "./documentEvaluationContract";
import { DisabledDocumentAutomationPolicySubmission } from "./documentAutomationPolicyContract";
import { CaseEnvironmentRequest } from "../cases/caseEnvironmentContract";
import { CaseProcessingRequest } from "../cases/caseProcessingContract";

const opaque = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (value) =>
      value.trim().length > 0 &&
      !Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
    "A nonempty opaque identity without control characters is required",
  );
export const DocumentRevision = z.string().regex(/^[a-f0-9]{64}$/);
export const DocumentCaseType = z.enum([
  "DOCUMENT_PROCESSING",
  "DOCUMENT_REVIEW",
  "DOCUMENT_FILING",
  "DOCUMENT_CLEANUP",
  "DOCUMENT_IMPROVEMENT_CANDIDATE",
]);
export const UntrustedDocumentReferenceContext = z
  .object({
    external_ref_id: opaque.optional(),
    external_parent_ref_id: opaque.optional(),
  })
  .strict()
  .refine(
    (context) => Boolean(context.external_ref_id || context.external_parent_ref_id),
    "At least one untrusted reference is required",
  );
export const DocumentInputManifest = z
  .object({
    documentId: opaque.optional(),
    sourceKind: z.enum(["drive", "mail", "fixture"]),
    sourceRef: opaque,
    sourceRevision: opaque,
    contentHash: DocumentRevision,
    privacyStatus: z.enum(["NO_AI", "UNRESOLVED", "ELIGIBLE"]),
    privacyRevision: DocumentRevision.optional(),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    if (manifest.privacyStatus === "ELIGIBLE" && !manifest.privacyRevision)
      ctx.addIssue({
        code: "custom",
        message: "Eligible input requires a privacy evidence revision",
      });
  });
export const DocumentWorkIdentity = z
  .object({
    businessRequestId: opaque,
    caseType: DocumentCaseType,
    parentCaseId: z.string().uuid().optional(),
    packageKey: z
      .string()
      .regex(/^[a-z0-9][a-z0-9._-]{0,99}$/)
      .optional(),
    workContractRef: WorkReference.refine((reference) => reference.kind === "contract"),
    scenarioClass: z.enum(["real_work", "synthetic_acceptance", "regression"]),
    scenarioId: opaque,
    processingMode: z.enum(["SEMANTIC", "DETERMINISTIC", "HUMAN"]),
    executionChannel: z.enum(["COPILOT_CLI", "SWARM", "HUMAN"]),
    actorRef: opaque,
    inputManifest: DocumentInputManifest,
    externalReferenceContext: UntrustedDocumentReferenceContext.optional(),
    deliveryId: opaque,
    references: z.array(WorkReference).max(50).default([]),
  })
  .strict()
  .superRefine((work, ctx) => {
    if (work.caseType !== "DOCUMENT_PROCESSING" && (!work.parentCaseId || !work.packageKey))
      ctx.addIssue({
        code: "custom",
        message: "Accountable document Child requires Parent and package key",
      });
    if (work.processingMode === "SEMANTIC" && work.inputManifest.privacyStatus !== "ELIGIBLE")
      ctx.addIssue({ code: "custom", message: "Privacy hold forbids semantic processing" });
    if (work.processingMode === "SEMANTIC")
      ctx.addIssue({
        code: "custom",
        message:
          "Intake starts deterministically; semantic work requires protected privacy evidence",
      });
    if ((work.processingMode === "HUMAN") !== (work.executionChannel === "HUMAN"))
      ctx.addIssue({ code: "custom", message: "Human mode and channel must agree" });
    if (work.inputManifest.sourceKind === "fixture" && work.scenarioClass === "real_work")
      ctx.addIssue({ code: "custom", message: "A fixture is not a real provider source" });
  });
export type DocumentWorkIdentity = z.infer<typeof DocumentWorkIdentity>;

export const DocumentDecisionProposal = z
  .object({
    schemaVersion: z.literal("document-decision-v1"),
    decisionId: z.string().uuid(),
    caseId: z.string().uuid(),
    attemptId: z.string().uuid(),
    inputHash: DocumentRevision,
    documentId: opaque,
    sourceRef: opaque,
    sourceRevision: opaque,
    graphRevision: DocumentRevision.nullable(),
    ruleRevision: DocumentRevision.nullable(),
    featureSchemaRevision: z.literal("document-features-v1"),
    family: opaque.nullable(),
    operation: z.enum(["CLASSIFY", "FILE", "DELETE"]),
    target: z.object({ id: opaque, name: opaque }).strict().nullable(),
    automationMode: z.enum(["OBSERVE", "SHADOW", "ASSISTED"]),
    evidence: z.array(WorkReference).min(1).max(50),
  })
  .strict()
  .superRefine((proposal, ctx) => {
    if (proposal.operation !== "CLASSIFY" && !proposal.target)
      ctx.addIssue({ code: "custom", message: "Effect proposal requires an explicit target" });
    if (!proposal.evidence.some((reference) => reference.kind === "evidence"))
      ctx.addIssue({ code: "custom", message: "Proposal requires a minimized evidence reference" });
  });

export const DocumentWorkTransition = z
  .object({
    caseId: z.string().uuid(),
    transitionKey: opaque,
    eventType: z.enum([
      "STARTED",
      "BLOCKED",
      "TAKEOVER",
      "RELEASE",
      "RESULT",
      "REOPENED",
      "DETAILS",
    ]),
    reasonCode: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/),
    attemptId: z.string().uuid(),
    inputHash: DocumentRevision,
    processingMode: z.enum(["SEMANTIC", "DETERMINISTIC", "HUMAN"]).optional(),
    executionChannel: z.enum(["COPILOT_CLI", "SWARM", "HUMAN"]).optional(),
    details: z
      .object({
        subject: z.string().trim().min(1).max(500),
        priority: z.number().int().min(0).max(3),
        dueDate: z.string().date().nullable(),
        followUp: z.string().date().nullable(),
      })
      .strict()
      .optional(),
    references: z.array(WorkReference).max(50).default([]),
  })
  .strict()
  .superRefine((transition, ctx) => {
    if (
      transition.eventType === "RELEASE" &&
      (transition.processingMode !== "DETERMINISTIC" || transition.executionChannel !== "SWARM")
    )
      ctx.addIssue({
        code: "custom",
        message: "Release returns the same Case to deterministic Swarm work",
      });
    if ((transition.eventType === "DETAILS") !== Boolean(transition.details))
      ctx.addIssue({
        code: "custom",
        message: "Details belong only to the registered details event",
      });
  });
export const DocumentWorkRequest = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("document_ensure"), work: DocumentWorkIdentity }).strict(),
  z
    .object({ operation: z.literal("document_transition"), transition: DocumentWorkTransition })
    .strict(),
  z
    .object({
      operation: z.literal("document_assign"),
      assignment: z.object({ caseId: z.string().uuid(), documentId: opaque }).strict(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("document_propose"),
      proposal: DocumentDecisionProposal,
    })
    .strict(),
  z
    .object({
      operation: z.literal("document_proposals"),
      caseId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("document_feedback"),
      feedback: DocumentFeedbackEvent,
    })
    .strict(),
  z
    .object({
      operation: z.literal("document_feedback_events"),
      caseId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("document_candidate"),
      candidate: DocumentLearningCandidate,
    })
    .strict(),
  z
    .object({
      operation: z.literal("document_candidates"),
      caseId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("document_evaluation"),
      submission: DocumentEvaluationSubmission,
    })
    .strict(),
  z
    .object({
      operation: z.literal("document_evaluations"),
      caseId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("document_policy"),
      submission: DisabledDocumentAutomationPolicySubmission,
    })
    .strict(),
  z
    .object({
      operation: z.literal("document_policies"),
      caseId: z.string().uuid(),
    })
    .strict(),
]);
export type DocumentWorkRequest = z.infer<typeof DocumentWorkRequest>;
export const CaseRequest = z.union([
  WorkRequest,
  DocumentWorkRequest,
  CaseEnvironmentRequest,
  CaseProcessingRequest,
]);
