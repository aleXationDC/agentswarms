"""aXtn Local Table Integration MCP server.

Deploy this source through MCP Builder. It deliberately exposes one mutation
tool and permits only the registry named below; the platform independently
enforces the same table allow-list, ownership and schema validation.
"""
from fastmcp import FastMCP
from agentswarms import local_table_upsert

mcp = FastMCP("aXtn Local Table Integration")
ALLOWED_TABLES = {"axtn_document_registry"}


@mcp.tool()
async def local_table_upsert_tool(
    table_name: str, key_column: str, key_value: str, row: dict
) -> dict:
    """Atomically create or update a row in an approved aXtn Local Table."""
    if table_name not in ALLOWED_TABLES:
        raise ValueError("This Local Table is not configured for this MCP server.")
    return await local_table_upsert(table_name, key_column, key_value, row)
