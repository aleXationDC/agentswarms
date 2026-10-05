import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServerSwarmTracer } from "@/utils/observability/serverTracer.server";
import { DOCUMENT_MANAGEMENT_SWARM_ID } from "@/axtn/workbenches/documents/documentRegistrationAck";
import {
  DocumentMinimizedIngress,
  documentStoredIngress,
} from "@/axtn/workbenches/documents/documentPersistence.server";

const state = vi.hoisted(() => ({
  writes: [] as {
    table: string;
    action: string;
    value: Record<string, unknown>;
    filters: Record<string, unknown>;
  }[],
  insertFailed: false,
  resumeFound: true,
}));
const runId = "33333333-3333-4333-8333-333333333333";
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const chain = {
        insert(value: Record<string, unknown>) {
          state.writes.push({ table, action: "insert", value, filters });
          return chain;
        },
        update(value: Record<string, unknown>) {
          state.writes.push({ table, action: "update", value, filters });
          return chain;
        },
        eq(key: string, value: unknown) {
          filters[key] = value;
          return chain;
        },
        select() {
          return chain;
        },
        async single() {
          return {
            data: state.insertFailed ? null : { id: runId },
            error: state.insertFailed
              ? { message: "ORIGINAL_DATABASE_ERROR_LEAKAGE_MARKER" }
              : null,
          };
        },
        async maybeSingle() {
          return { data: state.resumeFound ? { id: runId } : null, error: null };
        },
        then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
          return Promise.resolve({ data: [], error: null }).then(resolve);
        },
      };
      return chain;
    },
  },
}));
const owner = "11111111-1111-4111-8111-111111111111";
const input = JSON.stringify({
  business_request_id: "request-fixture",
  idempotency_key: "delivery-fixture",
  source_type: "fixture",
  source_ref: "fixture:source",
  source_revision: "v1",
  source_identity: {},
  technical: { original_sha256: "a".repeat(64) },
  privacy: "NO_AI",
  original: "ORIGINAL_DOCUMENT_LEAKAGE_MARKER",
});
const opts = {
  userId: owner,
  swarmId: DOCUMENT_MANAGEMENT_SWARM_ID,
  inputPrompt: input,
  swarmName: "Document Management",
  swarmSnapshot: { nodes: [], edges: [] },
};
beforeEach(() => {
  state.writes = [];
  state.insertFailed = false;
  state.resumeFound = true;
  vi.stubEnv("PERSIST_PROMPT_BODIES", "true");
});
afterEach(() => vi.unstubAllEnvs());
describe("actual native headless DMS Parent ingress trace writer", () => {
  it("stores minimized original-free ingress while returning the same native run identity", async () => {
    const tracer = await createServerSwarmTracer(opts);
    expect(tracer?.runId).toBe(runId);
    const row = state.writes[0].value;
    expect(JSON.stringify(row)).not.toContain("LEAKAGE_MARKER");
    expect(typeof row.input_prompt).toBe("string");
    expect(
      DocumentMinimizedIngress.parse(JSON.parse(String(row.input_prompt))).privacy_status,
    ).toBe("NO_AI");
    expect(row.swarm_snapshot).toEqual(opts.swarmSnapshot);
  });
  it("keeps safe technical metadata for ACK recovery even when free-body storage is disabled", async () => {
    vi.stubEnv("PERSIST_PROMPT_BODIES", "false");
    await createServerSwarmTracer(opts);
    expect(state.writes[0].value.input_prompt).toBe(documentStoredIngress(owner, input));
  });
  it("preserves unrelated Development/default raw-body tracing", async () => {
    await createServerSwarmTracer({
      ...opts,
      swarmId: owner,
      inputPrompt: "DEVELOPMENT_UNCHANGED",
    });
    expect(state.writes[0].value.input_prompt).toBe("DEVELOPMENT_UNCHANGED");
  });
  it("preserves unrelated global opt-out behavior", async () => {
    vi.stubEnv("PERSIST_PROMPT_BODIES", "false");
    await createServerSwarmTracer({ ...opts, swarmId: owner });
    expect(state.writes[0].value.input_prompt).toBeNull();
  });
  it("preserves the exact generic resume payload and same-run identity without DMS metadata mutation", async () => {
    const tracer = await createServerSwarmTracer({ ...opts, swarmId: owner, resumeRunId: runId });
    expect(tracer?.runId).toBe(runId);
    expect(state.writes).toEqual([
      {
        table: "swarm_runs",
        action: "update",
        filters: { id: runId, user_id: owner },
        value: { status: "running", finished_at: null },
      },
    ]);
  });
  it("rejects malformed DMS input explicitly before any native write", async () => {
    await expect(
      createServerSwarmTracer({ ...opts, inputPrompt: "ORIGINAL_LEAKAGE_MARKER" }),
    ).rejects.toThrow("DOCUMENT_PERSISTENCE_INGRESS_INVALID_JSON");
    expect(state.writes).toEqual([]);
  });
  it("rejects foreign minimized owner binding before a write", async () => {
    await expect(
      createServerSwarmTracer({
        ...opts,
        userId: runId,
        inputPrompt: documentStoredIngress(owner, input),
      }),
    ).rejects.toThrow("DOCUMENT_PERSISTENCE_MINIMIZED_OWNER_REQUIRED");
    expect(state.writes).toEqual([]);
  });
  it("resumes the same owned native Parent, carrying the minimal ingress rather than forking", async () => {
    const tracer = await createServerSwarmTracer({
      ...opts,
      resumeRunId: runId,
      inputPrompt: documentStoredIngress(owner, input),
    });
    expect(tracer?.runId).toBe(runId);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toMatchObject({
      table: "swarm_runs",
      action: "update",
      filters: { id: runId, user_id: owner, swarm_id: DOCUMENT_MANAGEMENT_SWARM_ID },
      value: { input_prompt: documentStoredIngress(owner, input), status: "running" },
    });
  });
  it("does not invent a new DMS run when the parked owned Parent cannot be resumed", async () => {
    state.resumeFound = false;
    await expect(createServerSwarmTracer({ ...opts, resumeRunId: runId })).rejects.toThrow(
      "DOCUMENT_NATIVE_TRACE_PERSISTENCE_FAILED",
    );
    expect(state.writes.every((write) => write.action !== "insert")).toBe(true);
  });
  it("fails a missing DMS trace explicitly without disclosing raw database error content", async () => {
    state.insertFailed = true;
    await expect(createServerSwarmTracer(opts)).rejects.toThrow(
      "DOCUMENT_NATIVE_TRACE_PERSISTENCE_FAILED",
    );
  });
  it("preserves generic best-effort tracing on write failure", async () => {
    state.insertFailed = true;
    expect(await createServerSwarmTracer({ ...opts, swarmId: owner })).toBeNull();
  });
});
