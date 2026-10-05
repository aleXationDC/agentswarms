import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (context: { request: Request }) => Promise<Response>;
const owner = "11111111-1111-4111-8111-111111111111";
const keyId = "66666666-6666-4666-8666-666666666666";
const state = vi.hoisted(() => ({
  handler: null as Handler | null,
  rpc: vi.fn(),
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  limited: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { server: { handlers: { POST: Handler } } }) => {
    state.handler = config.server.handlers.POST;
    return config;
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: state.rpc,
    auth: { getUser: state.getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: state.maybeSingle }) }),
    }),
  },
}));
vi.mock("@/utils/rateLimit.server", () => ({ rateLimitedGlobal: state.limited }));
import "@/routes/api/cases.work";

const event = {
  schemaVersion: "document-feedback-v1",
  eventId: "22222222-2222-4222-8222-222222222222",
  caseId: "33333333-3333-4333-8333-333333333333",
  decisionId: "44444444-4444-4444-8444-444444444444",
  decisionRevision: "a".repeat(64),
  attemptId: "55555555-5555-4555-8555-555555555555",
  inputHash: "b".repeat(64),
  sourceRevision: '"etag:0001"',
  eventType: "VERIFIED_CORRECT",
  before: { family: "fixture", targetId: null },
  after: { family: "fixture", targetId: null },
  reasonCode: "HUMAN_CONFIRMED",
  supersedesEventId: null,
  evidence: [
    {
      kind: "evidence",
      repository: "aXtn/aXtn-agentswarms",
      id: "tests/unit/documentFeedbackApi.test.ts",
    },
  ],
};
const request = (feedback: unknown = event, credential: string | null = "fixture-user-session") => {
  if (!state.handler) throw new Error("Actual Case API handler required");
  return state.handler({
    request: new Request("http://localhost/api/cases/work", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(credential ? { authorization: `Bearer ${credential}` } : {}),
      },
      body: JSON.stringify({ operation: "document_feedback", feedback }),
    }),
  });
};
beforeEach(() => {
  state.rpc.mockReset().mockResolvedValue({ data: { feedback_id: event.eventId }, error: null });
  state.getUser.mockReset().mockResolvedValue({ data: { user: { id: owner } }, error: null });
  state.maybeSingle.mockReset().mockResolvedValue({
    data: {
      id: keyId,
      user_id: owner,
      scopes: ["cases"],
      is_active: true,
      revoked_at: null,
      expires_at: null,
    },
    error: null,
  });
  afterEach(() => vi.restoreAllMocks());
  state.limited.mockReset().mockResolvedValue(false);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("actual shared Case API feedback boundary without LLM/orchestrator", () => {
  it("binds the authenticated user, not request owner/actor/prompt labels", async () => {
    expect((await request()).status).toBe(200);
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
      "axtn_case_document",
      expect.objectContaining({
        p_user_id: owner,
        p_operation: "document_feedback",
        p_payload: expect.objectContaining({
          _principal: { kind: "user_session", id: owner },
          actorRef: owner,
        }),
      }),
    );
  });
  it.each(["verified", "owner", "_principal", "text"])(
    "rejects injected %s before persistence",
    async (field) => {
      expect((await request({ ...event, [field]: "forbidden" })).status).toBe(400);
      expect(state.rpc).not.toHaveBeenCalled();
    },
  );
  it("rejects unauthenticated feedback", async () => {
    expect((await request(event, null)).status).toBe(401);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("rejects invalid user sessions instead of accepting a claimed Human label", async () => {
    state.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "invalid" } });
    expect((await request()).status).toBe(401);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("rejects confirmed feedback by an actual scoped machine key", async () => {
    expect((await request(event, "sk_swarm_fixture")).status).toBe(409);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("binds unverified observation to the actual scoped machine key and owner", async () => {
    expect(
      (
        await request(
          {
            ...event,
            eventType: "UNVERIFIED",
            reasonCode: "UNVERIFIED_OBSERVATION",
          },
          "sk_swarm_fixture",
        )
      ).status,
    ).toBe(200);
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith(
      "axtn_case_document",
      expect.objectContaining({
        p_user_id: owner,
        p_payload: expect.objectContaining({
          eventType: "UNVERIFIED",
          _principal: { kind: "swarm_api_key", id: keyId },
        }),
      }),
    );
  });
  it("keeps the existing Case-scope restriction", async () => {
    state.maybeSingle.mockResolvedValueOnce({
      data: {
        id: keyId,
        user_id: owner,
        scopes: ["run"],
        is_active: true,
        revoked_at: null,
        expires_at: null,
      },
      error: null,
    });
    expect((await request(event, "sk_swarm_fixture")).status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("returns the native failure response on persistence error, not verified success", async () => {
    state.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "DOCUMENT_FEEDBACK_CURRENT_DECISION_REQUIRED" },
    });
    const response = await request();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Case operation rejected" });
    expect(console.warn).toHaveBeenCalledWith(
      "[case-work] operation rejected:",
      "DOCUMENT_FEEDBACK_CURRENT_DECISION_REQUIRED",
    );
  });
});
