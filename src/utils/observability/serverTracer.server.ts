// Server-side swarm tracer — the headless counterpart to the browser tracer in
// observability/tracer.ts. Writes the same swarm_runs / swarm_run_steps /
// swarm_run_edges rows so deployed-API and scheduled runs get the same per-node
// observability timeline as canvas runs. Uses the service-role client and an
// explicit owner id (no browser session), and stamps user_id on every row so
// RLS scopes the run to its owner on read.
//
// Generic tracing is best-effort. Native DMS Parent registration requires its
// owned run and minimized ingress so ACK recovery cannot silently lose binding.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { bodyJson, bodyText } from "@/utils/observability/redaction.server";
import { DOCUMENT_MANAGEMENT_SWARM_ID } from "@/axtn/workbenches/documents/documentRegistrationAck";
import { documentStoredIngress } from "@/axtn/workbenches/documents/documentPersistence.server";

type FinishStepArgs = {
  status: "success" | "error" | "skipped";
  output?: string | null;
  errorMessage?: string | null;
  llmModel?: string | null;
  llmProvider?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  latencyMs?: number;
  /**
   * The node's tool events — its agent's calls and results, or a tool
   * node's own — in the shape the canvas tracer writes, so one Traces
   * page reads both. Stored as the canvas stores them.
   */
  toolCalls?: unknown[];
};

export type ServerSwarmTracer = {
  runId: string;
  startStep(args: {
    nodeId: string;
    nodeLabel?: string;
    nodeKind?: string;
    agentId?: string | null;
    input?: unknown;
  }): Promise<void>;
  finishStep(nodeId: string, args: FinishStepArgs): Promise<void>;
  recordEdge(args: {
    sourceNodeId: string;
    targetNodeId: string;
    payloadPreview?: string;
    bytes?: number;
  }): Promise<void>;
  finish(args: {
    status: "success" | "error" | "cancelled";
    finalOutput?: string | null;
    errorMessage?: string | null;
  }): Promise<void>;
};

export async function createServerSwarmTracer(opts: {
  userId: string;
  swarmId?: string | null;
  swarmName?: string;
  inputPrompt?: string;
  swarmSnapshot?: unknown;
  /**
   * Continue THIS run rather than opening a new one.
   *
   * FOUND FROM THE SURVEY (R92). executeSwarmServer's `resume` option says in
   * its own comment that "the caller supplies the existing run id (so the
   * timeline continues rather than forking)" - and the id stopped there. Every
   * resume inserted a second row, so the parked run was never closed: the
   * gallery showed it Running with a live duration and a Cancel button for
   * ever, its trace ending at the approval, while the work the approver
   * released was recorded under a different id. Its checkpoint was never
   * cleared either, because the new run cleared its own.
   */
  resumeRunId?: string | null;
  /** Unique native run ID claims an idempotent authenticated Case start. */
  startRunId?: string;
  required?: boolean;
}): Promise<ServerSwarmTracer | null> {
  const documentParent = opts.swarmId === DOCUMENT_MANAGEMENT_SWARM_ID;
  const documentInput = documentParent
    ? documentStoredIngress(opts.userId, opts.inputPrompt ?? "")
    : null;
  try {
    const stepIdByNode = new Map<string, string>();
    // Node ids whose step rows come from the earlier attempt and are already
    // closed: their row is left exactly as it was written and their numbers
    // are already in `totals`, so a second visit records nothing twice.
    const carried = new Set<string>();
    const edgesSeen = new Set<string>();
    const totals = { lat: 0, tin: 0, tout: 0, cost: 0, count: 0, errors: 0 };

    let resolved: string | null = null;
    if (opts.resumeRunId) {
      let reopen = supabaseAdmin
        .from("swarm_runs")
        .update({
          status: "running",
          finished_at: null,
          ...(documentParent ? { input_prompt: documentInput } : {}),
        } as never)
        .eq("id", opts.resumeRunId)
        .eq("user_id", opts.userId);
      if (documentParent) reopen = reopen.eq("swarm_id", DOCUMENT_MANAGEMENT_SWARM_ID);
      const { data: reopened, error: reopenErr } = await reopen.select("id").maybeSingle();
      if (reopened?.id) {
        resolved = (reopened as { id: string }).id;
        const { data: prior, error: priorErr } = await supabaseAdmin
          .from("swarm_run_steps")
          .select("id, node_id, status, latency_ms, tokens_in, tokens_out, cost_usd")
          .eq("run_id", resolved);
        if (priorErr) {
          if (opts.required) throw new Error("CASE_EXECUTION_EVIDENCE_WRITE_FAILED");
          if (documentParent) throw new Error("DOCUMENT_NATIVE_TRACE_PRIOR_STEPS_REQUIRED");
          console.warn(
            `[swarm-trace] run ${resolved} resumed, but the steps it already has could not be read: ${priorErr.message}; its totals restart from this half and a step it re-enters may be recorded twice`,
          );
        }
        for (const s of prior ?? []) {
          stepIdByNode.set(s.node_id, s.id);
          // The step the run parked ON is still open. It is re-entered with
          // the decision in hand and closed then, so it is not carried: its
          // numbers are counted when it finishes, once.
          if (s.status === "running" || s.status === "awaiting_approval") continue;
          carried.add(s.node_id);
          totals.lat += Number(s.latency_ms ?? 0);
          totals.tin += Number(s.tokens_in ?? 0);
          totals.tout += Number(s.tokens_out ?? 0);
          totals.cost += Number(s.cost_usd ?? 0);
          totals.count += 1;
          if (s.status === "error") totals.errors += 1;
        }
        const { data: priorEdges, error: priorEdgesErr } = await supabaseAdmin
          .from("swarm_run_edges")
          .select("source_node_id, target_node_id")
          .eq("run_id", resolved);
        if (opts.required && priorEdgesErr) throw new Error("CASE_EXECUTION_EVIDENCE_WRITE_FAILED");
        if (documentParent && priorEdgesErr)
          throw new Error("DOCUMENT_NATIVE_TRACE_PRIOR_EDGES_REQUIRED");
        for (const e of priorEdges ?? []) {
          edgesSeen.add(`${e.source_node_id}->${e.target_node_id}`);
        }
      } else {
        if (opts.required) throw new Error("CASE_EXECUTION_PERSISTED_RUN_REQUIRED");
        if (documentParent) throw new Error("DOCUMENT_NATIVE_TRACE_RESUME_REQUIRED");
        console.warn(
          `[swarm-trace] run ${opts.resumeRunId} could not be reopened${reopenErr ? `: ${reopenErr.message}` : ""}; this resume is recorded as a new run and the parked one stays open`,
        );
      }
    }

    if (!resolved) {
      const { data: runRow, error } = await supabaseAdmin
        .from("swarm_runs")
        .insert({
          ...(opts.startRunId ? { id: opts.startRunId } : {}),
          user_id: opts.userId,
          swarm_id: opts.swarmId ?? null,
          swarm_name: opts.swarmName ?? null,
          input_prompt: documentParent ? documentInput : bodyText(opts.inputPrompt ?? null),
          swarm_snapshot: (opts.swarmSnapshot ?? {}) as never,
          status: "running",
        } as never)
        .select("id")
        .single();
      if (error || !runRow?.id) {
        if (opts.required && !opts.startRunId)
          throw new Error("CASE_EXECUTION_PERSISTED_RUN_REQUIRED");
        if (opts.startRunId) {
          if (error?.code === "23505") throw new Error("CASE_EXECUTION_START_ALREADY_CLAIMED");
          throw new Error("CASE_EXECUTION_PERSISTED_RUN_REQUIRED");
        }
        if (documentParent) throw new Error("DOCUMENT_NATIVE_TRACE_REQUIRED");
        return null;
      }
      resolved = (runRow as { id: string }).id;
    }
    const runId: string = resolved;

    return {
      runId,
      async startStep(args) {
        // A resume keeps the run's id, so a node that already has a row keeps
        // it too (R92): the step the run parked on is still open and is closed
        // below, and one that already finished is left as it was recorded.
        if (stepIdByNode.has(args.nodeId)) return;
        try {
          const { data, error: stepErr } = await supabaseAdmin
            .from("swarm_run_steps")
            .insert({
              run_id: runId,
              user_id: opts.userId,
              node_id: args.nodeId,
              node_label: args.nodeLabel ?? null,
              node_kind: args.nodeKind ?? "agent",
              agent_id: args.agentId ?? null,
              input: (documentParent
                ? { schemaVersion: "document-trace-redaction-v1", redacted: true }
                : bodyJson(args.input ?? {})) as never,
              status: "running",
            } as never)
            .select("id")
            .single();
          if (data?.id) stepIdByNode.set(args.nodeId, (data as { id: string }).id);
          else if (opts.required) throw new Error("CASE_EXECUTION_EVIDENCE_WRITE_FAILED");
          else if (documentParent) throw new Error("DOCUMENT_NATIVE_TRACE_STEP_REQUIRED");
          else if (stepErr) {
            // FOUND FROM THE SURVEY (R86). A supabase call answers with its
            // error rather than throwing, so this catch never saw one: a step
            // that could not be recorded left no row and no id, and every
            // later write about it — its outcome, its edges — was dropped on
            // the floor by the `if (!stepId) return` below.
            console.warn(
              `[swarm-trace] run ${runId}: step "${args.nodeLabel ?? args.nodeId}" could not be recorded: ${stepErr.message}; its outcome and edges will be missing from the trace`,
            );
          }
        } catch {
          if (opts.required) throw new Error("CASE_EXECUTION_EVIDENCE_WRITE_FAILED");
          if (documentParent) throw new Error("DOCUMENT_NATIVE_TRACE_STEP_PERSISTENCE_FAILED");
          /* best-effort */
        }
      },
      async finishStep(nodeId, args) {
        // Carried from the earlier attempt: already written, already counted.
        if (carried.has(nodeId)) return;
        totals.lat += args.latencyMs ?? 0;
        totals.tin += args.tokensIn ?? 0;
        totals.tout += args.tokensOut ?? 0;
        totals.cost += args.costUsd ?? 0;
        totals.count += 1;
        if (args.status === "error") totals.errors += 1;
        const stepId = stepIdByNode.get(nodeId);
        if (!stepId) {
          if (opts.required) throw new Error("CASE_EXECUTION_EVIDENCE_WRITE_FAILED");
          if (documentParent) throw new Error("DOCUMENT_NATIVE_TRACE_STEP_ID_REQUIRED");
          return;
        }
        try {
          const { error: finishErr } = await supabaseAdmin
            .from("swarm_run_steps")
            .update({
              status: args.status,
              output: documentParent ? null : bodyText(args.output ?? null),
              error_message: documentParent
                ? args.errorMessage
                  ? "DOCUMENT_NATIVE_NODE_FAILED"
                  : null
                : (args.errorMessage ?? null),
              llm_model: args.llmModel ?? null,
              llm_provider: args.llmProvider ?? null,
              tokens_in: args.tokensIn ?? 0,
              tokens_out: args.tokensOut ?? 0,
              cost_usd: args.costUsd ?? 0,
              latency_ms: args.latencyMs ?? 0,
              tool_calls: documentParent ? [] : (args.toolCalls ?? []),
              finished_at: new Date().toISOString(),
            } as never)
            .eq("id", stepId);
          if (finishErr) {
            if (opts.required) throw new Error("CASE_EXECUTION_EVIDENCE_WRITE_FAILED");
            if (documentParent) throw new Error("DOCUMENT_NATIVE_TRACE_STEP_FINISH_REQUIRED");
            // The step is over; its row still says running, and the run's
            // timeline will show it so for ever (R86).
            console.warn(
              `[swarm-trace] run ${runId}: step ${stepId} finished ${args.status} but its record could not be written: ${finishErr.message}; the timeline will show it running`,
            );
          }
        } catch {
          if (opts.required) throw new Error("CASE_EXECUTION_EVIDENCE_WRITE_FAILED");
          if (documentParent) throw new Error("DOCUMENT_NATIVE_TRACE_STEP_PERSISTENCE_FAILED");
          /* best-effort */
        }
      },
      async recordEdge(args) {
        // The node a resume re-enters is fed by the same edges it was fed by
        // before (R92); drawing them again would double every arrow into it.
        const edgeKey = `${args.sourceNodeId}->${args.targetNodeId}`;
        if (edgesSeen.has(edgeKey)) return;
        edgesSeen.add(edgeKey);
        try {
          const { error: edgeErr } = await supabaseAdmin.from("swarm_run_edges").insert({
            run_id: runId,
            user_id: opts.userId,
            source_step_id: stepIdByNode.get(args.sourceNodeId) ?? null,
            target_step_id: stepIdByNode.get(args.targetNodeId) ?? null,
            source_node_id: args.sourceNodeId,
            target_node_id: args.targetNodeId,
            payload_preview: documentParent ? null : (args.payloadPreview ?? null),
            bytes: args.bytes ?? 0,
          } as never);
          if (edgeErr) {
            if (opts.required) throw new Error("CASE_EXECUTION_EVIDENCE_WRITE_FAILED");
            if (documentParent) throw new Error("DOCUMENT_NATIVE_TRACE_EDGE_REQUIRED");
            console.warn(
              `[swarm-trace] run ${runId}: the edge ${args.sourceNodeId} → ${args.targetNodeId} could not be recorded: ${edgeErr.message}; the graph will show the steps without it`,
            );
          }
        } catch {
          if (opts.required) throw new Error("CASE_EXECUTION_EVIDENCE_WRITE_FAILED");
          if (documentParent) throw new Error("DOCUMENT_NATIVE_TRACE_EDGE_PERSISTENCE_FAILED");
          /* best-effort */
        }
      },
      async finish(args) {
        try {
          // FOUND FROM THE SURVEY (R86). The run's own close, in a catch a
          // supabase answer never reaches: a swarm that had finished stayed
          // "running" on the Observability page for ever, with no final
          // output, no totals and no cost. Retried once, then said with what
          // it left.
          //
          // FOUND IN R309 (sweep 10). The close wrote its status over
          // whatever was stored, so a run cancelled from Recent runs was
          // recorded "success" when it ran on to the end. It closes only a
          // run still running; one cancelled meanwhile keeps its status and
          // still gets the numbers it spent.
          const numbers = {
            total_latency_ms: totals.lat,
            total_tokens_in: totals.tin,
            total_tokens_out: totals.tout,
            total_cost_usd: totals.cost,
            step_count: totals.count,
            error_count: totals.errors,
          };
          const close = () =>
            supabaseAdmin
              .from("swarm_runs")
              .update({
                status: args.status,
                final_output: documentParent ? null : bodyText(args.finalOutput ?? null),
                error_message: documentParent
                  ? args.errorMessage
                    ? "DOCUMENT_NATIVE_RUN_FAILED"
                    : null
                  : (args.errorMessage ?? null),
                finished_at: new Date().toISOString(),
                ...numbers,
              } as never)
              .eq("id", runId)
              .eq("status", "running")
              .select("id");
          let { data: closed, error: closeErr } = await close();
          if (closeErr) {
            await new Promise((r) => setTimeout(r, 1_000));
            ({ data: closed, error: closeErr } = await close());
          }
          if (!closeErr && !closed?.length) {
            await supabaseAdmin
              .from("swarm_runs")
              .update(numbers as never)
              .eq("id", runId);
          }
          if (closeErr) {
            if (opts.required) throw new Error("CASE_EXECUTION_EVIDENCE_WRITE_FAILED");
            if (documentParent) throw new Error("DOCUMENT_NATIVE_TRACE_CLOSE_REQUIRED");
            console.warn(
              `[swarm-trace] run ${runId} finished ${args.status} but its record could not be closed after two attempts: ${closeErr.message}. It will show as running until it is closed.`,
            );
          }
        } catch {
          if (opts.required) throw new Error("CASE_EXECUTION_EVIDENCE_WRITE_FAILED");
          if (documentParent) throw new Error("DOCUMENT_NATIVE_TRACE_CLOSE_PERSISTENCE_FAILED");
          /* best-effort */
        }
      },
    };
  } catch (error) {
    if (opts.startRunId) throw error;
    if (opts.required) throw new Error("CASE_EXECUTION_EVIDENCE_WRITE_FAILED");
    if (documentParent) throw new Error("DOCUMENT_NATIVE_TRACE_PERSISTENCE_FAILED");
    return null;
  }
}
