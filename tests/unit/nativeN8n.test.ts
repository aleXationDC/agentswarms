import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "operator",
  role: true,
  roleError: false,
  bootstrap: false,
  writes: [] as Record<string, unknown>[],
  fetch: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (input: unknown) => input;
    const builder = {
      inputValidator: (fn: typeof validate) => {
        validate = fn;
        return builder;
      },
      handler: (fn: (options: { data: unknown }) => unknown) => (options: { data: unknown }) =>
        fn({ data: validate(options.data) }),
    };
    return builder;
  },
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getClaims: async () => ({ data: { claims: { sub: state.userId } }, error: null }),
    },
  }),
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: () => chain,
        limit: async () => ({ data: [], error: null }),
        maybeSingle: async () =>
          table === "user_roles"
            ? { data: state.role ? { id: "role" } : null, error: state.roleError ? {} : null }
            : { data: null, error: null },
        insert: (row: Record<string, unknown>) => {
          state.writes.push(row);
          return chain;
        },
        single: async () => ({ data: { id: "integration" }, error: null }),
      };
      return chain;
    },
  },
}));
vi.mock("@/utils/iam.server", () => ({
  isBootstrapAdmin: async () => state.bootstrap,
}));
vi.mock("@/utils/rateLimit.server", () => ({
  rateLimited: () => false,
  envInt: (_name: string, fallback: number) => fallback,
}));
vi.mock("@/utils/audit.server", () => ({ auditEvent: vi.fn() }));
vi.mock("@/utils/secrets.server", () => ({
  containsSecretRef: () => false,
  resolveSecretRefsInObject: (_user: string, config: unknown) => config,
}));
vi.mock("@/utils/ssrfGuard.server", () => ({
  safeFetch: state.fetch,
}));

import {
  executeNativeN8nWorkflow,
  readManagedN8nStatus,
  resolveNativeN8n,
} from "@/utils/integrations/nativeN8n.server";
import { resolveIntegrationConfig } from "@/utils/providers/integrationConfig.server";
import { saveIntegrationForUser } from "@/utils/integrations/operations.server";
import { getNativeN8nStatus, testN8nInstance } from "@/utils/integrations.functions";

const KEY = "host-secret-not-for-browser";
const BASE = "http://n8n:5678";
const webhookWorkflow = {
  active: true,
  nodes: [
    {
      type: "n8n-nodes-base.webhook",
      parameters: { path: "private-run", httpMethod: "POST", authentication: "none" },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  state.fetch.mockReset();
  state.writes.length = 0;
  state.role = true;
  state.roleError = false;
  state.bootstrap = false;
  vi.stubEnv("N8N_BASE_URL", BASE);
  vi.stubEnv("N8N_API_KEY", KEY);
  vi.stubEnv("SUPABASE_URL", "https://supabase.test");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "public");
});
afterEach(() => vi.unstubAllEnvs());

describe("managed resolution authorization", () => {
  it("resolves host values, ignores injected URL/token/auth overrides", async () => {
    expect(
      await resolveIntegrationConfig("operator", "n8n", {
        binding_mode: "native",
        instance_url: "https://attacker.example",
        webhook_token: "attacker-token",
        auth_type: "none",
      }),
    ).toEqual({
      binding_mode: "native",
      instance_url: BASE,
      webhook_token: KEY,
      auth_type: "header",
    });
  });

  it("denies a forged native row and rechecks after role revocation", async () => {
    await resolveNativeN8n("operator");
    state.role = false;
    await expect(resolveNativeN8n("operator")).rejects.toThrow("superadmin");
  });

  it("fails closed on DB authorization errors even for bootstrap admin", async () => {
    state.roleError = true;
    state.bootstrap = true;
    await expect(resolveNativeN8n("operator")).rejects.toThrow("Unable to verify");
  });

  it("supports the existing confirmed bootstrap admin semantics", async () => {
    state.role = false;
    state.bootstrap = true;
    expect((await resolveNativeN8n("operator")).webhook_token).toBe(KEY);
  });

  it("requires both host variables, without falling back to client config", async () => {
    vi.stubEnv("N8N_API_KEY", "");
    expect(await readManagedN8nStatus()).toMatchObject({
      configured: true,
      connected: false,
    });
    await expect(resolveNativeN8n("operator")).rejects.toThrow("both");
  });

  it("leaves external user configuration unchanged", async () => {
    state.role = false;
    const manual = {
      instance_url: "https://external.example",
      webhook_token: "user-key",
      auth_type: "header",
    };
    expect(await resolveIntegrationConfig("user", "n8n", manual)).toEqual(manual);
  });
});

describe("server functions and persistence", () => {
  it("shows the configured instance and live API status only to superadmins", async () => {
    state.fetch.mockResolvedValue(
      Response.json({
        data: [
          { id: "one", name: "inactive", active: false },
          { id: "two", name: "active", active: true },
        ],
      }),
    );
    const result = await getNativeN8nStatus({ data: { access_token: "operator-jwt" } });
    expect(result).toMatchObject({
      available: true,
      instanceUrl: BASE,
      connected: true,
      workflowCount: 2,
      activeWorkflowCount: 1,
    });
    expect(result.checkedAt).toBeTruthy();
    expect(JSON.stringify(result)).not.toContain(KEY);
    state.role = false;
    expect(await getNativeN8nStatus({ data: { access_token: "user-jwt" } })).toMatchObject({
      available: false,
      instanceUrl: null,
      connected: false,
    });
  });

  it("hides the managed endpoint when its protected host binding is incomplete", async () => {
    vi.stubEnv("N8N_API_KEY", "");
    expect(await getNativeN8nStatus({ data: { access_token: "operator-jwt" } })).toMatchObject({
      available: false,
      instanceUrl: null,
      connected: false,
    });
  });

  it("tests native n8n with the API key server-side, no browser input required", async () => {
    state.fetch.mockResolvedValue(
      Response.json({ data: [{ id: "workflow", name: "Test workflow", active: false }] }),
    );
    const result = await testN8nInstance({
      data: { access_token: "operator-jwt", binding_mode: "native" },
    });
    expect(result).toMatchObject({ ok: true, workflowCount: 1 });
    expect(JSON.stringify(result)).not.toContain(KEY);
    expect(JSON.stringify(result)).not.toContain(BASE);
    expect(state.fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/workflows?limit=100`,
      expect.objectContaining({
        headers: expect.objectContaining({ "X-N8N-API-KEY": KEY }),
        maxRedirects: 0,
      }),
    );
  });

  it("rejects native test for a non-superadmin before any outbound request", async () => {
    state.role = false;
    expect(
      await testN8nInstance({ data: { access_token: "user-jwt", binding_mode: "native" } }),
    ).toMatchObject({ ok: false, detail: expect.stringContaining("superadmin") });
    expect(state.fetch).not.toHaveBeenCalled();
  });

  it("never reflects a managed upstream error or exception containing the key", async () => {
    state.fetch.mockResolvedValue(new Response(KEY, { status: 401 }));
    let result = await testN8nInstance({
      data: { access_token: "operator-jwt", binding_mode: "native" },
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(KEY);
    state.fetch.mockRejectedValue(new Error(KEY));
    result = await testN8nInstance({
      data: { access_token: "operator-jwt", binding_mode: "native" },
    });
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  it("preserves external URL, user key and header authentication", async () => {
    state.role = false;
    state.fetch.mockResolvedValue(Response.json({ data: [] }));
    expect(
      await testN8nInstance({
        data: {
          access_token: "user-jwt",
          instance_url: "https://external.example",
          webhook_token: "user-key",
          auth_type: "header",
        },
      }),
    ).toMatchObject({ ok: true });
    expect(state.fetch).toHaveBeenCalledWith(
      "https://external.example/api/v1/workflows?limit=1",
      expect.objectContaining({
        headers: expect.objectContaining({ "X-N8N-API-KEY": "user-key" }),
      }),
    );
  });

  it("stores only the binding marker and denies unauthorized native saves", async () => {
    const input = {
      type: "n8n",
      provider: "n8n",
      name: "n8n",
      config: { binding_mode: "native", webhook_token: KEY, instance_url: BASE },
      is_active: true,
    };
    expect(await saveIntegrationForUser("operator", input)).toEqual({
      ok: true,
      id: "integration",
    });
    expect(state.writes[0].config).toEqual({ binding_mode: "native" });
    expect(JSON.stringify(state.writes)).not.toContain(KEY);
    state.role = false;
    state.writes.length = 0;
    expect(await saveIntegrationForUser("user", input)).toMatchObject({ ok: false });
    expect(state.writes).toEqual([]);
  });
});

describe("supported managed workflow execution", () => {
  it("reads metadata via public API, invokes private webhook without the admin key", async () => {
    state.fetch
      .mockResolvedValueOnce(Response.json(webhookWorkflow))
      .mockResolvedValueOnce(Response.json({ result: "done" }));
    expect(
      JSON.parse(await executeNativeN8nWorkflow(BASE, { "X-N8N-API-KEY": KEY }, "flow", { x: 1 })),
    ).toEqual({ ok: true, result: { result: "done" } });
    expect(state.fetch.mock.calls[0][0]).toBe(`${BASE}/api/v1/workflows/flow`);
    expect(state.fetch.mock.calls[1][0]).toBe(`${BASE}/webhook/private-run`);
    expect(state.fetch.mock.calls[1][1].headers).not.toHaveProperty("X-N8N-API-KEY");
    expect(state.fetch.mock.calls[1][1].maxRedirects).toBe(0);
  });

  it.each([
    { ...webhookWorkflow, active: false },
    { ...webhookWorkflow, nodes: [] },
    { ...webhookWorkflow, nodes: [...webhookWorkflow.nodes, ...webhookWorkflow.nodes] },
    {
      active: true,
      nodes: [
        {
          type: "n8n-nodes-base.webhook",
          parameters: { path: "../api/v1/users", httpMethod: "POST" },
        },
      ],
    },
    {
      active: true,
      nodes: [
        { type: "n8n-nodes-base.webhook", parameters: { path: "={{evil}}", httpMethod: "POST" } },
      ],
    },
    {
      active: true,
      nodes: [
        {
          type: "n8n-nodes-base.webhook",
          parameters: { path: "run", httpMethod: "POST", authentication: "headerAuth" },
        },
      ],
    },
  ])("fails closed for unsupported trigger configuration %#", async (workflow) => {
    state.fetch.mockResolvedValue(Response.json(workflow));
    expect(JSON.parse(await executeNativeN8nWorkflow(BASE, {}, "flow", {}))).toHaveProperty(
      "error",
    );
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });

  it("redacts secrets even if a successful webhook response reflects the key", async () => {
    state.fetch
      .mockResolvedValueOnce(Response.json(webhookWorkflow))
      .mockResolvedValueOnce(Response.json({ reflection: KEY }));
    expect(await executeNativeN8nWorkflow(BASE, {}, "flow", {})).not.toContain(KEY);
  });
});

describe("n8n Integration Hub and native tool wiring", () => {
  it("uses the same resolver in health/tools, retains manual execution path", () => {
    const health = readFileSync("src/utils/integrations/health.server.ts", "utf8");
    const tools = readFileSync("src/utils/tools/registry.server.ts", "utf8");
    const integrations = readFileSync("src/routes/_authenticated/integrations.tsx", "utf8");
    expect(health).toContain('cfg.binding_mode === "native"');
    expect(health).toContain("readManagedN8nStatus()");
    expect(tools).toContain("resolveIntegrationConfig(");
    expect(tools).toContain("if (cfg.managed)");
    expect(tools).toContain("const status = await readManagedN8nStatus()");
    expect(tools).toContain("executeNativeN8nWorkflow(cfg.baseUrl");
    expect(tools).toContain("/api/v1/workflows/${encodeURIComponent(id)}/execute");
    expect(tools).toContain("Managed n8n execution requires an explicit workflow ID allow-list");
    expect(integrations).toContain("Configured native instance");
    expect(integrations).toContain("Last validated:");
  });
});
