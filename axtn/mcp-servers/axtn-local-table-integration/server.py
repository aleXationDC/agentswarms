"""aXtn Local Table Integration MCP server.

Deploy this source through MCP Builder. It deliberately exposes one mutation
tool and permits only the registry named below; the platform independently
enforces the same table allow-list, ownership and schema validation.
"""
from typing import Optional

from fastmcp import FastMCP
from agentswarms import local_table_upsert as platform_local_table_upsert

mcp = FastMCP("aXtn Local Table Integration")
ALLOWED_TABLES = {"axtn_document_registry"}


@mcp.tool()
async def local_table_upsert(
    table_name: str,
    key_column: str,
    key_value: str,
    row: dict,
    immutable_columns: Optional[list] = None,
    generate_columns: Optional[dict] = None,
) -> dict:
    """Atomically create or update a row in an approved aXtn Local Table.

    `immutable_columns` lists columns whose stored value must survive this
    write, so replaying the same row cannot restate an identity that was
    established when the row was first created. `generate_columns` maps a
    column to a generation strategy ("hex24"), applied by the platform only
    when it inserts a new row. Both are enforced server-side; the resulting
    values come back under "effective_columns".
    """
    if table_name not in ALLOWED_TABLES:
        raise ValueError("This Local Table is not configured for this MCP server.")
    return await platform_local_table_upsert(
        table_name,
        key_column,
        key_value,
        row,
        immutable_columns=immutable_columns,
        generate_columns=generate_columns,
    )
