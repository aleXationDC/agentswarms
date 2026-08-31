import { createFileRoute } from "@tanstack/react-router";

import {
  AXTN_EDGE_HEADERS,
  AXTN_EXTENSION_ACCESS_COOKIE,
  readCookie,
  validateAxtnEdgeRequest,
} from "@/lib/axtnExtensionAccess";
import {
  authorizeAxtnExtensionSession,
  configuredAxtnSystemExtension,
} from "@/utils/axtnExtensionAccess.server";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Type": "text/plain; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
} as const;

async function handle(request: Request): Promise<Response> {
  try {
    const extensionId = request.headers.get(AXTN_EDGE_HEADERS.extensionId);
    const targetUrl = request.headers.get(AXTN_EDGE_HEADERS.target);
    if (!extensionId || !targetUrl) {
      return new Response("Missing extension edge binding.", {
        status: 400,
        headers: NO_STORE_HEADERS,
      });
    }

    const extension = configuredAxtnSystemExtension(extensionId, targetUrl);
    if (!extension) {
      return new Response("Extension target is not allowed.", {
        status: 403,
        headers: NO_STORE_HEADERS,
      });
    }
    const edge = validateAxtnEdgeRequest(request, extension);
    if (!edge.ok) {
      return new Response(edge.error, { status: edge.status, headers: NO_STORE_HEADERS });
    }

    const token = readCookie(request, AXTN_EXTENSION_ACCESS_COOKIE);
    if (!token || !(await authorizeAxtnExtensionSession(extension, token))) {
      return new Response("Maintenance access required.", {
        status: 403,
        headers: NO_STORE_HEADERS,
      });
    }

    // This is only a network-edge decision. Deliberately return no user,
    // Authorization, or identity headers that the target could mistake for
    // application authentication.
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(
      "[axtn-extension-access] authorize route failed:",
      error instanceof Error ? error.message : error,
    );
    return new Response("Extension access is temporarily unavailable.", {
      status: 503,
      headers: NO_STORE_HEADERS,
    });
  }
}

export const Route = createFileRoute("/api/axtn/extension-access/authorize")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
    },
  },
});
