import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { WorkPrincipal } from "./work.server";
import { CaseProcessingRequest } from "./caseProcessingContract";

export async function executeCaseProcessing(
  userId: string,
  input: CaseProcessingRequest,
  principal: WorkPrincipal,
) {
  const request = CaseProcessingRequest.parse(input);
  if (principal.kind === "user_session" && principal.id !== userId)
    throw new Error("CASE_PROCESSING_PRINCIPAL_DENIED");
  const { operation, ...payload } = request;
  const { data, error } = await supabaseAdmin.rpc("axtn_case_processing", {
    p_user_id: userId,
    p_operation: operation,
    p_payload: { ...payload, _principal: principal } as Json,
  });
  if (error) throw new Error(error.message);
  return data;
}
