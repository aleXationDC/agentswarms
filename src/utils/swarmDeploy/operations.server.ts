import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { auditEvent } from "@/utils/audit.server";
import { generateWebhookSecret } from "@/utils/swarmWebhook.server";

type CreateSwarmApiKeyInput = {
  access_token: string;
  swarm_id: string;
  name: string;
  reject_approvals?: boolean;
  expires_in_days?: number | null;
  scopes?: ("run" | "read_runs")[];
  rotated_from?: string;
  callback_url?: string | null;
};

async function userFromToken(accessToken: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user.id;
}

function generateRawKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sk_swarm_${hex}`;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function jsSandboxStatus(
  accessToken: string,
): Promise<{ configured: boolean; healthy: boolean }> {
  const userId = await userFromToken(accessToken);
  if (!userId) return { configured: false, healthy: false };
  const { resolveJsSandboxUrl } = await import("@/utils/jsSandbox.server");
  const url = await resolveJsSandboxUrl();
  if (!url) return { configured: false, healthy: false };
  try {
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2500) });
    return { configured: true, healthy: res.ok };
  } catch {
    return { configured: true, healthy: false };
  }
}

export async function createSwarmApiKey(
  data: CreateSwarmApiKeyInput,
): Promise<
  | { ok: false; error: string }
  | { ok: true; id: string; raw_key: string; webhook_secret: string | null }
> {
  const userId = await userFromToken(data.access_token);
  if (!userId) return { ok: false, error: "Invalid session" };

  const { data: swarm } = await supabaseAdmin
    .from("swarms")
    .select("id, user_id")
    .eq("id", data.swarm_id)
    .maybeSingle();
  if (!swarm || swarm.user_id !== userId) {
    return { ok: false, error: "Swarm not found or not yours" };
  }

  if (data.rotated_from) {
    const { data: prev } = await supabaseAdmin
      .from("swarm_api_keys")
      .select("id, user_id, swarm_id")
      .eq("id", data.rotated_from)
      .maybeSingle();
    if (!prev || prev.user_id !== userId || prev.swarm_id !== data.swarm_id) {
      return { ok: false, error: "The key being rotated was not found" };
    }
  }

  const raw = generateRawKey();
  const key_hash = await sha256Hex(raw);
  const key_prefix = raw.slice(0, 16) + "…";
  const expires_at = data.expires_in_days
    ? new Date(Date.now() + data.expires_in_days * 86_400_000).toISOString()
    : null;
  const rejectApprovals = data.reject_approvals ?? true;
  const scopes = data.scopes ?? ["run"];
  const { data: row, error } = await supabaseAdmin
    .from("swarm_api_keys")
    .insert({
      user_id: userId,
      swarm_id: data.swarm_id,
      name: data.name,
      key_hash,
      key_prefix,
      reject_approvals: rejectApprovals,
      expires_at,
      scopes,
      rotated_from: data.rotated_from ?? null,
      webhook_secret: generateWebhookSecret(),
      callback_url: data.callback_url ?? null,
    })
    .select("id, webhook_secret")
    .single();
  if (error || !row) return { ok: false, error: error?.message ?? "Could not create key" };
  await auditEvent({
    userId,
    action: data.rotated_from ? "swarm.api_key.rotate" : "swarm.api_key.create",
    resourceType: "swarm",
    resourceId: data.swarm_id,
    resourceName: data.name,
    detail: {
      reject_approvals: rejectApprovals,
      expires_at,
      scopes,
      ...(data.rotated_from ? { rotated_from: data.rotated_from } : {}),
    },
  });
  return { ok: true, id: row.id, raw_key: raw, webhook_secret: row.webhook_secret };
}

export async function publishSwarmForOwner(
  swarmId: string,
  userId: string,
): Promise<{ ok: false; error: string } | { ok: true; published_at: string }> {
  const { data: swarm, error: readError } = await supabaseAdmin
    .from("swarms")
    .select("id, user_id, nodes, edges")
    .eq("id", swarmId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!swarm || swarm.user_id !== userId) return { ok: false, error: "Swarm not found" };
  const published_at = new Date().toISOString();
  const { data: published, error: updateError } = await supabaseAdmin
    .from("swarms")
    .update({
      published_nodes: swarm.nodes,
      published_edges: swarm.edges,
      published_at,
      published_by: userId,
    })
    .eq("id", swarm.id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (updateError) return { ok: false, error: updateError.message };
  if (!published) return { ok: false, error: "Swarm disappeared before it could be published" };
  await auditEvent({
    userId,
    action: "swarm.publish",
    resourceType: "swarm",
    resourceId: swarm.id,
    detail: { nodes: Array.isArray(swarm.nodes) ? swarm.nodes.length : 0 },
  });
  return { ok: true, published_at };
}

export async function publishSwarm(
  accessToken: string,
  swarmId: string,
): Promise<{ ok: false; error: string } | { ok: true; published_at: string }> {
  const userId = await userFromToken(accessToken);
  if (!userId) return { ok: false, error: "Not signed in" };
  return publishSwarmForOwner(swarmId, userId);
}

export async function unpublishSwarm(
  accessToken: string,
  swarmId: string,
): Promise<{ ok: false; error: string } | { ok: true }> {
  const userId = await userFromToken(accessToken);
  if (!userId) return { ok: false, error: "Not signed in" };
  const { data: swarm } = await supabaseAdmin
    .from("swarms")
    .select("id, user_id")
    .eq("id", swarmId)
    .maybeSingle();
  if (!swarm || swarm.user_id !== userId) return { ok: false, error: "Swarm not found" };
  const { error } = await supabaseAdmin
    .from("swarms")
    .update({
      published_nodes: null,
      published_edges: null,
      published_at: null,
      published_by: null,
    })
    .eq("id", swarm.id);
  if (error) return { ok: false, error: error.message };
  await auditEvent({
    userId,
    action: "swarm.unpublish",
    resourceType: "swarm",
    resourceId: swarm.id,
  });
  return { ok: true };
}
