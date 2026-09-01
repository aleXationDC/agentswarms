// Points the broker's Supabase client at the throwaway stack.
//
// The broker imports `supabaseAdmin` from client.server, which reads
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. That module builds its client
// lazily behind a Proxy — nothing is constructed at import time — so setting
// the variables before the first CALL is sufficient, and the code under test
// needs no seam, no injection parameter and no module mock. It runs exactly as
// it does in production.
//
// The variables are captured and restored so a stray real credential in the
// developer's shell cannot leak into the run, and the run cannot leave the
// process pointed at a container that is about to be destroyed.
import { startStack, stopStack, type Stack } from "./harness";

const SAVED: Record<string, string | undefined> = {};

function setEnv(key: string, value: string | undefined): void {
  if (!(key in SAVED)) SAVED[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

/**
 * Boots the stack and redirects the broker at it.
 *
 * Guards against the catastrophic failure mode for a suite that writes rows:
 * if SUPABASE_URL still names something that is not this run's container, the
 * suite refuses to continue rather than mutating a real project.
 */
export async function useStack(): Promise<Stack> {
  const stack = await startStack();

  setEnv("SUPABASE_URL", stack.restUrl);
  setEnv("SUPABASE_SERVICE_ROLE_KEY", stack.serviceKey);
  // Parquet mirroring is a no-op unless explicitly enabled; keep it off so the
  // suite exercises the authoritative row path and never reaches storage.
  setEnv("DATASET_PARQUET_ENABLED", undefined);
  // Audit archiving writes NDJSON to stdout on purge; irrelevant here, but
  // pinned so a developer's shell cannot change what the suite observes.
  setEnv("AUDIT_ARCHIVE_ON_PURGE", "0");

  if (!process.env.SUPABASE_URL?.startsWith("http://127.0.0.1:")) {
    await stopStack();
    throw new Error("Refusing to run: the broker is not pointed at this run's local container.");
  }
  return stack;
}

export async function releaseStack(): Promise<void> {
  for (const [key, value] of Object.entries(SAVED)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  for (const key of Object.keys(SAVED)) delete SAVED[key];
  await stopStack();
}

/** Authorises exactly the given app ids for the capability, for one test. */
export function authorizeApps(...appIds: string[]): void {
  setEnv("LOCAL_TABLE_INTEGRATION_MCP_APP_IDS", appIds.join(","));
}

/** Polls until `probe` returns a value, for the fire-and-forget audit write. */
export async function eventually<T>(
  label: string,
  probe: () => Promise<T | null | undefined>,
  timeoutMs = 15_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== null && value !== undefined) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
}
