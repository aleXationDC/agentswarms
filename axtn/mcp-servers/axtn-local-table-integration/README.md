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

After migration `20261004130000_document_local_table_seed.sql`,
`node axtn/swarms/axtn-document-management/seed-local-table.mjs` uses the existing
authenticated bootstrap-superadmin process to seed the exact source as an
owned, private MCP Builder draft. Concurrent seeds and retries retain the
original app ID and server-generated slug. Existing source/configuration
conflicts and ambiguous names fail instead of overwriting operator work.
The seed creates no key, connected server or runtime session; it does not
deploy, approve tools, expose the app or alter admission configuration.

Complete deployment/discovery/tool approval through the existing MCP Builder.
Runtime mutation admission also requires the exact persisted app ID in
`LOCAL_TABLE_INTEGRATION_MCP_APP_IDS`; an unset list admits **no** app.
The table allowlist alone is insufficient. Use the native issued Streamable HTTP
endpoint `/api/mcp/s/<slug>` and a key narrowed to `local_table_upsert`.
Do not use the unrestricted internal-registration key as a substitute for the
required scoped key. Production discovery/key/runtime provisioning and n8n
credential binding remain pending. No local Copilot MCP change is involved.
