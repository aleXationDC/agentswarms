import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import inventory from "../../axtn/swarms/axtn-document-management/dependencies.json";

describe("honest native DMS recovery inventory", () => {
  it("binds authority and stable object identities without pretending deployment", () => {
    expect(inventory.requestRevision).toBe("dad9629ae1ae98465beefa63deccd6c76aa42031");
    expect(inventory.deploymentState).toBe("NOT_DEPLOYED");
    expect(inventory.objects.map((object) => object.id).filter(Boolean)).toEqual(
      expect.arrayContaining([
        "9b9ea6c2-a554-4fa7-9c40-908dad632ae7",
        "62bbd9a0-2fb3-4241-828d-584fa76edc74",
        "6dcd7938-f9fb-4254-be9e-6f9a06793f0e",
        "d0c6b64b-6a54-4db3-93ab-11be9d8d93a5",
        "54edaad4-4726-4781-ae07-5df795434837",
        "02482fe8-1970-447a-97d7-8898ab8abaae",
      ]),
    );
    expect(inventory.objects.some((object) => object.deployed === true)).toBe(false);
  });
  it("ties recovered source and the candidate migration to their exact bytes", () => {
    for (const object of inventory.objects) {
      if (!object.source || !object.sourceSHA256) continue;
      expect(createHash("sha256").update(readFileSync(object.source)).digest("hex")).toBe(
        object.sourceSHA256,
      );
    }
  });
  it("keeps historical Agents unrecovered and tracks the separately approved version", () => {
    expect(inventory.approvedReconstructionV1).toMatchObject({
      decisionRevision: "801b96c30b62da7c34374b8cd205af324191313a",
      historicalAgentPayloadsRecovered: false,
      independentAcceptance: "PENDING",
    });
    for (const name of ["triage", "processing"]) {
      expect(inventory.objects.find((object) => object.name === name)).toMatchObject({
        recovered: false,
        proposed: false,
        implemented: false,
        deployed: false,
        runtimeVerified: false,
        gap: expect.any(String),
      });
    }
    for (const name of [
      "stage1-triage-reconstruction-v1",
      "stage2-processing-reconstruction-v1",
      "dms-skills-reconstruction-v1",
      "dms-knowledge-base-reconstruction-v1",
    ]) {
      expect(inventory.objects.find((object) => object.name === name)).toMatchObject({
        recovered: false,
        approved: true,
        deployed: false,
        runtimeVerified: false,
      });
    }
    const recoveredNames = new Set(inventory.objects.map((object) => object.name));
    for (const object of inventory.objects) {
      for (const dependency of object.dependencies ?? []) {
        expect(recoveredNames.has(dependency)).toBe(true);
      }
    }
  });
});
