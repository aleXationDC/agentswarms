import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  row: null as Record<string, unknown> | null,
  writes: 0,
  corruptReadback: false,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: async () => ({
        data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
        error: null,
      }),
    },
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: fixture.row, error: null }),
        single: async () => ({
          data: fixture.corruptReadback ? { ...fixture.row, published_nodes: [] } : fixture.row,
          error: null,
        }),
        upsert: async (row: Record<string, unknown>) => {
          fixture.writes++;
          // PostgreSQL JSONB reorders nested object keys, not array entries.
          const reorder = (value: unknown): unknown => {
            if (Array.isArray(value)) return value.map(reorder);
            if (value && typeof value === "object")
              return Object.fromEntries(
                Object.entries(value)
                  .reverse()
                  .map(([key, item]) => [key, reorder(item)]),
              );
            return value;
          };
          fixture.row = reorder(row) as Record<string, unknown>;
          return { error: null };
        },
      };
      return query;
    },
  }),
}));

beforeEach(() => {
  fixture.row = null;
  fixture.writes = 0;
  fixture.corruptReadback = false;
  vi.stubEnv("SUPABASE_URL", "https://seed.invalid");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable");
  vi.stubEnv("ADMIN_EMAIL", "seed@example.invalid");
  vi.stubEnv("ADMIN_PASSWORD", "test-owner-password");
  vi.stubEnv("AXTN_DEVELOPMENT_REVIEWER_GROUPS", "22222222-2222-4222-8222-222222222222");
  vi.stubEnv("AXTN_DEVELOPMENT_REVIEWER_USERS", "");
  vi.stubEnv("AXTN_DEVELOPMENT_PROVIDER", "openai");
  vi.stubEnv("AXTN_DEVELOPMENT_MODEL", "gpt-4.1-mini");
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
async function apply() {
  vi.resetModules();
  await import("../../axtn/swarms/axtn-development/apply.mts");
}

describe("native Development seed publication", () => {
  it("publishes into an empty native store and verifies JSONB-reordered readback", async () => {
    await apply();
    expect(fixture.writes).toBe(1);
    expect(fixture.row?.published_nodes).toHaveLength(30);
    expect(console.log).toHaveBeenLastCalledWith(expect.stringContaining('"outcome":"PUBLISHED"'));
  });
  it("applies twice without republishing or changing publication time", async () => {
    await apply();
    const publishedAt = fixture.row?.published_at;
    await apply();
    expect(fixture.writes).toBe(1);
    expect(fixture.row?.published_at).toBe(publishedAt);
    expect(console.log).toHaveBeenLastCalledWith(expect.stringContaining('"outcome":"UNCHANGED"'));
  });
  it("rejects changed publication readback rather than reporting success", async () => {
    fixture.corruptReadback = true;
    await expect(apply()).rejects.toThrow("Native publication readback failed");
  });
});
