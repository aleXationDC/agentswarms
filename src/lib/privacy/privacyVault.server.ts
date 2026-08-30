// The Privacy/Identity Vault (DMS-D1-0002 §5).
//
// This is the ONLY place allowed to hold the reversible mapping between a
// clear PII value and its opaque, provider-facing pseudonym token. It talks
// to `public.privacy_vault_tokens` exclusively through `supabaseAdmin` (the
// service-role client) — that table has RLS enabled with NO policies, so no
// authenticated user, agent tool, or PostgREST caller can reach it. Only this
// module, called from the privacy service running inside the AgentSwarms
// server, may resolve a token back to its clear value.
//
// Callers MUST NOT log the clear value, the ciphertext, or the token mapping.
// A pseudonym token itself (e.g. "PERSON-a1b2c3d4") is safe to log/use in
// prompts — the whole point is that it carries no clear PII.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  currentVaultKid,
  decryptVaultValue,
  encryptVaultValue,
  privacyVaultConfigured,
} from "@/lib/privacy/vaultCrypto.server";

export type EntityType =
  | "person"
  | "email"
  | "phone"
  | "address"
  | "iban"
  | "payment_card"
  | "tax_id"
  | "id_document"
  | "other";

const TOKEN_PREFIX: Record<EntityType, string> = {
  person: "PERSON",
  email: "EMAIL",
  phone: "PHONE",
  address: "ADDR",
  iban: "IBAN",
  payment_card: "CARD",
  tax_id: "TAXID",
  id_document: "IDDOC",
  other: "PII",
};

function randomHex(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  let s = "";
  for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, "0");
  return s;
}

/**
 * Resolve the stable pseudonym token for one entity value, creating it on
 * first sight. Same `entityKey` (see entityResolution.server.ts for how that
 * is derived) always yields the same token for a given owner, so cross-document
 * identity stays usable locally without ever exposing the clear value.
 *
 * Fails closed: throws if the vault secret isn't configured or the DB call
 * fails, rather than falling back to sending clear text externally.
 */
export async function getOrCreatePseudonymToken(args: {
  userId: string;
  entityType: EntityType;
  entityKey: string;
  clearValue: string;
}): Promise<string> {
  if (!privacyVaultConfigured()) {
    throw new Error(
      "PRIVACY_VAULT_SECRET is not configured — refusing to pseudonymise (fail closed)",
    );
  }
  const { userId, entityType, entityKey, clearValue } = args;

  const { data: existing, error: selErr } = await supabaseAdmin
    .from("privacy_vault_tokens")
    .select("pseudonym_token")
    .eq("user_id", userId)
    .eq("entity_key", entityKey)
    .maybeSingle();
  if (selErr) throw new Error(`Privacy Vault lookup failed: ${selErr.message}`);
  if (existing?.pseudonym_token) {
    await supabaseAdmin
      .from("privacy_vault_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("entity_key", entityKey);
    return existing.pseudonym_token;
  }

  const { ciphertext, iv, kid } = await encryptVaultValue(clearValue);
  const prefix = TOKEN_PREFIX[entityType];

  // Collisions on the random suffix are astronomically unlikely (8 random
  // bytes) but retried rather than assumed impossible, since the token must
  // be unique per owner (unique (user_id, pseudonym_token) in the migration).
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = `${prefix}-${randomHex(8)}`;
    const { error: insErr } = await supabaseAdmin.from("privacy_vault_tokens").insert({
      user_id: userId,
      pseudonym_token: token,
      entity_key: entityKey,
      entity_type: entityType,
      ciphertext,
      iv,
      key_id: kid ?? (await currentVaultKid()),
    });
    if (!insErr) return token;
    // 23505 = unique_violation. Any other error is a real failure.
    if ((insErr as { code?: string }).code !== "23505") {
      throw new Error(`Privacy Vault insert failed: ${insErr.message}`);
    }
  }
  throw new Error("Privacy Vault: could not allocate a unique pseudonym token");
}

/**
 * Resolve a pseudonym token back to its clear value. Only ever called by the
 * server-side privacy service itself (e.g. to answer a human-review request
 * showing the reviewer the real text) — never returned to an agent tool, a
 * prompt, or a log line.
 */
export async function resolveClearValue(args: {
  userId: string;
  pseudonymToken: string;
}): Promise<string | null> {
  const { userId, pseudonymToken } = args;
  const { data, error } = await supabaseAdmin
    .from("privacy_vault_tokens")
    .select("ciphertext, iv, key_id")
    .eq("user_id", userId)
    .eq("pseudonym_token", pseudonymToken)
    .maybeSingle();
  if (error) throw new Error(`Privacy Vault lookup failed: ${error.message}`);
  if (!data) return null;
  return decryptVaultValue({
    ciphertext: data.ciphertext,
    iv: data.iv,
    kid: data.key_id ?? undefined,
  });
}
