import { createHash } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { canonicalJson } from "@/utils/provenance/canonical";
import { interpolate } from "@/lib/swarmRuntime";
import { DevelopmentReceipt } from "@/utils/notebookRuntime/development.server";
import type { WorkPrincipal } from "@/axtn/workbenches/cases/work.server";
import {
  assertNativeDocumentApprovalResume,
  createNativeDocumentApproval,
} from "@/axtn/workbenches/documents/documentApproval.server";

const sha = z.string().regex(/^[a-f0-9]{40}$/);
const operation = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/);
const hash = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
const Snapshot = z
  .object({
    nodes: z.array(
      z
        .object({
          id: z.string(),
          data: z
            .object({
              kind: z.string(),
              label: z.string().optional(),
              approvalTitle: z.string().optional(),
              approvalRisk: z.enum(["low", "medium", "high"]).optional(),
              approverUserIds: z.array(z.string().uuid()).default([]),
              approverGroupIds: z.array(z.string().uuid()).default([]),
              approvalWork: z
                .object({
                  caseId: z.string(),
                  runtimeSessionId: z.string(),
                  operationId: z.string(),
                })
                .optional(),
              approvalDocument: z
                .object({
                  caseId: z.string(),
                  decisionId: z.string(),
                  operationId: z.string(),
                  operation: z.enum(["CLASSIFY", "FILE", "DELETE"]),
                })
                .optional(),
            })
            .passthrough(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

export const NativeWorkApprovalBinding = z.object({
  caseId: z.string().uuid(),
  candidateSHA: sha,
  repository: z.literal("aXtn/development-swarm-acceptance"),
  runtimeSessionId: z.string().uuid(),
  graphHash: z.string().regex(/^[a-f0-9]{64}$/),
  attemptId: operation,
  operationId: operation,
  nodeId: z.string().min(1),
  evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function createNativeWorkApproval(args: {
  userId: string;
  runId: string;
  nodeId: string;
  context: Record<string, string>;
  content: string;
  principal?: WorkPrincipal;
}): Promise<{ id: string }> {
  const { data: run, error: runError } = await supabaseAdmin
    .from("swarm_runs")
    .select("swarm_snapshot, status")
    .eq("id", args.runId)
    .eq("user_id", args.userId)
    .maybeSingle();
  if (runError || !run || !["running", "suspended"].includes(run.status)) {
    throw new Error("NATIVE_APPROVAL_RUN_DENIED");
  }
  const node = Snapshot.parse(run.swarm_snapshot).nodes.find((n) => n.id === args.nodeId);
  if (node?.data.approvalDocument) {
    if (node.data.kind !== "approval" || node.data.approvalWork)
      throw new Error("NATIVE_APPROVAL_DOMAIN_BINDING_CONFLICT");
    return createNativeDocumentApproval({
      ...args,
      snapshot: run.swarm_snapshot,
      nodeData: node.data,
    });
  }
  if (!node || node.data.kind !== "approval" || !node.data.approvalWork) {
    throw new Error("NATIVE_APPROVAL_NODE_BINDING_REQUIRED");
  }
  const config = node.data;
  const resolved = z
    .object({
      caseId: z.string().uuid(),
      runtimeSessionId: z.string().uuid(),
      operationId: operation,
    })
    .parse(
      Object.fromEntries(
        Object.entries(node.data.approvalWork).map(([key, value]) => [
          key,
          interpolate(value, args.context),
        ]),
      ),
    );
  if (!config.approverUserIds.length && !config.approverGroupIds.length) {
    throw new Error("NATIVE_APPROVAL_REVIEWER_REQUIRED");
  }
  const { data: dataset, error: datasetError } = await supabaseAdmin
    .from("user_data_tables")
    .select("id")
    .eq("name", "axtn_cases")
    .eq("user_id", args.userId)
    .maybeSingle();
  if (datasetError || !dataset) throw new Error("NATIVE_APPROVAL_CASE_SCOPE_DENIED");
  const { data: rows, error: rowsError } = await supabaseAdmin
    .from("user_data_rows")
    .select("row")
    .eq("table_id", dataset.id);
  if (rowsError || !rows) throw new Error("NATIVE_APPROVAL_CASE_LOOKUP_FAILED");
  const cases = z
    .array(
      z.object({
        row: z
          .object({
            case_id: z.string().uuid(),
            parent_case_id: z.string().uuid().nullable().optional(),
            candidate_sha: sha.optional(),
            attempt_id: operation.optional(),
            status: z.string(),
            source_kind: z.string().optional(),
          })
          .passthrough(),
      }),
    )
    .parse(rows)
    .map((r) => r.row);
  const work = cases.find((c) => c.case_id === resolved.caseId);
  if (
    !work ||
    work.source_kind !== "development_work" ||
    work.status !== "OPEN" ||
    !work.candidate_sha ||
    !work.attempt_id
  ) {
    throw new Error("NATIVE_APPROVAL_STARTED_WORK_REQUIRED");
  }
  const { data: session, error: sessionError } = await supabaseAdmin
    .from("notebook_runtime_sessions")
    .select("image, inputs, result, status")
    .eq("id", resolved.runtimeSessionId)
    .eq("user_id", args.userId)
    .eq("entrypoint", "axtn-development-verify-v1")
    .maybeSingle();
  if (sessionError || !session || session.status !== "succeeded") {
    throw new Error("NATIVE_APPROVAL_RECEIPT_REQUIRED");
  }
  const receipt = DevelopmentReceipt.parse(session.result);
  const inputs = z
    .object({ caseId: z.string().uuid(), attemptId: operation, candidateSHA: sha })
    .parse(session.inputs);
  let lineage = cases.find((c) => c.case_id === inputs.caseId);
  const seen = new Set<string>();
  while (lineage && lineage.case_id !== work.case_id && !seen.has(lineage.case_id)) {
    seen.add(lineage.case_id);
    lineage = cases.find((c) => c.case_id === lineage?.parent_case_id);
  }
  if (
    lineage?.case_id !== work.case_id ||
    inputs.attemptId !== work.attempt_id ||
    inputs.candidateSHA !== work.candidate_sha ||
    receipt.candidateSHA !== work.candidate_sha ||
    receipt.attemptId !== work.attempt_id ||
    receipt.sessionId !== resolved.runtimeSessionId ||
    receipt.inputHash !== hash(session.inputs) ||
    receipt.image !== session.image ||
    receipt.image !== process.env.AXTN_DEVELOPMENT_RUNTIME_IMAGE ||
    receipt.harnessHash !== process.env.AXTN_DEVELOPMENT_HARNESS_SHA256 ||
    receipt.gateVerdict !== "PASS" ||
    !receipt.candidate.pass ||
    receipt.candidate.compileExitCode !== 0 ||
    !receipt.candidate.testsRun
  ) {
    throw new Error("NATIVE_APPROVAL_IMMUTABLE_RECEIPT_MISMATCH");
  }
  const binding = NativeWorkApprovalBinding.parse({
    ...resolved,
    candidateSHA: work.candidate_sha,
    repository: "aXtn/development-swarm-acceptance",
    graphHash: hash(run.swarm_snapshot),
    attemptId: work.attempt_id,
    nodeId: args.nodeId,
    evidenceHash: hash(receipt),
  });
  const payload = { last_output: args.content.slice(0, 4000), axtnDevelopment: binding };
  const row = {
    user_id: args.userId,
    swarm_run_id: args.runId,
    agent_name: config.label || "Approval gate",
    action_type: "swarm_step",
    action_title: config.approvalTitle || `Approve step: ${config.label ?? args.nodeId}`,
    description: args.content.slice(0, 1000),
    risk_level: config.approvalRisk || "medium",
    payload: payload as Json,
    approver_user_ids: config.approverUserIds,
    approver_group_ids: config.approverGroupIds,
  };
  // The unique native run/operation index arbitrates concurrent callbacks.
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("approvals")
    .insert(row)
    .select("id")
    .single();
  if (inserted && !insertError) return { id: inserted.id };
  if (insertError?.code !== "23505")
    throw new Error(insertError?.message || "Native Approval insert failed");
  const { data: prior, error: priorError } = await supabaseAdmin
    .from("approvals")
    .select("id, payload, approver_user_ids, approver_group_ids")
    .eq("swarm_run_id", args.runId)
    .filter("payload->axtnDevelopment->>operationId", "eq", binding.operationId)
    .single();
  if (
    priorError ||
    !prior ||
    canonicalJson(prior.payload) !== canonicalJson(payload) ||
    canonicalJson(prior.approver_user_ids) !== canonicalJson(row.approver_user_ids) ||
    canonicalJson(prior.approver_group_ids) !== canonicalJson(row.approver_group_ids)
  ) {
    throw new Error("NATIVE_APPROVAL_OPERATION_CONFLICT");
  }
  return { id: prior.id };
}

export function assertNativeApprovalResume(args: {
  snapshot: unknown;
  nodeId: string;
  payload: unknown;
  decidedBy: string | null;
}): void {
  const node = Snapshot.parse(args.snapshot).nodes.find((n) => n.id === args.nodeId);
  if (!node || node.data.kind !== "approval")
    throw new Error("NATIVE_APPROVAL_RESUME_NODE_MISMATCH");
  if (
    (node.data.approvalWork || node.data.approvalDocument) &&
    args.payload &&
    typeof args.payload === "object" &&
    "axtnDocument" in args.payload &&
    "axtnDevelopment" in args.payload
  )
    throw new Error("NATIVE_APPROVAL_DOMAIN_BINDING_CONFLICT");
  if (node.data.approvalDocument) {
    if (node.data.approvalWork) throw new Error("NATIVE_APPROVAL_DOMAIN_BINDING_CONFLICT");
    assertNativeDocumentApprovalResume(args);
    return;
  }
  if (!node.data.approvalWork) return;
  const binding = z
    .object({ axtnDevelopment: NativeWorkApprovalBinding })
    .parse(args.payload).axtnDevelopment;
  if (
    !args.decidedBy ||
    binding.nodeId !== args.nodeId ||
    binding.graphHash !== hash(args.snapshot)
  ) {
    throw new Error("NATIVE_APPROVAL_RESUME_BINDING_MISMATCH");
  }
}
