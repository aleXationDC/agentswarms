import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  fetch: vi.fn(),
  update: vi.fn(),
  context: {} as Record<string, unknown>,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (fn: (options: unknown) => unknown) => (options: { data: unknown }) =>
        fn({ ...options, context: state.context }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/utils/ssrfGuard.server", () => ({ safeFetch: state.fetch }));
vi.mock("@/lib/mcp/auth.server", () => ({ resolveMcpAuthToken: async () => "fixture-only-token" }));

import { probeMcpServer } from "@/lib/mcp/probe.functions";

beforeEach(() => {
  vi.clearAllMocks();
  const row = {
    id: "73ac0c94-a037-4ba7-b1fa-5a4c395aa482",
    endpoint: "http://native-fixture:8000/mcp",
    auth_type: "token",
  };
  const query = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => ({ data: row }),
    update: (value: unknown) => {
      state.update(value);
      return query;
    },
  };
  state.context = { supabase: { from: () => query } };
});

async function probe(
  list: Record<string, unknown>,
  initialize: Record<string, unknown> = { result: { protocolVersion: "2025-06-18" } },
) {
  state.fetch
    .mockResolvedValueOnce(Response.json({ jsonrpc: "2.0", id: 1, ...initialize }))
    .mockResolvedValueOnce(new Response(null, { status: 202 }))
    .mockResolvedValueOnce(Response.json({ jsonrpc: "2.0", id: 2, ...list }));
  return probeMcpServer({ data: { id: "73ac0c94-a037-4ba7-b1fa-5a4c395aa482" } });
}

describe("MCP probe protocol verdict", () => {
  it("connects only after a successful initialized tools list", async () => {
    expect(await probe({ result: { tools: [{ name: "identity" }] } })).toMatchObject({
      ok: true,
      toolsCount: 1,
      status: "connected",
    });
  });
  it("does not turn an HTTP 200 JSON-RPC error into connected status", async () => {
    expect(await probe({ error: { code: -32000, message: "denied" } })).toMatchObject({
      ok: false,
      status: "error",
      toolsCount: 0,
    });
    expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
  });
  it("fails closed for absent or malformed tool metadata", async () => {
    for (const payload of [{ result: {} }, { result: { tools: [{ name: 42 }] } }]) {
      state.fetch.mockReset();
      expect(await probe(payload)).toMatchObject({ ok: false, status: "error" });
    }
  });
  it("does not list tools after a failed initialize protocol response", async () => {
    expect(
      await probe({ result: { tools: [] } }, { error: { code: -32000, message: "denied" } }),
    ).toMatchObject({ ok: false, status: "error" });
    expect(state.fetch).toHaveBeenCalledTimes(1);
  });
});
