import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { WorkPrincipal } from "./work.server";
import { CaseCapacityRequest } from "./caseCapacityContract";

export async function executeCaseCapacity(
  userId: string,
  input: CaseCapacityRequest,
  principal: WorkPrincipal,
) {
  const request = CaseCapacityRequest.parse(input);
  if (principal.kind === "user_session" && principal.id !== userId)
    throw new Error("CASE_CAPACITY_PRINCIPAL_DENIED");
  if (request.operation !== "capacity_view" && principal.kind !== "user_session")
    throw new Error("CASE_CAPACITY_AUTHENTICATED_HUMAN_REQUIRED");
  const { operation, ...payload } = request;
  const { data, error } = await supabaseAdmin.rpc("axtn_case_capacity", {
    p_user_id: userId,
    p_operation: operation,
    p_payload: { ...payload, _principal: principal } as Json,
  });
  if (error) throw new Error(error.message);
  return data;
}
