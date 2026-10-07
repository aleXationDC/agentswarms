import { describe, expect, it } from "vitest";

import { readManagedN8nBinding } from "@/utils/operatorBindings.server";

describe("server-managed n8n binding", () => {
  it("stays disabled unless both server variables are present", () => {
    expect(readManagedN8nBinding({})).toEqual({ ok: true, binding: null });
    expect(readManagedN8nBinding({ N8N_BASE_URL: "https://n8n.example.test" })).toMatchObject({
      ok: false,
      error: expect.stringContaining("both be configured"),
    });
    expect(readManagedN8nBinding({ N8N_API_KEY: "server-key" })).toMatchObject({
      ok: false,
      error: expect.stringContaining("both be configured"),
    });
  });

  it("normalizes the endpoint and keeps the API key in its server result", () => {
    expect(
      readManagedN8nBinding({
        N8N_BASE_URL: "https://n8n.example.test/",
        N8N_API_KEY: "server-key",
      }),
    ).toEqual({
      ok: true,
      binding: { baseUrl: "https://n8n.example.test", apiKey: "server-key" },
    });
  });

  it("rejects credentials or query data embedded in the base URL", () => {
    expect(
      readManagedN8nBinding({
        N8N_BASE_URL: "https://user:password@n8n.example.test",
        N8N_API_KEY: "server-key",
      }).ok,
    ).toBe(false);
    expect(
      readManagedN8nBinding({
        N8N_BASE_URL: "https://n8n.example.test?token=secret",
        N8N_API_KEY: "server-key",
      }).ok,
    ).toBe(false);
  });
});
