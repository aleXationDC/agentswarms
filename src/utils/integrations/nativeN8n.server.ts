import { readManagedN8nBinding } from "@/utils/operatorBindings.server";
import { safeFetch } from "@/utils/ssrfGuard.server";

export type ManagedWorkflow = { id: string; name: string; active: boolean };
export type ManagedN8nStatus =
  | { configured: false; connected: false; workflows: []; detail: string }
  | { configured: true; connected: false; workflows: []; detail: string }
  | { configured: true; connected: true; workflows: ManagedWorkflow[]; detail: string };

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
