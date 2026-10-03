import { z } from "zod";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { readDevelopmentGit } from "@/utils/notebookRuntime/developmentSource.server";
import { DevelopmentReceipt } from "@/utils/notebookRuntime/development.server";
import { canonicalJson } from "@/utils/provenance/canonical";
import type { WorkRequest } from "./workContract";

const Binding = z.object({
  caseId: z.string().uuid(),
  candidateSHA: z.string().regex(/^[a-f0-9]{40}$/),
  repository: z.literal("aXtn/development-swarm-acceptance"),
  pullRequest: z.number().int().positive(),
  runtimeSessionId: z.string().uuid(),
  graphHash: z.string().regex(/^[a-f0-9]{64}$/),
});
const Pull = z.object({
  number: z.number().int().positive(),
  state: z.literal("open"),
  merged: z.literal(false),
  head: z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) }),
});

export async function assertWorkPullHead(
  userId: string,
  request: Extract<WorkRequest, { operation: "accept" }>,
) {
  const { data, error } = await supabaseAdmin
    .from("approvals")
    .select("payload, swarm_run_id")
    .eq("id", request.approvalId)
    .maybeSingle();
  if (error || !data?.swarm_run_id) throw new Error("Native approval binding unavailable");
  const payload = z.object({ axtnDevelopment: Binding }).parse(data.payload).axtnDevelopment;
  if (payload.caseId !== request.caseId || payload.candidateSHA !== request.candidateSHA) {
    throw new Error("Native approval has a different immutable work binding");
  }
  const { data: run, error: runError } = await supabaseAdmin
    .from("swarm_runs")
    .select("id, swarm_snapshot")
    .eq("id", data.swarm_run_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (runError || !run) throw new Error("Native approval run owner denied");
  const hash = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
  if (hash(run.swarm_snapshot) !== payload.graphHash) {
    throw new Error("Native approval graph snapshot changed");
  }
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("notebook_runtime_sessions")
    .select("image, inputs, result, status")
    .eq("id", payload.runtimeSessionId)
    .eq("user_id", userId)
    .eq("entrypoint", "axtn-development-verify-v1")
    .maybeSingle();
  if (sessionError || !session || session.status !== "succeeded") {
    throw new Error("Native deterministic receipt unavailable");
  }
  const receipt = DevelopmentReceipt.parse(session.result);
  if (
    receipt.image !== process.env.AXTN_DEVELOPMENT_RUNTIME_IMAGE ||
    receipt.image !== session.image ||
    receipt.harnessHash !== process.env.AXTN_DEVELOPMENT_HARNESS_SHA256 ||
    receipt.inputHash !== hash(session.inputs) ||
    receipt.sessionId !== payload.runtimeSessionId ||
    receipt.candidateSHA !== request.candidateSHA ||
    receipt.gateVerdict !== "PASS" ||
    !receipt.candidate.pass ||
    receipt.candidate.compileExitCode !== 0 ||
    !receipt.candidate.testsRun
  ) {
    throw new Error("Native deterministic receipt does not match current authority");
  }
  const pull = Pull.parse(
    await readDevelopmentGit(userId, "fetch", {
      target: "pull",
      identifier: String(payload.pullRequest),
    }),
  );
  if (pull.number !== payload.pullRequest || pull.head.sha !== request.candidateSHA) {
    const { error: invalidateError } = await supabaseAdmin.rpc("axtn_case_work", {
      p_user_id: userId,
      p_operation: "transition",
      p_payload: {
        caseId: request.caseId,
        transitionKey: `native-head-drift:${request.caseId}:${pull.head.sha}`,
        eventType: "CHECKS_FAILED",
        reasonCode: "PULL_HEAD_DRIFT",
        actorRef: "native-head-verifier",
        candidateSHA: request.candidateSHA,
        references: [],
      },
    });
    if (invalidateError) throw new Error("Pull drift could not invalidate native work gates");
    throw new Error("Pull request head drift invalidates Acceptance");
  }
}

export async function assertParentWorkCompletion(userId: string, caseId: string) {
  const { data: table, error: tableError } = await supabaseAdmin
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "axtn_cases")
    .maybeSingle();
  if (tableError || !table) throw new Error("Owned Case dataset unavailable");
  const { data: row, error } = await supabaseAdmin
    .from("user_data_rows")
    .select("row")
    .eq("table_id", table.id)
    .filter("row->>case_id", "eq", caseId)
    .maybeSingle();
  if (error || !row) throw new Error("Owned Case unavailable");
  const work = z
    .object({
      case_type: z.string(),
      candidate_sha: z.string().optional(),
      accepted_approval_id: z.string().uuid().optional(),
      integration_phase: z.string().optional(),
    })
    .parse(row.row);
  if (work.case_type !== "DEVELOPMENT_CHANGE") return;
  if (!work.accepted_approval_id || !work.candidate_sha)
    throw new Error("Independent native Approval required");
  if (work.integration_phase !== "PR_READY")
    throw new Error("Native V1 completion requires the verified PR_READY endpoint");
  await assertWorkPullHead(userId, {
    operation: "accept",
    caseId,
    transitionKey: `completion:${caseId}`,
    candidateSHA: work.candidate_sha,
    approvalId: work.accepted_approval_id,
  });
}
