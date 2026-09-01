// Ephemeral, disposable stack for the Local Table behavioural suite.
//
// WHY THIS EXISTS
// The first cut of this package was covered only by tests that read the source
// files and asserted that certain strings appeared in them. Those tests passed
// against a broker that could not actually work: the SQL guard read a GUC that
// the PostgREST version this project runs never sets, so every call would have
// raised. A test that greps for "auth.role()" cannot see that. So this harness
// runs the real thing.
//
// WHAT IT STARTS
//   - Postgres, from the SAME supabase/postgres tag production runs, so
//     auth.role(), the anon/authenticated/service_role roles and BYPASSRLS
//     behave identically;
//   - PostgREST, at the SAME version production runs, because the broker talks
//     to the database exclusively through supabase-js -> PostgREST, and the
//     bug above lives precisely in that gap.
//
// The broker code under test is imported unmodified; only the Supabase client
// module is redirected at this stack (see setup.ts).
//
// SAFETY
// Nothing here can reach the real project. Containers are created per run with
// unique names on a private network, bound to 127.0.0.1 on kernel-assigned
// ports, and destroyed in teardown including on failure. The suite refuses to
// run if it is pointed at anything that is not its own container.
import { createHmac, randomUUID } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { AddressInfo } from "node:net";
import { promisify } from "node:util";

const exec = promisify(execFile);

const PG_IMAGE = "supabase/postgres:17.6.1.136";
const PGRST_IMAGE = "postgrest/postgrest:v14.12";

/** Not a credential: a throwaway secret for a container that lives seconds. */
const JWT_SECRET = "behavioural-only-throwaway-secret-not-a-real-key-0000";
const DB_PASSWORD = "behavioural-only-throwaway";

export const OWNER_ID = "00000000-0000-4000-a000-00000000da01";
export const STRANGER_ID = "00000000-0000-4000-a000-00000000da02";
export const REGISTRY_TABLE = "axtn_document_registry";

export type Stack = {
  restUrl: string;
  serviceKey: string;
  /** Runs SQL as the superuser, for arrange/assert steps outside the broker. */
  sql: (statement: string) => Promise<string>;
  ids: {
    /** MCP app that the config will authorise for the capability. */
    authorisedAppId: string;
    /** Same owner, NOT authorised — proves the binding is per-app. */
    otherAppId: string;
    /** Session bound to the authorised app. */
    authorisedSessionId: string;
    /** Session bound to the same owner's unauthorised app. */
    otherSessionId: string;
    /** Session with no MCP provenance at all (a plain notebook kernel). */
    nonMcpSessionId: string;
    /** Session owned by a different user entirely. */
    strangerSessionId: string;
    registryTableId: string;
    strangerTableId: string;
  };
};

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Mints the HS256 token PostgREST expects. Hand-rolled to avoid a new dep. */
function mintJwt(role: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ role, iss: "behavioural-harness", exp: Math.floor(Date.now() / 1000) + 3600 }),
  );
  const signature = b64url(
    createHmac("sha256", JWT_SECRET).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${signature}`;
}

/**
 * Presents PostgREST at the URL shape supabase-js expects.
 *
 * supabase-js derives its REST base as `${SUPABASE_URL}/rest/v1`, and its auth
 * base as `${SUPABASE_URL}/auth/v1`, whereas a bare PostgREST container serves
 * the API at `/`. Without this, every call arrives as `/rest/v1/<table>` and
 * PostgREST answers "Invalid path specified in request URL".
 *
 * An in-process Node proxy rather than a third container: it is a path rewrite,
 * it needs no image, and it keeps the stack's startup cost at seconds. It also
 * gives `/auth/v1/*` somewhere to land — the audit path calls
 * `auth.admin.getUserById`, and GoTrue is deliberately not running, so a clean
 * 404 exercises the "attribution without an email" fallback rather than a
 * connection error.
 */
function startRestProxy(upstream: string): Promise<{ url: string; server: Server }> {
  const server = createServer((req, res) => {
    void (async () => {
      const path = req.url ?? "/";
      if (path.startsWith("/auth/v1")) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end('{"message":"auth is not part of the behavioural stack"}');
        return;
      }
      const rewritten = path.startsWith("/rest/v1") ? path.slice("/rest/v1".length) || "/" : path;

      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined || key === "host" || key === "connection") continue;
        headers.set(key, Array.isArray(value) ? value.join(",") : value);
      }

      try {
        const upstreamResponse = await fetch(`${upstream}${rewritten}`, {
          method: req.method,
          headers,
          body: chunks.length ? Buffer.concat(chunks) : undefined,
        });
        const body = Buffer.from(await upstreamResponse.arrayBuffer());
        const out: Record<string, string> = {};
        upstreamResponse.headers.forEach((value, key) => {
          // Let Node recompute framing for the body we actually forward.
          if (key !== "content-encoding" && key !== "transfer-encoding") out[key] = value;
        });
        res.writeHead(upstreamResponse.status, out);
        res.end(body);
      } catch (error) {
        res.writeHead(502, { "content-type": "application/json" });
        res.end(JSON.stringify({ message: `behavioural proxy: ${String(error)}` }));
      }
    })();
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ url: `http://127.0.0.1:${port}`, server });
    });
  });
}

async function docker(args: string[]): Promise<string> {
  const { stdout } = await exec("docker", args, { maxBuffer: 32 * 1024 * 1024 });
  return stdout.trim();
}

/**
 * Feeds a SQL script to psql over stdin.
 *
 * Deliberately spawn() rather than the promisified execFile(): execFile has no
 * `input` option (that belongs to the *Sync variants), so passing one is
 * silently ignored, stdin is never written and never closed, and `psql -f -`
 * waits on it forever. That failure looks exactly like a slow container, which
 * is a genuinely nasty thing to debug — hence writing and ending the stream
 * explicitly here.
 */
function psqlScript(container: string, script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-f", "-"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    child.stdout.resume();
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`psql exited ${code}: ${stderr.trim()}`)),
    );
    child.stdin.on("error", reject);
    child.stdin.end(script);
  });
}

/** True when this machine can run the suite at all. */
export async function dockerAvailable(): Promise<boolean> {
  try {
    await docker(["version", "--format", "{{.Server.Version}}"]);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(
  label: string,
  probe: () => Promise<boolean>,
  timeoutMs = 120_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      if (await probe()) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${label}: ${String(lastError)}`);
}

let stack: Stack | null = null;
let created: { network?: string; db?: string; rest?: string } = {};
let proxyServer: Server | null = null;

export async function startStack(): Promise<Stack> {
  if (stack) return stack;

  const tag = `axtn-lt-behav-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const network = `${tag}-net`;
  const db = `${tag}-db`;
  const rest = `${tag}-rest`;
  created = { network, db, rest };

  await docker(["network", "create", network]);

  // No published port for Postgres: only PostgREST and `docker exec` reach it,
  // so the database is not addressable from the host at all.
  await docker([
    "run",
    "-d",
    "--name",
    db,
    "--network",
    network,
    "--network-alias",
    "db",
    "-e",
    "POSTGRES_PASSWORD=" + DB_PASSWORD,
    "-e",
    "JWT_SECRET=" + JWT_SECRET,
    PG_IMAGE,
  ]);

  const psql = async (sql: string): Promise<string> => {
    // No `-i`: this path never sends stdin, and leaving the stream attached is
    // what caused the hang documented on psqlScript above.
    const { stdout } = await exec(
      "docker",
      ["exec", db, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA", "-c", sql],
      { maxBuffer: 32 * 1024 * 1024 },
    );
    return stdout.trim();
  };

  // Readiness is deliberately not "psql connects".
  //
  // The official entrypoint runs initdb against a TEMPORARY server, then stops
  // it and starts the real one. That temporary server accepts connections on
  // the unix socket, so a naive `psql select 1` succeeds against a database
  // that is about to be shut down — and the shutdown kills whatever is
  // connected, which surfaces as `psql exited 137` partway through loading the
  // schema. It is timing-dependent, so it passes locally and fails later.
  //
  // Two signals close that window: the entrypoint's own "init process
  // complete" line, after which the real server is the only one that starts,
  // and a TCP connection, which the socket-only temporary server never accepts.
  await waitFor("postgres init", async () => {
    const logs = await docker(["logs", db]).catch(() => "");
    return logs.includes("PostgreSQL init process complete");
  });
  await waitFor(
    "postgres",
    async () =>
      (await exec("docker", [
        "exec",
        db,
        "psql",
        "-U",
        "postgres",
        "-h",
        "127.0.0.1",
        "-tA",
        "-c",
        "select 1",
      ]).then((r) => r.stdout.trim())) === "1",
  );

  // Schema subset + the REAL migration, byte for byte off disk. If the
  // migration cannot load here it cannot load in production either.
  const bootstrap = readFileSync("tests/behavioral/localTable/bootstrap.sql", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260901000000_axtn_local_table_upsert.sql",
    "utf8",
  );
  for (const [label, script] of [
    ["bootstrap", bootstrap],
    ["migration", migration],
  ] as const) {
    await psqlScript(db, script).catch((error: unknown) => {
      throw new Error(`Failed to apply ${label}: ${String(error)}`);
    });
  }

  // PostgREST authenticates as `authenticator` and switches to the role in the
  // JWT, exactly as the real deployment does.
  //
  // Run as supabase_admin: in this image `postgres` is NOT a superuser and
  // `authenticator` is a reserved role, so only the true superuser may set its
  // password. The role already exists with LOGIN, and service_role already
  // carries BYPASSRLS, so this only supplies the password PostgREST connects
  // with and makes sure the switchable roles are granted.
  await exec("docker", [
    "exec",
    db,
    "psql",
    "-U",
    "supabase_admin",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-tA",
    "-c",
    `alter role authenticator with login password '${DB_PASSWORD}';
     grant anon, authenticated, service_role to authenticator;`,
  ]);

  await docker([
    "run",
    "-d",
    "--name",
    rest,
    "--network",
    network,
    "-p",
    "127.0.0.1::3000",
    "-e",
    `PGRST_DB_URI=postgres://authenticator:${DB_PASSWORD}@db:5432/postgres`,
    "-e",
    "PGRST_DB_SCHEMAS=public",
    "-e",
    "PGRST_DB_ANON_ROLE=anon",
    "-e",
    `PGRST_JWT_SECRET=${JWT_SECRET}`,
    "-e",
    "PGRST_LOG_LEVEL=error",
    PGRST_IMAGE,
  ]);

  const portLine = await docker(["port", rest, "3000"]);
  const port = portLine.split("\n")[0].trim().split(":").pop();
  const directRestUrl = `http://127.0.0.1:${port}`;
  const serviceKey = mintJwt("service_role");

  await waitFor("postgrest", async () => {
    const response = await fetch(`${directRestUrl}/`, { headers: { apikey: serviceKey } });
    return response.ok;
  });

  const proxy = await startRestProxy(directRestUrl);
  proxyServer = proxy.server;
  const restUrl = proxy.url;

  // ── fixtures ────────────────────────────────────────────────────────────
  const ids = {
    authorisedAppId: randomUUID(),
    otherAppId: randomUUID(),
    authorisedSessionId: randomUUID(),
    otherSessionId: randomUUID(),
    nonMcpSessionId: randomUUID(),
    strangerSessionId: randomUUID(),
    registryTableId: randomUUID(),
    strangerTableId: randomUUID(),
  };

  // The declared column schema mirrors the shape the registry seed uses: a
  // JSON array of {name} objects, which is what the broker and the SQL
  // function both read.
  const registryColumns = JSON.stringify(
    [
      "external_key",
      "source_system",
      "provider_message_id",
      "rfc_message_id",
      "received_at",
      "subject",
      "from_address",
      "privacy_flag",
      "registered_at",
    ].map((name) => ({ name, type: "text" })),
  );

  await psql(`
    insert into public.mcp_apps (id, user_id, name, slug, status) values
      ('${ids.authorisedAppId}', '${OWNER_ID}', 'aXtn Local Table Integration', 'axtn-local-table-integration-b1', 'ready'),
      ('${ids.otherAppId}', '${OWNER_ID}', 'Some Other App', 'some-other-app-b1', 'ready');

    insert into public.notebook_runtime_sessions (id, user_id, mcp_app_id, kind, status) values
      ('${ids.authorisedSessionId}', '${OWNER_ID}', '${ids.authorisedAppId}', 'service', 'ready'),
      ('${ids.otherSessionId}', '${OWNER_ID}', '${ids.otherAppId}', 'service', 'ready'),
      ('${ids.nonMcpSessionId}', '${OWNER_ID}', null, 'interactive', 'ready'),
      ('${ids.strangerSessionId}', '${STRANGER_ID}', '${ids.authorisedAppId}', 'service', 'ready');

    insert into public.user_data_tables (id, user_id, name, columns) values
      ('${ids.registryTableId}', '${OWNER_ID}', '${REGISTRY_TABLE}', '${registryColumns}'::jsonb),
      ('${ids.strangerTableId}', '${STRANGER_ID}', '${REGISTRY_TABLE}', '${registryColumns}'::jsonb);
  `);

  stack = { restUrl, serviceKey, sql: psql, ids };
  return stack;
}

export async function stopStack(): Promise<void> {
  stack = null;
  if (proxyServer) {
    await new Promise<void>((resolve) => proxyServer!.close(() => resolve()));
    proxyServer = null;
  }
  for (const name of [created.rest, created.db]) {
    if (name) await docker(["rm", "-f", name]).catch(() => {});
  }
  if (created.network) await docker(["network", "rm", created.network]).catch(() => {});
  created = {};
}

export function currentStack(): Stack {
  if (!stack) throw new Error("The behavioural stack has not been started.");
  return stack;
}
