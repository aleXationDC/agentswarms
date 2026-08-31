import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { mfaErrorMessage, totpQrCodeSource } from "../../src/lib/totpEnrollment";

describe("TOTP enrollment", () => {
  it("uses the Supabase-provided SVG data URI without wrapping it again", () => {
    const qr = "data:image/svg+xml;utf-8,%3Csvg%3Eqr%3C%2Fsvg%3E";
    expect(totpQrCodeSource(qr)).toBe(qr);
  });

  it("supports raw SVG and legacy encoded SVG responses", () => {
    expect(totpQrCodeSource("<svg>qr</svg>")).toBe(
      "data:image/svg+xml;utf-8,%3Csvg%3Eqr%3C%2Fsvg%3E",
    );
    expect(totpQrCodeSource("%3Csvg%3Eqr%3C%2Fsvg%3E")).toBe(
      "data:image/svg+xml;utf-8,%3Csvg%3Eqr%3C%2Fsvg%3E",
    );
  });

  it("gives actionable guidance for a browser-inaccessible Supabase URL", () => {
    expect(mfaErrorMessage(new TypeError("Failed to fetch"), "Could not enroll.")).toMatch(
      /VITE_SUPABASE_URL must be a browser-reachable URL/,
    );
  });

  it("cleans abandoned factors and does not double-encode the rendered QR code", () => {
    const account = readFileSync("src/routes/_authenticated/account.tsx", "utf8");
    expect(account).toMatch(/factor\.status !== "unverified"/);
    expect(account).toMatch(/supabase\.auth\.mfa\.unenroll\(\{\s*factorId: factor\.id/);
    expect(account).toMatch(/src=\{enrollment\.qrCode\}/);
    expect(account).not.toMatch(/encodeURIComponent\(enrollment\.qrCode\)/);
    expect(account).toMatch(/cancelTotpEnrollment/);
  });
});
