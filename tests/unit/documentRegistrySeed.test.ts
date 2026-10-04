import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedDocumentRegistries } from "@/axtn/workbenches/documents/documentRegistries.server";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
const owner = "11111111-1111-4111-8111-111111111111";
const result = {
  schemaVersion: "document-registry-seed-v1",
  datasets: [
    {
      name: "axtn_document_registry",
      id: "22222222-2222-4222-8222-222222222222",
      created: true,
      reconciled: true,
    },
    {
      name: "axtn_document_recognition_patterns",
      id: "33333333-3333-4333-8333-333333333333",
      created: true,
      reconciled: true,
    },
    {
      name: "axtn_document_classification_values",
      id: "44444444-4444-4444-8444-444444444444",
      created: true,
      reconciled: true,
    },
  ],
  classificationValuesInserted: 6,
};
beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: structuredClone(result), error: null });
});
describe("explicit native Document Registry seed adapter", () => {
  it("invokes only the fixed native provisioning RPC with its server-derived owner", async () => {
    expect(await seedDocumentRegistries(owner)).toEqual(result);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("axtn_seed_document_registries", {
      p_user_id: owner,
    });
  });
  it("preserves the explicit idempotent no-op result", async () => {
    const noOp = {
      ...result,
      classificationValuesInserted: 0,
      datasets: result.datasets.map((dataset) => ({
        ...dataset,
        created: false,
        reconciled: false,
      })),
    };
    rpc.mockResolvedValue({ data: noOp, error: null });
    expect(await seedDocumentRegistries(owner)).toEqual(noOp);
  });
  it("rejects invalid owner before invoking persistence", async () => {
    await expect(seedDocumentRegistries("client-asserted-owner")).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("surfaces native errors instead of fabricating success", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "DOCUMENT_REGISTRY_METADATA_INVALID" } });
    await expect(seedDocumentRegistries(owner)).rejects.toThrow(
      "DOCUMENT_REGISTRY_METADATA_INVALID",
    );
  });
  it.each([
    null,
    { ...result, schemaVersion: "unknown" },
    { ...result, classificationValuesInserted: 7 },
    { ...result, datasets: result.datasets.slice(0, 2) },
    { ...result, datasets: [result.datasets[0], result.datasets[0], result.datasets[0]] },
    {
      ...result,
      datasets: result.datasets.map((dataset) => ({ ...dataset, id: result.datasets[0].id })),
    },
    { ...result, accepted: true },
  ])("rejects incomplete or authority-expanding RPC result %j", async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(seedDocumentRegistries(owner)).rejects.toThrow();
  });
});
