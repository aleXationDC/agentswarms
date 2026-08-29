// GET /api/system-extensions/maintenance-path-check — tells the client
// whether the current request's Host matches the configured Maintenance
// Path's host, WITHOUT ever returning the Maintenance Path itself to the
// browser. Used exclusively by useMaintenanceActivityHeartbeat to decide
// whether pointer/key activity should extend the Maintenance session — it
// must never leak the path (same rule as the Matrix Answer Phrase: no URL,
// no domain, no hint beyond a boolean).
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/system-extensions/maintenance-path-check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { data } = await supabaseAdmin
          .from("maintenance_access")
          .select("maintenance_path")
          .eq("id", true)
          .maybeSingle();

        const configuredPath = data?.maintenance_path ?? "";
        let isMaintenanceOrigin = false;
        try {
          if (configuredPath) {
            const configuredHost = new URL(configuredPath).host;
            const requestHost = new URL(request.url).host;
            isMaintenanceOrigin = configuredHost === requestHost;
          }
        } catch {
          isMaintenanceOrigin = false;
        }

        return json(200, { isMaintenanceOrigin });
      },
    },
  },
});
