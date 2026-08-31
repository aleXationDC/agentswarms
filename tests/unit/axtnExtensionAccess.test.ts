import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  AXTN_EDGE_HEADERS,
  AXTN_EXTENSION_ACCESS_COOKIE,
  AXTN_EXTENSION_REDEEM_PATH,
  buildAxtnExtensionRedeemUrl,
  parseAxtnSystemExtensions,
  readCookie,
  readSingleSearchParam,
  validateAxtnEdgeRequest,
} from "../../src/lib/axtnExtensionAccess";

const CONFIG = JSON.stringify([
  {
    id: "maintenance",
    label: "Maintenance",
    url: "https://Maintenance.Example.com/admin",
    description: "Host administration",
  },
]);

describe("aXtn extension configuration", () => {
  it("canonicalizes the configured HTTPS target and host", () => {
    expect(parseAxtnSystemExtensions(CONFIG)).toEqual([
      {
        id: "maintenance",
        label: "Maintenance",
        url: "https://maintenance.example.com/admin",
        targetHost: "maintenance.example.com",
        description: "Host administration",
      },
    ]);
  });

  it("rejects unsafe or ambiguous targets", () => {
    const extension = {
      id: "maintenance",
      label: "Maintenance",
      description: "Host administration",
    };
    expect(() =>
      parseAxtnSystemExtensions(JSON.stringify([{ ...extension, url: "http://example.com/" }])),
    ).toThrow(/HTTPS/);
    expect(() =>
      parseAxtnSystemExtensions(
        JSON.stringify([{ ...extension, url: "https://user:pass@example.com/" }]),
      ),
    ).toThrow(/credentials/);
    expect(() =>
      parseAxtnSystemExtensions(
        JSON.stringify([{ ...extension, url: "https://example.com/#secret" }]),
      ),
    ).toThrow(/fragments/);
    expect(() =>
      parseAxtnSystemExtensions(
        JSON.stringify([
          { ...extension, url: "https://example.com/" },
          { ...extension, id: "other", url: "https://example.com/other" },
        ]),
      ),
    ).toThrow(/more than one extension for host/);
  });

  it("builds a host-local redeem URL with every bound value", () => {
    const extension = parseAxtnSystemExtensions(CONFIG)[0];
    const redeem = new URL(
      buildAxtnExtensionRedeemUrl(
        extension,
        "bd704c4b-6d5e-4a8a-bf2f-11887532e71f",
        `axtn_t_${"a".repeat(43)}`,
      ),
    );
    expect(redeem.origin).toBe("https://maintenance.example.com");
    expect(redeem.pathname).toBe(AXTN_EXTENSION_REDEEM_PATH);
    expect(redeem.searchParams.get("id")).toBe(extension.id);
    expect(redeem.searchParams.get("target")).toBe(extension.url);
    expect(redeem.searchParams.get("ticket_id")).toBe("bd704c4b-6d5e-4a8a-bf2f-11887532e71f");
    expect(redeem.searchParams.get("ticket")).toMatch(/^axtn_t_/);
  });
});

describe("aXtn edge binding", () => {
  const extension = parseAxtnSystemExtensions(CONFIG)[0];

  function edgeRequest(overrides: Record<string, string> = {}) {
    return new Request("http://127.0.0.1:18080/api/axtn/extension-access/authorize", {
      headers: {
        host: extension.targetHost,
        [AXTN_EDGE_HEADERS.extensionId]: extension.id,
        [AXTN_EDGE_HEADERS.target]: extension.url,
        [AXTN_EDGE_HEADERS.requestHost]: extension.targetHost,
        [AXTN_EDGE_HEADERS.requestProto]: "https",
        ...overrides,
      },
    });
  }

  it("accepts only the exact id, HTTPS target, and original host", () => {
    expect(validateAxtnEdgeRequest(edgeRequest(), extension)).toEqual({ ok: true });
    expect(
      validateAxtnEdgeRequest(
        edgeRequest({ [AXTN_EDGE_HEADERS.extensionId]: "another-extension" }),
        extension,
      ),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      validateAxtnEdgeRequest(
        edgeRequest({ [AXTN_EDGE_HEADERS.requestHost]: "other.example.com" }),
        extension,
      ),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      validateAxtnEdgeRequest(edgeRequest({ [AXTN_EDGE_HEADERS.requestProto]: "http" }), extension),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it("rejects duplicate query fields and reads the opaque access cookie", () => {
    const duplicated = new URL("https://example.com/?ticket=one&ticket=two");
    expect(readSingleSearchParam(duplicated, "ticket")).toBeNull();

    const request = new Request("https://maintenance.example.com/", {
      headers: {
        cookie: `theme=dark; ${AXTN_EXTENSION_ACCESS_COOKIE}=axtn_s_value; other=yes`,
      },
    });
    expect(readCookie(request, AXTN_EXTENSION_ACCESS_COOKIE)).toBe("axtn_s_value");
  });
});

describe("aXtn server and deployment guards", () => {
  const functionsSource = readFileSync("src/utils/axtnSystemExtensions.functions.ts", "utf8");
  const iamSource = readFileSync("src/utils/iam.server.ts", "utf8");
  const migration = readFileSync(
    "supabase/migrations/20260899990002_axtn_extension_access_redeem.sql",
    "utf8",
  );
  const caddy = readFileSync("deploy/axtn/caddy.extension-access.v1.caddy", "utf8");

  it("requires a verified AAL2 superadmin for listing and ticket issuance", () => {
    expect(functionsSource.match(/requireSuperadminAal2\(/g)).toHaveLength(2);
    expect(iamSource).toMatch(/supabaseAdmin\.auth\.getClaims\(accessToken\)/);
    expect(iamSource).toMatch(/claims\.aal !== "aal2"/);
  });

  it("atomically binds redemption to id, target, host, expiry and unused state", () => {
    expect(migration).toMatch(/WITH consumed AS \(\s*UPDATE[\s\S]+SET used_at = now\(\)/);
    expect(migration).toMatch(/t\.id = _ticket_id/);
    expect(migration).toMatch(/t\.extension_id = _extension_id/);
    expect(migration).toMatch(/t\.target_url = _target_url/);
    expect(migration).toMatch(/t\.target_host = _target_host/);
    expect(migration).toMatch(/t\.used_at IS NULL/);
    expect(migration).toMatch(/t\.expires_at > now\(\)/);
    expect(migration).toMatch(/FROM consumed c/);
    expect(migration).toMatch(/TO service_role/);
    expect(migration).toMatch(/FROM PUBLIC, anon, authenticated/);
  });

  it("uses Caddy only as a network gate and preserves target authentication", () => {
    expect(caddy).toMatch(/forward_auth \{args\[2\]\}/);
    expect(caddy).toMatch(/uri \/api\/axtn\/extension-access\/authorize/);
    expect(caddy).toMatch(/header_up X-Axtn-Target \{args\[1\]\}/);
    expect(caddy).toMatch(/reverse_proxy \{args\[3\]\}/);
    expect(caddy).not.toMatch(/^\s*copy_headers\b/m);
    expect(caddy).not.toMatch(/^\s*header_up (?:Authorization|X-(?:User|Email|Remote-User))\b/m);
  });
});
