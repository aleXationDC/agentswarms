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
  if (raw && /^https?:\/\/\S+$/i.test(raw)) return raw.replace(/\/+$/, "");
  return "http://presidio-analyzer:3000";
}

// DMS-D1-0002R Phase A2/A5 (recognizer coverage). MIN_ENTITIES used to
// request DE_TAX_ID/DE_TAX_NUMBER/DE_ID_CARD/DE_PASSPORT as if the Analyzer
// already knew them — but the stock `mcr.microsoft.com/presidio-analyzer`
// image (docker-compose.yml) ships NO custom German recognizers, and nothing
// in this repo builds or registers one on the image. Requesting an entity
// label the Analyzer has never heard of does not error; Presidio simply never
// returns it, so the labels were declarative only — "coverage" that could
// never actually fire.
//
// Presidio's REST API supports registering recognizers PER REQUEST via
// `ad_hoc_recognizers` (regex PatternRecognizer / deny-list definitions sent
// inline, https://microsoft.github.io/presidio) — a documented, stock
// Analyzer feature, not a custom image build or a new deployment step. Each
// entry below is deliberately declared as regex + score + context words
// rather than a full checksum validator (Presidio's ad-hoc API only accepts
// regex/deny-list, no custom validation code), so precision is bounded but
// the labels are now things the Analyzer can actually match — real, not
// aspirational. `context` uses Presidio's built-in context-word confidence
// boost so, e.g., the same 9-character document-number shape scores higher
// as DE_PASSPORT near "Reisepass" and higher as DE_ID_CARD near
// "Personalausweis", rather than the two labels being indistinguishable.
export type AdHocPatternRecognizer = {
  name: string;
  supported_entity: string;
  supported_language?: string;
  patterns: { name: string; regex: string; score: number }[];
  context?: string[];
};

export const GERMAN_AD_HOC_RECOGNIZERS: AdHocPatternRecognizer[] = [
  {
    name: "DeTaxIdRecognizer",
    supported_entity: "DE_TAX_ID",
    // Steuerliche Identifikationsnummer: 11 digits, leading digit 1-9.
    patterns: [{ name: "de_tax_id_11_digit", regex: "\\b[1-9][0-9]{10}\\b", score: 0.5 }],
    context: ["steuer-id", "steuerliche identifikationsnummer", "identifikationsnummer", "idnr"],
  },
  {
    name: "DeTaxNumberRecognizer",
    supported_entity: "DE_TAX_NUMBER",
    // Classic slashed Steuernummer, e.g. "12/345/67890".
    patterns: [
      { name: "de_tax_number_slashed", regex: "\\b[0-9]{2,3}/[0-9]{3}/[0-9]{4,5}\\b", score: 0.6 },
    ],
    context: ["steuernummer", "st-nr", "finanzamt"],
  },
  {
    name: "DeIdCardRecognizer",
    supported_entity: "DE_ID_CARD",
    // New-format Personalausweis document number: 9 alphanumeric chars,
    // excluding easily-confused letters (no A/B/I/O/Q/S/U).
    patterns: [{ name: "de_id_card_9char", regex: "\\b[C-HJ-NPRTVWXYZ0-9]{9}\\b", score: 0.4 }],
    context: ["personalausweis", "ausweisnummer", "dokumentennummer"],
  },
  {
    name: "DePassportRecognizer",
    supported_entity: "DE_PASSPORT",
    // Same 9-character document-number shape as the ID card; German ID
    // cards and passports share this format, so context words (not the
    // pattern) are what should tell them apart at score time.
    patterns: [{ name: "de_passport_9char", regex: "\\b[C-HJ-NPRTVWXYZ][0-9]{8}\\b", score: 0.4 }],
    context: ["reisepass", "passnummer", "reisepassnummer"],
  },
];

/**
 * Minimum entity coverage required by §5. Presidio's default recognizers
 * cover PERSON/EMAIL_ADDRESS/PHONE_NUMBER/LOCATION/IBAN_CODE/CREDIT_CARD out
 * of the box; DE_TAX_ID/DE_TAX_NUMBER/DE_ID_CARD/DE_PASSPORT are registered
 * per-request via GERMAN_AD_HOC_RECOGNIZERS above (see detectPii).
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
export async function detectPii(text: string, language = "en"): Promise<PiiDetectionResult> {
  const primary = presidioAnalyzerUrl();
  const candidates = [primary, "http://presidio-analyzer:3000", "http://172.29.0.2:3000", "http://127.0.0.1:5002"].filter(
    (u): u is string => typeof u === "string" && u.length > 0,
  );
  const uniqueCandidates = [...new Set(candidates)];

  let lastError = "No candidate presidio endpoints available";
  for (const base of uniqueCandidates) {
    try {
      const res = await fetch(`${base}/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          language,
          entities: MIN_ENTITIES,
          ad_hoc_recognizers: GERMAN_AD_HOC_RECOGNIZERS.map((r) => ({ ...r, supported_language: language })),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        lastError = `Presidio Analyzer responded with HTTP ${res.status}`;
        continue;
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
      lastError = e instanceof Error ? e.message : "Presidio Analyzer call failed";
    }
  }

  return { ok: false, error: lastError };
}

/** For diagnostics/health surfaces only — never used to gate the fail-closed decision. */
export function presidioDefaultCandidates(): readonly string[] {
  return DEFAULT_CANDIDATES;
}
