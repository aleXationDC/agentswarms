import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
    then: (resolve: (value: unknown) => unknown) =>
      resolve({
        data: [
          {
            is_active: true,
            config: { base_url: "https://upstream.invalid/v1", api_key: "synthetic-upstream-key" },
          },
        ],
        error: null,
      }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { query, from: vi.fn(() => query) };
});
const adapter = vi.hoisted(() => vi.fn(async () => new Response("mock stream")));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: db }));
vi.mock("@/utils/providers/integrationConfig.server", () => ({
  resolveIntegrationConfig: vi.fn(async (_user: string, _type: string, config: unknown) => config),
}));
vi.mock("@/utils/providers/adapters/openai-compat.server", () => ({
  openAICompatChatStream: adapter,
}));
import {
  canRouteThroughGateway,
  resolveOpenAICompatTransport,
  resolveUserGatewayOverride,
  streamWithProvider,
} from "@/utils/providers/credentials.server";

const gateway = { baseUrl: "https://mock.invalid/v2", apiKey: "synthetic-test-key" };

beforeEach(() => {
  vi.clearAllMocks();
  db.query.select.mockReturnValue(db.query);
  db.query.eq.mockReturnValue(db.query);
  db.query.order.mockReturnValue(db.query);
  db.from.mockReturnValue(db.query);
  db.query.maybeSingle.mockResolvedValue({
    data: {
      is_active: true,
      config: { base_url: gateway.baseUrl + "/", api_key: gateway.apiKey, route_all: false },
    },
    error: null,
  });
});
afterEach(() => vi.restoreAllMocks());

describe("native owner-scoped gateway resolution (MOCK)", () => {
  it("routes an explicit opt-in without enabling route_all or requiring an upstream credential", async () => {
    const transport = await resolveOpenAICompatTransport({
      userId: "runner-a",
      provider: "openai",
      routeThroughGateway: true,
    });
    expect(transport).toEqual({
      endpointUrl: `${gateway.baseUrl}/chat/completions`,
      apiKey: gateway.apiKey,
    });
    expect(db.from).toHaveBeenCalledTimes(1);
    expect(db.query.eq).toHaveBeenCalledWith("user_id", "runner-a");
    expect(db.query.eq).toHaveBeenCalledWith("type", "llm_gateway");
    expect(db.query.eq).toHaveBeenCalledWith("is_active", true);
  });

  it("leaves the gateway off when neither node nor global policy opts in", async () => {
    expect(await resolveUserGatewayOverride("runner-a", { requireRouteAll: true })).toBeNull();
  });

  it("preserves ordinary provider credential routing when opt-in and route_all are false", async () => {
    expect(
      await resolveOpenAICompatTransport({
        userId: "runner-a",
        provider: "openai",
        routeThroughGateway: false,
      }),
    ).toEqual({
      endpointUrl: "https://upstream.invalid/v1/chat/completions",
      apiKey: "synthetic-upstream-key",
      organizationId: undefined,
    });
    expect(db.query.eq).toHaveBeenCalledWith("provider", "openai");
  });

  it("honors global route_all for callers with no node opt-in", async () => {
    db.query.maybeSingle.mockResolvedValue({
      data: {
        is_active: true,
        config: { base_url: gateway.baseUrl, api_key: gateway.apiKey, route_all: true },
      },
      error: null,
    });
    expect(
      await resolveOpenAICompatTransport({ userId: "runner-a", provider: "gemini" }),
    ).toMatchObject({ endpointUrl: `${gateway.baseUrl}/chat/completions` });
  });

  it.each(["absent", "unavailable", "lookup-error"])(
    "fails closed on %s, with no provider fallback",
    async (kind) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      db.query.maybeSingle.mockResolvedValue({
        data: kind === "incomplete" ? { is_active: true, config: {} } : null,
        error: kind === "lookup-error" ? { message: "mock database error" } : null,
      });
      await expect(
        resolveOpenAICompatTransport({
          userId: "runner-b",
          provider: "openrouter",
          routeThroughGateway: true,
        }),
      ).rejects.toThrow("requested LLM Gateway is unavailable");
      expect(db.from).toHaveBeenCalledTimes(1);
      expect(db.query.eq).toHaveBeenCalledWith("user_id", "runner-b");
      expect(adapter).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["no active gateway", { data: null, error: null }, "unavailable"],
    [
      "an incomplete gateway",
      { data: { is_active: true, config: { base_url: "", api_key: "" } }, error: null },
      "unavailable",
    ],
    ["a failed lookup", { data: null, error: { message: "boom" } }, "unavailable"],
  ])("fails closed on opt-in with %s, without a direct upstream fallback", async (_n, row, msg) => {
    db.query.maybeSingle.mockResolvedValue(row);
    await expect(
      resolveOpenAICompatTransport({
        userId: "runner-a",
        provider: "openai",
        routeThroughGateway: true,
      }),
    ).rejects.toThrow(msg);
    expect(db.query.eq).not.toHaveBeenCalledWith("provider", "openai");
  });

  it("does not silently ignore a gateway for a signed provider", async () => {
    expect(canRouteThroughGateway("bedrock")).toBe(false);
    await expect(
      streamWithProvider({
        userId: "runner-a",
        provider: "bedrock",
        modelId: "exact-model",
        messages: [],
        gateway,
      }),
    ).rejects.toThrow("cannot use the LLM Gateway");
    expect(db.from).not.toHaveBeenCalled();
  });

  it("preserves exact ID and limits on the actual native streaming adapter call", async () => {
    await streamWithProvider({
      userId: "runner-a",
      provider: "openai",
      modelId: "Qwen3.8-27B-FP8",
      messages: [{ role: "user", content: "Synthetic probe" }],
      temperature: 0.1,
      maxTokens: 64,
      gateway,
    });
    expect(adapter).toHaveBeenCalledWith(
      expect.objectContaining({
        ...gateway,
        modelId: "Qwen3.8-27B-FP8",
        temperature: 0.1,
        maxTokens: 64,
      }),
    );
    expect(db.from).not.toHaveBeenCalled();
  });
});
