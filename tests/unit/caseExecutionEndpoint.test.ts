import { beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  post: null as null | ((args: { request: Request }) => Promise<Response>),
  closed: false,
  revoked: false,
  scopes: ["run", "cases"],
  finished: null as Record<string, unknown> | null,
  ledger: null as Record<string, unknown> | null,
  reads: [] as string[],
  release: vi.fn(),
  execute: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { server: { handlers: { POST: typeof fixture.post } } }) => {
    fixture.post = options.server.handlers.POST;
    return options;
  },
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      fixture.reads.push(table);
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data:
            table === "swarm_api_keys"
              ? {
                  id: "a6111111-1111-4111-8111-111111111111",
                  user_id: "a6222222-2222-4222-8222-222222222222",
                  swarm_id: "a6333333-3333-4333-8333-333333333333",
                  is_active: true,
                  revoked_at: fixture.revoked ? new Date().toISOString() : null,
                  scopes: fixture.scopes,
                }
              : table === "swarm_run_idempotency"
                ? fixture.ledger
                : table === "swarm_runs"
                  ? fixture.finished
                  : null,
          error: null,
        }),
      };
      return query;
    },
  },
}));
vi.mock("@/utils/swarmDeploy.functions", () => ({ sha256Hex: async () => "synthetic-hash" }));
vi.mock("@/utils/swarmExecute.server", () => ({ executeSwarmServer: fixture.execute }));
vi.mock("@/utils/swarmWebhook.server", () => ({
  hashBody: async () => "synthetic-request-hash",
  deliverRunCallback: vi.fn(),
}));
vi.mock("@/utils/rateLimit.server", () => ({
  rateLimitedGlobal: async () => false,
  acquireSlotGlobal: async () => ({ release: fixture.release }),
  envInt: (_name: string, fallback: number) => fallback,
}));
vi.mock("@/utils/audit.server", () => ({ auditEvent: vi.fn() }));
vi.mock("@/axtn/workbenches/cases/work.server", () => ({
  executeCaseWork: async () => ({
    scope: "AUTHORIZED_CASES",
    total: 1,
    offset: 0,
    limit: 1,
    cases: [
      {
        case_id: "a6444444-4444-4444-8444-444444444444",
        subject: "Synthetic endpoint",
        case_access_mode: "CUSTODIAN",
        status: fixture.closed ? "CLOSED" : "OPEN",
      },
    ],
  }),
}));
await import("@/routes/api/swarm.run");
const caseId = "a6444444-4444-4444-8444-444444444444";
const runId = "a6555555-5555-4555-8555-555555555555";
const call = (payload: unknown = { case_id: caseId }, idempotency = "synthetic-key") =>
  fixture.post!({
    request: new Request("http://fixture.invalid/api/swarm/run", {
      method: "POST",
      headers: {
        Authorization: "Bearer synthetic-key",
        "Content-Type": "application/json",
        ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
      },
      body: JSON.stringify(payload),
    }),
  });
describe("Case-bound existing swarm HTTP endpoint readback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.reads = [];
    fixture.closed = false;
    fixture.revoked = false;
    fixture.scopes = ["run", "cases"];
    fixture.ledger = {
      status: "completed",
      request_hash: "synthetic-request-hash",
      run_id: runId,
      response: { output: "synthetic result", runId },
    };
    fixture.finished = {
      id: runId,
      status: "success",
      case_id: caseId,
      case_execution_principal: {
        kind: "swarm_api_key",
        id: "a6111111-1111-4111-8111-111111111111",
      },
    };
  });
  it("returns exact authorized cached output even after Case closure without executing", async () => {
    fixture.closed = true;
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ output: "synthetic result", runId });
    expect(fixture.execute).not.toHaveBeenCalled();
    expect(fixture.release).toHaveBeenCalledOnce();
  });
  it.each(["status", "case", "principal", "shape"])(
    "denies invalid %s readback without replay inference",
    async (field) => {
      if (field === "status") fixture.finished!.status = "error";
      if (field === "case") fixture.finished!.case_id = "a6666666-6666-4666-8666-666666666666";
      if (field === "principal")
        fixture.finished!.case_execution_principal = { kind: "user_session", id: runId };
      if (field === "shape") fixture.ledger!.response = { runId, output: 42 };
      const response = await call();
      expect(response.status).toBe(409);
      expect((await response.json()).error).toBe("CASE_EXECUTION_READBACK_RECOVERY_REQUIRED");
      expect(fixture.execute).not.toHaveBeenCalled();
    },
  );
  it.each(["executionPrincipal", "credentialOwnerId", "case_attempt_id", "internalUserId"])(
    "rejects undeclared client control %s before ledger access",
    async (field) => {
      const response = await call({ case_id: caseId, [field]: runId });
      expect(response.status).toBe(400);
      expect(fixture.reads).not.toContain("swarm_run_idempotency");
    },
  );
  it("requires idempotency and Case scope and denies revoked keys", async () => {
    expect((await call({ case_id: caseId }, "")).status).toBe(400);
    fixture.scopes = ["run"];
    expect((await call()).status).toBe(403);
    fixture.revoked = true;
    expect((await call()).status).toBe(401);
    expect(fixture.execute).not.toHaveBeenCalled();
  });
  it("does not take over a failed Case ledger entry", async () => {
    fixture.ledger!.status = "failed";
    const response = await call();
    expect(response.status).toBe(409);
    expect(fixture.execute).not.toHaveBeenCalled();
  });
});
