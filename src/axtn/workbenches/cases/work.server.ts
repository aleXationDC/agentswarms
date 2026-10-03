import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { WorkRequest } from "./workContract";

export async function executeCaseWork(userId: string, input: unknown) {
  const request = WorkRequest.parse(input);
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
  const payload =
    request.operation === "ensure"
      ? request.work
      : request.operation === "transition"
        ? request.transition
        : {};
  const { data, error } = await supabaseAdmin.rpc("axtn_case_work", {
    p_user_id: userId,
    p_operation: request.operation,
    p_payload: payload as Json,
  });
  if (error) throw new Error(error.message);
  return data;
}
