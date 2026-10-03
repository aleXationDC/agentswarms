import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "operator", email: "operator@example.test" },
  role: true,
  roleError: false,
  fetch: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
    },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({
          data: state.role ? { role: "superadmin" } : null,
          error: state.roleError ? new Error("role store unavailable") : null,
        }),
      };
      return query;
    },
  },
}));

import { Route } from "@/routes/api/axtn.maintenance";

type RouteHandlers = {
  GET: (context: { request: Request }) => Promise<Response>;
  POST: (context: { request: Request }) => Promise<Response>;
};
const handlers = (Route as unknown as { options: { server: { handlers: RouteHandlers } } }).options
  .server.handlers;

function jwt(aal: "aal1" | "aal2") {
  const claims = Buffer.from(JSON.stringify({ sub: state.user.id, aal })).toString("base64url");
  return `header.${claims}.signature`;
}

function request(method: "GET" | "POST", token?: string, body?: unknown) {
  return new Request("http://app.test/api/axtn/maintenance", {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "operator", email: "operator@example.test" };
  state.role = true;
  state.roleError = false;
  vi.stubEnv("AXTN_MAINTENANCE_URL", "http://maintenance.internal:18090");
  vi.stubEnv("AXTN_MAINTENANCE_TOKEN", "synthetic-maintenance-secret");
  vi.stubEnv("ADMIN_EMAIL", "bootstrap@example.test");
  state.fetch.mockImplementation(async () => Response.json({ open: false, expires_at: null }));
  vi.stubGlobal("fetch", state.fetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("D09 maintenance API", () => {
  it("rejects unauthenticated access and never calls the lease authority", async () => {
    const response = await handlers.GET({ request: request("GET") });
    expect(response.status).toBe(401);
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("denies AAL1 open and audits it without opening the lease", async () => {
    const response = await handlers.POST({
      request: request("POST", jwt("aal1"), { action: "open" }),
    });
    expect(response.status).toBe(403);
    expect(state.fetch).toHaveBeenCalledTimes(1);
    expect(state.fetch.mock.calls[0][0]).toBe("http://maintenance.internal:18090/reject");
    expect(JSON.stringify(await response.json())).not.toContain("synthetic-maintenance-secret");
  });

  it("authorizes AAL2 status/open/touch/close through the one host lease API", async () => {
    const token = jwt("aal2");
    const status = await handlers.GET({ request: request("GET", token) });
    expect(status.status).toBe(200);
    expect(state.fetch.mock.calls[0][0]).toBe("http://maintenance.internal:18090/status");

    for (const action of ["open", "touch", "close"] as const) {
      const response = await handlers.POST({
        request: request("POST", token, { action }),
      });
      expect(response.status).toBe(200);
      const call = state.fetch.mock.calls.at(-1);
      expect(call[0]).toBe(`http://maintenance.internal:18090/${action}`);
      expect(call[1].headers.Authorization).toBe("Bearer synthetic-maintenance-secret");
      expect(JSON.stringify(await response.json())).not.toContain("synthetic-maintenance-secret");
    }
  });

  it("fails closed when role verification or the host lease binding fails", async () => {
    state.roleError = true;
    state.fetch.mockResolvedValue(Response.json({ recorded: true }));
    const roleFailure = await handlers.POST({
      request: request("POST", jwt("aal2"), { action: "open" }),
    });
    expect(roleFailure.status).toBe(503);
    expect(JSON.stringify(await roleFailure.json())).not.toContain("synthetic-maintenance-secret");

    state.roleError = false;
    vi.stubEnv("AXTN_MAINTENANCE_URL", "");
    const unconfigured = await handlers.POST({
      request: request("POST", jwt("aal2"), { action: "open" }),
    });
    expect(unconfigured.status).toBe(503);
  });

  it("rejects unsupported actions before calling the lease authority", async () => {
    const response = await handlers.POST({
      request: request("POST", jwt("aal2"), { action: "reload-caddy" }),
    });
    expect(response.status).toBe(400);
    expect(state.fetch).not.toHaveBeenCalled();
  });
});
