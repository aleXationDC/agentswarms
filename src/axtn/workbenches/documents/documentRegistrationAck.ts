import { z } from "zod";

const INTAKE_ID = "62bbd9a0-2fb3-4241-828d-584fa76edc74";
export const DOCUMENT_MANAGEMENT_SWARM_ID = "9b9ea6c2-a554-4fa7-9c40-908dad632ae7";
export const DocumentRegistrationIngress = z.object({
  business_request_id: z.string().min(1),
  idempotency_key: z.string().trim().min(1),
  source_ref: z
    .string()
    .min(1)
    .max(500)
    .refine(
      (value) =>
        !!value.trim() &&
        !Array.from(value).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
    )
    .optional(),
  source_type: z.enum(["google_drive", "imap", "gmail", "mail", "fixture"]),
  source_revision: z.string().optional(),
  source_identity: z.object({
    provider_revision: z.string().optional(),
    etag: z.string().optional(),
  }),
  privacy: z.union([
    z.string(),
    z.object({ state: z.string().optional(), status: z.string().optional() }),
  ]),
  technical: z.object({
    original_sha256: z.string().optional(),
    content_hash: z.string().optional(),
  }),
});
const Ack = z
  .object({
    accepted: z.literal(true),
    document_id: z.string().min(1).max(500),
    source_ref: z.string().min(1).max(500),
    processing_status: z.literal("registered"),
    processing_route: z.literal("privacy_hold"),
    registry_outcome: z.enum(["inserted", "updated"]),
    next_location: z.string().min(1).max(500).optional(),
    case_id: z.string().uuid().optional(),
    input_hash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .strict();

export const CaseBoundRegistrationAck = Ack.extend({
  case_id: z.string().uuid(),
  input_hash: z.string().regex(/^[a-f0-9]{64}$/),
});

export function documentRegistrationAck(swarmId: string, output: unknown) {
  if (swarmId !== INTAKE_ID) return {};
  if (typeof output !== "string") throw new Error("DOCUMENT_REGISTRATION_ACK_REQUIRED");
  let value: unknown;
  try {
    value = JSON.parse(output);
  } catch {
    throw new Error("DOCUMENT_REGISTRATION_ACK_INVALID_JSON");
  }
  const parsed = Ack.safeParse(value);
  if (!parsed.success) throw new Error("DOCUMENT_REGISTRATION_ACK_INVALID_CONTRACT");
  return parsed.data;
}
