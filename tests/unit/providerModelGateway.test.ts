import { AuthApiError } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), transport: vi.fn(), fetch: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { auth: { getUser: mocks.getUser } },
}));
vi.mock("@/utils/providers/credentials.server", () => ({
  resolveOpenAICompatTransport: mocks.transport,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: () => ({
      handler: <T>(handler: T) => handler,
    }),
  }),
}));
import { listProviderModels } from "@/utils/providerModels.functions";

const request = {
  data: { access_token: "synthetic-session", provider: "openai", routeThroughGateway: true },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "caller-a" } }, error: null });
  mocks.transport.mockResolvedValue({
    endpointUrl: "https://mock.invalid/v2/chat/completions",
    apiKey: "synthetic-test-key",
  });
  mocks.fetch.mockResolvedValue(Response.json({ data: [] }));
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("effective model discovery (MOCK, not an LLMHub live response)", () => {
  it("uses the authenticated caller and selected route for /v2/models", async () => {
    await listProviderModels(request);
    expect(mocks.transport).toHaveBeenCalledWith({
      userId: "caller-a",
      provider: "openai",
      routeThroughGateway: true,
    });
    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://mock.invalid/v2/models",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("preserves a configured /v2/coding base instead of guessing another version", async () => {
    mocks.transport.mockResolvedValue({
      endpointUrl: "https://mock.invalid/v2/coding/chat/completions",
      apiKey: "synthetic-test-key",
    });
    await listProviderModels(request);
    expect(mocks.fetch.mock.calls[0][0]).toBe("https://mock.invalid/v2/coding/models");
  });

  it("preserves exact IDs/context and distinguishes multimodal LLMs from embeddings", async () => {
    mocks.fetch.mockResolvedValue(
      Response.json({
        data: [
          { id: "GLM-5.2", type: "LLM", context_length: 1000000 },
          {
            id: "Qwen3.8-27B-FP8",
            type: "LLM",
            architecture: { modality: "text+image->text" },
            context_length: 262144,
          },
          { id: "jina-embeddings-v2-base-de", type: "EMBEDDING" },
          { id: "opaque-vector-id", type: "embedding" },
          { id: "GLM-5.2" },
        ],
      }),
    );
    expect(await listProviderModels(request)).toEqual({
      ok: true,
      models: [
        { id: "GLM-5.2", name: null, free: undefined, context: 1000000 },
        { id: "Qwen3.8-27B-FP8", name: null, free: undefined, context: 262144 },
      ],
    });
  });

  it("retains the default route for existing callers", async () => {
    await listProviderModels({ data: { access_token: "synthetic-session", provider: "gemini" } });
    expect(mocks.transport).toHaveBeenCalledWith(
      expect.objectContaining({ routeThroughGateway: false }),
    );
  });

  it("never resolves a transport for an unauthenticated caller", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("invalid session", 401, "bad_jwt"),
    });
    expect(await listProviderModels(request)).toEqual({ ok: false, error: "Unauthorized" });
    expect(mocks.transport).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([401, 404, 429, 500])("surfaces HTTP %i without fallback", async (status) => {
    mocks.fetch.mockResolvedValue(new Response("mock error", { status }));
    expect(await listProviderModels(request)).toEqual({
      ok: false,
      error: `The models endpoint returned ${status}`,
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it("surfaces invalid catalogue structure instead of success-shaped empty models", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ message: "not a catalogue" }));
    expect(await listProviderModels(request)).toEqual({
      ok: false,
      error: "The models endpoint returned an invalid catalogue.",
    });
  });

  it("does not expose a malformed upstream response body in a discovery error", async () => {
    mocks.fetch.mockResolvedValue(new Response("synthetic-private-upstream-body"));
    expect(await listProviderModels(request)).toEqual({
      ok: false,
      error: "The models endpoint returned an invalid catalogue.",
    });
  });

  it("times out body reads too, with no alternative endpoint", async () => {
    vi.useFakeTimers();
    mocks.fetch.mockImplementation(async (_url: string, opts: RequestInit) => ({
      ok: true,
      text: () =>
        new Promise((_resolve, reject) =>
          opts.signal?.addEventListener("abort", () => reject(new Error("mock discovery timeout"))),
        ),
    }));
    const result = listProviderModels(request);
    await vi.advanceTimersByTimeAsync(12000);
    expect(await result).toEqual({ ok: false, error: "mock discovery timeout" });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
