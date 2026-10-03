import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ access_token: z.string().min(1).max(10000) });

export const getAxtnMaintenanceSettings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { requireSuperadminAal2 } = await import("./iam.server");
    const guard = await requireSuperadminAal2(data.access_token);
    if (!guard.ok) throw new Error(guard.error);
    const { configuredOperators } = await import("./axtnMaintenanceSettings.server");
    return { operators: configuredOperators() };
  });

export const getManagedN8nStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { requireSuperadminAal2 } = await import("./iam.server");
    const guard = await requireSuperadminAal2(data.access_token);
    if (!guard.ok) throw new Error(guard.error);
    const { readManagedN8nStatus } = await import("./integrations/nativeN8n.server");
    return readManagedN8nStatus();
  });
