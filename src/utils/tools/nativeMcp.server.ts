export function nativeMcpAccessToken(
  row: { id?: string; user_id?: string; name?: string; endpoint?: string; auth_type?: string },
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (!env.AXTN_DEVELOPMENT_MCP_SERVER_ID || row.id !== env.AXTN_DEVELOPMENT_MCP_SERVER_ID)
    return undefined;
  if (
    row.user_id !== env.AXTN_DEVELOPMENT_MCP_OWNER_ID ||
    row.name !== "aXtn Development Gitea" ||
    !env.AXTN_DEVELOPMENT_MCP_URL ||
    row.endpoint !== env.AXTN_DEVELOPMENT_MCP_URL ||
    row.auth_type !== "token"
  )
    throw new Error(
      "Managed native MCP registry identity or endpoint differs from its Host binding.",
    );
  const token = env.AXTN_DEVELOPMENT_MCP_ACCESS_TOKEN;
  if (!token || !/^[a-f0-9]{64}$/.test(token))
    throw new Error("Managed native MCP access credential is not configured.");
  return token;
}
