import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { AxtnSystemExtension } from "@/lib/axtnExtensionAccess";
import { auditEvent } from "@/utils/audit.server";
import {
  closeAxtnExtensionAccess,
  configuredAxtnSystemExtension,
  configuredAxtnSystemExtensions,
  issueAxtnExtensionTicket,
} from "@/utils/axtnExtensionAccess.server";
import { requireSuperadminAal2 } from "@/utils/iam.server";

const AuthInput = z.object({ access_token: z.string().min(1) });

export const axtnListSystemExtensions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AuthInput.parse(input))
  .handler(async ({ data }): Promise<AxtnSystemExtension[]> => {
    const guard = await requireSuperadminAal2(data.access_token);
    if (!guard.ok) throw new Error(guard.error);
    return configuredAxtnSystemExtensions();
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
  .handler(async ({ data }): Promise<{ close_url: string; revoked_count: number }> => {
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

    return { close_url: closed.closeUrl, revoked_count: closed.revokedCount };
  });

export type { AxtnSystemExtension } from "@/lib/axtnExtensionAccess";
