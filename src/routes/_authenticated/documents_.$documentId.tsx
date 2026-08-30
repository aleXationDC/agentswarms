// Document Detail & Canonical Correction — Documents Workbench.
//
// Shows the current canonical document facts, supports direct human correction
// with impact previews (Rename / Move consequences), and reversible Move to Trash.
// Direct human correction uses ZERO LLM calls.
//
// DMS-D1-0005-DOCUMENTS-v2 §12, §13
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowLeft,
  ExternalLink,
  Save,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  FolderTree,
  FileText,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchDocumentDetail,
  applyDocumentCorrection,
  moveDocumentToTrash,
  previewDocumentImpact,
  type DocumentDetail,
  type DocumentCorrectionEdits,
  type ImpactPreview,
} from "@/lib/documentsWorkbench";
import { CANONICAL_PARA_ROOTS } from "@/lib/reviewWorkbench";

export const Route = createFileRoute("/_authenticated/documents_/$documentId")({
  component: DocumentDetailPage,
});

function DocumentDetailPage() {
  const { documentId } = Route.useParams();
  const decodedDocId = decodeURIComponent(documentId);
  const { user, loading: authLoading } = useAuth();
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit / Correction State
  const [isEditing, setIsEditing] = useState(false);
  const [edits, setEdits] = useState<DocumentCorrectionEdits>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Trash State
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashing, setTrashing] = useState(false);
  const [isTrashed, setIsTrashed] = useState(false);

  const load = async (uid: string) => {
    setLoading(true);
    const { detail: d, error } = await fetchDocumentDetail(supabase, uid, decodedDocId);
    setLoadError(error || null);
    setDetail(d);
    if (d?.document) {
      setEdits({
        document_type: d.document.documentType || "",
        document_family: d.document.documentFamily || "",
        organization: d.document.organization || "",
        primary_domain: d.document.primaryDomain || "",
        document_date: d.document.documentDate || "",
        proposed_path: d.document.proposedPath || d.document.currentPath || "04_Archive",
        canonical_filename: d.document.canonicalFilename || d.document.originalFilename || "",
        topics: d.document.topics || "",
      });
      setIsTrashed(d.document.status === "trashed");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    void load(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, documentId]);

  if (authLoading || loading) {
    return (
      <div className="p-6 space-y-3 max-w-5xl mx-auto">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (loadError || !detail) {
    return (
      <div className="p-6 space-y-3 max-w-5xl mx-auto">
        <BackLink />
        <p className="text-sm text-destructive">
          Document could not be loaded: {loadError || "Document not found."}
        </p>
      </div>
    );
  }

  const { document: doc, history, relatedMail } = detail;
  const impact = previewDocumentImpact(doc, edits);

  const onSaveCorrection = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError(null);

    const res = await applyDocumentCorrection(supabase, user.id, decodedDocId, edits);
    setSaving(false);

    if (!res.ok) {
      setSaveError(res.error || "Failed to apply document correction");
      return;
    }

    setIsEditing(false);
    await load(user.id);
  };

  const onConfirmTrash = async () => {
    if (!user) return;
    setTrashing(true);
    const res = await moveDocumentToTrash(supabase, user.id, decodedDocId);
    setTrashing(false);
    if (res.ok) {
      setIsTrashed(true);
      setTrashOpen(false);
      await load(user.id);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <BackLink />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Canonical Document
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {doc.canonicalFilename || doc.originalFilename || doc.documentId}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {doc.documentId}
            {doc.ingestedAt ? ` · ingested ${format(new Date(doc.ingestedAt), "PPp")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {doc.driveUrl && (
            <a
              href={doc.driveUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary border border-primary/30 rounded px-2.5 py-1.5 hover:bg-primary/5"
            >
              Open in Drive <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {!isTrashed && (
            <Button
              variant={isEditing ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              {isEditing ? "Viewing Document" : "Direct Correction"}
            </Button>
          )}
          <Badge
            variant="outline"
            className={`text-xs ${
              isTrashed
                ? "border-destructive text-destructive"
                : doc.status === "approved"
                  ? "border-emerald-500/40 text-emerald-500"
                  : "border-amber-500/40 text-amber-500"
            }`}
          >
            {isTrashed ? "Trashed" : doc.status || "Unreviewed"}
          </Badge>
        </div>
      </div>

      {saveError && (
        <Card className="p-3 border-destructive/50 bg-destructive/10 text-destructive text-sm">
          {saveError}
        </Card>
      )}

      {/* 1. IMMUTABLE SOURCE FACTS */}
      <Section title="1. Immutable Source Facts">
        <FieldGrid>
          <Field label="Document ID" value={doc.documentId} mono />
          <Field label="Drive File ID" value={doc.driveFileId} mono />
          <Field label="Original Filename" value={doc.originalFilename} />
          <Field label="Content Hash (SHA-256)" value={doc.contentHash} mono />
          <Field label="MIME Type" value={doc.mimeType} />
          <Field
            label="File Size"
            value={doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : "—"}
          />
          <Field label="Privacy Classification" value={doc.privacyClass || "standard"} />
          <Field label="Current Path" value={doc.currentPath || doc.proposedPath} mono />
        </FieldGrid>
      </Section>

      {/* 2. CANONICAL CLASSIFICATION & DIRECT CORRECTION */}
      <Section title="2. Canonical Classification & Semantics">
        {isEditing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Document Type</label>
                <Input
                  value={edits.document_type || ""}
                  onChange={(e) => setEdits({ ...edits, document_type: e.target.value })}
                  placeholder="invoice, contract, statement, etc."
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Document Family</label>
                <Input
                  value={edits.document_family || ""}
                  onChange={(e) => setEdits({ ...edits, document_family: e.target.value })}
                  placeholder="e.g. Finance, Legal, Operations"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Organisation / Issuer</label>
                <Input
                  value={edits.organization || ""}
                  onChange={(e) => setEdits({ ...edits, organization: e.target.value })}
                  placeholder="e.g. Deutsche Telekom"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Primary Domain</label>
                <Input
                  value={edits.primary_domain || ""}
                  onChange={(e) => setEdits({ ...edits, primary_domain: e.target.value })}
                  placeholder="e.g. Finance, RealEstate"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Document Date (YYYY-MM-DD)</label>
                <Input
                  value={edits.document_date || ""}
                  onChange={(e) => setEdits({ ...edits, document_date: e.target.value })}
                  placeholder="YYYY-MM-DD"
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Target PARA Folder Path</label>
                <Select
                  value={(edits.proposed_path || "04_Archive").split("/")[0]}
                  onValueChange={(root) => {
                    const sub = (edits.proposed_path || "").split("/").slice(1).join("/");
                    setEdits({
                      ...edits,
                      proposed_path: sub ? `${root}/${sub}` : root,
                    });
                  }}
                >
                  <SelectTrigger className="h-8 text-sm mb-1">
                    <SelectValue placeholder="PARA Root" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANONICAL_PARA_ROOTS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={edits.proposed_path || ""}
                  onChange={(e) => setEdits({ ...edits, proposed_path: e.target.value })}
                  placeholder="02_Areas/Finanzen/Telekom"
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Canonical Filename</label>
              <Input
                value={edits.canonical_filename || ""}
                onChange={(e) => setEdits({ ...edits, canonical_filename: e.target.value })}
                placeholder="2026-08-30_Invoice_Telekom.pdf"
                className="h-8 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Topics / Tags</label>
              <Input
                value={edits.topics || ""}
                onChange={(e) => setEdits({ ...edits, topics: e.target.value })}
                placeholder="DSL, Fiber, Monthly bill"
                className="h-8 text-sm"
              />
            </div>

            {/* Impact Consequence Preview (DMS-D1-0005 §13) */}
            <div className="p-3 bg-muted/40 rounded-lg border border-border/80 space-y-2 mt-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Consequence / Action Preview:</span>
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  {impact.actionType.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground font-mono">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Current Target</p>
                  <p className="truncate">File: {impact.currentFilename}</p>
                  <p className="truncate">Path: {impact.currentPath}</p>
                </div>
                <div>
                  <p className="text-[10px] text-primary uppercase">After Correction</p>
                  <p className="truncate text-foreground">File: {impact.targetFilename}</p>
                  <p className="truncate text-foreground">Path: {impact.targetPath}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={saving} onClick={onSaveCorrection} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save Correction"}
              </Button>
            </div>
          </div>
        ) : (
          <FieldGrid>
            <Field label="Document Type" value={doc.documentType} />
            <Field label="Document Family" value={doc.documentFamily} />
            <Field label="Organisation / Issuer" value={doc.organization} />
            <Field label="Primary Domain" value={doc.primaryDomain} />
            <Field label="Document Date" value={doc.documentDate} />
            <Field label="Date Source" value={doc.documentDateSource} />
            <Field label="Canonical Filename" value={doc.canonicalFilename} mono />
            <Field label="Target PARA Path" value={doc.proposedPath || doc.currentPath} mono />
            <Field label="Topics" value={doc.topics} />
            <Field
              label="Confidence"
              value={doc.confidence != null ? `${Math.round(doc.confidence * 100)}%` : "—"}
            />
          </FieldGrid>
        )}
      </Section>

      {/* 3. PROVENANCE & RELATIONS */}
      <Section title="3. Provenance & History">
        <div className="space-y-2 text-xs">
          {history.length > 0 ? (
            <div className="space-y-1">
              <p className="text-muted-foreground font-semibold">Approval Cycles:</p>
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-2 rounded bg-muted/20 border">
                  <span>{h.action_title}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {h.status}
                  </Badge>
                  <span className="font-mono text-muted-foreground">
                    {format(new Date(h.created_at), "PPp")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No prior approval cycles attached.</p>
          )}
        </div>
      </Section>

      {/* 4. MOVE TO TRASH ACTION (DMS-D1-0005 §13) */}
      {!isTrashed && (
        <Card className="p-4 border-destructive/20 bg-destructive/5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-destructive">Move to Trash</p>
            <p className="text-xs text-muted-foreground">
              Move this document from canonical inventory into reversible Trash.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setTrashOpen(true)}
            className="gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Move to Trash
          </Button>
        </Card>
      )}

      {/* CONFIRM TRASH DIALOG */}
      <Dialog open={trashOpen} onOpenChange={setTrashOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move Document to Trash?</DialogTitle>
            <DialogDescription>
              This will remove &ldquo;{doc.canonicalFilename || doc.originalFilename}&rdquo; from active Documents inventory.
              You can restore or review it at any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setTrashOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={trashing}
              onClick={onConfirmTrash}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {trashing ? "Moving…" : "Confirm Move to Trash"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/documents"
      className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Documents inventory
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </Card>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">{children}</div>;
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className={`font-medium ${mono ? "font-mono" : ""} break-words`}>{value ?? "—"}</p>
    </div>
  );
}
