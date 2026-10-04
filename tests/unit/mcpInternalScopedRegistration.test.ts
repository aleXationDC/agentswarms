import { beforeEach, describe, expect, it, vi } from "vitest";
import { InternalRegistrationSchema, internalToolScope } from "@/utils/mcpApps/internalScope";

const fixture = vi.hoisted(() => ({
  owned: vi.fn(),
  admin: vi.fn(),
  audit: vi.fn(),
  reachable: vi.fn(),
  encrypt: vi.fn(),
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validate = (input: unknown) => input;
    const builder = {
      middleware: () => builder,
      inputValidator: (fn: (input: unknown) => unknown) => {
        validate = fn;
        return builder;
      },
      handler: (fn: (args: unknown) => unknown) => (args: { data: unknown; context: unknown }) =>
        fn({ ...args, data: validate(args.data) }),
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: fixture.admin },
}));
vi.mock("@/utils/audit.server", () => ({ auditEvent: fixture.audit }));
vi.mock("@/utils/internalOrigin.server", () => ({
  resolveInternalOrigin: () => "https://app.example.invalid",
}));
vi.mock("@/utils/ssrfGuard.server", () => ({ assertPublicUrl: fixture.reachable }));
vi.mock("@/lib/mcp/auth.server", () => ({ encryptMcpAuthToken: fixture.encrypt }));
import { mcpAppRegisterInternal } from "@/utils/mcpApps.functions";
import { hashMcpApiKey } from "@/utils/mcpApps/keys";

const id = "11111111-1111-4111-8111-111111111111";
const owner = "22222222-2222-4222-8222-222222222222";
const serverId = "33333333-3333-4333-8333-333333333333";
const app = () => ({
  id,
  user_id: owner,
  name: "aXtn Local Table Integration",
  slug: "local-table-abc123",
  description: "fixture",
  status: "ready",
  registered_server_id: null as string | null,
  tools_hash: "reviewed-v1",
  tools_changed_at: null as string | null,
  tools_approved_at: "2026-10-04T00:00:00Z" as string | null,
  tools: [{ name: "local_table_upsert" }, { name: "other_tool" }],
});
let current = app();
let writes: { table: string; payload: Record<string, unknown>; filters: unknown[] }[];
let fail: string | null;
let missingServer: boolean;
let foreignServer: boolean;
let failKeyInsert: boolean;
function chain(table: string, owned: boolean) {
  const filters: unknown[] = [];
  let write = false;
  let inserted = false;
  const result = () => {
    if (failKeyInsert && table === "mcp_app_keys" && inserted)
      return { data: null, error: { message: "key insertion failed" } };
    if (fail === table && write) return { data: null, error: { message: `${table} failed` } };
    return {
      data:
        owned && !write
          ? current
          : missingServer && table === "mcp_servers" && !write
            ? null
            : { id: serverId, user_id: foreignServer ? id : owner },
      error: null,
    };
  };
  const q = {
    select: () => q,
    eq: (...args: unknown[]) => {
      filters.push(args);
      return q;
    },
    is: (...args: unknown[]) => {
      filters.push(args);
      return q;
    },
    update: (payload: Record<string, unknown>) => {
      write = true;
      writes.push({ table, payload, filters });
      return q;
    },
    insert: (payload: Record<string, unknown>) => {
      write = true;
      inserted = true;
      writes.push({ table, payload, filters });
      return q;
    },
    maybeSingle: async () => result(),
    single: async () => result(),
    then: (resolve: (value: ReturnType<typeof result>) => void) => resolve(result()),
  };
  return q;
}
function call(
  data: unknown = {
    id,
    tool_allowlist: ["local_table_upsert"],
    tools_hash: "reviewed-v1",
  },
) {
  const invoke: unknown = mcpAppRegisterInternal;
  if (typeof invoke !== "function") throw new Error("Native registration fixture is missing.");
  return invoke({ data, context: { userId: owner, supabase: { from: fixture.owned } } });
}
beforeEach(() => {
  current = app();
  writes = [];
  fail = null;
  missingServer = false;
  foreignServer = false;
  failKeyInsert = false;
  fixture.owned.mockReset().mockImplementation((table: string) => chain(table, true));
  fixture.admin.mockReset().mockImplementation((table: string) => chain(table, false));
  fixture.audit.mockReset();
  fixture.reachable.mockReset().mockResolvedValue({ ok: true });
  fixture.encrypt.mockReset().mockResolvedValue({ ciphertext: "encrypted-fixture", iv: "fixture" });
});
describe("native scoped internal registration", () => {
  it("keeps existing unscoped requests valid, but refuses empty or fingerprint-free scope", () => {
    expect(InternalRegistrationSchema.parse({ id })).toEqual({ id });
    for (const data of [
      { id, tool_allowlist: [] },
      { id, tool_allowlist: ["local_table_upsert"] },
    ])
      expect(() => InternalRegistrationSchema.parse(data)).toThrow();
  });
  it("deduplicates only approved deployed names", () => {
    expect(
      internalToolScope(current, ["local_table_upsert", "local_table_upsert"], "reviewed-v1"),
    ).toEqual(["local_table_upsert"]);
  });
  it("compares actual instants instead of timestamp spellings", () => {
    current.tools_changed_at = "2026-10-04T02:00:00+02:00";
    expect(internalToolScope(current, ["local_table_upsert"], "reviewed-v1")).toEqual([
      "local_table_upsert",
    ]);
    current.tools_approved_at = "invalid";
    expect(() => internalToolScope(current, ["local_table_upsert"], "reviewed-v1")).toThrow();
  });
  it("persists a hashed one-tool key and encrypts its connected-server credential", async () => {
    expect(await call()).toEqual({ ok: true, server_id: serverId });
    const key = writes.find(
      (write) => write.table === "mcp_app_keys" && "key_hash" in write.payload,
    )?.payload;
    expect(key).toMatchObject({
      user_id: owner,
      app_id: id,
      is_internal: true,
      tool_allowlist: ["local_table_upsert"],
    });
    expect(key?.key_hash).toMatch(/^[a-f0-9]{64}$/);
    const plaintext = fixture.encrypt.mock.calls[0][0];
    expect(key?.key_hash).toBe(await hashMcpApiKey(plaintext));
    expect(JSON.stringify(writes)).not.toContain(plaintext);
    expect(key).not.toHaveProperty("plaintext");
    const server = writes.find((write) => write.table === "mcp_servers")?.payload;
    expect(server).toMatchObject({
      tools_count: 1,
      tools: [{ name: "local_table_upsert" }],
      auth_token: null,
      auth_token_enc: { ciphertext: "encrypted-fixture", iv: "fixture" },
    });
    expect(fixture.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { tool_allowlist: ["local_table_upsert"], tools_hash: "reviewed-v1" },
      }),
    );
  });
  it("retains default unrestricted key and full advertisement for existing callers", async () => {
    expect(await call({ id })).toMatchObject({ ok: true });
    expect(writes.find((write) => "key_hash" in write.payload)?.payload.tool_allowlist).toEqual([]);
    expect(writes.find((write) => write.table === "mcp_servers")?.payload.tools_count).toBe(2);
  });
  it.each(["not-ready", "stale-hash", "unapproved", "drift", "unknown-tool", "malformed"])(
    "rejects %s before revocation or key issuance",
    async (condition) => {
      if (condition === "not-ready") current.status = "draft";
      if (condition === "stale-hash") current.tools_hash = "new-hash";
      if (condition === "unapproved") current.tools_approved_at = null;
      if (condition === "drift") current.tools_changed_at = "2026-10-05T00:00:00Z";
      if (condition === "unknown-tool") current.tools = [{ name: "other_tool" }];
      if (condition === "malformed") Object.assign(current, { tools: [null] });
      expect(await call()).toMatchObject({ ok: false });
      expect(writes).toHaveLength(0);
      expect(fixture.audit).not.toHaveBeenCalled();
    },
  );
  it("refuses unreachable endpoints before changing credentials", async () => {
    fixture.reachable.mockResolvedValue({ ok: false, error: "unreachable" });
    expect(await call()).toMatchObject({ ok: false });
    expect(writes).toHaveLength(0);
  });
  it.each(["mcp_app_keys", "mcp_servers", "mcp_apps"])(
    "reports native %s persistence failure instead of registration success",
    async (table) => {
      fail = table;
      expect(await call()).toEqual({ ok: false, error: `${table} failed` });
      expect(fixture.audit).not.toHaveBeenCalled();
    },
  );
  it("reports key issuance failure without writing a connected server or success audit", async () => {
    failKeyInsert = true;
    expect(await call()).toEqual({ ok: false, error: "key insertion failed" });
    expect(writes.filter((write) => write.table === "mcp_servers")).toHaveLength(0);
    expect(fixture.audit).not.toHaveBeenCalled();
  });
  it("prepares encryption before rotating any existing working key", async () => {
    fixture.encrypt.mockRejectedValue(new Error("native encryption unavailable"));
    await expect(call()).rejects.toThrow("native encryption unavailable");
    expect(writes).toHaveLength(0);
    expect(fixture.audit).not.toHaveBeenCalled();
  });
  it("refuses a missing encryption result without credential writes", async () => {
    fixture.encrypt.mockResolvedValue(null);
    expect(await call()).toMatchObject({ ok: false });
    expect(writes).toHaveLength(0);
    expect(fixture.audit).not.toHaveBeenCalled();
  });
  it("denies a foreign existing binding before revoking or issuing any key", async () => {
    current.registered_server_id = serverId;
    foreignServer = true;
    expect(await call()).toMatchObject({ ok: false });
    expect(writes).toHaveLength(0);
    expect(fixture.audit).not.toHaveBeenCalled();
  });
  it("retains native re-creation when the old connected-server row was deleted", async () => {
    current.registered_server_id = serverId;
    missingServer = true;
    expect(await call()).toMatchObject({ ok: true });
    expect(writes.filter((write) => write.table === "mcp_servers")).toHaveLength(1);
  });
  it("updates an existing owned connected server with an explicit owner filter", async () => {
    current.registered_server_id = serverId;
    expect(await call()).toMatchObject({ ok: true });
    expect(writes.find((write) => write.table === "mcp_servers")?.filters).toContainEqual([
      "user_id",
      owner,
    ]);
  });
});
