import { z } from "zod";
import { WorkReference } from "./workContract";

export const ProcessingStage = z.enum([
  "ACTIVE",
  "WAITING_INTERNAL_DEPENDENCY",
  "WAITING_CUSTOMER",
  "WAITING_EXTERNAL_CAPABILITY",
  "WAITING_APPROVAL",
  "VALIDATION_REVIEW",
]);
export const WaitingReason = z.enum([
  "DEPENDENCY",
  "CUSTOMER_RESPONSE",
  "CAPABILITY_UNAVAILABLE",
  "APPROVAL",
  "REVIEW",
  "UNKNOWN",
]);
export const CaseProcessingPatch = z
  .object({
    processing_stage: ProcessingStage.optional(),
    waiting_reason: WaitingReason.nullable().optional(),
    required_capability_ref: WorkReference.nullable().optional(),
    primary_pattern_ref: WorkReference.nullable().optional(),
    capability_provider_ref: WorkReference.nullable().optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "A processing patch is required");

export const CaseProcessingRequest = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("processing"),
      caseId: z.string().uuid(),
      transitionKey: z.string().min(1).max(200),
      expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      patch: CaseProcessingPatch,
      reasonCode: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/),
      occurredAt: z.string().datetime({ offset: true }).optional(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("subtree"),
      caseId: z.string().uuid().optional(),
      offset: z.number().int().nonnegative().default(0),
      limit: z.number().int().min(1).max(200).default(50),
    })
    .strict(),
]);
export type CaseProcessingRequest = z.infer<typeof CaseProcessingRequest>;
