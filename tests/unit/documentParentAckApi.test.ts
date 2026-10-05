import { beforeEach, describe, expect, it, vi } from "vitest";
import { DOCUMENT_SUSPENDED_OUTPUT } from "@/axtn/workbenches/documents/documentPersistence.server";

type Handler = (context: { request: Request }) => Promise<Response>;
type Result = { data: unknown; error: null };
const state = vi.hoisted(() => ({
  handler: null as Handler | null,
  swarmId: "9b9ea6c2-a554-4fa7-9c40-908dad632ae7",
  idem: null as {
    status: string;
    request_hash: string;
    run_id: string;
    response: Record<string, unknown> | null;
  } | null,
  writes: [] as { table: string; method: string; value: Record<string, unknown> }[],
  execute: vi.fn(),
  readAck: vi.fn(),
  callback: vi.fn(),
  release: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: { server: { handlers: { POST: Handler } } }) => {
    state.handler = config.server.handlers.POST;
    return config;
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      const result = (): Result => {
        if (table === "swarm_api_keys")
          return {
            data: {
              id: "key-fixture",
              user_id: "owner-fixture",
              swarm_id: state.swarmId,
              is_active: true,
              reject_approvals: false,
              expires_at: null,
              scopes: ["run"],
              webhook_secret: null,
              callback_url: null,
            },
            error: null,
          };
        if (table === "swarm_run_idempotency") return { data: state.idem, error: null };
        if (table === "swarms")
          return {
            data: { id: state.swarmId, name: "DMS fixture", nodes: [], edges: [] },
            error: null,
          };
        throw new Error(`Unexpected table ${table}`);
      };
      const chain = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        insert(value: Record<string, unknown>) {
          state.writes.push({ table, method: "insert", value });
          return chain;
        },
        update(value: Record<string, unknown>) {
          state.writes.push({ table, method: "update", value });
          return chain;
        },
        async maybeSingle() {
          return result();
        },
        then<A = Result, B = never>(
          resolve?: ((value: Result) => A | PromiseLike<A>) | null,
          reject?: ((reason: unknown) => B | PromiseLike<B>) | null,
        ) {
          return Promise.resolve(result()).then(resolve, reject);
        },
      };
      return chain;
    },
  },
}));
vi.mock("@/utils/swarmDeploy.functions", () => ({ sha256Hex: async () => "fixture-hash" }));
vi.mock("@/utils/swarmExecute.server", () => ({ executeSwarmServer: state.execute }));
vi.mock("@/utils/internalOrigin.server", () => ({
  resolveInternalOrigin: () => "http://localhost:3000",
}));
vi.mock("@/utils/rateLimit.server", () => ({
  acquireSlotGlobal: async () => ({ release: state.release }),
  rateLimitedGlobal: async () => false,
  envInt: (_name: string, fallback: number) => fallback,
}));
vi.mock("@/utils/audit.server", () => ({ auditEvent: vi.fn() }));
vi.mock("@/utils/budgetGuard.server", () => ({
  getBudgetDecision: async () => ({ over: false }),
  budgetMessage: () => "fixture budget",
}));
vi.mock("@/utils/swarmWebhook.server", () => ({
  hashBody: async () => "request-hash",
  deliverRunCallback: state.callback,
}));
vi.mock("@/axtn/workbenches/documents/documentRegistrationAck.server", () => ({
  readDocumentParentRegistrationAck: state.readAck,
}));
import "@/routes/api/swarm.run";

const runId = "33333333-3333-4333-8333-333333333333";
const ack = {
  accepted: true,
  document_id: "opaque-document",
  source_ref: "drive:opaque-fixture",
  processing_status: "registered",
  processing_route: "privacy_hold",
  registry_outcome: "inserted",
  case_id: "22222222-2222-4222-8222-222222222222",
  input_hash: "a".repeat(64),
};
async function post(payload: Record<string, unknown> = {}, idempotent = true) {
  if (!state.handler) throw new Error("Route fixture handler not registered");
  return state.handler({
    request: new Request("http://localhost/api/swarm/run", {
      method: "POST",
      headers: {
        Authorization: "Bearer synthetic-api-key",
        "Content-Type": "application/json",
        ...(idempotent ? { "Idempotency-Key": "delivery-fixture" } : {}),
      },
      body: JSON.stringify(payload),
    }),
  });
}
beforeEach(() => {
  state.swarmId = "9b9ea6c2-a554-4fa7-9c40-908dad632ae7";
  state.idem = null;
  state.writes = [];
  state.execute.mockReset().mockResolvedValue({
    status: "suspended",
    output: "awaiting independent reviewer",
    error: null,
    runId,
  });
  state.readAck.mockReset().mockResolvedValue(ack);
  state.callback.mockReset().mockResolvedValue(undefined);
  state.release.mockReset().mockResolvedValue(undefined);
});

describe("existing public API Parent ACK transport", () => {
  it("sync projects registration without completing the suspended idempotency claim", async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "suspended",
      output: DOCUMENT_SUSPENDED_OUTPUT,
      runId,
      ...ack,
    });
    expect(state.readAck).toHaveBeenCalledWith({
      userId: "owner-fixture",
      swarmId: state.swarmId,
      runId,
    });
    expect(state.writes.at(-1)).toMatchObject({
      table: "swarm_run_idempotency",
      method: "update",
      value: { status: "in_progress", run_id: runId, completed_at: null },
    });
    expect(state.execute).toHaveBeenCalledTimes(1);
    expect(state.release).toHaveBeenCalledTimes(1);
  });
  it("reads a lost suspended response without a second execution or write", async () => {
    state.idem = {
      status: "in_progress",
      request_hash: "request-hash",
      run_id: runId,
      response: { status: "suspended", output: "awaiting independent reviewer", runId },
    };
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "suspended",
      output: DOCUMENT_SUSPENDED_OUTPUT,
      runId,
      ...ack,
    });
    expect(state.execute).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
  });
  it("preserves body mismatch rejection before registration readback", async () => {
    state.idem = {
      status: "in_progress",
      request_hash: "different-body",
      run_id: runId,
      response: { status: "suspended", output: "" },
    };
    const response = await post();
    expect(response.status).toBe(422);
    expect(state.readAck).not.toHaveBeenCalled();
    expect(state.execute).not.toHaveBeenCalled();
  });
  it("does not change ordinary in-progress responses or rerun them", async () => {
    state.swarmId = "development-fixture";
    state.readAck.mockResolvedValue(null);
    state.idem = {
      status: "in_progress",
      request_hash: "request-hash",
      run_id: runId,
      response: null,
    };
    const response = await post();
    expect(response.status).toBe(409);
    expect(state.execute).not.toHaveBeenCalled();
  });
  it("async sends the same ACK through the existing callback and leaves the run pending", async () => {
    const response = await post({
      async: true,
      callback_url: "https://example.invalid/native-callback",
    });
    expect(response.status).toBe(202);
    await vi.waitFor(() => expect(state.callback).toHaveBeenCalledTimes(1));
    expect(state.callback.mock.calls[0][0].payload).toEqual({
      runId,
      status: "suspended",
      output: DOCUMENT_SUSPENDED_OUTPUT,
      error: null,
      swarmId: state.swarmId,
      ...ack,
    });
    expect(state.writes.at(-1)?.value.status).toBe("in_progress");
    await vi.waitFor(() => expect(state.release).toHaveBeenCalledTimes(1));
  });
  it("reports projection failure explicitly and never returns accepted fallback data", async () => {
    state.readAck.mockRejectedValue(
      new Error("DOCUMENT_PARENT_REGISTRATION_PERSISTED_ROWS_REQUIRED"),
    );
    await expect(post()).rejects.toThrow("PERSISTED_ROWS_REQUIRED");
    expect(state.writes.some((write) => write.value.status === "completed")).toBe(false);
    expect(state.writes.at(-1)).toMatchObject({
      table: "swarm_run_idempotency",
      value: {
        status: "in_progress",
        run_id: runId,
        response: { status: "suspended", output: DOCUMENT_SUSPENDED_OUTPUT, runId },
      },
    });
    expect(state.release).toHaveBeenCalledTimes(1);
  });
  it("async projection failure keeps the native parked claim recoverable, not reclaimable", async () => {
    state.readAck.mockRejectedValue(
      new Error("DOCUMENT_PARENT_REGISTRATION_PERSISTED_ROWS_REQUIRED"),
    );
    expect(
      (await post({ async: true, callback_url: "https://example.invalid/native-callback" })).status,
    ).toBe(202);
    await vi.waitFor(() => expect(state.callback).toHaveBeenCalledTimes(1));
    expect(state.callback.mock.calls[0][0].payload).toMatchObject({
      status: "error",
      runId,
      error: "DOCUMENT_PARENT_REGISTRATION_PERSISTED_ROWS_REQUIRED",
    });
    expect(state.callback.mock.calls[0][0].payload).not.toHaveProperty("accepted");
    expect(state.writes.at(-1)?.value).toMatchObject({
      status: "in_progress",
      run_id: runId,
      completed_at: null,
    });
    expect(state.writes.some((write) => write.value.status === "failed")).toBe(false);
    await vi.waitFor(() => expect(state.release).toHaveBeenCalledTimes(1));
  });
  it("rejects malformed pending response caches instead of silently fabricating output", async () => {
    state.idem = {
      status: "in_progress",
      request_hash: "request-hash",
      run_id: runId,
      response: null,
    };
    await expect(post()).rejects.toThrow("CACHED_RESPONSE_REQUIRED");
    expect(state.execute).not.toHaveBeenCalled();
    expect(state.writes).toEqual([]);
  });
  it("omits original pending content from DMS response, cache and callback without changing the ACK", async () => {
    state.execute.mockResolvedValue({
      status: "suspended",
      output: "ORIGINAL_PENDING_LEAKAGE_MARKER",
      error: null,
      runId,
    });
    const response = await post();
    expect(await response.json()).toEqual({
      status: "suspended",
      output: DOCUMENT_SUSPENDED_OUTPUT,
      runId,
      ...ack,
    });
    expect(JSON.stringify(state.writes)).not.toContain("ORIGINAL_PENDING_LEAKAGE_MARKER");
    expect(state.writes.at(-1)?.value.response).toMatchObject({
      output: DOCUMENT_SUSPENDED_OUTPUT,
    });
    await post({ async: true, callback_url: "https://example.invalid/native-callback" }, false);
    await vi.waitFor(() => expect(state.callback).toHaveBeenCalledOnce());
    expect(state.callback.mock.calls[0][0].payload).toMatchObject({
      output: DOCUMENT_SUSPENDED_OUTPUT,
      ...ack,
    });
    expect(JSON.stringify(state.callback.mock.calls)).not.toContain(
      "ORIGINAL_PENDING_LEAKAGE_MARKER",
    );
  });
  it("does not reflect a legacy raw cached pending body during lost-response readback", async () => {
    state.idem = {
      status: "in_progress",
      request_hash: "request-hash",
      run_id: runId,
      response: { status: "suspended", output: "ORIGINAL_PENDING_LEAKAGE_MARKER", runId },
    };
    const response = await post();
    expect(await response.json()).toEqual({
      status: "suspended",
      output: DOCUMENT_SUSPENDED_OUTPUT,
      runId,
      ...ack,
    });
    expect(state.writes).toEqual([]);
    expect(state.execute).not.toHaveBeenCalled();
  });
  it("preserves generic suspended output and cache without a DMS marker", async () => {
    state.swarmId = "development-fixture";
    state.readAck.mockResolvedValue(null);
    const response = await post();
    expect(await response.json()).toEqual({
      status: "suspended",
      output: "awaiting independent reviewer",
      runId,
    });
    expect(state.writes.at(-1)?.value.response).toMatchObject({
      output: "awaiting independent reviewer",
    });
  });
});
