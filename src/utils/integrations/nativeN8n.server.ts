import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { readManagedN8nBinding } from "@/utils/operatorBindings.server";
import { safeFetch } from "@/utils/ssrfGuard.server";

export type ManagedWorkflow = { id: string; name: string; active: boolean };
export type ManagedN8nStatus =
  | { configured: false; connected: false; workflows: []; detail: string }
  | { configured: true; connected: false; workflows: []; detail: string }
  | { configured: true; connected: true; workflows: ManagedWorkflow[]; detail: string };

export async function requireNativeN8nUser(userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "superadmin")
    .maybeSingle();
  if (error) throw new Error("Unable to verify managed n8n authorization.");
  if (!data) {
    const { isBootstrapAdmin } = await import("@/utils/iam.server");
    if (!(await isBootstrapAdmin(userId))) {
      throw new Error("Managed n8n requires superadmin access.");
    }
  }
}

export async function resolveNativeN8n(userId: string): Promise<Record<string, unknown>> {
  await requireNativeN8nUser(userId);
  const resolved = readManagedN8nBinding();
  if (!resolved.ok) throw new Error(resolved.error);
  if (!resolved.binding) throw new Error("Managed n8n is not configured.");
  return {
    binding_mode: "native",
    instance_url: resolved.binding.baseUrl,
    webhook_token: resolved.binding.apiKey,
    auth_type: "header",
  };
}

export function redactNativeN8n(value: string): string {
  const resolved = readManagedN8nBinding();
  const key = resolved.ok ? resolved.binding?.apiKey : undefined;
  return key ? value.split(key).join("[redacted]") : value;
}

export async function readManagedN8nStatus(): Promise<ManagedN8nStatus> {
  const resolved = readManagedN8nBinding();
  if (!resolved.ok) {
    return { configured: true, connected: false, workflows: [], detail: resolved.error };
  }
  if (!resolved.binding) {
    return {
      configured: false,
      connected: false,
      workflows: [],
      detail: "The host has not configured native n8n.",
    };
  }

  const { baseUrl, apiKey } = resolved.binding;
  try {
    const response = await safeFetch(`${baseUrl}/api/v1/workflows?limit=100`, {
      headers: { Accept: "application/json", "X-N8N-API-KEY": apiKey },
      signal: AbortSignal.timeout(12_000),
      maxRedirects: 0,
    });
    if (!response.ok) {
      return {
        configured: true,
        connected: false,
        workflows: [],
        detail: `Native n8n authentication or connectivity failed (HTTP ${response.status}).`,
      };
    }

    const payload: unknown = await response.json();
    if (
      !payload ||
      typeof payload !== "object" ||
      !Array.isArray((payload as { data?: unknown }).data)
    ) {
      return {
        configured: true,
        connected: false,
        workflows: [],
        detail: "Native n8n returned an unexpected workflow-list response.",
      };
    }
    const workflows = (payload as { data: unknown[] }).data.flatMap((item): ManagedWorkflow[] => {
      if (!item || typeof item !== "object") return [];
      const row = item as { id?: unknown; name?: unknown; active?: unknown };
      if (typeof row.id !== "string" || typeof row.name !== "string") return [];
      return [{ id: row.id, name: row.name, active: row.active === true }];
    });
    return {
      configured: true,
      connected: true,
      workflows,
      detail: "Authenticated against the host-managed native n8n API.",
    };
  } catch {
    return {
      configured: true,
      connected: false,
      workflows: [],
      detail: "Native n8n could not be reached. Check the protected host runtime configuration.",
    };
  }
}

export async function executeNativeN8nWorkflow(
  baseUrl: string,
  headers: Record<string, string>,
  workflowId: string,
  input: Record<string, unknown>,
): Promise<string> {
  const metadata = await safeFetch(
    `${baseUrl}/api/v1/workflows/${encodeURIComponent(workflowId)}`,
    { headers, signal: AbortSignal.timeout(15_000), maxRedirects: 0 },
  );
  if (!metadata.ok) {
    return JSON.stringify({ error: `Managed n8n returned HTTP ${metadata.status}.` });
  }
  const payload: unknown = await metadata.json().catch(() => null);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return JSON.stringify({ error: "Managed n8n returned invalid workflow metadata." });
  }
  const workflow = payload as {
    active?: unknown;
    nodes?: { type?: unknown; disabled?: unknown; parameters?: Record<string, unknown> }[];
  };
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const triggers = nodes.filter(
    (node) =>
      node &&
      typeof node.type === "string" &&
      !node.disabled &&
      (node.type.endsWith("Trigger") || node.type === "n8n-nodes-base.webhook"),
  );
  const webhook =
    triggers.length === 1 && triggers[0].type === "n8n-nodes-base.webhook"
      ? triggers[0]
      : undefined;
  const params = webhook?.parameters;
  const path = params?.path;
  if (
    workflow.active !== true ||
    !webhook ||
    params?.httpMethod !== "POST" ||
    (params.authentication !== undefined && params.authentication !== "none") ||
    typeof path !== "string" ||
    !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(path)
  ) {
    return JSON.stringify({
      error:
        "Managed n8n execution requires an active workflow with one static POST Webhook trigger " +
        "using no webhook authentication. Other active trigger types are not supported.",
    });
  }

  const response = await safeFetch(`${baseUrl}/webhook/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(15_000),
    maxRedirects: 0,
  });
  if (!response.ok) {
    return JSON.stringify({ error: `Managed n8n webhook returned HTTP ${response.status}.` });
  }
  const text = (await response.text()).slice(0, 20_000);
  let result: unknown = text;
  try {
    result = JSON.parse(text);
  } catch {
    // Plain-text webhook response.
  }
  return redactNativeN8n(JSON.stringify({ ok: true, result }));
}
