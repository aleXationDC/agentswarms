// The Streamable HTTP handshake the MCP client performs before it may call a
// tool, exercised against a real HTTP server rather than by reading source.
//
// THE BUG THESE TESTS EXIST FOR reached production. The client posted
// `tools/call` straight at the endpoint with no `initialize` first. A
// session-bound server — FastMCP's default, so every server MCP Builder
// publishes — answers that with:
//
//     HTTP 200  {"error":{"code":-32600,"message":"Bad Request: Missing session ID"}}
//
// HTTP 200. The transport reported success, the JSON-RPC error was passed
// through untouched as if it were a tool result, and a swarm node that was
// supposed to write a row into the document registry did nothing at all while
// reporting `accepted: true`. Nothing anywhere was red.
//
// So these tests assert on WIRE BEHAVIOUR — which requests were sent, in which
// order, carrying which headers — because that is the layer where the defect
// lived. A test that asserted the source contains the string "initialize"
// would have passed against the broken client too.
import { afterEach, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { AddressInfo } from "node:net";

import { runMcpCallTool, runMcpListTools } from "@/utils/tools/registry.server";

/** One request as the server actually received it. */
type Received = {
  method: string | null;
  sessionId: string | null;
  protocolVersion: string | null;
  authorization: string | null;
  body: Record<string, unknown>;
};

type FakeOptions = {
  /** Session id to issue on initialize. null models a stateless server. */
  sessionId?: string | null;
  /** Version the server claims to have agreed to. */
  protocolVersion?: string;
  /** initialize answers with a JSON-RPC error. */
  failInitialize?: boolean;
  /** notifications/initialized answers with a transport failure. */
  failInitialized?: boolean;
  /** Result object returned for tools/call. */
  toolResult?: Record<string, unknown>;
  /** tools/call answers with a JSON-RPC error instead of a result. */
  toolRpcError?: boolean;
};

type Fake = { url: string; received: Received[]; close: () => Promise<void> };

const servers: Server[] = [];

async function startFake(opts: FakeOptions = {}): Promise<Fake> {
  const {
    sessionId = "sess-abc",
    protocolVersion = "2025-06-18",
    failInitialize = false,
    failInitialized = false,
    toolResult = {
      content: [{ type: "text", text: '{"outcome":"inserted"}' }],
      isError: false,
      structuredContent: { outcome: "inserted" },
    },
    toolRpcError = false,
  } = opts;

  const received: Received[] = [];

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        body = {};
      }
      const method = typeof body.method === "string" ? body.method : null;
      received.push({
        method,
        sessionId: (req.headers["mcp-session-id"] as string) ?? null,
        protocolVersion: (req.headers["mcp-protocol-version"] as string) ?? null,
        authorization: (req.headers.authorization as string) ?? null,
        body,
      });

      const send = (status: number, payload: unknown, headers: Record<string, string> = {}) => {
        res.writeHead(status, { "Content-Type": "application/json", ...headers });
        res.end(payload === undefined ? "" : JSON.stringify(payload));
      };

      if (method === "initialize") {
        if (failInitialize) {
          // The exact shape of the production failure: HTTP 200 wrapping an error.
          return send(200, {
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32600, message: "Bad Request: Missing session ID" },
          });
        }
        return send(
          200,
          {
            jsonrpc: "2.0",
            id: body.id,
            result: { protocolVersion, capabilities: {}, serverInfo: { name: "fake" } },
          },
          sessionId ? { "Mcp-Session-Id": sessionId } : {},
        );
      }

      if (method === "notifications/initialized") {
        if (failInitialized) return send(500, { error: "initialized rejected" });
        // A notification gets no body — 202 with nothing, as real servers do.
        res.writeHead(202);
        return res.end();
      }

      if (method === "tools/list") {
        return send(200, {
          jsonrpc: "2.0",
          id: body.id,
          result: { tools: [{ name: "local_table_upsert" }] },
        });
      }

      if (method === "tools/call") {
        if (toolRpcError) {
          return send(200, {
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32602, message: "Invalid tool arguments" },
          });
        }
        return send(200, { jsonrpc: "2.0", id: body.id, result: toolResult });
      }

      return send(404, { error: "unexpected method" });
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const port = (server.address() as AddressInfo).port;

  return {
    url: `http://127.0.0.1:${port}/mcp`,
    received,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Minimal stand-in for the Supabase client `loadMcpServer` reads through. */
function ctxFor(endpoint: string, name = "fake-server") {
  const row = {
    name,
    endpoint,
    auth_type: "token",
    auth_token: "secret-token",
    auth_token_enc: null,
    status: "connected",
  };
  return {
    userId: "user-1",
    sb: {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: row }) }),
        }),
      }),
    },
  } as never;
}

const CALL_ARGS = {
  server_name: "fake-server",
  tool_name: "local_table_upsert",
  arguments: { table_name: "axtn_document_registry", key_column: "document_id", key_value: "d1" },
};

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});

describe("the handshake a session-bound server requires", () => {
  it("initializes, acknowledges, then calls the tool — in that order", async () => {
    const fake = await startFake();

    const out = await runMcpCallTool(ctxFor(fake.url), CALL_ARGS);

    // THE REGRESSION. The broken client sent exactly one request, tools/call,
    // and got "Missing session ID" back as if it were a result.
    expect(fake.received.map((r) => r.method)).toEqual([
      "initialize",
      "notifications/initialized",
      "tools/call",
    ]);
    expect(JSON.parse(out).result.structuredContent).toEqual({ outcome: "inserted" });
  });

  it("carries the issued session id on every request after initialize", async () => {
    const fake = await startFake({ sessionId: "sess-xyz" });

    await runMcpCallTool(ctxFor(fake.url), CALL_ARGS);

    const [init, ack, call] = fake.received;
    // Nothing to echo yet on the opening request.
    expect(init.sessionId).toBeNull();
    expect(ack.sessionId).toBe("sess-xyz");
    expect(call.sessionId).toBe("sess-xyz");
  });

  it("sends the initialized notification even when no session id was issued", async () => {
    // A stateless server still gets the full handshake: it is entitled to
    // refuse work until it has seen the notification, and skipping it would
    // make the two server shapes behave differently for no reason.
    const fake = await startFake({ sessionId: null });

    const out = await runMcpCallTool(ctxFor(fake.url), CALL_ARGS);

    expect(fake.received.map((r) => r.method)).toEqual([
      "initialize",
      "notifications/initialized",
      "tools/call",
    ]);
    expect(fake.received.every((r) => r.sessionId === null)).toBe(true);
    expect(JSON.parse(out).result.isError).toBe(false);
  });
});

describe("the protocol version actually agreed on", () => {
  it("uses the server's version for later requests, not the client's preference", async () => {
    // The server answers with an OLDER revision than we asked for. Continuing
    // to advertise our own would claim an agreement that was never made.
    const fake = await startFake({ protocolVersion: "2024-11-05" });

    await runMcpCallTool(ctxFor(fake.url), CALL_ARGS);

    const [init, ack, call] = fake.received;
    expect(init.protocolVersion).toBe("2025-06-18");
    expect(init.body.params).toMatchObject({ protocolVersion: "2025-06-18" });
    expect(ack.protocolVersion).toBe("2024-11-05");
    expect(call.protocolVersion).toBe("2024-11-05");
  });

  it("refuses to continue when initialize returns no protocol version", async () => {
    const server = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        const body = JSON.parse(raw || "{}");
        res.writeHead(200, { "Content-Type": "application/json" });
        // A result, but an empty one — there is nothing to negotiate with.
        res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result: {} }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    servers.push(server);
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`;

    const out = await runMcpCallTool(ctxFor(url), CALL_ARGS);
    expect(JSON.parse(out).error).toMatch(/protocolVersion/i);
  });
});

describe("a handshake that fails stops there", () => {
  it("does not send the notification or the tool call when initialize fails", async () => {
    const fake = await startFake({ failInitialize: true });

    const out = await runMcpCallTool(ctxFor(fake.url), CALL_ARGS);

    expect(fake.received.map((r) => r.method)).toEqual(["initialize"]);
    const parsed = JSON.parse(out);
    expect(parsed.error).toMatch(/initialize failed/i);
    expect(parsed.result).toBeUndefined();
  });

  it("does not call the tool when the initialized notification fails", async () => {
    // Fatal on purpose. A server that never saw the notification may refuse
    // the call, and proceeding is how a silent no-op gets reported as success.
    const fake = await startFake({ failInitialized: true });

    const out = await runMcpCallTool(ctxFor(fake.url), CALL_ARGS);

    expect(fake.received.map((r) => r.method)).toEqual([
      "initialize",
      "notifications/initialized",
    ]);
    expect(JSON.parse(out).error).toMatch(/initialized notification failed/i);
  });
});

describe("failures that arrive wrapped in HTTP 200", () => {
  it("reports an isError tool result as a failure, not a result", async () => {
    // Exactly what the live registry write returned while appearing to work:
    // the authorisation refusal came back as a normal 200 tool result.
    const fake = await startFake({
      toolResult: {
        content: [
          { type: "text", text: "This MCP app is not authorized for the Local Table capability." },
        ],
        isError: true,
      },
    });

    const out = await runMcpCallTool(ctxFor(fake.url), CALL_ARGS);
    const parsed = JSON.parse(out);

    expect(parsed.error).toMatch(/not authorized/i);
    // The caller must not be able to read a success out of this.
    expect(parsed.result).toBeUndefined();
    expect(parsed.isError).toBeUndefined();
  });

  it("reports a JSON-RPC error as a failure", async () => {
    const fake = await startFake({ toolRpcError: true });

    const parsed = JSON.parse(await runMcpCallTool(ctxFor(fake.url), CALL_ARGS));

    expect(parsed.error).toMatch(/Invalid tool arguments/);
    expect(parsed.error).toMatch(/-32602/);
    expect(parsed.result).toBeUndefined();
  });

  it("leaves a genuine successful payload untouched", async () => {
    // The error handling must not start editing results that were fine. This
    // is the shape the Document Management ACK node parses.
    const fake = await startFake();

    const parsed = JSON.parse(await runMcpCallTool(ctxFor(fake.url), CALL_ARGS));

    expect(parsed.result).toEqual({
      content: [{ type: "text", text: '{"outcome":"inserted"}' }],
      isError: false,
      structuredContent: { outcome: "inserted" },
    });
    expect(parsed.error).toBeUndefined();
  });
});

describe("listing tools uses the same lifecycle", () => {
  it("handshakes before tools/list and returns the tool list", async () => {
    const fake = await startFake();

    const parsed = JSON.parse(await runMcpListTools(ctxFor(fake.url), { server_name: "fake-server" }));

    expect(fake.received.map((r) => r.method)).toEqual([
      "initialize",
      "notifications/initialized",
      "tools/list",
    ]);
    expect(parsed.result.tools).toEqual([{ name: "local_table_upsert" }]);
  });

  it("stops at a failed handshake instead of listing", async () => {
    const fake = await startFake({ failInitialize: true });

    const parsed = JSON.parse(await runMcpListTools(ctxFor(fake.url), { server_name: "fake-server" }));

    expect(fake.received.map((r) => r.method)).toEqual(["initialize"]);
    expect(parsed.error).toMatch(/initialize failed/i);
  });
});

describe("the guards around the handshake still hold", () => {
  it("sends the bearer token on every request of the interaction", async () => {
    const fake = await startFake();

    await runMcpCallTool(ctxFor(fake.url), CALL_ARGS);

    expect(fake.received).toHaveLength(3);
    for (const r of fake.received) expect(r.authorization).toBe("Bearer secret-token");
  });

  it("refuses a metadata address without opening a session", async () => {
    const out = await runMcpCallTool(ctxFor("http://169.254.169.254/mcp"), CALL_ARGS);
    expect(JSON.parse(out).error).toMatch(/link-local|metadata/i);
  });

  it("refuses a server outside the allow-list before any request is made", async () => {
    const fake = await startFake();

    const out = await runMcpCallTool(ctxFor(fake.url), CALL_ARGS, ["some-other-server"]);

    expect(JSON.parse(out).error).toMatch(/allow-list/i);
    expect(fake.received).toHaveLength(0);
  });

  it("refuses a non-http endpoint before any request is made", async () => {
    const out = await runMcpCallTool(ctxFor("stdio://local"), CALL_ARGS);
    expect(JSON.parse(out).error).toMatch(/not callable/i);
  });
});
