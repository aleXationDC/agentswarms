import { z } from "zod";

export const WorkReference = z
  .object({
    kind: z.enum(["repository", "issue", "pull_request", "run", "evidence", "contract"]),
    repository: z.string().regex(/^aXtn\/[A-Za-z0-9._-]+$/),
    id: z.string().min(1).max(500),
    revision: z
      .string()
      .regex(/^[a-f0-9]{40,64}$/)
      .optional(),
  })
  .strict();

export const WorkIdentity = z
  .object({
    sourceId: z.string().min(1).max(200),
    subject: z.string().min(1).max(500),
    caseType: z.string().regex(/^DEVELOPMENT_[A-Z_]+$/),
    parentCaseId: z.string().uuid().optional(),
    workContractRef: WorkReference,
    scenarioClass: z.enum(["real_work", "synthetic_acceptance", "regression"]),
    scenarioId: z.string().min(1).max(200),
    processingMode: z.enum(["SEMANTIC", "DETERMINISTIC", "HUMAN"]),
    executionChannel: z.enum(["COPILOT_CLI", "SWARM", "HUMAN"]),
    actorRef: z.string().min(1).max(100),
    requiredDependencies: z.array(z.string().uuid()).max(50).default([]),
    references: z.array(WorkReference).max(50).default([]),
  })
  .strict();

export const WorkTransition = z
  .object({
    caseId: z.string().uuid(),
    transitionKey: z.string().min(1).max(200),
    eventType: z.enum([
      "STARTED",
      "BLOCKED",
      "REOPENED",
      "TAKEOVER",
      "RESULT",
      "COMPLETED",
      "PR_CREATED",
      "CANDIDATE_UPDATED",
      "CHECKS_PASSED",
      "CHECKS_FAILED",
      "REVIEWED",
      "APPROVAL_REQUESTED",
      "ACCEPTED",
      "MERGED",
      "CANARY_STARTED",
      "DEPLOYED_VERIFIED",
      "ROLLBACK",
      "ABANDONED",
    ]),
    reasonCode: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/),
    candidateSHA: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .optional(),
    attemptId: z.string().min(1).max(100).optional(),
    runId: z.string().uuid().optional(),
    processingMode: z.enum(["SEMANTIC", "DETERMINISTIC", "HUMAN"]).optional(),
    executionChannel: z.enum(["COPILOT_CLI", "SWARM", "HUMAN"]).optional(),
    actorRef: z.string().min(1).max(100),
    references: z.array(WorkReference).max(50).default([]),
  })
  .strict();

export const WorkRequest = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("ensure"), work: WorkIdentity }).strict(),
  z.object({ operation: z.literal("transition"), transition: WorkTransition }).strict(),
  z.object({ operation: z.literal("list") }).strict(),
]);
export type WorkRequest = z.infer<typeof WorkRequest>;
