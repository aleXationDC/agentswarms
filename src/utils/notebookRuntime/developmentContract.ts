import { z } from "zod";

const File = z
  .object({
    path: z
      .string()
      .regex(
        /^(?:src\/[A-Za-z0-9_-]+\.py|tests\/[A-Za-z0-9_-]+\.py|docs\/[A-Za-z0-9_-]+\.md|README\.md)$/,
      ),
    content: z.string().refine((value) => new TextEncoder().encode(value).length <= 65536),
  })
  .strict();
const Files = z
  .array(File)
  .max(20)
  .refine((files) => new Set(files.map((file) => file.path)).size === files.length);
export const DevelopmentVerification = z
  .object({
    schema: z.literal("axtn.development.verify/v1"),
    repository: z.literal("aXtn/development-swarm-acceptance"),
    effectKey: z.string().min(1).max(200),
    taskId: z.string().min(1).max(100),
    attemptId: z.string().min(1).max(100),
    caseId: z.string().uuid(),
    baseSHA: z.string().regex(/^[a-f0-9]{40}$/),
    candidateSHA: z.string().regex(/^[a-f0-9]{40}$/),
    profile: z.enum(["python-normalization-v1", "documentation-v1"]),
    baseline: Files,
    candidate: Files,
  })
  .strict()
  .refine((value) => new TextEncoder().encode(JSON.stringify(value)).length <= 131072);
export type DevelopmentVerification = z.infer<typeof DevelopmentVerification>;

export function credentiallessDevelopmentEnv(sessionId: string, inputs: DevelopmentVerification) {
  return {
    NB_MODE: "development_verify",
    NB_SESSION_ID: sessionId,
    NB_INPUTS: JSON.stringify(DevelopmentVerification.parse(inputs)),
    PYTHONDONTWRITEBYTECODE: "1",
    PYTHONUNBUFFERED: "1",
  };
}
