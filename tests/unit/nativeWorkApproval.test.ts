import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalJson } from "@/utils/provenance/canonical";

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from } }));
import {
  assertNativeApprovalResume,
  createNativeWorkApproval,
} from "@/utils/swarmWorkApproval.server";

const caseId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const approvalId = "33333333-3333-4333-8333-333333333333";
const runId = "44444444-4444-4444-8444-444444444444";
const reviewerId = "55555555-5555-4555-8555-555555555555";
const verifyCaseId = "66666666-6666-4666-8666-666666666666";
const candidateSHA = "a".repeat(40);
const image = `sha256:${"b".repeat(64)}`;
const harness = "c".repeat(64);
const hash = (v: unknown) => createHash("sha256").update(canonicalJson(v)).digest("hex");
const snapshot = {
  nodes: [
    {
      id: "approval",
      data: {
        kind: "approval",
        label: "Independent native Approval",
        approverUserIds: [reviewerId],
        approverGroupIds: [],
        approvalWork: {
          caseId: "{{task.caseId}}",
          runtimeSessionId: "{{verify.sessionId}}",
          operationId: "approve-v1",
        },
      },
    },
  ],
  edges: [],
};
const args = {
  userId: "owner",
  runId,
  nodeId: "approval",
  context: { task: JSON.stringify({ caseId }), verify: JSON.stringify({ sessionId }) },
  content: "Bound findings and deterministic PASS evidence",
};
function fixture() {
  const inputs = { caseId: verifyCaseId, candidateSHA, attemptId: "attempt-v1" };
  const session = {
    image,
    inputs,
    status: "succeeded",
    result: {
      schema: "axtn.development.verify/v1",
      effectKey: "verify",
      taskId: "task",
      attemptId: "attempt-v1",
      candidateSHA,
      baseSHA: "d".repeat(40),
      inputHash: hash(inputs),
      harnessHash: harness,
      sessionId,
      image,
      baseline: { pass: false, compileExitCode: 0, testsRun: 1 },
      candidate: { pass: true, compileExitCode: 0, testsRun: 1 },
      gateVerdict: "PASS",
    },
  };
  const cases = [
    {
      row: {
        case_id: caseId,
        status: "OPEN",
        source_kind: "development_work",
        candidate_sha: candidateSHA,
        attempt_id: "attempt-v1",
      },
    },
    { row: { case_id: verifyCaseId, parent_case_id: caseId, status: "OPEN" } },
  ];
  const rows: Record<string, unknown> = {
    swarm_runs: { swarm_snapshot: structuredClone(snapshot), status: "running" },
    user_data_tables: { id: "dataset" },
    user_data_rows: cases,
    notebook_runtime_sessions: session,
  };
  const inserted = vi.fn();
  let prior: unknown;
  let collision = false;
  from.mockImplementation((table: string) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      filter: vi.fn().mockReturnThis(),
      insert: inserted.mockReturnThis(),
      single: vi.fn(async () => ({
        data: collision ? (prior ?? null) : { id: approvalId },
        error: collision && !prior ? { code: "23505" } : null,
      })),
      maybeSingle: vi.fn(async () => ({ data: rows[table] ?? null, error: null })),
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: rows[table], error: null }).then(resolve),
    };
    // Inserts on collision fail; readback returns the retained immutable row.
    query.insert = vi.fn((value) => {
      inserted(value);
      return {
        select: () => ({
          single: async () =>
            collision
              ? { data: null, error: { code: "23505" } }
              : { data: { id: approvalId }, error: null },
        }),
      };
    });
    return query;
  });
  return {
    rows,
    session,
    cases,
    inserted,
    replay(value: unknown) {
      collision = true;
      prior = value;
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AXTN_DEVELOPMENT_RUNTIME_IMAGE", image);
  vi.stubEnv("AXTN_DEVELOPMENT_HARNESS_SHA256", harness);
});

describe("existing native Approval uses protected server authority", () => {
  it("derives reviewers from persisted snapshot and Candidate/Attempt/Evidence from protected storage", async () => {
    const f = fixture();
    expect(await createNativeWorkApproval(args)).toEqual({ id: approvalId });
    const row = f.inserted.mock.calls[0][0];
    expect(row.approver_user_ids).toEqual([reviewerId]);
    expect(row.payload.axtnDevelopment).toMatchObject({
      caseId,
      candidateSHA,
      runtimeSessionId: sessionId,
      attemptId: "attempt-v1",
      operationId: "approve-v1",
      nodeId: "approval",
      graphHash: hash(snapshot),
      evidenceHash: hash(f.session.result),
    });
    expect(row.user_id).toBe("owner");
  });

  it.each([
    "owner",
    "node",
    "reviewer",
    "case",
    "receipt",
    "candidate",
    "attempt",
    "lineage",
    "image",
    "harness",
    "input",
    "tests",
    "compile",
    "fail",
  ])("denies %s mismatch before creating an Approval", async (variant) => {
    const f = fixture();
    const run = f.rows.swarm_runs as { swarm_snapshot: typeof snapshot };
    if (variant === "owner") f.rows.swarm_runs = null;
    if (variant === "node") run.swarm_snapshot.nodes[0].data.kind = "agent";
    if (variant === "reviewer") run.swarm_snapshot.nodes[0].data.approverUserIds = [];
    if (variant === "case") f.cases[0].row.status = "CLOSED";
    if (variant === "receipt") f.session.status = "running";
    if (variant === "candidate") f.session.result.candidateSHA = "e".repeat(40);
    if (variant === "attempt") f.session.result.attemptId = "different";
    if (variant === "lineage") f.cases[1].row.parent_case_id = runId;
    if (variant === "image") f.session.result.image = `sha256:${"e".repeat(64)}`;
    if (variant === "harness") f.session.result.harnessHash = "e".repeat(64);
    if (variant === "input") f.session.result.inputHash = "e".repeat(64);
    if (variant === "tests") f.session.result.candidate.testsRun = 0;
    if (variant === "compile") f.session.result.candidate.compileExitCode = 1;
    if (variant === "fail") f.session.result.gateVerdict = "FAIL";
    await expect(createNativeWorkApproval(args)).rejects.toThrow();
    expect(f.inserted).not.toHaveBeenCalled();
  });

  it("recovers the same persisted operation but refuses changed evidence or routing", async () => {
    const f = fixture();
    await createNativeWorkApproval(args);
    const row = f.inserted.mock.calls[0][0];
    f.replay({
      id: approvalId,
      payload: row.payload,
      approver_user_ids: row.approver_user_ids,
      approver_group_ids: row.approver_group_ids,
    });
    expect(await createNativeWorkApproval(args)).toEqual({ id: approvalId });
    await expect(createNativeWorkApproval({ ...args, content: "changed" })).rejects.toThrow(
      "OPERATION_CONFLICT",
    );
  });

  it("resumes only the exact protected node/snapshot and a persisted authenticated decision", async () => {
    const f = fixture();
    await createNativeWorkApproval(args);
    const payload = f.inserted.mock.calls[0][0].payload;
    const resume = { snapshot, nodeId: "approval", payload, decidedBy: reviewerId };
    expect(() => assertNativeApprovalResume(resume)).not.toThrow();
    expect(() => assertNativeApprovalResume({ ...resume, decidedBy: null })).toThrow();
    expect(() =>
      assertNativeApprovalResume({ ...resume, payload: { last_output: "client YES" } }),
    ).toThrow();
    expect(() =>
      assertNativeApprovalResume({
        ...resume,
        snapshot: { ...snapshot, edges: [{ id: "edited" }] },
      }),
    ).toThrow("BINDING_MISMATCH");
  });
});
