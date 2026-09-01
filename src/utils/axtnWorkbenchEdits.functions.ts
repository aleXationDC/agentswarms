import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  allowlistedMetadataEdits,
  applyMetadataEdits,
} from "@/axtn/workbenches/shared/metadataEdit";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { auditEvent } from "@/utils/audit.server";

const input = z.object({
  access_token: z.string().min(1),
  kind: z.enum(["approval", "document"]),
  ids: z.array(z.string().min(1)).min(1).max(100),
  edits: z.record(z.string(), z.unknown()),
});

export const saveAxtnWorkbenchMetadata = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => input.parse(value))
  .handler(async ({ data }): Promise<{ updated: string[]; failed: string[] }> => {
    const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(data.access_token);
    if (authError || !auth.user) throw new Error(authError?.message ?? "Invalid session.");
    const edits = allowlistedMetadataEdits(data.edits);
    if (Object.keys(edits).length === 0) throw new Error("Select at least one editable field.");

    const documentIds = data.ids.map(Number);
    if (data.kind === "document" && documentIds.some((id) => !Number.isInteger(id))) {
      throw new Error("Invalid document row identity.");
    }
    const rows =
      data.kind === "approval"
        ? await supabaseAdmin
            .from("approvals")
            .select("id, user_id, payload, status")
            .in("id", data.ids)
        : await supabaseAdmin
            .from("user_data_rows")
            .select("id, table_id, row, user_data_tables!inner(user_id, name)")
            .in("id", documentIds);
    if (rows.error) throw new Error(rows.error.message);

    const valid = (rows.data ?? []).filter((row) => {
      if (data.kind === "approval") {
        const approval = row as { user_id: string; payload: unknown; status: string };
        return (
          approval.user_id === auth.user!.id &&
          approval.status === "pending" &&
          typeof approval.payload === "object" &&
          approval.payload !== null &&
          typeof (approval.payload as Record<string, unknown>).proposal === "object" &&
          (approval.payload as Record<string, unknown>).proposal !== null
        );
      }
      const document = row as { user_data_tables: { user_id: string | null; name: string } | null };
      return (
        document.user_data_tables?.user_id === auth.user!.id &&
        document.user_data_tables.name === "axtn_documents"
      );
    });
    if (valid.length !== data.ids.length)
      throw new Error("One or more selected items are no longer editable.");

    const bulk = data.ids.length > 1;
    const updates = await Promise.all(
      valid.map(async (row) => {
        if (data.kind === "approval") {
          const approval = row as { id: string; payload: Record<string, unknown> };
          const proposal = approval.payload.proposal as Record<string, unknown>;
          return supabaseAdmin
            .from("approvals")
            .update({
              payload: {
                ...approval.payload,
                proposal: applyMetadataEdits(proposal, edits, auth.user!.id, bulk),
              } as Json,
            })
            .eq("id", approval.id)
            .eq("status", "pending");
        }
        const document = row as { id: number; row: Record<string, unknown> };
        return supabaseAdmin
          .from("user_data_rows")
          .update({ row: applyMetadataEdits(document.row, edits, auth.user!.id, bulk) as Json })
          .eq("id", document.id);
      }),
    );
    const failed = updates.flatMap((result, index) => (result.error ? [data.ids[index]] : []));
    if (failed.length) throw new Error(`Metadata update failed for ${failed.length} item(s).`);
    auditEvent({
      userId: auth.user.id,
      action: `axtn_workbench.${data.kind}.metadata_override`,
      resourceType: data.kind,
      detail: { ids: data.ids, fields: Object.keys(edits), bulk },
    });
    return { updated: data.ids, failed: [] };
  });
