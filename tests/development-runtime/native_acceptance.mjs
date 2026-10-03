import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";

const revisions = {
  base: "0a38f20ccea94d937a5d4fa2ad18b37ae6439c09",
  positive: "7448eaa6447ed68d8aabe608715146a08fbed369",
  broken: "0cc95e55e883aedc3240a16ceb59ddef0689aa59",
  timeout: "81166a073392c1d2b82dbc56095f8b81511fa02a",
  hostile: "7030125f5afe775cd4754a711a6bc008bfbaabee",
};

async function snapshots() {
  const { createClient } = await import("@supabase/supabase-js");
  const assets = "/app/dist/server/assets";
  const filename = readdirSync(assets).find((x) => x.startsWith("registry.server-"));
  assert(filename);
  const registry = await import(pathToFileURL(`${assets}/${filename}`).href);
  const resolve = Object.values(registry).find(
    (x) => typeof x === "function" && x.name === "resolveAgentTools",
  );
  assert(resolve);
  const owner = process.env.AXTN_DEVELOPMENT_MCP_OWNER_ID;
  assert(owner);
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ctx = { userId: owner, scopeUserId: owner, sb };
  const tools = await resolve(ctx, {
    enabledTools: ["mcp_call_tool"],
    toolConfigs: { mcp_server_names: ["aXtn Development Gitea"] },
  });
  const handler = tools.handlers.get("mcp_call_tool");
  assert(handler);
  async function read(name, args) {
    const wire = JSON.parse(
      await handler(ctx, {
        server_name: "aXtn Development Gitea",
        tool_name: name,
        arguments: { owner: "aXtn", repository: "development-swarm-acceptance", ...args },
      }),
    );
    assert(!wire.error && !wire.result?.isError, "Native read failed");
    if (wire.result.structuredContent !== undefined) return wire.result.structuredContent;
    assert.equal(wire.result.content.length, 1);
    return JSON.parse(wire.result.content[0].text);
  }
  const result = {};
  for (const [name, revision] of Object.entries(revisions)) {
    const tree = await read("repository_tree", { ref: revision, recursive: true });
    assert(!tree.truncated);
    result[name] = [];
    for (const entry of tree.tree.filter((x) => x.type === "blob")) {
      assert(["100644", "100755"].includes(entry.mode));
      const file = await read("fetch", { target: "file", identifier: entry.path, ref: revision });
      result[name].push({
        path: entry.path,
        content: Buffer.from(file.content, "base64").toString("utf8"),
      });
    }
  }
  return result;
}

async function acceptance() {
  const origin = process.env.AXTN_ACCEPTANCE_PRIVATE_SUPABASE_ORIGIN;
  assert(origin?.startsWith("https://"), "Set the actual private same-origin Supabase URL");
  const root = process.env.AXTN_RUNTIME_DIR ?? `${homedir()}/.local/share/axtn/native`;
  const app = process.env.AXTN_ACCEPTANCE_APP_ORIGIN ?? "http://127.0.0.1:18080";
  const container = "axtn-native-agentswarms-agentswarms-1";
  const env = Object.fromEntries(
    readFileSync(`${root}/compose.env`, "utf8")
      .split("\n")
      .filter((x) => x && !x.startsWith("#") && x.includes("="))
      .map((x) => [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)]),
  );
  const files = JSON.parse(
    execFileSync(
      "docker",
      ["exec", "-i", container, "node", "--input-type=module", "-", "--snapshots"],
      { input: readFileSync(import.meta.filename), encoding: "utf8", maxBuffer: 1024 * 1024 },
    ),
  );
  async function http(url, body, token, key, method = "POST") {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(key ? { apikey: key } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(70000),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }
  const login = await http(
    `${origin}/auth/v1/token?grant_type=password`,
    {
      email: env.AGENTSWARMS_SUPERADMIN_EMAIL,
      password: readFileSync(`${root}/agentswarms-superadmin-password`, "utf8").trim(),
    },
    undefined,
    env.SUPABASE_ANON_KEY,
  );
  assert.equal(login.status, 200);
  const auth = login.body;
  const request = {
    schema: "axtn.development.verify/v1",
    repository: "aXtn/development-swarm-acceptance",
    taskId: "native-runtime-boundary-v1",
    attemptId: "candidate-7448eaa6",
    effectKey: "native-runtime-boundary:v1:positive",
    caseId: "ac6ac6b5-f201-46c1-9f86-6c0732d8962a",
    baseSHA: revisions.base,
    candidateSHA: revisions.positive,
    profile: "python-normalization-v1",
    baseline: files.base,
    candidate: files.positive,
  };
  const verify = (inputs, token = auth.access_token) =>
    http(`${app}/api/notebook/runtime`, { action: "verify", inputs }, token);
  assert.equal((await verify(request, "")).status, 401);
  assert.equal((await verify(request, "invalid")).status, 401);
  assert.equal((await verify({ ...request, userId: "injected" })).status, 400);
  assert.equal(
    (await verify({ ...request, caseId: "00000000-0000-4000-8000-000000000000" })).status,
    403,
  );
  const positive = await verify(request);
  assert.equal(positive.status, 200);
  assert.equal(positive.body.status, "COMPLETED");
  assert.equal(positive.body.evidence.gateVerdict, "PASS");
  assert.equal(positive.body.evidence.baseline.pass, false);
  assert.equal(positive.body.evidence.candidate.pass, true);
  assert.equal(
    positive.body.evidence.image,
    "sha256:bf7a93450c449eb9e5dad388dd3f868f6c1530f84924e7f973945cb17d36c803",
  );
  const replay = await verify(request);
  assert.deepEqual(replay.body, positive.body);
  const forged = await verify({
    ...request,
    candidate: [{ path: "README.md", content: "forged" }],
  });
  assert(forged.status >= 400 && forged.body.status !== "COMPLETED");
  assert.equal(
    (
      await http(
        `${app}/api/notebook/runtime`,
        {
          action: "token",
          sessionId: positive.body.sessionId,
        },
        auth.access_token,
      )
    ).status,
    403,
  );

  const foreignPassword = randomBytes(32).toString("base64url");
  const foreign = await http(
    `${origin}/auth/v1/admin/users`,
    {
      email: `runtime-denial-${randomBytes(12).toString("hex")}@example.invalid`,
      password: foreignPassword,
      email_confirm: true,
    },
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  assert([200, 201].includes(foreign.status));
  assert.notEqual(foreign.body.id, auth.user.id);
  try {
    const session = await http(
      `${origin}/auth/v1/token?grant_type=password`,
      {
        email: foreign.body.email,
        password: foreignPassword,
      },
      undefined,
      env.SUPABASE_ANON_KEY,
    );
    assert.equal(session.status, 200);
    assert.equal((await verify(request, session.body.access_token)).status, 403);
  } finally {
    const deleted = await http(
      `${origin}/auth/v1/admin/users/${foreign.body.id}`,
      undefined,
      env.SUPABASE_SERVICE_ROLE_KEY,
      env.SUPABASE_SERVICE_ROLE_KEY,
      "DELETE",
    );
    assert([200, 204].includes(deleted.status));
  }
  const rowUrl = `${origin}/rest/v1/notebook_runtime_sessions?id=eq.${positive.body.sessionId}`;
  const before = await http(rowUrl, undefined, auth.access_token, env.SUPABASE_ANON_KEY, "GET");
  assert.equal(before.body.length, 1);
  for (const [method, body] of [
    ["PATCH", { result: { gateVerdict: "PASS", forged: true } }],
    ["PATCH", { entrypoint: "generic-laundered" }],
    ["DELETE", undefined],
  ])
    assert(
      (await http(rowUrl, body, auth.access_token, env.SUPABASE_ANON_KEY, method)).status >= 400,
    );
  const after = await http(rowUrl, undefined, auth.access_token, env.SUPABASE_ANON_KEY, "GET");
  assert.deepEqual(after.body, before.body);
  const secret = execFileSync(
    "docker",
    [
      "exec",
      "axtn-native-supabase-db",
      "psql",
      "-X",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-At",
      "-c",
      "SELECT signing_secret FROM public.notebook_runtime_secrets WHERE id=true",
    ],
    { encoding: "utf8" },
  ).trim();
  assert(secret.length >= 16);
  const now = Math.floor(Date.now() / 1000);
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const data = `${b64({ alg: "HS256", typ: "nbr" })}.${b64({
    sub: auth.user.id,
    sid: positive.body.sessionId,
    scope: "notebook-runtime",
    iat: now,
    exp: now + 60,
  })}`;
  const token = `${data}.${createHmac("sha256", secret).update(data).digest("base64url")}`;
  for (const action of ["source", "result"])
    assert.equal(
      (
        await http(
          `${app}/api/notebook/runtime/${action}`,
          { status: "succeeded", result: { forged: true } },
          token,
        )
      ).status,
      403,
    );
  for (const variant of ["broken", "timeout", "hostile"]) {
    const inputs = {
      ...request,
      baseSHA: revisions.positive,
      candidateSHA: revisions[variant],
      baseline: files.positive,
      candidate: files[variant],
      effectKey: `native-runtime-boundary:v1:${variant}`,
      attemptId: `negative-${variant}-v1`,
    };
    const result = await verify(inputs);
    assert.equal(result.status, 200);
    assert.equal(result.body.status, "COMPLETED");
    assert.equal(result.body.evidence.baseline.pass, true);
    assert.equal(result.body.evidence.candidate.pass, false);
    assert.equal(result.body.evidence.gateVerdict, "FAIL");
    assert.equal((await verify({ ...request, effectKey: inputs.effectKey })).status, 409);
    assert(!JSON.stringify(result.body).includes(secret));
  }
  console.log(
    "PASS: native immutable snapshots, grant/owner/auth boundaries, real receipt protection, callbacks, replay/conflict and bounded failure fixtures",
  );
}

if (process.argv.includes("--snapshots")) console.log(JSON.stringify(await snapshots()));
else await acceptance();
