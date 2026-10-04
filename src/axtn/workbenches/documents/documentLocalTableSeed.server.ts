import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateMcpSlug } from "@/utils/mcpApps/keys";

const SOURCE_HASH = "925c5324f7fd4c1a5e66e9972fd18b0a58212dc350a83722fb6cf98ed21a5c68";
const SeedResult = z
  .object({
    schemaVersion: z.literal("document-local-table-seed-v1"),
    appId: z.string().uuid(),
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,59}$/),
    created: z.boolean(),
    status: z.enum(["draft", "deploying", "ready", "error", "stopped"]),
    registeredServerId: z.string().uuid().nullable(),
    runtimeActivated: z.literal(false),
  })
  .strict();

export async function seedDocumentLocalTable(userId: string) {
  const owner = z.string().uuid().parse(userId);
  const source = await readFile(
    resolve("axtn/mcp-servers/axtn-local-table-integration/server.py"),
    "utf8",
  );
  if (createHash("sha256").update(source).digest("hex") !== SOURCE_HASH)
    throw new Error("DOCUMENT_LOCAL_TABLE_CANONICAL_SOURCE_REQUIRED");
  const { data, error } = await supabaseAdmin.rpc("axtn_seed_document_local_table", {
    p_user_id: owner,
    p_slug: generateMcpSlug("aXtn Local Table Integration"),
    p_source: source,
  });
  if (error) throw new Error(`Document Local Table seed failed: ${error.message}`);
  return SeedResult.parse(data);
}
