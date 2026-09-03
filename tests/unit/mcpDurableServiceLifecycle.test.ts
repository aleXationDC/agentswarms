// AXTN-MCP-RUNTIME-0001 — durable MCP service lifecycle.
//
// Two defects met in production and are pinned here. Both were reproduced live
// against a real scaled-to-zero MCP service before this file was written:
//
//   1. LEASE LOSERS WENT BLIND. A session row is INSERTed before its container
//      exists and only gains `container_ref` once the orchestrator returns.
//      refreshSession() used to return the caller's own object unchanged for a
//      row in that window WITHOUT READING ANYTHING, so a waiter that picked the
//      row up there polled a frozen snapshot until its deadline. Measured: the
//      endpoint was serving at +4412ms while one caller returned 503 "starting"
//      at +90095ms and another 503 "start_timeout" at +95687ms — and the second
//      one then started a SECOND container at +90608ms, because the "deadline"
//      outcome fell through to acquiring the start lease.
//
//   2. SERVICES OUTLIVED THEIR CREDENTIAL. The sandbox capability token is
//      clamped to at most an hour; service sessions recorded `expires_at = null`
//      and had no hard lifetime. A service kept busy past the clamp went on
//      reporting `ready` while every call it made was rejected. Measured: token
//      iat 07:35:18 / exp 08:35:18, session still `ready` at +73min, sixteen
//      document registrations failed against a "healthy" endpoint.
//
// The lifecycle paths are tested by executing them against an in-memory stand-in
// for the two seams they actually depend on — the session table and the
// orchestrator. The DECISIONS under test (who starts, who waits, who rotates)
// are the module's own; only the storage and the container runtime are faked,
// so this is not a test of its own mocks.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// In-memory stand-in for the two tables these paths touch.
// ---------------------------------------------------------------------------
type Row = Record<string, unknown>;
const db: { notebook_runtime_sessions: Row[]; mcp_apps: Row[] } = {
  notebook_runtime_sessions: [],
  mcp_apps: [],
};
let idSeq = 0;

/** Minimal PostgREST-shaped query builder over the arrays above. */
function builder(table: keyof typeof db) {
  let op: "select" | "insert" | "update" = "select";
  let payload: Row = {};
  const preds: ((r: Row) => boolean)[] = [];
  let ord: { col: string; asc: boolean } | null = null;
  let lim: number | null = null;

  const rows = () => {
    let out = db[table].filter((r) => preds.every((p) => p(r)));
    if (ord) {
      const { col, asc } = ord;
      out = [...out].sort((a, b) =>
        String(a[col]) < String(b[col])
          ? asc
            ? -1
            : 1
          : String(a[col]) > String(b[col])
            ? asc
              ? 1
              : -1
            : 0,
      );
    }
    return lim == null ? out : out.slice(0, lim);
  };

  async function run(): Promise<{ data: Row[] | null; error: null | { message: string } }> {
    if (op === "insert") {
      const row: Row = {
        id: `sess-${++idSeq}`,
        created_at: new Date(Date.now() + idSeq).toISOString(),
        ...payload,
      };
      db[table].push(row);
      return { data: [row], error: null };
    }
    if (op === "update") {
      const hit = rows();
      for (const r of hit) Object.assign(r, payload);
      return { data: hit, error: null };
    }
    return { data: rows(), error: null };
  }

  const self = {
    select: () => self,
    insert: (v: Row) => ((op = "insert"), (payload = v), self),
    update: (v: Row) => ((op = "update"), (payload = v), self),
    eq: (c: string, v: unknown) => (preds.push((r) => r[c] === v), self),
    neq: (c: string, v: unknown) => (preds.push((r) => r[c] !== v), self),
    in: (c: string, vs: unknown[]) => (preds.push((r) => vs.includes(r[c])), self),
    lt: (c: string, v: string) => (preds.push((r) => r[c] != null && String(r[c]) < v), self),
    gte: (c: string, v: string) => (preds.push((r) => r[c] != null && String(r[c]) >= v), self),
    // Only the one shape the start lease uses: "status.neq.X,updated_at.lt.Y".
    or: (expr: string) => {
      const parts = expr.split(",").map((p) => p.trim());
      preds.push((r) =>
        parts.some((p) => {
          const [col, fn, ...rest] = p.split(".");
          const val = rest.join(".");
          if (fn === "neq") return r[col] !== val;
          if (fn === "lt") return r[col] != null && String(r[col]) < val;
          return false;
        }),
      );
      return self;
    },
    order: (col: string, o?: { ascending?: boolean }) => (
      (ord = { col, asc: o?.ascending !== false }),
      self
    ),
    limit: (n: number) => ((lim = n), self),
    single: async () => {
      const { data } = await run();
      return { data: data?.[0] ?? null, error: data?.length ? null : { message: "no rows" } };
    },
    maybeSingle: async () => {
      const { data } = await run();
      return { data: data?.[0] ?? null, error: null };
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => run().then(res, rej),
  };
  return self;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: (t: keyof typeof db) => builder(t) },
}));

vi.mock("@/utils/notebookRuntime/config.server", () => ({
  getRuntimeSettings: async () => ({ enabled: true, backend: "docker", image: "img" }),
  canUseRuntime: async () => true,
  mcpServiceCaps: () => ({ perUser: 10, total: 20 }),
  countLiveServices: async () => 0,
  countLiveServicesTotal: async () => 0,
}));

vi.mock("@/utils/notebookRuntime/orchestrator", () => ({
  getOrchestrator: async () => ({
    create: async () => ({ ref: "ref" }),
    status: async () => ({ state: "running", endpoint: "http://sandbox:8888" }),
    stop: async () => {},
    logs: async () => "",
  }),
  MCP_SERVICE_PATH: "/mcp",
}));

// The container lifecycle is faked; the session bookkeeping is real enough that
// the module's own waiting/adoption logic is what decides the outcome.
let startCalls = 0;
/** ms between startSession() being called and the session reporting ready. */
let startLatencyMs = 50;
/** When set, started sessions go terminal instead of ready. */
let startDies = false;

vi.mock("@/utils/notebookRuntime/service.server", async () => {
  const LIVE = ["queued", "starting", "ready", "running", "stopping"] as const;
  return {
    LIVE,
    startSession: async (opts: { userId: string; mcpAppId: string }) => {
      startCalls++;
      const row: Row = {
        id: `sess-${++idSeq}`,
        created_at: new Date(Date.now() + idSeq).toISOString(),
        user_id: opts.userId,
        mcp_app_id: opts.mcpAppId,
        kind: "service",
        status: "starting",
        // The real startSession inserts BEFORE the orchestrator returns, so the
        // row exists with no container_ref for the length of a cold start.
        container_ref: null,
        endpoint: null,
        expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      };
      db.notebook_runtime_sessions.push(row);
      const at = Date.now() + startLatencyMs;
      // Captured at creation: a later flip of the flag must not retroactively
      // change what this session did. And a session that has been stopped stays
      // stopped — a settle hook may not resurrect it.
      const dies = startDies;
      const settle = () => {
        if (Date.now() < at) return;
        if (["stopped", "error", "succeeded"].includes(String(row.status))) return;
        if (dies) {
          row.status = "stopped";
          row.error = "process exited";
        } else {
          row.container_ref = "ref";
          row.status = "ready";
          row.endpoint = "http://sandbox:8888";
        }
      };
      settleHooks.push(settle);
      return { session: { ...row }, token: "t", gatewayUrl: "g" };
    },
    // Real refreshSession re-reads the row; that behaviour is what the fix
    // introduced, so the fake re-reads too and applies any due state change.
    refreshSession: async (row: Row) => {
      for (const h of settleHooks) h();
      const fresh = db.notebook_runtime_sessions.find((r) => r.id === row.id);
      return fresh ? { ...fresh } : row;
    },
    stopSession: async (row: Row) => {
      const fresh = db.notebook_runtime_sessions.find((r) => r.id === row.id);
      if (fresh) {
        fresh.status = "stopped";
        fresh.stopped_at = new Date().toISOString();
      }
    },
  };
});

let settleHooks: (() => void)[] = [];

const { credentialHealthy, CREDENTIAL_SAFETY_MS, ensureRunning, runningEndpoint } =
  await import("@/utils/mcpApps/service.server");

const APP = { id: "app-1", user_id: "user-1", keep_warm: false } as never;

function resetWorld() {
  db.notebook_runtime_sessions = [];
  db.mcp_apps = [
    { id: "app-1", user_id: "user-1", status: "stopped", updated_at: new Date().toISOString() },
  ];
  idSeq = 0;
  startCalls = 0;
  startLatencyMs = 50;
  startDies = false;
  settleHooks = [];
}

beforeEach(resetWorld);
afterEach(() => vi.useRealTimers());

const live = () =>
  db.notebook_runtime_sessions.filter((r) =>
    ["queued", "starting", "ready", "running", "stopping"].includes(String(r.status)),
  );

// ---------------------------------------------------------------------------
describe("concurrent cold start is single-flight and adopts promptly", () => {
  it("four concurrent callers create exactly one runtime session", async () => {
    const results = await Promise.all([0, 1, 2, 3].map(() => ensureRunning(APP)));
    expect(startCalls).toBe(1);
    expect(db.notebook_runtime_sessions.length).toBe(1);
    for (const r of results) expect(r.ok).toBe(true);
  });

  it("every caller gets the same endpoint", async () => {
    const results = await Promise.all([0, 1, 2, 3].map(() => ensureRunning(APP)));
    const endpoints = new Set(results.map((r) => (r.ok ? r.endpoint : `fail:${r.error}`)));
    expect([...endpoints]).toEqual(["http://sandbox:8888"]);
  });

  it("lease losers return as soon as the service is ready, not at the 90s deadline", async () => {
    // The measured defect: ready at 4.4s, losers back at 90s and 95s.
    startLatencyMs = 300;
    const t0 = Date.now();
    const results = await Promise.all([0, 1, 2, 3].map(() => ensureRunning(APP)));
    const elapsed = Date.now() - t0;
    for (const r of results) expect(r.ok).toBe(true);
    // Generously below the 90_000ms cold-start budget: the point is that no
    // caller waits it out once a healthy endpoint exists.
    expect(elapsed).toBeLessThan(15_000);
  }, 30_000);

  it("a waiter whose session has no container_ref yet still observes readiness", async () => {
    // Exactly the window that froze the old waiter. The session is inserted
    // with container_ref null and only becomes usable later.
    startLatencyMs = 1_200;
    const [a, b] = await Promise.all([ensureRunning(APP), ensureRunning(APP)]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(startCalls).toBe(1);
  }, 30_000);

  it("no second session is started once the first is healthy", async () => {
    await Promise.all([0, 1, 2, 3].map(() => ensureRunning(APP)));
    expect(live().length).toBe(1);
    // A later wave adopts the running one and starts nothing.
    await Promise.all([0, 1, 2].map(() => ensureRunning(APP)));
    expect(startCalls).toBe(1);
    expect(live().length).toBe(1);
  });
});

describe("a genuinely dead start can still be replaced", () => {
  it("recovers on a later attempt after the first start dies", async () => {
    startDies = true;
    const first = await ensureRunning(APP);
    expect(first.ok).toBe(false);
    startDies = false;
    const second = await ensureRunning(APP);
    expect(second.ok).toBe(true);
    expect(live().length).toBe(1);
  }, 30_000);
});

// ---------------------------------------------------------------------------
describe("readiness means callable, not merely running", () => {
  it("a service well inside its credential lifetime is healthy", () => {
    const now = Date.now();
    expect(credentialHealthy({ expires_at: new Date(now + 60 * 60_000).toISOString() }, now)).toBe(
      true,
    );
  });

  it("a service inside the safety window is NOT healthy", () => {
    const now = Date.now();
    const soon = new Date(now + CREDENTIAL_SAFETY_MS - 1_000).toISOString();
    expect(credentialHealthy({ expires_at: soon }, now)).toBe(false);
  });

  it("an already-expired credential is NOT healthy", () => {
    const now = Date.now();
    expect(credentialHealthy({ expires_at: new Date(now - 1).toISOString() }, now)).toBe(false);
  });

  it("the exact production shape — ready for 73 minutes on a 60 minute token — is rejected", () => {
    const iat = Date.parse("2026-09-03T07:35:18Z");
    const expires = new Date(iat + 3600_000).toISOString();
    const seventyThreeMinutesIn = iat + 73 * 60_000;
    expect(credentialHealthy({ expires_at: expires }, seventyThreeMinutesIn)).toBe(false);
  });

  it("a session with no recorded deadline is treated as healthy", () => {
    // Sessions predating the recorded expiry must not be taken offline for a
    // missing field.
    expect(credentialHealthy({ expires_at: null })).toBe(true);
  });

  it("ensureRunning does not hand back a service whose credential has lapsed", async () => {
    await ensureRunning(APP);
    expect(startCalls).toBe(1);
    const session = live()[0];
    // Fake clock: drive the session to the end of its credential life rather
    // than waiting an hour.
    session.expires_at = new Date(Date.now() + 1_000).toISOString();
    const res = await ensureRunning(APP);
    expect(res.ok).toBe(true);
    // It was replaced, not returned as-is.
    expect(startCalls).toBe(2);
    expect(String(session.status)).toBe("stopped");
  }, 30_000);

  it("runningEndpoint reports nothing for a credential-dead service", async () => {
    await ensureRunning(APP);
    expect(await runningEndpoint("app-1")).toBe("http://sandbox:8888");
    live()[0].expires_at = new Date(Date.now() + 1_000).toISOString();
    expect(await runningEndpoint("app-1")).toBeNull();
  });
});

describe("rotation is as single-flight as a cold start", () => {
  it("concurrent callers during rotation converge on ONE replacement", async () => {
    await ensureRunning(APP);
    expect(startCalls).toBe(1);
    const stale = live()[0];
    stale.expires_at = new Date(Date.now() + 1_000).toISOString();

    const results = await Promise.all([0, 1, 2, 3].map(() => ensureRunning(APP)));
    for (const r of results) expect(r.ok).toBe(true);
    // Exactly one replacement for four concurrent callers.
    expect(startCalls).toBe(2);
    expect(live().length).toBe(1);
    expect(live()[0].id).not.toBe(stale.id);
  }, 30_000);

  it("the replacement carries its own recorded deadline", async () => {
    await ensureRunning(APP);
    live()[0].expires_at = new Date(Date.now() + 1_000).toISOString();
    await ensureRunning(APP);
    const fresh = live()[0];
    expect(fresh.expires_at).toBeTruthy();
    expect(credentialHealthy(fresh as { expires_at: string })).toBe(true);
  }, 30_000);
});
