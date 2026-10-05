import { z } from "zod";
import { WorkReference } from "../cases/workContract";

const revision = z.string().regex(/^[a-f0-9]{64}(?![\s\S])/);
const assignment = z
  .object({
    family: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}(?![\s\S])/)
      .nullable(),
    targetId: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}(?![\s\S])/)
      .nullable(),
  })
  .strict();

export const DocumentFeedbackEvent = z
  .object({
    schemaVersion: z.literal("document-feedback-v1"),
    eventId: z.string().uuid(),
    caseId: z.string().uuid(),
    decisionId: z.string().uuid(),
    decisionRevision: revision,
    attemptId: z.string().uuid(),
    inputHash: revision,
    sourceRevision: z
      .string()
      .min(1)
      .max(500)
      .refine(
        (value) =>
          !!value.trim() &&
          !Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
      ),
    eventType: z.enum([
      "CORRECTION",
      "EXCEPTION",
      "TAXONOMY_CHANGE",
      "VERIFIED_CORRECT",
      "UNVERIFIED",
    ]),
    before: assignment,
    after: assignment,
    reasonCode: z.enum([
      "HUMAN_CONFIRMED",
      "WRONG_FAMILY",
      "WRONG_TARGET",
      "TAXONOMY_CHANGED",
      "SOURCE_EXCEPTION",
      "UNVERIFIED_OBSERVATION",
    ]),
    supersedesEventId: z.string().uuid().nullable(),
    evidence: z.array(WorkReference).min(1).max(50),
  })
  .strict()
  .superRefine((event, ctx) => {
    if (!event.evidence.some((reference) => reference.kind === "evidence"))
      ctx.addIssue({ code: "custom", message: "Minimized evidence reference required" });
    if (event.supersedesEventId === event.eventId)
      ctx.addIssue({ code: "custom", message: "Feedback cannot supersede itself" });
    if (event.eventType === "UNVERIFIED" && event.supersedesEventId)
      ctx.addIssue({
        code: "custom",
        message: "Unverified observation cannot supersede confirmation",
      });
    if (["CORRECTION", "TAXONOMY_CHANGE"].includes(event.eventType) && !event.supersedesEventId)
      ctx.addIssue({ code: "custom", message: "Correction requires an immutable predecessor" });
    const unchanged =
      event.before.family === event.after.family && event.before.targetId === event.after.targetId;
    if (["VERIFIED_CORRECT", "UNVERIFIED"].includes(event.eventType) && !unchanged)
      ctx.addIssue({
        code: "custom",
        message: "Confirmation/observation cannot silently correct assignment",
      });
    if (["CORRECTION", "TAXONOMY_CHANGE"].includes(event.eventType) && unchanged)
      ctx.addIssue({ code: "custom", message: "Correction must change the confirmed assignment" });
    if ((event.eventType === "UNVERIFIED") !== (event.reasonCode === "UNVERIFIED_OBSERVATION"))
      ctx.addIssue({
        code: "custom",
        message: "Unverified observation has no confirmation authority",
      });
  });

export type DocumentFeedbackEvent = z.infer<typeof DocumentFeedbackEvent>;

export const DocumentFeedbackRecord = z
  .object({
    feedback_id: z.string().uuid(),
    feedback_key: revision,
    case_id: z.string().uuid(),
    revision,
    document_feedback: DocumentFeedbackEvent,
    principal: z
      .object({
        kind: z.enum(["user_session", "swarm", "swarm_api_key"]),
        id: z.string().uuid(),
      })
      .strict(),
    created_at: z.string().datetime({ offset: true }),
    verified: z.boolean(),
  })
  .strict()
  .superRefine((record, ctx) => {
    if (
      record.feedback_id !== record.document_feedback.eventId ||
      record.case_id !== record.document_feedback.caseId ||
      record.verified !== (record.document_feedback.eventType !== "UNVERIFIED") ||
      (record.verified && record.principal.kind !== "user_session")
    )
      ctx.addIssue({ code: "custom", message: "Protected feedback readback binding mismatch" });
  });
