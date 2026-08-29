// Server functions backing the System Extensions admin area
// (/system-extensions). Superadmin-gated, mirroring the pattern used by
// notebookRuntimeAdmin.functions.ts: a thin createServerFn wrapper around
// supabaseAdmin (service role), guarded by requireSuperadmin(access_token).
//
// Covers two narrowly-scoped config surfaces (see
// supabase/migrations/20260837000000_human_access_system_extensions.sql):
//
//   - matrix_system_access: the canonical control room + operator MXID
//     allowlist for privileged Matrix system commands. This CONSOLIDATES the
//     policy check already used by the canonical MatrixPolicy
//     (ops/n8n/matrix-e2ee-adapter/src/policy.rs) instead of introducing a
//     second policy system — the Matrix adapter reads this table (via the
//     Supabase REST client, service-role key) instead of a static env var.
//
//   - maintenance_access: exactly three admin-configurable values (opening
//     phrase, answer phrase, maintenance path). The opening phrase is never
//     read back in plaintext or as a hash by this UI — it is write-only via
//     the set_opening_phrase() RPC, which hashes it with pgcrypto bcrypt
//     entirely inside Postgres. The maintenance_path is pure config: no code
//     anywhere hardcodes a domain, so changing it never requires a
//     deployment (only, if the DOMAIN itself changes, a one-time Caddy
//     site-block update — an operational action, not a code change).
//
// Also exposes read-only "External Extension" links (Gitea/n8n/Renovate/
// System Monitor): these are infra endpoints, not conversation/approval
// surfaces, and are only ever opened via "Open in new tab" — AgentSwarms
// does not proxy or re-implement their UIs.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSuperadmin } from "@/utils/iam.server";

export type SysExtError = { ok: false; error: string };

export type MatrixSystemAccess = {
  control_room_id: string;
  operator_mxids: string[];
};

export type MaintenanceAccess = {
  // has_opening_phrase reflects whether a hash is set — never the phrase or
  // the hash itself.
  has_opening_phrase: boolean;
  answer_phrase: string;
  maintenance_path: string;
  status: "OPEN" | "CLOSED";
  opened_at: string | null;
  last_activity_at: string | null;
};

export type ExternalExtensionLink = {
  key: "system_monitor" | "gitea" | "renovate" | "n8n" | "matrix_admin";
  label: string;
  url: string | null;
};

export type SysExtState = {
  ok: true;
  matrix: MatrixSystemAccess;
  maintenance: MaintenanceAccess;
  extensions: ExternalExtensionLink[];
};

function normalizeOpeningPhrase(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

function isHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      (url.pathname === "/" || url.pathname === "") &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function externalExtensionLinks(): ExternalExtensionLink[] {
  // Pure infra endpoint URLs (not the Maintenance Path, which is admin
  // config, not env config) — read from env so no domain is hardcoded in
  // source, but changing these is an infra concern, not conversation state.
  return [
    { key: "system_monitor", label: "System Monitor", url: process.env.SYSTEM_MONITOR_URL || null },
    { key: "gitea", label: "Gitea", url: process.env.GITEA_URL || null },
    { key: "renovate", label: "Renovate", url: process.env.RENOVATE_URL || null },
    { key: "n8n", label: "n8n", url: process.env.N8N_URL || null },
    { key: "matrix_admin", label: "Matrix Admin", url: process.env.MATRIX_ADMIN_URL || null },
  ];
}

export const sysExtGetState = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ access_token: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<SysExtError | SysExtState> => {
    const guard = await requireSuperadmin(data.access_token);
    if (!guard.ok) return guard;

    const [matrixRes, maintenanceRes] = await Promise.all([
      supabaseAdmin.from("matrix_system_access").select("*").eq("id", true).maybeSingle(),
      supabaseAdmin.from("maintenance_access").select("*").eq("id", true).maybeSingle(),
    ]);

    const matrixRow = matrixRes.data;
    const maintenanceRow = maintenanceRes.data;

    return {
      ok: true,
      matrix: {
        control_room_id: matrixRow?.control_room_id ?? "",
        operator_mxids: matrixRow?.operator_mxids ?? [],
      },
      maintenance: {
        has_opening_phrase: !!maintenanceRow?.opening_phrase_hash,
        answer_phrase: maintenanceRow?.answer_phrase ?? "",
        maintenance_path: maintenanceRow?.maintenance_path ?? "",
        status: (maintenanceRow?.status as "OPEN" | "CLOSED") ?? "CLOSED",
        opened_at: maintenanceRow?.opened_at ?? null,
        last_activity_at: maintenanceRow?.last_activity_at ?? null,
      },
      extensions: externalExtensionLinks(),
    };
  });

export const sysExtUpdateMatrixAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        access_token: z.string().min(1),
        control_room_id: z.string(),
        operator_mxids: z.array(z.string()),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<SysExtError | { ok: true }> => {
    const guard = await requireSuperadmin(data.access_token);
    if (!guard.ok) return guard;

    const { error } = await supabaseAdmin
      .from("matrix_system_access")
      .update({
        control_room_id: data.control_room_id.trim(),
        operator_mxids: data.operator_mxids.map((m) => m.trim()).filter(Boolean),
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const sysExtUpdateMaintenanceConfig = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        access_token: z.string().min(1),
        answer_phrase: z.string(),
        maintenance_path: z
          .string()
          .refine(
            isHttpsOrigin,
            "Maintenance Path must be an absolute HTTPS origin without credentials, query, fragment, or a subpath",
          ),
        // Only present when the operator is setting/rotating it; omitted
        // otherwise so the phrase is never round-tripped unnecessarily.
        opening_phrase: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<SysExtError | { ok: true }> => {
    const guard = await requireSuperadmin(data.access_token);
    if (!guard.ok) return guard;

    const { error } = await supabaseAdmin
      .from("maintenance_access")
      .update({
        answer_phrase: data.answer_phrase,
        maintenance_path: data.maintenance_path.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) return { ok: false, error: error.message };

    if (data.opening_phrase && data.opening_phrase.trim().length > 0) {
      // Hashing happens entirely inside Postgres via pgcrypto — the
      // plaintext never touches application logs or is stored anywhere.
      const { error: rpcError } = await supabaseAdmin.rpc("set_opening_phrase", {
        phrase: normalizeOpeningPhrase(data.opening_phrase),
      });
      if (rpcError) return { ok: false, error: rpcError.message };
    }

    return { ok: true };
  });

// Called by the client (any authenticated user, not just superadmins — the
// AgentSwarms login itself is the security boundary) while it is genuinely
// being interacted with AND the page was loaded from the Maintenance Path
// origin. Deliberately NOT wired to generic HTTP middleware, so background
// polling (Gitea/n8n/browser prefetch) can never masquerade as activity —
// see AutoCloseHeartbeat component, which only fires on real user input
// events (pointer/key), debounced, and only while document.hasFocus().
export const sysExtTouchActivity = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ access_token: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<SysExtError | { ok: true }> => {
    const { data: userData, error } = await supabaseAdmin.auth.getUser(data.access_token);
    if (error || !userData.user) return { ok: false, error: "Invalid session" };

    const { error: rpcError } = await supabaseAdmin.rpc("touch_maintenance_activity");
    if (rpcError) return { ok: false, error: rpcError.message };
    return { ok: true };
  });

export const sysExtCloseMaintenance = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ access_token: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<SysExtError | { ok: true }> => {
    const guard = await requireSuperadmin(data.access_token);
    if (!guard.ok) return guard;

    const { error } = await supabaseAdmin.rpc("close_maintenance");
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
