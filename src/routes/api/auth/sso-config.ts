// Public (pre-auth) endpoint the login page uses to decide which sign-in
// options to render. Exposes only instance-level SSO and signup flags — no
// provider details.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/auth/sso-config")({
  server: {
    handlers: {
      GET: getPublicAuthConfig,
    },
  },
});

export async function getPublicAuthConfig() {
  try {
    const { data, error } = await supabaseAdmin
      .from("iam_settings")
      .select("sso_enabled, sso_enforced, allow_public_signup")
      .eq("id", true)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Instance authentication settings are unavailable");
    return Response.json(
      {
        enabled: data.sso_enabled,
        enforced: data.sso_enforced,
        allow_public_signup: data.allow_public_signup,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[auth/sso-config] Unable to load instance authentication settings", error);
    return Response.json(
      { error: "Instance authentication settings are unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
