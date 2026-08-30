// Privacy Vault crypto primitive (DMS-D1-0002 §5). Pure round-trip / failure
// tests — no database. Verifies the same proven AES-256-GCM + kid pattern as
// src/utils/providers/crypto.server.ts, kept as its own secret domain.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const ORIGINAL_SECRET = process.env.PRIVACY_VAULT_SECRET;
const ORIGINAL_OLD = process.env.PRIVACY_VAULT_SECRET_OLD;

describe("Privacy Vault crypto", () => {
  beforeEach(() => {
    process.env.PRIVACY_VAULT_SECRET = "test-privacy-vault-secret-v1";
    delete process.env.PRIVACY_VAULT_SECRET_OLD;
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.PRIVACY_VAULT_SECRET;
    else process.env.PRIVACY_VAULT_SECRET = ORIGINAL_SECRET;
    if (ORIGINAL_OLD === undefined) delete process.env.PRIVACY_VAULT_SECRET_OLD;
    else process.env.PRIVACY_VAULT_SECRET_OLD = ORIGINAL_OLD;
  });

  it("round-trips a clear value through encrypt/decrypt", async () => {
    const { encryptVaultValue, decryptVaultValue } =
      await import("@/lib/privacy/vaultCrypto.server");
    const blob = await encryptVaultValue("Max Mustermann");
    expect(blob.ciphertext).not.toContain("Max Mustermann");
    const clear = await decryptVaultValue(blob);
    expect(clear).toBe("Max Mustermann");
  });

  it("stamps a kid and reports it via currentVaultKid", async () => {
    const { encryptVaultValue, currentVaultKid } = await import("@/lib/privacy/vaultCrypto.server");
    const blob = await encryptVaultValue("some value");
    const kid = await currentVaultKid();
    expect(blob.kid).toBe(kid);
  });

  it("still decrypts a blob encrypted under a rotated-out previous secret", async () => {
    const mod = await import("@/lib/privacy/vaultCrypto.server");
    const blob = await mod.encryptVaultValue("rotation-test-value");

    // Rotate: the old secret moves to _OLD, a new one becomes current.
    process.env.PRIVACY_VAULT_SECRET_OLD = "test-privacy-vault-secret-v1";
    process.env.PRIVACY_VAULT_SECRET = "test-privacy-vault-secret-v2";

    const clear = await mod.decryptVaultValue(blob);
    expect(clear).toBe("rotation-test-value");
  });

  it("throws rather than returning garbage when no configured key matches", async () => {
    const mod = await import("@/lib/privacy/vaultCrypto.server");
    const blob = await mod.encryptVaultValue("value-under-v1");

    process.env.PRIVACY_VAULT_SECRET = "an-entirely-different-secret";
    delete process.env.PRIVACY_VAULT_SECRET_OLD;

    await expect(mod.decryptVaultValue(blob)).rejects.toThrow();
  });

  it("privacyVaultConfigured reflects whether the secret env var is set", async () => {
    const mod = await import("@/lib/privacy/vaultCrypto.server");
    expect(mod.privacyVaultConfigured()).toBe(true);
    delete process.env.PRIVACY_VAULT_SECRET;
    expect(mod.privacyVaultConfigured()).toBe(false);
  });
});
