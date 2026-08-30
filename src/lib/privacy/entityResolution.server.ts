// Entity resolution foundation (DMS-D1-0002 §6).
//
// Scope for THIS D1 execution is deliberately minimal: a deterministic,
// exact-match resolver contract (`matched` / `ambiguous` / `unknown`) plus the
// smallest native storage that lets the same real-world entity map to the same
// internal canonical id across documents. Everything the spec explicitly says
// NOT to build now (admin UI, promotion workflow, CardDAV/CalDAV, deadlines)
// is intentionally absent.
//
// WHY A DATASET, NOT A NEW POSTGRES TABLE
// Same reasoning as documentRegistry.ts: this is operational/native metadata,
// not security material, so it can live in `user_data_tables`/`user_data_rows`
// like every other native dataset — visible to `sql_query`, the BI grid, etc.
// That is safe ONLY because this table never holds clear PII: `entity_key` is
// an opaque SHA-256 hash of a normalised value, and `canonical_id` is a plain
// label like "PERSON-a1b2c3d4". The clear value itself lives only in the
// Privacy Vault (privacyVault.server.ts), addressed by the same `entity_key`.
//
// WHY EXACT-MATCH ONLY, FOR NOW
// The contract returns `matched | ambiguous | unknown` so a future fuzzy
// resolver can slot in without changing callers, but this implementation only
// ever produces `matched` (exact same normalised value seen before) or
// `unknown` (never seen). It never guesses: two different values are never
// silently linked, per the "unknown/ambiguous stays reviewable" requirement.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import type { EntityType } from "@/lib/privacy/privacyVault.server";
import { deriveEntityLookupKey } from "@/lib/privacy/vaultCrypto.server";

export const ENTITY_RESOLUTION_DATASET = "entity_resolution";

export const ENTITY_RESOLUTION_COLUMNS: { name: string; type: "string" | "number" | "date" }[] = [
  { name: "entity_key", type: "string" },
  { name: "entity_type", type: "string" },
  { name: "canonical_id", type: "string" },
  // "candidate" until a human confirms it; "confirmed" once reviewed. D1 never
  // auto-promotes a candidate — see §6 "unknown contact" future direction.
  { name: "status", type: "string" },
  { name: "first_seen_at", type: "date" },
  { name: "last_seen_at", type: "date" },
  { name: "occurrence_count", type: "number" },
];

export type EntityResolution =
  | { status: "matched"; canonicalId: string; entityKey: string }
  | { status: "unknown"; entityKey: string }
  | { status: "ambiguous"; entityKey: string; candidates: string[] };

/** Normalise a raw value before hashing: trim, lowercase, collapse whitespace. */
export function normalizeEntityValue(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Derive the opaque, deterministic key for one (type, normalised value) pair.
 * Same input always yields the same key so repeated sightings of the same
 * real-world entity resolve to the same row — without ever storing the clear
 * value here.
 *
 * DMS-D1-0002R Phase A5: keyed by the Privacy Vault secret (HMAC-SHA256, via
 * deriveEntityLookupKey) rather than a bare SHA-256 digest of the clear value
 * — a normalised name/email/phone is low-entropy enough that an unkeyed hash
 * is dictionary-attackable by anyone who can read this dataset's rows.
 */
export async function deriveEntityKey(
  entityType: EntityType,
  normalizedValue: string,
): Promise<string> {
  return deriveEntityLookupKey(entityType, normalizedValue);
}

function shortSuffix(entityKey: string): string {
  return entityKey.slice(0, 8);
}

const CANONICAL_PREFIX: Record<EntityType, string> = {
  person: "PERSON",
  email: "EMAIL",
  phone: "PHONE",
  address: "ADDR",
  iban: "IBAN",
  payment_card: "CARD",
  tax_id: "TAXID",
  id_document: "IDDOC",
  other: "ENTITY",
};

/** Ensure the dataset exists and return its id. Mirrors ensureRegistryDataset. */
export async function ensureEntityResolutionDataset(
  sb: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: existing } = await sb
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", ENTITY_RESOLUTION_DATASET)
    .maybeSingle();
  if (existing?.id) {
    await sb
      .from("user_data_tables")
      .update({ columns: ENTITY_RESOLUTION_COLUMNS as unknown as Json })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: created, error } = await sb
    .from("user_data_tables")
    .insert({
      user_id: userId,
      name: ENTITY_RESOLUTION_DATASET,
      source_filename: "aleXation Entity Resolution",
      columns: ENTITY_RESOLUTION_COLUMNS as unknown as Json,
      is_sample: false,
    })
    .select("id")
    .single();
  if (error || !created)
    throw new Error(error?.message ?? "Could not create the entity_resolution dataset");
  return created.id;
}

/**
 * Resolve one (type, raw value) against known entities for this owner. Never
 * creates anything — pure lookup. Use `registerCandidateEntity` to record an
 * `unknown` result so it becomes `matched` the next time the same value shows
 * up.
 */
export async function resolveEntity(
  sb: SupabaseClient<Database>,
  userId: string,
  args: { entityType: EntityType; rawValue: string },
): Promise<EntityResolution> {
  const normalized = normalizeEntityValue(args.rawValue);
  const entityKey = await deriveEntityKey(args.entityType, normalized);

  const tableId = await ensureEntityResolutionDataset(sb, userId);
  const { data: hit } = await sb
    .from("user_data_rows")
    .select("row")
    .eq("table_id", tableId)
    .eq("row->>entity_key", entityKey)
    .maybeSingle();

  if (hit?.row) {
    const row = hit.row as Record<string, unknown>;
    const canonicalId = typeof row.canonical_id === "string" ? row.canonical_id : null;
    if (canonicalId) return { status: "matched", canonicalId, entityKey };
  }
  return { status: "unknown", entityKey };
}

/**
 * Record a newly-seen entity as a reviewable candidate. Called after
 * `resolveEntity` returns `unknown`. The canonical id is derived deterministically
 * from the entity key (not sequentially numbered) so concurrent intakes of the
 * same new entity can never race into two different ids for the same value —
 * a second registration of the same key is a no-op update of the occurrence
 * counters, not a new row.
 */
export async function registerCandidateEntity(
  sb: SupabaseClient<Database>,
  userId: string,
  args: { entityType: EntityType; rawValue: string },
): Promise<{ canonicalId: string; entityKey: string; action: "inserted" | "updated" }> {
  const normalized = normalizeEntityValue(args.rawValue);
  const entityKey = await deriveEntityKey(args.entityType, normalized);
  const tableId = await ensureEntityResolutionDataset(sb, userId);
  const nowIso = new Date().toISOString();

  const { data: hit } = await sb
    .from("user_data_rows")
    .select("id, row")
    .eq("table_id", tableId)
    .eq("row->>entity_key", entityKey)
    .maybeSingle();

  if (hit?.id) {
    const prev = (hit.row ?? {}) as Record<string, unknown>;
    const canonicalId =
      typeof prev.canonical_id === "string"
        ? prev.canonical_id
        : `${CANONICAL_PREFIX[args.entityType]}-${shortSuffix(entityKey)}`;
    const prevCount = typeof prev.occurrence_count === "number" ? prev.occurrence_count : 0;
    await sb
      .from("user_data_rows")
      .update({
        row: {
          ...prev,
          canonical_id: canonicalId,
          last_seen_at: nowIso,
          occurrence_count: prevCount + 1,
        } as unknown as Json,
      })
      .eq("id", hit.id);
    return { canonicalId, entityKey, action: "updated" };
  }

  const canonicalId = `${CANONICAL_PREFIX[args.entityType]}-${shortSuffix(entityKey)}`;
  await sb.from("user_data_rows").insert({
    table_id: tableId,
    row: {
      entity_key: entityKey,
      entity_type: args.entityType,
      canonical_id: canonicalId,
      status: "candidate",
      first_seen_at: nowIso,
      last_seen_at: nowIso,
      occurrence_count: 1,
    } as unknown as Json,
  });
  return { canonicalId, entityKey, action: "inserted" };
}
