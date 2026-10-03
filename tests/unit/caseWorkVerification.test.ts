import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc, verify, snapshot } = vi.hoisted(() => ({
  rpc: vi.fn(),
  verify: vi.fn(),
  snapshot: vi.fn(),
}));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
vi.mock("@/utils/notebookRuntime/development.server", () => ({
  runDevelopmentVerification: verify,
}));
vi.mock("@/utils/notebookRuntime/developmentSource.server", () => ({
  loadDevelopmentSnapshot: snapshot,
}));
import { executeCaseWork } from "@/axtn/workbenches/cases/work.server";

const caseId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const row = () => ({
  case_id: caseId,
  subject: "Native Verify",
  case_type: "DEVELOPMENT_VERIFY",
  priority: 3,
  status: "OPEN",
  processing_mode: "DETERMINISTIC",
  candidate_sha: "b".repeat(40),
  attempt_id: "native-attempt",
  work_identity: {
    sourceId: "task:verify",
    subject: "Native Verify",
    caseType: "DEVELOPMENT_VERIFY",
    workContractRef: {
      kind: "contract",
      repository: "aXtn/aXtn-agentswarms",
      id: "docs/DEVELOPER_WORKSPACE_RUNTIME.md",
    },
    scenarioClass: "regression",
    scenarioId: "native-test",
    processingMode: "DETERMINISTIC",
    executionChannel: "SWARM",
    actorRef: "verifier",
    taskId: "native-task",
    inputRevision: "a".repeat(40),
    testProfile: "documentation-v1",
  },
});
const request = { operation: "verify", caseId, transitionKey: "native-verify-effect" };
function setup(work = row()) {
  rpc
    .mockResolvedValueOnce({ data: { cases: [work], events: [] }, error: null })
    .mockResolvedValue({ data: work, error: null });
}
beforeEach(() => {
  vi.clearAllMocks();
  snapshot.mockResolvedValue([{ path: "README.md", content: "immutable native source" }]);
  verify.mockResolvedValue({ status: "COMPLETED", evidence: { sessionId, gateVerdict: "PASS" } });
});

describe("manual and Swarm native Verify share the same hard contract", () => {
  it("derives task, attempt and source from owned Case, reads Git and references the real receipt", async () => {
    setup();
    await executeCaseWork("owner", request, { kind: "user_session", id: "actual-human" });
    expect(snapshot.mock.calls).toEqual([
      ["owner", "a".repeat(40)],
      ["owner", "b".repeat(40)],
    ]);
    expect(verify).toHaveBeenCalledWith(
      "owner",
      expect.objectContaining({
        taskId: "native-task",
        attemptId: "native-attempt",
        caseId,
        baseSHA: "a".repeat(40),
        candidateSHA: "b".repeat(40),
        profile: "documentation-v1",
      }),
    );
    expect(rpc).toHaveBeenLastCalledWith(
      "axtn_case_work",
      expect.objectContaining({
        p_user_id: "owner",
        p_operation: "transition",
        p_payload: expect.objectContaining({
          eventType: "CHECKS_PASSED",
          runId: sessionId,
          actorRef: "actual-human",
        }),
      }),
    );
  });
  it("records Hard FAIL, never accepts an advisory success-shaped result", async () => {
    setup();
    verify.mockResolvedValue({ status: "COMPLETED", evidence: { sessionId, gateVerdict: "FAIL" } });
    await executeCaseWork("owner", request);
    expect(rpc).toHaveBeenLastCalledWith(
      "axtn_case_work",
      expect.objectContaining({
        p_payload: expect.objectContaining({ eventType: "CHECKS_FAILED" }),
      }),
    );
  });
  it("keeps PENDING explicit and creates no check-success event", async () => {
    setup();
    verify.mockResolvedValue({ status: "PENDING", sessionId });
    expect(await executeCaseWork("owner", request)).toEqual({ status: "PENDING", sessionId });
    expect(rpc).toHaveBeenCalledOnce();
  });
  it.each(["NEW", "CLOSED"])("denies %s before runtime effects", async (status) => {
    setup({ ...row(), status });
    await expect(executeCaseWork("owner", request)).rejects.toThrow("Started native Verify");
    expect(snapshot).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });
  it("does not let a machine continue Human-owned Work", async () => {
    setup({ ...row(), processing_mode: "HUMAN" });
    await expect(executeCaseWork("owner", request)).rejects.toThrow("authenticated release");
    expect(verify).not.toHaveBeenCalled();
  });
  it("rejects graph-supplied source, owner or fabricated verification result", async () => {
    await expect(
      executeCaseWork("owner", { ...request, baseline: [], userId: "foreign", pass: true }),
    ).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("propagates actual runtime and receipt-persistence failures", async () => {
    setup();
    verify.mockRejectedValue(new Error("Actual verifier failed"));
    await expect(executeCaseWork("owner", request)).rejects.toThrow("Actual verifier failed");
    expect(rpc).toHaveBeenCalledOnce();
  });
});
