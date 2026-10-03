import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { canonicalJson } from "@/utils/provenance/canonical";
import { DevelopmentVerification } from "@/utils/notebookRuntime/developmentContract";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  settings: vi.fn(),
  count: vi.fn(),
  total: vi.fn(),
  slot: vi.fn(),
  release: vi.fn(),
  source: vi.fn(),
  get: vi.fn(),
  refresh: vi.fn(),
  start: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: mocks.from },
}));
vi.mock("@/utils/rateLimit.server", () => ({ acquireSlotGlobal: mocks.slot }));
vi.mock("@/utils/notebookRuntime/config.server", () => ({
  getRuntimeSettings: mocks.settings,
  countLiveSessions: mocks.count,
  countLiveSessionsTotal: mocks.total,
}));
vi.mock("@/utils/notebookRuntime/developmentSource.server", () => ({
  assertDevelopmentSnapshots: mocks.source,
}));
vi.mock("@/utils/notebookRuntime/service.server", () => ({
  getSession: mocks.get,
  refreshSession: mocks.refresh,
  startSession: mocks.start,
}));
import { runDevelopmentVerification } from "@/utils/notebookRuntime/development.server";

const request = DevelopmentVerification.parse({
  schema: "axtn.development.verify/v1",
  repository: "aXtn/development-swarm-acceptance",
  effectKey: "task:attempt:verify",
  taskId: "task",
  attemptId: "attempt",
  caseId: "e9d954a7-8c37-48c9-988d-5942f21bbb19",
  baseSHA: "a".repeat(40),
  candidateSHA: "b".repeat(40),
  profile: "documentation-v1",
  baseline: [],
  candidate: [],
});
const image = `sha256:${"c".repeat(64)}`;
const receipt = {
  schema: request.schema,
  effectKey: request.effectKey,
  taskId: request.taskId,
  attemptId: request.attemptId,
  baseSHA: request.baseSHA,
  candidateSHA: request.candidateSHA,
  inputHash: createHash("sha256").update(canonicalJson(request)).digest("hex"),
  harnessHash: "d".repeat(64),
  baseline: { pass: false, compileExitCode: 0, testsRun: 3, failures: 1 },
  candidate: { pass: true, compileExitCode: 0, testsRun: 3, failures: 0 },
  gateVerdict: "PASS",
  image,
  sessionId: "c1934e12-0d49-47b8-a942-864351246cad",
};
const session = {
  id: receipt.sessionId,
  image,
  status: "succeeded",
  inputs: request,
  result: receipt,
};

function query(table: string, data: unknown, error: unknown = null) {
  const response = { data, error };
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    filter: vi.fn(() => chain),
    update: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => response),
    then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve),
  };
  mocks.from.mockImplementationOnce((actual) => {
    expect(actual).toBe(table);
    return chain;
  });
  return chain;
}
function authorized(previous: unknown = session) {
  const grant = query("notebook_runtime_grants", { id: "grant" });
  const dataset = query("user_data_tables", { id: "dataset" });
  const row = query("user_data_rows", { row: { case_id: request.caseId } });
  const previousQuery = query("notebook_runtime_sessions", previous);
  return { grant, dataset, row, previousQuery };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AXTN_DEVELOPMENT_HARNESS_SHA256", receipt.harnessHash);
  vi.stubEnv("AXTN_DEVELOPMENT_RUNTIME_IMAGE", image);
  mocks.settings.mockResolvedValue({
    enabled: true,
    backend: "docker",
    requireGrant: true,
    maxSessionsPerUser: 1,
    maxSessionsTotal: 1,
  });
  mocks.count.mockResolvedValue(0);
  mocks.total.mockResolvedValue(0);
  mocks.slot.mockResolvedValue({ release: mocks.release });
  mocks.release.mockResolvedValue(undefined);
  mocks.source.mockResolvedValue(undefined);
});

describe("native verification authority and idempotent receipt controller", () => {
  it.each([
    { enabled: false, backend: "docker", requireGrant: true },
    { enabled: true, backend: "k8s", requireGrant: true },
    { enabled: true, backend: "docker", requireGrant: false },
  ])("cannot bypass explicit scoped enablement", async (settings) => {
    mocks.settings.mockResolvedValue(settings);
    await expect(runDevelopmentVerification("owner", request)).rejects.toMatchObject({
      status: 503,
    });
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("requires a direct grant, even for an otherwise privileged operator", async () => {
    query("notebook_runtime_grants", null);
    await expect(runDevelopmentVerification("owner", request)).rejects.toMatchObject({
      status: 403,
    });
    expect(mocks.source).not.toHaveBeenCalled();
  });
  it("denies foreign Case scope before any source or runtime effect", async () => {
    query("notebook_runtime_grants", { id: "grant" });
    query("user_data_tables", { id: "owner-dataset" });
    query("user_data_rows", null);
    await expect(runDevelopmentVerification("owner", request)).rejects.toMatchObject({
      status: 403,
    });
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("replays the same immutable receipt, without another runtime", async () => {
    const queries = authorized();
    const result = await runDevelopmentVerification("owner", request);
    expect(result).toEqual({ sessionId: session.id, status: "COMPLETED", evidence: receipt });
    expect(queries.grant.eq).toHaveBeenCalledWith("principal_id", "owner");
    expect(queries.dataset.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(queries.previousQuery.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it("rejects a different request under an existing effect key", async () => {
    authorized({ ...session, inputs: { ...request, candidateSHA: "e".repeat(40) } });
    await expect(runDevelopmentVerification("owner", request)).rejects.toMatchObject({
      status: 409,
    });
    expect(mocks.start).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it.each([
    { harnessHash: "e".repeat(64) },
    { image: `sha256:${"e".repeat(64)}` },
    { inputHash: "e".repeat(64) },
    { candidateSHA: "e".repeat(40) },
    { gateVerdict: "FAIL" },
  ])("rejects stale or inconsistent persisted receipt authority", async (change) => {
    authorized({ ...session, result: { ...receipt, ...change } });
    await expect(runDevelopmentVerification("owner", request)).rejects.toThrow(
      "immutable authority",
    );
  });
  it("does not turn a failed runtime into PASS", async () => {
    authorized({ ...session, status: "error", result: null });
    await expect(runDevelopmentVerification("owner", request)).rejects.toThrow("failed");
  });
  it("rejects global capacity before creating a second native session", async () => {
    authorized(null);
    mocks.total.mockResolvedValue(1);
    await expect(runDevelopmentVerification("owner", request)).rejects.toThrow("capacity");
    expect(mocks.start).not.toHaveBeenCalled();
  });
  it("reports a lost receipt read instead of returning a success-shaped fallback", async () => {
    authorized({
      ...session,
      result: null,
      logs: JSON.stringify(
        Object.fromEntries(
          Object.entries(receipt).filter(([key]) => !["image", "sessionId"].includes(key)),
        ),
      ),
    });
    query("notebook_runtime_sessions", null);
    mocks.get.mockResolvedValue(null);
    await expect(runDevelopmentVerification("owner", request)).rejects.toThrow("disappeared");
  });
});
