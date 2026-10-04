import { z } from "zod";
import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { interpolate } from "@/lib/swarmRuntime";
import { canonicalJson } from "@/utils/provenance/canonical";
import type { Json } from "@/integrations/supabase/types";
import type { WorkPrincipal } from "../cases/work.server";
import {
  DocumentDecisionProposal,
  DocumentInputManifest,
  DocumentRevision,
} from "./documentWorkContract";
import { documentInputHash } from "./documentWork.server";

const operation = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/);
export const DocumentApprovalNode = z.object({
  kind: z.literal("approval"),
  approvalTitle: z.string().optional(),
  approvalRisk: z.enum(["low", "medium", "high"]).optional(),
  label: z.string().optional(),
  approverUserIds: z.array(z.string().uuid()).default([]),
  approverGroupIds: z.array(z.string().uuid()).default([]),
  approvalDocument: z.object({
    caseId: z.string(),
    decisionId: z.string(),
    operationId: z.string(),
    operation: z.enum(["CLASSIFY", "FILE", "DELETE"]),
  }),
});
export const NativeDocumentApprovalBinding = z
  .object({
    caseId: z.string().uuid(),
    attemptId: z.string().uuid(),
    inputHash: DocumentRevision,
    documentId: z.string().min(1),
    sourceRef: z.string().min(1),
    sourceRevision: z.string().min(1),
    decisionId: z.string().uuid(),
    decisionRevision: DocumentRevision,
    policyRevision: z.null(),
    graphHash: DocumentRevision,
    evidenceHash: DocumentRevision,
    operationId: operation,
    proposalOperation: z.enum(["CLASSIFY", "FILE", "DELETE"]),
    nodeId: z.string().min(1),
  })
  .strict();
const Principal = z.object({
  kind: z.enum(["user_session", "swarm", "swarm_api_key"]),
  id: z.string().min(1),
});
const StoredDecision = z.object({
  decision_id: z.string().uuid(),
  case_id: z.string().uuid(),
  revision: DocumentRevision,
  status: z.literal("PROPOSED"),
  principal: Principal,
  document_decision: DocumentDecisionProposal,
});
const CurrentCase = z.object({
  case_id: z.string().uuid(),
  source_kind: z.literal("document_work"),
  status: z.literal("OPEN"),
  attempt_id: z.string().uuid(),
  input_hash: DocumentRevision,
  document_id: z.string().min(1),
  document_input: DocumentInputManifest,
  actor_principal: Principal,
  processing_mode: z.enum(["DETERMINISTIC", "HUMAN", "SEMANTIC"]),
  privacy_evidence_revision: DocumentRevision.optional(),
  verified_privacy_status: z.enum(["NO_AI", "UNRESOLVED", "ELIGIBLE"]).optional(),
});

export async function createNativeDocumentApproval(args: {
  userId: string;
  runId: string;
  nodeId: string;
  context: Record<string, string>;
  snapshot: Json;
  nodeData: unknown;
  principal?: WorkPrincipal;
}): Promise<{ id: string }> {
  const config = DocumentApprovalNode.parse(args.nodeData);
  if (!config.approverUserIds.length && !config.approverGroupIds.length)
    throw new Error("DMS_NATIVE_APPROVAL_REVIEWER_REQUIRED");
  const resolved = z
    .object({ caseId: z.string().uuid(), decisionId: z.string().uuid(), operationId: operation })
    .parse(
      Object.fromEntries(
        Object.entries(config.approvalDocument).map(([key, value]) => [
          key,
          interpolate(value, args.context),
        ]),
      ),
    );
  async function dataset(name: string) {
    const { data, error } = await supabaseAdmin
      .from("user_data_tables")
      .select("id")
      .eq("user_id", args.userId)
      .eq("name", name)
      .maybeSingle();
    if (error || !data) throw new Error("DMS_NATIVE_APPROVAL_OWNED_DATASET_REQUIRED");
    return data.id;
  }
  const [caseDataset, decisionDataset] = await Promise.all([
    dataset("axtn_cases"),
    dataset("axtn_document_decisions"),
  ]);
  const [workResult, decisionResult] = await Promise.all([
    supabaseAdmin
      .from("user_data_rows")
      .select("row")
      .eq("table_id", caseDataset)
      .eq("row->>case_id", resolved.caseId)
      .maybeSingle(),
    supabaseAdmin
      .from("user_data_rows")
      .select("row")
      .eq("table_id", decisionDataset)
      .eq("row->>decision_id", resolved.decisionId)
      .maybeSingle(),
  ]);
  if (workResult.error || decisionResult.error || !workResult.data || !decisionResult.data)
    throw new Error("DMS_NATIVE_APPROVAL_PERSISTED_PROPOSAL_REQUIRED");
  const work = CurrentCase.parse(workResult.data.row);
  const decision = StoredDecision.parse(decisionResult.data.row);
  const proposal = decision.document_decision;
  if (proposal.operation !== config.approvalDocument.operation)
    throw new Error("DMS_NATIVE_APPROVAL_OPERATION_SCOPE_REQUIRED");
  if (
    work.processing_mode === "HUMAN" &&
    (args.principal?.kind !== "user_session" || args.principal.id !== args.userId)
  )
    throw new Error("DMS_NATIVE_APPROVAL_HUMAN_TAKEOVER_FENCED");
  if (
    work.processing_mode !== "HUMAN" &&
    (!work.privacy_evidence_revision ||
      work.verified_privacy_status !== "ELIGIBLE" ||
      work.document_input.privacyStatus === "NO_AI")
  )
    throw new Error("DMS_NATIVE_APPROVAL_PROTECTED_PRIVACY_EVIDENCE_REQUIRED");
  const graphHash = documentInputHash(args.snapshot);
  if (
    work.case_id !== resolved.caseId ||
    decision.decision_id !== resolved.decisionId ||
    decision.case_id !== work.case_id ||
    proposal.caseId !== work.case_id ||
    proposal.attemptId !== work.attempt_id ||
    proposal.inputHash !== work.input_hash ||
    proposal.documentId !== work.document_id ||
    proposal.sourceRef !== work.document_input.sourceRef ||
    proposal.sourceRevision !== work.document_input.sourceRevision ||
    decision.revision !== documentInputHash(proposal) ||
    canonicalJson(decision.principal) !== canonicalJson(work.actor_principal) ||
    (proposal.graphRevision !== null && proposal.graphRevision !== graphHash)
  )
    throw new Error("DMS_NATIVE_APPROVAL_CURRENT_PROPOSAL_BINDING_REQUIRED");
  if (proposal.ruleRevision !== null)
    throw new Error("DMS_NATIVE_APPROVAL_PROTECTED_RULE_BINDING_REQUIRED");
  const binding = NativeDocumentApprovalBinding.parse({
    ...resolved,
    attemptId: work.attempt_id,
    inputHash: work.input_hash,
    documentId: work.document_id,
    sourceRef: proposal.sourceRef,
    sourceRevision: proposal.sourceRevision,
    decisionRevision: decision.revision,
    policyRevision: null,
    graphHash,
    evidenceHash: documentInputHash(proposal.evidence),
    proposalOperation: proposal.operation,
    nodeId: args.nodeId,
  });
  const summary = `Review ${proposal.operation} proposal ${decision.decision_id}`;
  const payload = { last_output: summary, documentProposal: proposal, axtnDocument: binding };
  const row = {
    user_id: args.userId,
    swarm_run_id: args.runId,
    agent_name: config.label || "Document Approval",
    action_type: "swarm_step",
    action_title: config.approvalTitle || summary,
    description: summary,
    risk_level: config.approvalRisk || "high",
    payload: payload as Json,
    approver_user_ids: config.approverUserIds,
    approver_group_ids: config.approverGroupIds,
  };
  const { data, error } = await supabaseAdmin.from("approvals").insert(row).select("id").single();
  if (data && !error) return { id: data.id };
  if (error?.code !== "23505")
    throw new Error(error?.message || "DMS native Approval insert failed");
  const { data: prior, error: priorError } = await supabaseAdmin
    .from("approvals")
    .select("id, payload, approver_user_ids, approver_group_ids, status")
    .eq("swarm_run_id", args.runId)
    .filter("payload->axtnDocument->>operationId", "eq", binding.operationId)
    .single();
  if (
    priorError ||
    !prior ||
    canonicalJson(prior.payload) !== canonicalJson(payload) ||
    canonicalJson(prior.approver_user_ids) !== canonicalJson(row.approver_user_ids) ||
    canonicalJson(prior.approver_group_ids) !== canonicalJson(row.approver_group_ids)
  )
    throw new Error("DMS_NATIVE_APPROVAL_OPERATION_CONFLICT");
  if (prior.status === "approved" || prior.status === "rejected") {
    const { error: authorityError } = await supabaseAdmin.rpc(
      "assert_axtn_document_approval_resume",
      { p_approval_id: prior.id, p_user_id: args.userId },
    );
    if (authorityError) throw new Error(authorityError.message);
  } else if (prior.status !== "pending") {
    throw new Error("DMS_NATIVE_APPROVAL_OPERATION_CANCELLED");
  }
  return { id: prior.id };
}

export function assertNativeDocumentApprovalResume(args: {
  snapshot: unknown;
  nodeId: string;
  payload: unknown;
  decidedBy: string | null;
}) {
  const binding = z
    .object({ axtnDocument: NativeDocumentApprovalBinding })
    .parse(args.payload).axtnDocument;
  if (
    !args.decidedBy ||
    binding.nodeId !== args.nodeId ||
    binding.graphHash !== createHash("sha256").update(canonicalJson(args.snapshot)).digest("hex")
  )
    throw new Error("DMS_NATIVE_APPROVAL_RESUME_BINDING_MISMATCH");
}
