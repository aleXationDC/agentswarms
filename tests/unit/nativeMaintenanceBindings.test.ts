import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  guard: true,
  requireSuperadminAal2: vi.fn(),
  safeFetch: vi.fn(),
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

vi.mock("@/utils/iam.server", () => ({
  requireSuperadminAal2: async (token: string) => {
    state.requireSuperadminAal2(token);
    return state.guard ? { ok: true, userId: "operator" } : { ok: false, error: "AAL2 required" };
  },
}));

vi.mock("@/utils/ssrfGuard.server", () => ({ safeFetch: state.safeFetch }));

import {
  getAxtnMaintenanceSettings,
  getManagedN8nStatus,
} from "@/utils/axtnMaintenanceSettings.functions";
import { readManagedN8nBinding, readOperatorUrls } from "@/utils/operatorBindings.server";
import { readManagedN8nStatus } from "@/utils/integrations/nativeN8n.server";

const KEY = "synthetic-native-n8n-key-not-for-browser";
const BASE = "http://n8n:5678";

beforeEach(() => {
  vi.clearAllMocks();
  state.guard = true;
  state.safeFetch.mockReset();
  vi.stubEnv("N8N_BASE_URL", BASE);
  vi.stubEnv("N8N_API_KEY", KEY);
  vi.stubEnv("AXTN_N8N_OPERATOR_URL", "https://n8n.tail123.ts.net");
  vi.stubEnv("AXTN_GITEA_OPERATOR_URL", "https://gitea.tail123.ts.net");
  vi.stubEnv("AXTN_MATRIX_OPERATOR_URL", "https://matrix.tail123.ts.net");
});

afterEach(() => vi.unstubAllEnvs());

describe("native host binding validation", () => {
  it("requires both host-managed n8n endpoint and key", () => {
    expect(readManagedN8nBinding({})).toEqual({ ok: true, binding: null });
    expect(readManagedN8nBinding({ N8N_BASE_URL: BASE })).toMatchObject({ ok: false });
    expect(readManagedN8nBinding({ N8N_API_KEY: KEY })).toMatchObject({ ok: false });
  });

  it("rejects endpoint credentials, query data, and non-HTTP schemes", () => {
    for (const N8N_BASE_URL of [
      "http://user:password@n8n:5678",
      "http://n8n:5678?api_key=leak",
      "file:///etc/passwd",
    ]) {
      expect(readManagedN8nBinding({ N8N_BASE_URL, N8N_API_KEY: KEY }).ok).toBe(false);
    }
  });

  it("only accepts credential-free private Tailnet operator URLs", () => {
    expect(
      readOperatorUrls({
        AXTN_N8N_OPERATOR_URL: "https://n8n.tail123.ts.net/",
        AXTN_GITEA_OPERATOR_URL: "https://gitea.tail123.ts.net",
        AXTN_MATRIX_OPERATOR_URL: "https://matrix.tail123.ts.net",
      }),
    ).toEqual({
      ok: true,
      urls: {
        n8n: "https://n8n.tail123.ts.net",
        gitea: "https://gitea.tail123.ts.net",
        matrix: "https://matrix.tail123.ts.net",
      },
    });
    for (const unsafe of [
      "http://gitea.tail123.ts.net",
      "https://user@gitea.tail123.ts.net",
      "https://gitea.tail123.ts.net/?token=secret",
      "https://gitea.example.com",
    ]) {
      expect(readOperatorUrls({ AXTN_GITEA_OPERATOR_URL: unsafe }).ok).toBe(false);
    }
  });
});

describe("authenticated managed n8n status", () => {
  it("reads workflow list with the host key and returns only safe workflow fields", async () => {
    state.safeFetch.mockResolvedValue(
      Response.json({
        data: [
          { id: "one", name: "Workflow One", active: false, secret: KEY },
          { id: "two", name: "Workflow Two", active: true },
          { id: 9, name: "discard malformed id" },
        ],
      }),
    );

    const result = await readManagedN8nStatus();
    expect(result).toEqual({
      configured: true,
      connected: true,
      workflows: [
        { id: "one", name: "Workflow One", active: false },
        { id: "two", name: "Workflow Two", active: true },
      ],
      detail: "Authenticated against the host-managed native n8n API.",
    });
    expect(state.safeFetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/workflows?limit=100`,
      expect.objectContaining({
        headers: expect.objectContaining({ "X-N8N-API-KEY": KEY }),
        maxRedirects: 0,
      }),
    );
    expect(JSON.stringify(result)).not.toContain(KEY);
    expect(JSON.stringify(result)).not.toContain(BASE);
  });

  it("redacts upstream response bodies and network errors", async () => {
    state.safeFetch.mockResolvedValue(new Response(KEY, { status: 401 }));
    expect(JSON.stringify(await readManagedN8nStatus())).not.toContain(KEY);

    state.safeFetch.mockRejectedValue(new Error(KEY));
    expect(JSON.stringify(await readManagedN8nStatus())).not.toContain(KEY);
  });

  it("discloses operator settings and workflow list only after AAL2 superadmin guard", async () => {
    state.safeFetch.mockResolvedValue(Response.json({ data: [] }));
    const settings = await getAxtnMaintenanceSettings({ data: { access_token: "aal2-session" } });
    expect(settings.operators).toHaveLength(3);
    expect(state.requireSuperadminAal2).toHaveBeenCalledWith("aal2-session");

    const status = await getManagedN8nStatus({ data: { access_token: "aal2-session" } });
    expect(status).toMatchObject({ configured: true, connected: true, workflows: [] });
    state.guard = false;
    await expect(getManagedN8nStatus({ data: { access_token: "aal1-session" } })).rejects.toThrow(
      "AAL2 required",
    );
  });
});

describe("maintenance UI security and compatibility", () => {
  it("uses the existing MFA management, single D09 API, trusted activity, and no key projection", () => {
    const page = readFileSync("src/routes/_authenticated/admin/axtn-maintenance.tsx", "utf8");
    expect(page).toContain('to="/account"');
    expect(page).toContain("getAuthenticatorAssuranceLevel");
    expect(page).toContain("listFactors");
    expect(page).toContain('fetch("/api/axtn/maintenance"');
    expect(page).toContain("event.isTrusted");
    expect(page).toContain('request("touch")');
    expect(page).toContain("Close maintenance");
    expect(page).toContain("Native aXtn n8n");
    expect(page).not.toContain("N8N_API_KEY");
    expect(page).not.toContain("N8N_BASE_URL");
    expect(page).not.toContain("axtn-maintenance-");
  });

  it("keeps user-owned n8n forms separate from native platform settings", () => {
    const page = readFileSync("src/routes/_authenticated/integrations.tsx", "utf8");
    expect(page).toContain("n8n Instance URL");
    expect(page).toContain("API Key");
    expect(page).toContain("Use host-managed native n8n (superadmins only)");
    expect(page).toContain("getNativeN8nStatus({ data: { access_token: session.access_token } })");
    expect(page).toContain("!n8nManaged &&");
    expect(page).toContain("{n8nManaged && (");
    const nav = readFileSync("src/lib/appNav.ts", "utf8");
    expect(nav).toContain('{ title: "Maintenance access", url: "/admin/axtn-maintenance"');
  });
});
