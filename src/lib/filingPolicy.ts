// Promoting a confirmed filing rule into NATIVE knowledge.
//
// This is the one place where a clarification dialogue produces something
// durable, and it writes into the platform's own knowledge base — a normal
// `knowledge_documents` row, chunked and embedded into `kb_chunks` exactly like
// a pasted document. Nothing bespoke: the rule is then retrievable by the
// standard `kb_search` tool, which is one of the few tools that survives a
// HEADLESS swarm run (HEADLESS_SCOPED_TOOLS in swarmExecute.server.ts). That is
// what closes the loop — a rule agreed in conversation is found by a later
// automated intake run.
//
// WHY THIS IS GATED SO TIGHTLY
// Not every sentence in a dialogue is a rule. The platform ALREADY learns the
// softer signal by itself: the native post-turn extractor writes preferences
// into `agent_memory_items` from the conversation without any help from us.
// This function handles only the strong case — the agent formulated a general
// rule, stated it, and the human explicitly agreed to it. That explicit
// confirmation is the entire justification for durable, cross-agent knowledge;
// without it we write nothing and let native memory do its job.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function loadFilingPolicyServerDeps() {
  const [{ supabaseAdmin }, { embedAndStoreDocuments }, { resolveEmbedTarget }] = await Promise.all([
    import("@/integrations/supabase/client.server"),
    import("@/utils/tools/embedding.server"),
    import("@/utils/tools/embedTarget.server"),
  ]);
  return { supabaseAdmin, embedAndStoreDocuments, resolveEmbedTarget };
}

/** The knowledge base confirmed filing rules live in. Created on first use. */
export const FILING_POLICY_KB_NAME = "aleXation Filing Knowledge";

async function ensurePolicyKb(
  sb: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data: existing } = await sb
    .from("knowledge_bases")
    .select("id")
    .eq("user_id", userId)
    .eq("name", FILING_POLICY_KB_NAME)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await sb
    .from("knowledge_bases")
    .insert({
      user_id: userId,
      name: FILING_POLICY_KB_NAME,
      description:
        "Reusable filing knowledge: known domains, document families and filing rules a " +
        "human explicitly confirmed during a clarification dialogue. Consulted before every " +
        "filing proposal via kb_search.",
    })
    .select("id")
    .maybeSingle();
  return created?.id ?? null;
}

export type PolicyPromotion =
  | { promoted: false; reason: "not_confirmed" | "no_kb" | "no_embedding_key" | "duplicate" }
  | { promoted: true; document_id: string; knowledge_base_id: string; chunks: number };

/**
 * Write a human-confirmed filing rule into the native knowledge base.
 *
 * `context` is the surrounding agreement in the agent's own words. It is stored
 * alongside the rule because a bare rule retrieves poorly and reads worse: the
 * example that produced it is what makes it applicable later.
 */
export async function promoteConfirmedRule(args: {
  userId: string;
  rule: string;
  context: string;
  subjectKey: string;
  conversationId: string | null;
  /** The approval the disagreement started from, when known. */
  approvalId?: string | null;
}): Promise<PolicyPromotion> {
  const { supabaseAdmin, resolveEmbedTarget, embedAndStoreDocuments } = await loadFilingPolicyServerDeps();
  const rule = args.rule.trim();
  const confirmedAt = new Date().toISOString();
  if (!rule) return { promoted: false, reason: "not_confirmed" };

  const kbId = await ensurePolicyKb(supabaseAdmin, args.userId);
  if (!kbId) return { promoted: false, reason: "no_kb" };

  // The same rule agreed twice should sharpen the existing entry, not stack up
  // near-duplicates that all match the same query and crowd out everything else.
  const { data: dupe } = await supabaseAdmin
    .from("knowledge_documents")
    .select("id")
    .eq("knowledge_base_id", kbId)
    .eq("name", ruleTitle(rule))
    .maybeSingle();
  if (dupe?.id) return { promoted: false, reason: "duplicate" };

  const content = [
    "# Confirmed filing rule",
    "",
    rule,
    "",
    "## Agreed context",
    args.context.trim() || "(none recorded)",
    "",
    "## Provenance",
    `Proposed by the clarification agent and explicitly confirmed by the human on ${confirmedAt}.`,
    `Originating document: ${args.subjectKey}.`,
    args.approvalId ? `Originating approval: ${args.approvalId}.` : "",
    "",
    "This rule was human-confirmed. Do not overwrite or contradict it on the basis of model output alone;",
    "surface a conflict for human review instead.",
  ]
    .filter(Boolean)
    .join("\n");

  const { data: doc } = await supabaseAdmin
    .from("knowledge_documents")
    .insert({
      user_id: args.userId,
      knowledge_base_id: kbId,
      name: ruleTitle(rule),
      content,
      metadata: {
        source: "clarification_dialogue",
        subject_key: args.subjectKey,
        conversation_id: args.conversationId,
        approval_id: args.approvalId ?? null,
        // Provenance for every durable semantic item: who proposed it, that a
        // human confirmed it, and when. `status` exists so a later contradiction
        // can be parked for review rather than silently overwriting this.
        proposed_by_agent: "clarification-agent",
        confirmed_by_human: true,
        confirmed_at: confirmedAt,
        origin: "inferred_then_human_confirmed",
        status: "trusted",
      },
    })
    .select("id")
    .maybeSingle();
  if (!doc?.id) return { promoted: false, reason: "no_kb" };

  // Unembedded, the rule exists but cannot be found — and kb_search is the only
  // way a headless run will ever see it. Treat a missing key as a real failure
  // rather than reporting success on a document nothing can retrieve.
  const target = await resolveEmbedTarget(args.userId, {});
  if (!target) return { promoted: false, reason: "no_embedding_key" };

  const result = await embedAndStoreDocuments({
    sb: supabaseAdmin,
    docs: [
      {
        id: doc.id,
        knowledge_base_id: kbId,
        user_id: args.userId,
        content,
        metadata: {},
      } as EmbedDocInput,
    ],
    openaiKey: target.apiKey,
    userId: args.userId,
    surface: "Clarification: confirm rule",
    endpoint: target.endpoint,
    allowCustomModel: target.allowCustomModel,
    defaults: { model: target.model },
    stampProvider: target.provider,
  });

  return {
    promoted: true,
    document_id: doc.id,
    knowledge_base_id: kbId,
    chunks: result.chunksInserted ?? 0,
  };
}

/** A short, stable title so the same rule agreed twice collides by name. */
function ruleTitle(rule: string): string {
  const firstSentence = rule.split(/(?<=[.!?])\s/)[0] ?? rule;
  const trimmed = firstSentence.trim().replace(/\s+/g, " ");
  return trimmed.length > 90 ? `${trimmed.slice(0, 87)}…` : trimmed;
}
