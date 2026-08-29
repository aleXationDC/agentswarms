// POST /api/system-extensions/request-access-ticket — authenticated
// superadmin action that issues a short-lived, single-use, host-bound
// ticket for one allowlisted System Extension (Gitea, n8n, or Matrix Admin), but ONLY
// while Maintenance is OPEN. This is the generic mechanism referenced by
// System Extensions for "public launch" (see extension_access_tickets
// migration for the full flow and security properties).
//
// It never returns a standing session or credential for the target app:
// native Gitea/n8n login remains fully required after the Network Gate
// opens. The public target host is resolved from server-only env
// (GITEA_PUBLIC_HOST / N8N_PUBLIC_HOST / MATRIX_ADMIN_PUBLIC_HOST) — never accepted from the client —
// so a caller cannot redirect a ticket at an arbitrary host.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSuperadmin } from "@/utils/iam.server";

const TARGET_HOSTS: Record<"gitea" | "n8n" | "matrix_admin", string | undefined> = {
  gitea: process.env.GITEA_PUBLIC_HOST,
  n8n: process.env.N8N_PUBLIC_HOST,
  matrix_admin: process.env.MATRIX_ADMIN_PUBLIC_HOST,
};

const bodySchema = z.object({
  access_token: z.string().min(1),
  target: z.enum(["gitea", "n8n", "matrix_admin"]),
});

export const Route = createFileRoute("/api/system-extensions/request-access-ticket")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
        }

        const guard = await requireSuperadmin(parsed.access_token);
        if (!guard.ok) {
          return Response.json({ ok: false, error: guard.error }, { status: 403 });
        }

        // requireSuperadmin establishes who may launch an extension. AAL2 is
        // evaluated separately from the signed access-token claim so this
        // privilege cannot be reached through a normal AAL1 login.
        const { data: assurance, error: assuranceError } =
          await supabaseAdmin.auth.mfa.getAuthenticatorAssuranceLevel(parsed.access_token);
        if (assuranceError || assurance?.currentLevel !== "aal2") {
          return Response.json(
            {
              ok: false,
              error: "Multi-factor authentication is required for public extension access",
              requires_aal2: true,
            },
            { status: 403 },
          );
        }

        const targetHost = TARGET_HOSTS[parsed.target];
        if (!targetHost) {
          return Response.json(
            { ok: false, error: `${parsed.target} is not configured for public extension access` },
            { status: 400 },
          );
        }

        const { data: userData } = await supabaseAdmin.auth.getUser(parsed.access_token);
        const { data: nonce, error } = await supabaseAdmin.rpc("issue_extension_access_ticket", {
          requested_target_key: parsed.target,
          requested_target_host: targetHost,
          requesting_user: userData.user?.id ?? null,
        });

        if (error || !nonce) {
          // Covers both "Maintenance is not OPEN" and any DB error — never
          // distinguish the two to a caller, and never leak the target host
          // pattern beyond what request-access-ticket's own caller already
          // knows (it chose the target).
          return Response.json(
            { ok: false, error: "Public extension access is not currently available" },
            { status: 403 },
          );
        }

        return Response.json({
          ok: true,
          redirect_url: `https://${targetHost}/_ext-access/redeem?t=${encodeURIComponent(nonce)}`,
        });
      },
    },
  },
});
