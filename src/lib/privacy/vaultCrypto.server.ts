// AES-256-GCM helpers for the Privacy Vault (DMS-D1-0002 §5).
//
// This is a deliberate SIBLING of src/utils/providers/crypto.server.ts, not a
// re-export of it: the Privacy Vault is its own security domain ("SECURITY
// MATERIAL, not knowledge") and must rotate independently of provider API
// credentials. Reusing PROVIDER_CREDS_SECRET here would mean a provider-key
// leak or rotation event also exposes/invalidates PII pseudonym mappings, and
// vice versa — two domains that should never share a blast radius.
//
// The algorithm and key-rotation shape are intentionally identical to the
// provider-credentials module (proven AES-256-GCM + kid fingerprinting), just
// keyed by its own secret:
//   PRIVACY_VAULT_SECRET       the CURRENT key — everything new is encrypted
//                              with it.
//   PRIVACY_VAULT_SECRET_OLD   zero or more PREVIOUS keys (comma-separated),
//                              still accepted for DECRYPTION during rotation.
//
// Server-only. Never import from client code.
const ALGO = "AES-GCM";
const KID_DOMAIN = "agentswarms/privacy-vault-kid/v1|";

export type EncryptedBlob = { ciphertext: string; iv: string; kid?: string };

function bytesToHex(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, "0");
  return s;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle
    .digest("SHA-256", enc.encode(secret))
    .then((hash) =>
      crypto.subtle.importKey("raw", hash, { name: ALGO }, false, ["encrypt", "decrypt"]),
    );
}

async function deriveKid(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const h = await crypto.subtle.digest("SHA-256", enc.encode(KID_DOMAIN + secret));
  return bytesToHex(new Uint8Array(h)).slice(0, 12);
}

// DMS-D1-0002R Phase A5. `deriveEntityKey` (entityResolution.server.ts) used
// to hash `type|normalizedValue` with a bare, unkeyed SHA-256 — over a
// low-entropy clear value (an email address, a phone number, a name), that is
// dictionary/rainbow-table breakable by anyone who can read the entity_key
// column, defeating the whole point of keeping the clear value Vault-only.
// HMAC-SHA256, keyed by the SAME rotating secret as every other Privacy Vault
// value, closes that: recovering a value from its key now requires the vault
// secret, not just the dataset row.
const ENTITY_KEY_DOMAIN = "agentswarms/entity-key/v2|";

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

const hmacKeyCache = new Map<string, Promise<CryptoKey>>();
function hmacKeyFor(secret: string): Promise<CryptoKey> {
  let k = hmacKeyCache.get(secret);
  if (!k) {
    k = importHmacKey(secret);
    hmacKeyCache.set(secret, k);
  }
  return k;
}

/**
 * HMAC-SHA256(current vault secret, domainTag|normalizedValue), truncated to
 * 24 hex chars (same shape as the previous bare-digest key, so existing
 * entity_resolution rows stay the right length). Always keyed by the
 * CURRENT secret only — unlike token decryption, entity keys are never
 * decrypted, so there is nothing to try under old keys; a rotation simply
 * means entities re-resolve as new candidates going forward, which is safe
 * (native "unknown stays reviewable" behaviour), never silently wrong.
 */
export async function deriveEntityLookupKey(
  domainTag: string,
  normalizedValue: string,
): Promise<string> {
  const { current } = readKeyring();
  const key = await hmacKeyFor(current);
  const enc = new TextEncoder();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${ENTITY_KEY_DOMAIN}${domainTag}|${normalizedValue}`),
  );
  return bytesToHex(new Uint8Array(sig)).slice(0, 24);
}


const keyCache = new Map<string, { key: Promise<CryptoKey>; kid: Promise<string> }>();
function keyFor(secret: string) {
  let e = keyCache.get(secret);
  if (!e) {
    e = { key: deriveKey(secret), kid: deriveKid(secret) };
    keyCache.set(secret, e);
  }
  return e;
}

function readKeyring(): { current: string; previous: string[] } {
  const current = process.env.PRIVACY_VAULT_SECRET;
  if (!current) throw new Error("PRIVACY_VAULT_SECRET is not configured");
  const previous = (process.env.PRIVACY_VAULT_SECRET_OLD ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== current);
  return { current, previous };
}

/** True when the Privacy Vault secret is configured — used to fail closed. */
export function privacyVaultConfigured(): boolean {
  return !!process.env.PRIVACY_VAULT_SECRET;
}

export async function currentVaultKid(): Promise<string> {
  return keyFor(readKeyring().current).kid;
}

export async function encryptVaultValue(clearValue: string): Promise<EncryptedBlob> {
  const { current } = readKeyring();
  const { key, kid } = keyFor(current);
  const k = await key;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(clearValue);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: ALGO, iv }, k, data));
  return { ciphertext: bytesToBase64(ct), iv: bytesToBase64(iv), kid: await kid };
}

/**
 * Decrypt a Privacy Vault value. GCM authenticates, so a wrong key throws
 * rather than returning garbage — callers must treat a throw as "cannot
 * resolve this token" and fail closed, never fall back to a guess.
 */
export async function decryptVaultValue(blob: EncryptedBlob): Promise<string> {
  const { current, previous } = readKeyring();
  const secrets = [current, ...previous];

  let ordered = secrets;
  if (blob.kid) {
    const preferred: string[] = [];
    for (const s of secrets) if ((await keyFor(s).kid) === blob.kid) preferred.push(s);
    if (preferred.length)
      ordered = [...preferred, ...secrets.filter((s) => !preferred.includes(s))];
  }

  const ct = base64ToBytes(blob.ciphertext);
  const ivBytes = base64ToBytes(blob.iv);
  const ctBuf = ct.buffer.slice(ct.byteOffset, ct.byteOffset + ct.byteLength) as ArrayBuffer;
  const ivBuf = ivBytes.buffer.slice(
    ivBytes.byteOffset,
    ivBytes.byteOffset + ivBytes.byteLength,
  ) as ArrayBuffer;

  let lastErr: unknown;
  for (const s of ordered) {
    try {
      const k = await keyFor(s).key;
      const plain = await crypto.subtle.decrypt({ name: ALGO, iv: ivBuf }, k, ctBuf);
      return new TextDecoder().decode(plain);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("Privacy Vault decryption failed under every configured key");
}
