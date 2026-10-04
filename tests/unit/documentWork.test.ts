import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeCaseWork } from "@/axtn/workbenches/cases/work.server";
import { documentInputHash } from "@/axtn/workbenches/documents/documentWork.server";
import {
  CaseRequest,
  DocumentWorkRequest,
} from "@/axtn/workbenches/documents/documentWorkContract";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
const owner = "11111111-1111-4111-8111-111111111111";
const document = "22222222-2222-4222-8222-222222222222";
const manifest = {
  documentId: document,
  sourceKind: "fixture",
  sourceRef: "fixture:opaque-01",
  sourceRevision: '"provider-etag:0001"',
  contentHash: "a".repeat(64),
  privacyStatus: "NO_AI",
};
const request = {
  operation: "document_ensure",
  work: {
    businessRequestId: "request-0001",
    caseType: "DOCUMENT_PROCESSING",
    workContractRef: {
      kind: "contract",
      repository: "aXtn/aXtn-agentswarms",
      id: "handoffs/requests/AXTN-DMS-RECOVERY-AND-LEARNING-0001.md",
      revision: "b".repeat(40),
    },
    scenarioClass: "regression",
    scenarioId: "fixture-0001",
    processingMode: "DETERMINISTIC",
    executionChannel: "SWARM",
    actorRef: "untrusted-label",
    inputManifest: manifest,
    deliveryId: "delivery-0001",
  },
};
const transition = {
  operation: "document_transition",
  transition: {
    caseId: document,
    attemptId: owner,
    inputHash: documentInputHash(manifest),
    transitionKey: "transition-01",
    eventType: "TAKEOVER",
    reasonCode: "MANUAL_CONTINUATION",
  },
};

describe("registered document profile in the existing native Case service", () => {
  beforeEach(() => rpc.mockReset().mockResolvedValue({ data: { case_id: document }, error: null }));

  it("routes through the same owner-bound service, not the Development validator/RPC", async () => {
    expect(CaseRequest.safeParse(request).success).toBe(true);
    await executeCaseWork(owner, request, { kind: "swarm", id: owner });
    expect(rpc).toHaveBeenCalledWith(
      "axtn_case_document",
      expect.objectContaining({
        p_user_id: owner,
        p_operation: "document_ensure",
        p_payload: expect.objectContaining({
          actorRef: owner,
          _principal: { kind: "swarm", id: owner },
          inputHash: documentInputHash(manifest),
        }),
      }),
    );
  });
  it("keeps provider ETag, input hash and implementation SHA distinct", async () => {
    await executeCaseWork(owner, request);
    const payload = rpc.mock.calls[0][1].p_payload;
    expect(payload.inputManifest.sourceRevision).toBe('"provider-etag:0001"');
    expect(payload.inputHash).toHaveLength(64);
    expect(payload.inputHash).not.toBe(payload.workContractRef.revision);
  });
  it("hashes immutable JSON independently of key insertion order", () => {
    expect(documentInputHash(manifest)).toBe(
      documentInputHash({
        privacyStatus: "NO_AI",
        contentHash: "a".repeat(64),
        sourceRevision: '"provider-etag:0001"',
        sourceRef: "fixture:opaque-01",
        sourceKind: "fixture",
        documentId: document,
      }),
    );
    expect(documentInputHash(manifest)).not.toBe(
      documentInputHash({
        ...manifest,
        sourceRevision: '"provider-etag:0002"',
      }),
    );
  });
  it.each(["userId", "owner", "sourceId", "approved", "candidateSHA", "inputHash"])(
    "rejects caller-provided authority field %s",
    (field) => {
      expect(
        DocumentWorkRequest.safeParse({
          ...request,
          work: { ...request.work, [field]: "invented" },
        }).success,
      ).toBe(false);
    },
  );
  it.each(["TODO", "DEVELOPMENT_CHANGE", "DOCUMENT_NEW_SCOPE"])(
    "rejects unregistered domain %s",
    (caseType) => {
      expect(
        CaseRequest.safeParse({
          ...request,
          work: { ...request.work, caseType },
        }).success,
      ).toBe(false);
    },
  );
  it.each(["NO_AI", "UNRESOLVED", "ELIGIBLE"])(
    "does not let intake assert semantic authority from claimed %s",
    (privacyStatus) => {
      expect(
        CaseRequest.safeParse({
          ...request,
          work: {
            ...request.work,
            processingMode: "SEMANTIC",
            inputManifest: { ...manifest, privacyStatus, privacyRevision: "c".repeat(64) },
          },
        }).success,
      ).toBe(false);
    },
  );
  it("requires a real authenticated Human for takeover or release", async () => {
    await expect(executeCaseWork(owner, transition)).rejects.toThrow("authenticated user session");
    expect(rpc).not.toHaveBeenCalled();
    await executeCaseWork(owner, transition, { kind: "user_session", id: owner });
    expect(rpc).toHaveBeenCalledWith(
      "axtn_case_document",
      expect.objectContaining({
        p_payload: expect.objectContaining({ actorRef: owner }),
      }),
    );
  });
  it("does not borrow another user's principal", async () => {
    await expect(
      executeCaseWork(owner, request, {
        kind: "user_session",
        id: document,
      }),
    ).rejects.toThrow("principal owner mismatch");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("records only strict domain proposals with a server-derived revision, never client authority", async () => {
    const proposal = {
      schemaVersion: "document-decision-v1",
      decisionId: document,
      caseId: document,
      attemptId: owner,
      inputHash: documentInputHash(manifest),
      documentId: manifest.documentId,
      sourceRef: manifest.sourceRef,
      sourceRevision: manifest.sourceRevision,
      graphRevision: null,
      ruleRevision: null,
      featureSchemaRevision: "document-features-v1",
      family: "fixture-family",
      operation: "CLASSIFY",
      target: null,
      automationMode: "ASSISTED",
      evidence: [
        {
          kind: "evidence",
          repository: "aXtn/aXtn-agentswarms",
          id: "tests/integration/documentWork.sql",
        },
      ],
    };
    const input = { operation: "document_propose", proposal };
    await executeCaseWork(owner, input, { kind: "user_session", id: owner });
    expect(rpc).toHaveBeenCalledWith(
      "axtn_case_document",
      expect.objectContaining({
        p_operation: "document_propose",
        p_payload: expect.objectContaining({
          decisionRevision: documentInputHash(proposal),
          actorRef: owner,
        }),
      }),
    );
    for (const field of [
      "approved",
      "status",
      "decisionRevision",
      "providerReceipt",
      "document_text",
    ]) {
      expect(
        CaseRequest.safeParse({
          ...input,
          proposal: { ...proposal, [field]: "forged" },
        }).success,
      ).toBe(false);
    }
    expect(
      CaseRequest.safeParse({ ...input, proposal: { ...proposal, automationMode: "SCOPED_AUTO" } })
        .success,
    ).toBe(false);
    expect(
      CaseRequest.safeParse({ ...input, proposal: { ...proposal, operation: "FILE" } }).success,
    ).toBe(false);
    expect(
      CaseRequest.safeParse({ ...input, proposal: { ...proposal, evidence: [] } }).success,
    ).toBe(false);
  });
  it("uses the same server-bound Human authority for document assignment", async () => {
    const assignment = {
      operation: "document_assign",
      assignment: { caseId: document, documentId: "opaque-document-id" },
    };
    await expect(executeCaseWork(owner, assignment)).rejects.toThrow("authenticated user session");
    expect(rpc).not.toHaveBeenCalled();
    await executeCaseWork(owner, assignment, { kind: "user_session", id: owner });
    expect(rpc).toHaveBeenCalledWith(
      "axtn_case_document",
      expect.objectContaining({
        p_operation: "document_assign",
        p_payload: expect.objectContaining({
          caseId: document,
          documentId: "opaque-document-id",
          _principal: { kind: "user_session", id: owner },
        }),
      }),
    );
  });
  it.each(["ACCEPTED", "COMPLETED", "PROMOTED", "CHECKS_PASSED"])(
    "cannot declare %s through a document transition",
    (eventType) => {
      expect(
        CaseRequest.safeParse({
          ...transition,
          transition: { ...transition.transition, eventType },
        }).success,
      ).toBe(false);
    },
  );
  it("allows a new accountable Candidate without starting or promoting it", () => {
    expect(
      CaseRequest.safeParse({
        ...request,
        work: {
          ...request.work,
          caseType: "DOCUMENT_IMPROVEMENT_CANDIDATE",
          parentCaseId: owner,
          packageKey: "candidate-01",
        },
      }).success,
    ).toBe(true);
    expect(
      CaseRequest.safeParse({
        ...request,
        work: { ...request.work, caseType: "DOCUMENT_REVIEW" },
      }).success,
    ).toBe(false);
  });
  it.each(["external_ref_id", "external_parent_ref_id"])(
    "does not implement or infer the pending External References Core field %s",
    (field) => {
      expect(
        CaseRequest.safeParse({
          ...request,
          work: { ...request.work, [field]: "unconfirmed" },
        }).success,
      ).toBe(false);
    },
  );
  it("preserves untrusted external references without inferring local identity or Parent", async () => {
    const externalReferenceContext = {
      external_ref_id: "opaque:001",
      external_parent_ref_id: "opaque:parent",
    };
    await executeCaseWork(owner, {
      ...request,
      work: { ...request.work, externalReferenceContext },
    });
    const payload = rpc.mock.calls[0][1].p_payload;
    expect(payload.externalReferenceContext).toEqual(externalReferenceContext);
    expect(payload.parentCaseId).toBeUndefined();
    expect(payload.businessRequestId).toBe(request.work.businessRequestId);
    expect(payload.inputHash).toBe(documentInputHash(manifest));
    expect(
      CaseRequest.safeParse({
        ...request,
        work: { ...request.work, externalReferenceContext: {} },
      }).success,
    ).toBe(false);
    expect(
      CaseRequest.safeParse({
        ...request,
        work: {
          ...request.work,
          externalReferenceContext: { ...externalReferenceContext, confirmed: true },
        },
      }).success,
    ).toBe(false);
  });
  it("surfaces native fencing/transaction failures", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "DOCUMENT_STALE_ATTEMPT_OR_INPUT" } });
    await expect(executeCaseWork(owner, request)).rejects.toThrow(
      "DOCUMENT_STALE_ATTEMPT_OR_INPUT",
    );
  });
  it("keeps the profile readable through the common lifecycle and KPI schema", async () => {
    rpc.mockResolvedValue({
      error: null,
      data: {
        cases: [
          {
            case_id: document,
            subject: "Document processing",
            case_type: "DOCUMENT_PROCESSING",
            source_kind: "document_work",
            status: "NEW",
            priority: 3,
            document_work_identity: { businessRequestId: "request-0001" },
            processing_mode: "DETERMINISTIC",
            execution_channel: "SWARM",
            scenario_class: "regression",
          },
        ],
        events: [],
      },
    });
    const result = await executeCaseWork(owner, { operation: "list" });
    expect(result).toMatchObject({ metrics: { totalCases: 1 } });
  });
});
