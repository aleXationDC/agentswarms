import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { WorkPrincipal } from "../cases/work.server";
import { DocumentWorkRequest } from "./documentWorkContract";

function canonical(value: Json): Json {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, value[key] === undefined ? null : canonical(value[key])]),
    );
  return value;
}

export function documentInputHash(manifest: Json): string {
  return createHash("sha256")
    .update(JSON.stringify(canonical(manifest)))
    .digest("hex");
}

export async function executeDocumentWork(
  userId: string,
  input: DocumentWorkRequest,
  principal: WorkPrincipal,
) {
  const request = DocumentWorkRequest.parse(input);
  const human = principal.kind === "user_session";
  if (human && principal.id !== userId) throw new Error("Document principal owner mismatch");
  const payload =
    request.operation === "document_ensure"
      ? request.work
      : request.operation === "document_transition"
        ? request.transition
        : request.operation === "document_assign"
          ? request.assignment
          : request.operation === "document_propose"
            ? request.proposal
            : request.operation === "document_feedback"
              ? request.feedback
              : request.operation === "document_candidate"
                ? {
                    ...request.candidate,
                    feedback: [...request.candidate.feedback].sort((a, b) =>
                      a.eventId.localeCompare(b.eventId),
                    ),
                    risks: [...request.candidate.risks].sort(),
                    evidence: [
                      ...new Map(
                        request.candidate.evidence.map((reference) => [
                          JSON.stringify(canonical(reference)),
                          reference,
                        ]),
                      ).entries(),
                    ]
                      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                      .map(([, reference]) => reference),
                    changeManifest: {
                      ...request.candidate.changeManifest,
                      conditionChanges: [...request.candidate.changeManifest.conditionChanges].sort(
                        (a, b) => a.index - b.index,
                      ),
                    },
                  }
                : request.operation === "document_evaluation"
                  ? { ...request.submission, caseId: request.submission.evaluation.caseId }
                  : { caseId: request.caseId };
  if (
    !human &&
    (request.operation === "document_assign" ||
      (request.operation === "document_feedback" && request.feedback.eventType !== "UNVERIFIED") ||
      ("processingMode" in payload && payload.processingMode === "HUMAN") ||
      ("executionChannel" in payload && payload.executionChannel === "HUMAN") ||
      (request.operation === "document_transition" &&
        ["TAKEOVER", "RELEASE", "DETAILS"].includes(request.transition.eventType)))
  )
    throw new Error("Document Human responsibility requires an authenticated user session");
  const bound = {
    ...payload,
    ...(request.operation === "document_ensure"
      ? { inputHash: documentInputHash(request.work.inputManifest) }
      : request.operation === "document_propose"
        ? { decisionRevision: documentInputHash(request.proposal) }
        : request.operation === "document_feedback"
          ? { feedbackRevision: documentInputHash(request.feedback) }
          : request.operation === "document_candidate"
            ? { candidateRevision: documentInputHash(payload) }
            : request.operation === "document_evaluation"
              ? { evaluationRevision: documentInputHash(request.submission) }
              : {}),
    actorRef: principal.id,
    _principal: principal,
  };
  const { data, error } = await supabaseAdmin.rpc("axtn_case_document", {
    p_user_id: userId,
    p_operation: request.operation,
    p_payload: bound as Json,
  });
  if (error) throw new Error(error.message);
  return data;
}
