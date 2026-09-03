// AXTN-MCP-RUNTIME-0001 — the sandbox capability token itself.
//
// The durable-service-lifecycle fix rotates a service BEFORE its token lapses.
// That is only a safe thing to build on if the token remains strictly
// fail-closed: rotation must be an availability measure, never a way of making
// an expired credential keep working. These tests run the real sign/verify
// implementation against a real secret — no mocks — so a regression that made
// verification lenient would fail here rather than being papered over by the
// rotation that is supposed to make it unnecessary.
import { beforeAll, describe, expect, it } from "vitest";

process.env.NOTEBOOK_RUNTIME_SECRET = "test-runtime-secret-value-0123456789";

const { effectiveSessionTtlSeconds, signSessionToken, verifySessionToken } =
  await import("@/utils/notebookRuntime/token.server");

const USER = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";

function claimsOf(token: string): {
  iat: number;
  exp: number;
  sub: string;
  sid: string;
  scope: string;
} {
  return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
}

describe("the recorded lifetime is the lifetime actually minted", () => {
  it("clamps to one hour, which is the gap the service lifecycle has to cover", () => {
    // A service asks for "as long as the sandbox lives" and silently gets 3600s.
    expect(effectiveSessionTtlSeconds(24 * 3600)).toBe(3600);
  });

  it("clamps upward to a minimum", () => {
    expect(effectiveSessionTtlSeconds(1)).toBe(60);
  });

  it("passes a normal value through", () => {
    expect(effectiveSessionTtlSeconds(900)).toBe(900);
  });

  it("a minted token expires exactly when the helper says it will", async () => {
    // This is the invariant that lets a session row record its credential
    // deadline: if these two could disagree, the lifecycle would rotate at the
    // wrong moment and the defect would come back.
    const requested = 24 * 3600;
    const token = await signSessionToken({
      userId: USER,
      sessionId: SESSION,
      ttlSeconds: requested,
    });
    expect(token).toBeTruthy();
    const c = claimsOf(token!);
    expect(c.exp - c.iat).toBe(effectiveSessionTtlSeconds(requested));
  });
});

describe("an expired capability is still refused", () => {
  let valid: string;

  beforeAll(async () => {
    valid = (await signSessionToken({ userId: USER, sessionId: SESSION, ttlSeconds: 3600 }))!;
  });

  it("accepts a live token and preserves its session/tenant binding", async () => {
    const claims = await verifySessionToken(valid);
    expect(claims?.sub).toBe(USER);
    expect(claims?.sid).toBe(SESSION);
  });

  it("refuses a token whose exp has passed", async () => {
    // Forge an expired-but-otherwise-perfect token by re-signing real claims
    // with a past exp — the same secret, the same scope, the same subject.
    const c = claimsOf(valid);
    const expired = { ...c, iat: c.iat - 7200, exp: Math.floor(Date.now() / 1000) - 1 };
    const header = valid.split(".")[0];
    const payload = Buffer.from(JSON.stringify(expired)).toString("base64url");
    const { createHmac } = await import("node:crypto");
    const sig = createHmac("sha256", process.env.NOTEBOOK_RUNTIME_SECRET!)
      .update(`${header}.${payload}`)
      .digest("base64url");
    expect(await verifySessionToken(`${header}.${payload}.${sig}`)).toBeNull();
  });

  it("refuses a token signed with a different secret", async () => {
    const { createHmac } = await import("node:crypto");
    const [header, payload] = valid.split(".");
    const sig = createHmac("sha256", "some-other-secret-value-0123456789")
      .update(`${header}.${payload}`)
      .digest("base64url");
    expect(await verifySessionToken(`${header}.${payload}.${sig}`)).toBeNull();
  });

  it("refuses a tampered payload", async () => {
    const [header, , sig] = valid.split(".");
    const c = claimsOf(valid);
    const payload = Buffer.from(
      JSON.stringify({ ...c, sub: "33333333-3333-4333-8333-333333333333" }),
    ).toString("base64url");
    expect(await verifySessionToken(`${header}.${payload}.${sig}`)).toBeNull();
  });

  it("refuses a token from another scope", async () => {
    const { createHmac } = await import("node:crypto");
    const c = claimsOf(valid);
    const header = valid.split(".")[0];
    const payload = Buffer.from(JSON.stringify({ ...c, scope: "something-else" })).toString(
      "base64url",
    );
    const sig = createHmac("sha256", process.env.NOTEBOOK_RUNTIME_SECRET!)
      .update(`${header}.${payload}`)
      .digest("base64url");
    expect(await verifySessionToken(`${header}.${payload}.${sig}`)).toBeNull();
  });

  it("refuses malformed input rather than falling open", async () => {
    for (const bad of ["", "a.b", "a.b.c.d", "not-a-token", undefined, null]) {
      expect(await verifySessionToken(bad as string)).toBeNull();
    }
  });
});
