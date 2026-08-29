// GET /api/system-extensions/maintenance-gate — Caddy forward_auth target
// for the public Maintenance Path. It returns 2xx only when:
//
//   1. the request's original Host equals the host in the CURRENTLY stored
//      Maintenance Path; and
//   2. Maintenance is OPEN.
//
// This endpoint intentionally has no user/session requirement: Caddy calls
// it before proxying the request to the same AgentSwarms login page. It
// grants network reachability only — the ordinary AgentSwarms/Supabase login
// and authorization remain fully mandatory after it. The configured path is
// never returned in an error/response body. On database/config errors it
// fails closed (403).
import { createFileRoute } from "@tanstack/react-router";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

function response(status: number): Response {
  return new Response(null, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/system-extensions/maintenance-gate")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const originalHost =
          request.headers.get("x-original-host") ??
          request.headers.get("x-forwarded-host") ??
          new URL(request.url).host;

        const { data, error } = await supabaseAdmin
          .from("maintenance_access")
          .select("maintenance_path,status")
          .eq("id", true)
          .maybeSingle();
        if (error || !data || data.status !== "OPEN" || !data.maintenance_path) {
          return response(403);
        }

        try {
          return new URL(data.maintenance_path).host === originalHost
            ? response(204)
            : response(403);
        } catch {
          return response(403);
        }
      },
    },
  },
});
