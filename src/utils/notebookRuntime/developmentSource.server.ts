import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runMcpCallTool } from "@/utils/tools/registry.server";
import { canonicalJson } from "@/utils/provenance/canonical";
import type { DevelopmentVerification } from "./developmentContract";

const Wire = z.object({
  error: z.unknown().optional(),
  result: z
    .object({
      isError: z.boolean().optional(),
      structuredContent: z.unknown().optional(),
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
    })
    .optional(),
});
const Tree = z.object({
  sha: z.string(),
  truncated: z.boolean().optional(),
  tree: z.array(z.object({ path: z.string(), type: z.string(), mode: z.string() })).max(200),
});
const File = z.object({
  content: z.string().max(100000),
  encoding: z.literal("base64"),
  size: z.number().int().nonnegative().max(65536),
});
const safePath =
  /^(?:src\/[A-Za-z0-9_-]+\.py|tests\/[A-Za-z0-9_-]+\.py|docs\/[A-Za-z0-9_-]+\.md|README\.md)$/;

export async function assertDevelopmentSnapshots(userId: string, request: DevelopmentVerification) {
  const ctx = { userId, scopeUserId: userId, sb: supabaseAdmin };
  const server = "aXtn Development Gitea";
  async function call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const wire = Wire.parse(
      JSON.parse(
        await runMcpCallTool(
          ctx,
          {
            server_name: server,
            tool_name: tool,
            arguments: { owner: "aXtn", repository: "development-swarm-acceptance", ...args },
          },
          [server],
        ),
      ),
    );
    if (wire.error || !wire.result || wire.result.isError) {
      throw new Error("Native immutable Git snapshot read failed");
    }
    if (wire.result.structuredContent !== undefined) return wire.result.structuredContent;
    const content = wire.result.content;
    if (!content || content.length !== 1 || content[0].type !== "text" || !content[0].text) {
      throw new Error("Native immutable Git snapshot response is malformed");
    }
    return JSON.parse(content[0].text);
  }
  for (const [revision, supplied] of [
    [request.baseSHA, request.baseline],
    [request.candidateSHA, request.candidate],
  ] as const) {
    const tree = Tree.parse(await call("repository_tree", { ref: revision, recursive: true }));
    if (tree.sha !== revision || tree.truncated)
      throw new Error("Native Git tree revision is incomplete");
    const paths = tree.tree.filter((entry) => safePath.test(entry.path));
    if (
      paths.length > 20 ||
      paths.some((entry) => entry.type !== "blob" || !["100644", "100755"].includes(entry.mode))
    ) {
      throw new Error("Native Git snapshot exceeds the bounded regular-file profile");
    }
    const actual: Array<{ path: string; content: string }> = [];
    for (const entry of paths) {
      const file = File.parse(
        await call("fetch", {
          target: "file",
          identifier: entry.path,
          ref: revision,
        }),
      );
      const bytes = Buffer.from(file.content.replace(/\s/g, ""), "base64");
      if (
        bytes.length !== file.size ||
        !bytes.equals(Buffer.from(bytes.toString("utf8"), "utf8"))
      ) {
        throw new Error("Native Git snapshot must be complete UTF-8 text");
      }
      actual.push({ path: entry.path, content: bytes.toString("utf8") });
    }
    const byPath = (a: { path: string }, b: { path: string }) => a.path.localeCompare(b.path);
    if (canonicalJson(actual.sort(byPath)) !== canonicalJson([...supplied].sort(byPath))) {
      throw new Error("Native verification content differs from the immutable Git revision");
    }
  }
}
