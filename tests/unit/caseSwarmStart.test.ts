import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalJson } from "@/utils/provenance/canonical";
import { CaseSwarmStart } from "@/axtn/workbenches/cases/caseSwarmContract";
import { startCaseSwarm } from "@/axtn/workbenches/cases/caseSwarm.server";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  work: vi.fn(),
  user: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: mocks.user },
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: () => mocks.read(table),
      };
      return query;
    },
  }),
}));
vi.mock("@/axtn/workbenches/cases/work.server", () => ({ executeCaseWork: mocks.work }));
vi.mock("@/utils/swarmExecute.server", () => ({ executeSwarmServer: mocks.execute }));
vi.mock("@/utils/internalOrigin.server", () => ({ resolveInternalOrigin: () => "http://native" }));
vi.mock("@/utils/rateLimit.server", () => ({
  envInt: (_name: string, fallback: number) => fallback,
  rateLimitedGlobal: async () => false,
  acquireSlotGlobal: async () => ({ release: async () => {} }),
}));

const owner = "f8753929-d860-4391-a551-4f0d1d90b8f0";
const request = {
  access_token: "authenticated-session",
  caseId: "a8753929-d860-4391-a551-4f0d1d90b8f0",
  swarmId: "b8753929-d860-4391-a551-4f0d1d90b8f0",
  publishedVersionId: "c8753929-d860-4391-a551-4f0d1d90b8f0",
  operationKey: "d8753929-d860-4391-a551-4f0d1d90b8f0",
  input: "Review current minimized case intent",
};
const swarm = {
  id: request.swarmId,
  name: "Case Work",
  user_id: owner,
  published_version_id: request.publishedVersionId,
  published_nodes: [],
  published_edges: [],
  published_at: "2026-10-06T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_URL = "http://supabase";
  process.env.SUPABASE_PUBLISHABLE_KEY = "test-public-key";
  mocks.user.mockResolvedValue({ data: { user: { id: owner } }, error: null });
  mocks.work.mockResolvedValue({
    scope: "AUTHORIZED_CASES",
    total: 1,
    offset: 0,
    limit: 1,
    cases: [
      {
        case_id: request.caseId,
        subject: "same case",
        case_access_mode: "CUSTODIAN",
        status: "OPEN",
      },
    ],
  });
  mocks.read.mockImplementation(async (table: string) => ({
    data: table === "swarms" ? swarm : null,
    error: null,
  }));
  mocks.execute.mockImplementation(async (opts) => ({
    runId: opts.caseStart.runId,
    status: "success",
    output: "persisted readback",
    error: null,
  }));
});

describe("authenticated published native Case start", () => {
  it("derives the principal and immutable execution snapshot server-side", async () => {
    const result = await startCaseSwarm(request);
    expect(result.status).toBe("success");
    expect(result.replayed).toBe(false);
    const options = mocks.execute.mock.calls[0][0];
    expect(options.caseExecution).toEqual({
      caseId: request.caseId,
      principal: { kind: "user_session", id: owner },
      nativeStart: true,
    });
    expect(options.swarm).toEqual({
      id: swarm.id,
      name: swarm.name,
      nodes: swarm.published_nodes,
      edges: swarm.published_edges,
    });
    expect(options.caseStart.runId).toMatch(/^[a-f0-9-]{36}$/);
    expect(options.initialState.case_id).toBe(request.caseId);
    expect(options.rejectApprovals).toBe(false);
  });
  it("rejects client identity, owner, route or graph injection", () => {
    for (const field of ["userId", "principal", "nodes", "provider", "case_run_id"])
      expect(CaseSwarmStart.safeParse({ ...request, [field]: "forged" }).success).toBe(false);
  });
  it("rejects inaccessible Case without creating a Run", async () => {
    mocks.work.mockResolvedValue({
      scope: "AUTHORIZED_CASES",
      total: 0,
      offset: 0,
      limit: 1,
      cases: [],
    });
    await expect(startCaseSwarm(request)).rejects.toThrow("CASE_ACCESS_DENIED");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("rejects changed publication instead of silently running the draft/new revision", async () => {
    mocks.read.mockImplementation(async (table: string) => ({
      data: table === "swarms" ? { ...swarm, published_version_id: null } : null,
      error: null,
    }));
    await expect(startCaseSwarm(request)).rejects.toThrow("CASE_SWARM_PUBLISHED_REVISION_CHANGED");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("replays the native persisted result without inference or a second effect", async () => {
    const requestHash = createHash("sha256")
      .update(
        canonicalJson({
          userId: owner,
          caseId: request.caseId,
          swarmId: request.swarmId,
          publishedVersionId: request.publishedVersionId,
          input: request.input,
        }),
      )
      .digest("hex");
    mocks.read.mockResolvedValue({
      data: {
        id: "retained-run",
        case_id: request.caseId,
        status: "success",
        final_output: "retained-result",
        error_message: null,
        swarm_snapshot: {
          startRequestHash: requestHash,
          publishedVersionId: request.publishedVersionId,
        },
      },
      error: null,
    });
    expect(await startCaseSwarm(request)).toMatchObject({
      runId: "retained-run",
      output: "retained-result",
      replayed: true,
    });
    expect(mocks.execute).not.toHaveBeenCalled();
    await expect(startCaseSwarm({ ...request, input: "different intent" })).rejects.toThrow(
      "CASE_EXECUTION_START_REQUEST_MISMATCH",
    );
  });
  it("reconciles an atomic native run-ID claim race rather than running twice", async () => {
    mocks.execute.mockImplementationOnce(async (options) => {
      mocks.read.mockResolvedValue({
        data: {
          id: options.caseStart.runId,
          case_id: request.caseId,
          status: "running",
          final_output: null,
          error_message: null,
          swarm_snapshot: {
            startRequestHash: options.caseStart.requestHash,
            publishedVersionId: request.publishedVersionId,
          },
        },
        error: null,
      });
      throw new Error("CASE_EXECUTION_START_ALREADY_CLAIMED");
    });
    expect(await startCaseSwarm(request)).toMatchObject({ status: "running", replayed: true });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
});
