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

type Fail = { ok: false; error: string };

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
      try {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) return { ok: false, error: "Server is not configured" };
        const sb = createClient<Database>(url, key, {
          global: { headers: { Authorization: `Bearer ${data.access_token}` } },
        });
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) return { ok: false, error: "Not signed in" };

        // Read under the caller's JWT: RLS decides whether this approval is
        // theirs to see, so a stolen id from another tenant resolves to nothing.
        const { data: approval } = await sb
          .from("approvals")
          .select("id, status, swarm_run_id, user_id, action_title")
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
          .select("id, user_id, status")
          .eq("id", approval.swarm_run_id)
          .maybeSingle();
        if (!run) return { ok: false, error: "Run not found" };
        if (run.status !== "suspended") {
          // Not an error worth shouting about: a second click, or a run that
          // was already resumed.
          return { ok: true, status: run.status, runId: run.id, output: "" };
        }

        // An approval decided here is the only signal the registry gets for the
        // approve path (rejection travels through the clarification loop), so
        // reflect it before resuming. Best-effort, for the same reason as
        // everywhere else: bookkeeping must not be able to block a run.
        try {
          const { setReviewStatus } = await import("@/lib/documentRegistry");
          const { data: full } = await supabaseAdmin
            .from("approvals")
            .select("payload")
            .eq("id", approval.id)
            .maybeSingle();
          const payloadObj = (full?.payload ?? {}) as Record<string, unknown>;
          const proposal = (payloadObj.proposal ?? {}) as Record<string, unknown>;
          const documentId =
            typeof proposal?.document_id === "string" ? proposal.document_id : null;
          const mailId =
            typeof proposal?.mail_id === "string"
              ? proposal.mail_id
              : typeof payloadObj?.mail_id === "string"
                ? (payloadObj.mail_id as string)
                : null;

          if (documentId) {
            await setReviewStatus(supabaseAdmin as never, run.user_id, documentId, {
              review: approval.status === "approved" ? "approved" : "rejected",
              approvedPath:
                approval.status === "approved" && typeof proposal?.proposed_folder_path === "string"
                  ? proposal.proposed_folder_path
                  : null,
            });
          }

          if (mailId) {
            const { upsertMailRegistryRow } = await import("@/lib/mailRegistry");
            await upsertMailRegistryRow(supabaseAdmin as never, run.user_id, {
              mail_id: mailId,
              human_review_status: approval.status === "approved" ? "approved" : "rejected",
              classification_status: approval.status === "approved" ? "approved" : "rejected",
              approved_path:
                approval.status === "approved" && typeof proposal?.proposed_folder_path === "string"
                  ? proposal.proposed_folder_path
                  : null,
            });
          }

          // Archive Knowledge (DMS-D1-0002 §10 / DMS-D1-0003 §16 / execution contract):
          // index the pseudonymised text ONLY once keep/approval semantics permit it —
          // i.e. only on an actual approve, never on reject and never earlier at intake time.
          if (approval.status === "approved" && documentId) {
            try {
              const { data: runRow } = await supabaseAdmin
                .from("swarm_runs")
                .select("input_prompt")
                .eq("id", run.id)
                .maybeSingle();
              const envelope = runRow?.input_prompt
                ? (JSON.parse(runRow.input_prompt) as Record<string, unknown>)
                : null;
              const pseudonymizedText =
                envelope && typeof envelope.text === "string" ? envelope.text : "";
              const driveFileId =
                envelope && typeof envelope.drive_file_id === "string"
                  ? envelope.drive_file_id
                  : "";
              const contentHash =
                envelope && typeof envelope.content_hash === "string" ? envelope.content_hash : "";
              const sourceFilename =
                envelope && typeof envelope.filename === "string" ? envelope.filename : documentId;
              if (pseudonymizedText.trim() && contentHash) {
                const { indexArchiveDocument } = await import("@/lib/archiveKnowledge.server");
                await indexArchiveDocument(supabaseAdmin as never, run.user_id, {
                  documentId,
                  driveFileId,
                  contentHash,
                  sourceFilename,
                  pseudonymizedText,
                  provenance: { approvalId: approval.id, swarmRunId: run.id },
                });
              }
            } catch (e) {
              console.warn("[resume] Archive Knowledge indexing failed:", (e as Error).message);
            }
          }

          if (approval.status === "approved" && mailId) {
            try {
              const { data: runRow } = await supabaseAdmin
                .from("swarm_runs")
                .select("input_prompt")
                .eq("id", run.id)
                .maybeSingle();
              const envelope = runRow?.input_prompt
                ? (JSON.parse(runRow.input_prompt) as Record<string, unknown>)
                : null;
              const pseudonymizedText =
                envelope && typeof envelope.body_text === "string"
                  ? envelope.body_text
                  : envelope && typeof envelope.text === "string"
                    ? envelope.text
                    : "";
              const driveFileId =
                envelope && typeof envelope.drive_eml_file_id === "string"
                  ? envelope.drive_eml_file_id
                  : "";
              const contentHash =
                envelope && typeof envelope.raw_sha256 === "string"
                  ? envelope.raw_sha256
                  : "";
              const sourceFilename =
                envelope && typeof envelope.canonical_eml_filename === "string"
                  ? envelope.canonical_eml_filename
                  : mailId;

              if (pseudonymizedText.trim() && contentHash) {
                const { indexArchiveDocument } = await import("@/lib/archiveKnowledge.server");
                await indexArchiveDocument(supabaseAdmin as never, run.user_id, {
                  documentId: mailId,
                  driveFileId,
                  contentHash,
                  sourceFilename,
                  pseudonymizedText,
                  provenance: { approvalId: approval.id, swarmRunId: run.id },
                });
              }
            } catch (e) {
              console.warn("[resume] Mail Archive Knowledge indexing failed:", (e as Error).message);
            }
          }
        } catch (e) {
          console.warn("[resume] registry review status not updated:", (e as Error).message);
        }

        const result = await resumeSwarmRun({
          runId: run.id,
          userId: run.user_id,
          origin: resolveInternalOrigin(),
          decision: {
            approved: approval.status === "approved",
            approvalId: approval.id,
          },
        });
        if (!result) return { ok: false, error: "This run can no longer be resumed" };
        return { ok: true, status: result.status, runId: result.runId, output: result.output };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "Resume failed" };
      }
    },
  );
