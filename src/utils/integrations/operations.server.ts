import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

const SINGLETON_TYPES = new Set(["llm_gateway", "n8n", "firecrawl"]);

function auditDetailFor(
  type: string,
  config: Record<string, unknown>,
  secretFields: string[],
): Record<string, unknown> {
  const detail: Record<string, unknown> = {};
  for (const key of ["base_url", "instance_url", "endpoint", "provider", "auth_type"]) {
    const value = config[key];
    if (typeof value === "string" && value) detail[key] = value.slice(0, 300);
  }
  detail.secret_rotated = secretFields.some((field) => {
    const value = config[field];
    return typeof value === "string" && value.length > 0;
  });
  return detail;
}

export async function saveIntegrationForUser(
  userId: string,
  data: {
    id?: string;
    type: string;
    provider: string;
    name: string;
    config: Record<string, unknown>;
    is_active: boolean;
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (data.type === "n8n" && data.config.binding_mode === "native") {
    const { resolveNativeN8n } = await import("./nativeN8n.server");
    try {
      await resolveNativeN8n(userId);
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
    data = { ...data, config: { binding_mode: "native" } };
  }
  const { encryptIntegrationConfig, preserveBlankSecrets, integrationSecretFields } =
    await import("../providers/integrationConfig.server");
  const { auditEvent } = await import("../audit.server");

  // R254: a row that could not be read is not a row that is not there. A blank
  // secret field keeps the saved one by merging with that row.
  const unreadable = (e: { message: string }) => ({
    ok: false as const,
    error: `Could not read the saved integration, so nothing was saved (a blank secret field would have erased the stored one): ${e.message}`,
  });

  let targetId: string | null = null;
  let existingConfig: Record<string, unknown> | null = null;
  if (data.id) {
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("integrations")
      .select("id, config")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existingErr) return unreadable(existingErr);
    if (existing) {
      targetId = existing.id;
      existingConfig = (existing.config ?? null) as Record<string, unknown> | null;
    }
  }
  if (!targetId && (SINGLETON_TYPES.has(data.type) || data.type === "llm_provider")) {
    let query = supabaseAdmin
      .from("integrations")
      .select("id, config")
      .eq("user_id", userId)
      .eq("type", data.type);
    if (data.type === "llm_provider") query = query.eq("provider", data.provider);
    const { data: rows, error: rowsErr } = await query
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1);
    if (rowsErr) return unreadable(rowsErr);
    if (rows && rows.length > 0) {
      targetId = rows[0].id;
      existingConfig = (rows[0].config ?? null) as Record<string, unknown> | null;
    }
  }

  const detail = auditDetailFor(data.type, data.config, integrationSecretFields(data.type));
  let config = await encryptIntegrationConfig(data.type, data.config);
  config = preserveBlankSecrets(data.type, config, existingConfig);
  const row = {
    config: config as Database["public"]["Tables"]["integrations"]["Insert"]["config"],
    is_active: data.is_active,
    name: data.name,
    provider: data.provider,
    type: data.type,
  };

  let savedId = targetId;
  if (targetId) {
    const { error } = await supabaseAdmin
      .from("integrations")
      .update(row)
      .eq("id", targetId)
      .eq("user_id", userId);
    if (error) return { ok: false, error: error.message };
  } else {
    const inserted = await supabaseAdmin
      .from("integrations")
      .insert({ user_id: userId, ...row })
      .select("id")
      .single();
    if (inserted.error) {
      if (inserted.error.code === "23505") {
        let query = supabaseAdmin
          .from("integrations")
          .select("id, config")
          .eq("user_id", userId)
          .eq("type", data.type);
        if (data.type === "llm_provider") query = query.eq("provider", data.provider);
        const { data: winner, error: winnerErr } = await query.limit(1).maybeSingle();
        if (winnerErr) return unreadable(winnerErr);
        if (!winner) return { ok: false, error: inserted.error.message };
        // The row being updated is the winner's, so a blank secret keeps the winner's value.
        const winnerRow = {
          ...row,
          config: preserveBlankSecrets(
            data.type,
            await encryptIntegrationConfig(data.type, data.config),
            (winner.config ?? null) as Record<string, unknown> | null,
          ) as Database["public"]["Tables"]["integrations"]["Insert"]["config"],
        };
        const { error } = await supabaseAdmin
          .from("integrations")
          .update(winnerRow)
          .eq("id", winner.id)
          .eq("user_id", userId);
        if (error) return { ok: false, error: error.message };
        savedId = winner.id;
      } else {
        return { ok: false, error: inserted.error.message };
      }
    } else {
      savedId = inserted.data.id;
    }
  }

  await auditEvent({
    userId,
    action: targetId ? "integration.update" : "integration.create",
    resourceType: "integration",
    resourceId: savedId ?? undefined,
    resourceName: data.name || data.type,
    detail: { type: data.type, is_active: data.is_active, ...detail },
  });
  if (!savedId) throw new Error("Integration write completed without returning its row id.");
  return { ok: true, id: savedId };
}

export async function notifyN8nWebhook(opts: {
  webhookUrl: string;
  authHeader?: string | null;
  payload: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status?: number; detail?: string }> {
  const url = (opts.webhookUrl || "").trim();
  if (!url) return { ok: false, detail: "No webhook URL" };
  const body = JSON.stringify(opts.payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.authHeader) headers.Authorization = opts.authHeader;
  const secret = (process.env.WEBHOOK_SIGNING_SECRET ?? "").trim();
  if (secret) {
    const { createHmac } = await import("node:crypto");
    const timestamp = Date.now().toString();
    headers["X-AgentSwarms-Timestamp"] = timestamp;
    headers["X-AgentSwarms-Signature"] =
      "v1=" + createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  }
  const { guardedFetch } = await import("./testAdapters.server");
  let lastDetail = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const response = await guardedFetch(
        url,
        { method: "POST", headers, body },
        opts.timeoutMs ?? 5000,
      );
      if (response.ok || response.status < 500) {
        return { ok: response.ok, status: response.status };
      }
      lastDetail = `HTTP ${response.status}`;
    } catch (error) {
      lastDetail = (error as Error).message;
    }
  }
  return { ok: false, detail: lastDetail };
}
