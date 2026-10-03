import { createHash } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { canonicalJson } from "@/utils/provenance/canonical";
import { acquireSlotGlobal } from "@/utils/rateLimit.server";
import { getRuntimeSettings, countLiveSessions, countLiveSessionsTotal } from "./config.server";
import { DevelopmentVerification } from "./developmentContract";
import { assertDevelopmentSnapshots } from "./developmentSource.server";
import { getSession, refreshSession, startSession } from "./service.server";

const hash = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
const Side = z
  .object({
    pass: z.boolean(),
    compileExitCode: z.number().int(),
    testsRun: z.number().int().nonnegative().optional(),
    failures: z.number().int().nonnegative().optional(),
    errors: z.number().int().nonnegative().optional(),
    reason: z.string().optional(),
    outputHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    contract: z.string().optional(),
  })
  .strict();
const Envelope = z
  .object({
    schema: z.literal("axtn.development.verify/v1"),
    effectKey: z.string(),
    taskId: z.string(),
    attemptId: z.string(),
    baseSHA: z.string(),
    candidateSHA: z.string(),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/),
    harnessHash: z.string().regex(/^[a-f0-9]{64}$/),
    baseline: Side,
    candidate: Side,
    gateVerdict: z.enum(["PASS", "FAIL"]),
  })
  .strict();
const Receipt = Envelope.extend({
  image: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  sessionId: z.string().uuid(),
});

export class DevelopmentRuntimeError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DevelopmentRuntimeError";
  }
}

export async function runDevelopmentVerification(userId: string, value: unknown) {
  const request = DevelopmentVerification.parse(value);
  const settings = await getRuntimeSettings();
  if (!settings.enabled || settings.backend !== "docker" || !settings.requireGrant) {
    throw new DevelopmentRuntimeError(
      "RUNTIME_UNAVAILABLE",
      503,
      "Native verification requires enabled Docker runtime and explicit grants",
    );
  }
  const { data: grant, error: grantError } = await supabaseAdmin
    .from("notebook_runtime_grants")
    .select("id")
    .eq("principal_type", "user")
    .eq("principal_id", userId)
    .maybeSingle();
  if (grantError)
    throw new DevelopmentRuntimeError(
      "GRANT_LOOKUP_FAILED",
      503,
      "Native runtime grant lookup failed",
    );
  if (!grant)
    throw new DevelopmentRuntimeError(
      "GRANT_REQUIRED",
      403,
      "An explicit native runtime user grant is required",
    );
  const { data: dataset, error: datasetError } = await supabaseAdmin
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", "axtn_cases")
    .maybeSingle();
  if (datasetError)
    throw new DevelopmentRuntimeError(
      "CASE_LOOKUP_FAILED",
      503,
      "Native verification Case owner lookup failed",
    );
  if (!dataset)
    throw new DevelopmentRuntimeError(
      "CASE_SCOPE_DENIED",
      403,
      "Owner-bound native verification Cases required",
    );
  const { data: workCase, error: caseError } = await supabaseAdmin
    .from("user_data_rows")
    .select("row")
    .eq("table_id", dataset.id)
    .filter("row->>case_id", "eq", request.caseId)
    .maybeSingle();
  if (caseError)
    throw new DevelopmentRuntimeError(
      "CASE_LOOKUP_FAILED",
      503,
      "Native verification Case lookup failed",
    );
  if (!workCase)
    throw new DevelopmentRuntimeError(
      "CASE_SCOPE_DENIED",
      403,
      "An owner-bound native verification Case is required",
    );
  const harness = process.env.AXTN_DEVELOPMENT_HARNESS_SHA256;
  if (!harness || !/^[a-f0-9]{64}$/.test(harness))
    throw new Error("Protected native harness pin required");
  const inputHash = hash(request);
  const slot = await acquireSlotGlobal("axtn-development-verify", 1, 120);
  if (!slot)
    throw new DevelopmentRuntimeError(
      "RUNTIME_CAPACITY",
      429,
      "Native verification is at bounded capacity",
    );
  try {
    await assertDevelopmentSnapshots(userId, request);
    const { data: previous, error } = await supabaseAdmin
      .from("notebook_runtime_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("entrypoint", "axtn-development-verify-v1")
      .filter("inputs->>effectKey", "eq", request.effectKey)
      .maybeSingle();
    if (error) throw new Error("Native verification identity lookup failed");
    if (previous && hash(previous.inputs) !== inputHash) {
      throw new DevelopmentRuntimeError(
        "EFFECT_CONFLICT",
        409,
        "Conflicting native verification effect identity",
      );
    }
    if (
      !previous &&
      ((await countLiveSessions(userId)) >= settings.maxSessionsPerUser ||
        (await countLiveSessionsTotal()) >= settings.maxSessionsTotal)
    ) {
      throw new Error("Native runtime session capacity exceeded");
    }
    let session =
      previous ??
      (
        await startSession({
          userId,
          kind: "batch",
          developmentVerification: request,
        })
      ).session;
    const deadline = Date.now() + 45_000;
    while (!["succeeded", "error", "stopped"].includes(session.status) && Date.now() < deadline) {
      session = await refreshSession(session);
      if (!["succeeded", "error", "stopped"].includes(session.status)) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (!["succeeded", "error", "stopped"].includes(session.status)) {
      return { sessionId: session.id, status: "PENDING" as const, inputHash };
    }
    if (session.status !== "succeeded") {
      throw new Error(`Native verification session ${session.id} failed`);
    }
    if (!session.result) {
      const envelope = Envelope.parse(JSON.parse(session.logs ?? ""));
      if (
        envelope.inputHash !== inputHash ||
        envelope.harnessHash !== harness ||
        envelope.candidateSHA !== request.candidateSHA ||
        envelope.baseSHA !== request.baseSHA ||
        envelope.effectKey !== request.effectKey ||
        envelope.taskId !== request.taskId ||
        envelope.attemptId !== request.attemptId ||
        (envelope.gateVerdict === "PASS") !== envelope.candidate.pass ||
        (envelope.candidate.pass &&
          (!envelope.candidate.testsRun || envelope.candidate.compileExitCode !== 0))
      ) {
        throw new Error(
          "Native verification envelope does not match immutable request and harness",
        );
      }
      const { error: writeError } = await supabaseAdmin
        .from("notebook_runtime_sessions")
        .update({ result: { ...envelope, image: session.image, sessionId: session.id } })
        .eq("id", session.id)
        .eq("user_id", userId);
      if (writeError) throw new Error("Native verification receipt persistence failed");
      const persisted = await getSession(userId, session.id);
      if (!persisted) throw new Error("Native verification receipt disappeared after persistence");
      session = persisted;
    }
    const evidence = Receipt.parse(session.result);
    if (
      evidence.inputHash !== inputHash ||
      evidence.harnessHash !== harness ||
      evidence.image !== process.env.AXTN_DEVELOPMENT_RUNTIME_IMAGE ||
      evidence.image !== session.image ||
      evidence.sessionId !== session.id ||
      evidence.baseSHA !== request.baseSHA ||
      evidence.candidateSHA !== request.candidateSHA ||
      evidence.effectKey !== request.effectKey ||
      evidence.taskId !== request.taskId ||
      evidence.attemptId !== request.attemptId ||
      (evidence.gateVerdict === "PASS") !== evidence.candidate.pass
    ) {
      throw new Error("Cached native verification receipt has a different immutable authority");
    }
    return { sessionId: session.id, status: "COMPLETED" as const, evidence };
  } finally {
    await slot.release();
  }
}
