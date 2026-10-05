import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { WorkPrincipal } from "./work.server";
import { CaseAssignmentRequest } from "./caseAssignmentContract";

export async function executeCaseAssignment(
  userId: string,
  input: CaseAssignmentRequest,
  principal: WorkPrincipal,
) {
  const request = CaseAssignmentRequest.parse(input);
  if (principal.kind === "user_session" && principal.id !== userId)
    throw new Error("CASE_ASSIGNMENT_PRINCIPAL_DENIED");
  if (request.operation === "case_assignment" && principal.kind !== "user_session")
    throw new Error("CASE_ASSIGNMENT_AUTHENTICATED_HUMAN_REQUIRED");
  const { operation, ...payload } = request;
  const { data, error } = await supabaseAdmin.rpc("axtn_case_assignment", {
    p_user_id: userId,
    p_operation: operation,
    p_payload: { ...payload, _principal: principal } as Json,
  });
  if (error) throw new Error(error.message);
  return data;
}
