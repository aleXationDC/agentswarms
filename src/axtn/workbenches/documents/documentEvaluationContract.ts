import { z } from "zod";
import { DocumentFeedbackEvent, DocumentFeedbackRecord } from "./documentFeedbackContract";
import { DocumentLearningCandidate } from "./documentCandidateContract";

const revision = DocumentFeedbackEvent.shape.decisionRevision;
const fraction = z.number().finite().min(0).max(1).nullable();
const count = z.number().int().nonnegative().max(256);
const familyMetric = z
  .object({
    family: DocumentFeedbackEvent.shape.before.shape.family,
    sampleCount: count,
    predictionCount: count,
    correctCount: count,
    precision: fraction,
    precisionInterval95: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).nullable(),
    severeWrongTargetCount: count,
    correctionCount: count,
    correctionRate: fraction,
    exceptionCount: count,
    exceptionRate: fraction,
    abstentionCount: count,
    coverage: fraction,
    estimatedHumanInteractionsPerDocument: z.number().finite().min(0).max(1).nullable(),
  })
  .strict()
  .superRefine((family, ctx) => {
    if (
      family.correctCount > family.predictionCount ||
      family.abstentionCount > family.sampleCount ||
      family.severeWrongTargetCount > family.sampleCount ||
      family.correctionCount > family.sampleCount ||
      family.exceptionCount > family.sampleCount ||
      family.precision !==
        (family.predictionCount ? family.correctCount / family.predictionCount : null) ||
      family.coverage !==
        (family.sampleCount
          ? (family.sampleCount - family.abstentionCount) / family.sampleCount
          : null) ||
      family.correctionRate !==
        (family.sampleCount ? family.correctionCount / family.sampleCount : null) ||
      family.exceptionRate !==
        (family.sampleCount ? family.exceptionCount / family.sampleCount : null) ||
      (family.precisionInterval95 !== null &&
        (family.predictionCount === 0 ||
          family.precisionInterval95[0] > family.precisionInterval95[1]))
    )
      ctx.addIssue({ code: "custom", message: "Evaluation family counts/rates disagree" });
  });
const modelMetric = z
  .object({
    families: z.array(familyMetric).min(1).max(65),
    sampleCount: count,
    macroF1: z.number().finite().min(0).max(1),
    accuracy: z.number().finite().min(0).max(1),
    uncertainty: z.literal("BINOMIAL_UNADJUSTED_FOR_WITHIN_SPLIT_GROUPING"),
    severeWrongTargetCount: count,
    abstentionCount: count,
    elapsedMs: z.number().finite().nonnegative(),
    modelCalls: z.literal(0),
    providerWrites: z.literal(0),
    monetaryCost: z.null(),
  })
  .strict()
  .superRefine((metric, ctx) => {
    if (
      new Set(metric.families.map((family) => family.family)).size !== metric.families.length ||
      metric.families.reduce((sum, family) => sum + family.sampleCount, 0) !== metric.sampleCount ||
      metric.families.reduce((sum, family) => sum + family.severeWrongTargetCount, 0) !==
        metric.severeWrongTargetCount ||
      metric.families.reduce((sum, family) => sum + family.abstentionCount, 0) !==
        metric.abstentionCount
    )
      ctx.addIssue({ code: "custom", message: "Evaluation aggregate counts disagree" });
  });
export const DocumentEvaluationEvidence = z
  .object({
    schemaVersion: z.literal("document-evaluation-evidence-v1"),
    candidateId: z.string().uuid(),
    caseId: z.string().uuid(),
    baselineSHA: z.string().regex(/^[a-f0-9]{40}(?![\s\S])/),
    candidateSHA: z.string().regex(/^[a-f0-9]{40}(?![\s\S])/),
    evaluatorRevision: revision,
    datasetRevision: revision,
    splitRevision: revision,
    featureSchemaRevision: revision,
    vocabularyRevision: revision,
    baselineRuleRevision: revision,
    candidateRuleRevision: revision,
    evaluatedSplit: z.literal("test"),
    authority: z.literal("UNATTESTED_MINIMIZED_INPUT"),
    baseline: modelMetric,
    candidate: modelMetric,
    hardGates: z
      .object({
        privacyInputContract: z.literal(true),
        rightsInputContract: z.literal(true),
        independentSplit: z.literal(true),
        boundedScope: z.literal(true),
        severeWrongTarget: z.boolean(),
        familyRegression: z.boolean(),
      })
      .strict(),
    verdict: z.enum(["FAIL", "REVIEW_REQUIRED"]),
    promotionAuthorized: z.literal(false),
    evidence: DocumentLearningCandidate.shape.evidence,
  })
  .strict()
  .superRefine((evaluation, ctx) => {
    if (
      evaluation.baseline.sampleCount < 1 ||
      evaluation.baseline.sampleCount !== evaluation.candidate.sampleCount ||
      evaluation.hardGates.severeWrongTarget !==
        (evaluation.candidate.severeWrongTargetCount === 0) ||
      evaluation.verdict !==
        (evaluation.hardGates.severeWrongTarget && evaluation.hardGates.familyRegression
          ? "REVIEW_REQUIRED"
          : "FAIL")
    )
      ctx.addIssue({ code: "custom", message: "Evaluation counts/gates/verdict disagree" });
  });
export type DocumentEvaluationEvidence = z.infer<typeof DocumentEvaluationEvidence>;

export const DocumentEvaluationSubmission = z
  .object({
    evaluationId: z.string().uuid(),
    candidateRevision: revision,
    attemptId: z.string().uuid(),
    inputHash: revision,
    evaluation: DocumentEvaluationEvidence,
  })
  .strict();

export const DocumentEvaluationRecord = z
  .object({
    evaluation_id: z.string().uuid(),
    evaluation_key: revision,
    candidate_id: z.string().uuid(),
    candidate_revision: revision,
    case_id: z.string().uuid(),
    improvement_case_id: z.string().uuid(),
    attempt_id: z.string().uuid(),
    input_hash: revision,
    revision,
    document_evaluation: DocumentEvaluationEvidence,
    principal: DocumentFeedbackRecord.shape.principal,
    created_at: z.string().datetime({ offset: true }),
    promotion_authorized: z.literal(false),
  })
  .strict()
  .superRefine((record, ctx) => {
    if (
      record.candidate_id !== record.document_evaluation.candidateId ||
      record.case_id !== record.document_evaluation.caseId ||
      record.improvement_case_id === record.case_id
    )
      ctx.addIssue({ code: "custom", message: "Evaluation native readback binding mismatch" });
  });
