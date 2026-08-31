import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import {
  AXTN_ACCESS_SESSION_TTL_SECONDS,
  AXTN_EXTENSION_ACCESS_COOKIE,
  readSingleSearchParam,
  validateAxtnEdgeRequest,
} from "@/lib/axtnExtensionAccess";
import { auditEvent } from "@/utils/audit.server";
import {
  configuredAxtnSystemExtension,
  redeemAxtnExtensionTicket,
} from "@/utils/axtnExtensionAccess.server";

const TicketIdSchema = z.string().uuid();

const SECURITY_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

function refuse(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: SECURITY_HEADERS });
}

function accessCookie(token: string, expiresAt: string): string {
  const remaining = Math.max(
    0,
    Math.min(
      AXTN_ACCESS_SESSION_TTL_SECONDS,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
    ),
  );
  return [
    `${AXTN_EXTENSION_ACCESS_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${remaining}`,
    `Expires=${new Date(expiresAt).toUTCString()}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Priority=High",
  ].join("; ");
}

async function handle(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const extensionId = readSingleSearchParam(url, "id");
    const targetUrl = readSingleSearchParam(url, "target");
    const ticketId = readSingleSearchParam(url, "ticket_id");
    const ticketToken = readSingleSearchParam(url, "ticket");
    if (!extensionId || !targetUrl || !ticketId || !ticketToken) {
      return refuse(400, "Malformed extension access link.");
    }
    if (!TicketIdSchema.safeParse(ticketId).success) {
      return refuse(400, "Malformed extension access link.");
    }

    const extension = configuredAxtnSystemExtension(extensionId, targetUrl);
    if (!extension) return refuse(403, "Extension target is not allowed.");
    const edge = validateAxtnEdgeRequest(request, extension);
    if (!edge.ok) return refuse(edge.status, edge.error);

    const redeemed = await redeemAxtnExtensionTicket({
      extension,
      ticketId,
      ticketToken,
    });
    if (!redeemed) {
      return refuse(401, "Extension access link is invalid, expired, or already used.");
    }

    auditEvent({
      userId: redeemed.userId,
      action: "system_extension.access_ticket.redeem",
      resourceType: "system_extension",
      resourceName: extension.label,
      resourceId: redeemed.ticketId,
      detail: {
        extension_id: extension.id,
        target_host: extension.targetHost,
        session_expires_at: redeemed.sessionExpiresAt,
      },
    });

    return new Response(null, {
      status: 303,
      headers: {
        ...SECURITY_HEADERS,
        Location: extension.url,
        "Set-Cookie": accessCookie(redeemed.sessionToken, redeemed.sessionExpiresAt),
      },
    });
  } catch (error) {
    console.error(
      "[axtn-extension-access] redeem route failed:",
      error instanceof Error ? error.message : error,
    );
    return refuse(503, "Extension access is temporarily unavailable.");
  }
}

export const Route = createFileRoute("/api/axtn/extension-access/redeem")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
    },
  },
});
