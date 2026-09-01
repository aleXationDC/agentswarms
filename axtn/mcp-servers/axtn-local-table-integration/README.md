# aXtn Local Table Integration

This is the versioned MCP Builder source for the native Local Table integration.
Deploy it as a Streamable HTTP MCP server and approve the discovered
`local_table_upsert` before exposing it. Create a scoped, hashed MCP key
whose tool allowlist contains only that tool.

The initial table allowlist is `axtn_document_registry`. The AgentSwarms
deployment must set `LOCAL_TABLE_INTEGRATION_ALLOWLIST=axtn_document_registry`
(the same value is the fail-closed default). The platform, rather than the
sandbox, verifies the runtime session, MCP ownership, table owner, declared
columns, key consistency, atomic upsert and cache freshness. The sandbox and
external MCP caller receive neither Supabase credentials nor a service-role key.

The external endpoint is the MCP Builder-issued Streamable HTTP endpoint
`/api/mcp/s/<slug>`; this source does not provision an app or key. n8n
credential provisioning is intentionally deferred to the intake package.
