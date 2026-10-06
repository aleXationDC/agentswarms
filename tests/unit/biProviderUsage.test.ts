import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "@/integrations/supabase/types";
import { llmJsonServer } from "@/utils/bi/llmJson.server";

const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  transport: vi.fn(),
  rules: vi.fn(),
}));
vi.mock("@/utils/observability/recordGatewayUsage.server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/observability/recordGatewayUsage.server")>()),
  recordGatewayCall: mocks.record,
}));
vi.mock("@/utils/providers/credentials.server", () => ({
  resolveOpenAICompatTransport: mocks.transport,
  getProviderDefaultModel: vi.fn(),
}));
vi.mock("@/utils/iam.server", () => ({
  getEffectiveModelRules: mocks.rules,
  isModelAllowed: vi.fn(() => true),
}));

const iamClient = createClient<Database>("https://synthetic.invalid", "synthetic-public-key");
const base = {
  userId: "11111111-1111-4111-8111-111111111111",
  iamClient,
  userPrompt: "Fixed synthetic declared-metric plan",
  surface: "BI Agent: Suggestions",
};
const completion = (content: string) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 26, completion_tokens: 8 },
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transport.mockResolvedValue({
    endpointUrl: "https://synthetic.invalid/v1/chat/completions",
    apiKey: "synthetic-not-a-credential",
  });
  mocks.rules.mockResolvedValue(null);
  mocks.record.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe("BI records the resolved provider and its native model, not a gateway label", () => {
  it.each([
    ["openai", "gpt-4.1-mini"],
    ["openrouter", "openai/gpt-4.1-mini"],
    ["ollama", "synthetic-model"],
  ])("preserves %s transport, model and actual usage", async (provider, model) => {
    const fetch = vi.fn().mockResolvedValue(completion('{"widgets":[]}'));
    vi.stubGlobal("fetch", fetch);
    const result = await llmJsonServer({ ...base, provider, model });
    expect(result).toEqual({ ok: true, result: { widgets: [] } });
    expect(mocks.transport).toHaveBeenCalledWith({ userId: base.userId, provider });
    expect(JSON.parse(fetch.mock.calls[0][1].body).model).toBe(model);
    expect(mocks.record).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        provider,
        model,
        tokensIn: 26,
        tokensOut: 8,
        status: "success",
      }),
    );
  });

  it("records a refused upstream call on the same actual provider", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("synthetic denial", { status: 403 })),
    );
    const result = await llmJsonServer({ ...base, provider: "openai", model: "gpt-4.1-mini" });
    expect(result.ok).toBe(false);
    expect(mocks.record).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        provider: "openai",
        model: "gpt-4.1-mini",
        status: "error",
      }),
    );
  });

  it("does not relabel a timeout as OpenRouter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("synthetic timeout", "AbortError")),
    );
    const result = await llmJsonServer({ ...base, provider: "openai", model: "gpt-4.1-mini" });
    expect(result.ok).toBe(false);
    expect(mocks.record).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        provider: "openai",
        model: "gpt-4.1-mini",
        status: "error",
      }),
    );
  });

  it("keeps JSON-repair and malformed-JSON diagnostics on the same transport", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(completion('{"type":"type":"table"}')));
    const repaired = await llmJsonServer({ ...base, provider: "openai", model: "gpt-4.1-mini" });
    expect(repaired.ok).toBe(true);
    expect(mocks.record.mock.calls).toHaveLength(2);
    for (const [record] of mocks.record.mock.calls) {
      expect(record).toMatchObject({ provider: "openai", model: "gpt-4.1-mini" });
    }
    mocks.record.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(completion("synthetic non-JSON"))),
    );
    const invalid = await llmJsonServer({ ...base, provider: "openai", model: "gpt-4.1-mini" });
    expect(invalid.ok).toBe(false);
    expect(mocks.record.mock.calls.length).toBeGreaterThan(0);
    for (const [record] of mocks.record.mock.calls) {
      expect(record).toMatchObject({ provider: "openai", model: "gpt-4.1-mini" });
    }
  });
});
