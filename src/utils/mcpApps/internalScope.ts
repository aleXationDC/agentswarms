import { z } from "zod";

export class InternalToolScopeError extends Error {}

export const InternalRegistrationSchema = z
  .object({
    id: z.string().uuid(),
    tool_allowlist: z.array(z.string().min(1).max(200)).min(1).max(200).optional(),
    tools_hash: z.string().min(1).max(200).optional(),
  })
  .refine((input) => !input.tool_allowlist || !!input.tools_hash, {
    message: "Scoped internal registration requires the reviewed tool fingerprint.",
  });

export function internalToolScope(
  app: {
    tools: unknown;
    tools_hash: string | null;
    tools_changed_at: string | null;
    tools_approved_at: string | null;
  },
  requested?: string[],
  reviewedHash?: string,
): string[] {
  if (!requested) return [];
  if (!reviewedHash || app.tools_hash !== reviewedHash)
    throw new InternalToolScopeError(
      "The reviewed tool fingerprint changed; review the deployed tools again.",
    );
  const approved = app.tools_approved_at ? Date.parse(app.tools_approved_at) : NaN;
  const changed = app.tools_changed_at ? Date.parse(app.tools_changed_at) : null;
  if (
    !Number.isFinite(approved) ||
    (changed !== null && (!Number.isFinite(changed) || changed > approved))
  )
    throw new InternalToolScopeError(
      "Approve the current deployed tool list before scoped registration.",
    );
  if (!Array.isArray(app.tools))
    throw new InternalToolScopeError(
      "The deployed tool list is not available for scoped registration.",
    );
  const tools = app.tools.map((tool: unknown) => {
    if (!tool || typeof tool !== "object" || !("name" in tool) || typeof tool.name !== "string")
      throw new InternalToolScopeError("The deployed tool list is malformed.");
    return tool.name;
  });
  const scope = [...new Set(requested)];
  if (!scope.length || scope.some((name) => !tools.includes(name)))
    throw new InternalToolScopeError(
      "Every scoped tool must belong to the current deployed tool list.",
    );
  return scope;
}
