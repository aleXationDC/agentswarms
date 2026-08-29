// Human-readable rendering for approval cards.
//
// An approval node's description used to be the raw text it gathered from
// upstream. When that upstream node is an agent with a strict JSON contract,
// the reviewer got a wall of JSON and had to parse it by eye to answer the only
// questions that matter: what is this, why does the system think so, and what
// exactly happens if I click Approve.
//
// The approvals row is title + description + payload, with no templating, so
// this is where the split happens: description becomes a readable brief, and
// the payload keeps the verbatim machine-readable object for the expandable
// view and for anything downstream that consumes it.
//
// Shared by BOTH runtimes (canvas + headless executor) on purpose — an approval
// must look identical no matter where the run was started.

import { buildCanonicalFilename, describeDateSource } from "@/lib/canonicalFilename";

/** Longest description the approvals row stores. */
export const APPROVAL_DESCRIPTION_LIMIT = 1000;

/** Longest raw output mirrored into the payload. */
export const APPROVAL_PAYLOAD_LIMIT = 4000;

/**
 * Parse an agent's output into an object, tolerating ```json fences.
 * Returns null for anything that isn't a plain JSON object — prose stays prose.
 */
export function parseApprovalJson(content: string): Record<string, unknown> | null {
  const text = content.trim();
  if (!text) return null;
  const unfenced = text.startsWith("```")
    ? text
        .replace(/^```[a-zA-Z]*\s*/, "")
        .replace(/```\s*$/, "")
        .trim()
    : text;
  if (!unfenced.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(unfenced) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return v.map(str).filter(Boolean).join(", ");
  return "";
}

/** Clip a single field so one long summary can't eat the whole description. */
function clip(v: string, max: number): string {
  if (v.length <= max) return v;
  return `${v.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Render 0.92 / "0.92" / 92 as "92%". Unparseable values pass through as-is. */
function formatConfidence(v: unknown): string {
  const raw = str(v);
  if (!raw) return "";
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  const pct = n <= 1 ? n * 100 : n;
  return `${Math.round(pct)}%`;
}

/**
 * Filing path a human can compare against Drive. Prefers an explicit path from
 * the model; otherwise composes the PARA class and the target container so the
 * card never shows a bare classification with no destination.
 */
function filingPath(o: Record<string, unknown>): string {
  const explicit = str(o.proposed_folder_path ?? o.proposed_target_path ?? o.proposed_path);
  if (explicit) return explicit;
  const parts = [str(o.para_class), str(o.proposed_container)].filter(Boolean);
  return parts.join(" / ");
}

type Section = { label: string; value: string };

/**
 * Readable brief for a document filing proposal.
 *
 * Returns null when the object doesn't look like one, so unrelated approvals
 * fall back to the generic renderer instead of showing a half-empty form.
 */
function documentBrief(o: Record<string, unknown>): string | null {
  const looksLikeDocument =
    "proposed_filename" in o || "para_class" in o || "drive_file_id" in o || "document_type" in o;
  if (!looksLikeDocument) return null;

  const sections: Section[] = [];
  const push = (label: string, value: string) => {
    if (value) sections.push({ label, value });
  };

  push("Document", clip(str(o.subject) || str(o.document_type) || str(o.source_filename), 160));

  const source = [str(o.source_filename), str(o.drive_url) || str(o.drive_file_id)]
    .filter(Boolean)
    .join("\n");
  push("Source", source);

  const detected = [
    str(o.document_type),
    str(o.sender_or_issuer) ? `Issuer: ${str(o.sender_or_issuer)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  push("Detected", detected);

  // Naming is shown as its own block, recomputed here rather than trusted from
  // the model, so the card states the same canonical name the registry stored.
  // A reviewer approves BOTH the semantic destination and the deterministic
  // name, and must be able to see the two independently.
  const naming = buildCanonicalFilename({
    originalFilename: str(o.source_filename) ?? str(o.filename) ?? "",
    documentDate: o.document_date,
    documentDateSource: o.document_date_source,
    arrivalDate: o.ingested_at ?? o.arrival_date ?? o.created_time,
  });

  if (naming.documentDate) {
    push("Detected document date", naming.documentDate);
    push("Date source", describeDateSource(naming.documentDateSource));
  } else if (naming.originalFilename) {
    // Silence here would read as "not checked"; it is in fact "no date found,
    // and we refused to invent one".
    push("Detected document date", "none found — filename left unchanged");
  }

  push("Summary", clip(str(o.summary), 260));
  push("Proposed filing", filingPath(o));

  if (naming.originalFilename) {
    push("Current filename", naming.originalFilename);
    push(
      "Proposed filename",
      naming.wouldRename
        ? naming.canonicalFilename
        : `${naming.canonicalFilename} (unchanged — already canonical)`,
    );
  }
  if (naming.conflictingExistingDate) {
    push(
      "Filename date conflict",
      `The file already claims ${naming.conflictingExistingDate}, but the authoritative document date is ${naming.documentDate}. Check which is correct before any rename.`,
    );
  }

  push("Reason", clip(str(o.reason_for_classification) || str(o.reason), 240));
  push("Confidence", formatConfidence(o.confidence));

  const extraction = str(o.extraction_status);
  if (extraction) push("Extraction", extraction);

  // Warnings are the reviewer's stop signal, so an explicit "none" is better
  // than an absent line they might read as "not checked".
  const warnings = str(o.warnings) || str(o.warning) || str(o.uncertainty);
  push("Warnings", clip(warnings || "none", 200));

  return sections.map((s) => `${s.label}:\n${s.value}`).join("\n\n");
}

/** Generic fallback: label-cased keys with scalar values, in declared order. */
function genericBrief(o: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(o)) {
    const value = str(v);
    if (!value) continue;
    const label = k.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
    lines.push(`${label}: ${clip(value, 200)}`);
    if (lines.length >= 20) break;
  }
  return lines.join("\n");
}

/**
 * Description shown on the approval card.
 *
 * Falls back to the raw content whenever it isn't a JSON object, or when the
 * rendered brief would be empty — never returns less information than before.
 */
export function formatApprovalDescription(content: string): string {
  const parsed = parseApprovalJson(content);
  if (!parsed) return content.slice(0, APPROVAL_DESCRIPTION_LIMIT);
  const brief = documentBrief(parsed) ?? genericBrief(parsed);
  if (!brief.trim()) return content.slice(0, APPROVAL_DESCRIPTION_LIMIT);
  return brief.slice(0, APPROVAL_DESCRIPTION_LIMIT);
}

/**
 * Payload stored with the approval.
 *
 * `last_output` stays verbatim for backward compatibility and for downstream
 * consumers; `proposal` is the parsed object so the expandable view shows
 * clean, complete, machine-readable JSON.
 */
export function buildApprovalPayload(content: string): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    last_output: content.slice(0, APPROVAL_PAYLOAD_LIMIT),
  };
  const parsed = parseApprovalJson(content);
  if (parsed) {
    payload.proposal = parsed;
    // Mirror the deterministic naming decision into the payload so a later
    // filing step consumes the same string the human saw, instead of
    // recomputing it from a model field that may since have drifted.
    const naming = buildCanonicalFilename({
      originalFilename: str(parsed.source_filename) ?? str(parsed.filename) ?? "",
      documentDate: parsed.document_date,
      documentDateSource: parsed.document_date_source,
      arrivalDate: parsed.ingested_at ?? parsed.arrival_date ?? parsed.created_time,
    });
    if (naming.originalFilename) {
      payload.naming = {
        original_filename: naming.originalFilename,
        canonical_filename: naming.canonicalFilename,
        document_date: naming.documentDate,
        document_date_source: naming.documentDateSource,
        rename_required: naming.wouldRename,
        conflicting_existing_date: naming.conflictingExistingDate,
      };
    }
  }
  return payload;
}
