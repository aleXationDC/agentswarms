import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { executeCaseWork, type WorkPrincipal } from "@/axtn/workbenches/cases/work.server";
import { WorkRequest } from "@/axtn/workbenches/cases/workContract";
import { rateLimitedGlobal } from "@/utils/rateLimit.server";

export const Route = createFileRoute("/api/cases/work")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
        if (!token) return Response.json({ error: "Authentication required" }, { status: 401 });
        let userId: string;
        let principal: WorkPrincipal;
        if (token.startsWith("sk_swarm_")) {
          const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
          const hash = Array.from(new Uint8Array(digest), (b) =>
            b.toString(16).padStart(2, "0"),
          ).join("");
          const { data: key, error } = await supabaseAdmin
            .from("swarm_api_keys")
            .select("id, user_id, scopes, is_active, expires_at, revoked_at")
            .eq("key_hash", hash)
            .maybeSingle();
          if (error)
            return Response.json({ error: "Authentication service unavailable" }, { status: 503 });
          if (
            !key?.is_active ||
            key.revoked_at ||
            (key.expires_at && Date.parse(key.expires_at) <= Date.now())
          )
            return Response.json({ error: "Invalid credential" }, { status: 401 });
          if (!key.scopes.includes("cases"))
            return Response.json({ error: "Case scope required" }, { status: 403 });
          userId = key.user_id;
          principal = { kind: "swarm_api_key", id: key.id };
        } else {
          const { data, error } = await supabaseAdmin.auth.getUser(token);
          if (error || !data.user)
            return Response.json({ error: "Invalid credential" }, { status: 401 });
          userId = data.user.id;
          principal = { kind: "user_session", id: userId };
        }
        if (await rateLimitedGlobal(`case-work:${userId}`, 120))
          return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
        const body: unknown = await request.json().catch(() => null);
        const parsed = WorkRequest.safeParse(body);
        if (!parsed.success)
          return Response.json({ error: "Invalid Case work contract" }, { status: 400 });
        try {
          return Response.json({
            ok: true,
            result: await executeCaseWork(userId, parsed.data, principal),
          });
        } catch (error) {
          console.warn("[case-work] operation rejected:", (error as Error).message);
          return Response.json({ error: "Case operation rejected" }, { status: 409 });
        }
      },
    },
  },
});
