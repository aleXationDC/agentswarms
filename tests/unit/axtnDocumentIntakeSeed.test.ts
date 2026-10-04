import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import path from "node:path";

import {
  buildIntakeGraph,
  SWARM_ID,
  SWARM_NAME,
  buildCaseBoundIntakeGraph,
} from "../../axtn/swarms/axtn-document-intake/graph.mjs";
import {
  applyDocumentIntake,
  seedDocumentIntake,
  seedDocumentCaseIntake,
} from "../../axtn/swarms/axtn-document-intake/seed-contract.mjs";

function emptyStore() {
  const rows = new Map<string, Record<string, unknown>>();
  const operations: string[] = [];
  return {
    rows,
    operations,
    async get(id: string) {
      return rows.get(id) ?? null;
    },
    async insert(row: Record<string, unknown>) {
      if (rows.has(String(row.id))) {
        throw Object.assign(new Error("duplicate swarm id"), { code: "23505" });
      }
      const created = {
        ...row,
        published_nodes: null,
        published_edges: null,
      };
      rows.set(String(row.id), created);
      operations.push("insert");
      return created;
    },
    async updateDraft(id: string, nodes: unknown, edges?: unknown) {
      const row = rows.get(id);
      if (!row) throw new Error("missing swarm");
      row.nodes = nodes;
      if (edges) row.edges = edges;
      operations.push("update-draft");
    },
    async publish(id: string, userId: string) {
      const row = rows.get(id);
      if (!row || row.user_id !== userId) throw new Error("native publish owner mismatch");
      row.published_nodes = structuredClone(row.nodes);
      row.published_edges = structuredClone(row.edges);
      operations.push("native-publish");
    },
  };
}

describe("fresh Document Intake install", () => {
  it("loads versioned node bodies from the app root, not the relocated server bundle", () => {
    const graph = readFileSync("axtn/swarms/axtn-document-intake/graph.mjs", "utf8");
    expect(graph).toContain('resolve("axtn/swarms/axtn-document-intake/nodes", name)');
    expect(graph).not.toContain("import.meta.url");
  });

  it("creates on an empty database, then runs apply.mjs idempotently", async () => {
    const store = emptyStore();
    const publish = store.publish.bind(store);
    const userId = "bootstrap-superadmin";
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString();
      response.setHeader("Content-Type", "application/json");
      if (request.url?.startsWith("/auth/v1/token")) {
        response.end(JSON.stringify({ access_token: "test-access-token" }));
        return;
      }
      if (request.url === "/api/axtn/document-intake") {
        const { action } = JSON.parse(body) as { action: string };
        const result =
          action === "seed"
            ? await seedDocumentIntake({ userId, store, publish })
            : action === "seed_case"
              ? await seedDocumentCaseIntake({ userId, store, publish })
              : await applyDocumentIntake({ userId, store, publish });
        response.end(JSON.stringify(result));
        return;
      }
      response.statusCode = 404;
      response.end(JSON.stringify({ error: "not found" }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const script = (name: string) =>
      path.resolve(process.cwd(), "axtn/swarms/axtn-document-intake", name);
    const run = (name: string) =>
      new Promise<{ status: number | null; output: string }>((resolve, reject) => {
        const child = spawn(process.execPath, [script(name)], {
          env: {
            PATH: process.env.PATH,
            SUPABASE_URL: baseUrl,
            SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
            ADMIN_EMAIL: "admin@example.test",
            ADMIN_PASSWORD: "test-password",
            AXTN_AGENTSWARMS_BOOTSTRAP_URL: baseUrl,
          },
        });
        let output = "";
        child.stdout.setEncoding("utf8").on("data", (chunk) => (output += chunk));
        child.stderr.setEncoding("utf8").on("data", (chunk) => (output += chunk));
        child.on("error", reject);
        child.on("close", (status) => resolve({ status, output }));
      });
    try {
      expect(store.rows.size).toBe(0);
      const seedResult = await run("seed.mjs");
      expect(seedResult.status, seedResult.output).toBe(0);
      const row = store.rows.get(SWARM_ID)!;
      expect(row.name).toBe(SWARM_NAME);
      expect(row.user_id).toBe(userId);
      expect(row.nodes).toEqual(buildIntakeGraph().nodes);
      expect(row.edges).toEqual(buildIntakeGraph().edges);
      expect(row.published_nodes).toEqual(row.nodes);
      expect(row.published_edges).toEqual(row.edges);
      expect(store.operations).toEqual(["insert", "native-publish"]);

      const firstApply = await run("apply.mjs");
      expect(firstApply.status, firstApply.output).toBe(0);
      const secondApply = await run("apply.mjs");
      expect(secondApply.status, secondApply.output).toBe(0);
      const caseSeed = await run("seed-case.mjs");
      expect(caseSeed.status, caseSeed.output).toBe(0);
      expect(row.nodes).toEqual(buildCaseBoundIntakeGraph().nodes);
      expect(row.edges).toEqual(buildCaseBoundIntakeGraph().edges);
      expect(row.published_nodes).toEqual(row.nodes);
      expect((await run("apply.mjs")).status).toBe(0);
      expect((await run("seed-case.mjs")).status).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    expect(store.operations).toEqual([
      "insert",
      "native-publish",
      "update-draft",
      "native-publish",
    ]);
  });

  it("refuses to overwrite a seed owned by another account", async () => {
    const store = emptyStore();
    const publish = store.publish.bind(store);
    await seedDocumentIntake({ userId: "owner-a", store, publish });

    await expect(applyDocumentIntake({ userId: "owner-b", store, publish })).rejects.toThrow(
      "identity or owner differs",
    );
  });

  it("publishes a changed draft only through the native publisher", async () => {
    const store = emptyStore();
    const publish = store.publish.bind(store);
    const userId = "bootstrap-superadmin";
    await seedDocumentIntake({ userId, store, publish });

    const row = store.rows.get(SWARM_ID)!;
    const nodes = structuredClone(row.nodes) as Array<{
      id: string;
      data: Record<string, unknown>;
    }>;
    nodes.find((node) => node.id === "intake_ack")!.data.functionCode = "stale";
    row.nodes = nodes;

    expect(await applyDocumentIntake({ userId, store, publish })).toEqual({
      changed: true,
      published: true,
    });
    expect(row.published_nodes).toEqual(row.nodes);
    expect(store.operations).toEqual([
      "insert",
      "native-publish",
      "update-draft",
      "native-publish",
    ]);
  });
});
