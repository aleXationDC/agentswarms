import { beforeEach, describe, expect, it, vi } from "vitest";
import { documentInputHash } from "@/axtn/workbenches/documents/documentWork.server";
import { readDocumentParentRegistrationAck } from "@/axtn/workbenches/documents/documentRegistrationAck.server";
import {
  minimizeDocumentIngress,
  minimizeDocumentRegistrationAck,
} from "@/axtn/workbenches/documents/documentPersistence.server";
import type { SwarmCheckpoint } from "@/lib/swarmCheckpoint";

const state = vi.hoisted(() => ({
  run: null as unknown,
  work: null as unknown,
  registry: null as unknown,
  firstWork: null as unknown,
  checkpoint: null as SwarmCheckpoint | null,
  missingDataset: "",
  failTable: "",
  throwTable: "",
  queries: [] as { table: string; filters: Record<string, unknown> }[],
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      const query = { table, filters: {} as Record<string, unknown> };
      state.queries.push(query);
      const chain = {
        select() {
          return chain;
        },
        eq(key: string, value: unknown) {
          query.filters[key] = value;
          return chain;
        },
        async maybeSingle() {
          if (table === state.throwTable) throw new Error("ORIGINAL_DATABASE_LEAKAGE_MARKER");
          let data: unknown;
          if (table === "swarm_runs") data = state.run;
          else if (table === "user_data_tables")
            data = query.filters.name === state.missingDataset ? null : { id: query.filters.name };
          else if (table === "user_data_rows")
            data =
              query.filters.table_id === "axtn_cases"
                ? query.filters["row->>case_id"] === "44444444-4444-4444-8444-444444444444"
                  ? state.firstWork && { row: state.firstWork }
                  : state.work && { row: state.work }
                : state.registry && { row: state.registry };
          else throw new Error(`Unexpected table ${table}`);
          return {
            data,
            error:
              table === state.failTable ? { message: "ORIGINAL_DATABASE_LEAKAGE_MARKER" } : null,
          };
        },
      };
      return chain;
    },
  },
}));
const load = vi.hoisted(() => vi.fn());
vi.mock("@/utils/swarmCheckpoint.server", () => ({ loadCheckpoint: load }));

const owner = "11111111-1111-4111-8111-111111111111";
const caseId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const parentId = "9b9ea6c2-a554-4fa7-9c40-908dad632ae7";
const intakeId = "62bbd9a0-2fb3-4241-828d-584fa76edc74";
const manifest = {
  sourceKind: "drive",
  sourceRef: "drive:opaque-fixture",
  sourceRevision: '"provider-revision:01"',
  contentHash: "a".repeat(64),
  privacyStatus: "NO_AI",
};
const ingress = {
  business_request_id: "request-fixture-01",
  idempotency_key: manifest.sourceRef,
  source_type: "google_drive",
  source_identity: {},
  source_revision: manifest.sourceRevision,
  privacy: { state: manifest.privacyStatus },
  technical: { original_sha256: manifest.contentHash },
  document_text: "LEAKAGE_MARKER_NOT_IN_ACK",
};
const ack = {
  accepted: true,
  document_id: "opaque-document-fixture",
  source_ref: manifest.sourceRef,
  processing_status: "registered",
  processing_route: "privacy_hold",
  registry_outcome: "inserted",
  case_id: caseId,
  input_hash: documentInputHash(manifest),
};
const snapshot = {
  nodes: [
    {
      id: "run_intake",
      data: { kind: "subswarm", subSwarmId: intakeId, outputVar: "registration_ack" },
    },
    { id: "review", data: { kind: "approval" } },
  ],
};
const run = {
  id: runId,
  status: "suspended",
  input_prompt: JSON.stringify(ingress),
  swarm_snapshot: snapshot,
};
const work = {
  case_id: caseId,
  case_type: "DOCUMENT_PROCESSING",
  source_kind: "document_work",
  document_id: ack.document_id,
  input_hash: ack.input_hash,
  document_input: manifest,
  document_work_identity: { businessRequestId: ingress.business_request_id },
};
const registration = {
  document_id: ack.document_id,
  source_ref: ack.source_ref,
  intake_case_id: caseId,
};
const read = () => readDocumentParentRegistrationAck({ userId: owner, swarmId: parentId, runId });

beforeEach(() => {
  state.run = structuredClone(run);
  state.work = structuredClone(work);
  state.registry = structuredClone(registration);
  state.firstWork = null;
  state.checkpoint = {
    ctx: { registration_ack: JSON.stringify(ack) },
    lastOutput: "awaiting independent review",
    completedNodeIds: ["run_intake"],
    skippedNodeIds: [],
    deadEdgeIds: [],
    levelIndex: 1,
    suspendedNodeId: "review",
  };
  state.queries = [];
  state.missingDataset = "";
  state.failTable = "";
  state.throwTable = "";
  load.mockReset();
  load.mockImplementation(async () => state.checkpoint);
});

describe("native Parent parked registration readback", () => {
  it("recovers the exact existing ACK from original-free owner-scoped manifests", async () => {
    state.run = { ...run, input_prompt: JSON.stringify(minimizeDocumentIngress(owner, ingress)) };
    if (!state.checkpoint) throw new Error("Fixture checkpoint required");
    state.checkpoint.ctx.registration_ack = JSON.stringify(
      minimizeDocumentRegistrationAck(owner, ack),
    );
    expect(JSON.stringify(state.run)).not.toContain("LEAKAGE_MARKER");
    expect(await read()).toEqual(ack);
    expect(await read()).toEqual(ack);
  });
  it.each(["ingress", "ack"])(
    "supports an in-place codec transition while preserving legacy native bindings %s",
    async (mode) => {
      if (mode === "ingress")
        state.run = {
          ...run,
          input_prompt: JSON.stringify(minimizeDocumentIngress(owner, ingress)),
        };
      else {
        if (!state.checkpoint) throw new Error("Fixture checkpoint required");
        state.checkpoint.ctx.registration_ack = JSON.stringify(
          minimizeDocumentRegistrationAck(owner, ack),
        );
      }
      expect(await read()).toEqual(ack);
    },
  );
  it.each([
    "owner_scope_hash",
    "business_request_hash",
    "source_ref_hash",
    "source_revision_hash",
    "input_hash",
    "content_hash",
  ])("denies forged minimized ingress binding %s", async (field) => {
    state.run = {
      ...run,
      input_prompt: JSON.stringify({
        ...minimizeDocumentIngress(owner, ingress),
        [field]: "0".repeat(64),
      }),
    };
    await expect(read()).rejects.toThrow("DOCUMENT_PARENT_REGISTRATION_MINIMIZED_BINDING_REQUIRED");
  });
  it.each(["document_id_hash", "source_ref_hash"])(
    "denies forged minimized ACK binding %s",
    async (field) => {
      if (!state.checkpoint) throw new Error("Fixture checkpoint required");
      state.checkpoint.ctx.registration_ack = JSON.stringify({
        ...minimizeDocumentRegistrationAck(owner, ack),
        [field]: "0".repeat(64),
      });
      await expect(read()).rejects.toThrow(
        "DOCUMENT_PARENT_REGISTRATION_MINIMIZED_BINDING_REQUIRED",
      );
    },
  );
  it("rejects raw extras in an explicitly minimized persisted manifest instead of downgrading", async () => {
    state.run = {
      ...run,
      input_prompt: JSON.stringify({
        ...minimizeDocumentIngress(owner, ingress),
        original: "LEAKAGE_MARKER",
      }),
    };
    await expect(read()).rejects.toThrow();
  });
  it("binds the explicit original source independently of the delivery idempotency key", async () => {
    state.run = {
      ...run,
      input_prompt: JSON.stringify({
        ...ingress,
        source_ref: manifest.sourceRef,
        idempotency_key: `${manifest.sourceRef}:attempt:7`,
      }),
    };
    expect(await read()).toEqual(ack);
  });
  it.each(["drive:other", "", null, "drive:bad\nid"])(
    "rejects conflicting or malformed explicit source %j without fallback",
    async (source_ref) => {
      state.run = { ...run, input_prompt: JSON.stringify({ ...ingress, source_ref }) };
      await expect(read()).rejects.toThrow();
    },
  );
  it("returns only the durable minimized ACK; repeated reads do not mutate or execute", async () => {
    const before = structuredClone({ run: state.run, work: state.work, registry: state.registry });
    expect(await read()).toEqual(ack);
    expect(await read()).toEqual(ack);
    expect({ run: state.run, work: state.work, registry: state.registry }).toEqual(before);
    expect(JSON.stringify(await read())).not.toContain("LEAKAGE_MARKER");
    expect(load).toHaveBeenCalledWith(runId, owner, "document");
    expect(state.queries[0].filters).toEqual({
      id: runId,
      user_id: owner,
      swarm_id: parentId,
    });
    expect(
      state.queries
        .filter((query) => query.table === "user_data_tables")
        .every((query) => query.filters.user_id === owner),
    ).toBe(true);
  });
  it("does not touch unrelated Development or standalone Intake runs", async () => {
    for (const swarmId of [intakeId, "unrelated-development"]) {
      expect(
        await readDocumentParentRegistrationAck({ userId: owner, swarmId, runId: null }),
      ).toBeNull();
    }
    expect(state.queries).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });
  it.each(["running", "success", "error"])("does not claim a %s run is parked", async (status) => {
    state.run = { ...run, status };
    expect(await read()).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });
  it("requires a real owner-bound run and durable checkpoint", async () => {
    await expect(
      readDocumentParentRegistrationAck({ userId: owner, swarmId: parentId, runId: null }),
    ).rejects.toThrow("RUN_REQUIRED");
    state.run = null;
    await expect(read()).rejects.toThrow("OWNED_RUN_REQUIRED");
    state.run = run;
    state.checkpoint = null;
    await expect(read()).rejects.toThrow("CHECKPOINT_REQUIRED");
  });
  it.each(["not_completed", "skipped", "not_approval"])(
    "rejects forged context when Intake/review is %s",
    async (condition) => {
      if (!state.checkpoint) throw new Error("fixture missing");
      if (condition === "not_completed") state.checkpoint.completedNodeIds = [];
      if (condition === "skipped") state.checkpoint.skippedNodeIds = ["run_intake"];
      if (condition === "not_approval") state.checkpoint.suspendedNodeId = "run_intake";
      await expect(read()).rejects.toThrow("COMPLETED_INTAKE_REQUIRED");
    },
  );
  it.each(["wrong_child", "wrong_kind", "duplicate_writer"])(
    "requires the persisted native Intake snapshot, not %s",
    async (condition) => {
      const nodes = structuredClone(snapshot.nodes);
      if (condition === "wrong_child") nodes[0].data.subSwarmId = "another-swarm";
      if (condition === "wrong_kind") nodes[0].data.kind = "function";
      if (condition === "duplicate_writer")
        nodes.push({ id: "overwrite_ack", data: { kind: "input", outputVar: "registration_ack" } });
      state.run = { ...run, swarm_snapshot: { nodes } };
      await expect(read()).rejects.toThrow("COMPLETED_INTAKE_REQUIRED");
    },
  );
  it.each([
    { ...ack, accepted: false },
    { ...ack, case_id: undefined },
    { ...ack, input_hash: undefined },
    { ...ack, processing_status: "FILED" },
    { ...ack, document_text: "LEAKAGE_MARKER" },
  ])("rejects incomplete or authority-expanding ACK %j", async (value) => {
    if (!state.checkpoint) throw new Error("fixture missing");
    state.checkpoint.ctx.registration_ack = JSON.stringify(value);
    await expect(read()).rejects.toThrow();
  });
  it("binds the original request, exact provider revision and original byte hash", async () => {
    for (const input of [
      { ...ingress, source_revision: "another-provider-revision" },
      { ...ingress, technical: { original_sha256: "b".repeat(64) } },
      { ...ingress, idempotency_key: "drive:another-fixture" },
    ]) {
      state.run = { ...run, input_prompt: JSON.stringify(input) };
      await expect(read()).rejects.toThrow("REQUEST_BINDING_REQUIRED");
    }
    state.run = {
      ...run,
      input_prompt: JSON.stringify({ ...ingress, business_request_id: "another-request" }),
    };
    await expect(read()).rejects.toThrow("PERSISTED_BINDING_REQUIRED");
  });
  it.each(["case", "registry", "dataset"])("rejects missing owned %s persistence", async (kind) => {
    if (kind === "case") state.work = null;
    if (kind === "registry") state.registry = null;
    if (kind === "dataset") state.missingDataset = "axtn_cases";
    await expect(read()).rejects.toThrow(
      kind === "dataset" ? "OWNED_DATASET_REQUIRED" : "PERSISTED_ROWS_REQUIRED",
    );
  });
  it("rejects stale Case or mismatched Registry identity", async () => {
    state.work = { ...work, document_input: { ...manifest, sourceRevision: "changed" } };
    await expect(read()).rejects.toThrow("PERSISTED_BINDING_REQUIRED");
    state.work = work;
    state.registry = { ...registration, intake_case_id: owner };
    await expect(read()).rejects.toThrow("PERSISTED_BINDING_REQUIRED");
    state.registry = { ...registration, document_id: "another-document" };
    await expect(read()).rejects.toThrow("PERSISTED_BINDING_REQUIRED");
  });
  it("preserves the first Intake Case for another explicit request on the same document", async () => {
    const firstId = "44444444-4444-4444-8444-444444444444";
    state.registry = { ...registration, intake_case_id: firstId };
    state.firstWork = {
      ...work,
      case_id: firstId,
      document_work_identity: { businessRequestId: "earlier-request" },
    };
    expect(await read()).toEqual(ack);
    expect(state.registry).toEqual({ ...registration, intake_case_id: firstId });
    state.firstWork = { ...work, case_id: firstId, document_id: "unrelated-document" };
    await expect(read()).rejects.toThrow("PERSISTED_BINDING_REQUIRED");
  });
  it("does not turn a Drive registration into a source move instruction", async () => {
    if (!state.checkpoint) throw new Error("fixture missing");
    state.checkpoint.ctx.registration_ack = JSON.stringify({ ...ack, next_location: "Archive" });
    await expect(read()).rejects.toThrow("REQUEST_BINDING_REQUIRED");
  });
  it("retains only the existing mail transport destination", async () => {
    const mailManifest = { ...manifest, sourceKind: "mail" };
    const mailAck = {
      ...ack,
      input_hash: documentInputHash(mailManifest),
      next_location: "00_Review",
    };
    if (!state.checkpoint) throw new Error("fixture missing");
    state.checkpoint.ctx.registration_ack = JSON.stringify(mailAck);
    state.run = {
      ...run,
      input_prompt: JSON.stringify({ ...ingress, source_type: "imap" }),
    };
    state.work = { ...work, document_input: mailManifest, input_hash: mailAck.input_hash };
    expect(await read()).toEqual(mailAck);
    state.checkpoint.ctx.registration_ack = JSON.stringify({
      ...mailAck,
      next_location: "another-mailbox",
    });
    await expect(read()).rejects.toThrow("REQUEST_BINDING_REQUIRED");
  });
  it.each(["swarm_runs", "user_data_tables", "user_data_rows"])(
    "surfaces %s read errors without an accepted fallback",
    async (table) => {
      state.failTable = table;
      await expect(read()).rejects.toThrow(
        table === "swarm_runs"
          ? "DOCUMENT_PARENT_REGISTRATION_RUN_READ"
          : table === "user_data_tables"
            ? "DOCUMENT_PARENT_REGISTRATION_DATASET_READ"
            : "DOCUMENT_PARENT_REGISTRATION_ROW_READ",
      );
    },
  );
  it.each(["swarm_runs", "user_data_tables", "user_data_rows"])(
    "bounds thrown %s database exceptions instead of exporting original text",
    async (table) => {
      state.throwTable = table;
      await expect(read()).rejects.toThrow(
        table === "swarm_runs"
          ? "DOCUMENT_PARENT_REGISTRATION_RUN_READ"
          : table === "user_data_tables"
            ? "DOCUMENT_PARENT_REGISTRATION_DATASET_READ"
            : "DOCUMENT_PARENT_REGISTRATION_ROW_READ",
      );
    },
  );
});
