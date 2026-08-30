// Pseudonymisation orchestration (DMS-D1-0002 §5 + §6 wiring).
//
// Ties together, in the order the architecture requires:
//   local extraction -> local entity resolution -> privacy firewall
// i.e. this module never talks to an external provider — it turns raw
// extracted text into a pseudonymised representation using ONLY the local
// Presidio findings, the entity resolver, and the Privacy Vault.
//
// Split into a pure part (`mapPresidioLabelToEntityType`, `applyReplacements`)
// and an async part (`pseudonymizeDocumentText`) so the span-replacement logic
// — the part most likely to have an off-by-one bug — is unit-testable without
// a database or network call.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PiiFinding } from "@/lib/privacy/sensitivityPolicy";
import type { EntityType } from "@/lib/privacy/privacyVault.server";
import { getOrCreatePseudonymToken } from "@/lib/privacy/privacyVault.server";
import { registerCandidateEntity } from "@/lib/privacy/entityResolution.server";

const LABEL_MAP: Record<string, EntityType> = {
  PERSON: "person",
  EMAIL_ADDRESS: "email",
  PHONE_NUMBER: "phone",
  LOCATION: "address",
  IBAN_CODE: "iban",
  CREDIT_CARD: "payment_card",
  DE_TAX_ID: "tax_id",
  DE_TAX_NUMBER: "tax_id",
  DE_ID_CARD: "id_document",
  DE_PASSPORT: "id_document",
};

/** Map a Presidio recognizer label to our internal entity domain. Unknown labels fall back to "other". */
export function mapPresidioLabelToEntityType(label: string): EntityType {
  return LABEL_MAP[label] ?? "other";
}

export type Span = { start: number; end: number };

// DMS-D1-0002R Phase A2/C4. `applyReplacements`'s own doc comment always said
// overlapping spans are the caller's job to resolve — but no caller ever did:
// `pseudonymizeDocumentText` passed every Presidio finding straight through,
// so two recognizers firing on the same substring (e.g. PERSON and LOCATION
// both matching a German street-name-that-is-also-a-surname) would throw at
// `applyReplacements`'s overlap-adjacent bounds check, or silently corrupt the
// text if one span's start fell inside another's already-replaced range. This
// makes overlap resolution deterministic and total, so the same findings
// always normalise to the same accepted spans:
//   1. Highest confidence score wins the region.
//   2. Tied score → the LONGER span wins (covers strictly more of the
//      ambiguous text with a token, the fail-safer direction for a redaction
//      boundary).
//   3. Still tied → earliest `start`, then lexicographic `label`, breaks the
//      tie so ordering never depends on input array order or a sort's
//      stability across engines.
export function normalizeOverlappingFindings<T extends Span & { label: string; score: number }>(
  findings: T[],
): T[] {
  const priority = findings
    .map((f, index) => ({ f, index }))
    .sort((a, b) => {
      if (a.f.score !== b.f.score) return b.f.score - a.f.score;
      const lenA = a.f.end - a.f.start;
      const lenB = b.f.end - b.f.start;
      if (lenA !== lenB) return lenB - lenA;
      if (a.f.start !== b.f.start) return a.f.start - b.f.start;
      if (a.f.label !== b.f.label) return a.f.label < b.f.label ? -1 : 1;
      return a.index - b.index;
    });

  // Accepted spans — "does this overlap anything already accepted" is a
  // simple linear scan since the accepted set stays small per document.
  const accepted: T[] = [];
  for (const { f } of priority) {
    if (f.start >= f.end) continue; // degenerate span — never a valid redaction target.
    const overlaps = accepted.some((a) => f.start < a.end && a.start < f.end);
    if (!overlaps) accepted.push(f);
  }
  accepted.sort((a, b) => a.start - b.start);
  return accepted;
}

/**
 * Replace each `[start, end)` span in `text` with its token. Spans MUST NOT
 * overlap (Presidio findings on the same text can overlap when multiple
 * recognizers fire on the same substring — callers must de-duplicate/pick the
 * highest-confidence span per overlap region before calling this).
 *
 * Applies right-to-left so earlier offsets stay valid as later ones are
 * substituted — the single detail that makes or breaks span-based replacement.
 */
export function applyReplacements(text: string, spans: (Span & { token: string })[]): string {
  const ordered = [...spans].sort((a, b) => b.start - a.start);
  let out = text;
  for (const s of ordered) {
    if (s.start < 0 || s.end > out.length || s.start >= s.end) {
      throw new Error(`applyReplacements: invalid span [${s.start}, ${s.end})`);
    }
    out = out.slice(0, s.start) + s.token + out.slice(s.end);
  }
  return out;
}

/**
 * Detect-and-resolve findings against a raw text, in a single pass:
 * 1. resolve/register each finding's surface value against the entity
 *    resolver (so repeated sightings of "the same person" map to one
 *    canonical id even though only the pseudonym token leaves this module);
 * 2. get-or-create the stable pseudonym token for that entity from the
 *    Privacy Vault;
 * 3. substitute all spans, right-to-left, into the pseudonymised text.
 *
 * Returns the pseudonymised text plus the list of canonical ids touched, for
 * callers that need to link the document to entities without ever seeing
 * clear PII (e.g. the registry).
 */
export async function pseudonymizeDocumentText(
  sb: SupabaseClient<Database>,
  userId: string,
  text: string,
  findings: (PiiFinding & Span)[],
): Promise<{ pseudonymizedText: string; canonicalIds: string[] }> {
  const canonicalIds = new Set<string>();
  const spans: (Span & { token: string })[] = [];

  // Phase A2: resolve overlaps BEFORE touching the entity resolver/Vault, so
  // a finding that loses its region never registers a candidate entity or
  // mints a pseudonym token nobody's output will reference.
  const normalizedFindings = normalizeOverlappingFindings(findings);

  for (const f of normalizedFindings) {
    const rawValue = text.slice(f.start, f.end);
    if (!rawValue.trim()) continue;
    const entityType = mapPresidioLabelToEntityType(f.label);

    const registered = await registerCandidateEntity(sb, userId, { entityType, rawValue });
    canonicalIds.add(registered.canonicalId);

    const token = await getOrCreatePseudonymToken({
      userId,
      entityType,
      entityKey: registered.entityKey,
      clearValue: rawValue,
    });
    spans.push({ start: f.start, end: f.end, token });
  }

  return {
    pseudonymizedText: applyReplacements(text, spans),
    canonicalIds: [...canonicalIds],
  };
}
