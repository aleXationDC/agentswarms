export const EDITABLE_METADATA_FIELDS = [
  "canonical_filename",
  "document_type",
  "document_family",
  "organization",
  "sender_or_issuer",
  "primary_domain",
  "document_date",
  "proposed_path",
  "proposed_folder_path",
  "para_class",
  "topics",
  "summary",
] as const;

export type EditableMetadataField = (typeof EDITABLE_METADATA_FIELDS)[number];
export type MetadataEdits = Partial<Record<EditableMetadataField, string>>;

export function allowlistedMetadataEdits(input: Record<string, unknown>): MetadataEdits {
  return Object.fromEntries(
    EDITABLE_METADATA_FIELDS.flatMap((field) => {
      const value = input[field];
      return typeof value === "string" ? [[field, value.trim()]] : [];
    }),
  ) as MetadataEdits;
}

export function applyMetadataEdits(
  metadata: Record<string, unknown>,
  edits: MetadataEdits,
  userId: string,
  bulk = false,
): Record<string, unknown> {
  return {
    ...metadata,
    ...edits,
    human_overridden: true,
    human_overridden_at: new Date().toISOString(),
    human_overridden_by: userId,
    ...(bulk ? { bulk_overridden: true } : {}),
  };
}
