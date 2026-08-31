import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSuperadmin } from "@/utils/iam.server";

const ExtensionSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1).max(100),
  url: z.string().url().refine((url) => new URL(url).protocol === "https:", {
    message: "System extension URLs must use HTTPS.",
  }),
  description: z.string().min(1).max(300),
});

const ExtensionsSchema = z.array(ExtensionSchema).max(20);

export type AxtnSystemExtension = z.infer<typeof ExtensionSchema>;

function configuredExtensions(): AxtnSystemExtension[] {
  const value = process.env.AXTN_SYSTEM_EXTENSIONS?.trim();
  if (!value) return [];

  try {
    return ExtensionsSchema.parse(JSON.parse(value));
  } catch (error) {
    throw new Error(
      `AXTN_SYSTEM_EXTENSIONS is invalid: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export const axtnListSystemExtensions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ access_token: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<AxtnSystemExtension[]> => {
    const guard = await requireSuperadmin(data.access_token);
    if (!guard.ok) throw new Error(guard.error);

    return configuredExtensions();
  });
