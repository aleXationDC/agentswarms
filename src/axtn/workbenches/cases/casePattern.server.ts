import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { WorkPrincipal } from "./work.server";
import { CasePatternRequest } from "./casePatternContract";

export async function executeCasePattern(
  userId: string,
  input: CasePatternRequest,
  principal: WorkPrincipal,
) {
  const request = CasePatternRequest.parse(input);
  if (principal.kind === "user_session" && principal.id !== userId)
    throw new Error("CASE_PATTERN_PRINCIPAL_DENIED");
  if (
    ["pattern_assurance", "pattern_improvement"].includes(request.operation) &&
    principal.kind !== "user_session"
  )
    throw new Error("CASE_PATTERN_AUTHENTICATED_HUMAN_REQUIRED");
  const { operation, ...payload } = request;
  const { data, error } = await supabaseAdmin.rpc("axtn_case_pattern", {
    p_user_id: userId,
    p_operation: operation,
    p_payload: { ...payload, _principal: principal } as Json,
  });
  if (error) throw new Error(error.message);
  return data;
}
