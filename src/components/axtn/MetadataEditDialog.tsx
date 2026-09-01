import { useState } from "react";

import {
  EDITABLE_METADATA_FIELDS,
  type MetadataEdits,
} from "@/axtn/workbenches/shared/metadataEdit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function MetadataEditDialog({
  open,
  onOpenChange,
  count,
  values,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  values: Record<string, unknown>;
  onSave: (edits: MetadataEdits) => Promise<void>;
}) {
  const [edits, setEdits] = useState<MetadataEdits>({});
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{count > 1 ? "Bulk Edit" : "Edit metadata / Human Correction"}</DialogTitle>
          <DialogDescription>
            {count} selected item{count === 1 ? "" : "s"}. Only fields with Apply enabled are
            changed.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {EDITABLE_METADATA_FIELDS.map((field) => (
            <div className="grid grid-cols-[auto_1fr] items-center gap-3" key={field}>
              <input
                aria-label={`Apply ${field}`}
                checked={field in edits}
                onChange={(event) =>
                  setEdits((current) => {
                    const next = { ...current };
                    if (event.target.checked) next[field] = String(values[field] ?? "");
                    else delete next[field];
                    return next;
                  })
                }
                type="checkbox"
              />
              <div>
                <Label htmlFor={field}>{field.replaceAll("_", " ")}</Label>
                <Input
                  disabled={!(field in edits)}
                  id={field}
                  onChange={(event) =>
                    setEdits((current) => ({ ...current, [field]: event.target.value }))
                  }
                  placeholder={values[field] === undefined ? "Not provided" : String(values[field])}
                  value={edits[field] ?? ""}
                />
              </div>
            </div>
          ))}
        </div>
        <Button
          disabled={saving || Object.keys(edits).length === 0}
          onClick={() => {
            setSaving(true);
            void onSave(edits).finally(() => setSaving(false));
          }}
        >
          {saving ? "Saving..." : count > 1 ? "Apply bulk edit" : "Save correction"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
