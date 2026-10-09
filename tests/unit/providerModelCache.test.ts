import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn(), list: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: mocks.session } },
}));
vi.mock("@/utils/providerModels.functions", () => ({ listProviderModels: mocks.list }));
import { invalidateProviderModels, loadProviderModels } from "@/hooks/use-provider-models";

beforeEach(() => {
  vi.clearAllMocks();
  invalidateProviderModels();
  mocks.session.mockResolvedValue({
    data: { session: { user: { id: "caller-a" }, access_token: "mock" } },
  });
  mocks.list.mockResolvedValue({ ok: true, models: [{ id: "model-a", name: null }] });
});
afterEach(() => vi.unstubAllGlobals());

describe("model cache identity and error boundaries (MOCK)", () => {
  it("deduplicates only within the same provider, route and caller", async () => {
    await loadProviderModels("openai");
    await loadProviderModels("openai");
    expect(mocks.list).toHaveBeenCalledTimes(1);
    await loadProviderModels("openai", { routeThroughGateway: true });
    expect(mocks.list).toHaveBeenCalledTimes(2);
    mocks.session.mockResolvedValue({
      data: { session: { user: { id: "caller-b" }, access_token: "mock-b" } },
    });
    await loadProviderModels("openai", { routeThroughGateway: true });
    expect(mocks.list).toHaveBeenCalledTimes(3);
  });

  it("does not cache failures as a successful empty catalogue", async () => {
    mocks.list.mockResolvedValueOnce({ ok: false, error: "HTTP 401" });
    await expect(loadProviderModels("openai")).rejects.toThrow("HTTP 401");
    expect(await loadProviderModels("openai")).toEqual([{ id: "model-a", name: null }]);
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it("invalidates both default and gateway catalogues", async () => {
    await loadProviderModels("openai");
    await loadProviderModels("openai", { routeThroughGateway: true });
    invalidateProviderModels("openai");
    await loadProviderModels("openai");
    await loadProviderModels("openai", { routeThroughGateway: true });
    expect(mocks.list).toHaveBeenCalledTimes(4);
  });
});
