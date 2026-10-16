import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { WorkPrincipal } from "./work.server";
import { CaseAccessView, CaseExecutionView } from "./caseAssignmentContract";

const Principal = z
  .object({
    kind: z.enum(["user_session", "swarm_api_key", "swarm"]),
    id: z.string().min(1),
  })
  .strict();
const NodeRoute = z
  .object({
    provider_id: z.string().min(1),
    model_id: z.string().min(1),
    transport: z.literal("LLM_GATEWAY").optional(),
    gateway_integration_id: z.string().uuid().optional(),
  })
  .strict();
export const CaseExecutionBinding = z
  .object({
    case_id: z.string().uuid(),
    attempt_id: z.string().min(1),
    assignment_version: z.number().int().positive(),
    semantic_route_version: z.number().int().positive(),
    execution_class: z.enum(["SYSTEM_INTEGRATION", "PERSONAL_CONNECTION"]),
    execution_principal_type: z.enum(["SYSTEM", "USER"]),
    execution_principal_user_id: z.string().uuid().nullable(),
    data_scope_user_id: z.string().uuid(),
    policy_user_id: z.string().uuid(),
    budget_subject_user_id: z.string().uuid().nullable(),
    budget_subject_group_id: z.string().uuid().nullable(),
    responsible_group_id: z.string().uuid().nullable(),
    provider_id: z.string().min(1),
    model_id: z.string().min(1),
    route_provider_id: z.string().nullable(),
    route_model_id: z.string().nullable(),
    routing_reason: z.enum(["CASE_PERSONAL_ASSIGNMENT", "CASE_SYSTEM_POLICY"]),
    bound_at: z.string().datetime({ offset: true }),
    node_routes: z.record(z.string(), NodeRoute),
  })
  .strict();
export type CaseExecutionBinding = z.infer<typeof CaseExecutionBinding>;
export type CaseRunContext = {
  caseId: string;
  principal: WorkPrincipal;
  nativeStart?: boolean;
  parentRunId?: string;
  parentNodeId?: string;
};
export type CaseCredentialContext = { runId: string; nodeId: string; runOwnerId: string };
export type CaseTraceBudget = { runId: string; userId: string | null; groupId: string | null };
export const CaseExecutionFailureCode = z.enum([
  "CASE_ACCESS_DENIED",
  "CASE_EXECUTION_INACTIVE",
  "CASE_EXECUTION_PRIVACY_HOLD",
  "CASE_EXECUTION_BINDING_REQUIRED",
  "CASE_EXECUTION_SEMANTIC_NODE_REQUIRED",
  "CASE_EXECUTION_READBACK_RECOVERY_REQUIRED",
  "CASE_EXECUTION_EVIDENCE_WRITE_FAILED",
  "CASE_EXECUTION_BUDGET_EXCEEDED",
  "CASE_EXECUTION_CREDENTIAL_CHANGED",
  "CASE_EXECUTION_PRINCIPAL_INACTIVE",
  "CASE_EXECUTION_OPERATION_REQUIRED",
  "NO_ELIGIBLE_EXECUTION_PRINCIPAL",
  "PERSONAL_CONNECTION_REQUIRED",
  "PERSONAL_CONNECTION_REAUTH_REQUIRED",
  "PERSONAL_PLAN_LIMIT_REACHED",
  "MODEL_ACCESS_DENIED",
  "PROVIDER_CAPABILITY_UNSUPPORTED",
  "PROVIDER_UNAVAILABLE",
  "SYSTEM_INTEGRATION_UNAVAILABLE",
  "SYSTEM_INTEGRATION_AMBIGUOUS",
  "SYSTEM_INTEGRATION_REAUTH_REQUIRED",
  "SYSTEM_INTEGRATION_QUOTA_REACHED",
  "ROUTING_DECISION_REQUIRED",
]);
export function caseProviderFailure(error: unknown, personal: boolean): string {
  const message = error instanceof Error ? error.message : "";
  const known = CaseExecutionFailureCode.safeParse(message);
  if (known.success) return known.data;
  const status = message.match(/\[(\d{3})\]/)?.[1];
  if (status === "401")
    return personal ? "PERSONAL_CONNECTION_REAUTH_REQUIRED" : "SYSTEM_INTEGRATION_REAUTH_REQUIRED";
  if (status === "402" || status === "429")
    return personal ? "PERSONAL_PLAN_LIMIT_REACHED" : "SYSTEM_INTEGRATION_QUOTA_REACHED";
  if (status === "403") return "MODEL_ACCESS_DENIED";
  if (status === "400" || status === "404") return "PROVIDER_CAPABILITY_UNSUPPORTED";
  if (/missing|credentials configured|decrypt/i.test(message))
    return personal ? "PERSONAL_CONNECTION_REAUTH_REQUIRED" : "SYSTEM_INTEGRATION_UNAVAILABLE";
  return "PROVIDER_UNAVAILABLE";
}
export function caseFailureStatus(code: string): number {
  if (["CASE_ACCESS_DENIED", "MODEL_ACCESS_DENIED"].includes(code)) return 403;
  if (code.endsWith("REAUTH_REQUIRED")) return 401;
  if (
    [
      "CASE_EXECUTION_BUDGET_EXCEEDED",
      "PERSONAL_PLAN_LIMIT_REACHED",
      "SYSTEM_INTEGRATION_QUOTA_REACHED",
    ].includes(code)
  )
    return 402;
  if (["PROVIDER_UNAVAILABLE", "CASE_EXECUTION_EVIDENCE_WRITE_FAILED"].includes(code)) return 503;
  return 409;
}
const CaseProviderFrame = z
  .object({
    choices: z
      .array(
        z.object({
          index: z.number().int().optional(),
          finish_reason: z.string().nullable().optional(),
          delta: z
            .object({
              role: z.string().optional(),
              content: z.string().nullable().optional(),
              reasoning: z.string().nullable().optional(),
              reasoning_content: z.string().nullable().optional(),
            })
            .optional(),
          message: z
            .object({ role: z.string().optional(), content: z.string().nullable().optional() })
            .optional(),
        }),
      )
      .optional(),
    usage: z
      .object({
        prompt_tokens: z.number().finite().nonnegative().optional(),
        completion_tokens: z.number().finite().nonnegative().optional(),
        total_tokens: z.number().finite().nonnegative().optional(),
        cost: z.number().finite().nonnegative().optional(),
        cost_details: z
          .object({ upstream_inference_cost: z.number().finite().nonnegative().optional() })
          .optional(),
      })
      .optional(),
  })
  .refine((frame) => frame.choices !== undefined || frame.usage !== undefined);
export function caseProviderLine(line: string, personal: boolean): string {
  if (line === "" || line === "event: message") return line;
  if (!line.startsWith("data:")) return "";
  const payload = line.slice(5).trim();
  if (!payload || payload === "[DONE]") return line;
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("PROVIDER_UNAVAILABLE");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("PROVIDER_UNAVAILABLE");
  if ("error" in parsed || ("type" in parsed && parsed.type === "error")) {
    const failure = "error" in parsed ? parsed.error : null;
    const status =
      failure &&
      typeof failure === "object" &&
      "status" in failure &&
      typeof failure.status === "number"
        ? failure.status
        : 502;
    throw new Error(caseProviderFailure(new Error(`[${status}]`), personal));
  }
  const frame = CaseProviderFrame.safeParse(parsed);
  if (!frame.success) throw new Error("PROVIDER_UNAVAILABLE");
  return `data: ${JSON.stringify(frame.data)}`;
}
export async function blockCaseRun(userId: string, runId: string, reasonCode: string) {
  const result = z
    .object({
      disposition: z.enum(["BLOCKED", "HUMAN_TAKEOVER_FENCED"]),
      reasonCode: z.string(),
    })
    .strict()
    .parse(await call(userId, "block", { runId, reasonCode }));
  if (result.disposition === "HUMAN_TAKEOVER_FENCED")
    console.warn(
      "[caseExecution] Failure recorded; human takeover forbids automatic processing changes",
    );
}

export async function readCaseExecutionView(
  userId: string,
  caseId: string,
  principal: WorkPrincipal,
) {
  const authorized = await supabaseAdmin.rpc("axtn_case_assignment", {
    p_user_id: userId,
    p_operation: "case_access",
    p_payload: { caseId, sharedOnly: false, offset: 0, limit: 1, _principal: principal },
  });
  if (authorized.error) throw new Error(authorized.error.message);
  const view = CaseAccessView.parse(authorized.data);
  if (view.total !== 1 || view.cases[0]?.case_id !== caseId) throw new Error("CASE_ACCESS_DENIED");
  const {
    data: runs,
    error,
    count,
  } = await supabaseAdmin
    .from("swarm_runs")
    .select("id, case_attempt_id, status, case_execution_binding", { count: "exact" })
    .eq("case_id", caseId)
    .order("started_at", { ascending: false })
    .limit(20);
  if (error || !runs || count === null) throw new Error("CASE_EXECUTION_RUN_READ_FAILED");
  const ids = runs.map((run) => run.id);
  const failures = ids.length
    ? await supabaseAdmin
        .from("audit_events")
        .select("resource_id, detail, created_at")
        .in("resource_id", ids)
        .eq("action", "axtn_case_execution.BLOCKED")
        .order("created_at", { ascending: false })
    : { data: [], error: null };
  if (failures.error || !failures.data) throw new Error("CASE_EXECUTION_EVIDENCE_READ_FAILED");
  return CaseExecutionView.parse({
    total: count,
    limit: 20,
    runs: runs.map((run) => {
      const binding =
        run.case_execution_binding === null
          ? null
          : CaseExecutionBinding.parse(run.case_execution_binding);
      const failure = failures.data.find((row) => row.resource_id === run.id);
      const detail = failure?.detail;
      const code = CaseExecutionFailureCode.safeParse(
        detail && typeof detail === "object" && !Array.isArray(detail) ? detail.reasonCode : null,
      );
      return {
        runId: run.id,
        attemptId: run.case_attempt_id,
        status: run.status,
        executionClass: binding?.execution_class ?? null,
        executionPrincipalUserId: binding?.execution_principal_user_id ?? null,
        providerId: binding?.provider_id ?? null,
        modelId: binding?.model_id ?? null,
        failureCode: code.success ? code.data : null,
      };
    }),
  });
}

async function call(userId: string, operation: string, payload: Json) {
  const { data, error } = await supabaseAdmin.rpc("axtn_case_execution", {
    p_user_id: userId,
    p_operation: operation,
    p_payload: payload,
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function registerCaseRun(userId: string, runId: string, context: CaseRunContext) {
  const result = await call(userId, "bind_run", {
    runId,
    caseId: context.caseId,
    _principal: { kind: context.principal.kind, id: context.principal.id },
    ...(context.nativeStart && !context.parentRunId ? { nativeStart: true } : {}),
    ...(context.parentRunId
      ? { parentRunId: context.parentRunId, parentNodeId: context.parentNodeId ?? null }
      : {}),
  });
  return z
    .object({ caseId: z.string().uuid(), attemptId: z.string().min(1) })
    .strict()
    .parse(result);
}

export async function readCaseRunContext(
  userId: string,
  runId: string,
): Promise<CaseRunContext | null> {
  const { data, error } = await supabaseAdmin
    .from("swarm_runs")
    .select("case_id, case_execution_principal, case_parent_run_id, case_parent_node_id")
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("CASE_EXECUTION_RUN_READ_FAILED");
  if (!data) throw new Error("CASE_ACCESS_DENIED");
  if (!data.case_id) return null;
  if (data.case_parent_run_id && !data.case_parent_node_id)
    throw new Error("CASE_EXECUTION_PARENT_NODE_REQUIRED");
  return {
    caseId: data.case_id,
    principal: Principal.parse(data.case_execution_principal),
    ...(data.case_parent_run_id
      ? {
          parentRunId: data.case_parent_run_id,
          parentNodeId: data.case_parent_node_id ?? undefined,
        }
      : {}),
  };
}

export async function resolveCaseChat(args: {
  runId: string;
  nodeId: string;
  operationKey: string;
}) {
  z.string().uuid().parse(args.runId);
  const { data: run, error } = await supabaseAdmin
    .from("swarm_runs")
    .select("user_id, case_id, swarm_snapshot")
    .eq("id", args.runId)
    .maybeSingle();
  if (error) throw new Error("CASE_EXECUTION_RUN_READ_FAILED");
  if (!run) throw new Error("CASE_ACCESS_DENIED");
  if (!run.case_id) return null;
  const gatewayIntent = nodeGatewayIntent(run.swarm_snapshot, args.nodeId);
  const binding = CaseExecutionBinding.parse(
    await call(run.user_id, "resolve", {
      runId: args.runId,
      nodeId: args.nodeId,
      operationKey: args.operationKey,
    }),
  );
  const route = binding.node_routes[`${args.runId}:${args.nodeId}`];
  if (!route) throw new Error("CASE_EXECUTION_BINDING_REQUIRED");
  const context = await readCaseRunContext(run.user_id, args.runId);
  if (!context) throw new Error("CASE_EXECUTION_BINDING_REQUIRED");
  return {
    binding,
    route,
    credentialContext: {
      runId: args.runId,
      nodeId: args.nodeId,
      runOwnerId: run.user_id,
    } satisfies CaseCredentialContext,
    principal: context.principal,
    gatewayIntent,
  };
}

// The per-agent "Route through gateway" opt-in is read from the run's immutable
// published snapshot, never from the caller.
export function nodeGatewayIntent(snapshot: unknown, nodeId: string): boolean {
  const nodes =
    snapshot && typeof snapshot === "object" && "nodes" in snapshot ? snapshot.nodes : null;
  if (!Array.isArray(nodes)) return false;
  const node = nodes.find(
    (item): item is { id: string; data?: { routeThroughGateway?: unknown } } =>
      !!item && typeof item === "object" && "id" in item && item.id === nodeId,
  );
  return node?.data?.routeThroughGateway === true;
}

export async function loadCaseCredential(context: CaseCredentialContext, provider: string) {
  const selected = z
    .object({
      source: z.enum(["integration", "provider_credential"]),
      ownerId: z.string().uuid(),
      id: z.string().uuid(),
    })
    .strict()
    .parse(
      await call(context.runOwnerId, "credential", {
        runId: context.runId,
        nodeId: context.nodeId,
      }),
    );
  if (selected.source === "integration") {
    const { data, error } = await supabaseAdmin
      .from("integrations")
      .select("config, is_active, updated_at, user_id")
      .eq("id", selected.id)
      .eq("user_id", selected.ownerId)
      .eq("provider", provider)
      .eq("type", "llm_provider")
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error("CASE_EXECUTION_CREDENTIAL_READ_FAILED");
    if (!data) throw new Error("CASE_EXECUTION_CREDENTIAL_CHANGED");
    return { source: "integration" as const, row: data };
  }
  const { data, error } = await supabaseAdmin
    .from("provider_credentials")
    .select("credentials, config, default_model, user_id")
    .eq("id", selected.id)
    .eq("user_id", selected.ownerId)
    .eq("provider", provider)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error("CASE_EXECUTION_CREDENTIAL_READ_FAILED");
  if (!data) throw new Error("CASE_EXECUTION_CREDENTIAL_CHANGED");
  return { source: "provider_credential" as const, row: data };
}
