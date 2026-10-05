import { z } from "zod";
import { WorkReference } from "../cases/workContract";
import { DocumentFeedbackEvent, DocumentFeedbackRecord } from "./documentFeedbackContract";

const revision = DocumentFeedbackEvent.shape.decisionRevision;
const identifier = DocumentFeedbackEvent.shape.before.shape.family.unwrap();

// Refer to existing bounded rules; never accept new document text or executable code.
export const DocumentRuleChangeManifest = z
  .object({
    schemaVersion: z.literal("document-rule-change-v1"),
    patternId: identifier,
    patternRevision: revision,
    conditionChanges: z
      .array(
        z
          .object({
            index: z.number().int().min(0).max(31),
            matchMode: z.enum(["exact", "fuzzy"]),
            maxDeviationPercent: z.number().finite().min(0).max(100),
          })
          .strict(),
      )
      .min(1)
      .max(32)
      .refine(
        (conditions) =>
          new Set(conditions.map((condition) => condition.index)).size === conditions.length,
        "Each existing condition may be changed once",
      ),
    family: identifier,
    targetId: identifier.nullable(),
    sourceKind: z.enum(["drive", "mail", "fixture"]),
    operation: z.literal("CLASSIFY"),
    enabled: z.literal(false),
  })
  .strict();

export const DocumentLearningCandidate = z
  .object({
    schemaVersion: z.literal("document-learning-candidate-v1"),
    candidateId: z.string().uuid(),
    caseId: z.string().uuid(),
    decisionId: z.string().uuid(),
    decisionRevision: revision,
    attemptId: z.string().uuid(),
    inputHash: revision,
    baseline: WorkReference.refine(
      (reference) =>
        reference.kind === "repository" &&
        reference.repository === "aXtn/aXtn-agentswarms" &&
        reference.revision?.length === 40,
      "Exact canonical App baseline revision required",
    ),
    feedback: z
      .array(
        z
          .object({
            eventId: z.string().uuid(),
            revision,
          })
          .strict(),
      )
      .min(1)
      .max(50)
      .refine(
        (events) => new Set(events.map((event) => event.eventId)).size === events.length,
        "Feedback references must be unique",
      ),
    hypothesis: z.enum([
      "MATCH_TOO_NARROW",
      "MATCH_TOO_BROAD",
      "FAMILY_MAPPING_WRONG",
      "TARGET_MAPPING_WRONG",
      "TAXONOMY_DRIFT",
    ]),
    risks: z
      .array(z.enum(["FAMILY_REGRESSION", "WRONG_TARGET", "PRIVACY_LEAKAGE", "SOURCE_SCOPE_DRIFT"]))
      .min(1)
      .max(4)
      .refine((risks) => new Set(risks).size === risks.length, "Risk codes must be unique"),
    testProfile: WorkReference.refine(
      (reference) =>
        reference.kind === "contract" &&
        reference.repository === "aXtn/aXtn-agentswarms" &&
        reference.revision?.length === 40,
      "Exact canonical App test profile revision required",
    ),
    changeManifest: DocumentRuleChangeManifest,
    evidence: z
      .array(WorkReference)
      .min(1)
      .max(50)
      .refine(
        (references) => references.some((reference) => reference.kind === "evidence"),
        "Minimized candidate evidence required",
      ),
  })
  .strict();
export type DocumentLearningCandidate = z.infer<typeof DocumentLearningCandidate>;

export const DocumentLearningCandidateRecord = z
  .object({
    candidate_id: z.string().uuid(),
    candidate_key: revision,
    case_id: z.string().uuid(),
    improvement_case_id: z.string().uuid(),
    revision,
    document_learning_candidate: DocumentLearningCandidate,
    principal: DocumentFeedbackRecord.shape.principal,
    created_at: z.string().datetime({ offset: true }),
    status: z.literal("NEW"),
    enabled: z.literal(false),
  })
  .strict()
  .superRefine((record, ctx) => {
    if (
      record.candidate_id !== record.document_learning_candidate.candidateId ||
      record.case_id !== record.document_learning_candidate.caseId ||
      record.improvement_case_id === record.case_id
    )
      ctx.addIssue({ code: "custom", message: "Protected candidate readback binding mismatch" });
  });
