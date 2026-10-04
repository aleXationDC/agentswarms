import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { WorkRequest, WorkState } from "./workContract";
import { workMetrics } from "./workMetrics";
import { DocumentWorkRequest } from "../documents/documentWorkContract";

export type WorkPrincipal = {
  kind: "user_session" | "swarm_api_key" | "swarm";
  id: string;
};

export async function executeCaseWork(
  userId: string,
  input: unknown,
  principal: WorkPrincipal = { kind: "swarm", id: userId },
) {
  const documentRequest = DocumentWorkRequest.safeParse(input);
  if (documentRequest.success) {
    const { executeDocumentWork } = await import("../documents/documentWork.server");
    return executeDocumentWork(userId, documentRequest.data, principal);
  }
  const request = WorkRequest.parse(input);
  if (request.operation === "verify") {
    const { verifyCaseWork } = await import("./workVerification.server");
    return verifyCaseWork(userId, request, principal);
  }
  if (request.operation === "transition" && request.transition.eventType === "ACCEPTED") {
    throw new Error("Independent Acceptance cannot be declared by the work execution endpoint.");
  }
  if (
    request.operation === "transition" &&
    request.transition.eventType === "TAKEOVER" &&
    (!request.transition.processingMode || !request.transition.executionChannel)
  ) {
    throw new Error("Takeover requires processing mode and execution channel.");
  }
  const mode =
    request.operation === "ensure"
      ? request.work.processingMode
      : request.operation === "transition"
        ? request.transition.processingMode
        : undefined;
  const channel =
    request.operation === "ensure"
      ? request.work.executionChannel
      : request.operation === "transition"
        ? request.transition.executionChannel
        : undefined;
  if (
    principal.kind !== "user_session" &&
    (mode === "HUMAN" ||
      channel === "HUMAN" ||
      (request.operation === "transition" &&
        ["PROMOTED", "ABANDONED"].includes(request.transition.eventType)))
  ) {
    throw new Error("Human responsibility requires an authenticated user session.");
  }
  if (request.operation === "accept") {
    const { assertWorkPullHead } = await import("./workAcceptance.server");
    await assertWorkPullHead(userId, request);
  }
  if (request.operation === "transition" && request.transition.eventType === "COMPLETED") {
    const { assertParentWorkCompletion } = await import("./workAcceptance.server");
    await assertParentWorkCompletion(userId, request.transition.caseId);
  }
  const payload =
    request.operation === "ensure"
      ? request.work
      : request.operation === "transition"
        ? request.transition
        : request.operation === "list"
          ? {}
          : request;
  const { data, error } = await supabaseAdmin.rpc("axtn_case_work", {
    p_user_id: userId,
    p_operation: request.operation,
    p_payload: {
      ...payload,
      ...("actorRef" in payload && principal.kind === "user_session"
        ? { actorRef: principal.id }
        : {}),
      _principal: principal,
    } as Json,
  });
  if (error) throw new Error(error.message);
  if (request.operation === "list") {
    const state = WorkState.parse(data);
    return { ...state, metrics: workMetrics(state) };
  }
  return data;
}
