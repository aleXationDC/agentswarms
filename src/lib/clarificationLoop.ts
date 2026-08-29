// Human Clarification Loop — the pattern, and the only bridge it needs.
//
// PATTERN
//   Proposal → Human Approval
//     APPROVE → done (later: execution)
//     REJECT  → clarification dialogue (multi-turn, conversational)
//               → consensus → revised proposal → Human Approval → …
//
// WHY THIS IS NOT A CYCLE IN THE SWARM GRAPH
// It cannot be. Verified against this installation:
//   • `topoLevelIds` (src/lib/swarmGraph.ts) throws "Swarm has a cycle that
//     isn't a loop self-edge" — the executor runs a DAG in topological levels,
//     so an edge back from an approval to an earlier node is unrunnable.
//   • The `loop` node is an atomic self-refine over ONE agent call with no body
//     subgraph, so it cannot contain an approval, and mid-loop is not a
//     checkpointable state.
//   • A sub-swarm cannot suspend upward: checkpointing is gated on depth === 0.
// Therefore ONE PROPOSAL CYCLE = ONE SWARM RUN. The loop lives between runs,
// which is exactly what suspend/resume + checkpoints already support natively.
//
// WHERE THE DIALOGUE LIVES
// In the native chat engine — `conversations` + `messages` + /api/chat — driven
// by a real AgentSwarms agent row. No custom chat runtime and no custom chat UI:
// the existing playground renders it. The agent therefore gets the platform's
// memory, skills and tools for free, and the human answers in free text.
//
// WHERE THE KNOWLEDGE LIVES — ALL NATIVE, NONE OF IT HERE
// This file deliberately stores NO semantic content. Verified facilities:
//   • dialogue memory   → conversations + messages, plus the rolling summary in
//                         conversation_memory (STM).
//   • preferences       → agent_memory_items, written by the platform's own
//                         post-turn extractor (utils/memory/extract.server.ts,
//                         fired from routes/api/chat.ts). We do not extract
//                         anything ourselves; we simply stop disabling it.
//   • confirmed rules   → knowledge_documents + kb_chunks (pgvector), which the
//                         kb_search tool can reach from a HEADLESS swarm run —
//                         the one retrieval path that survives headless mode.
//   • domains / topics  → kb_graph_entities + kb_graph_relations.
//
// THE GAP THIS FILE BRIDGES — BOOKKEEPING ONLY
// Nothing native ties an approval to the run that produced it, to the
// conversation arguing about it, and to how many times we have been round the
// loop. `clarification_cases` is that missing join and nothing more: ids,
// the deterministic envelope, the proposal history and a cycle counter.
// If something looks semantic, it belongs in memory / KB / graph, not here.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Proposal cycles allowed per subject before we stop and ask for a human. */
export const MAX_PROPOSAL_CYCLES = 5;

export type ClarificationStatus = "open" | "clarifying" | "consensus" | "resolved" | "abandoned";

export type ProposalCycle = {
  cycle: number;
  proposal: Record<string, unknown>;
  approval_id?: string | null;
  decision?: "approved" | "rejected" | null;
  decided_at?: string | null;
  rejection_note?: string | null;
};

/**
 * The agent's signal that the dialogue has converged.
 *
 * This is a CONTROL signal, not a knowledge record — it decides whether the
 * next swarm run may start, and the agreed wording is passed straight to that
 * run as guidance. Nothing here is persisted as semantic state: what the
 * dialogue taught is captured by the platform's own memory extractor from the
 * conversation itself.
 */
export type ConsensusSignal = {
  consensus: true;
  /** One paragraph, in the agent's own words, of what was agreed. */
  agreed_summary: string;
  /**
   * A NEW filing rule formulated and explicitly confirmed during THIS
   * clarification. A prior rule from the reused conversation is not a new
   * proposition and must never be re-promoted during a later clarification.
   */
  new_reusable_rule?: string | null;
};

export type ClarificationCase = {
  id: string;
  user_id: string;
  subject_key: string;
  subject_kind: string;
  swarm_id: string | null;
  latest_swarm_run_id: string | null;
  /**
   * The most recent approval this case produced. The deterministic link used by
   * "Discuss with agent" — see findCaseForApproval for why re-deriving identity
   * from the approval payload was not safe.
   */
  approval_id: string | null;
  conversation_id: string | null;
  agent_id: string | null;
  envelope: Record<string, unknown>;
  proposals: ProposalCycle[];
  cycle_count: number;
  status: ClarificationStatus;
  created_at: string;
  updated_at: string;
};

/**
 * Stable identity of the thing being decided.
 *
 * Derived from the deterministic envelope, never from a model answer — the same
 * rule that governs the identity fields themselves. Repeated rejections of one
 * document must land on ONE case, or cycle_count means nothing and the loop
 * limit cannot bite.
 */
export function subjectKeyFromEnvelope(envelope: Record<string, unknown>): string | null {
  const docId = envelope.document_id;
  if (typeof docId === "string" && docId.trim()) return docId.trim();
  const driveId = envelope.drive_file_id;
  if (typeof driveId === "string" && driveId.trim()) return `drive:${driveId.trim()}`;
  const hash = envelope.content_hash;
  if (typeof hash === "string" && hash.trim()) return `sha256:${hash.trim()}`;
  return null;
}

/** Fetch the live case for a subject, if one exists. */
export async function findCase(
  sb: SupabaseClient,
  userId: string,
  subjectKey: string,
): Promise<ClarificationCase | null> {
  const { data } = await sb
    .from("clarification_cases")
    .select("*")
    .eq("user_id", userId)
    .eq("subject_key", subjectKey)
    .maybeSingle();
  return (data as ClarificationCase) ?? null;
}

/**
 * Fetch the case an approval belongs to.
 *
 * WHY THIS EXISTS — a real failure, not a hypothetical one.
 * The case is created by `recordProposal`, which derives `subject_key` from the
 * ENVELOPE: deterministic intake data. "Discuss with agent" used to look the
 * case up by re-deriving that key from the APPROVAL PAYLOAD instead — which is
 * model output. One run emitted a Drive id with a character missing
 * (`…EQ2lm21DXL` instead of `…EQG2lm21DXL`), the two keys diverged, and the
 * lookup returned nothing: "No clarification case for this approval".
 *
 * The fix is to stop deriving identity from generated text at all. `approval_id`
 * is a foreign key both sides already know, so it is now the primary lookup.
 * The subject-key path is kept as a fallback for cases recorded before the
 * column existed.
 */
export async function findCaseForApproval(
  sb: SupabaseClient,
  userId: string,
  approvalId: string,
  fallbackSubjectKey?: string | null,
): Promise<ClarificationCase | null> {
  const { data } = await sb
    .from("clarification_cases")
    .select("*")
    .eq("user_id", userId)
    .eq("approval_id", approvalId)
    .maybeSingle();
  if (data) return data as ClarificationCase;

  // Older cases carry no approval_id. Adopt them on first use rather than
  // leaving them permanently unreachable.
  if (fallbackSubjectKey) {
    const legacy = await findCase(sb, userId, fallbackSubjectKey);
    if (legacy) {
      await sb.from("clarification_cases").update({ approval_id: approvalId }).eq("id", legacy.id);
      return { ...legacy, approval_id: approvalId };
    }
  }
  return null;
}

/**
 * Record that a proposal was put in front of a human.
 *
 * Upsert rather than insert: a second run for the same document is a new CYCLE
 * of the same case, not a new case. `cycle_count` is incremented only here —
 * i.e. per proposal — so a long conversation never consumes the safety budget.
 */
export async function recordProposal(
  sb: SupabaseClient,
  args: {
    userId: string;
    subjectKey: string;
    subjectKind?: string;
    swarmId?: string | null;
    runId?: string | null;
    approvalId?: string | null;
    envelope: Record<string, unknown>;
    proposal: Record<string, unknown>;
  },
): Promise<ClarificationCase | null> {
  const existing = await findCase(sb, args.userId, args.subjectKey);

  if (!existing) {
    const entry: ProposalCycle = {
      cycle: 1,
      proposal: args.proposal,
      approval_id: args.approvalId ?? null,
      decision: null,
    };
    const { data } = await sb
      .from("clarification_cases")
      .insert({
        user_id: args.userId,
        subject_key: args.subjectKey,
        subject_kind: args.subjectKind ?? "document",
        swarm_id: args.swarmId ?? null,
        latest_swarm_run_id: args.runId ?? null,
        envelope: args.envelope,
        proposals: [entry],
        cycle_count: 1,
        status: "open",
        approval_id: args.approvalId ?? null,
      })
      .select()
      .maybeSingle();
    return (data as ClarificationCase) ?? null;
  }

  const cycle = existing.cycle_count + 1;
  const entry: ProposalCycle = {
    cycle,
    proposal: args.proposal,
    approval_id: args.approvalId ?? null,
    decision: null,
  };
  const { data } = await sb
    .from("clarification_cases")
    .update({
      latest_swarm_run_id: args.runId ?? existing.latest_swarm_run_id,
      swarm_id: args.swarmId ?? existing.swarm_id,
      // The envelope is deterministic and must not drift between cycles.
      envelope:
        existing.envelope && Object.keys(existing.envelope).length > 0
          ? existing.envelope
          : args.envelope,
      proposals: [...(existing.proposals ?? []), entry],
      cycle_count: cycle,
      status: "open",
      // Always the LATEST approval: that is the one a human is looking at, and
      // the one "Discuss with agent" will arrive from.
      approval_id: args.approvalId ?? existing.approval_id ?? null,
    })
    .eq("id", existing.id)
    .select()
    .maybeSingle();
  return (data as ClarificationCase) ?? null;
}

/**
 * Close out the current cycle with the human's decision.
 *
 * On rejection the case moves to `clarifying`, or to `abandoned` once the cycle
 * budget is spent — the safe stop the loop needs so a disagreement can never
 * spin forever. Abandoned means "a human must handle this"; it never means
 * "proceed anyway".
 */
/**
 * How many times a human has actually REJECTED a proposal for this case.
 *
 * The abandonment budget used to read `cycle_count`, which counts every
 * proposal ever recorded — including re-runs of the same document that were
 * never rejected at all. Repeated testing therefore exhausted the budget and
 * locked the case at "abandoned" without a single disagreement. The budget is
 * meant to stop a loop that cannot converge, so it must count the thing that
 * signals non-convergence: refusals, not attempts.
 */
export function rejectionCount(proposals: ProposalCycle[] | null | undefined): number {
  // Tolerant of a missing or malformed column: an unreadable history must not
  // throw inside the safety check it is supposed to inform.
  if (!Array.isArray(proposals)) return 0;
  return proposals.filter((p) => p?.decision === "rejected").length;
}

export async function recordDecision(
  sb: SupabaseClient,
  args: {
    userId: string;
    subjectKey: string;
    decision: "approved" | "rejected";
    note?: string | null;
  },
): Promise<ClarificationCase | null> {
  const existing = await findCase(sb, args.userId, args.subjectKey);
  if (!existing) return null;

  const proposals = [...(existing.proposals ?? [])];
  if (proposals.length > 0) {
    proposals[proposals.length - 1] = {
      ...proposals[proposals.length - 1],
      decision: args.decision,
      decided_at: new Date().toISOString(),
      rejection_note: args.decision === "rejected" ? (args.note ?? null) : null,
    };
  }

  const status: ClarificationStatus =
    args.decision === "approved"
      ? "resolved"
      : rejectionCount(proposals) >= MAX_PROPOSAL_CYCLES
        ? "abandoned"
        : "clarifying";

  const { data } = await sb
    .from("clarification_cases")
    .update({ proposals, status })
    .eq("id", existing.id)
    .select()
    .maybeSingle();

  // Keep the registry's review state in step with the human's decision. This is
  // what makes "show me everything still unreviewed" answerable. Best-effort:
  // the decision itself is what matters, and a stale review flag is repairable
  // where a lost decision is not.
  try {
    const { setReviewStatus } = await import("@/lib/documentRegistry");
    await setReviewStatus(sb, args.userId, args.subjectKey, {
      review:
        args.decision === "approved"
          ? "approved"
          : status === "abandoned"
            ? "manual"
            : "clarifying",
      approvedPath:
        args.decision === "approved"
          ? ((proposals.at(-1)?.proposal?.proposed_folder_path as string | undefined) ?? null)
          : null,
    });
  } catch (e) {
    console.warn("[clarification] registry review status not updated:", (e as Error).message);
  }

  return (data as ClarificationCase) ?? null;
}

/** Bind the case to the native conversation carrying its dialogue. */
export async function attachConversation(
  sb: SupabaseClient,
  caseId: string,
  conversationId: string,
  agentId: string,
): Promise<void> {
  await sb
    .from("clarification_cases")
    .update({ conversation_id: conversationId, agent_id: agentId })
    .eq("id", caseId);
}

/**
 * Mark the case as agreed so the next proposal cycle may start.
 *
 * Records the STATE TRANSITION only. What was agreed stays in the conversation,
 * where the platform's own memory extractor can see it — writing a copy here
 * would be exactly the parallel knowledge store this design rejects.
 */
export async function recordConsensus(sb: SupabaseClient, caseId: string): Promise<void> {
  await sb.from("clarification_cases").update({ status: "consensus" }).eq("id", caseId);
}

/**
 * The briefing the clarification agent opens the dialogue with.
 *
 * Everything the human already told the system, in one message: the document,
 * what was proposed, why it was refused, and what earlier cycles settled. This
 * is what keeps a second rejection from starting the conversation over — the
 * requirement that the dialogue be "resumed, not restarted" is satisfied by the
 * conversation itself persisting AND by this brief carrying the case forward.
 *
 * Identity fields are echoed for the human's benefit (so they can open the
 * original) and explicitly marked read-only, because the agent must never
 * restate them into a proposal.
 */
export function buildClarificationBrief(c: ClarificationCase): string {
  const env = c.envelope ?? {};
  const proposals = c.proposals ?? [];
  const last = proposals[proposals.length - 1];
  const lines: string[] = [];

  lines.push("## Document under discussion");
  lines.push(`- Filename: ${str(env.source_filename)}`);
  lines.push(`- Drive link: ${str(env.drive_url)}`);
  lines.push(`- Type: ${str(env.mime_type)}`);
  lines.push(
    `- Read-only identity (never restate these): document_id=${str(env.document_id)}, ` +
      `drive_file_id=${str(env.drive_file_id)}`,
  );

  const excerpt = typeof env.extracted_text === "string" ? env.extracted_text.slice(0, 3000) : "";
  if (excerpt) {
    lines.push("");
    lines.push("## Document content (excerpt)");
    lines.push(excerpt);
  }

  lines.push("");
  lines.push(`## Proposal history (cycle ${c.cycle_count} of ${MAX_PROPOSAL_CYCLES})`);
  for (const p of proposals) {
    const pr = (p.proposal ?? {}) as Record<string, unknown>;
    const path = str(pr.proposed_folder_path) || str(pr.target_path);
    const name = str(pr.proposed_filename) || str(pr.target_filename);
    lines.push(
      `- Cycle ${p.cycle}: proposed "${path}" as "${name}" → ${p.decision ?? "awaiting decision"}` +
        (p.rejection_note ? `\n  Human said: "${p.rejection_note}"` : ""),
    );
  }

  if (last) {
    const pr = (last.proposal ?? {}) as Record<string, unknown>;
    const reason = str(pr.reason_for_classification) || str(pr.reasoning_summary);
    if (reason) {
      lines.push("");
      lines.push("## My reasoning for the rejected proposal");
      lines.push(reason);
    }
  }

  lines.push("");
  lines.push(
    "The human rejected the proposal above. Open the conversation: explain briefly why you " +
      "classified it that way, then ask what they would change. Do not produce a revised " +
      "proposal yet.",
  );

  return lines.join("\n");
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "unknown";
  if (typeof v === "string") return v.trim() || "unknown";
  return String(v);
}

/**
 * System prompt for the clarification agent.
 *
 * The behavioural rule that matters: it must NOT jump to a new proposal. A
 * one-shot "revise" is the failure mode this whole pattern exists to avoid, so
 * the prompt makes reaching understanding the job and generating the proposal
 * merely the exit condition.
 *
 * Written for filing because that is the first use, but the structure — explain,
 * ask, offer alternatives, generalise, confirm, then emit a structured result —
 * is the reusable part.
 */
export const CLARIFICATION_AGENT_PROMPT = `You are the Clarification Agent for aleXation One.

A human has rejected a proposal you made. Your job is NOT to guess again. Your job is to find out WHY they disagree and reach a shared understanding before anything is re-proposed.

HOW TO BEHAVE
- Be conversational and concise. One focused point or question per message.
- Start by explaining, briefly, why you proposed what you did.
- Ask what they would change, and why. Ask follow-up questions where the answer is genuinely unclear.
- Offer concrete alternatives and compare them when it helps.
- Distinguish PHYSICAL FILING from SEMANTIC TOPICS. A document can be *about* a product while its *function* belongs to an organisation or a policy family. Physical folders should stay shallow; topic detail belongs in metadata.
- When you think you have understood a general preference (not just this one file), say it plainly and ASK whether that generalisation is correct.
- Never lecture. Never produce a wall of JSON.

SHOULD I REMEMBER THIS?
When a correction looks like it holds beyond this one document, do not quietly adopt it. State it back as a candidate rule and ask explicitly, e.g.:

  "That sounds like a general preference rather than a one-off: <rule in one sentence>.
   Should I remember this as a filing rule for future documents?"

Treat the answer as one of three outcomes:
- YES → the NEW rule may become durable knowledge. Set human_confirmed_new_reusable_rule true.
- JUST THIS CASE → apply it to this document only. Set human_confirmed_new_reusable_rule false and new_reusable_rule null.
- REFINE / anything unclear → keep talking. Do not finish.
Ask this question at most once per candidate rule. If the human already volunteered a general rule and confirmed it, that counts — do not interrogate them again.

DOMAINS
A noun you noticed is not a domain. Reuse domains and document families that already exist in the filing knowledge base — search before assuming one is new.
If a genuinely new domain looks like it recurs and matters, ask before treating it as established: "Should '<domain>' become a recognised domain for future classification?" An unconfirmed domain stays a topic.

REACHING CONSENSUS
Only when the human has clearly agreed on the destination — and you have confirmed any generalisation you intend to remember — do you finish.

To finish, reply with a short confirmation sentence, then a single fenced json block:

\`\`\`json
{
  "consensus": true,
  "agreed_summary": "<one paragraph: what was agreed, where the document goes, under what filename, and why that context wins>",
  "new_reusable_rule": "<a rule newly and explicitly confirmed in this clarification, or null>",
  "human_confirmed_new_reusable_rule": true|false
}
\`\`\`

RULES
- Emit that block ONLY after real agreement. If in doubt, ask one more question.
- \`agreed_summary\` is the only thing carried into the revised proposal, so it must be complete on its own: name the destination path, the filename, and the reasoning.
- \`human_confirmed_new_reusable_rule\` MUST be a JSON boolean literal (true or false). Never put a sentence, a rule, or any other text there — a non-boolean is read as false and the rule is discarded.
- \`new_reusable_rule\` MUST be one self-contained sentence stating a rule first proposed and explicitly confirmed DURING THIS clarification, or null. Do not put a path, heading or markdown formatting in it.
- Never copy, combine, revise or re-confirm a rule from an earlier portion of this conversation. It is already durable knowledge (if confirmed) and is not a NEW proposition.
- Set \`human_confirmed_new_reusable_rule\` true ONLY if the human explicitly agreed to the NEW GENERAL rule you stated in this clarification, not merely to filing this document. That flag promotes a rule to durable knowledge, so a wrong true is expensive.
- If they agreed only about this document, set it false and \`new_reusable_rule\` to null. That is the normal case. In particular, a domain-candidate discussion normally determines whether the candidate remains unconfirmed; it does NOT create a filing rule.
- NEVER output document_id, drive_file_id, drive_url or content_hash. Those are deterministic and are attached by the runtime.
- Prefer reusing organisations and document families that already exist over inventing new ones. Use your knowledge base search to check what is already established before proposing a new one.`;

/**
 * Pull the consensus block out of an assistant message.
 *
 * Returns null while the dialogue is still running, which is the normal case —
 * the absence of a block is how "not yet agreed" is expressed.
 */
export function extractConsensus(message: string): ConsensusSignal | null {
  const fenced = message.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : message.trim().startsWith("{") ? message : null;
  if (!candidate) return null;
  try {
    const parsed = JSON.parse(candidate.trim()) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || parsed.consensus !== true) return null;
    const agreed = typeof parsed.agreed_summary === "string" ? parsed.agreed_summary.trim() : "";
    if (!agreed) return null;
    // A rule is only durable when the agent states the human confirmed it. Any
    // other shape is treated as "no rule", never as a weaker one.
    //
    // Models do sometimes emit the string "true"/"yes" instead of the boolean,
    // so those exact spellings are accepted. Anything else — including a model
    // that helpfully restates the rule in this field — stays false, because the
    // flag is what promotes a rule to durable knowledge and a wrong true is the
    // expensive direction to be wrong in.
    const rawFlag = parsed.human_confirmed_new_reusable_rule;
    const confirmed =
      rawFlag === true ||
      (typeof rawFlag === "string" && ["true", "yes"].includes(rawFlag.trim().toLowerCase()));
    const rule =
      confirmed && typeof parsed.new_reusable_rule === "string" && parsed.new_reusable_rule.trim()
        ? parsed.new_reusable_rule.trim()
        : null;
    return { consensus: true, agreed_summary: agreed, new_reusable_rule: rule };
  } catch {
    return null;
  }
}

/**
 * Turn an agreed outcome into the guidance a fresh run is given.
 *
 * This is what makes cycle N+1 different from cycle N: the same swarm, the same
 * deterministic envelope, plus what the human agreed — in the agent's own
 * prose, not a field list. Passing prose rather than a finished answer keeps the
 * semantic decision inside AgentSwarms, and avoids re-encoding the dialogue into
 * a schema that would quietly become a second knowledge model.
 */
export function buildRevisionGuidance(signal: ConsensusSignal): string {
  const lines = [
    "## Human clarification (authoritative for this document)",
    "",
    signal.agreed_summary,
  ];
  if (signal.new_reusable_rule) {
    lines.push("");
    lines.push(`New general filing rule the human confirmed: ${signal.new_reusable_rule}`);
  }
  lines.push("");
  lines.push(
    "The human agreed the above in conversation. Honour it exactly, keep the physical folder " +
      "structure shallow, and treat product/topic detail as metadata rather than a folder. " +
      "Raise confidence accordingly and note in warnings that this reflects a human clarification.",
  );
  return lines.join("\n");
}
