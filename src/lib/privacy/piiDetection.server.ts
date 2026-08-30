// Local PII detection sidecar client (DMS-D1-0002 §5, "Local PII engine").
//
// Talks to a Microsoft Presidio Analyzer instance reachable only on the
// internal Docker network — never Azure/cloud PII services, never an
// external LLM for detection. The service is declared in docker-compose.yml
// (see the `presidio-analyzer` entry) but is NOT started/deployed by this
// change: per the task's "no production activation" constraint, this client
// is code-complete and unit-testable (fail-closed paths), while live
// verification against a running Presidio instance is out of scope here.
//
// Fails closed by design: any network error, non-2xx response, timeout, or
// malformed payload is surfaced as `{ ok: false }` — callers (pseudonymize.server.ts)
// must treat that as `sanitizerFailed: true` for classifySensitivity, i.e.
// route to `restricted` rather than guessing the content is safe.
import type { PiiFinding } from "@/lib/privacy/sensitivityPolicy";

const DEFAULT_CANDIDATES = ["http://presidio-analyzer:3000", "http://127.0.0.1:5002"];
const REQUEST_TIMEOUT_MS = 8_000;

/** Explicitly configured endpoint, if any (e.g. PRESIDIO_ANALYZER_URL=http://presidio-analyzer:3000). */
export function presidioAnalyzerUrl(): string | null {
  const raw = (process.env.PRESIDIO_ANALYZER_URL ?? "").trim();
  if (!raw) return null;
  if (!/^https?:\/\/\S+$/i.test(raw)) return null;
  return raw.replace(/\/+$/, "");
}

/**
 * Minimum entity coverage required by §5. Presidio's default recognizers
 * cover PERSON/EMAIL_ADDRESS/PHONE_NUMBER/LOCATION/IBAN_CODE/CREDIT_CARD out
 * of the box; DE_TAX_ID/DE_TAX_NUMBER/DE_ID_CARD/DE_PASSPORT require the
 * custom German recognizers to be registered on the Analyzer image at build
 * time (documented in docker-compose.yml, not implemented in this client).
 */
export const MIN_ENTITIES = [
  "PERSON",
  "EMAIL_ADDRESS",
  "PHONE_NUMBER",
  "LOCATION",
  "IBAN_CODE",
  "CREDIT_CARD",
  "DE_TAX_ID",
  "DE_TAX_NUMBER",
  "DE_ID_CARD",
  "DE_PASSPORT",
] as const;

export type PiiDetectionResult =
  | { ok: true; findings: (PiiFinding & { start: number; end: number })[] }
  | { ok: false; error: string };

/**
 * Analyze `text` for PII. Returns `{ ok: false }` on any failure — the caller
 * must fail closed, never treat a failed call as "no PII found".
 */
export async function detectPii(text: string, language = "de"): Promise<PiiDetectionResult> {
  const base = presidioAnalyzerUrl();
  if (!base) {
    return { ok: false, error: "PRESIDIO_ANALYZER_URL is not configured" };
  }
  try {
    const res = await fetch(`${base}/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text,
        language,
        entities: MIN_ENTITIES,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, error: `Presidio Analyzer responded with HTTP ${res.status}` };
    }
    const body = (await res.json()) as unknown;
    if (!Array.isArray(body)) {
      return { ok: false, error: "Presidio Analyzer returned an unexpected payload shape" };
    }
    const findings = body
      .map((r) => {
        const row = r as Record<string, unknown>;
        const label = typeof row.entity_type === "string" ? row.entity_type : null;
        const score = typeof row.score === "number" ? row.score : null;
        const start = typeof row.start === "number" ? row.start : null;
        const end = typeof row.end === "number" ? row.end : null;
        if (label === null || score === null || start === null || end === null) return null;
        return { label, score, start, end };
      })
      .filter((r): r is PiiFinding & { start: number; end: number } => r !== null);
    return { ok: true, findings };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Presidio Analyzer call failed" };
  }
}

/** For diagnostics/health surfaces only — never used to gate the fail-closed decision. */
export function presidioDefaultCandidates(): readonly string[] {
  return DEFAULT_CANDIDATES;
}
