import { z } from "zod";
import { WorkReference } from "./workContract";
import { CapacityPurpose } from "./caseCapacityContract";

const exactReference = WorkReference.refine(
  (reference) => Boolean(reference.revision),
  "Exact versioned artifact/evidence is required",
);
export const PatternArtifactReference = exactReference.refine(
  (reference) => ["repository", "contract", "evidence"].includes(reference.kind),
  "Use the existing Git/skill artifact, not another registry",
);
export const PatternClassification = {
  rClass: z.enum(["R0", "R1", "R2", "R3", "R4"]),
  eClass: z.enum(["E0", "E1", "E2", "E3"]),
  iClass: z.enum(["I0", "I1", "I2", "I3"]),
};
export const PatternOutcome = z.enum(["POSITIVE", "NEGATIVE", "UNKNOWN"]);
export const PatternHypothesis = z.enum([
  "WAITING_BOTTLENECK",
  "CAPABILITY_GAP",
  "REWORK",
  "PATTERN_DRIFT",
]);
const evidence = z
  .array(exactReference)
  .min(1)
  .max(50)
  .refine(
    (references) => references.some((reference) => reference.kind === "evidence"),
    "Minimized evidence reference required",
  );
const mutation = {
  caseId: z.string().uuid(),
  usageId: z.string().uuid(),
  transitionKey: z.string().min(1).max(200),
  expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
};
export const CasePatternRequest = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("pattern_usage"),
      ...mutation,
      ...PatternClassification,
      artifact: PatternArtifactReference,
      purpose: CapacityPurpose,
      outcome: PatternOutcome,
      evidence,
    })
    .strict(),
  z
    .object({
      operation: z.literal("pattern_assurance"),
      ...mutation,
      ...PatternClassification,
      evidence,
    })
    .strict(),
  z
    .object({
      operation: z.literal("pattern_improvement"),
      ...mutation,
      hypothesis: PatternHypothesis,
      signal: exactReference.refine((reference) => reference.kind === "evidence"),
      scenarioClass: z.enum(["real_work", "synthetic_acceptance", "regression"]),
    })
    .strict(),
  z
    .object({
      operation: z.literal("pattern_view"),
      caseId: z.string().uuid().optional(),
      offset: z.number().int().nonnegative().default(0),
      limit: z.number().int().min(1).max(200).default(50),
    })
    .strict(),
]);
export type CasePatternRequest = z.infer<typeof CasePatternRequest>;
