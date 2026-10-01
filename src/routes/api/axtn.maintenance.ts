import { createFileRoute } from "@tanstack/react-router";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Action = "status" | "open" | "close" | "touch";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function handle(request: Request, action: Action): Promise<Response> {
  const bearer = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return json(401, { error: "Unauthorized" });

  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(bearer);
  const userId = auth.user?.id;
  if (authError || !userId) return json(401, { error: "Unauthorized" });
  let assurance: { aal?: string };
  try {
    assurance = JSON.parse(Buffer.from(bearer.split(".")[1] ?? "", "base64url").toString("utf8"));
  } catch {
    return json(401, { error: "Invalid authenticated session" });
  }
  if (assurance.aal !== "aal2") {
    return json(403, { error: "Complete multi-factor authentication before managing maintenance access" });
  }

  const { data: role, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "superadmin")
    .maybeSingle();
  const bootstrapAdminEmail = process.env.ADMIN_EMAIL ?? process.env.VITE_ADMIN_EMAIL ?? "";
  const bootstrapAdmin =
    bootstrapAdminEmail !== "" &&
    auth.user.email?.toLowerCase() === bootstrapAdminEmail.toLowerCase();
  if (roleError) {
    return json(503, { error: "Unable to verify administrator authorization" });
  }
  if (!role && !bootstrapAdmin) return json(403, { error: "Administrator authorization required" });

  const endpoint = process.env.AXTN_MAINTENANCE_URL;
  const secret = process.env.AXTN_MAINTENANCE_TOKEN;
  if (!endpoint || !secret) return json(503, { error: "Maintenance control is not configured" });

  const method = action === "status" ? "GET" : "POST";
  try {
    const result = await fetch(`${endpoint.replace(/\/+$/, "")}/${action}`, {
      method,
      headers: {
        Authorization: `Bearer ${secret}`,
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify({ actor: userId }) } : {}),
      signal: AbortSignal.timeout(3000),
    });
    if (!result.ok) return json(502, { error: "Maintenance service request failed" });
    return json(200, await result.json());
  } catch {
    return json(503, { error: "Maintenance service is unavailable" });
  }
}

export const Route = createFileRoute("/api/axtn/maintenance")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request, "status"),
      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return json(400, { error: "Invalid JSON" });
        }
        const action =
          payload && typeof payload === "object" && "action" in payload
            ? payload.action
            : undefined;
        if (action !== "open" && action !== "close" && action !== "touch") {
          return json(400, { error: "Unsupported maintenance action" });
        }
        return handle(request, action);
      },
    },
  },
});
