import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const authMocks = vi.hoisted(() => ({
  challengeAndVerify: vi.fn(),
  getSession: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      mfa: {
        challengeAndVerify: authMocks.challengeAndVerify,
        getAuthenticatorAssuranceLevel: authMocks.getAuthenticatorAssuranceLevel,
      },
      getSession: authMocks.getSession,
    },
  },
}));

import { reauthenticateWithTotp } from "@/lib/totpReauthentication";

describe("native TOTP reauthentication", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMocks.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
    authMocks.getSession.mockResolvedValue({
      data: { session: { access_token: "verified-session" } },
      error: null,
    });
    authMocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal2" },
      error: null,
    });
  });

  it("uses the existing native challenge-and-verify flow and confirms the refreshed AAL2 session", async () => {
    await expect(reauthenticateWithTotp("existing-factor", "123456")).resolves.toBeUndefined();

    expect(authMocks.challengeAndVerify).toHaveBeenCalledWith({
      factorId: "existing-factor",
      code: "123456",
    });
    expect(authMocks.getSession).toHaveBeenCalledOnce();
    expect(authMocks.getAuthenticatorAssuranceLevel).toHaveBeenCalledWith("verified-session");
  });

  it("rejects malformed codes without creating a challenge", async () => {
    await expect(reauthenticateWithTotp("existing-factor", "12ab")).rejects.toThrow(
      /six-digit authenticator code/,
    );
    expect(authMocks.challengeAndVerify).not.toHaveBeenCalled();
  });

  it("rejects an invalid or expired authenticator code and preserves the existing session", async () => {
    authMocks.challengeAndVerify.mockResolvedValue({
      data: null,
      error: new Error("Invalid TOTP code"),
    });

    await expect(reauthenticateWithTotp("existing-factor", "000000")).rejects.toThrow(
      "Invalid TOTP code",
    );
    expect(authMocks.getSession).not.toHaveBeenCalled();
    expect(authMocks.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it("does not claim success when the refreshed session is still AAL1", async () => {
    authMocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: "aal1" },
      error: null,
    });

    await expect(reauthenticateWithTotp("existing-factor", "123456")).rejects.toThrow(
      /did not elevate this session to AAL2/,
    );
  });

  it("fails if verification does not persist a session", async () => {
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(reauthenticateWithTotp("existing-factor", "123456")).rejects.toThrow(
      /refreshed session is unavailable/,
    );
    expect(authMocks.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
  });

  it("offers the existing factor from Account and Maintenance while keeping server AAL2 enforcement", () => {
    const account = readFileSync("src/routes/_authenticated/account.tsx", "utf8");
    const maintenance = readFileSync(
      "src/routes/_authenticated/admin/axtn-maintenance.tsx",
      "utf8",
    );
    const endpoint = readFileSync("src/routes/api/axtn.maintenance.ts", "utf8");

    expect(account).toMatch(/mfaLevel === "aal1"[\s\S]*?<TotpReauthentication/);
    expect(maintenance).toMatch(
      /mfa\?\.enrolled && mfa\.level !== "aal2"[\s\S]*?<TotpReauthentication/,
    );
    expect(endpoint).toMatch(/assurance\.aal !== "aal2"/);
  });
});
