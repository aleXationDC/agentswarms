import { createFileRoute } from "@tanstack/react-router";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  applyAxtnDocumentIntake,
  seedAxtnDocumentIntake,
  seedAxtnDocumentCaseIntake,
} from "@/utils/axtnDocumentIntakeSeed.server";
import { requireSuperadmin } from "@/utils/iam.server";
import { seedDocumentRegistries } from "@/axtn/workbenches/documents/documentRegistries.server";
import { seedDocumentLocalTable } from "@/axtn/workbenches/documents/documentLocalTableSeed.server";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function handle(request: Request): Promise<Response> {
  const bearer = (request.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return json(401, { error: "Unauthorized" });

  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(bearer);
  if (authError || !auth.user) return json(401, { error: "Unauthorized" });

  const bootstrapEmail = (process.env.ADMIN_EMAIL ?? process.env.VITE_ADMIN_EMAIL ?? "")
    .trim()
    .toLowerCase();
  if (!bootstrapEmail || auth.user.email?.trim().toLowerCase() !== bootstrapEmail) {
    return json(403, { error: "Bootstrap administrator authorization required" });
  }
  const admin = await requireSuperadmin(bearer);
  if (!admin.ok || admin.userId !== auth.user.id) {
    return json(403, { error: "Bootstrap administrator authorization required" });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }
  const action =
    payload && typeof payload === "object" && "action" in payload ? payload.action : undefined;
  if (
    action !== "seed" &&
    action !== "apply" &&
    action !== "seed_case" &&
    action !== "seed_registries" &&
    action !== "seed_local_table"
  ) {
    return json(400, { error: "Unsupported Document Intake action" });
  }

  try {
    if (action === "seed_local_table") {
      const result = await seedDocumentLocalTable(auth.user.id);
      return json(200, {
        ...result,
        message: "Canonical Local Table MCP Builder object reconciled; no runtime/key activation.",
      });
    }
    if (action === "seed_registries") {
      const result = await seedDocumentRegistries(auth.user.id);
      return json(200, {
        ...result,
        message: "Document registries reconciled; no recognition or automation activated.",
      });
    }
    if (action === "seed_case") {
      const result = await seedAxtnDocumentCaseIntake(auth.user.id);
      return json(200, {
        ...result,
        message: "Case-bound Document Intake reconciled through native publish.",
      });
    }
    if (action === "seed") {
      const result = await seedAxtnDocumentIntake(auth.user.id);
      return json(200, {
        ...result,
        message: result.created
          ? "Document Intake swarm created and published."
          : "Document Intake swarm already exists and is published.",
      });
    }
    const result = await applyAxtnDocumentIntake(auth.user.id);
    return json(200, {
      ...result,
      message:
        result.changed || result.published
          ? "Document Intake versioned nodes applied and published."
          : "Document Intake is already up to date; nothing changed.",
    });
  } catch (error) {
    console.error("[aXtn Document Intake bootstrap]", error);
    return json(500, { error: "Document Intake seed/apply failed; inspect the server log." });
  }
}

export const Route = createFileRoute("/api/axtn/document-intake")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
    },
  },
});
