import { z } from "zod";

const identity = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/);
const hours = z.number().finite().nonnegative().max(100000).multipleOf(0.0001);
const day = z.string().date();
const versioned = {
  transitionKey: z.string().min(1).max(200),
  expectedVersion: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
};
export const CapacityPurpose = z.enum(["DELIVERY", "CAPABILITY_UPLIFT", "ASSURANCE"]);
export const CaseCapacityRequest = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("capacity_allocation"),
      ...versioned,
      allocationId: z.string().uuid(),
      contextCaseId: z.string().uuid(),
      providerRef: identity,
      poolRef: identity,
      startsOn: day,
      endsOn: day,
      availableHours: hours,
      unavailableHours: hours,
    })
    .strict(),
  z
    .object({
      operation: z.literal("capacity_commitment"),
      ...versioned,
      commitmentId: z.string().uuid(),
      allocationId: z.string().uuid(),
      caseId: z.string().uuid(),
      hours,
    })
    .strict(),
  z
    .object({
      operation: z.literal("capacity_consumption"),
      ...versioned,
      consumptionId: z.string().uuid(),
      commitmentId: z.string().uuid(),
      caseId: z.string().uuid(),
      bookedOn: day,
      hours,
      capabilityRef: identity,
      purpose: CapacityPurpose,
      supersedes: z.string().uuid().optional(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("capacity_view"),
      caseId: z.string().uuid().optional(),
      scope: z.enum(["CURRENT", "RECORDED"]).default("CURRENT"),
      offset: z.number().int().nonnegative().default(0),
      limit: z.number().int().min(1).max(200).default(50),
    })
    .strict(),
]);
export type CaseCapacityRequest = z.infer<typeof CaseCapacityRequest>;
