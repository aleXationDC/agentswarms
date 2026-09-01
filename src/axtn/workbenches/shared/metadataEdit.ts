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
export type MetadataValue = string | string[];
export type MetadataEdits = Partial<Record<EditableMetadataField, string>>;
export type FieldValueState =
  | { kind: "empty" }
  | { kind: "common"; value: MetadataValue }
  | { kind: "mixed" }
  | { kind: "incompatible" };

export function allowlistedMetadataEdits(input: Record<string, unknown>): MetadataEdits {
  return Object.fromEntries(
    EDITABLE_METADATA_FIELDS.flatMap((field) => {
      const value = input[field];
      return typeof value === "string" ? [[field, value.trim()]] : [];
    }),
  ) as MetadataEdits;
}

function valueForField(
  metadata: Record<string, unknown>,
  field: EditableMetadataField,
): MetadataValue | null {
  const value = metadata[field];
  if (typeof value === "string") return value;
  if (
    field === "topics" &&
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  ) {
    return value;
  }
  return null;
}

export function aggregateMetadataValues(
  records: Record<string, unknown>[],
): Record<EditableMetadataField, FieldValueState> {
  return Object.fromEntries(
    EDITABLE_METADATA_FIELDS.map((field) => {
      const values = records.map((record) => valueForField(record, field));
      if (values.every((value) => value === null)) return [field, { kind: "empty" }];
      if (
        field === "topics" &&
        new Set(values.filter((value): value is MetadataValue => value !== null).map(Array.isArray))
          .size > 1
      ) {
        return [field, { kind: "incompatible" }];
      }
      if (values.some((value) => value === null)) return [field, { kind: "mixed" }];
      const supportedValues = values as MetadataValue[];
      const normalized = supportedValues.map((value) =>
        Array.isArray(value) ? value.join("\u0000") : value,
      );
      return new Set(normalized).size === 1
        ? [field, { kind: "common", value: supportedValues[0] }]
        : [field, { kind: "mixed" }];
    }),
  ) as Record<EditableMetadataField, FieldValueState>;
}

export function visibleSelectionIds(selected: string[], visibleIds: string[]): string[] {
  const visible = new Set(visibleIds);
  return selected.filter((id) => visible.has(id));
}

export function applyMetadataEdits(
  metadata: Record<string, unknown>,
  edits: MetadataEdits,
  userId: string,
  bulk = false,
): Record<string, unknown> {
  const applied = Object.fromEntries(
    Object.entries(edits).map(([field, value]) => [
      field,
      field === "topics" && Array.isArray(metadata.topics)
        ? value
            .split(",")
            .map((topic) => topic.trim())
            .filter(Boolean)
        : value,
    ]),
  );
  return {
    ...metadata,
    ...applied,
    human_overridden: true,
    human_overridden_at: new Date().toISOString(),
    human_overridden_by: userId,
    ...(bulk ? { bulk_overridden: true } : {}),
  };
}
