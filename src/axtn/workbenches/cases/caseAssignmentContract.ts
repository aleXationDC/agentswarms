import { z } from "zod";

const AssignmentFields = z
  .object({
    responsiblePrincipalType: z.enum(["USER", "GROUP", "SYSTEM"]),
    responsiblePrincipalId: z.string().uuid().nullable(),
    assigneeUserId: z.string().uuid().nullable(),
    assignmentPolicy: z.enum(["MANUAL", "LEAST_ACTIVE_ELIGIBLE"]),
    assignmentInheritance: z.enum(["INHERIT", "OVERRIDE"]),
    semanticRouteMode: z.enum(["SYSTEM_INTEGRATION", "PERSONAL_CONNECTION"]),
    semanticRouteProviderId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,100}$/)
      .nullable(),
    semanticRouteModelId: z.string().min(1).max(200).nullable(),
  })
  .strict();
function checkAssignment(assignment: z.infer<typeof AssignmentFields>, ctx: z.RefinementCtx) {
  if (
    (assignment.responsiblePrincipalType === "USER" &&
      (!assignment.responsiblePrincipalId ||
        assignment.assigneeUserId !== assignment.responsiblePrincipalId)) ||
    (assignment.responsiblePrincipalType === "GROUP" && !assignment.responsiblePrincipalId) ||
    (assignment.responsiblePrincipalType === "SYSTEM" &&
      (assignment.responsiblePrincipalId !== null ||
        assignment.assigneeUserId !== null ||
        assignment.semanticRouteMode !== "SYSTEM_INTEGRATION")) ||
    (assignment.semanticRouteModelId !== null && assignment.semanticRouteProviderId === null)
  ) {
    ctx.addIssue({ code: "custom", message: "A consistent responsibility and route is required" });
  }
}
export const CaseAssignment = AssignmentFields.superRefine(checkAssignment);

export const CaseAssignmentRequest = z.union([
  z
    .object({
      operation: z.literal("case_assignment"),
      caseId: z.string().uuid(),
      expectedVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      transitionKey: z.string().min(1).max(200),
    })
    .extend(AssignmentFields.shape)
    .strict()
    .superRefine(checkAssignment),
  z
    .object({
      operation: z.literal("case_access"),
      caseId: z.string().uuid().optional(),
      sharedOnly: z.boolean().default(false),
      offset: z.number().int().nonnegative().max(999999999).default(0),
      limit: z.number().int().min(1).max(200).default(50),
    })
    .strict(),
]);
export type CaseAssignmentRequest = z.infer<typeof CaseAssignmentRequest>;

export const CaseAccessView = z.object({
  scope: z.literal("AUTHORIZED_CASES"),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  cases: z.array(
    z
      .object({
        case_id: z.string().uuid(),
        subject: z.string(),
        case_access_mode: z.enum(["CUSTODIAN", "RESPONSIBLE"]),
      })
      .passthrough(),
  ),
});
