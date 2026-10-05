import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { z } from "zod";
import { canonicalJson } from "@/utils/provenance/canonical";
import { classificationMetrics } from "@/lib/mlEvaluation";
import { DocumentLearningCandidate } from "./documentCandidateContract";
import { DocumentFeedbackEvent } from "./documentFeedbackContract";
import { recognizeProviderSafeDocument } from "./documentRecognition";
import { DocumentEvaluationEvidence } from "./documentEvaluationContract";
export { DocumentEvaluationEvidence } from "./documentEvaluationContract";

const revision = DocumentFeedbackEvent.shape.decisionRevision;
const identifier = DocumentFeedbackEvent.shape.before.shape.family.unwrap();
const featureIds = z.array(z.number().int().min(1).max(1000)).min(1).max(32);
const condition = z
  .object({
    featureIds,
    operator: z.enum(["contains", "not_contains"]),
    connector: z.enum(["AND", "OR"]).optional(),
    matchMode: z.enum(["exact", "fuzzy"]),
    maxDeviationPercent: z.number().finite().min(0).max(100),
  })
  .strict();

// Numeric feature IDs deliberately cannot carry original text or new literals.
export const DocumentEvaluationRule = z
  .object({
    patternId: identifier,
    active: z.boolean(),
    conditions: z.array(condition).min(1).max(16),
    family: identifier,
    targetId: identifier.nullable(),
  })
  .strict();
export const DocumentEvaluationDataset = z
  .object({
    schemaVersion: z.literal("document-evaluation-dataset-v1"),
    datasetRevision: revision,
    splitRevision: revision,
    featureSchemaRevision: revision,
    vocabularyRevision: revision,
    samples: z
      .array(
        z
          .object({
            sampleId: z.string().uuid(),
            templateGroup: revision,
            requestGroup: revision,
            split: z.enum(["baseline", "candidate", "test"]),
            sourceKind: z.enum(["drive", "mail", "fixture"]),
            privacyStatus: z.literal("ELIGIBLE"),
            privacyRevision: revision,
            rightsVerified: z.literal(true),
            verifiedFeedbackRevision: revision,
            featureIds,
            expected: DocumentFeedbackEvent.shape.after,
            feedbackKind: z.enum([
              "VERIFIED_CORRECT",
              "CORRECTION",
              "EXCEPTION",
              "TAXONOMY_CHANGE",
            ]),
          })
          .strict(),
      )
      .min(3)
      .max(256),
  })
  .strict();

export const DocumentEvaluationRequest = z
  .object({
    candidate: DocumentLearningCandidate,
    candidateSHA: z.string().regex(/^[a-f0-9]{40}(?![\s\S])/),
    evaluatorRevision: revision,
    rules: z.array(DocumentEvaluationRule).min(1).max(32),
    dataset: DocumentEvaluationDataset,
  })
  .strict();

export function documentEvaluationRevision(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

const text = (features: number[]) =>
  features.map((id) => `F${String(id).padStart(4, "0")}`).join(" ");
function interval95(correct: number, total: number): [number, number] | null {
  if (!total) return null;
  const p = correct / total;
  const z2 = 1.959963984540054 ** 2;
  const denominator = 1 + z2 / total;
  const centre = (p + z2 / (2 * total)) / denominator;
  const radius =
    (Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total) * Math.sqrt(z2)) / denominator;
  return [Math.max(0, centre - radius), Math.min(1, centre + radius)];
}

export function evaluateDocumentCandidate(value: unknown): DocumentEvaluationEvidence {
  const input = DocumentEvaluationRequest.parse(value);
  const { candidate, rules, dataset } = input;
  if (new Set(rules.map((rule) => rule.patternId)).size !== rules.length)
    throw new Error("DOCUMENT_EVALUATION_PATTERN_IDENTITY_CONFLICT");
  if (new Set(dataset.samples.map((sample) => sample.sampleId)).size !== dataset.samples.length)
    throw new Error("DOCUMENT_EVALUATION_SAMPLE_IDENTITY_CONFLICT");
  if (new Set(dataset.samples.map((sample) => sample.expected.family)).size > 32)
    throw new Error("DOCUMENT_EVALUATION_FAMILY_LIMIT");
  const { datasetRevision, splitRevision, samples, ...featureContract } = dataset;
  if (
    datasetRevision !== documentEvaluationRevision({ ...featureContract, samples }) ||
    splitRevision !==
      documentEvaluationRevision(
        samples.map(({ sampleId, split, templateGroup, requestGroup }) => ({
          sampleId,
          split,
          templateGroup,
          requestGroup,
        })),
      )
  )
    throw new Error("DOCUMENT_EVALUATION_DATASET_REVISION_CONFLICT");
  const templateSplits = new Map<string, string>();
  const requestSplits = new Map<string, string>();
  for (const sample of samples) {
    for (const [groups, group] of [
      [templateSplits, sample.templateGroup],
      [requestSplits, sample.requestGroup],
    ] as const) {
      if (groups.has(group) && groups.get(group) !== sample.split)
        throw new Error("DOCUMENT_EVALUATION_SPLIT_LEAKAGE");
      groups.set(group, sample.split);
    }
    if (sample.sourceKind !== candidate.changeManifest.sourceKind)
      throw new Error("DOCUMENT_EVALUATION_SOURCE_SCOPE_DENIED");
  }
  for (const split of ["baseline", "candidate", "test"])
    if (!samples.some((sample) => sample.split === split))
      throw new Error("DOCUMENT_EVALUATION_INDEPENDENT_SPLITS_REQUIRED");
  const index = rules.findIndex((rule) => rule.patternId === candidate.changeManifest.patternId);
  if (index < 0 || !rules[index].active)
    throw new Error("DOCUMENT_EVALUATION_EXISTING_ACTIVE_PATTERN_REQUIRED");
  if (documentEvaluationRevision(rules[index]) !== candidate.changeManifest.patternRevision)
    throw new Error("DOCUMENT_EVALUATION_PATTERN_REVISION_CONFLICT");
  const changed = rules.map((rule) => ({
    ...rule,
    conditions: rule.conditions.map((condition) => ({ ...condition })),
  }));
  const changedRule = changed[index];
  for (const change of candidate.changeManifest.conditionChanges) {
    if (!changedRule.conditions[change.index])
      throw new Error("DOCUMENT_EVALUATION_EXISTING_CONDITION_REQUIRED");
    changedRule.conditions[change.index] = {
      ...changedRule.conditions[change.index],
      matchMode: change.matchMode,
      maxDeviationPercent: change.maxDeviationPercent,
    };
  }
  changedRule.family = candidate.changeManifest.family;
  changedRule.targetId = candidate.changeManifest.targetId;
  const tests = samples.filter((sample) => sample.split === "test");
  let fuzzyCells = 0;
  let exactCharacters = 0;
  for (const manifest of [rules, changed])
    for (const sample of tests)
      for (const rule of manifest.filter((rule) => rule.active))
        for (const condition of rule.conditions) {
          const length = text(sample.featureIds).length;
          const expected = text(condition.featureIds).length;
          if (condition.matchMode === "fuzzy") fuzzyCells += length * expected;
          else exactCharacters += length + expected;
          if (fuzzyCells > 20_000_000 || exactCharacters > 50_000_000)
            throw new Error("DOCUMENT_EVALUATION_WORK_BUDGET");
        }
  function metrics(manifest: z.infer<typeof DocumentEvaluationRule>[]) {
    const started = performance.now();
    const nativeRules = manifest.map((rule) => ({
      pattern_id: rule.patternId,
      name: rule.patternId,
      active: rule.active,
      conditions: rule.conditions.map((condition) => ({
        value: text(condition.featureIds),
        operator: condition.operator,
        connector: condition.connector,
        match_mode: condition.matchMode,
        max_deviation_percent: condition.maxDeviationPercent,
      })),
      suggestions: { document_family: rule.family },
    }));
    const results = tests.map((sample) => {
      const recognized = recognizeProviderSafeDocument(text(sample.featureIds), nativeRules);
      const rule = manifest.find((rule) => rule.patternId === recognized.pattern?.pattern_id);
      const family = rule?.family ?? null;
      const targetId = rule?.targetId ?? null;
      return {
        sample,
        family,
        correct: family === sample.expected.family && targetId === sample.expected.targetId,
        severe: targetId !== null && targetId !== sample.expected.targetId,
        abstained: !recognized.matched,
      };
    });
    const families = new Set(
      results.flatMap((result) => [result.family, result.sample.expected.family]),
    );
    const familyMetrics = [...families]
      .sort((a, b) => (a ?? "").localeCompare(b ?? ""))
      .map((family) => {
        const expected = results.filter((result) => result.sample.expected.family === family);
        const predicted = results.filter((result) => result.family === family && !result.abstained);
        const correct = predicted.filter((result) => result.correct).length;
        return {
          family,
          sampleCount: expected.length,
          predictionCount: predicted.length,
          correctCount: correct,
          precision: predicted.length ? correct / predicted.length : null,
          precisionInterval95: interval95(correct, predicted.length),
          severeWrongTargetCount: expected.filter((result) => result.severe).length,
          correctionCount: expected.filter((result) => result.sample.feedbackKind === "CORRECTION")
            .length,
          correctionRate: expected.length
            ? expected.filter((result) => result.sample.feedbackKind === "CORRECTION").length /
              expected.length
            : null,
          exceptionCount: expected.filter((result) => result.sample.feedbackKind === "EXCEPTION")
            .length,
          exceptionRate: expected.length
            ? expected.filter((result) => result.sample.feedbackKind === "EXCEPTION").length /
              expected.length
            : null,
          abstentionCount: expected.filter((result) => result.abstained).length,
          coverage: expected.length
            ? expected.filter((result) => !result.abstained).length / expected.length
            : null,
          estimatedHumanInteractionsPerDocument: expected.length
            ? expected.filter((result) => result.abstained || !result.correct).length /
              expected.length
            : null,
        };
      });
    const classification = classificationMetrics(
      results.map((result) => ({
        predicted: result.family ?? "__ABSTAINED__",
        actual: result.sample.expected.family ?? "__UNRESOLVED__",
        n: 1,
      })),
    );
    return {
      families: familyMetrics,
      sampleCount: tests.length,
      macroF1: classification.primary,
      accuracy: classification.extra.accuracy ?? 0,
      uncertainty: "BINOMIAL_UNADJUSTED_FOR_WITHIN_SPLIT_GROUPING" as const,
      severeWrongTargetCount: results.filter((result) => result.severe).length,
      abstentionCount: results.filter((result) => result.abstained).length,
      elapsedMs: performance.now() - started,
      modelCalls: 0 as const,
      providerWrites: 0 as const,
      monetaryCost: null,
    };
  }

  const baseline = metrics(rules);
  const proposed = metrics(changed);
  const familyRegression = baseline.families
    .filter((family) => family.sampleCount > 0)
    .every((before) => {
      const after = proposed.families.find((family) => family.family === before.family);
      return (
        !!after &&
        after.correctCount >= before.correctCount &&
        after.severeWrongTargetCount <= before.severeWrongTargetCount &&
        after.abstentionCount <= before.abstentionCount &&
        (before.precision === null ||
          (after.precision !== null && after.precision >= before.precision))
      );
    });
  const severeWrongTarget = proposed.severeWrongTargetCount === 0;
  return DocumentEvaluationEvidence.parse({
    schemaVersion: "document-evaluation-evidence-v1",
    candidateId: candidate.candidateId,
    caseId: candidate.caseId,
    baselineSHA: candidate.baseline.revision,
    candidateSHA: input.candidateSHA,
    evaluatorRevision: input.evaluatorRevision,
    datasetRevision,
    splitRevision,
    featureSchemaRevision: dataset.featureSchemaRevision,
    vocabularyRevision: dataset.vocabularyRevision,
    baselineRuleRevision: documentEvaluationRevision(rules),
    candidateRuleRevision: documentEvaluationRevision(changed),
    evaluatedSplit: "test",
    authority: "UNATTESTED_MINIMIZED_INPUT",
    baseline,
    candidate: proposed,
    hardGates: {
      privacyInputContract: true,
      rightsInputContract: true,
      independentSplit: true,
      boundedScope: true,
      severeWrongTarget,
      familyRegression,
    },
    verdict: severeWrongTarget && familyRegression ? "REVIEW_REQUIRED" : "FAIL",
    promotionAuthorized: false,
    evidence: candidate.evidence,
  });
}
