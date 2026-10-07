import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => ({
  safeFetch: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

vi.mock("@/utils/ssrfGuard.server", () => ({
  safeFetch: mocks.safeFetch,
}));

import { executeNativeN8nWorkflow } from "@/utils/integrations/nativeN8n.server";

const API_KEY = "synthetic-managed-n8n-key";
let previousApiKey: string | undefined;
let previousBaseUrl: string | undefined;

beforeEach(() => {
  previousApiKey = process.env.N8N_API_KEY;
  previousBaseUrl = process.env.N8N_BASE_URL;
  process.env.N8N_API_KEY = API_KEY;
  process.env.N8N_BASE_URL = "https://n8n.tail123.ts.net";
  mocks.safeFetch.mockReset();
});

afterEach(() => {
  if (previousApiKey === undefined) delete process.env.N8N_API_KEY;
  else process.env.N8N_API_KEY = previousApiKey;
  if (previousBaseUrl === undefined) delete process.env.N8N_BASE_URL;
  else process.env.N8N_BASE_URL = previousBaseUrl;
});

describe("managed n8n workflow execution", () => {
  it("uses the API key only for metadata and redacts key echoes from webhook results", async () => {
    mocks.safeFetch
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            active: true,
            nodes: [
              {
                type: "n8n-nodes-base.webhook",
                parameters: { httpMethod: "POST", authentication: "none", path: "intake/run" },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ echoed: API_KEY }), { status: 200 }));

    const result = await executeNativeN8nWorkflow(
      "https://n8n.tail123.ts.net",
      { "X-N8N-API-KEY": API_KEY },
      "workflow-1",
      { value: 7 },
    );

    expect(mocks.safeFetch).toHaveBeenCalledTimes(2);
    expect(mocks.safeFetch.mock.calls[0][1].headers).toMatchObject({
      "X-N8N-API-KEY": API_KEY,
    });
    expect(mocks.safeFetch.mock.calls[1][0]).toBe("https://n8n.tail123.ts.net/webhook/intake/run");
    expect(mocks.safeFetch.mock.calls[1][1].headers).not.toHaveProperty("X-N8N-API-KEY");
    expect(JSON.parse(result)).toEqual({ ok: true, result: { echoed: "[redacted]" } });
  });

  it("does not execute a workflow without the approved active webhook shape", async () => {
    mocks.safeFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          active: false,
          nodes: [
            {
              type: "n8n-nodes-base.webhook",
              parameters: { httpMethod: "POST", authentication: "none", path: "intake/run" },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await executeNativeN8nWorkflow(
      "https://n8n.tail123.ts.net",
      { "X-N8N-API-KEY": API_KEY },
      "workflow-1",
      {},
    );

    expect(mocks.safeFetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(result)).toMatchObject({
      error: expect.stringContaining("active workflow"),
    });
  });

  it("does not reuse the managed API key for a separate agent webhook URL", () => {
    const chat = readFileSync("src/routes/api/chat.ts", "utf8");
    expect(chat).toContain('n8nConfig.binding_mode !== "native"');
    expect(chat).toContain("Never reuse it as a bearer token for an agent-supplied webhook URL.");
  });
});
