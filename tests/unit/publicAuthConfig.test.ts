import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({ maybeSingle: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }),
    }),
  },
}));

import { getPublicAuthConfig } from "@/routes/api/auth/sso-config";

describe("public login configuration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.maybeSingle.mockReset();
  });

  it.each([false, true])("publishes the stored public signup setting (%s)", async (allowed) => {
    mocks.maybeSingle.mockResolvedValue({
      data: { sso_enabled: false, sso_enforced: false, allow_public_signup: allowed },
      error: null,
    });
    const response = await getPublicAuthConfig();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      enabled: false,
      enforced: false,
      allow_public_signup: allowed,
    });
  });

  it.each([
    { data: null, error: null },
    { data: null, error: new Error("database unavailable") },
  ])("reports unavailable policy rather than allowing signup", async (result) => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.maybeSingle.mockResolvedValue(result);
    const response = await getPublicAuthConfig();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: "Instance authentication settings are unavailable",
    });
    expect(logger).toHaveBeenCalledOnce();
  });

  it("gates both the signup entry and submission on explicitly enabled policy", () => {
    const login = readFileSync("src/routes/login.tsx", "utf8");
    expect(login).toMatch(/ssoConfig\?\.allow_public_signup === true \? \([\s\S]*?Sign up/);
    expect(login).toMatch(
      /if \(mode === "signup"\) \{\s*if \(ssoConfig\?\.allow_public_signup !== true\)/,
    );
  });
});
