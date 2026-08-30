/**
 * Canonical document filenames: `YYYY-MM-DD_<meaningful name>.<ext>` (DMS-D1-0003-REVIEW §7.6).
 *
 * Allowed characters in canonical basename: `A-Z a-z 0-9 _ -`
 * Exactly ONE dot directly before the real file extension.
 * German transliteration: `ä`/`Ä` -> `ae`/`Ae`, `ö`/`Ö` -> `oe`/`Oe`, `ü`/`Ü` -> `ue`/`Ue`, `ß` -> `ss`.
 * No internal dots, spaces, or filesystem-sensitive punctuation.
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
 * Other date-ish prefixes people actually use: `2026-04-01 `, `20260401_`, `2026_04_01-`.
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

/**
 * Transliterate German umlauts, eszett and other diacritics to safe ASCII.
 */
export function transliterateToAscii(str: string): string {
  if (!str) return "";
  let s = str
    .replace(/ä/g, "ae")
    .replace(/Ä/g, "Ae")
    .replace(/ö/g, "oe")
    .replace(/Ö/g, "Oe")
    .replace(/ü/g, "ue")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss");

  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return s;
}

/** Split `name.ext`, tolerating dotless names and multi-dot names. */
function splitExtension(filename: string): { stem: string; ext: string } {
  const i = filename.lastIndexOf(".");
  if (i <= 0 || filename.length - i > 6) return { stem: filename, ext: "" };
  return { stem: filename.slice(0, i), ext: filename.slice(i).toLowerCase() };
}

// Known canonical document type prefixes for block separation when input is space-delimited
const KNOWN_TYPE_PREFIXES = new Set([
  "tos", "terms", "rechnung", "invoice", "bill", "mietvertrag", "vertrag", "contract",
  "kontoauszug", "statement", "gehaltsabrechnung", "payslip", "bescheid", "police",
  "anschreiben", "protokoll", "angebot", "quote", "quittung", "receipt", "mail", "email",
  "bestaetigung", "kuendigung", "mahnung", "gutschrift", "lieferschein", "zertifikat",
]);

// Known status / version suffixes for block separation
const KNOWN_STATUS_SUFFIXES = new Set([
  "unterschrieben", "signed", "final", "draft", "entwurf", "kopie", "copy",
  "bezahlt", "paid", "storniert", "cancelled", "scan",
]);

/**
 * Sanitize a filename stem according to DMS-D1-0003-REVIEW §7.6:
 * - Basename allowed chars: [A-Z a-z 0-9 _ -]
 * - Separators: `_` separates semantic blocks, `-` separates words/components within a block.
 * - Version/decimal numbers like 1.3 or v1.3 encoded as v1-3 (no internal dots).
 */
export function sanitizeCanonicalStem(stem: string): string {
  if (!stem) return "";
  let s = transliterateToAscii(stem.trim());

  // Version numbers: convert " 1.3" or "v1.3" to "_v1-3"
  s = s.replace(/(?:^|[\s_])v?(\d+)\.(\d+)(?:[\s_]|$)/gi, (match, p1, p2) => {
    return `_v${p1}-${p2}_`;
  });
  s = s.replace(/(\d+)\.(\d+)/g, "$1-$2");

  // If explicit underscores already exist, sanitize each block independently
  if (s.includes("_")) {
    const rawBlocks = s.split("_").filter(Boolean);
    const blocks: string[] = [];
    for (const b of rawBlocks) {
      const words = b.trim().split(/[\s\t]+/).filter(Boolean);
      if (words.length >= 2 && (KNOWN_TYPE_PREFIXES.has(words[0].toLowerCase()) || /^[A-Z]{2,5}$/.test(words[0]))) {
        const typePart = words[0].replace(/[^A-Za-z0-9_-]+/g, "-");
        const restPart = words.slice(1).join("-").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-+/g, "-");
        blocks.push(`${typePart}_${restPart}`);
      } else {
        let cleaned = b.trim().replace(/[\s\t]+/g, "-").replace(/[^A-Za-z0-9_-]+/g, "-");
        cleaned = cleaned.replace(/-+/g, "-").replace(/^[-]+|[-]+$/g, "");
        if (cleaned) blocks.push(cleaned);
      }
    }
    return blocks.join("_");
  }

  // If the stem has no underscores, detect semantic blocks:
  // e.g. "Mietvertrag Dorfstraße 22a unterschrieben" -> ["Mietvertrag", "Dorfstrasse-22a", "unterschrieben"]
  // e.g. "ToS Claude Code" -> ["ToS", "Claude-Code"]
  const rawWords = s.split(/[\s\t]+/).filter(Boolean);
  if (rawWords.length <= 1) {
    let single = s.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^[-]+|[-]+$/g, "");
    return single;
  }

  const firstLower = rawWords[0].toLowerCase();
  const lastLower = rawWords[rawWords.length - 1].toLowerCase();

  let hasTypePrefix = KNOWN_TYPE_PREFIXES.has(firstLower) || /^[A-Z]{2,5}$/.test(rawWords[0]);
  let hasStatusSuffix = KNOWN_STATUS_SUFFIXES.has(lastLower) || /^v?\d+(-\d+)?$/i.test(rawWords[rawWords.length - 1]);

  if (hasTypePrefix && hasStatusSuffix && rawWords.length >= 3) {
    const typeBlock = rawWords[0];
    const statusBlock = rawWords[rawWords.length - 1];
    const middleBlock = rawWords.slice(1, -1).join("-");
    const clean = [typeBlock, middleBlock, statusBlock]
      .map(b => b.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^[-]+|[-]+$/g, ""))
      .filter(Boolean);
    return clean.join("_");
  } else if (hasTypePrefix && rawWords.length >= 2) {
    const typeBlock = rawWords[0];
    const restBlock = rawWords.slice(1).join("-");
    const clean = [typeBlock, restBlock]
      .map(b => b.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^[-]+|[-]+$/g, ""))
      .filter(Boolean);
    return clean.join("_");
  } else if (hasStatusSuffix && rawWords.length >= 2) {
    const mainBlock = rawWords.slice(0, -1).join("-");
    const statusBlock = rawWords[rawWords.length - 1];
    const clean = [mainBlock, statusBlock]
      .map(b => b.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^[-]+|[-]+$/g, ""))
      .filter(Boolean);
    return clean.join("_");
  }

  // Default fallback: join words with hyphens
  let joined = rawWords.join("-").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^[-]+|[-]+$/g, "");
  return joined;
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
   * authoritative document date.
   */
  conflictingExistingDate: string | null;
};

/**
 * Build the canonical filename conforming to DMS-D1-0003-REVIEW §7.6.
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
    const claimed =
      typeof args.documentDateSource === "string" ? args.documentDateSource.trim() : "";
    source =
      claimed === "explicit_document" || claimed === "inferred_document"
        ? claimed
        : "inferred_document";
  } else if (arrival) {
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

  const { stem: rawStem, ext: rawExt } = splitExtension(original);
  const ext = rawExt.toLowerCase();

  // No usable date at all: sanitize stem and keep extension
  if (!date) {
    const sanitized = sanitizeCanonicalStem(rawStem);
    const canonical = sanitized ? `${sanitized}${ext}` : original;
    return {
      canonicalFilename: canonical,
      originalFilename: original,
      documentDate: null,
      documentDateSource: "unknown",
      wouldRename: canonical !== original,
      conflictingExistingDate: null,
    };
  }

  const exact = original.match(CANONICAL_PREFIX);
  if (exact) {
    const existing = exact[1];
    const rest = rawStem.slice(exact[0].length);
    const sanitizedRest = sanitizeCanonicalStem(rest);
    const canonical = `${date}_${sanitizedRest}${ext}`;
    return {
      canonicalFilename: canonical,
      originalFilename: original,
      documentDate: date,
      documentDateSource: source,
      wouldRename: canonical !== original,
      conflictingExistingDate: existing !== date ? existing : null,
    };
  }

  const loose = original.match(LOOSE_DATE_PREFIX);
  if (loose) {
    const existing = validOrNull(loose[1], loose[2], loose[3]);
    const rest = rawStem.slice(loose[0].length);
    const sanitizedRest = sanitizeCanonicalStem(rest);
    const canonical = `${date}_${sanitizedRest}${ext}`;
    return {
      canonicalFilename: canonical,
      originalFilename: original,
      documentDate: date,
      documentDateSource: source,
      wouldRename: canonical !== original,
      conflictingExistingDate: existing && existing !== date ? existing : null,
    };
  }

  const sanitizedStem = sanitizeCanonicalStem(rawStem);
  const canonical = `${date}_${sanitizedStem}${ext}`;
  return {
    canonicalFilename: canonical,
    originalFilename: original,
    documentDate: date,
    documentDateSource: source,
    wouldRename: canonical !== original,
    conflictingExistingDate: null,
  };
}
