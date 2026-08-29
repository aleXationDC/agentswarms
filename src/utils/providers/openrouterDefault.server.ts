// Shared constants for server-side code that calls OpenRouter directly via
// `fetch` (background jobs — memory, KB ingestion, BI agent, skill/tool/exam
// generation, notebook AI proxies) rather than through the credentials.server
// per-user resolver. These always use the operator's shared OPENROUTER_API_KEY
// since they're internal utility calls, not a specific user's chat turn.
export const OPENROUTER_CHAT_URL = `${(process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/+$/, "")}/chat/completions`;

export function getOpenRouterApiKey(): string | null {
  const key = process.env.OPENROUTER_API_KEY;
  return key && key.trim() ? key.trim() : null;
}

/**
 * Resolve the chat transport an internal utility call (memory extraction, STM
 * summarisation, …) should use *for a specific user*.
 *
 * The constant above is an operator-level fallback. When the user has actually
 * connected their own provider under /integrations, these background calls must
 * use the same credentials the user's chat turns use — otherwise the two halves
 * of a single turn talk to different upstreams. That is a real failure mode we
 * hit: agent replies went to the user's live provider while memory extraction
 * went to OPENROUTER_BASE_URL, so extraction silently returned nothing.
 *
 * Falls back to the operator key/URL when the user has no usable credential.
 */
export async function resolveInternalChatTransport(
  userId: string | null | undefined,
): Promise<{ endpointUrl: string; apiKey: string; extraHeaders?: Record<string, string> } | null> {
  if (userId) {
    try {
      const { resolveOpenAICompatTransport } = await import("./credentials.server");
      // OpenRouter only: the internal utility prompts are pinned to OpenRouter
      // model ids (e.g. "openai/gpt-4o-mini"), which no other upstream accepts.
      const t = await resolveOpenAICompatTransport({ userId, provider: "openrouter" });
      if (t?.apiKey && t?.endpointUrl) return t;
    } catch {
      /* fall through to the operator default */
    }
  }
  const key = getOpenRouterApiKey();
  return key ? { endpointUrl: OPENROUTER_CHAT_URL, apiKey: key } : null;
}
