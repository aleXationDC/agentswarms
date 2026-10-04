import { beforeEach, describe, expect, it, vi } from "vitest";
import { documentInputHash } from "@/axtn/workbenches/documents/documentWork.server";
import {
  assertNativeApprovalResume,
  createNativeWorkApproval,
} from "@/utils/swarmWorkApproval.server";

const { from, rpc } = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from, rpc } }));
const owner = "11111111-1111-4111-8111-111111111111";
const caseId = "22222222-2222-4222-8222-222222222222";
const decisionId = "33333333-3333-4333-8333-333333333333";
const runId = "44444444-4444-4444-8444-444444444444";
const reviewerId = "55555555-5555-4555-8555-555555555555";
const attemptId = "66666666-6666-4666-8666-666666666666";
const approvalId = "77777777-7777-4777-8777-777777777777";
const args = {
  userId: owner,
  runId,
  nodeId: "document-review",
  context: { decision: JSON.stringify({ caseId, decisionId }) },
  content: "LEAKAGE_MARKER_ORIGINAL_TEXT_MUST_NOT_ENTER_APPROVAL",
};

function fixture() {
  const proposal = {
    schemaVersion: "document-decision-v1",
    decisionId,
    caseId,
    attemptId,
    inputHash: "a".repeat(64),
    documentId: "opaque-document",
    sourceRef: "fixture:opaque",
    sourceRevision: '"etag:0001"',
    graphRevision: null as string | null,
    ruleRevision: null as string | null,
    featureSchemaRevision: "document-features-v1",
    family: "fixture-family",
    operation: "CLASSIFY",
    target: null,
    automationMode: "ASSISTED",
    evidence: [
      {
        kind: "evidence",
        repository: "aXtn/aXtn-agentswarms",
        id: "tests/integration/documentApproval.sql",
      },
    ],
  };
  const work = {
    case_id: caseId,
    source_kind: "document_work",
    status: "OPEN",
    attempt_id: attemptId,
    input_hash: proposal.inputHash,
    document_id: proposal.documentId,
    actor_principal: { kind: "swarm", id: owner },
    processing_mode: "DETERMINISTIC",
    privacy_evidence_revision: "e".repeat(64) as string | undefined,
    verified_privacy_status: "ELIGIBLE",
    document_input: {
      sourceKind: "fixture",
      sourceRef: proposal.sourceRef,
      sourceRevision: proposal.sourceRevision,
      contentHash: "b".repeat(64),
      privacyStatus: "UNRESOLVED",
    },
  };
  const decision = {
    decision_id: decisionId,
    case_id: caseId,
    status: "PROPOSED",
    revision: documentInputHash(proposal),
    principal: { kind: "swarm", id: owner },
    document_decision: proposal,
  };
  const snapshot = {
    nodes: [
      {
        id: args.nodeId,
        data: {
          kind: "approval",
          approverUserIds: [reviewerId],
          approverGroupIds: [] as string[],
          approvalDocument: {
            caseId: "{{decision.caseId}}",
            decisionId: "{{decision.decisionId}}",
            operationId: "document-review-v1",
            operation: "CLASSIFY",
          },
        },
      },
    ],
    edges: [],
  };
  const inserted: Array<Record<string, unknown>> = [];
  let prior: Record<string, unknown> | null = null;
  from.mockImplementation((table: string) => {
    const filters: Record<string, unknown> = {};
    let input: Record<string, unknown> | null = null;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => {
        filters[key] = value;
        return query;
      },
      filter: () => query,
      insert: (value: Record<string, unknown>) => {
        input = value;
        return query;
      },
      maybeSingle: async () => {
        let data: unknown = null;
        if (table === "swarm_runs" && filters.user_id === owner && filters.id === runId)
          data = { swarm_snapshot: snapshot, status: "suspended" };
        if (table === "user_data_tables" && filters.user_id === owner) data = { id: filters.name };
        if (table === "user_data_rows")
          data = { row: filters.table_id === "axtn_cases" ? work : decision };
        return { data, error: null };
      },
      single: async () => {
        if (input && !prior) {
          inserted.push(input);
          return { data: { id: approvalId }, error: null };
        }
        if (input) return { data: null, error: { code: "23505" } };
        return { data: prior, error: null };
      },
    };
    return query;
  });
  return {
    proposal,
    work,
    decision,
    snapshot,
    inserted,
    replay(status = "pending") {
      const row = inserted[0];
      prior = {
        id: approvalId,
        payload: row.payload,
        status,
        approver_user_ids: row.approver_user_ids,
        approver_group_ids: row.approver_group_ids,
      };
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ data: null, error: null });
});

describe("DMS registered binding on the existing native Approval", () => {
  it("binds persisted Case/Attempt/Input/Source/Decision and actual snapshot reviewers without copying content", async () => {
    const f = fixture();
    expect(await createNativeWorkApproval(args)).toEqual({ id: approvalId });
    const row = f.inserted[0];
    expect(row.approver_user_ids).toEqual([reviewerId]);
    expect(row.payload).toMatchObject({
      axtnDocument: {
        caseId,
        attemptId,
        inputHash: f.work.input_hash,
        documentId: f.work.document_id,
        sourceRef: f.proposal.sourceRef,
        sourceRevision: f.proposal.sourceRevision,
        decisionId,
        decisionRevision: f.decision.revision,
        policyRevision: null,
        graphHash: documentInputHash(f.snapshot),
        evidenceHash: documentInputHash(f.proposal.evidence),
        nodeId: args.nodeId,
        operationId: "document-review-v1",
        proposalOperation: "CLASSIFY",
      },
    });
    expect(JSON.stringify(row)).not.toContain("LEAKAGE_MARKER");
    expect(row.payload).not.toHaveProperty("axtnDevelopment");
  });
  it.each([
    "owner",
    "case",
    "attempt",
    "input",
    "source",
    "revision",
    "worker",
    "graph",
    "rule",
    "privacy",
    "NO_AI",
    "reviewer",
    "development",
    "operation",
  ])("refuses %s mismatch before native insertion", async (variant) => {
    const f = fixture();
    if (variant === "case") f.work.status = "CLOSED";
    if (variant === "attempt") f.work.attempt_id = runId;
    if (variant === "input") f.work.input_hash = "f".repeat(64);
    if (variant === "source") f.work.document_input.sourceRevision = '"etag:0002"';
    if (variant === "revision") f.decision.revision = "f".repeat(64);
    if (variant === "worker") f.work.actor_principal.id = reviewerId;
    if (variant === "graph") {
      f.proposal.graphRevision = "f".repeat(64);
      f.decision.revision = documentInputHash(f.proposal);
    }
    if (variant === "rule") {
      f.proposal.ruleRevision = "f".repeat(64);
      f.decision.revision = documentInputHash(f.proposal);
    }
    if (variant === "privacy") f.work.privacy_evidence_revision = undefined;
    if (variant === "NO_AI") f.work.document_input.privacyStatus = "NO_AI";
    if (variant === "reviewer") f.snapshot.nodes[0].data.approverUserIds = [];
    if (variant === "development") f.work.source_kind = "development_work";
    if (variant === "operation") f.snapshot.nodes[0].data.approvalDocument.operation = "DELETE";
    await expect(
      createNativeWorkApproval({ ...args, userId: variant === "owner" ? reviewerId : owner }),
    ).rejects.toThrow();
    expect(f.inserted).toHaveLength(0);
  });
  it("fences machine Approval creation during Human takeover without preventing authenticated manual review requests", async () => {
    const f = fixture();
    f.work.processing_mode = "HUMAN";
    f.work.actor_principal.kind = "user_session";
    f.decision.principal.kind = "user_session";
    await expect(createNativeWorkApproval(args)).rejects.toThrow("HUMAN_TAKEOVER_FENCED");
    expect(f.inserted).toHaveLength(0);
    await createNativeWorkApproval({ ...args, principal: { kind: "user_session", id: owner } });
    expect(f.inserted).toHaveLength(1);
  });
  it("recovers pending callbacks without duplicating and revalidates current reviewer authority before decided resume", async () => {
    const f = fixture();
    await createNativeWorkApproval(args);
    f.replay();
    expect(
      await createNativeWorkApproval({ ...args, content: "different untrusted content" }),
    ).toEqual({ id: approvalId });
    expect(f.inserted).toHaveLength(1);
    expect(rpc).not.toHaveBeenCalled();
    f.replay("approved");
    await createNativeWorkApproval(args);
    expect(rpc).toHaveBeenCalledWith("assert_axtn_document_approval_resume", {
      p_approval_id: approvalId,
      p_user_id: owner,
    });
    rpc.mockResolvedValue({ error: { message: "DMS_NATIVE_APPROVAL_CURRENT_REVIEWER_REQUIRED" } });
    await expect(createNativeWorkApproval(args)).rejects.toThrow("CURRENT_REVIEWER_REQUIRED");
  });
  it("resumes only the exact protected snapshot/node and never treats a Development binding as a Document binding", async () => {
    const f = fixture();
    await createNativeWorkApproval(args);
    const resume = {
      snapshot: f.snapshot,
      nodeId: args.nodeId,
      payload: f.inserted[0].payload,
      decidedBy: reviewerId,
    };
    if (!resume.payload || typeof resume.payload !== "object")
      throw new Error("Missing fixture payload");
    expect(() => assertNativeApprovalResume(resume)).not.toThrow();
    expect(() => assertNativeApprovalResume({ ...resume, decidedBy: null })).toThrow();
    expect(() =>
      assertNativeApprovalResume({ ...resume, payload: { axtnDevelopment: {} } }),
    ).toThrow();
    expect(() =>
      assertNativeApprovalResume({
        ...resume,
        payload: { ...resume.payload, axtnDevelopment: {} },
      }),
    ).toThrow("DOMAIN_BINDING_CONFLICT");
    f.snapshot.nodes[0].data.approverUserIds = [owner];
    expect(() => assertNativeApprovalResume(resume)).toThrow("RESUME_BINDING_MISMATCH");
  });
  it("never revives a cancelled operation on lost-response replay", async () => {
    const f = fixture();
    await createNativeWorkApproval(args);
    f.replay("cancelled");
    await expect(createNativeWorkApproval(args)).rejects.toThrow("OPERATION_CANCELLED");
    expect(f.inserted).toHaveLength(1);
    expect(rpc).not.toHaveBeenCalled();
  });
});
