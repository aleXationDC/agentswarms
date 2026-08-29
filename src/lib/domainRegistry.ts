/**
 * Domain governance: turning free-text model output into stable identifiers.
 *
 * THE PROBLEM THIS SOLVES
 * Two consecutive runs on the SAME document produced
 * "Deutsche Telekom / Internal Policies" and "Deutsche Telekom / Internal
 * Policy". Semantically one domain, textually two. Left alone that fragments
 * every filter, every report and every graph entity, and it gets worse with
 * each run — the registry would slowly fill with near-duplicates that no query
 * can reunite.
 *
 * WHY A DATASET AND NOT A TABLE
 * Same reason as the document registry: `sql_query` reads exclusively from
 * `user_data_tables`/`user_data_rows` and cannot see the app's own schema. A
 * bespoke Postgres table would be invisible to every agent, every BI widget and
 * the AI Analyst. As a dataset the domain list is queryable and inspectable
 * with no new UI.
 *
 * WHAT IS NATIVE HERE
 *   - embeddings          → `embedTexts` + `resolveEmbedTarget` (the same
 *                           vector path kb_search uses)
 *   - confirmed domains   → `kb_graph_entities` in the Filing Knowledge KB,
 *                           which already enforces uniqueness on
 *                           (kb, normalized_name, type)
 *   - human confirmation  → the existing native clarification conversation
 *
 * WHAT IS CUSTOM AND WHY
 * Only the resolution step. Native `normalize()` in the graph builder is
 * lowercase-plus-punctuation, which maps "Policy" and "Policies" to DIFFERENT
 * keys — so the native uniqueness constraint cannot deduplicate exactly the
 * drift we observed. Nothing native compares a proposed name against known ones
 * before writing. That comparison is this file, and nothing more: it does not
 * store knowledge, it decides which existing identifier a string refers to.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

async function loadEmbeddingTargets() {
  const [{ embedTexts }, { resolveEmbedTarget }] = await Promise.all([
    import("@/utils/tools/embedding.server"),
    import("@/utils/tools/embedTarget.server"),
  ]);
  return { embedTexts, resolveEmbedTarget };
}

export const DOMAIN_DATASET = "domain_registry";

export const DOMAIN_COLUMNS: { name: string; type: "string" | "number" | "date" }[] = [
  { name: "domain_id", type: "string" },
  { name: "canonical_name", type: "string" },
  // Comparison key only. NEVER displayed and never treated as the name — it is
  // lossy on purpose (see normalizeForComparison).
  { name: "normalized_name", type: "string" },
  // candidate | confirmed | merged | retired
  { name: "status", type: "string" },
  { name: "parent_domain_id", type: "string" },
  // Every surface form we have seen for this domain, newline-separated. This is
  // what makes the drift recoverable instead of merely suppressed.
  { name: "aliases", type: "string" },
  { name: "document_count", type: "number" },
  { name: "created_at", type: "date" },
  { name: "confirmed_at", type: "date" },
  { name: "merged_into_domain_id", type: "string" },
  // provenance — how this domain came to exist and who vouched for it
  { name: "proposed_by", type: "string" },
  { name: "confirmed_by_human", type: "string" },
  { name: "source_document_id", type: "string" },
  { name: "source_conversation_id", type: "string" },
  { name: "source_approval_id", type: "string" },
  // Deterministic mapping to the native graph entity, when one exists.
  { name: "graph_entity_id", type: "string" },
];

export type DomainRow = Record<string, string | number | null>;

export type DomainStatus = "candidate" | "confirmed" | "merged" | "retired";

/**
 * Similarity above which two domain names are treated as the same domain
 * without asking. Deliberately high: a false merge silently destroys a
 * distinction the user cares about, and unlike a false split it is not visible
 * in any listing. Below this we create a candidate and let a human decide.
 */
const AUTO_REUSE_THRESHOLD = 0.93;

/**
 * Lossy key used ONLY to compare two names.
 *
 * Beyond the native graph normaliser (lowercase + punctuation) this also folds
 * English plurals, because "Internal Policy" and "Internal Policies" are the
 * concrete drift we observed and a deterministic rule beats an embedding call
 * for it. Applied per word so "Policies" folds without touching "Analysis".
 */
export function normalizeForComparison(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s/]/g, " ")
    .replace(/\s*\/\s*/g, " / ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singularise)
    .join(" ")
    .trim();
}

function singularise(w: string): string {
  if (w.length <= 3) return w;
  // "policies" → "policy", "companies" → "company"
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  // "boxes" → "box", but not "notes" → "not"
  if (/(ch|sh|ss|x|z)es$/.test(w)) return w.slice(0, -2);
  // "policys" is not a word, but we only need a stable KEY, not English.
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us")) return w.slice(0, -1);
  return w;
}

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

function aliasList(v: unknown): string[] {
  const s = str(v);
  return s
    ? s
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ---------------------------------------------------------------------------
// dataset plumbing (mirrors documentRegistry.ts so both look native alike)
// ---------------------------------------------------------------------------

export async function ensureDomainDataset(
  sb: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: existing } = await sb
    .from("user_data_tables")
    .select("id")
    .eq("user_id", userId)
    .eq("name", DOMAIN_DATASET)
    .maybeSingle();

  if (existing?.id) {
    await sb
      .from("user_data_tables")
      .update({ columns: DOMAIN_COLUMNS as unknown as Json })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data, error } = await sb
    .from("user_data_tables")
    .insert({
      user_id: userId,
      name: DOMAIN_DATASET,
      source_filename: "aleXation Domain Governance",
      columns: DOMAIN_COLUMNS as unknown as Json,
      is_sample: false,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "could not create domain dataset");
  return (data as { id: string }).id;
}

async function loadDomains(
  sb: SupabaseClient<Database>,
  tableId: string,
): Promise<{ rowId: number; row: DomainRow }[]> {
  const { data } = await sb
    .from("user_data_rows")
    .select("id,row")
    .eq("table_id", tableId)
    .limit(2000);
  return ((data ?? []) as unknown as { id: number; row: DomainRow }[]).map((r) => ({
    rowId: r.id,
    row: r.row,
  }));
}

// ---------------------------------------------------------------------------
// resolution
// ---------------------------------------------------------------------------

export type DomainResolution = {
  domainId: string;
  canonicalName: string;
  status: DomainStatus;
  /** How the incoming string was matched to this domain. */
  matchedBy: "exact" | "normalized" | "alias" | "semantic" | "created";
  /** Similarity when matchedBy === "semantic". */
  similarity?: number;
  /** The string the model actually produced, kept as provenance. */
  proposedName: string;
  /** True when this call created a new candidate that no human has blessed. */
  isNewCandidate: boolean;
  /**
   * Closest confirmed domain when we did NOT reuse it — i.e. the near miss.
   * Carried so the governance card can show a human what this might be a
   * duplicate of, instead of asking them to remember every domain themselves.
   */
  nearest?: { domainId: string; canonicalName: string; similarity: number } | null;
};

/**
 * Resolve a model-proposed domain name to a stable domain_id.
 *
 * Order matters — cheapest and most certain first:
 *   1. exact canonical name
 *   2. normalised key (this is what catches Policy/Policies)
 *   3. a recorded alias
 *   4. embedding similarity against CONFIRMED domains only
 *   5. otherwise: a new candidate, explicitly not trusted
 *
 * Step 4 is restricted to confirmed domains on purpose. Letting candidates
 * absorb each other semantically would build clusters of unverified names that
 * look authoritative because they are large.
 */
export async function resolveDomain(
  sb: SupabaseClient<Database>,
  args: {
    userId: string;
    proposedName: string;
    sourceDocumentId?: string | null;
    sourceApprovalId?: string | null;
    sourceConversationId?: string | null;
    proposedBy?: string | null;
  },
): Promise<DomainResolution | null> {
  const proposed = str(args.proposedName);
  if (!proposed) return null;

  const tableId = await ensureDomainDataset(sb, args.userId);
  const rows = await loadDomains(sb, tableId);

  // A merged domain must never be returned; follow the pointer to its survivor
  // so historical aliases keep resolving after a deduplication.
  const byId = new Map(rows.map((r) => [String(r.row.domain_id), r]));
  const resolveMerged = (r: { rowId: number; row: DomainRow }) => {
    let cur = r;
    for (let i = 0; i < 8; i++) {
      const into = str(cur.row.merged_into_domain_id);
      if (!into) break;
      const next = byId.get(into);
      if (!next) break;
      cur = next;
    }
    return cur;
  };

  const live = rows.filter((r) => str(r.row.status) !== "retired");
  const norm = normalizeForComparison(proposed);

  const finish = async (
    hit: { rowId: number; row: DomainRow },
    matchedBy: DomainResolution["matchedBy"],
    similarity?: number,
  ): Promise<DomainResolution> => {
    const target = resolveMerged(hit);
    // Record the surface form we just saw. This is the provenance that makes a
    // later "why is this document in that domain?" answerable.
    const aliases = aliasList(target.row.aliases);
    const known = new Set([
      ...aliases.map((a) => a.toLowerCase()),
      String(target.row.canonical_name ?? "").toLowerCase(),
    ]);
    const patch: DomainRow = {
      ...target.row,
      document_count: Number(target.row.document_count ?? 0) + 1,
    };
    if (!known.has(proposed.toLowerCase())) {
      patch.aliases = [...aliases, proposed].join("\n");
    }
    await sb
      .from("user_data_rows")
      .update({ row: patch as unknown as Json })
      .eq("id", target.rowId);
    return {
      domainId: String(target.row.domain_id),
      canonicalName: String(target.row.canonical_name),
      status: (str(target.row.status) as DomainStatus) ?? "candidate",
      matchedBy,
      similarity,
      proposedName: proposed,
      isNewCandidate: false,
    };
  };

  const exact = live.find((r) => String(r.row.canonical_name ?? "") === proposed);
  if (exact) return finish(exact, "exact");

  const normHit = live.find((r) => String(r.row.normalized_name ?? "") === norm);
  if (normHit) return finish(normHit, "normalized");

  const aliasHit = live.find((r) =>
    aliasList(r.row.aliases).some((a) => normalizeForComparison(a) === norm),
  );
  if (aliasHit) return finish(aliasHit, "alias");

  const confirmed = live.filter((r) => str(r.row.status) === "confirmed");
  let nearest: DomainResolution["nearest"] = null;
  if (confirmed.length > 0) {
    const best = await bestSemanticMatch(args.userId, proposed, confirmed);
    if (best && best.similarity >= AUTO_REUSE_THRESHOLD) {
      return finish(best.hit, "semantic", best.similarity);
    }
    if (best) {
      nearest = {
        domainId: String(best.hit.row.domain_id),
        canonicalName: String(best.hit.row.canonical_name),
        similarity: best.similarity,
      };
    }
  }

  // Nothing matched. Create a CANDIDATE — detected, recorded, queryable, and
  // explicitly not yet an authoritative classification anchor.
  const domainId = crypto.randomUUID();
  const row: DomainRow = {
    domain_id: domainId,
    canonical_name: proposed,
    normalized_name: norm,
    status: "candidate",
    parent_domain_id: null,
    aliases: "",
    document_count: 1,
    created_at: new Date().toISOString(),
    confirmed_at: null,
    merged_into_domain_id: null,
    proposed_by: args.proposedBy ?? "document-intake-swarm",
    confirmed_by_human: "no",
    source_document_id: args.sourceDocumentId ?? null,
    source_conversation_id: args.sourceConversationId ?? null,
    source_approval_id: args.sourceApprovalId ?? null,
    graph_entity_id: null,
  };
  await sb.from("user_data_rows").insert({ table_id: tableId, row: row as unknown as Json });

  return {
    domainId,
    canonicalName: proposed,
    status: "candidate",
    matchedBy: "created",
    proposedName: proposed,
    isNewCandidate: true,
    nearest,
  };
}

/**
 * Nearest confirmed domain by embedding similarity.
 *
 * Uses the native embedding path so domain comparison lives in the same vector
 * space as kb_search. Returns null rather than throwing when embeddings are
 * unavailable: losing semantic matching degrades us to a new candidate, which
 * a human can merge — losing the run would cost the whole classification.
 */
async function bestSemanticMatch(
  userId: string,
  proposed: string,
  confirmed: { rowId: number; row: DomainRow }[],
): Promise<{ hit: { rowId: number; row: DomainRow }; similarity: number } | null> {
  try {
    const { resolveEmbedTarget, embedTexts } = await loadEmbeddingTargets();
    const target = await resolveEmbedTarget(userId);
    if (!target) return null;

    // Compare against canonical names AND every known alias, so "DT / Internal
    // Policies" matches once someone has confirmed that alias, even though the
    // canonical name spells the company out.
    const probes: { idx: number; text: string }[] = [];
    confirmed.forEach((r, idx) => {
      probes.push({ idx, text: String(r.row.canonical_name ?? "") });
      for (const a of aliasList(r.row.aliases)) probes.push({ idx, text: a });
    });

    const vectors = await embedTexts(
      [proposed, ...probes.map((p) => p.text)],
      target.apiKey,
      target.model,
      {
        userId,
        surface: "domain-resolution",
        endpoint: target.endpoint,
        allowCustomModel: target.allowCustomModel,
      },
    );
    if (vectors.length !== probes.length + 1) return null;

    const q = vectors[0];
    let bestIdx = -1;
    let bestSim = -1;
    probes.forEach((p, i) => {
      const sim = cosine(q, vectors[i + 1]);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = p.idx;
      }
    });
    if (bestIdx < 0) return null;
    return { hit: confirmed[bestIdx], similarity: bestSim };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// promotion — the only path from candidate to trusted, and it needs a human
// ---------------------------------------------------------------------------

/**
 * Promote a candidate domain to confirmed.
 *
 * Requires an explicit human confirmation flag. There is no code path that
 * promotes a domain because it was seen often, because a model was confident,
 * or because it looked important — recurrence is evidence for ASKING, never a
 * substitute for the answer.
 */
export async function confirmDomain(
  sb: SupabaseClient<Database>,
  args: {
    userId: string;
    domainId: string;
    confirmedByHuman: boolean;
    /** Optional preferred display name from a RENAME outcome. */
    canonicalName?: string | null;
    parentDomainId?: string | null;
    sourceConversationId?: string | null;
    sourceApprovalId?: string | null;
  },
): Promise<{ confirmed: boolean; reason?: string }> {
  if (!args.confirmedByHuman) return { confirmed: false, reason: "not_human_confirmed" };

  const tableId = await ensureDomainDataset(sb, args.userId);
  const rows = await loadDomains(sb, tableId);
  const hit = rows.find((r) => String(r.row.domain_id) === args.domainId);
  if (!hit) return { confirmed: false, reason: "unknown_domain" };

  const rename = str(args.canonicalName);
  const aliases = aliasList(hit.row.aliases);
  const previous = String(hit.row.canonical_name ?? "");
  // A rename keeps the old spelling as an alias, so documents classified under
  // the previous wording still resolve here.
  if (rename && rename !== previous && !aliases.includes(previous)) aliases.push(previous);

  const row: DomainRow = {
    ...hit.row,
    canonical_name: rename ?? previous,
    normalized_name: normalizeForComparison(rename ?? previous),
    status: "confirmed",
    parent_domain_id: args.parentDomainId ?? hit.row.parent_domain_id ?? null,
    aliases: aliases.join("\n"),
    confirmed_at: new Date().toISOString(),
    confirmed_by_human: "yes",
    source_conversation_id: args.sourceConversationId ?? hit.row.source_conversation_id ?? null,
    source_approval_id: args.sourceApprovalId ?? hit.row.source_approval_id ?? null,
  };
  await sb
    .from("user_data_rows")
    .update({ row: row as unknown as Json })
    .eq("id", hit.rowId);
  return { confirmed: true };
}

/**
 * Merge one domain into another after a human says they are the same thing.
 *
 * The loser is kept, not deleted: its id may already be referenced by registry
 * rows, and `merged_into_domain_id` lets those rows keep resolving instead of
 * dangling. Its aliases move to the survivor so future drift toward the old
 * wording still lands correctly.
 */
export async function mergeDomains(
  sb: SupabaseClient<Database>,
  args: {
    userId: string;
    sourceDomainId: string;
    targetDomainId: string;
    confirmedByHuman: boolean;
  },
): Promise<{ merged: boolean; reason?: string }> {
  if (!args.confirmedByHuman) return { merged: false, reason: "not_human_confirmed" };
  if (args.sourceDomainId === args.targetDomainId) return { merged: false, reason: "same_domain" };

  const tableId = await ensureDomainDataset(sb, args.userId);
  const rows = await loadDomains(sb, tableId);
  const src = rows.find((r) => String(r.row.domain_id) === args.sourceDomainId);
  const dst = rows.find((r) => String(r.row.domain_id) === args.targetDomainId);
  if (!src || !dst) return { merged: false, reason: "unknown_domain" };

  const merged = new Set([
    ...aliasList(dst.row.aliases),
    ...aliasList(src.row.aliases),
    String(src.row.canonical_name ?? ""),
  ]);
  merged.delete(String(dst.row.canonical_name ?? ""));
  merged.delete("");

  await sb
    .from("user_data_rows")
    .update({
      row: {
        ...dst.row,
        aliases: [...merged].join("\n"),
        document_count: Number(dst.row.document_count ?? 0) + Number(src.row.document_count ?? 0),
      } as unknown as Json,
    })
    .eq("id", dst.rowId);

  await sb
    .from("user_data_rows")
    .update({
      row: {
        ...src.row,
        status: "merged",
        merged_into_domain_id: args.targetDomainId,
      } as unknown as Json,
    })
    .eq("id", src.rowId);

  return { merged: true };
}

/** Confirmed domains, for prompting an agent with what already exists. */
export async function listConfirmedDomains(
  sb: SupabaseClient<Database>,
  userId: string,
): Promise<{ domainId: string; canonicalName: string; aliases: string[] }[]> {
  const tableId = await ensureDomainDataset(sb, userId);
  const rows = await loadDomains(sb, tableId);
  return rows
    .filter((r) => str(r.row.status) === "confirmed")
    .map((r) => ({
      domainId: String(r.row.domain_id),
      canonicalName: String(r.row.canonical_name),
      aliases: aliasList(r.row.aliases),
    }));
}
