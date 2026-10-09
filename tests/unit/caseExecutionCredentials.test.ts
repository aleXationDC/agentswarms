import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  selected: null as unknown,
  reads: [] as string[],
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      fixture.reads.push(table);
      throw new Error("Unexpected legacy fallback");
    },
  },
}));
vi.mock("@/axtn/workbenches/cases/caseExecution.server", () => ({
  loadCaseCredential: async () => {
    if (fixture.selected instanceof Error) throw fixture.selected;
    return fixture.selected;
  },
}));
vi.mock("@/utils/providers/adapters/anthropic.server", () => ({
  anthropicChatStream: vi.fn(async () => new Response("synthetic-stream")),
}));
import { encryptJson, resetKeyringCache } from "@/utils/providers/crypto.server";
import { encryptIntegrationConfig } from "@/utils/providers/integrationConfig.server";
import {
  resolveOpenAICompatTransport,
  streamWithProvider,
} from "@/utils/providers/credentials.server";
import { anthropicChatStream } from "@/utils/providers/adapters/anthropic.server";
const owner = "99555555-5555-4555-8555-555555555555";
const context = {
  runId: "99444444-4444-4444-8444-444444444444",
  nodeId: "agent",
  runOwnerId: owner,
};

describe("Case server credential transport reuses actual encrypted storage without fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.reads = [];
    fixture.selected = null;
    vi.stubEnv("KMS_PROVIDER", "env");
    vi.stubEnv("PROVIDER_CREDS_SECRET", "synthetic-test-keyring-only-no-runtime-secret");
    vi.stubEnv("OPENROUTER_API_KEY", "synthetic-forbidden-operator-fallback");
    resetKeyringCache();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    resetKeyringCache();
  });
  it("decrypts the selected integration for the existing OpenAI transport, not the operator gateway/key", async () => {
    const config = await encryptIntegrationConfig("llm_provider", {
      api_key: "synthetic-personal-api-key",
      base_url: "https://fixture.invalid/v1",
    });
    expect(JSON.stringify(config)).not.toContain("synthetic-personal-api-key");
    fixture.selected = { source: "integration", row: { user_id: owner, is_active: true, config } };
    const transport = await resolveOpenAICompatTransport({
      userId: owner,
      provider: "openrouter",
      credentialContext: context,
    });
    expect(transport).toEqual({
      endpointUrl: "https://fixture.invalid/v1/chat/completions",
      apiKey: "synthetic-personal-api-key",
      extraHeaders: {},
    });
    expect(fixture.reads).toEqual([]);
  });
  it("decrypts a selected native provider credential and uses the existing adapter only", async () => {
    fixture.selected = {
      source: "provider_credential",
      row: {
        credentials: await encryptJson({ apiKey: "synthetic-selected-encrypted-key" }),
        config: {},
      },
    };
    const response = await streamWithProvider({
      userId: owner,
      provider: "anthropic",
      modelId: "synthetic-model",
      messages: [{ role: "user", content: "synthetic input" }],
      credentialContext: context,
    });
    expect(response.status).toBe(200);
    expect(anthropicChatStream).toHaveBeenCalledWith(
      expect.objectContaining({
        creds: { apiKey: "synthetic-selected-encrypted-key" },
        modelId: "synthetic-model",
      }),
    );
    expect(fixture.reads).toEqual([]);
  });
  it("rejects connection revocation or explicit gateway substitution before provider inference", async () => {
    fixture.selected = new Error("PERSONAL_CONNECTION_REAUTH_REQUIRED");
    await expect(
      resolveOpenAICompatTransport({
        userId: owner,
        provider: "openrouter",
        credentialContext: context,
      }),
    ).rejects.toThrow("PERSONAL_CONNECTION_REAUTH_REQUIRED");
    await expect(
      streamWithProvider({
        userId: owner,
        provider: "anthropic",
        modelId: "synthetic-model",
        messages: [],
        credentialContext: context,
        gateway: { baseUrl: "https://foreign.invalid", apiKey: "synthetic-foreign-key" },
      }),
    ).rejects.toThrow("ROUTING_DECISION_REQUIRED");
    expect(anthropicChatStream).not.toHaveBeenCalled();
    expect(fixture.reads).toEqual([]);
  });
  it("does not fall back to the executing user's credential when SYSTEM_INTEGRATION has no grant", async () => {
    fixture.selected = new Error("SYSTEM_INTEGRATION_UNAVAILABLE");
    await expect(
      resolveOpenAICompatTransport({
        userId: owner,
        provider: "openai",
        credentialContext: context,
      }),
    ).rejects.toThrow("SYSTEM_INTEGRATION_UNAVAILABLE");
    expect(fixture.reads).toEqual([]);
  });
  it("rejects a node gateway opt-in before resolving a Case credential or any personal integration", async () => {
    fixture.selected = new Error("Case credential must not be loaded for an unauthorized gateway");
    await expect(
      resolveOpenAICompatTransport({
        userId: owner,
        provider: "openai",
        credentialContext: context,
        routeThroughGateway: true,
      }),
    ).rejects.toThrow("ROUTING_DECISION_REQUIRED");
    expect(fixture.reads).toEqual([]);
  });
});
