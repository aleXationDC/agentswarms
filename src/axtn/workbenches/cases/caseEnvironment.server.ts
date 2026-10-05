import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { WorkPrincipal } from "./work.server";
import { CaseEnvironmentRequest } from "./caseEnvironmentContract";

export async function executeCaseEnvironment(
  userId: string,
  input: CaseEnvironmentRequest,
  principal: WorkPrincipal,
) {
  const request = CaseEnvironmentRequest.parse(input);
  if (principal.kind === "user_session" && principal.id !== userId)
    throw new Error("CASE_ENVIRONMENT_PRINCIPAL_DENIED");
  if (request.operation === "environment_binding" && principal.kind !== "user_session")
    throw new Error("CASE_ENVIRONMENT_AUTHENTICATED_HUMAN_REQUIRED");
  const { operation, ...payload } = request;
  const { data, error } = await supabaseAdmin.rpc("axtn_case_environment", {
    p_user_id: userId,
    p_operation: operation,
    p_payload: { ...payload, _principal: principal } as Json,
  });
  if (error) throw new Error(error.message);
  return data;
}
