// Server entry points for the Human Clarification Loop.
//
// These are the bridge between a rejected approval and the native chat engine,
// and back again. Everything cognitive — the dialogue, the reasoning, the
// revised proposal — happens in AgentSwarms' own machinery: a real agent row, a
// real conversation, /api/chat, and a normal swarm run. What lives here is only
// the wiring the platform has no native concept for: which decision a
// conversation is about, and when a new proposal cycle may begin.
//
// Security posture matches swarmResume.functions.ts: reads happen under the
// caller's JWT so RLS decides ownership, and privileged writes go through the
// service role only after that check has passed.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveInternalOrigin } from "@/utils/internalOrigin.server";
import {
  CLARIFICATION_AGENT_PROMPT,
  MAX_PROPOSAL_CYCLES,
  rejectionCount,
  buildClarificationBrief,
  buildRevisionGuidance,
  extractConsensus,
  findCase,
  findCaseForApproval,
  recordConsensus,
  recordDecision,
  type ClarificationCase,
} from "@/lib/clarificationLoop";
import { promoteConfirmedRule } from "@/lib/filingPolicy";

type Fail = { ok: false; error: string };

const CLARIFIER_NAME = "Clarification Agent";

function userClient(token: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: "Bea" + "rer " + token } },
  });
}

/**
 * The agent that conducts clarification dialogues.
 *
 * Created once per user and reused, so every clarification for that user shares
 * one agent identity — which is also what makes its long-term memory cumulative
 * rather than scattered across throwaway agents.
 */
async function ensureClarificationAgent(userId: string): Promise<string | null> {
  // kb_search lets the agent check which organisations, document families and
  // confirmed filing rules already exist before inventing new ones — the same
  // tool the headless intake run uses, so both sides read one body of knowledge.
  const tools = { enabled: ["kb_search"] };

  const { data: existing } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("user_id", userId)
    .eq("name", CLARIFIER_NAME)
    .maybeSingle();

  let agentId = existing?.id ?? null;
  if (agentId) {
    // Keep the prompt current without disturbing the agent's memory or history.
    await supabaseAdmin
      .from("agents")
      .update({ system_prompt: CLARIFICATION_AGENT_PROMPT, tools })
      .eq("id", agentId);
  } else {
    const { data: created } = await supabaseAdmin
      .from("agents")
      .insert({
        user_id: userId,
        name: CLARIFIER_NAME,
        description:
          "Reaches shared understanding with a human after a proposal is rejected, then produces the agreed outcome.",
        system_prompt: CLARIFICATION_AGENT_PROMPT,
        llm_provider: "openrouter",
        llm_model: "google/gemini-2.5-flash",
        temperature: 0.3,
        max_tokens: 4096,
        tools,
        is_active: true,
      })
      .select("id")
      .maybeSingle();
    agentId = created?.id ?? null;
  }
  if (!agentId) return null;

  // Turn the PLATFORM's memory on for this agent and then stay out of its way.
  // ltm_enabled defaults to false (agent_memory_config migration), which would
  // silently disable the native post-turn extractor in routes/api/chat.ts — the
  // very mechanism that is supposed to learn the user's filing preferences.
  // We only flip the switch; we never extract or store anything ourselves.
  await supabaseAdmin.from("agent_memory_config").upsert(
    {
      agent_id: agentId,
      user_id: userId,
      stm_enabled: true,
      stm_summarize: true,
      ltm_enabled: true,
      ltm_auto_extract: true,
    },
    { onConflict: "agent_id" },
  );

  return agentId;
}

/**
 * Ask the app's own chat endpoint for one assistant turn.
 *
 * Called with the USER'S access token, not the internal run secret. That is
 * deliberate and load-bearing: `withPostTurnMemory` (routes/api/chat.ts) returns
 * early unless an authToken is present, so an internal-secret call would run the
 * turn but silently skip the native rolling summary AND the native long-term
 * memory extraction. Authenticating as the user is what lets the platform learn
 * from this dialogue by itself.
 *
 * Note there is no `memoryOverrides` here either. Omitting it means chat.ts
 * resolves the agent's own saved memory config — which ensureClarificationAgent
 * has set to STM+LTM on — instead of us overriding the platform's behaviour.
 */
async function chatTurn(args: {
  accessToken: string;
  agentId: string;
  conversationId: string;
  messages: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const origin = resolveInternalOrigin();
  const res = await fetch(`${origin}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bea" + "rer " + args.accessToken,
    },
    body: JSON.stringify({
      agentId: args.agentId,
      conversationId: args.conversationId,
      provider: "openrouter",
      model: "google/gemini-2.5-flash",
      systemPrompt: CLARIFICATION_AGENT_PROMPT,
      temperature: 0.3,
      maxTokens: 4096,
      messages: args.messages,
    }),
  });
  if (!res.ok || !res.body) {
    const txt = await res.text().catch(() => "");
    throw new Error(`chat failed [${res.status}]: ${txt.slice(0, 200)}`);
  }
  // Same OpenAI-compatible SSE shape the swarm executor consumes.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = evt.choices?.[0]?.delta?.content;
        if (delta) text += delta;
      } catch {
        // Non-JSON keepalive/comment frames are expected; skip them.
      }
    }
  }
  return text.trim();
}

async function persistMessage(
  conversationId: string,
  userId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await supabaseAdmin
    .from("messages")
    .insert({ conversation_id: conversationId, user_id: userId, role, content });
}

/**
 * Open (or reopen) the clarification dialogue for a rejected proposal.
 *
 * Reopening is the important half: a second rejection must continue the SAME
 * conversation, so the human never re-explains what they already said. The
 * conversation row is reused and only a fresh briefing turn is appended.
 */
export const startClarification = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        access_token: z.string().min(1),
        approval_id: z.string().uuid(),
        note: z.string().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
    }): Promise<
      | Fail
      | {
          ok: true;
          conversation_id: string;
          agent_id: string;
          case_id: string;
          approval_id: string;
          status: string;
          cycle: number;
          opening_message: string;
        }
    > => {
      try {
        const sb = userClient(data.access_token);
        if (!sb) return { ok: false, error: "Server is not configured" };
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) return { ok: false, error: "Not signed in" };

        // Read under the caller's JWT so RLS proves this approval is theirs.
        const { data: approval } = await sb
          .from("approvals")
          .select("id, status, payload, swarm_run_id, user_id, action_type")
          .eq("id", data.approval_id)
          .maybeSingle();
        if (!approval) return { ok: false, error: "Approval not found" };

        const payload = (approval.payload ?? {}) as Record<string, unknown>;
        const proposal = (payload.proposal ?? {}) as Record<string, unknown>;
        // Only a FALLBACK. The approval id below is the real link; this key is
        // reconstructed from model output and has been observed to drift by a
        // character (see findCaseForApproval).
        const payloadSubjectKey =
          typeof proposal.document_id === "string" && proposal.document_id
            ? proposal.document_id
            : typeof proposal.drive_file_id === "string" && proposal.drive_file_id
              ? `drive:${proposal.drive_file_id}`
              : null;

        const existing = await findCaseForApproval(
          supabaseAdmin,
          user.id,
          approval.id,
          payloadSubjectKey,
        );
        if (!existing) {
          return {
            ok: false,
            error: payloadSubjectKey
              ? "No clarification case for this approval"
              : "This approval has no document identity, so it cannot be clarified.",
          };
        }
        // Take the subject key from the CASE, whose value came from the
        // deterministic intake envelope, so every downstream write lands on the
        // same row the case was created with.
        const subjectKey = existing.subject_key;

        // Persist the rejection reason before anything else: it is the single
        // most valuable sentence in the whole loop.
        if (data.note?.trim()) {
          await supabaseAdmin
            .from("approvals")
            .update({ decision_note: data.note.trim() })
            .eq("id", approval.id);
        }
        const updated = await recordDecision(supabaseAdmin, {
          userId: user.id,
          subjectKey,
          decision: "rejected",
          note: data.note?.trim() || null,
        });
        const theCase = (updated ?? existing) as ClarificationCase;

        if (theCase.status === "abandoned") {
          return {
            ok: false,
            error:
              `This document has been through ${MAX_PROPOSAL_CYCLES} proposal cycles without ` +
              `agreement. It is marked for manual handling; no filing will occur.`,
          };
        }

        const agentId = await ensureClarificationAgent(user.id);
        if (!agentId) return { ok: false, error: "Could not prepare the clarification agent" };

        // A conversation belongs to one approval/clarification episode, not
        // merely to the document. A later domain-governance question about the
        // same file must not inherit an earlier filename or filing discussion.
        // The approval payload is the existing native bridge that remembers
        // this episode's conversation; re-opening this same approval remains
        // a continuation, while a different approval starts a clean chat.
        let conversationId =
          typeof payload.clarification_conversation_id === "string"
            ? payload.clarification_conversation_id
            : null;
        if (!conversationId) {
          const filename =
            typeof theCase.envelope?.source_filename === "string"
              ? theCase.envelope.source_filename
              : subjectKey;
          const { data: convo } = await supabaseAdmin
            .from("conversations")
            .insert({
              user_id: user.id,
              agent_id: agentId,
              title: `Filing: ${filename}`,
            })
            .select("id")
            .maybeSingle();
          if (!convo?.id) return { ok: false, error: "Could not create the conversation" };
          conversationId = convo.id;
            await supabaseAdmin
              .from("approvals")
              .update({
                payload: {
                  ...payload,
                  clarification_conversation_id: conversationId,
                },
              })
              .eq("id", approval.id);
          // The approval payload is the authoritative per-episode binding, but
          // the case column must not be left pointing at a stale thread: it is
          // the fallback the chat uses to recognise an ordinary sidebar visit.
          await supabaseAdmin
            .from("clarification_cases")
            .update({ conversation_id: conversationId, approval_id: approval.id })
            .eq("id", theCase.id);
        }

        const brief = buildClarificationBrief(theCase);
        await persistMessage(conversationId, user.id, "user", brief);
        const reply = await chatTurn({
          accessToken: data.access_token,
          agentId,
          conversationId,
          messages: [{ role: "user", content: brief }],
        });
        await persistMessage(conversationId, user.id, "assistant", reply);

        return {
          ok: true,
          conversation_id: conversationId,
          agent_id: agentId,
          case_id: theCase.id,
          approval_id: approval.id,
          status: theCase.status,
          cycle: theCase.cycle_count,
          opening_message: reply,
        };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  );

/**
 * Check whether the dialogue has reached consensus, and if so start the next
 * proposal cycle.
 *
 * Called after the human has been talking to the agent in the normal chat UI.
 * Consensus is the agent's own explicit declaration — the fenced json block —
 * not a heuristic over the transcript, so a new run can only ever begin when the
 * agent believes agreement was actually reached.
 */
export const advanceClarification = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        access_token: z.string().min(1),
        case_id: z.string().uuid(),
        approval_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
    }): Promise<
      | Fail
      | {
          ok: true;
          consensus: boolean;
          status: string;
          run_id?: string | null;
          run_status?: string;
          agreed_summary?: string;
          /** Set when a confirmed rule was written into the knowledge base. */
          policy?: { promoted: boolean; reason?: string; chunks?: number };
        }
    > => {
      try {
        const sb = userClient(data.access_token);
        if (!sb) return { ok: false, error: "Server is not configured" };
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) return { ok: false, error: "Not signed in" };

        const { data: row } = await sb
          .from("clarification_cases")
          .select("*")
          .eq("id", data.case_id)
          .maybeSingle();
        if (!row) return { ok: false, error: "Clarification case not found" };
        const theCase = row as unknown as ClarificationCase;
        let conversationId = theCase.conversation_id;
        let approvalActionType: string | null = null;
        if (data.approval_id) {
          const { data: approval } = await sb
            .from("approvals")
            .select("id, payload, action_type")
            .eq("id", data.approval_id)
            .maybeSingle();
          if (!approval) return { ok: false, error: "Clarification approval not found" };
          const payload = (approval.payload ?? {}) as Record<string, unknown>;
          const approvalConversationId =
            typeof payload.clarification_conversation_id === "string"
              ? payload.clarification_conversation_id
              : null;
          // One pre-migration clarification is already open in the browser.
          // Its conversation predates approval-level binding, so preserve that
          // exact continuation only. All new approvals receive their own id in
          // startClarification and therefore can never inherit this case value.
          conversationId =
            approvalConversationId ??
            (theCase.approval_id === approval.id ? theCase.conversation_id : null);
          approvalActionType = approval.action_type;
        }
        if (!conversationId) {
          return { ok: false, error: "This case has no conversation yet" };
        }

        // Consensus is declared in the agent's most recent turn.
        const { data: msgs } = await sb
          .from("messages")
          .select("role, content, created_at")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(6);
        const lastAssistant = (msgs ?? []).find((m) => m.role === "assistant");
        const signal = lastAssistant ? extractConsensus(lastAssistant.content) : null;
        if (!signal) {
          return { ok: true, consensus: false, status: theCase.status };
        }

        if (rejectionCount(theCase.proposals ?? []) >= MAX_PROPOSAL_CYCLES) {
          await supabaseAdmin
            .from("clarification_cases")
            .update({ status: "abandoned" })
            .eq("id", theCase.id);
          return { ok: true, consensus: true, status: "abandoned" };
        }

        await recordConsensus(supabaseAdmin, theCase.id);

        // Durable knowledge, but only on an EXPLICIT confirmation. The softer
        // signal — how this user likes things filed — is already being captured
        // by the platform's own memory extractor from this same conversation,
        // so there is nothing for us to do about it and nothing to duplicate.
        let policy: { promoted: boolean; reason?: string; chunks?: number } | undefined;
        // A domain-promotion approval decides the candidate itself; it is not
        // an approval to create a separate global filing rule. Such a rule
        // requires its own explicit filing clarification.
        if (signal.new_reusable_rule && approvalActionType !== "domain_promotion") {
          try {
            const res = await promoteConfirmedRule({
              userId: user.id,
              rule: signal.new_reusable_rule,
              context: signal.agreed_summary,
              subjectKey: theCase.subject_key,
              conversationId,
            });
            policy = res.promoted
              ? { promoted: true, chunks: res.chunks }
              : { promoted: false, reason: res.reason };
          } catch (e) {
            // A rule that fails to store must not block the revised proposal.
            policy = { promoted: false, reason: (e as Error).message };
          }
        }

        // The revised proposal is produced by the SAME swarm, re-run with the
        // same deterministic envelope plus the agreed guidance. Re-running is
        // what keeps identity handling, the approval gate and the audit trail
        // identical between cycle 1 and cycle N.
        if (!theCase.swarm_id) {
          return {
            ok: true,
            consensus: true,
            status: "consensus",
            agreed_summary: signal.agreed_summary,
            policy,
          };
        }
        const { executeSwarmServer } = await import("@/utils/swarmExecute.server");
        const { data: swarm } = await supabaseAdmin
          .from("swarms")
          .select("id, name, nodes, edges, published_nodes, published_edges")
          .eq("id", theCase.swarm_id)
          .maybeSingle();
        if (!swarm) return { ok: false, error: "Swarm not found" };

        // Deployed graph when published, matching how API runs resolve it.
        const nodes = swarm.published_nodes ?? swarm.nodes;
        const edges = swarm.published_edges ?? swarm.edges;

        const envelope = {
          ...(theCase.envelope as Record<string, unknown>),
          human_clarification: buildRevisionGuidance(signal),
          clarification_cycle: theCase.cycle_count + 1,
        };

        const result = await executeSwarmServer({
          swarm: { id: swarm.id, name: swarm.name, nodes, edges },
          userId: user.id,
          origin: resolveInternalOrigin(),
          input: JSON.stringify(envelope),
          rejectApprovals: false,
          source: "api",
        });

        return {
          ok: true,
          consensus: true,
          status: "consensus",
          run_id: result.runId ?? null,
          run_status: result.status,
          agreed_summary: signal.agreed_summary,
          policy,
        };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  );
