import { createFileRoute } from "@tanstack/react-router";

import {
  AXTN_EXTENSION_ACCESS_COOKIE,
  readSingleSearchParam,
  validateAxtnEdgeRequest,
} from "@/lib/axtnExtensionAccess";
import { configuredAxtnSystemExtension } from "@/utils/axtnExtensionAccess.server";

const SECURITY_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

function refuse(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: SECURITY_HEADERS });
}

function clearAccessCookie(): string {
  return [
    `${AXTN_EXTENSION_ACCESS_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Priority=High",
  ].join("; ");
}

function handle(request: Request): Response {
  try {
    const url = new URL(request.url);
    const extensionId = readSingleSearchParam(url, "id");
    const targetUrl = readSingleSearchParam(url, "target");
    if (!extensionId || !targetUrl) return refuse(400, "Malformed maintenance close link.");

    const extension = configuredAxtnSystemExtension(extensionId, targetUrl);
    if (!extension) return refuse(403, "Extension target is not allowed.");
    const edge = validateAxtnEdgeRequest(request, extension);
    if (!edge.ok) return refuse(edge.status, edge.error);

    return new Response(null, {
      status: 303,
      headers: {
        ...SECURITY_HEADERS,
        Location: extension.url,
        "Set-Cookie": clearAccessCookie(),
      },
    });
  } catch (error) {
    console.error(
      "[axtn-extension-access] close route failed:",
      error instanceof Error ? error.message : error,
    );
    return refuse(503, "Maintenance close is temporarily unavailable.");
  }
}

export const Route = createFileRoute("/api/axtn/extension-access/close")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
    },
  },
});
