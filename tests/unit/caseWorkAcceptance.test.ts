import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { canonicalJson } from "@/utils/provenance/canonical";

const { from, rpc, git } = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
  git: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from, rpc } }));
vi.mock("@/utils/notebookRuntime/developmentSource.server", () => ({ readDevelopmentGit: git }));
import {
  assertWorkPullHead,
  assertParentWorkCompletion,
} from "@/axtn/workbenches/cases/workAcceptance.server";

const caseId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const approvalId = "33333333-3333-4333-8333-333333333333";
const runId = "44444444-4444-4444-8444-444444444444";
const candidateSHA = "b".repeat(40);
const image = `sha256:${"c".repeat(64)}`;
const harnessHash = "d".repeat(64);
const hash = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
const request = {
  operation: "accept" as const,
  caseId,
  candidateSHA,
  approvalId,
  transitionKey: "accept",
};
const snapshot = { nodes: ["native frozen graph"] };
const inputs = { taskId: "task", attemptId: "attempt", candidateSHA, caseId };

function setup() {
  const rows: Record<string, unknown> = {
    approvals: {
      swarm_run_id: runId,
      payload: {
        axtnDevelopment: {
          caseId,
          candidateSHA,
          repository: "aXtn/development-swarm-acceptance",
          pullRequest: 2,
          runtimeSessionId: sessionId,
          graphHash: hash(snapshot),
        },
      },
    },
    swarm_runs: { id: runId, swarm_snapshot: snapshot },
    notebook_runtime_sessions: {
      image,
      inputs,
      status: "succeeded",
      result: {
        schema: "axtn.development.verify/v1",
        effectKey: "task:attempt:verify",
        taskId: "task",
        attemptId: "attempt",
        baseSHA: "a".repeat(40),
        candidateSHA,
        image,
        sessionId,
        harnessHash,
        inputHash: hash(inputs),
        baseline: { pass: false, compileExitCode: 0, testsRun: 3 },
        candidate: { pass: true, compileExitCode: 0, testsRun: 3 },
        gateVerdict: "PASS",
      },
    },
    user_data_tables: { id: "dataset" },
    user_data_rows: {
      row: {
        case_type: "DEVELOPMENT_CHANGE",
        candidate_sha: candidateSHA,
        accepted_approval_id: approvalId,
        integration_phase: "PR_READY",
      },
    },
  };
  from.mockImplementation((table: string) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: rows[table], error: null })),
    };
    return query;
  });
  return rows;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AXTN_DEVELOPMENT_RUNTIME_IMAGE", image);
  vi.stubEnv("AXTN_DEVELOPMENT_HARNESS_SHA256", harnessHash);
  rpc.mockResolvedValue({ error: null });
  git.mockResolvedValue({ number: 2, state: "open", merged: false, head: { sha: candidateSHA } });
});

describe("independent exact-revision native Acceptance source boundary", () => {
  it("revalidates native receipt, protected pins, frozen graph and actual open PR head", async () => {
    setup();
    await expect(assertWorkPullHead("owner", request)).resolves.toBeUndefined();
    expect(git).toHaveBeenCalledWith("owner", "fetch", { target: "pull", identifier: "2" });
  });
  it("binds pre-PR native Approval to the later exact PR from protected Case references", async () => {
    const rows = setup();
    const approval = rows.approvals as { payload: { axtnDevelopment: { pullRequest?: number } } };
    delete approval.payload.axtnDevelopment.pullRequest;
    rows.user_data_rows = {
      row: {
        candidate_sha: candidateSHA,
        references: [
          {
            kind: "pull_request",
            repository: "aXtn/development-swarm-acceptance",
            id: "2",
            revision: candidateSHA,
          },
        ],
      },
    };
    await expect(assertWorkPullHead("owner", request)).resolves.toBeUndefined();
    rows.user_data_rows = { row: { candidate_sha: candidateSHA, references: [] } };
    await expect(assertWorkPullHead("owner", request)).rejects.toThrow("one exact Candidate PR");
  });
  it.each(["FAIL", "empty-tests", "compile", "harness", "image", "input", "session", "candidate"])(
    "rejects %s native authority mismatch before reading PR",
    async (variant) => {
      const rows = setup();
      const row = rows.notebook_runtime_sessions as {
        result: Record<string, unknown> & { candidate: Record<string, unknown> };
      };
      if (variant === "FAIL") row.result.gateVerdict = "FAIL";
      if (variant === "empty-tests") row.result.candidate.testsRun = 0;
      if (variant === "compile") row.result.candidate.compileExitCode = 1;
      if (variant === "harness") row.result.harnessHash = "e".repeat(64);
      if (variant === "image") row.result.image = `sha256:${"e".repeat(64)}`;
      if (variant === "input") row.result.inputHash = "e".repeat(64);
      if (variant === "session") row.result.sessionId = runId;
      if (variant === "candidate") row.result.candidateSHA = "e".repeat(40);
      await expect(assertWorkPullHead("owner", request)).rejects.toThrow();
      expect(git).not.toHaveBeenCalled();
    },
  );
  it("rejects changed graph snapshot and unavailable owner run", async () => {
    const rows = setup();
    rows.swarm_runs = { id: runId, swarm_snapshot: { nodes: ["forged"] } };
    await expect(assertWorkPullHead("owner", request)).rejects.toThrow("snapshot changed");
    rows.swarm_runs = null;
    await expect(assertWorkPullHead("owner", request)).rejects.toThrow("owner denied");
  });
  it("invalidates Case hard gates for actual PR drift, and propagates invalidation failure", async () => {
    setup();
    git.mockResolvedValue({
      number: 2,
      state: "open",
      merged: false,
      head: { sha: "e".repeat(40) },
    });
    await expect(assertWorkPullHead("owner", request)).rejects.toThrow("drift");
    expect(rpc).toHaveBeenCalledWith(
      "axtn_case_work",
      expect.objectContaining({
        p_user_id: "owner",
        p_payload: expect.objectContaining({
          eventType: "CHECKS_FAILED",
          reasonCode: "PULL_HEAD_DRIFT",
        }),
      }),
    );
    rpc.mockResolvedValue({ error: { message: "unavailable" } });
    await expect(assertWorkPullHead("owner", request)).rejects.toThrow("could not invalidate");
  });
  it("revalidates accepted Parent at completion rather than trusting the stored flag", async () => {
    const rows = setup();
    await expect(assertParentWorkCompletion("owner", caseId)).resolves.toBeUndefined();
    expect(git).toHaveBeenCalledOnce();
    rows.user_data_rows = { row: { case_type: "DEVELOPMENT_CHANGE", candidate_sha: candidateSHA } };
    await expect(assertParentWorkCompletion("owner", caseId)).rejects.toThrow("Approval required");
  });
});
