import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildCaseBoundIntakeGraph } from "../../axtn/swarms/axtn-document-intake/graph.mjs";
import { DocumentWorkRequest } from "@/axtn/workbenches/documents/documentWorkContract";
import { documentRegistrationAck } from "@/axtn/workbenches/documents/documentRegistrationAck";

function runNode(name: string, vars: Record<string, string>) {
  const code = readFileSync(`axtn/swarms/axtn-document-intake/nodes/${name}.js`, "utf8");
  const execute = new Function("ctx", code) as (ctx: { vars: Record<string, string> }) => string;
  return JSON.parse(execute({ vars }));
}
const ingress = {
  business_request_id: "business-request-01",
  delivery_id: "delivery-01",
  source_revision: '"provider-etag:0001"',
  source_identity: {},
  technical: { original_sha256: "a".repeat(64) },
  transport: {},
  document_text: "LEAKAGE_MARKER_DO_NOT_PERSIST",
};
const envelope = {
  table_name: "axtn_document_registry",
  key_column: "source_ref",
  key_value: "drive:opaque-file",
  row: { source_type: "google_drive", privacy_status: "NO_AI" },
  generate_columns: { document_id: "hex24" },
};
const work = {
  case_id: "11111111-1111-4111-8111-111111111111",
  document_id: "0f1e2d3c4b5a69788796a5b4",
  source_kind: "document_work",
  case_type: "DOCUMENT_PROCESSING",
  status: "NEW",
  input_hash: "b".repeat(64),
  document_input: { sourceRef: envelope.key_value },
};

describe("native Case-bound Intake composition", () => {
  it("represents Case ensure before Registry as explicit native nodes/edges", () => {
    const graph = buildCaseBoundIntakeGraph();
    expect(graph.nodes).toHaveLength(8);
    expect(graph.nodes.find((node) => node.id === "intake_case")?.data).toMatchObject({
      kind: "tool",
      toolId: "case_work",
      toolArgs: { request: "{{intake_work_request}}" },
    });
    const visited: string[] = [];
    let current = "intake_in";
    while (!visited.includes(current)) {
      visited.push(current);
      const outgoing = graph.edges.filter((edge) => edge.source === current);
      if (!outgoing.length) break;
      expect(outgoing).toHaveLength(1);
      current = outgoing[0].target;
    }
    expect(visited).toEqual(graph.nodes.map((node) => node.id));
    expect(visited.indexOf("intake_case")).toBeLessThan(visited.indexOf("intake_register"));
    expect(
      graph.nodes.some((node) =>
        ["agent", "approval", "subswarm"].includes(String(node.data.kind)),
      ),
    ).toBe(false);
  });
  it("passes only technical manifest fields to native Case, never document content", () => {
    const request = runNode("work-request", {
      ingress: JSON.stringify(ingress),
      envelope: JSON.stringify(envelope),
    });
    expect(DocumentWorkRequest.safeParse(request).success).toBe(true);
    expect(request.work.inputManifest.sourceRevision).toBe(ingress.source_revision);
    expect(JSON.stringify(request)).not.toContain("LEAKAGE_MARKER");
    expect(request.work.businessRequestId).toBe(ingress.business_request_id);
    expect(request.work.deliveryId).toBe(ingress.delivery_id);
  });
  it.each(["business_request_id", "delivery_id", "source_revision"])(
    "fails before a Case/source write without explicit %s",
    (field) => {
      expect(() =>
        runNode("work-request", {
          ingress: JSON.stringify({ ...ingress, [field]: undefined }),
          envelope: JSON.stringify(envelope),
        }),
      ).toThrow("DOCUMENT_SOURCE_REQUEST_DELIVERY_REVISION_REQUIRED");
    },
  );
  it("registers only the actual persisted opaque document and Intake Case", () => {
    const plan = runNode("registry-plan", {
      envelope: JSON.stringify(envelope),
      intake_case: JSON.stringify(work),
    });
    expect(plan.row).toMatchObject({ document_id: work.document_id, intake_case_id: work.case_id });
    expect(plan).not.toHaveProperty("generate_columns");
    expect(plan.immutable_columns).toEqual(["document_id", "intake_case_id"]);
    expect(() =>
      runNode("registry-plan", {
        envelope: JSON.stringify(envelope),
        intake_case: JSON.stringify({
          ...work,
          document_input: { sourceRef: "drive:another-file" },
        }),
      }),
    ).toThrow("DOCUMENT_INTAKE_CASE_BEFORE_REGISTRY_REQUIRED");
  });
});

describe("backward-compatible native Intake ACK envelope", () => {
  const ack = {
    accepted: true,
    document_id: work.document_id,
    source_ref: envelope.key_value,
    processing_status: "registered",
    processing_route: "privacy_hold",
    registry_outcome: "inserted",
    case_id: work.case_id,
    input_hash: work.input_hash,
  };
  const id = "62bbd9a0-2fb3-4241-828d-584fa76edc74";
  it("projects exact top-level ACK while output/runId remain available to callers", () => {
    const output = JSON.stringify(ack);
    const response = { output, runId: work.case_id, ...documentRegistrationAck(id, output) };
    expect(response).toMatchObject({ ...ack, output, runId: work.case_id });
    expect(response).not.toHaveProperty("next_location");
  });
  it("does not alter Development or unrelated Swarm responses", () => {
    expect(
      documentRegistrationAck("ad06e17d-460b-4b65-946a-9b5d78c6fd02", "ordinary output"),
    ).toEqual({});
  });
  it.each([
    {},
    { accepted: true },
    { ...ack, accepted: false },
    { ...ack, processing_status: "FILED" },
    { ...ack, document_text: "LEAKAGE_MARKER_DO_NOT_PERSIST" },
  ])("rejects malformed or authority-expanding ACK %j", (value) => {
    expect(() => documentRegistrationAck(id, JSON.stringify(value))).toThrow(
      "DOCUMENT_REGISTRATION_ACK_INVALID_CONTRACT",
    );
  });
});
