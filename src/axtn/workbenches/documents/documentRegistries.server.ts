import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SeedResult = z
  .object({
    schemaVersion: z.literal("document-registry-seed-v1"),
    datasets: z
      .array(
        z
          .object({
            name: z.enum([
              "axtn_document_registry",
              "axtn_document_recognition_patterns",
              "axtn_document_classification_values",
            ]),
            id: z.string().uuid(),
            created: z.boolean(),
            reconciled: z.boolean(),
          })
          .strict(),
      )
      .length(3),
    classificationValuesInserted: z.number().int().min(0).max(6),
  })
  .strict()
  .refine(
    (result) =>
      new Set(result.datasets.map((dataset) => dataset.name)).size === 3 &&
      new Set(result.datasets.map((dataset) => dataset.id)).size === 3,
  );

export async function seedDocumentRegistries(userId: string) {
  const owner = z.string().uuid().parse(userId);
  const { data, error } = await supabaseAdmin.rpc("axtn_seed_document_registries", {
    p_user_id: owner,
  });
  if (error) throw new Error(`Document Registry seed failed: ${error.message}`);
  return SeedResult.parse(data);
}
