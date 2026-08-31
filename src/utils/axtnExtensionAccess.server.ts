import { createHash, randomBytes } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  AXTN_ACCESS_SESSION_TTL_SECONDS,
  AXTN_TICKET_TTL_SECONDS,
  buildAxtnExtensionRedeemUrl,
  parseAxtnSystemExtensions,
  type AxtnSystemExtension,
} from "@/lib/axtnExtensionAccess";

const TICKET_TOKEN_RE = /^axtn_t_[A-Za-z0-9_-]{43}$/;
const SESSION_TOKEN_RE = /^axtn_s_[A-Za-z0-9_-]{43}$/;

export type IssuedAxtnExtensionTicket = {
  ticketId: string;
  redeemUrl: string;
  expiresAt: string;
};

export type RedeemedAxtnExtensionTicket = {
  sessionToken: string;
  sessionExpiresAt: string;
  userId: string;
  ticketId: string;
};

export type AxtnExtensionAccessStatus = {
  expiresAt: string | null;
};

export function configuredAxtnSystemExtensions(): AxtnSystemExtension[] {
  try {
    return parseAxtnSystemExtensions(process.env.AXTN_SYSTEM_EXTENSIONS);
  } catch (error) {
    throw new Error(
      `AXTN_SYSTEM_EXTENSIONS is invalid: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export function configuredAxtnSystemExtension(
  extensionId: string,
  targetUrl?: string,
): AxtnSystemExtension | null {
  const extension =
    configuredAxtnSystemExtensions().find((candidate) => candidate.id === extensionId) ?? null;
  if (!extension || (targetUrl !== undefined && extension.url !== targetUrl)) return null;
  return extension;
}

function hashCapability(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function capability(prefix: "axtn_t_" | "axtn_s_"): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

export async function issueAxtnExtensionTicket(
  extension: AxtnSystemExtension,
  userId: string,
): Promise<IssuedAxtnExtensionTicket> {
  const token = capability("axtn_t_");
  const expiresAt = new Date(Date.now() + AXTN_TICKET_TTL_SECONDS * 1000).toISOString();
  const { data: ticketId, error } = await supabaseAdmin.rpc("axtn_issue_extension_access_ticket", {
    _extension_id: extension.id,
    _target_url: extension.url,
    _target_host: extension.targetHost,
    _token_hash: hashCapability(token),
    _expires_at: expiresAt,
    _created_by: userId,
  });
  if (error || !ticketId) {
    throw new Error(error?.message ?? "Could not issue extension access ticket.");
  }

  return {
    ticketId,
    redeemUrl: buildAxtnExtensionRedeemUrl(extension, ticketId, token),
    expiresAt,
  };
}

export async function redeemAxtnExtensionTicket(args: {
  extension: AxtnSystemExtension;
  ticketId: string;
  ticketToken: string;
}): Promise<RedeemedAxtnExtensionTicket | null> {
  if (!TICKET_TOKEN_RE.test(args.ticketToken)) return null;

  const sessionToken = capability("axtn_s_");
  const sessionExpiresAt = new Date(
    Date.now() + AXTN_ACCESS_SESSION_TTL_SECONDS * 1000,
  ).toISOString();
  const { data, error } = await supabaseAdmin.rpc("axtn_redeem_extension_access_ticket", {
    _ticket_id: args.ticketId,
    _extension_id: args.extension.id,
    _target_url: args.extension.url,
    _target_host: args.extension.targetHost,
    _ticket_token_hash: hashCapability(args.ticketToken),
    _session_token_hash: hashCapability(sessionToken),
    _session_expires_at: sessionExpiresAt,
  });
  if (error) {
    console.error("[axtn-extension-access] ticket redeem failed:", error.message);
    throw new Error("Could not validate extension access ticket.");
  }

  const redeemed = data?.[0];
  if (!redeemed) return null;
  return {
    sessionToken,
    sessionExpiresAt: redeemed.session_expires_at,
    userId: redeemed.created_by,
    ticketId: redeemed.ticket_id,
  };
}

export async function authorizeAxtnExtensionSession(
  extension: AxtnSystemExtension,
  sessionToken: string,
): Promise<boolean> {
  if (!SESSION_TOKEN_RE.test(sessionToken)) return false;
  const { data, error } = await supabaseAdmin.rpc("axtn_authorize_extension_access_session", {
    _extension_id: extension.id,
    _target_url: extension.url,
    _target_host: extension.targetHost,
    _session_token_hash: hashCapability(sessionToken),
  });
  if (error) {
    console.error("[axtn-extension-access] session authorization failed:", error.message);
    throw new Error("Could not validate extension access session.");
  }
  return data === true;
}

export async function closeAxtnExtensionAccess(
  extension: AxtnSystemExtension,
  userId: string,
): Promise<{ revokedCount: number }> {
  const { data, error } = await supabaseAdmin.rpc("axtn_revoke_extension_access_for_user", {
    _extension_id: extension.id,
    _target_url: extension.url,
    _target_host: extension.targetHost,
    _created_by: userId,
  });
  if (error) {
    throw new Error(error.message || "Could not close extension access.");
  }
  return { revokedCount: data ?? 0 };
}

export async function getAxtnExtensionAccessStatus(
  extension: AxtnSystemExtension,
  userId: string,
): Promise<AxtnExtensionAccessStatus> {
  const { data, error } = await supabaseAdmin.rpc("axtn_get_extension_access_status", {
    _extension_id: extension.id,
    _target_url: extension.url,
    _target_host: extension.targetHost,
    _created_by: userId,
  });
  if (error) {
    throw new Error(error.message || "Could not load extension access status.");
  }
  return { expiresAt: data?.[0]?.expires_at ?? null };
}
