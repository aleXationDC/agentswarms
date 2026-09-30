// Behavioural coverage for the Local Table MCP mutation boundary.
//
// These tests call the REAL broker (`localTableUpsert`) against a REAL Postgres
// and a REAL PostgREST, over supabase-js, with the REAL migration applied. They
// assert observable database state, not source text. The predecessor suite
// asserted that strings like "pg_advisory_xact_lock" appeared in the file; that
// tells you the author typed the words, not that the lock is taken, and it
// passed against a function whose role guard rejected every genuine call.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dockerAvailable, OWNER_ID, REGISTRY_TABLE, STRANGER_ID, type Stack } from "./harness";
import { authorizeApps, eventually, releaseStack, useStack } from "./setup";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { localTableUpsert, LocalTableUpsertRequestError } from "@/utils/localTableUpsert.server";
import type { PythonCaller } from "@/utils/notebookRuntime/caller.server";

const hasDocker = await dockerAvailable();
const suite = hasDocker ? describe : describe.skip;
if (!hasDocker) {
  console.warn("[behavioural] Docker unavailable — skipping the Local Table suite.");
}

suite("Local Table MCP upsert", () => {
  let stack: Stack;

  /** The broker reads only these two fields; `sb` is never used on this path. */
  const callerFor = (sessionId: string, userId = OWNER_ID): PythonCaller => ({
    userId,
    sb: supabaseAdmin,
    scopeUserId: userId,
    sessionId,
  });

  const upsert = (args: {
    session: string;
    userId?: string;
    table?: string;
    keyColumn?: string;
    keyValue: string;
    row: Record<string, unknown>;
  }) =>
    localTableUpsert({
      caller: callerFor(args.session, args.userId),
      tableName: args.table ?? REGISTRY_TABLE,
      keyColumn: args.keyColumn ?? "external_key",
      keyValue: args.keyValue,
      row: args.row,
    });

  const registryRow = (key: string, extra: Record<string, unknown> = {}) => ({
    external_key: key,
    source_system: "mail",
    subject: "initial",
    ...extra,
  });

  /** Rows currently stored for the owner's registry table. */
  const rowsFor = async (key: string): Promise<Array<Record<string, unknown>>> => {
    const out = await stack.sql(
      `select row from public.user_data_rows
       where table_id = '${stack.ids.registryTableId}'
         and row->>'external_key' = '${key}'
       order by id`,
    );
    return out
      ? out
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line))
      : [];
  };

  beforeAll(async () => {
    stack = await useStack();
  }, 300_000);

  afterAll(async () => {
    await releaseStack();
  }, 120_000);

  beforeEach(() => {
    // Default posture for each test: only the dedicated app is authorised.
    authorizeApps(stack.ids.authorisedAppId);
  });

  // ── happy path ──────────────────────────────────────────────────────────
  it("inserts a new logical row for an authorised caller", async () => {
    const key = `insert-${Date.now()}`;
    const result = await upsert({
      session: stack.ids.authorisedSessionId,
      keyValue: key,
      row: registryRow(key),
    });

    expect(result.outcome).toBe("inserted");
    expect(result.table_id).toBe(stack.ids.registryTableId);
    const rows = await rowsFor(key);
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe("initial");
  });

  it("updates the same logical key in place rather than duplicating it", async () => {
    const key = `update-${Date.now()}`;
    const first = await upsert({
      session: stack.ids.authorisedSessionId,
      keyValue: key,
      row: registryRow(key),
    });
    const second = await upsert({
      session: stack.ids.authorisedSessionId,
      keyValue: key,
      row: registryRow(key, { subject: "revised" }),
    });

    expect(first.outcome).toBe("inserted");
    expect(second.outcome).toBe("updated");
    expect(second.row_id).toBe(first.row_id);
    const rows = await rowsFor(key);
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe("revised");
  });

  it("is idempotent for a repeated identical upsert", async () => {
    const key = `idempotent-${Date.now()}`;
    const payload = registryRow(key);
    const first = await upsert({
      session: stack.ids.authorisedSessionId,
      keyValue: key,
      row: payload,
    });
    const again = await upsert({
      session: stack.ids.authorisedSessionId,
      keyValue: key,
      row: payload,
    });
    const third = await upsert({
      session: stack.ids.authorisedSessionId,
      keyValue: key,
      row: payload,
    });

    expect(again.row_id).toBe(first.row_id);
    expect(third.row_id).toBe(first.row_id);
    expect(await rowsFor(key)).toHaveLength(1);
  });

  // ── concurrency ─────────────────────────────────────────────────────────
  // The registry has no unique index over an arbitrary JSON key, so nothing in
  // the schema prevents two concurrent inserts of the same logical row. The
  // advisory lock is the only thing that does; this is the test that can
  // actually observe whether it works.
  it("serializes concurrent same-key upserts into one logical row", async () => {
    const key = `concurrent-${Date.now()}`;
    const attempts = 12;

    const results = await Promise.all(
      Array.from({ length: attempts }, (_, index) =>
        upsert({
          session: stack.ids.authorisedSessionId,
          keyValue: key,
          row: registryRow(key, { subject: `writer-${index}` }),
        }),
      ),
    );

    const rows = await rowsFor(key);
    expect(rows).toHaveLength(1);

    // Exactly one writer may claim the insert; the rest must observe it.
    const inserted = results.filter((r) => r.outcome === "inserted");
    expect(inserted).toHaveLength(1);
    expect(new Set(results.map((r) => r.row_id)).size).toBe(1);
    // Last write wins, and it must be one of the real payloads, not a blend.
    expect(String(rows[0].subject)).toMatch(/^writer-\d+$/);
  });

  it("preserves unrelated rows", async () => {
    const keep = `bystander-${Date.now()}`;
    const churn = `churn-${Date.now()}`;
    await upsert({
      session: stack.ids.authorisedSessionId,
      keyValue: keep,
      row: registryRow(keep),
    });
    for (let i = 0; i < 3; i++) {
      await upsert({
        session: stack.ids.authorisedSessionId,
        keyValue: churn,
        row: registryRow(churn, { subject: `v${i}` }),
      });
    }

    const bystander = await rowsFor(keep);
    expect(bystander).toHaveLength(1);
    expect(bystander[0].subject).toBe("initial");
  });

  // ── input validation ────────────────────────────────────────────────────
  it("rejects unknown columns", async () => {
    const key = `unknown-col-${Date.now()}`;
    await expect(
      upsert({
        session: stack.ids.authorisedSessionId,
        keyValue: key,
        row: registryRow(key, { not_a_column: "x" }),
      }),
    ).rejects.toBeInstanceOf(LocalTableUpsertRequestError);
    expect(await rowsFor(key)).toHaveLength(0);
  });

  it("rejects a missing or invalid key column and key value", async () => {
    const key = `bad-key-${Date.now()}`;
    // key_column not declared by the table
    await expect(
      upsert({
        session: stack.ids.authorisedSessionId,
        keyColumn: "nope",
        keyValue: key,
        row: registryRow(key),
      }),
    ).rejects.toBeInstanceOf(LocalTableUpsertRequestError);
    // empty key value
    await expect(
      upsert({ session: stack.ids.authorisedSessionId, keyValue: "", row: registryRow("") }),
    ).rejects.toBeInstanceOf(LocalTableUpsertRequestError);
    // key_value disagrees with row[key_column]
    await expect(
      upsert({
        session: stack.ids.authorisedSessionId,
        keyValue: key,
        row: registryRow("something-else"),
      }),
    ).rejects.toBeInstanceOf(LocalTableUpsertRequestError);
    expect(await rowsFor(key)).toHaveLength(0);
  });

  it("rejects a non-existent target table", async () => {
    await expect(
      upsert({
        session: stack.ids.authorisedSessionId,
        table: "table_that_does_not_exist",
        keyValue: "x",
        row: registryRow("x"),
      }),
    ).rejects.toBeInstanceOf(LocalTableUpsertRequestError);
  });

  // ── ownership and provenance ────────────────────────────────────────────
  it("rejects a table not owned by the authenticated owner", async () => {
    const key = `stranger-${Date.now()}`;
    // The stranger's session is authorised at app level and names a table that
    // exists under the SAME name — but is owned by the other user.
    await expect(
      upsert({
        session: stack.ids.strangerSessionId,
        userId: STRANGER_ID,
        keyValue: key,
        row: registryRow(key),
      }),
    ).resolves.toBeTruthy();

    // The write must have landed on the stranger's own table, never the owner's.
    const ownerRows = await rowsFor(key);
    expect(ownerRows).toHaveLength(0);
    const strangerCount = await stack.sql(
      `select count(*) from public.user_data_rows
       where table_id = '${stack.ids.strangerTableId}' and row->>'external_key' = '${key}'`,
    );
    expect(strangerCount).toBe("1");
  });

  it("rejects a caller whose scope does not match the runtime session", async () => {
    const key = `mismatch-${Date.now()}`;
    // Owner's user id presented with the stranger's session: the broker's
    // session lookup is filtered by BOTH id and user_id, so this resolves to
    // nothing and is refused as non-MCP.
    await expect(
      upsert({
        session: stack.ids.strangerSessionId,
        userId: OWNER_ID,
        keyValue: key,
        row: registryRow(key),
      }),
    ).rejects.toBeInstanceOf(LocalTableUpsertRequestError);
    expect(await rowsFor(key)).toHaveLength(0);
  });

  it("rejects a runtime session without MCP provenance", async () => {
    const key = `no-mcp-${Date.now()}`;
    await expect(
      upsert({ session: stack.ids.nonMcpSessionId, keyValue: key, row: registryRow(key) }),
    ).rejects.toBeInstanceOf(LocalTableUpsertRequestError);
    expect(await rowsFor(key)).toHaveLength(0);
  });

  it("requires an authenticated runtime session", async () => {
    await expect(
      localTableUpsert({
        caller: { userId: OWNER_ID, sb: supabaseAdmin },
        tableName: REGISTRY_TABLE,
        keyColumn: "external_key",
        keyValue: "anon",
        row: registryRow("anon"),
      }),
    ).rejects.toBeInstanceOf(LocalTableUpsertRequestError);
  });

  // ── Review gap B: per-app capability binding ────────────────────────────
  it("rejects a same-owner MCP app that is not authorised for the capability", async () => {
    const key = `unauthorised-app-${Date.now()}`;
    // Same user, same table, valid MCP session — differing only in which app.
    await expect(
      upsert({ session: stack.ids.otherSessionId, keyValue: key, row: registryRow(key) }),
    ).rejects.toBeInstanceOf(LocalTableUpsertRequestError);
    expect(await rowsFor(key)).toHaveLength(0);

    // ...and the authorised app succeeds on the identical call, so the denial
    // is attributable to the app binding and nothing else.
    const ok = await upsert({
      session: stack.ids.authorisedSessionId,
      keyValue: key,
      row: registryRow(key),
    });
    expect(ok.outcome).toBe("inserted");
  });

  it("fails closed when no app is authorised", async () => {
    authorizeApps();
    const key = `no-config-${Date.now()}`;
    await expect(
      upsert({ session: stack.ids.authorisedSessionId, keyValue: key, row: registryRow(key) }),
    ).rejects.toBeInstanceOf(LocalTableUpsertRequestError);
    expect(await rowsFor(key)).toHaveLength(0);
  });

  it("does not accept a malformed app id as authorisation", async () => {
    // A non-UUID entry must be discarded rather than widening the allow-list.
    process.env.LOCAL_TABLE_INTEGRATION_MCP_APP_IDS = "*, all, ";
    const key = `wildcard-${Date.now()}`;
    await expect(
      upsert({ session: stack.ids.authorisedSessionId, keyValue: key, row: registryRow(key) }),
    ).rejects.toBeInstanceOf(LocalTableUpsertRequestError);
    expect(await rowsFor(key)).toHaveLength(0);
  });

  // ── allow-list ──────────────────────────────────────────────────────────
  it("rejects a table that is not on the allow-list even when owned", async () => {
    const other = "some_other_table";
    await stack.sql(
      `insert into public.user_data_tables (user_id, name, columns)
       values ('${OWNER_ID}', '${other}', '[{"name":"external_key"}]'::jsonb)
       on conflict (user_id, name) do nothing`,
    );
    await expect(
      upsert({
        session: stack.ids.authorisedSessionId,
        table: other,
        keyValue: "x",
        row: { external_key: "x" },
      }),
    ).rejects.toBeInstanceOf(LocalTableUpsertRequestError);
    const count = await stack.sql(
      `select count(*) from public.user_data_rows r
       join public.user_data_tables t on t.id = r.table_id
       where t.name = '${other}'`,
    );
    expect(count).toBe("0");
  });

  // ── freshness ───────────────────────────────────────────────────────────
  it("marks the dataset loaded and the parquet mirror stale on mutation", async () => {
    // Pretend a mirror was synced, then mutate: the mirror must be invalidated
    // so readers fall back to the authoritative rows.
    await stack.sql(
      `update public.user_data_tables
       set parquet_synced_at = now(), data_loaded_at = now() - interval '1 day'
       where id = '${stack.ids.registryTableId}'`,
    );
    const key = `freshness-${Date.now()}`;
    await upsert({ session: stack.ids.authorisedSessionId, keyValue: key, row: registryRow(key) });

    const state = await stack.sql(
      `select parquet_synced_at is null, data_loaded_at > now() - interval '1 minute'
       from public.user_data_tables where id = '${stack.ids.registryTableId}'`,
    );
    expect(state).toBe("t|t");
  });

  // ── audit attribution ───────────────────────────────────────────────────
  it("attributes the mutation to the MCP app, tool and runtime session", async () => {
    const key = `audit-${Date.now()}`;
    await upsert({ session: stack.ids.authorisedSessionId, keyValue: key, row: registryRow(key) });

    // auditEvent is fire-and-forget by design, so poll for it.
    const detail = await eventually("audit event", async () => {
      const out = await stack.sql(
        `select detail from public.audit_events
         where action = 'local_table.upsert' and detail->>'key_value' = '${key}'
         limit 1`,
      );
      return out || null;
    });
    const parsed = JSON.parse(detail);

    expect(parsed.mcp_app_id).toBe(stack.ids.authorisedAppId);
    expect(parsed.runtime_session_id).toBe(stack.ids.authorisedSessionId);
    expect(parsed.outcome).toBe("inserted");
    expect(parsed.key_column).toBe("external_key");

    const attribution = await stack.sql(
      `select user_id, resource_type, resource_name, resource_id
       from public.audit_events
       where action = 'local_table.upsert' and detail->>'key_value' = '${key}' limit 1`,
    );
    expect(attribution).toBe(
      `${OWNER_ID}|user_data_table|${REGISTRY_TABLE}|${stack.ids.registryTableId}`,
    );

    // The audit trail must never carry the caller's credential material.
    expect(detail).not.toContain(stack.serviceKey);
  });

  // ── credential containment ──────────────────────────────────────────────
  it("keeps the database credential out of everything the caller can observe", async () => {
    const key = `leak-${Date.now()}`;
    const result = await upsert({
      session: stack.ids.authorisedSessionId,
      keyValue: key,
      row: registryRow(key),
    });
    // The tool result is what crosses back into the MCP sandbox.
    expect(JSON.stringify(result)).not.toContain(stack.serviceKey);
    expect(Object.keys(result).sort()).toEqual(["outcome", "row_id", "table_id"]);

    // Denial messages must not narrate infrastructure either.
    const denial = await upsert({
      session: stack.ids.otherSessionId,
      keyValue: key,
      row: registryRow(key),
    }).catch((error: Error) => error.message);
    expect(String(denial)).not.toContain(stack.serviceKey);
    expect(String(denial)).not.toContain(stack.restUrl);
  });

  // ── schema seed integrity ───────────────────────────────────────────────
  it("leaves the registry's declared column schema untouched", async () => {
    const before = await stack.sql(
      `select columns::text from public.user_data_tables where id = '${stack.ids.registryTableId}'`,
    );
    const key = `seed-${Date.now()}`;
    await upsert({ session: stack.ids.authorisedSessionId, keyValue: key, row: registryRow(key) });
    const after = await stack.sql(
      `select columns::text from public.user_data_tables where id = '${stack.ids.registryTableId}'`,
    );
    expect(after).toBe(before);
  });

  // ── the SQL function's own trust boundary ───────────────────────────────
  it("refuses direct execution by untrusted roles", async () => {
    // anon/authenticated must not be able to call the function at all, so a
    // leaked sandbox credential cannot bypass the broker's checks.
    for (const role of ["anon", "authenticated"]) {
      const out = await stack.sql(
        `select has_function_privilege('${role}',
           'public.axtn_local_table_upsert(uuid,text,text,text,jsonb)', 'execute')`,
      );
      expect(out).toBe("f");
    }
    const broker = await stack.sql(
      `select has_function_privilege('service_role',
         'public.axtn_local_table_upsert(uuid,text,text,text,jsonb)', 'execute')`,
    );
    expect(broker).toBe("t");
  });
});
