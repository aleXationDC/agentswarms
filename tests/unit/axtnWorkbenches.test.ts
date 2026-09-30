import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type Manifest = {
  schema_version: string;
  id: string;
  name: string;
  version: string;
  category: string;
  routes: string[];
  navigation: { group: string; label: string };
  permissions: string[];
  tested_agentswarms_upstream_sha: string;
  axtn_base_sha: string;
  native_capabilities_consumed: string[];
  axtn_dependencies: string[];
  data_contracts: string[];
  database_migrations: string[];
  source_paths: string[];
  implementation_commits: string[];
  release_tag: string;
  portable: boolean;
  known_limitations: string[];
};

const root = resolve(import.meta.dirname, "../..");
const readJson = <T>(path: string): T => JSON.parse(readFileSync(resolve(root, path), "utf8")) as T;

describe("aXtn Workbenches registry", () => {
  it("registers the two portable workbench manifests with the common contract", () => {
    const registry = readJson<{
      schema_version: string;
      workbenches: Array<{ id: string; manifest: string }>;
    }>("axtn/workbenches/registry.json");

    expect(registry.schema_version).toBe("1.0");
    expect(registry.workbenches.map((entry) => entry.id)).toEqual([
      "axtn-reviews",
      "axtn-documents",
    ]);

    const manifests = registry.workbenches.map((entry) =>
      readJson<Manifest>(`axtn/workbenches/${entry.manifest}`),
    );
    expect(new Set(manifests.map((manifest) => manifest.id)).size).toBe(manifests.length);
    expect(new Set(manifests.map((manifest) => manifest.version)).size).toBe(1);

    for (const manifest of manifests) {
      expect(manifest.schema_version).toBe("1.0");
      expect(["admin", "operations"]).toContain(manifest.category);
      expect(manifest.routes.length).toBeGreaterThan(0);
      expect(manifest.navigation.label).toBe(manifest.name);
      expect(manifest.permissions.length).toBeGreaterThan(0);
      expect(manifest.tested_agentswarms_upstream_sha).toMatch(/^[0-9a-f]{40}$/);
      expect(manifest.axtn_base_sha).toMatch(/^[0-9a-f]{40}$/);
      expect(manifest.release_tag).toBe(`workbench/${manifest.id}/v${manifest.version}`);
      expect(manifest.portable).toBe(true);
      expect(manifest.known_limitations.length).toBeGreaterThan(0);
    }
  });
});
