import { describe, expect, it } from "vitest";
import { buildParentGraph } from "../../axtn/swarms/axtn-document-management/graph.mjs";
import { buildCleanupGraph } from "../../axtn/swarms/axtn-blacklisted-file-cleanup/graph.mjs";

type Graph = { nodes: Array<{ id: string; data: { functionCode?: string; inputs?: string[] } }> };
function execute(graph: Graph, id: string, vars: Record<string, unknown>) {
  const code = graph.nodes.find((node) => node.id === id)?.data.functionCode;
  if (!code) throw new Error(`Missing native Function: ${id}`);
  const run = new Function("ctx", code) as (ctx: { vars: Record<string, string> }) => string;
  return JSON.parse(
    run({
      vars: Object.fromEntries(
        Object.entries(vars).map(([key, value]) => [
          key,
          typeof value === "string" ? value : JSON.stringify(value),
        ]),
      ),
    }),
  );
}
const agent = {
  id: "fixture",
  llm_provider: "fixture-only",
  llm_model: "fixture-only",
  system_prompt: "fixture-only",
  temperature: 0,
};
const parent: Graph = buildParentGraph({ triage: agent, processing: agent });
const cleanup: Graph = buildCleanupGraph();
const instruction = {
  document_id: "document-fixture",
  drive_file_id: "file-fixture",
  canonical_filename: "fixture.pdf",
  target_folder_id: "target-fixture",
  target_folder_path: "02_Areas/fixture",
};
const receipt = {
  filed: true,
  drive_file_id: instruction.drive_file_id,
  canonical_filename: instruction.canonical_filename,
  target_folder_id: instruction.target_folder_id,
  current_location: instruction.target_folder_path,
  provider: {
    id: instruction.drive_file_id,
    name: instruction.canonical_filename,
    parents: [instruction.target_folder_id],
  },
};

describe("recovered native graph safety before publication", () => {
  it("uses provider identity, exact target/name and explicit instruction instead of filed=true", () => {
    expect(
      execute(parent, "filing_result_verify", {
        filing_instruction: instruction,
        filing_result: { result: { data: [{ json: receipt }] } },
      }),
    ).toEqual(receipt);
    expect(parent.nodes.find((node) => node.id === "filing_result_verify")?.data.inputs).toContain(
      "filing_instruction",
    );
  });
  it.each([
    { filed: true },
    { ...receipt, provider: undefined },
    { ...receipt, provider: { ...receipt.provider, id: "other-file" } },
    { ...receipt, provider: { ...receipt.provider, name: "other.pdf" } },
    { ...receipt, provider: { ...receipt.provider, parents: ["other-target"] } },
    { ...receipt, provider: { ...receipt.provider, parents: ["target-fixture", "other-target"] } },
    { ...receipt, document_id: "other-document" },
    { ...receipt, current_location: "other-location" },
    { ...receipt, target_folder_id: "other-target" },
  ])("does not project FILED from incomplete/mismatched readback %j", (filing_result) => {
    expect(() =>
      execute(parent, "filing_result_verify", {
        filing_instruction: instruction,
        filing_result,
      }),
    ).toThrow("FILING_PROVIDER_READBACK_MISMATCH");
  });
  it.each([undefined, [], ["unknown"], ["file-1", "file-1"], [1]])(
    "requires a nonempty exact deletion selection, never implicit all: %j",
    (selection) => {
      expect(() =>
        execute(cleanup, "cleanup_instruction", {
          cleanup_scope: { candidates: [{ drive_file_id: "file-1" }] },
          cleanup_approval: selection === undefined ? {} : { selected_physical_ids: selection },
          cleanup_approval_id: "approval-fixture",
        }),
      ).toThrow("BLACKLIST_CLEANUP_EXPLICIT_SELECTION_REQUIRED");
    },
  );
  it("keeps only explicitly selected candidates and requires a bound approval", () => {
    const vars = {
      cleanup_scope: { candidates: [{ drive_file_id: "file-1" }, { drive_file_id: "file-2" }] },
      cleanup_approval: { selected_physical_ids: ["file-2"] },
    };
    expect(() => execute(cleanup, "cleanup_instruction", vars)).toThrow(
      "BLACKLIST_CLEANUP_APPROVAL_BINDING_REQUIRED",
    );
    expect(
      execute(cleanup, "cleanup_instruction", {
        ...vars,
        cleanup_approval_id: "approval-fixture",
      }),
    ).toMatchObject({
      selected_physical_ids: ["file-2"],
      candidates: [{ drive_file_id: "file-2" }],
      approval_id: "approval-fixture",
    });
    expect(() =>
      execute(cleanup, "cleanup_instruction", {
        ...vars,
        cleanup_approval_id: "approval-fixture",
        selected_physical_ids: "malformed",
      }),
    ).toThrow("BLACKLIST_CLEANUP_EXPLICIT_SELECTION_REQUIRED");
  });
});
