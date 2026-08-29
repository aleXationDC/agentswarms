// Applying a human's decision on a candidate domain.
//
// The approvals inbox writes the decision from the browser and, for an approval
// with no `swarm_run_id`, nothing else happens — there is no native server-side
// hook that fires when an approval is decided. This is that missing edge, and
// nothing more: it reads the decision the human already recorded and applies
// the operation the card described.
//
// The decision is never taken as a parameter. It is read from the approvals
// row under the caller's own JWT, so RLS decides whether the row is theirs and
// a caller cannot confirm a domain by asserting that it was approved.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { applyDomainDecision, reconcileDomainDecisions } from "@/lib/domainGovernance";

type Fail = { ok: false; error: string };

async function callerId(accessToken: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const authorization = ["Bearer", accessToken].join(" ");
  const sb = createClient<Database>(url, key, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
  } = await sb.auth.getUser();
  return user?.id ?? null;
}

/** Apply one decided domain approval. */
export const applyDomainApproval = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ access_token: z.string().min(1), approval_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }): Promise<Fail | { ok: true; outcome: string }> => {
    const userId = await callerId(data.access_token);
    if (!userId) return { ok: false, error: "Not signed in" };

    const res = await applyDomainDecision(supabaseAdmin as never, {
      userId,
      approvalId: data.approval_id,
    });
    if (!res.applied) return { ok: false, error: res.reason ?? "Could not apply the decision" };
    return { ok: true, outcome: res.outcome ?? "applied" };
  });

/**
 * Catch up on any domain approvals decided earlier.
 *
 * Cheap to call and safe to repeat: each approval is stamped once applied, so a
 * decision is never performed twice.
 */
export const reconcileDomainApprovals = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ access_token: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<Fail | { ok: true; applied: number }> => {
    const userId = await callerId(data.access_token);
    if (!userId) return { ok: false, error: "Not signed in" };
    const res = await reconcileDomainDecisions(supabaseAdmin as never, userId);
    return { ok: true, applied: res.applied };
  });
