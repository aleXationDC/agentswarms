// Resuming a swarm run that parked at a human-approval step.
//
// The approvals inbox records the decision; this turns that decision back into
// a running swarm. Kept separate from the inbox component so the same entry
// point works from anywhere a decision can be made.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resumeSwarmRun } from "@/utils/swarmExecute.server";
import { resolveInternalOrigin } from "@/utils/internalOrigin.server";
import { ensureCaseForAcceptance } from "@/axtn/workbenches/cases/caseManagement.server";
import { NativeDocumentApprovalBinding } from "@/axtn/workbenches/documents/documentApproval.server";
import { DOCUMENT_MANAGEMENT_SWARM_ID } from "@/axtn/workbenches/documents/documentRegistrationAck";
import {
  documentRunError,
  documentRunOutput,
} from "@/axtn/workbenches/documents/documentPersistence.server";
import {
  assertNativeApprovalResume,
  createNativeWorkApproval,
} from "@/utils/swarmWorkApproval.server";
import { callerFailure } from "@/utils/callerLookup.server";
import { withNulSafeFetch } from "@/integrations/supabase/nulSafeFetch";

type Fail = { ok: false; error: string };

function acceptanceContext(
  input: string,
): { documentId: string; canonical: Record<string, unknown> } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return null;
  }
  const walk = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const documentId = record.document_id ?? record.documentId;
    if (typeof documentId === "string" && documentId.trim()) {
      return { ...record, document_id: documentId };
    }
    for (const child of Object.values(record)) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  const found = walk(parsed);
  return found?.document_id && typeof found.document_id === "string"
    ? { documentId: found.document_id, canonical: found }
    : null;
}

async function ensureFilingCase(
  userId: string,
  input: string | null,
  output: string | null,
  approvalPayload?: unknown,
): Promise<Fail | null> {
  if (!output?.includes("READY_FOR_FILING")) return null;
  let acceptance: ReturnType<typeof acceptanceContext>;
  if (approvalPayload && typeof approvalPayload === "object" && "axtnDocument" in approvalPayload) {
    const binding = NativeDocumentApprovalBinding.safeParse(approvalPayload.axtnDocument);
    if (!binding.success)
      return { ok: false, error: "Filing acceptance had no valid native Document binding." };
    acceptance = {
      documentId: binding.data.documentId,
      canonical: {
        document_id: binding.data.documentId,
        intake_case_id: binding.data.caseId,
      },
    };
  } else acceptance = acceptanceContext(input ?? "");
  if (!acceptance) return { ok: false, error: "Filing acceptance had no document identity." };
  try {
    await ensureCaseForAcceptance({
      userId,
      documentId: acceptance.documentId,
      canonical: acceptance.canonical,
    });
    return null;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Case acceptance failed: ${error.message}`
          : "Case acceptance failed",
    };
  }
}

/**
 * Continue the run behind an approval, using the decision already recorded on
 * it.
 *
 * The decision is read from the approvals row rather than taken as a parameter:
 * the row is what the approver actually clicked, and accepting an `approved`
 * flag from the caller would let anyone who can reach this function approve
 * anything.
 */
export const resumeApprovedSwarmRun = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ access_token: z.string().min(1), approval_id: z.string().uuid() }).parse(input),
  )
  .handler(
    async ({
      data,
    }): Promise<Fail | { ok: true; status: string; runId: string | null; output: string }> => {
      let documentParent = false;
      try {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) return { ok: false, error: "Server is not configured" };
        const sb = createClient<Database>(
          url,
          key,
          withNulSafeFetch({
            global: { headers: { Authorization: `Bearer ${data.access_token}` } },
          }),
        );
        const {
          data: { user },
          error: authError,
        } = await sb.auth.getUser();
        if (!user) return { ok: false, error: callerFailure(authError, "Not signed in") };

        // Read under the caller's JWT: RLS decides whether this approval is
        // theirs to see, so a stolen id from another tenant resolves to nothing.
        const { data: approval } = await sb
          .from("approvals")
          .select("id, status, swarm_run_id, user_id, action_title, payload, decided_by")
          .eq("id", data.approval_id)
          .maybeSingle();
        if (!approval) return { ok: false, error: "Approval not found" };
        if (!approval.swarm_run_id) {
          return { ok: false, error: "This approval is not attached to a swarm run" };
        }
        if (approval.status !== "approved" && approval.status !== "rejected") {
          return { ok: false, error: "This approval has not been decided yet" };
        }

        // The run belongs to the swarm's OWNER, who may not be the approver —
        // approving someone else's run is the normal case. Resume as the owner
        // so the run keeps its own data access, and never widen it to the
        // approver's.
        const { data: run } = await supabaseAdmin
          .from("swarm_runs")
          .select("id, user_id, swarm_id, status, input_prompt, final_output, swarm_snapshot")
          .eq("id", approval.swarm_run_id)
          .maybeSingle();
        if (!run) return { ok: false, error: "Run not found" };
        documentParent = run.swarm_id === DOCUMENT_MANAGEMENT_SWARM_ID;
        if (run.status === "success" || run.status === "error") {
          if (run.status === "success") {
            const filingError = await ensureFilingCase(
              run.user_id,
              run.input_prompt,
              run.final_output,
              approval.payload,
            );
            if (filingError)
              return documentParent
                ? { ok: false, error: "DOCUMENT_FILING_CASE_PROJECTION_FAILED" }
                : filingError;
          }
          // Not an error worth shouting about: a second click, or a run that
          // was already resumed.
          return { ok: true, status: run.status, runId: run.id, output: "" };
        }
        // FOUND IN R179. A cancelled run is over: a decision that arrives
        // after the cancel is recorded, and must not bring the run back.
        if (run.status === "cancelled") {
          return {
            ok: false,
            error: "This run was cancelled. The decision is recorded; the run does not resume.",
          };
        }
        // FOUND FROM THE SURVEY (R90). This used to require the word
        // "suspended", which is written by a stamp that could fail: a run
        // whose stamp did not land read as "already resumed", the decision
        // was swallowed, and the work stayed parked for ever under a cheerful
        // ok. The CHECKPOINT is what a resume actually needs, so that is what
        // decides — and a run with none really was resumed already.
        const { loadCheckpoint } = await import("@/utils/swarmCheckpoint.server");
        const protectedWork = Boolean(
          approval.payload &&
          typeof approval.payload === "object" &&
          !Array.isArray(approval.payload) &&
          ("axtnDevelopment" in approval.payload || "axtnDocument" in approval.payload),
        );
        const checkpoint = await loadCheckpoint(
          run.id,
          run.user_id,
          documentParent ? "document" : protectedWork,
        );
        if (!checkpoint) {
          if (protectedWork && run.status === "suspended") {
            return { ok: false, error: "Protected native Approval checkpoint unavailable" };
          }
          return { ok: true, status: run.status, runId: run.id, output: "" };
        }
        assertNativeApprovalResume({
          snapshot: run.swarm_snapshot,
          nodeId: checkpoint.suspendedNodeId ?? "",
          payload: approval.payload,
          decidedBy: approval.decided_by,
        });
        if (
          approval.payload &&
          typeof approval.payload === "object" &&
          !Array.isArray(approval.payload) &&
          ("axtnDevelopment" in approval.payload || "axtnDocument" in approval.payload)
        ) {
          const prior = await createNativeWorkApproval({
            userId: run.user_id,
            runId: run.id,
            nodeId: checkpoint.suspendedNodeId ?? "",
            context: checkpoint.ctx,
            content:
              typeof approval.payload.last_output === "string" ? approval.payload.last_output : "",
          });
          if (prior.id !== approval.id)
            throw new Error("NATIVE_APPROVAL_RESUME_OPERATION_MISMATCH");
        }
        if (protectedWork && !documentParent) {
          const { data: claimed, error: claimError } = await supabaseAdmin
            .from("swarm_runs")
            .update({ status: "running" })
            .eq("id", run.id)
            .eq("user_id", run.user_id)
            .eq("status", "suspended")
            .eq("cancel_requested", false)
            .select("id")
            .maybeSingle();
          if (claimError)
            throw new Error(`Native Approval resume claim failed: ${claimError.message}`);
          if (!claimed) {
            const { data: current, error: currentError } = await supabaseAdmin
              .from("swarm_runs")
              .select("status")
              .eq("id", run.id)
              .maybeSingle();
            if (currentError || !current)
              throw new Error("Native Approval continuation state unavailable");
            return { ok: true, status: current.status, runId: run.id, output: "" };
          }
        }

        const result = await resumeSwarmRun({
          runId: run.id,
          userId: run.user_id,
          origin: resolveInternalOrigin(),
          decision: { approved: approval.status === "approved", approvalId: approval.id },
        });
        if (!result) return { ok: false, error: "This run can no longer be resumed" };
        if (result.status !== "suspended") {
          try {
            const { error: outcomeError } = await supabaseAdmin
              .from("swarm_run_idempotency")
              .update({
                status: result.status === "success" ? "completed" : "failed",
                response: {
                  status: result.status,
                  output: documentRunOutput(run.swarm_id ?? "", result.status, result.output),
                  runId: result.runId,
                  error: documentRunError(run.swarm_id ?? "", result.error),
                },
                completed_at: new Date().toISOString(),
              })
              .eq("run_id", run.id)
              .eq("status", "in_progress");
            if (outcomeError)
              throw new Error(
                documentParent
                  ? "DOCUMENT_RUN_OUTCOME_WRITE_FAILED"
                  : `Native resumed outcome persistence failed: ${outcomeError.message}`,
              );
          } catch (error) {
            if (documentParent) throw new Error("DOCUMENT_RUN_OUTCOME_WRITE_FAILED");
            throw error;
          }
        }
        const filingError =
          result.status === "success"
            ? await ensureFilingCase(run.user_id, run.input_prompt, result.output, approval.payload)
            : null;
        if (filingError)
          return documentParent
            ? { ok: false, error: "DOCUMENT_FILING_CASE_PROJECTION_FAILED" }
            : filingError;
        return {
          ok: true,
          status: result.status,
          runId: result.runId,
          output: documentRunOutput(run.swarm_id ?? "", result.status, result.output),
        };
      } catch (e) {
        const error = e instanceof Error ? e.message : "Resume failed";
        return {
          ok: false,
          error: documentParent
            ? (documentRunError(DOCUMENT_MANAGEMENT_SWARM_ID, error) ?? "DOCUMENT_RUN_FAILED")
            : error,
        };
      }
    },
  );

/**
 * End a run parked at an approval step, as its owner (R179).
 *
 * FOUND IN R179. A parked run could end only by a decision on its approval:
 * approving runs the rest of it, and rejecting ends it as an error, recorded
 * as a rejection of content nobody reviewed. A scheduled swarm with an
 * approval node parked a run each time it fired, each waiting for someone,
 * and nothing on Recent runs could simply stop one. Cancelling ends the run (only if it
 * is still parked, so a resume that got there first wins), removes its
 * checkpoint, and closes its pending approvals, so nobody is asked to decide
 * a run that is over.
 */
export const cancelParkedSwarmRun = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ access_token: z.string().min(1), run_id: z.string().uuid() }).parse(input),
  )
  .handler(
    async ({ data }): Promise<Fail | { ok: true; closedApprovals: number; note?: string }> => {
      try {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) return { ok: false, error: "Server is not configured" };
        const sb = createClient<Database>(
          url,
          key,
          withNulSafeFetch({
            global: { headers: { Authorization: `Bearer ${data.access_token}` } },
          }),
        );
        const {
          data: { user },
          error: authError,
        } = await sb.auth.getUser();
        if (!user) return { ok: false, error: callerFailure(authError, "Not signed in") };

        // Read under the caller's JWT: RLS decides whether the run is theirs.
        const { data: run, error: readErr } = await sb
          .from("swarm_runs")
          .select("id, user_id, status, swarm_name")
          .eq("id", data.run_id)
          .maybeSingle();
        if (readErr) return { ok: false, error: `The run could not be read: ${readErr.message}` };
        if (!run) return { ok: false, error: "Run not found" };
        if (run.status !== "suspended") {
          return { ok: false, error: `This run is ${run.status}, not parked at an approval` };
        }

        const now = new Date().toISOString();
        const { data: ended, error: endErr } = await supabaseAdmin
          .from("swarm_runs")
          .update({ status: "cancelled", finished_at: now, cancel_requested: true })
          .eq("id", run.id)
          .eq("status", "suspended")
          .select("id");
        if (endErr)
          return { ok: false, error: `The run could not be cancelled: ${endErr.message}` };
        if (!ended?.length) {
          return {
            ok: false,
            error: "The run moved on before it could be cancelled; refresh to see it",
          };
        }

        const { clearCheckpoint } = await import("@/utils/swarmCheckpoint.server");
        await clearCheckpoint(run.id);
        const { data: closed, error: closeErr } = await supabaseAdmin
          .from("approvals")
          .update({ status: "cancelled", decided_at: now, decided_by: user.id })
          .eq("swarm_run_id", run.id)
          .eq("status", "pending")
          .select("id");
        const { auditEvent } = await import("@/utils/audit.server");
        auditEvent({
          userId: user.id,
          action: "swarm_run.cancel",
          resourceType: "swarm_run",
          resourceId: run.id,
          resourceName: run.swarm_name ?? undefined,
          detail: { parked: true, closed_approvals: closed?.length ?? 0 },
        });
        return {
          ok: true,
          closedApprovals: closed?.length ?? 0,
          ...(closeErr
            ? {
                note: `The run is cancelled, but its approval could not be closed (${closeErr.message}); deciding it will not resume the run.`,
              }
            : {}),
        };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Cancel failed" };
      }
    },
  );
