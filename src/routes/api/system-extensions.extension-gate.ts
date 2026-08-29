// GET /api/system-extensions/extension-gate — Caddy forward_auth target for
// public (non-Tailscale) requests to an allowlisted System Extension host
// (git.alexation.com / n8n.alexation.com). Re-checked on EVERY request, not
// just once at login:
//
//   1. the caller must present the ext_access_grant cookie issued by
//      redeem-ticket for THIS EXACT host; and
//   2. Maintenance must still be OPEN.
//
// Closing Maintenance therefore fails the very next request closed for
// every outstanding grant, even ones issued minutes earlier — there is no
// cached/standing bypass once the gate check itself starts failing. This
// endpoint grants network reachability only; native Gitea/n8n
// authentication is unaffected and still fully required afterwards.
import { createFileRoute } from "@tanstack/react-router";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

function response(status: number): Response {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export const Route = createFileRoute("/api/system-extensions/extension-gate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const originalHost =
          request.headers.get("x-original-host") ??
          request.headers.get("x-forwarded-host") ??
          new URL(request.url).host;

        const nonce = readCookie(request.headers.get("cookie"), "ext_access_grant");
        if (!nonce) return response(403);

        const { data, error } = await supabaseAdmin.rpc("check_extension_access_grant", {
          candidate_nonce: nonce,
          requesting_host: originalHost,
        });

        if (error || data !== true) return response(403);
        return response(204);
      },
    },
  },
});
