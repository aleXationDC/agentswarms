import { z } from "zod";

const INTAKE_ID = "62bbd9a0-2fb3-4241-828d-584fa76edc74";
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
