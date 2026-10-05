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
  .strict()
  .superRefine((ref, ctx) => {
    const valid =
      ref.kind === "issue" || ref.kind === "pull_request"
        ? /^[1-9][0-9]*$/.test(ref.id)
        : ref.kind === "run"
          ? z.string().uuid().safeParse(ref.id).success
          : /^[A-Za-z0-9_./-]+$/.test(ref.id) &&
            !ref.id.startsWith("/") &&
            !ref.id.split("/").includes("..");
    if (!valid) ctx.addIssue({ code: "custom", message: "Invalid canonical reference identity" });
  });

export const WorkDependency = z
  .object({
    caseId: z.string().uuid(),
    kind: z.enum(["REQUIRES_COMPLETION", "REQUIRES_CANDIDATE", "INFORMS"]),
  })
  .strict();
export type WorkDependency = z.infer<typeof WorkDependency>;

export const WorkIdentity = z
  .object({
    sourceId: z.string().min(1).max(200),
    subject: z.string().min(1).max(500),
    caseType: z.string().regex(/^DEVELOPMENT_[A-Z_]+$/),
    parentCaseId: z.string().uuid().optional(),
    workContractRef: WorkReference.refine((reference) => reference.kind === "contract"),
    scenarioClass: z.enum(["real_work", "synthetic_acceptance", "regression"]),
    scenarioId: z.string().min(1).max(200),
    processingMode: z.enum(["SEMANTIC", "DETERMINISTIC", "HUMAN"]),
    executionChannel: z.enum(["COPILOT_CLI", "SWARM", "HUMAN"]),
    actorRef: z.string().min(1).max(100),
    taskId: z.string().min(1).max(100).optional(),
    inputRevision: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .optional(),
    acceptanceRevision: z.string().min(1).max(100).optional(),
    testProfile: z.enum(["python-normalization-v1", "documentation-v1"]).optional(),
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
      "PROMOTED",
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
    resultRef: WorkReference.optional(),
  })
  .strict()
  .superRefine((transition, ctx) => {
    if (
      [
        "CANDIDATE_UPDATED",
        "PR_CREATED",
        "CHECKS_PASSED",
        "CHECKS_FAILED",
        "REVIEWED",
        "APPROVAL_REQUESTED",
        "MERGED",
        "CANARY_STARTED",
        "DEPLOYED_VERIFIED",
      ].includes(transition.eventType) &&
      !transition.candidateSHA
    ) {
      ctx.addIssue({ code: "custom", message: "Revision-bound transition requires Candidate SHA" });
    }
    if (
      transition.eventType === "PR_CREATED" &&
      !transition.references.some((reference) => reference.kind === "pull_request")
    ) {
      ctx.addIssue({
        code: "custom",
        message: "PR transition requires a typed Pull Request reference",
      });
    }
  });

export const WorkRequest = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("ensure"), work: WorkIdentity }).strict(),
  z.object({ operation: z.literal("transition"), transition: WorkTransition }).strict(),
  z.object({ operation: z.literal("list") }).strict(),
  z
    .object({
      operation: z.literal("details"),
      caseId: z.string().uuid(),
      transitionKey: z.string().min(1).max(200),
      actorRef: z.string().min(1).max(100),
      subject: z.string().trim().min(1).max(500),
      priority: z.number().int().min(0).max(3),
      dueDate: z.string().date().nullable(),
      followUp: z.string().date().nullable(),
    })
    .strict(),
  z
    .object({
      operation: z.literal("verify"),
      caseId: z.string().uuid(),
      transitionKey: z.string().min(1).max(180),
    })
    .strict(),
  z
    .object({
      operation: z.literal("dependencies"),
      caseId: z.string().uuid(),
      transitionKey: z.string().min(1).max(200),
      actorRef: z.string().min(1).max(100),
      dependencies: z.array(WorkDependency).max(50),
    })
    .strict(),
  z
    .object({
      operation: z.literal("accept"),
      caseId: z.string().uuid(),
      transitionKey: z.string().min(1).max(200),
      candidateSHA: z.string().regex(/^[a-f0-9]{40}$/),
      approvalId: z.string().uuid(),
    })
    .strict(),
]);
export type WorkRequest = z.infer<typeof WorkRequest>;

export const WorkCase = z
  .object({
    case_id: z.string().uuid(),
    parent_case_id: z.string().uuid().nullable().optional(),
    subject: z.string(),
    case_type: z.string(),
    status: z.enum(["NEW", "OPEN", "WAITING_CONTACT", "CLOSED"]),
    status_reason: z.string().nullable().optional(),
    priority: z.number().int().min(0).max(3),
    due_date: z.string().nullable().optional(),
    follow_up: z.string().nullable().optional(),
    updated_at: z.string().optional(),
    attempt_id: z.string().optional(),
    source_kind: z.string().optional(),
    work_identity: WorkIdentity.optional(),
    work_contract_ref: WorkReference.refine(
      (reference) => reference.kind === "contract",
    ).optional(),
    scenario_class: z.enum(["real_work", "synthetic_acceptance", "regression"]).optional(),
    initial_processing_mode: z.enum(["SEMANTIC", "DETERMINISTIC", "HUMAN"]).optional(),
    view_root_reason: z.literal("PARENT_OUTSIDE_WORK_VIEW").optional(),
    candidate_sha: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .optional(),
    processing_mode: z.enum(["SEMANTIC", "DETERMINISTIC", "HUMAN"]).optional(),
    execution_channel: z.enum(["COPILOT_CLI", "SWARM", "HUMAN"]).optional(),
    actor_ref: z.string().optional(),
    dependencies: z.array(WorkDependency).optional(),
    required_dependencies: z.array(z.string().uuid()).optional(),
    references: z.array(WorkReference).optional(),
  })
  .passthrough();
export const WorkState = z.object({
  cases: z.array(WorkCase),
  events: z.array(
    z.object({
      action: z.string(),
      caseId: z.string().uuid(),
      detail: z.record(z.string(), z.unknown()),
      timestamp: z.string(),
    }),
  ),
});
export type WorkState = z.infer<typeof WorkState>;
