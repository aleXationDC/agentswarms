import { z } from "zod";

export const CaseSwarmStart = z
  .object({
    access_token: z.string().min(1),
    caseId: z.string().uuid(),
    swarmId: z.string().uuid(),
    publishedVersionId: z.string().uuid(),
    operationKey: z.string().uuid(),
    input: z.string().trim().min(1).max(8000),
  })
  .strict();
export type CaseSwarmStart = z.infer<typeof CaseSwarmStart>;
