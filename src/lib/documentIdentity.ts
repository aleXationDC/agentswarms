// Identity fields are FACTS, not opinions — they never come from the model.
//
// A document envelope enters a swarm carrying the technical identity of a real
// file: which Drive object it is, where it lives, and what its bytes hash to.
// The agent node's job is purely semantic (what kind of document is this, where
// should it be filed, under what name). But a strict-JSON contract asks the
// model to echo the identity fields back, and a language model transcribing a
// 33-character opaque ID is a coin flip: an observed run returned
// "…T0EQ2lm21DXL" for an envelope that said "…T0EQG2lm21DXL" — one dropped
// character, silently pointing every downstream Drive operation and the
// reviewer's "open the original" link at a different (or nonexistent) file.
//
// Nothing downstream can detect that on its own: the corrupted ID is
// well-formed, the JSON is valid, and the confidence score is still 98%. So the
// authoritative envelope is re-applied OVER the model's answer before the
// proposal is shown to a human or handed to an executor. The model keeps the
// judgement; the envelope keeps the facts.

/** Fields the envelope owns outright. A model value here is always discarded. */
export const IDENTITY_FIELDS = [
  "document_id",
  "drive_file_id",
  "drive_url",
  "content_hash",
  "hash_status",
  "parent_folders",
  "source_filename",
  "mime_type",
  "file_size",
  "created_time",
  "modified_time",
  "extraction_status",
  "extraction_error",
  "source",
] as const;

export type IdentityField = (typeof IDENTITY_FIELDS)[number];

/** Parse an optionally ```json-fenced object. Non-objects yield null. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return null;
  const unfenced = trimmed.startsWith("```")
    ? trimmed
        .replace(/^```[a-zA-Z]*\s*/, "")
        .replace(/```\s*$/, "")
        .trim()
    : trimmed;
  if (!unfenced.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(unfenced) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) === JSON.stringify(b);
  // Envelope numbers sometimes arrive as strings (file_size); comparing the
  // rendered form avoids reporting a "correction" that changes nothing a human
  // would recognise as different.
  return String(a ?? "") === String(b ?? "");
}

export type IdentityReconcileResult = {
  /** The proposal with envelope-owned fields restored, or null if not applicable. */
  object: Record<string, unknown> | null;
  /** Fields whose model value disagreed with the envelope and was overwritten. */
  corrected: string[];
};

/**
 * Overwrite envelope-owned fields on a parsed proposal.
 *
 * Only fields PRESENT in the envelope are applied: a swarm whose input carries
 * no identity (a plain prompt, another template) is left completely alone, so
 * this stays safe to run on every approval rather than only document ones.
 */
export function reconcileIdentity(
  proposal: Record<string, unknown>,
  envelope: Record<string, unknown>,
): IdentityReconcileResult {
  const merged: Record<string, unknown> = { ...proposal };
  const corrected: string[] = [];
  for (const field of IDENTITY_FIELDS) {
    if (!(field in envelope)) continue;
    const authoritative = envelope[field];
    if (field in proposal && !sameValue(proposal[field], authoritative)) {
      corrected.push(field);
    }
    merged[field] = authoritative;
  }
  // document_id is derived, not transcribed: if the envelope omitted it but
  // named the file, rebuild it from the authoritative id rather than trusting
  // whatever the model composed.
  if (!("document_id" in envelope) && typeof envelope.drive_file_id === "string") {
    const derived = `drive:${envelope.drive_file_id}`;
    if (merged.document_id !== undefined && merged.document_id !== derived) {
      corrected.push("document_id");
    }
    merged.document_id = derived;
  }
  return { object: merged, corrected };
}

/**
 * Re-apply the envelope's identity to an agent's JSON answer, returned as text.
 *
 * A no-op (returns the original string) when either side isn't a JSON object —
 * the caller can apply this unconditionally without special-casing swarms that
 * don't carry document envelopes.
 *
 * When something WAS corrected the fact is surfaced in `identity_corrections`
 * and appended to `warnings`, because a model that mistranscribed the file id
 * may well have mistranscribed a date or an issuer too — that is exactly the
 * kind of uncertainty the human reviewer is there to catch.
 */
export function applyAuthoritativeIdentity(
  modelOutput: string,
  envelopeText: string,
): { text: string; corrected: string[] } {
  const proposal = parseJsonObject(modelOutput);
  const envelope = parseJsonObject(envelopeText);
  if (!proposal || !envelope) return { text: modelOutput, corrected: [] };

  const { object, corrected } = reconcileIdentity(proposal, envelope);
  if (!object) return { text: modelOutput, corrected: [] };

  if (corrected.length > 0) {
    object.identity_corrections = corrected;
    const existing = typeof object.warnings === "string" ? object.warnings.trim() : "";
    const note = `Model altered identity field(s) ${corrected.join(", ")}; restored from source envelope.`;
    object.warnings = existing && existing.toLowerCase() !== "none" ? `${existing} ${note}` : note;
  }
  return { text: JSON.stringify(object, null, 2), corrected };
}
