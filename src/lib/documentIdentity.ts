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
import { buildCanonicalFilename } from "@/lib/canonicalFilename";

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
  // Mail identity fields (DMS-D1-0003 §6)
  "mail_id",
  "mail_account_id",
  "raw_sha256",
  "source_mailbox_path",
  "source_context_path",
  "current_mailbox_path",
  "current_uid",
  "current_uidvalidity",
  "message_id",
  "in_reply_to",
  "references",
  "drive_eml_file_id",
  "drive_eml_path",
  "drive_eml_hash",
  "attachment_count",
  "canonical_eml_filename",
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
 * Assert the human-approved filing plan's deterministic fields over the
 * proposal, the same way `reconcileIdentity` asserts physical identity.
 *
 * `approved_target_folder` is the human-approved semantic destination — that
 * choice belongs to the reviewer/agent, so it is copied from
 * `proposed_folder_path` verbatim, never invented here. `approved_filename`
 * is NOT copied from the model's `proposed_filename`: naming is deterministic
 * (see canonicalFilename.ts) precisely so a filing executor never has to
 * trust a model's idea of what a filename should look like.
 */
export function buildApprovedFilingPlan(
  proposal: Record<string, unknown>,
  envelope: Record<string, unknown>,
): Record<string, unknown> {
  const strOf = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  const targetFolder = (typeof proposal.proposed_folder_path === "string" ? proposal.proposed_folder_path.trim() : "") || "04_Archive";

  // If mail envelope:
  if (typeof envelope.mail_id === "string" && envelope.mail_id.trim()) {
    const emlFilename =
      strOf(envelope.canonical_eml_filename) ||
      strOf(proposal.canonical_eml_filename) ||
      `${strOf(envelope.message_date) || "2026-08-30"}_MAIL_${envelope.mail_id.slice(0, 16)}.eml`;

    return {
      ...proposal,
      approved_target_folder: targetFolder,
      approved_eml_filename: emlFilename,
      approved_filename: emlFilename,
      imap_target_folder: `00_aleXation/${targetFolder.replace(/^\/+|\/+$/g, "")}`,
    };
  }

  const naming = buildCanonicalFilename({
    originalFilename: strOf(envelope.source_filename) || strOf(proposal.source_filename),
    documentDate: proposal.document_date,
    documentDateSource: proposal.document_date_source,
    arrivalDate: envelope.ingested_at ?? envelope.created_time,
  });
  return {
    ...proposal,
    approved_target_folder: (proposal.proposed_folder_path as unknown) ?? null,
    approved_filename: naming.canonicalFilename || (proposal.proposed_filename as unknown) || null,
  };
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
