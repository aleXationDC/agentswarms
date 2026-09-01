import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  allowlistedMetadataEdits,
  applyMetadataEdits,
} from "@/axtn/workbenches/shared/metadataEdit";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";
import { auditEvent } from "@/utils/audit.server";

const input = z.object({
  access_token: z.string().min(1),
  kind: z.enum(["approval", "document"]),
  ids: z.array(z.string().min(1)).min(1).max(100),
  edits: z.record(z.string(), z.unknown()),
});
export type MetadataSaveResult = {
  updated: string[];
  failed: Array<{ id: string; reason: string }>;
};

export const saveAxtnWorkbenchMetadata = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => input.parse(value))
  .handler(async ({ data }): Promise<MetadataSaveResult> => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("Server is not configured.");
    const sb = createClient<Database>(url, key, {
      global: { headers: { Authorization: `Bearer ${data.access_token}` } },
    });
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) throw new Error("Invalid session.");
    const edits = allowlistedMetadataEdits(data.edits);
    if (Object.keys(edits).length === 0) throw new Error("Select at least one editable field.");
    const documentIds = data.ids.map(Number);
    if (data.kind === "document" && documentIds.some((id) => !Number.isInteger(id))) {
      throw new Error("Invalid document row identity.");
    }
    const rows =
      data.kind === "approval"
        ? await sb.from("approvals").select("id, payload, status").in("id", data.ids)
        : await sb
            .from("user_data_rows")
            .select("id, row, user_data_tables!inner(name)")
            .in("id", documentIds);
    if (rows.error) throw new Error(rows.error.message);
    const valid = (rows.data ?? []).filter((row) => {
      if (data.kind === "approval") {
        const approval = row as { payload: unknown; status: string };
        return (
          approval.status === "pending" &&
          typeof (approval.payload as Record<string, unknown>)?.proposal === "object"
        );
      }
      return (
        (row as { user_data_tables: { name: string } | null }).user_data_tables?.name ===
        "axtn_documents"
      );
    });
    if (valid.length !== data.ids.length)
      throw new Error("One or more selected items are no longer editable.");
    const bulk = data.ids.length > 1;
    const results = await Promise.all(
      valid.map(async (row): Promise<{ id: string; reason?: string }> => {
        if (data.kind === "approval") {
          const approval = row as { id: string; payload: Record<string, unknown> };
          const proposal = approval.payload.proposal as Record<string, unknown>;
          const result = await sb
            .from("approvals")
            .update({
              payload: {
                ...approval.payload,
                proposal: applyMetadataEdits(proposal, edits, user.id, bulk),
              } as Json,
            })
            .eq("id", approval.id)
            .eq("status", "pending")
            .select("id");
          return result.error || !result.data?.length
            ? { id: approval.id, reason: result.error?.message ?? "Item was not updated." }
            : { id: approval.id };
        }
        const document = row as { id: number; row: Record<string, unknown> };
        const result = await sb
          .from("user_data_rows")
          .update({
            row: applyMetadataEdits(document.row, edits, user.id, bulk) as Json,
          })
          .eq("id", document.id)
          .select("id");
        return result.error || !result.data?.length
          ? { id: String(document.id), reason: result.error?.message ?? "Item was not updated." }
          : { id: String(document.id) };
      }),
    );
    const updated = results.filter((result) => !result.reason).map((result) => result.id);
    const failed = results.filter(
      (result): result is { id: string; reason: string } => !!result.reason,
    );
    if (updated.length)
      auditEvent({
        userId: user.id,
        action: `axtn_workbench.${data.kind}.metadata_override`,
        resourceType: data.kind,
        detail: { ids: updated, fields: Object.keys(edits), bulk },
      });
    return { updated, failed };
  });
