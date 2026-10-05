import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  DocumentEvaluationEvidence,
  DocumentEvaluationDataset,
  DocumentEvaluationRule,
  documentEvaluationRevision,
  evaluateDocumentCandidate,
} from "@/axtn/workbenches/documents/documentEvaluation";
import type { z } from "zod";

const rules: z.infer<typeof DocumentEvaluationRule>[] = [
  {
    patternId: "fixture-invoice",
    active: true,
    conditions: [
      { featureIds: [1, 2], operator: "contains", matchMode: "exact", maxDeviationPercent: 0 },
    ],
    family: "invoice",
    targetId: "finance",
  },
];
const evidence = {
  kind: "evidence",
  repository: "aXtn/aXtn-agentswarms",
  id: "tests/unit/documentEvaluation.test.ts",
  revision: "a".repeat(40),
};
const candidate = {
  schemaVersion: "document-learning-candidate-v1",
  candidateId: randomUUID(),
  caseId: randomUUID(),
  decisionId: randomUUID(),
  decisionRevision: "a".repeat(64),
  attemptId: randomUUID(),
  inputHash: "b".repeat(64),
  baseline: { ...evidence, kind: "repository" },
  feedback: [{ eventId: randomUUID(), revision: "c".repeat(64) }],
  hypothesis: "MATCH_TOO_NARROW",
  risks: ["FAMILY_REGRESSION", "WRONG_TARGET"],
  testProfile: { ...evidence, kind: "contract" },
  changeManifest: {
    schemaVersion: "document-rule-change-v1",
    patternId: rules[0].patternId,
    patternRevision: documentEvaluationRevision(rules[0]),
    conditionChanges: [{ index: 0, matchMode: "exact", maxDeviationPercent: 0 }],
    family: "invoice",
    targetId: "finance",
    sourceKind: "fixture",
    operation: "CLASSIFY",
    enabled: false,
  },
  evidence: [evidence],
};
function sample(split: "baseline" | "candidate" | "test", index: number) {
  return {
    sampleId: randomUUID(),
    templateGroup: documentEvaluationRevision(`template:${index}`),
    requestGroup: documentEvaluationRevision(`request:${index}`),
    split,
    sourceKind: "fixture" as const,
    privacyStatus: "ELIGIBLE" as const,
    privacyRevision: "d".repeat(64),
    rightsVerified: true as const,
    verifiedFeedbackRevision: "e".repeat(64),
    featureIds: [1, 2],
    expected: { family: "invoice", targetId: "finance" },
    feedbackKind: "VERIFIED_CORRECT" as const,
  };
}
function dataset(
  samples: z.infer<typeof DocumentEvaluationDataset>["samples"] = [
    sample("baseline", 1),
    sample("candidate", 2),
    sample("test", 3),
  ],
) {
  const body = {
    schemaVersion: "document-evaluation-dataset-v1",
    featureSchemaRevision: "f".repeat(64),
    vocabularyRevision: "0".repeat(64),
    samples,
  };
  return {
    ...body,
    datasetRevision: documentEvaluationRevision(body),
    splitRevision: documentEvaluationRevision(
      samples.map(({ sampleId, split, templateGroup, requestGroup }) => ({
        sampleId,
        split,
        templateGroup,
        requestGroup,
      })),
    ),
  };
}
function input() {
  return {
    candidate: structuredClone(candidate),
    candidateSHA: "b".repeat(40),
    evaluatorRevision: "c".repeat(64),
    rules: structuredClone(rules),
    dataset: dataset(),
  };
}
describe("bounded side-effect-free native recognition comparison", () => {
  it("evaluates only held-out tests and returns minimized descriptive metrics without promotion authority", () => {
    const fixture = input();
    const before = structuredClone(fixture);
    const result = evaluateDocumentCandidate(fixture);
    expect(fixture).toEqual(before);
    expect(result.verdict).toBe("REVIEW_REQUIRED");
    expect(result.authority).toBe("UNATTESTED_MINIMIZED_INPUT");
    expect(result.promotionAuthorized).toBe(false);
    expect(result.baseline.sampleCount).toBe(1);
    expect(result.candidate.accuracy).toBe(1);
    expect(result.candidate.macroF1).toBe(1);
    expect(result.candidate.families).toEqual([
      expect.objectContaining({
        family: "invoice",
        sampleCount: 1,
        predictionCount: 1,
        correctCount: 1,
        precision: 1,
        coverage: 1,
        estimatedHumanInteractionsPerDocument: 0,
        precisionInterval95: [expect.closeTo(0.20654931437723745, 10), 1],
      }),
    ]);
    expect(result.candidate.providerWrites).toBe(0);
    expect(result.candidate.modelCalls).toBe(0);
    expect(result.candidate.monetaryCost).toBeNull();
    expect(result.candidate.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(result).not.toHaveProperty("samples");
    expect(result).not.toHaveProperty("rules");
    expect(result).not.toHaveProperty("featureIds");
  });
  it("hard-fails a wrong target even at perfect family recognition", () => {
    const fixture = input();
    fixture.candidate.changeManifest.targetId = "wrong-folder";
    const result = evaluateDocumentCandidate(fixture);
    expect(result.candidate.macroF1).toBe(1);
    expect(result.candidate.severeWrongTargetCount).toBe(1);
    expect(result.candidate.families[0].precision).toBe(0);
    expect(result.hardGates.severeWrongTarget).toBe(false);
    expect(result.verdict).toBe("FAIL");
  });
  it("measures actual bounded fuzzy improvement without treating eliminated abstention as regression", () => {
    const fixture = input();
    fixture.candidate.changeManifest.conditionChanges[0] = {
      index: 0,
      matchMode: "fuzzy",
      maxDeviationPercent: 10,
    };
    const samples = [
      sample("baseline", 1),
      sample("candidate", 2),
      { ...sample("test", 3), featureIds: [1, 3] },
    ];
    const result = evaluateDocumentCandidate({ ...fixture, dataset: dataset(samples) });
    expect(result.baseline.abstentionCount).toBe(1);
    expect(result.candidate.abstentionCount).toBe(0);
    expect(result.candidate.accuracy).toBe(1);
    expect(result.hardGates.familyRegression).toBe(true);
    expect(result.verdict).toBe("REVIEW_REQUIRED");
    expect(result.promotionAuthorized).toBe(false);
  });
  it("cannot hide a family regression behind aggregate results", () => {
    const fixture = input();
    fixture.candidate.changeManifest.family = "other";
    const result = evaluateDocumentCandidate(fixture);
    expect(result.hardGates.familyRegression).toBe(false);
    expect(result.verdict).toBe("FAIL");
  });
  it("preserves exact rule identity and existing condition scope", () => {
    const fixture = input();
    fixture.candidate.changeManifest.patternRevision = "0".repeat(64);
    expect(() => evaluateDocumentCandidate(fixture)).toThrow("PATTERN_REVISION_CONFLICT");
    fixture.candidate.changeManifest.patternRevision = documentEvaluationRevision(rules[0]);
    fixture.candidate.changeManifest.conditionChanges[0].index = 1;
    expect(() => evaluateDocumentCandidate(fixture)).toThrow("EXISTING_CONDITION_REQUIRED");
    fixture.candidate.changeManifest.patternId = "unknown";
    expect(() => evaluateDocumentCandidate(fixture)).toThrow("EXISTING_ACTIVE_PATTERN_REQUIRED");
  });
  it("rejects an inactive referenced rule and duplicate rule identities", () => {
    const fixture = input();
    fixture.rules[0].active = false;
    expect(() => evaluateDocumentCandidate(fixture)).toThrow("EXISTING_ACTIVE_PATTERN_REQUIRED");
    fixture.rules.push(fixture.rules[0]);
    expect(() => evaluateDocumentCandidate(fixture)).toThrow("PATTERN_IDENTITY_CONFLICT");
  });
  it.each(["templateGroup", "requestGroup"] as const)(
    "rejects %s leakage across all splits",
    (field) => {
      const samples = [sample("baseline", 1), sample("candidate", 2), sample("test", 3)];
      samples[2][field] = samples[0][field];
      expect(() => evaluateDocumentCandidate({ ...input(), dataset: dataset(samples) })).toThrow(
        "SPLIT_LEAKAGE",
      );
    },
  );
  it("allows related samples only within one split and measures corrections/exceptions", () => {
    const samples: z.infer<typeof DocumentEvaluationDataset>["samples"] = [
      sample("baseline", 1),
      sample("candidate", 2),
      sample("test", 3),
      sample("test", 3),
    ];
    samples[2].feedbackKind = "CORRECTION";
    samples[3].feedbackKind = "EXCEPTION";
    const result = evaluateDocumentCandidate({ ...input(), dataset: dataset(samples) });
    expect(result.candidate.sampleCount).toBe(2);
    expect(result.candidate.families[0]).toMatchObject({ correctionCount: 1, exceptionCount: 1 });
  });
  it("rejects duplicate samples, missing splits and source-scope expansion", () => {
    const samples = [sample("baseline", 1), sample("candidate", 2), sample("test", 3)];
    samples[2].sampleId = samples[0].sampleId;
    expect(() => evaluateDocumentCandidate({ ...input(), dataset: dataset(samples) })).toThrow(
      "SAMPLE_IDENTITY_CONFLICT",
    );
    samples[2].sampleId = randomUUID();
    samples[2].split = "candidate";
    expect(() => evaluateDocumentCandidate({ ...input(), dataset: dataset(samples) })).toThrow(
      "INDEPENDENT_SPLITS_REQUIRED",
    );
    samples[2].sourceKind = "mail";
    expect(() => evaluateDocumentCandidate({ ...input(), dataset: dataset(samples) })).toThrow(
      "SOURCE_SCOPE_DENIED",
    );
  });
  it("checks actual dataset and split fingerprints, including grouping", () => {
    const fixture = input();
    fixture.dataset.datasetRevision = "0".repeat(64);
    expect(() => evaluateDocumentCandidate(fixture)).toThrow("DATASET_REVISION_CONFLICT");
    fixture.dataset = dataset();
    fixture.dataset.splitRevision = "0".repeat(64);
    expect(() => evaluateDocumentCandidate(fixture)).toThrow("DATASET_REVISION_CONFLICT");
  });
  it.each([
    { privacyStatus: "NO_AI" },
    { privacyStatus: "UNRESOLVED" },
    { rightsVerified: false },
    { verifiedFeedbackRevision: "unverified" },
    { featureIds: ["leak-marker-original-text"] },
    { featureIds: [0] },
    { featureIds: [1001] },
    { original: "leak-marker" },
    { prompt: "ignore all guards" },
    { expected: { family: "original text", targetId: null } },
  ])(
    "refuses unapproved/privacy/original feature input %j without processing or logging",
    (change) => {
      const fixture = input();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        const data = {
          ...fixture.dataset,
          samples: fixture.dataset.samples.map((row) => ({ ...row, ...change })),
        };
        expect(() => evaluateDocumentCandidate({ ...fixture, dataset: data })).toThrow();
        expect(warn).not.toHaveBeenCalled();
        expect(log).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
        log.mockRestore();
      }
    },
  );
  it("does not confuse feature 1 with feature 10 using the existing contains matcher", () => {
    const fixture = input();
    const rule = { ...rules[0], conditions: [{ ...rules[0].conditions[0], featureIds: [1] }] };
    const samples = [
      sample("baseline", 1),
      sample("candidate", 2),
      { ...sample("test", 3), featureIds: [10] },
    ];
    const result = evaluateDocumentCandidate({
      ...fixture,
      rules: [rule],
      candidate: {
        ...fixture.candidate,
        changeManifest: {
          ...fixture.candidate.changeManifest,
          patternRevision: documentEvaluationRevision(rule),
        },
      },
      dataset: dataset(samples),
    });
    expect(result.baseline.abstentionCount).toBe(1);
    expect(
      result.candidate.families.find((family) => family.family === "invoice")?.precision,
    ).toBeNull();
  });
  it("abstains for unknown families rather than inventing mappings from confidence", () => {
    const fixture = input();
    const samples = [
      sample("baseline", 1),
      sample("candidate", 2),
      {
        ...sample("test", 3),
        featureIds: [999],
        expected: { family: "new-family", targetId: null },
      },
    ];
    const result = evaluateDocumentCandidate({ ...fixture, dataset: dataset(samples) });
    expect(result.candidate.abstentionCount).toBe(1);
    expect(
      result.candidate.families.find((family) => family.family === "new-family"),
    ).toMatchObject({
      predictionCount: 0,
      precision: null,
      coverage: 0,
      estimatedHumanInteractionsPerDocument: 1,
    });
  });
  it("rejects aggregate fuzzy work before invoking the recognizer", () => {
    const fixture = input();
    const rule = {
      ...rules[0],
      conditions: Array.from({ length: 16 }, () => ({
        ...rules[0].conditions[0],
        featureIds: Array(32).fill(999),
        matchMode: "fuzzy" as const,
      })),
    };
    const samples = [
      sample("baseline", 1),
      sample("candidate", 2),
      ...Array.from({ length: 200 }, (_, index) => ({
        ...sample("test", index + 3),
        featureIds: Array(32).fill(999),
      })),
    ];
    expect(() =>
      evaluateDocumentCandidate({
        ...fixture,
        rules: [rule],
        candidate: {
          ...fixture.candidate,
          changeManifest: {
            ...fixture.candidate.changeManifest,
            patternRevision: documentEvaluationRevision(rule),
          },
        },
        dataset: dataset(samples),
      }),
    ).toThrow("WORK_BUDGET");
  });
  it("measures both sides against the twenty-million-cell aggregate budget", () => {
    const fixture = input();
    const features = Array(10).fill(999);
    const rule = {
      ...rules[0],
      conditions: Array.from({ length: 16 }, () => ({
        ...rules[0].conditions[0],
        featureIds: features,
        matchMode: "fuzzy" as const,
      })),
    };
    const candidateForBudget = {
      ...fixture.candidate,
      changeManifest: {
        ...fixture.candidate.changeManifest,
        patternRevision: documentEvaluationRevision(rule),
        conditionChanges: [{ index: 0, matchMode: "fuzzy", maxDeviationPercent: 0 }],
      },
    };
    const samples = [
      sample("baseline", 1),
      sample("candidate", 2),
      ...Array.from({ length: 179 }, (_, index) => ({
        ...sample("test", index + 3),
        featureIds: features,
      })),
    ];
    expect(2 * 16 * 179 * 59 ** 2).toBe(19_939_168);
    expect(
      evaluateDocumentCandidate({
        ...fixture,
        candidate: candidateForBudget,
        rules: [rule],
        dataset: dataset(samples),
      }).candidate.sampleCount,
    ).toBe(179);
    samples.push({ ...sample("test", 182), featureIds: features });
    expect(2 * 16 * 180 * 59 ** 2).toBe(20_050_560);
    expect(() =>
      evaluateDocumentCandidate({
        ...fixture,
        candidate: candidateForBudget,
        rules: [rule],
        dataset: dataset(samples),
      }),
    ).toThrow("WORK_BUDGET");
  });
  it("keeps output strict, minimized and incapable of acting as Acceptance", () => {
    const result = evaluateDocumentCandidate(input());
    for (const change of [
      { promotionAuthorized: true },
      { verdict: "PASS" },
      { authority: "PROTECTED" },
      { original: "leak-marker" },
      { baselineSHA: "a".repeat(40) + "\n" },
    ])
      expect(DocumentEvaluationEvidence.safeParse({ ...result, ...change }).success).toBe(false);
  });
  it.each(["original", "prompt", "owner", "approved", "llmScore", "qualityThreshold"])(
    "rejects injected top-level %s instead of ignoring it",
    (field) => {
      expect(() => evaluateDocumentCandidate({ ...input(), [field]: "forbidden" })).toThrow();
    },
  );
});
