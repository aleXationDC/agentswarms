// "aleXation Archive Knowledge" — sanitized-only semantic archive of intake
// documents (DMS-D1-0002 §10).
//
// Uses the existing native KB pattern verbatim (`knowledge_bases`,
// `knowledge_documents`, `resolveEmbedArgs`, `embedAndStoreDocuments`,
// standard `kb_search`) — no second document/version store, no bespoke
// vector table. Drive stays the physical source of truth and
// `document_registry` stays the exact physical-identity index; this KB is
// purely a semantic index over PSEUDONYMISED text, so it can be searched by
// the classification agent and later features without ever holding raw PII.
//
// Only ever called with the pseudonymised representation
// (dmsIntake.server.ts only calls this on the readable+privacy-allowed
// route) — never with `restricted`-tier or extraction-failed content, since
// there is no "usable pseudonymised extracted text" for either of those.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { resolveEmbedArgs } from "@/utils/tools/embedTarget.server";
import { embedAndStoreDocuments } from "@/utils/tools/embedding.server";

export const ARCHIVE_KNOWLEDGE_BASE_NAME = "aleXation Archive Knowledge";

/** Find-or-create the owner's Archive Knowledge base. */
export async function ensureArchiveKnowledgeBase(
  sb: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: existing } = await sb
    .from("knowledge_bases")
    .select("id")
    .eq("user_id", userId)
    .eq("name", ARCHIVE_KNOWLEDGE_BASE_NAME)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created, error } = await sb
    .from("knowledge_bases")
    .insert({
      user_id: userId,
      name: ARCHIVE_KNOWLEDGE_BASE_NAME,
      description:
        "Sanitized, pseudonymised index of DMS intake documents (DMS-D1-0002 §10). " +
        "Drive is the physical source of truth; document_registry is the exact " +
        "identity index — this KB is semantic search only.",
      is_sample: false,
    })
    .select("id")
    .single();
  if (error || !created)
    throw new Error(error?.message ?? "Could not create the Archive Knowledge base");
  return created.id;
}

export type ArchiveIndexResult =
  | { action: "skipped_unchanged"; documentId: string }
  | { action: "indexed"; documentId: string; chunksInserted: number }
  | { action: "saved_not_embedded"; documentId: string; reason: string };

/**
 * Index one document's pseudonymised text. Idempotent on `document_id +
 * content_hash` (§10): calling this again with the same hash is a no-op, and
 * a changed hash replaces the document's content/embeddings in place rather
 * than creating a duplicate row.
 */
export async function indexArchiveDocument(
  sb: SupabaseClient<Database>,
  userId: string,
  args: {
    documentId: string;
    driveFileId: string;
    contentHash: string;
    sourceFilename: string;
    pseudonymizedText: string;
    provenance?: { approvalId?: string | null; swarmRunId?: string | null };
  },
): Promise<ArchiveIndexResult> {
  const { documentId, contentHash, pseudonymizedText } = args;
  if (!pseudonymizedText.trim()) {
    // Nothing usable to index — this must never happen for the swarm route
    // (extraction already succeeded there), but fail safe rather than write
    // an empty/garbage chunk.
    return { action: "skipped_unchanged", documentId };
  }

  const kbId = await ensureArchiveKnowledgeBase(sb, userId);

  const { data: existing } = await sb
    .from("knowledge_documents")
    .select("id, content_hash")
    .eq("knowledge_base_id", kbId)
    .eq("external_id", documentId)
    .maybeSingle();

  if (existing?.id && existing.content_hash === contentHash) {
    return { action: "skipped_unchanged", documentId };
  }

  const metadata = {
    document_id: documentId,
    drive_file_id: args.driveFileId,
    content_hash: contentHash,
    source_filename: args.sourceFilename,
    approval_id: args.provenance?.approvalId ?? null,
    swarm_run_id: args.provenance?.swarmRunId ?? null,
  };

  let docRowId: string;
  if (existing?.id) {
    docRowId = existing.id;
    await sb
      .from("knowledge_documents")
      .update({
        content: pseudonymizedText,
        content_hash: contentHash,
        metadata: metadata as unknown as Json,
      })
      .eq("id", existing.id);
  } else {
    const { data: created, error } = await sb
      .from("knowledge_documents")
      .insert({
        knowledge_base_id: kbId,
        user_id: userId,
        external_id: documentId,
        name: args.sourceFilename,
        content: pseudonymizedText,
        content_hash: contentHash,
        metadata: metadata as unknown as Json,
        is_sample: false,
      })
      .select("id")
      .single();
    if (error || !created)
      throw new Error(error?.message ?? "Could not create the Archive Knowledge document row");
    docRowId = created.id;
  }

  const embedArgs = await resolveEmbedArgs(userId);
  if (!embedArgs) {
    // Same graceful-degradation contract as every other ingestion path
    // (embedTarget.server.ts): content is saved, semantic search just isn't
    // updated yet — never fatal to intake.
    return { action: "saved_not_embedded", documentId, reason: "No embedding provider configured" };
  }

  const result = await embedAndStoreDocuments({
    sb,
    docs: [
      {
        id: docRowId,
        knowledge_base_id: kbId,
        user_id: userId,
        is_sample: false,
        content: pseudonymizedText,
        metadata,
      },
    ],
    openaiKey: embedArgs.openaiKey,
    endpoint: embedArgs.endpoint,
    allowCustomModel: embedArgs.allowCustomModel,
    defaults: embedArgs.defaults,
    stampProvider: embedArgs.stampProvider,
    userId,
    surface: "dms_archive_knowledge",
  });

  return { action: "indexed", documentId, chunksInserted: result.chunksInserted };
}
