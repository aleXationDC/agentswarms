import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { AxtnSystemExtension } from "@/lib/axtnExtensionAccess";
import { auditEvent } from "@/utils/audit.server";
import {
  closeAxtnExtensionAccess,
  configuredAxtnSystemExtension,
  configuredAxtnSystemExtensions,
  getAxtnExtensionAccessStatus,
  issueAxtnExtensionTicket,
} from "@/utils/axtnExtensionAccess.server";
import { requireSuperadminAal2 } from "@/utils/iam.server";

const AuthInput = z.object({ access_token: z.string().min(1) });

export type AxtnSystemExtensionWithAccessStatus = AxtnSystemExtension & {
  maintenanceExpiresAt: string | null;
  health: "healthy" | "unhealthy";
};

const extensionHealthUrls: Record<string, string> = {
  gitea: "http://axtn-gitea:3000/api/healthz",
  n8n: "http://axtn-n8n:5678/healthz",
  "matrix-admin": "http://matrix-ketesa:8080/",
};

async function checkSystemExtensionHealth(extensionId: string): Promise<"healthy" | "unhealthy"> {
  const url = extensionHealthUrls[extensionId];
  if (!url) return "unhealthy";
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    return response.ok ? "healthy" : "unhealthy";
  } catch {
    return "unhealthy";
  }
}

export const axtnListSystemExtensions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AuthInput.parse(input))
  .handler(async ({ data }): Promise<AxtnSystemExtensionWithAccessStatus[]> => {
    const guard = await requireSuperadminAal2(data.access_token);
    if (!guard.ok) throw new Error(guard.error);
    return Promise.all(
      configuredAxtnSystemExtensions().map(async (extension) => ({
        ...extension,
        maintenanceExpiresAt: (await getAxtnExtensionAccessStatus(extension, guard.userId))
          .expiresAt,
        health: await checkSystemExtensionHealth(extension.id),
      })),
    );
  });

export const axtnIssueSystemExtensionTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    AuthInput.extend({ extension_id: z.string().regex(/^[a-z0-9-]+$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ redeem_url: string; expires_at: string }> => {
    const guard = await requireSuperadminAal2(data.access_token);
    if (!guard.ok) throw new Error(guard.error);

    const extension = configuredAxtnSystemExtension(data.extension_id);
    if (!extension) throw new Error("System extension is not configured.");
    const issued = await issueAxtnExtensionTicket(extension, guard.userId);

    auditEvent({
      userId: guard.userId,
      actorEmail: guard.email,
      action: "system_extension.access_ticket.issue",
      resourceType: "system_extension",
      resourceName: extension.label,
      resourceId: issued.ticketId,
      detail: {
        extension_id: extension.id,
        target_host: extension.targetHost,
        expires_at: issued.expiresAt,
      },
    });

    return { redeem_url: issued.redeemUrl, expires_at: issued.expiresAt };
  });

export const axtnCloseSystemExtensionAccess = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    AuthInput.extend({ extension_id: z.string().regex(/^[a-z0-9-]+$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ revoked_count: number }> => {
    const guard = await requireSuperadminAal2(data.access_token);
    if (!guard.ok) throw new Error(guard.error);

    const extension = configuredAxtnSystemExtension(data.extension_id);
    if (!extension) throw new Error("System extension is not configured.");
    const closed = await closeAxtnExtensionAccess(extension, guard.userId);

    auditEvent({
      userId: guard.userId,
      actorEmail: guard.email,
      action: "system_extension.access.close",
      resourceType: "system_extension",
      resourceName: extension.label,
      detail: {
        extension_id: extension.id,
        target_host: extension.targetHost,
        revoked_count: closed.revokedCount,
      },
    });

    return { revoked_count: closed.revokedCount };
  });

export type { AxtnSystemExtension } from "@/lib/axtnExtensionAccess";
