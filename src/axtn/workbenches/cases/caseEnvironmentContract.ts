import { z } from "zod";

export const ExternalCaseReference = z
  .string()
  .min(1)
  .refine(
    (value) => Array.from(value).length <= 500 && value.trim().length > 0 && !/\p{Cc}/u.test(value),
    "External references require non-whitespace opaque text without control characters",
  );

export const ExternalCasePatch = z
  .object({
    external_environment_id: ExternalCaseReference.nullable().optional(),
    external_ref_id: ExternalCaseReference.nullable().optional(),
    external_parent_ref_id: ExternalCaseReference.nullable().optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "At least one reference patch is required");

const change = {
  transitionKey: z.string().min(1).max(200),
  expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
};

export const CaseEnvironmentRequest = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("environment_binding_state"),
      integrationId: z.string().uuid(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("environment_binding"),
      integrationId: z.string().uuid(),
      environmentId: ExternalCaseReference,
      enabled: z.boolean(),
      ...change,
    })
    .strict(),
  z
    .object({
      operation: z.literal("external_references"),
      caseId: z.string().uuid(),
      patch: ExternalCasePatch,
      ...change,
    })
    .strict(),
  z
    .object({
      operation: z.literal("external_correlate"),
      integrationId: z.string().uuid().optional(),
      external_environment_id: ExternalCaseReference.nullable().optional(),
      external_ref_id: ExternalCaseReference.nullable().optional(),
      external_parent_ref_id: ExternalCaseReference.nullable().optional(),
      accountId: z.string().uuid().optional(),
      contactId: z.string().uuid().optional(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("external_handover"),
      caseId: z.string().uuid(),
      integrationId: z.string().uuid(),
      expectedVersion: change.expectedVersion,
    })
    .strict(),
]);

export type CaseEnvironmentRequest = z.infer<typeof CaseEnvironmentRequest>;
