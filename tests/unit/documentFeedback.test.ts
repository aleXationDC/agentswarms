import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeCaseWork } from "@/axtn/workbenches/cases/work.server";
import { documentInputHash } from "@/axtn/workbenches/documents/documentWork.server";
import {
  DocumentFeedbackEvent,
  DocumentFeedbackRecord,
} from "@/axtn/workbenches/documents/documentFeedbackContract";
import { CaseRequest } from "@/axtn/workbenches/documents/documentWorkContract";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
const owner = "11111111-1111-4111-8111-111111111111";
const event = {
  schemaVersion: "document-feedback-v1",
  eventId: "22222222-2222-4222-8222-222222222222",
  caseId: "33333333-3333-4333-8333-333333333333",
  decisionId: "44444444-4444-4444-8444-444444444444",
  decisionRevision: "a".repeat(64),
  attemptId: "55555555-5555-4555-8555-555555555555",
  inputHash: "b".repeat(64),
  sourceRevision: '"provider-etag:0001"',
  eventType: "VERIFIED_CORRECT",
  before: { family: "fixture-family", targetId: "fixture-target" },
  after: { family: "fixture-family", targetId: "fixture-target" },
  reasonCode: "HUMAN_CONFIRMED",
  supersedesEventId: null,
  evidence: [
    {
      kind: "evidence",
      repository: "aXtn/aXtn-agentswarms",
      id: "tests/unit/documentFeedback.test.ts",
      revision: "c".repeat(40),
    },
  ],
};
const request = { operation: "document_feedback", feedback: event };

describe("minimized feedback through the same protected native Case service", () => {
  beforeEach(() =>
    rpc.mockReset().mockResolvedValue({ data: { feedback_id: event.eventId }, error: null }),
  );

  it("derives authority and immutable revision server-side without changing Case or invoking AI", async () => {
    await executeCaseWork(owner, request, { kind: "user_session", id: owner });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("axtn_case_document", {
      p_user_id: owner,
      p_operation: "document_feedback",
      p_payload: {
        ...event,
        actorRef: owner,
        _principal: { kind: "user_session", id: owner },
        feedbackRevision: documentInputHash(DocumentFeedbackEvent.parse(event)),
      },
    });
  });

  it.each([
    "userId",
    "owner",
    "actorRef",
    "_principal",
    "verified",
    "approved",
    "createdAt",
    "feedbackRevision",
    "text",
    "prompt",
    "rawDocument",
  ])(
    "rejects caller-injected authority or original-content field %s before any RPC",
    async (field) => {
      await expect(
        executeCaseWork(
          owner,
          {
            ...request,
            feedback: { ...event, [field]: "caller-controlled" },
          },
          { kind: "user_session", id: owner },
        ),
      ).rejects.toThrow();
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it.each(["VERIFIED_CORRECT", "CORRECTION", "EXCEPTION", "TAXONOMY_CHANGE"])(
    "does not allow a machine to forge confirmed %s",
    async (eventType) => {
      const corrected = ["CORRECTION", "TAXONOMY_CHANGE"].includes(eventType);
      await expect(
        executeCaseWork(
          owner,
          {
            ...request,
            feedback: {
              ...event,
              eventType,
              ...(corrected
                ? {
                    supersedesEventId: owner,
                    after: { ...event.after, family: "corrected-fixture" },
                  }
                : {}),
            },
          },
          { kind: "swarm", id: owner },
        ),
      ).rejects.toThrow("authenticated user session");
      expect(rpc).not.toHaveBeenCalled();
    },
  );

  it("allows only explicitly unverified machine observations, never a silent filing confirmation", async () => {
    await executeCaseWork(
      owner,
      {
        ...request,
        feedback: { ...event, eventType: "UNVERIFIED", reasonCode: "UNVERIFIED_OBSERVATION" },
      },
      { kind: "swarm", id: owner },
    );
    expect(rpc.mock.calls[0][1].p_payload).not.toHaveProperty("verified");
    expect(rpc.mock.calls[0][1].p_payload.eventType).toBe("UNVERIFIED");
  });

  it("does not borrow another user's Human session", async () => {
    await expect(
      executeCaseWork(owner, request, {
        kind: "user_session",
        id: event.eventId,
      }),
    ).rejects.toThrow("owner mismatch");
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    { after: { ...event.after, family: "changed" } },
    { supersedesEventId: event.eventId },
    { eventType: "CORRECTION" },
    { eventType: "CORRECTION", supersedesEventId: owner },
    { eventType: "UNVERIFIED" },
    { eventType: "UNVERIFIED", reasonCode: "UNVERIFIED_OBSERVATION", supersedesEventId: owner },
    { before: { family: "Original body text", targetId: null } },
    { before: { family: "fixture-family\n", targetId: null } },
    { before: { family: "a".repeat(201), targetId: null } },
    { before: { family: null, targetId: "https://outside.invalid" } },
    { before: { ...event.before, name: "original filename" } },
    { sourceRevision: "\n" },
    { sourceRevision: "a".repeat(501) },
    { decisionRevision: "a".repeat(64) + "\n" },
    { evidence: [] },
    { evidence: [{ kind: "issue", repository: "aXtn/aXtn-agentswarms", id: "6" }] },
  ])(
    "rejects invalid/corrected/unminimized feedback without a confirmed predecessor %j",
    (change) => {
      expect(
        CaseRequest.safeParse({
          ...request,
          feedback: { ...event, ...change },
        }).success,
      ).toBe(false);
    },
  );

  it("accepts an explicit revision-bound correction with minimized confirmed before/after", () => {
    expect(
      DocumentFeedbackEvent.safeParse({
        ...event,
        eventType: "CORRECTION",
        reasonCode: "WRONG_FAMILY",
        supersedesEventId: owner,
        after: { ...event.after, family: "corrected-fixture" },
      }).success,
    ).toBe(true);
  });

  it("lists owner-scoped feedback through the existing RPC with a server-derived principal", async () => {
    await executeCaseWork(owner, { operation: "document_feedback_events", caseId: event.caseId });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("axtn_case_document", {
      p_user_id: owner,
      p_operation: "document_feedback_events",
      p_payload: {
        caseId: event.caseId,
        actorRef: owner,
        _principal: { kind: "swarm", id: owner },
      },
    });
  });

  it("surfaces persistence failure rather than fabricating verified feedback", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "DOCUMENT_FEEDBACK_WRITE_FAILED" } });
    await expect(
      executeCaseWork(owner, request, {
        kind: "user_session",
        id: owner,
      }),
    ).rejects.toThrow("DOCUMENT_FEEDBACK_WRITE_FAILED");
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("validates persisted authority/findability without treating a client flag as confirmation", () => {
    const record = {
      feedback_id: event.eventId,
      feedback_key: "d".repeat(64),
      case_id: event.caseId,
      revision: "e".repeat(64),
      document_feedback: event,
      principal: { kind: "user_session", id: owner },
      created_at: "2026-10-05T01:38:00+00:00",
      verified: true,
    };
    expect(DocumentFeedbackRecord.safeParse(record).success).toBe(true);
    for (const change of [
      { feedback_id: owner },
      { case_id: owner },
      { verified: false },
      { principal: { kind: "swarm", id: owner } },
      { created_at: "client timestamp" },
      { text: "original marker" },
    ])
      expect(DocumentFeedbackRecord.safeParse({ ...record, ...change }).success).toBe(false);
  });
});
