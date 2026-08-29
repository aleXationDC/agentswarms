// GET /api/system-extensions/redeem-ticket — reached via Caddy rewriting
// the public, unauthenticated path "/_ext-access/redeem" on the target
// extension host itself (git.alexation.com / n8n.alexation.com) straight
// through to this AgentSwarms route (see the generated Caddy blocks
// alongside this change). Consumes a single-use ticket nonce and, only if
// valid AND Maintenance is still OPEN, sets a short-lived grant cookie
// SCOPED TO THAT HOST ONLY (no Domain attribute -> never a wildcard
// *.alexation.com cookie), then redirects into the target app's own root.
// The target app's native login is unaffected and still fully required —
// this only opens the Network Gate.
import { createFileRoute } from "@tanstack/react-router";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/system-extensions/redeem-ticket")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const nonce = url.searchParams.get("t");
        const host =
          request.headers.get("x-original-host") ??
          request.headers.get("x-forwarded-host") ??
          url.host;

        if (!nonce) {
          return new Response("Missing ticket", { status: 400 });
        }

        const { data, error } = await supabaseAdmin
          .rpc("redeem_extension_access_ticket", {
            candidate_nonce: nonce,
            requesting_host: host,
          })
          .single();

        if (error || !data?.ok) {
          return new Response("This access link is invalid, expired, or already used.", {
            status: 403,
            headers: { "Cache-Control": "no-store" },
          });
        }

        const maxAgeSeconds = Math.max(
          0,
          Math.floor((new Date(data.grant_expires_at as string).getTime() - Date.now()) / 1000),
        );

        // Host-scoped (no Domain attribute -> exact host only, never a
        // parent-domain/wildcard cookie), HttpOnly, Secure, short-lived.
        const cookie = [
          `ext_access_grant=${encodeURIComponent(nonce)}`,
          "Path=/",
          "HttpOnly",
          "Secure",
          "SameSite=Lax",
          `Max-Age=${maxAgeSeconds}`,
        ].join("; ");

        return new Response(null, {
          status: 302,
          headers: {
            Location: `https://${host}/`,
            "Set-Cookie": cookie,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
