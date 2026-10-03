import { z } from "zod";
import { runDevelopmentVerification } from "@/utils/notebookRuntime/development.server";
import { loadDevelopmentSnapshot } from "@/utils/notebookRuntime/developmentSource.server";
import { executeCaseWork, type WorkPrincipal } from "./work.server";
import type { WorkRequest } from "./workContract";

export async function verifyCaseWork(
  userId: string,
  request: Extract<WorkRequest, { operation: "verify" }>,
  principal: WorkPrincipal,
) {
  const state = await executeCaseWork(userId, { operation: "list" }, principal);
  const parsed = z
    .object({
      cases: z.array(
        z.object({
          case_id: z.string().uuid(),
          case_type: z.string(),
          status: z.string(),
          processing_mode: z.string().optional(),
          candidate_sha: z.string().optional(),
          attempt_id: z.string().optional(),
          work_identity: z
            .object({
              taskId: z.string().optional(),
              inputRevision: z.string().optional(),
              testProfile: z.enum(["python-normalization-v1", "documentation-v1"]).optional(),
            })
            .optional(),
        }),
      ),
    })
    .parse(state);
  const row = parsed.cases.find((work) => work.case_id === request.caseId);
  if (
    !row ||
    row.case_type !== "DEVELOPMENT_VERIFY" ||
    row.status !== "OPEN" ||
    !row.candidate_sha ||
    !row.attempt_id ||
    !row.work_identity?.taskId ||
    !row.work_identity.inputRevision ||
    !row.work_identity.testProfile
  ) {
    throw new Error("Started native Verify Work with immutable input, task and attempt required");
  }
  if (row.processing_mode === "HUMAN" && principal.kind !== "user_session") {
    throw new Error("Human-owned Work requires an authenticated release");
  }
  const result = await runDevelopmentVerification(userId, {
    schema: "axtn.development.verify/v1",
    repository: "aXtn/development-swarm-acceptance",
    effectKey: request.transitionKey,
    taskId: row.work_identity.taskId,
    attemptId: row.attempt_id,
    caseId: row.case_id,
    baseSHA: row.work_identity.inputRevision,
    candidateSHA: row.candidate_sha,
    profile: row.work_identity.testProfile,
    baseline: await loadDevelopmentSnapshot(userId, row.work_identity.inputRevision),
    candidate: await loadDevelopmentSnapshot(userId, row.candidate_sha),
  });
  if (result.status === "PENDING") return result;
  await executeCaseWork(
    userId,
    {
      operation: "transition",
      transition: {
        caseId: row.case_id,
        transitionKey: `${request.transitionKey}:receipt`,
        eventType: result.evidence.gateVerdict === "PASS" ? "CHECKS_PASSED" : "CHECKS_FAILED",
        reasonCode: "NATIVE_DETERMINISTIC_RECEIPT",
        actorRef: principal.id,
        candidateSHA: row.candidate_sha,
        runId: result.evidence.sessionId,
        references: [
          {
            kind: "run",
            repository: "aXtn/aXtn-agentswarms",
            id: result.evidence.sessionId,
          },
        ],
      },
    },
    principal,
  );
  return result;
}
