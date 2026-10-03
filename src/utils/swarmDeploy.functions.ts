// Server functions for deploying swarms: create an API key (raw key returned
// once, only its SHA-256 hash is stored). Listing and revoking are done from
// the client under RLS. Schedules are managed with plain RLS queries too.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Scopes a swarm API key can carry. `run` is the only one that grants work. */
export const SWARM_KEY_SCOPES = ["run", "read_runs", "cases"] as const;
export type SwarmKeyScope = (typeof SWARM_KEY_SCOPES)[number];

export const createSwarmApiKey = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        access_token: z.string().min(1),
        swarm_id: z.string().uuid(),
        name: z.string().trim().min(1).max(80),
        reject_approvals: z.boolean().optional(),
        /** Days until the key expires; omitted / null = never expires. */
        expires_in_days: z.number().int().min(1).max(3650).nullable().optional(),
        scopes: z.array(z.enum(SWARM_KEY_SCOPES)).min(1).optional(),
        /**
         * Rotation: the key this one replaces. Both stay valid so callers can
         * be migrated during an overlap window; the old one is revoked
         * explicitly afterwards (never auto-revoked here — that would break
         * every live caller the instant a new key is minted).
         */
        rotated_from: z.string().uuid().optional(),
        /** Default destination for async run results (may be overridden per run). */
        callback_url: z.string().url().max(2000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { createSwarmApiKey } = await import("./swarmDeploy/operations.server");
    return createSwarmApiKey(data);
  });

/**
 * Whether headless runs can execute custom code — i.e. whether the operator
 * deployed the JS sandbox service. The Deploy dialog asks before warning that
 * Function/component nodes are canvas-only, so the warning reflects THIS
 * instance rather than a stale assumption baked into the UI.
 */
export const jsSandboxStatusFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ access_token: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { jsSandboxStatus } = await import("./swarmDeploy/operations.server");
    return jsSandboxStatus(data.access_token);
  });

/**
 * Publish the current canvas graph: from now on, API keys and schedules run
 * THIS snapshot until it is published again. The draft stays editable.
 */
export const publishSwarm = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ access_token: z.string().min(1), swarm_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { publishSwarm } = await import("./swarmDeploy/operations.server");
    return publishSwarm(data.access_token, data.swarm_id);
  });

/**
 * Drop the pinned snapshot: deployed runs go back to serving the live canvas.
 * Deliberately available — an operator who wants the old behaviour should be
 * able to choose it, rather than discovering the product decided for them.
 */
export const unpublishSwarm = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ access_token: z.string().min(1), swarm_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { unpublishSwarm } = await import("./swarmDeploy/operations.server");
    return unpublishSwarm(data.access_token, data.swarm_id);
  });
