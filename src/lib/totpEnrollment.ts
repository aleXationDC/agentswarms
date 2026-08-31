export function totpQrCodeSource(qrCode: string): string {
  const value = qrCode.trim();
  if (!value) throw new Error("Supabase returned an empty TOTP QR code.");
  if (/^data:image\/svg\+xml(?:;[^,]*)?,/i.test(value)) return value;
  if (value.startsWith("<svg")) {
    return `data:image/svg+xml;utf-8,${encodeURIComponent(value)}`;
  }
  return `data:image/svg+xml;utf-8,${value}`;
}

export function mfaErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return `${fallback} The browser could not reach the configured Supabase API. VITE_SUPABASE_URL must be a browser-reachable URL, not a Docker-only hostname.`;
  }
  return message;
}
