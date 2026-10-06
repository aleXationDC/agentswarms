import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNativeDevelopmentAgents } from "@/lib/axtnDevelopmentAgents";
import { createNativeDevelopmentSwarm } from "@/lib/axtnDevelopmentSwarm";
import { toSnapshot } from "@/lib/agentVersions";

const fixture = vi.hoisted(() => ({
  owner: "11111111-1111-4111-8111-111111111111",
  agents: {} as Record<string, Record<string, unknown>>,
  memories: {} as Record<string, Record<string, unknown>>,
  versions: {} as Record<string, Record<string, unknown>[]>,
  swarm: null as Record<string, unknown> | null,
  writes: 0,
  publishCalls: 0,
  corruptReadback: false,
}));
vi.mock("@supabase/supabase-js", () => {
  type Result = { data: Record<string, unknown> | Record<string, unknown>[] | null; error: null };
  type Query = {
    select: (...args: unknown[]) => Query;
    eq: (key: string, value: unknown) => Query;
    order: (...args: unknown[]) => Query;
    update: (values: Record<string, unknown>) => Query;
    insert: (values: Record<string, unknown>) => Promise<{ error: null }>;
    maybeSingle: () => Promise<Result>;
    single: () => Promise<Result>;
    then: (
      resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise<unknown>;
  };
  const reordered = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(reordered);
    if (value && typeof value === "object")
      return Object.fromEntries(
        Object.entries(value)
          .reverse()
          .map(([key, item]) => [key, reordered(item)]),
      );
    return value;
  };
  return {
    createClient: () => ({
      auth: {
        signInWithPassword: async () => ({
          data: {
            user: { id: fixture.owner },
            session: { access_token: "owner-session" },
          },
          error: null,
        }),
      },
      from: (table: string) => {
        const filters: [string, unknown][] = [];
        let updateValues: Record<string, unknown> | null = null;
        const matches = (row: Record<string, unknown> | null) =>
          Boolean(row && filters.every(([key, value]) => row[key] === value));
        const query: Query = {
          select: () => query,
          eq: (key: string, value: unknown) => {
            filters.push([key, value]);
            return query;
          },
          order: () => query,
          update: (values: Record<string, unknown>) => {
            updateValues = values;
            return query;
          },
          insert: async (values: Record<string, unknown>) => {
            fixture.writes++;
            if (table === "swarms") {
              fixture.swarm = {
                ...(reordered(values) as Record<string, unknown>),
                updated_at: "updated-1",
                published_nodes: null,
                published_edges: null,
                published_at: null,
                published_version_id: null,
              };
            }
            return { error: null };
          },
          maybeSingle: async () => {
            if (table === "swarms") {
              if (updateValues && matches(fixture.swarm)) {
                fixture.writes++;
                fixture.swarm = {
                  ...fixture.swarm,
                  ...(reordered(updateValues) as Record<string, unknown>),
                  updated_at: "updated-2",
                };
                return { data: { id: fixture.swarm.id }, error: null };
              }
              return { data: matches(fixture.swarm) ? fixture.swarm : null, error: null };
            }
            const id = filters.find(([key]) => key === "id" || key === "agent_id")?.[1];
            if (table === "agents")
              return { data: fixture.agents[String(id)] ?? null, error: null };
            if (table === "agent_memory_config")
              return { data: fixture.memories[String(id)] ?? null, error: null };
            return { data: null, error: null };
          },
          single: async () => ({
            data:
              fixture.corruptReadback && fixture.swarm
                ? { ...fixture.swarm, published_nodes: [] }
                : fixture.swarm,
            error: null,
          }),
          then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
            const id = filters.find(([key]) => key === "agent_id")?.[1];
            const data = table === "agent_versions" ? (fixture.versions[String(id)] ?? []) : [];
            return Promise.resolve({ data, error: null }).then(resolve, reject);
          },
        };
        return query;
      },
    }),
  };
});

vi.mock("../../src/utils/swarmDeploy/operations.server.ts", () => ({
  publishSwarm: async (_accessToken: string, _swarmId: string) => {
    fixture.publishCalls++;
    if (!fixture.swarm) return { ok: false, error: "Swarm not found" };
    fixture.swarm = {
      ...fixture.swarm,
      published_nodes: fixture.swarm.nodes,
      published_edges: fixture.swarm.edges,
      published_at: "2026-10-06T00:00:00Z",
      published_version_id: "published-version-1",
    };
    return { ok: true, published_at: String(fixture.swarm.published_at) };
  },
}));

const config = {
  provider: "openai",
  model: "gpt-4.1-mini",
  reviewerGroupIds: ["22222222-2222-4222-8222-222222222222"],
};

beforeEach(() => {
  fixture.agents = {};
  fixture.memories = {};
  fixture.versions = {};
  fixture.swarm = null;
  fixture.writes = 0;
  fixture.publishCalls = 0;
  fixture.corruptReadback = false;
  for (const { role, agent, memory } of createNativeDevelopmentAgents(config)) {
    fixture.agents[agent.id] = { ...agent, user_id: fixture.owner };
    fixture.memories[agent.id] = memory;
    fixture.versions[agent.id] = [
      {
        id: `agent-version-${role}`,
        config: toSnapshot({ ...agent }),
        created_at: "2026-10-06T00:00:00Z",
      },
    ];
  }
  vi.stubEnv("SUPABASE_URL", "https://seed.invalid");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable");
  vi.stubEnv("ADMIN_EMAIL", "seed@example.invalid");
  vi.stubEnv("ADMIN_PASSWORD", "test-owner-password");
  vi.stubEnv("AXTN_DEVELOPMENT_REVIEWER_GROUPS", config.reviewerGroupIds.join(","));
  vi.stubEnv("AXTN_DEVELOPMENT_REVIEWER_USERS", "");
  vi.stubEnv("AXTN_DEVELOPMENT_PROVIDER", config.provider);
  vi.stubEnv("AXTN_DEVELOPMENT_MODEL", config.model);
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

describe("native Development saved-Agent publication", () => {
  it("publishes four exact saved Agent snapshots through the native version lifecycle", async () => {
    await apply();
    expect(fixture.publishCalls).toBe(1);
    expect(fixture.swarm?.published_nodes).toHaveLength(31);
    const builder = (
      fixture.swarm?.published_nodes as Array<{ id: string; data: Record<string, unknown> }>
    ).find((node) => node.id === "builder");
    expect(builder?.data).toMatchObject({
      agentId: null,
      agentSnapshot: {
        agentId: "306c6741-09aa-46e8-965e-e89a1f6b9254",
        versionId: "agent-version-builder",
      },
    });
    expect(fixture.swarm?.published_version_id).toBe("published-version-1");
    expect(console.log).toHaveBeenLastCalledWith(
      expect.stringContaining('"savedAgentSnapshots":4'),
    );
    expect(console.log).toHaveBeenLastCalledWith(expect.stringContaining('"outcome":"PUBLISHED"'));
  });

  it("reapplies idempotently without republishing the exact versioned snapshot", async () => {
    await apply();
    const publishedAt = fixture.swarm?.published_at;
    await apply();
    expect(fixture.publishCalls).toBe(1);
    expect(fixture.swarm?.published_at).toBe(publishedAt);
    expect(console.log).toHaveBeenLastCalledWith(expect.stringContaining('"outcome":"UNCHANGED"'));
  });

  it("upgrades the known legacy native graph without overwriting unrelated changes", async () => {
    const baseline = createNativeDevelopmentSwarm(config);
    fixture.swarm = {
      id: "ad06e17d-460b-4b65-946a-9b5d78c6fd02",
      user_id: fixture.owner,
      name: "aXtn Development Swarm - Native V1",
      description:
        "Native Builder / three Breakers / deterministic Verify / independent SupaCase Approval / bounded PR_READY.",
      nodes: baseline.nodes,
      edges: baseline.edges,
      published_nodes: baseline.nodes,
      published_edges: baseline.edges,
      published_at: "2026-10-05T00:00:00Z",
      published_version_id: null,
      updated_at: "legacy-update",
    };
    await apply();
    expect(fixture.publishCalls).toBe(1);
    const builder = (
      fixture.swarm?.nodes as Array<{ id: string; data: Record<string, unknown> }>
    ).find((node) => node.id === "builder");
    expect(builder?.data.agentSnapshot).toBeDefined();
    expect(fixture.swarm?.description).toContain("not general Development");
  });

  it("rejects missing or drifted Agent configuration/version before publication", async () => {
    const builderId = "306c6741-09aa-46e8-965e-e89a1f6b9254";
    fixture.agents[builderId].system_prompt = "operator edit";
    await expect(apply()).rejects.toThrow("Saved native Development Agent config drift: builder");
    expect(fixture.publishCalls).toBe(0);
  });

  it("rejects corrupted native publication readback", async () => {
    fixture.corruptReadback = true;
    await expect(apply()).rejects.toThrow(
      "Native Development versioned publication readback failed",
    );
  });
});
