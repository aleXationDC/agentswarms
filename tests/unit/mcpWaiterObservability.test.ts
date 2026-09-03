// AXTN-MCP-RUNTIME-0001 — the exact code path that blinded lease losers.
//
// A session row is INSERTed by startSession() before the orchestrator has
// produced a container, and only gains `container_ref` afterwards. For a row in
// that window refreshSession() used to do this:
//
//     if (terminal.includes(row.status) || !row.container_ref) return row;
//
// It returned the caller's own object. Measured against the live runtime, that
// call took 0ms, performed no query, and handed back an object IDENTICAL by
// reference to the one passed in — while the database said something else
// entirely. waitReady() polls by reassigning `row = await refreshSession(row)`,
// so a waiter that entered the window polled a frozen snapshot at 750ms
// intervals until its 90s deadline expired, for a service that had been
// answering requests since +4.4s.
//
// These tests execute the real refreshSession against an in-memory session
// table, so the assertion is on what the function DOES, not on its text.
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
let rows: Row[] = [];
let orchestratorCalls = 0;

function builder() {
  const preds: ((r: Row) => boolean)[] = [];
  let op: "select" | "update" = "select";
  let payload: Row = {};
  const hit = () => rows.filter((r) => preds.every((p) => p(r)));
  const run = async () => {
    if (op === "update") {
      const h = hit();
      for (const r of h) Object.assign(r, payload);
      return { data: h, error: null };
    }
    return { data: hit(), error: null };
  };
  const self = {
    select: () => self,
    update: (v: Row) => ((op = "update"), (payload = v), self),
    eq: (c: string, v: unknown) => (preds.push((r) => r[c] === v), self),
    maybeSingle: async () => ({ data: hit()[0] ?? null, error: null }),
    single: async () => ({ data: hit()[0] ?? null, error: null }),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => run().then(res, rej),
  };
  return self;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: () => builder() },
}));

vi.mock("@/utils/notebookRuntime/config.server", () => ({
  getRuntimeSettings: async () => ({ enabled: true, backend: "docker", image: "img" }),
}));

vi.mock("@/utils/notebookRuntime/orchestrator", () => ({
  getOrchestrator: async () => ({
    create: async () => ({ ref: "ref" }),
    status: async () => {
      orchestratorCalls++;
      return { state: "running", endpoint: "http://sandbox:8888" };
    },
    stop: async () => {},
    logs: async () => "",
  }),
  MCP_SERVICE_PATH: "/mcp",
}));

const { refreshSession } = await import("@/utils/notebookRuntime/service.server");

beforeEach(() => {
  rows = [];
  orchestratorCalls = 0;
});

describe("a waiter can observe a session that has not got its container yet", () => {
  it("re-reads the row instead of handing back the caller's stale copy", async () => {
    // The database has moved on: the container arrived and the row is serving.
    rows = [
      {
        id: "s1",
        kind: "service",
        status: "ready",
        container_ref: "ref",
        endpoint: "http://sandbox:8888",
        started_at: "now",
      },
    ];
    // The waiter still holds the snapshot it read during the start window.
    const stale = {
      id: "s1",
      kind: "service",
      status: "starting",
      container_ref: null,
      endpoint: null,
    };

    const out = await refreshSession(stale as never);

    expect(out).not.toBe(stale);
    expect(out.status).toBe("ready");
    expect(out.endpoint).toBe("http://sandbox:8888");
  });

  it("reports a start that failed during the window instead of waiting it out", async () => {
    rows = [{ id: "s1", kind: "service", status: "error", container_ref: null, error: "boom" }];
    const stale = { id: "s1", kind: "service", status: "starting", container_ref: null };

    const out = await refreshSession(stale as never);

    expect(out.status).toBe("error");
  });

  it("still returns a not-yet-started row without inventing a container", async () => {
    rows = [{ id: "s1", kind: "service", status: "starting", container_ref: null }];
    const stale = { id: "s1", kind: "service", status: "starting", container_ref: null };

    const out = await refreshSession(stale as never);

    expect(out.status).toBe("starting");
    // No container to ask about yet, so the orchestrator is not consulted.
    expect(orchestratorCalls).toBe(0);
  });

  it("does not query for a row that is already terminal", async () => {
    const done = { id: "s1", kind: "service", status: "stopped", container_ref: null };
    const out = await refreshSession(done as never);
    expect(out).toBe(done);
    expect(orchestratorCalls).toBe(0);
  });

  it("a vanished row leaves the caller's copy untouched", async () => {
    rows = [];
    const stale = { id: "gone", kind: "service", status: "starting", container_ref: null };
    const out = await refreshSession(stale as never);
    expect(out).toBe(stale);
  });

  it("picks up the container the re-read reveals and reconciles from it", async () => {
    // The row gained its container_ref between the waiter's read and this call.
    rows = [
      { id: "s1", kind: "service", status: "starting", container_ref: "ref", started_at: "now" },
    ];
    const stale = { id: "s1", kind: "service", status: "starting", container_ref: null };

    const out = await refreshSession(stale as never);

    expect(orchestratorCalls).toBe(1);
    expect(out.status).toBe("ready");
    expect(out.endpoint).toBe("http://sandbox:8888");
  });
});
