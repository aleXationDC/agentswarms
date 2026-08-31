import { z } from "zod";

export const AXTN_EXTENSION_REDEEM_PATH = "/_axtn/extension-access/redeem";
export const AXTN_EXTENSION_CLOSE_PATH = "/_axtn/extension-access/close";
export const AXTN_EXTENSION_ACCESS_COOKIE = "__Host-axtn_extension_access";
export const AXTN_TICKET_TTL_SECONDS = 90;
export const AXTN_ACCESS_SESSION_TTL_SECONDS = 15 * 60;

export const AXTN_EDGE_HEADERS = {
  extensionId: "x-axtn-extension-id",
  requestHost: "x-axtn-request-host",
  requestProto: "x-axtn-request-proto",
  target: "x-axtn-target",
} as const;

const RawExtensionSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/),
  label: z.string().trim().min(1).max(100),
  url: z.string().trim().url(),
  description: z.string().trim().min(1).max(300),
});

const RawExtensionsSchema = z.array(RawExtensionSchema).max(20);

export type AxtnSystemExtension = {
  id: string;
  label: string;
  url: string;
  targetHost: string;
  description: string;
};

function canonicalizeTarget(rawUrl: string): { url: string; host: string } {
  const target = new URL(rawUrl);
  if (target.protocol !== "https:") {
    throw new Error("System extension URLs must use HTTPS.");
  }
  if (target.username || target.password) {
    throw new Error("System extension URLs must not contain credentials.");
  }
  if (target.hash) {
    throw new Error("System extension URLs must not contain fragments.");
  }
  if ([AXTN_EXTENSION_REDEEM_PATH, AXTN_EXTENSION_CLOSE_PATH].includes(target.pathname)) {
    throw new Error("System extension URLs must not use a reserved extension-access path.");
  }

  return { url: target.toString(), host: target.host.toLowerCase() };
}

export function parseAxtnSystemExtensions(raw: string | undefined): AxtnSystemExtension[] {
  const value = raw?.trim();
  if (!value) return [];

  let decoded: unknown;
  try {
    decoded = JSON.parse(value);
  } catch {
    throw new Error("AXTN_SYSTEM_EXTENSIONS must be valid JSON.");
  }

  const parsed = RawExtensionsSchema.parse(decoded).map((extension) => {
    const target = canonicalizeTarget(extension.url);
    return { ...extension, url: target.url, targetHost: target.host };
  });

  const ids = new Set<string>();
  const hosts = new Set<string>();
  for (const extension of parsed) {
    if (ids.has(extension.id)) {
      throw new Error(`AXTN_SYSTEM_EXTENSIONS contains duplicate id "${extension.id}".`);
    }
    if (hosts.has(extension.targetHost)) {
      throw new Error(
        `AXTN_SYSTEM_EXTENSIONS contains more than one extension for host "${extension.targetHost}".`,
      );
    }
    ids.add(extension.id);
    hosts.add(extension.targetHost);
  }

  return parsed;
}

export function buildAxtnExtensionRedeemUrl(
  extension: AxtnSystemExtension,
  ticketId: string,
  ticketToken: string,
): string {
  const redeem = new URL(extension.url);
  redeem.pathname = AXTN_EXTENSION_REDEEM_PATH;
  redeem.search = "";
  redeem.hash = "";
  redeem.searchParams.set("id", extension.id);
  redeem.searchParams.set("target", extension.url);
  redeem.searchParams.set("ticket_id", ticketId);
  redeem.searchParams.set("ticket", ticketToken);
  return redeem.toString();
}

export function buildAxtnExtensionCloseUrl(extension: AxtnSystemExtension): string {
  const close = new URL(extension.url);
  close.pathname = AXTN_EXTENSION_CLOSE_PATH;
  close.search = "";
  close.hash = "";
  close.searchParams.set("id", extension.id);
  close.searchParams.set("target", extension.url);
  return close.toString();
}

function canonicalizeRequestHost(rawHost: string | null): string | null {
  if (!rawHost || rawHost.includes(",") || /[\s/@]/.test(rawHost)) return null;
  try {
    const parsed = new URL(`https://${rawHost}`);
    if (parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    return parsed.host.toLowerCase();
  } catch {
    return null;
  }
}

export type AxtnEdgeRequestCheck = { ok: true } | { ok: false; status: 400 | 403; error: string };

/**
 * Validate the Caddy-injected binding for a redeem/authorize request.
 *
 * Both the original Host header and a dedicated overwritten edge header must
 * match. This makes a stale or mis-wired virtual host fail closed instead of
 * accepting a ticket issued for another extension.
 */
export function validateAxtnEdgeRequest(
  request: Request,
  extension: AxtnSystemExtension,
): AxtnEdgeRequestCheck {
  const edgeId = request.headers.get(AXTN_EDGE_HEADERS.extensionId);
  const edgeTarget = request.headers.get(AXTN_EDGE_HEADERS.target);
  const edgeProto = request.headers.get(AXTN_EDGE_HEADERS.requestProto)?.toLowerCase();
  const edgeHost = canonicalizeRequestHost(request.headers.get(AXTN_EDGE_HEADERS.requestHost));
  const requestHost = canonicalizeRequestHost(request.headers.get("host"));

  if (!edgeId || !edgeTarget || !edgeProto || !edgeHost || !requestHost) {
    return { ok: false, status: 400, error: "Missing extension edge binding." };
  }
  if (edgeProto !== "https") {
    return { ok: false, status: 403, error: "Extension access requires HTTPS." };
  }
  if (
    edgeId !== extension.id ||
    edgeTarget !== extension.url ||
    edgeHost !== extension.targetHost ||
    requestHost !== extension.targetHost
  ) {
    return { ok: false, status: 403, error: "Extension edge binding does not match target." };
  }
  return { ok: true };
}

export function readSingleSearchParam(url: URL, name: string): string | null {
  const values = url.searchParams.getAll(name);
  return values.length === 1 && values[0] ? values[0] : null;
}

export function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie");
  if (!raw || raw.length > 16_384) return null;
  for (const part of raw.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    return value || null;
  }
  return null;
}
