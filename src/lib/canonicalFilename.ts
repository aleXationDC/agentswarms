/**
 * Canonical document filenames: `YYYY-MM-DD_<meaningful name>.<ext>`.
 *
 * WHY THIS IS CODE AND NOT A PROMPT RULE
 * The folder hierarchy is deliberately shallow, so chronological sorting in an
 * ordinary file browser is what makes a folder navigable without AgentSwarms.
 * That makes the name a load-bearing convention rather than a stylistic one,
 * and a convention that must hold for every document cannot be left to a model
 * that reformats dates differently on a bad day.
 *
 * The split of responsibility is therefore:
 *   - the MODEL decides WHICH date is authoritative and how it knows (semantic)
 *   - this module decides WHAT THE NAME LOOKS LIKE (deterministic)
 *
 * The skill still documents the convention, because the model has to surface
 * the date and its source for the human to check — but the string itself is
 * assembled here, so the same result holds for any agent the skill is attached
 * to, including ones that never read the skill at all.
 */

/** How we came to believe the document date. Ordered most to least trusted. */
export type DocumentDateSource =
  | "explicit_document"
  | "inferred_document"
  | "source_arrival"
  | "unknown";

const DATE_SOURCE_LABELS: Record<DocumentDateSource, string> = {
  explicit_document: "Explicit document date",
  inferred_document: "Inferred from document content",
  source_arrival: "Source/inbox arrival date (no reliable document date)",
  unknown: "Unknown",
};

export function describeDateSource(v: unknown): string {
  const key = typeof v === "string" ? v.trim() : "";
  return DATE_SOURCE_LABELS[key as DocumentDateSource] ?? (key || "Unknown");
}

/** `YYYY-MM-DD` at the very start of a filename, followed by the separator. */
const CANONICAL_PREFIX = /^(\d{4}-\d{2}-\d{2})_/;

/**
 * Other date-ish prefixes people actually use, which we must RECOGNISE but not
 * silently keep: `2026-04-01 `, `20260401_`, `2026_04_01-`. Recognising them is
 * what lets us report "this file already claims a different date" instead of
 * producing `2026-04-01_2026_04_01-foo.pdf`.
 */
const LOOSE_DATE_PREFIX = /^(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})\s*[-_. ]\s*/;

/** Normalise anything date-like to `YYYY-MM-DD`, or null if it isn't one. */
export function normaliseDate(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : v instanceof Date ? v.toISOString() : "";
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return validOrNull(iso[1], iso[2], iso[3]);

  const compact = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return validOrNull(compact[1], compact[2], compact[3]);

  // German / European forms: 01.04.2026, 1.4.2026, 01/04/2026.
  const euro = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (euro) return validOrNull(euro[3], euro[2].padStart(2, "0"), euro[1].padStart(2, "0"));

  return null;
}

function validOrNull(y: string, m: string, d: string): string | null {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (year < 1900 || year > 2200) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return `${y}-${m}-${d}`;
}

/** Split `name.ext`, tolerating dotless names and multi-dot names. */
function splitExtension(filename: string): { stem: string; ext: string } {
  const i = filename.lastIndexOf(".");
  // A leading dot is a hidden file, not an extension; a dot in the last 6 chars
  // is the only thing we treat as one, so "ToS Claude Code 1.3.pdf" keeps its
  // version number in the stem instead of losing ".3.pdf".
  if (i <= 0 || filename.length - i > 6) return { stem: filename, ext: "" };
  return { stem: filename.slice(0, i), ext: filename.slice(i) };
}

export type CanonicalNameResult = {
  /** The name we propose. Never applied to Drive by this module. */
  canonicalFilename: string;
  /** The filename exactly as it exists at the source, unchanged. */
  originalFilename: string;
  /** The date used for the prefix, `YYYY-MM-DD`, or null if none was usable. */
  documentDate: string | null;
  documentDateSource: DocumentDateSource;
  /** True when canonical differs from original — i.e. a rename would be needed. */
  wouldRename: boolean;
  /**
   * Set when the original already carried a date prefix that disagrees with the
   * authoritative document date. This is the case a human must look at, because
   * one of the two dates is wrong and we cannot tell which.
   */
  conflictingExistingDate: string | null;
};

/**
 * Build the canonical filename.
 *
 * Deliberately conservative: the human-readable part of a good existing name is
 * preserved verbatim. We do not re-title documents for stylistic consistency —
 * an AI-invented title is harder to recognise than the name the issuer chose.
 */
export function buildCanonicalFilename(args: {
  originalFilename: string;
  /** Authoritative document date as judged by the model, if any. */
  documentDate?: unknown;
  documentDateSource?: unknown;
  /** When the document entered intake — the fallback of last resort. */
  arrivalDate?: unknown;
}): CanonicalNameResult {
  const original = (args.originalFilename ?? "").trim();

  const documentDate = normaliseDate(args.documentDate);
  const arrival = normaliseDate(args.arrivalDate);

  let date = documentDate;
  let source: DocumentDateSource = "unknown";

  if (date) {
    const claimed = typeof args.documentDateSource === "string" ? args.documentDateSource.trim() : "";
    source =
      claimed === "explicit_document" || claimed === "inferred_document"
        ? claimed
        : // A date with no stated provenance is treated as inferred, not
          // explicit. Never upgrade a claim the model did not make.
          "inferred_document";
  } else if (arrival) {
    // Falling back to arrival is legitimate and must be visible as such — this
    // is the difference between "dated 1 April" and "showed up on 1 April".
    date = arrival;
    source = "source_arrival";
  }

  if (!original) {
    return {
      canonicalFilename: "",
      originalFilename: original,
      documentDate: date,
      documentDateSource: source,
      wouldRename: false,
      conflictingExistingDate: null,
    };
  }

  // No usable date at all: never invent one, and never mangle the name.
  if (!date) {
    return {
      canonicalFilename: original,
      originalFilename: original,
      documentDate: null,
      documentDateSource: "unknown",
      wouldRename: false,
      conflictingExistingDate: null,
    };
  }

  const exact = original.match(CANONICAL_PREFIX);
  if (exact) {
    const existing = exact[1];
    if (existing === date) {
      // Already canonical and already correct. Leave it completely alone.
      return {
        canonicalFilename: original,
        originalFilename: original,
        documentDate: date,
        documentDateSource: source,
        wouldRename: false,
        conflictingExistingDate: null,
      };
    }
    const rest = original.slice(exact[0].length);
    const canonical = `${date}_${rest}`;
    return {
      canonicalFilename: canonical,
      originalFilename: original,
      documentDate: date,
      documentDateSource: source,
      wouldRename: canonical !== original,
      conflictingExistingDate: existing,
    };
  }

  const loose = original.match(LOOSE_DATE_PREFIX);
  if (loose) {
    const existing = validOrNull(loose[1], loose[2], loose[3]);
    const rest = original.slice(loose[0].length);
    const { stem, ext } = splitExtension(rest);
    const canonical = `${date}_${stem}${ext}`;
    return {
      canonicalFilename: canonical,
      originalFilename: original,
      documentDate: date,
      documentDateSource: source,
      wouldRename: canonical !== original,
      conflictingExistingDate: existing && existing !== date ? existing : null,
    };
  }

  const { stem, ext } = splitExtension(original);
  const canonical = `${date}_${stem}${ext}`;
  return {
    canonicalFilename: canonical,
    originalFilename: original,
    documentDate: date,
    documentDateSource: source,
    wouldRename: canonical !== original,
    conflictingExistingDate: null,
  };
}
