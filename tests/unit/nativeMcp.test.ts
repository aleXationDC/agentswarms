import { describe, expect, it } from "vitest";
import { nativeMcpAccessToken } from "@/utils/tools/nativeMcp.server";

const row = {
  id: "managed",
  user_id: "owner",
  name: "aXtn Development Gitea",
  endpoint: "http://native-mcp:8000/mcp",
  auth_type: "token",
  auth_token: null,
  auth_token_enc: null,
  status: "connected",
};
const env = {
  AXTN_DEVELOPMENT_MCP_SERVER_ID: "managed",
  AXTN_DEVELOPMENT_MCP_OWNER_ID: "owner",
  AXTN_DEVELOPMENT_MCP_URL: row.endpoint,
  AXTN_DEVELOPMENT_MCP_ACCESS_TOKEN: "a".repeat(64),
};

describe("managed native MCP boundary", () => {
  it("resolves only the exact owner and registry binding on the server", () => {
    const resolved = nativeMcpAccessToken(row, env);
    expect(resolved).toBe(env.AXTN_DEVELOPMENT_MCP_ACCESS_TOKEN);
    expect(row.auth_token).toBeNull();
  });
  it.each([
    { user_id: "foreign" },
    { endpoint: "https://attacker.invalid/mcp" },
    { name: "different" },
    { auth_type: "none" },
  ])("denies owner or endpoint retargeting", (change) => {
    expect(() => nativeMcpAccessToken({ ...row, ...change }, env)).toThrow("Host binding");
  });
  it("fails closed without the protected credential", () => {
    expect(() =>
      nativeMcpAccessToken(row, { ...env, AXTN_DEVELOPMENT_MCP_ACCESS_TOKEN: "" }),
    ).toThrow("not configured");
  });
  it("does not confer managed credentials to a similarly named user-owned row", () => {
    expect(nativeMcpAccessToken({ ...row, id: "other" }, env)).toBeUndefined();
  });
  it("keeps generic user-owned MCP behavior unchanged", () => {
    expect(nativeMcpAccessToken(row, {})).toBeUndefined();
  });
});
