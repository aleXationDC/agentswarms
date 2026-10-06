import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { canonicalJson } from "@/utils/provenance/canonical";
import { executeSwarmServer } from "@/utils/swarmExecute.server";
import { resolveInternalOrigin } from "@/utils/internalOrigin.server";
import { acquireSlotGlobal, envInt, rateLimitedGlobal } from "@/utils/rateLimit.server";
import { CaseAccessView } from "./caseAssignmentContract";
import { executeCaseWork } from "./work.server";
import { CaseSwarmStart } from "./caseSwarmContract";

export async function startCaseSwarm(input: CaseSwarmStart) {
  const request = CaseSwarmStart.parse(input);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("CASE_EXECUTION_SERVER_NOT_CONFIGURED");
  const client = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${request.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("CASE_ACCESS_DENIED");
  const userId = auth.user.id;
  const principal = { kind: "user_session" as const, id: userId };
  const access = CaseAccessView.parse(
    await executeCaseWork(
      userId,
      {
        operation: "case_access",
        caseId: request.caseId,
        sharedOnly: false,
        offset: 0,
        limit: 1,
      },
      principal,
    ),
  );
  if (access.total !== 1 || access.cases[0]?.case_id !== request.caseId)
    throw new Error("CASE_ACCESS_DENIED");
  const digest = createHash("sha256")
    .update(canonicalJson([userId, request.caseId, request.operationKey]))
    .digest("hex");
  const runId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-5${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
  const requestHash = createHash("sha256")
    .update(
      canonicalJson({
        userId,
        caseId: request.caseId,
        swarmId: request.swarmId,
        publishedVersionId: request.publishedVersionId,
        input: request.input,
      }),
    )
    .digest("hex");
  async function replay() {
    const { data: prior, error } = await client
      .from("swarm_runs")
      .select("id,case_id,status,final_output,error_message,swarm_snapshot")
      .eq("id", runId)
      .maybeSingle();
    if (error) throw new Error("CASE_EXECUTION_RUN_READ_FAILED");
    if (!prior) return null;
    const snapshot = z
      .object({ startRequestHash: z.string(), publishedVersionId: z.string().uuid() })
      .parse(prior.swarm_snapshot);
    if (
      snapshot.startRequestHash !== requestHash ||
      snapshot.publishedVersionId !== request.publishedVersionId
    )
      throw new Error("CASE_EXECUTION_START_REQUEST_MISMATCH");
    if (prior.case_id && prior.case_id !== request.caseId) throw new Error("CASE_ACCESS_DENIED");
    return {
      runId: prior.id,
      status: prior.status,
      output: prior.final_output ?? "",
      error: prior.error_message,
      publishedVersionId: snapshot.publishedVersionId,
      replayed: true,
    };
  }
  const prior = await replay();
  if (prior) return prior;
  if (access.cases[0].status === "CLOSED") throw new Error("CASE_EXECUTION_INACTIVE");
  const { data: swarm, error } = await client
    .from("swarms")
    .select("id,name,user_id,published_version_id,published_nodes,published_edges,published_at")
    .eq("id", request.swarmId)
    .maybeSingle();
  if (error || !swarm || swarm.user_id !== userId) throw new Error("CASE_SWARM_ACCESS_DENIED");
  if (
    !swarm.published_at ||
    !Array.isArray(swarm.published_nodes) ||
    swarm.published_version_id !== request.publishedVersionId
  )
    throw new Error("CASE_SWARM_PUBLISHED_REVISION_CHANGED");
  const bucket = `case-swarm-session:${userId}`;
  if (await rateLimitedGlobal(bucket, envInt("SWARM_RUN_RATE_LIMIT_PER_MIN", 30)))
    throw new Error("CASE_EXECUTION_RATE_LIMITED");
  const slot = await acquireSlotGlobal(
    bucket,
    envInt("SWARM_RUN_MAX_CONCURRENT", 5),
    envInt("SWARM_RUN_TIMEOUT_MS", 600_000) / 1000 + 300,
  );
  if (!slot) throw new Error("CASE_EXECUTION_CONCURRENT_LIMIT");
  try {
    const result = await executeSwarmServer({
      swarm: {
        id: swarm.id,
        name: swarm.name,
        nodes: swarm.published_nodes,
        edges: swarm.published_edges,
      },
      userId,
      origin: resolveInternalOrigin(),
      input: request.input,
      source: "api",
      rejectApprovals: false,
      caseExecution: { caseId: request.caseId, principal, nativeStart: true },
      caseStart: { runId, requestHash, publishedVersionId: request.publishedVersionId },
      initialState: {
        case_id: request.caseId,
        case_run_id: runId,
      },
    });
    if (!result.runId) throw new Error("CASE_EXECUTION_PERSISTED_RUN_REQUIRED");
    return { ...result, publishedVersionId: request.publishedVersionId, replayed: false };
  } catch (cause) {
    if (cause instanceof Error && cause.message === "CASE_EXECUTION_START_ALREADY_CLAIMED") {
      const claimed = await replay();
      if (claimed) return claimed;
    }
    throw cause;
  } finally {
    await slot.release();
  }
}
