// Document Review — the operational review queue.
//
// A full native page (not the ApprovalInbox Sheet) over the same canonical
// data: `approvals`, `clarification_cases`, and the `document_registry`
// dataset, composed by src/lib/reviewWorkbench.ts. No new table, no new
// status field, no duplicate conversation state — see that file's header for
// why grouping is necessary and what stays canonical.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ClipboardList,
  Search,
  Layers,
  X,
  Save,
  AlertCircle,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listClaim, UNKNOWN_COUNT } from "@/lib/listClaim";
import {
  fetchReviewQueue,
  computeReviewKpis,
  applyBulkProposalOverride,
  analyzeBulkFieldValues,
  CANONICAL_PARA_ROOTS,
  type ReviewQueueItem,
  type ReviewStatus,
  type BulkProposalOverridePatch,
} from "@/lib/reviewWorkbench";

export const Route = createFileRoute("/_authenticated/review")({
  component: ReviewQueuePage,
});

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "Pending",
  clarifying: "Clarifying",
  consensus: "Consensus reached",
  approved: "Approved",
  rejected: "Rejected",
  abandoned: "Needs attention",
};

const STATUS_BADGE: Record<ReviewStatus, string> = {
  pending: "border-amber-500/40 text-amber-500",
  clarifying: "border-sky-500/40 text-sky-500",
  consensus: "border-violet-500/40 text-violet-500",
  approved: "border-emerald-500/40 text-emerald-500",
  rejected: "border-muted-foreground/40 text-muted-foreground",
  abandoned: "border-red-500/40 text-red-500",
};

function fieldFromItem(item: ReviewQueueItem) {
  const proposal = (item.approval?.payload as { proposal?: Record<string, unknown> })?.proposal;
  const envelope = (item.approval?.payload as { envelope?: Record<string, unknown> })?.envelope;
  const registry = item.registryRow;
  const isMail =
    Boolean(item.documentId?.startsWith("mail:")) ||
    Boolean(envelope?.mail_id) ||
    Boolean(proposal?.mail_id) ||
    Boolean(item.approval?.action_type?.includes("mail"));

  const reg = registry as any;

  return {
    isMail,
    subjectKind: isMail ? "mail" : "document",
    itemKind: item.itemKind ?? "approval_item",
    manualReason: item.manualReason,
    filename:
      (reg?.canonical_filename as string) ??
      (reg?.canonical_eml_filename as string) ??
      (reg?.original_filename as string) ??
      (reg?.filename as string) ??
      (proposal?.source_filename as string) ??
      (proposal?.canonical_eml_filename as string) ??
      (proposal?.subject as string) ??
      item.approval?.action_title ??
      item.documentId ??
      "Document",
    documentType:
      (reg?.document_type as string) ?? (proposal?.document_type as string) ?? (isMail ? "Email" : null),
    documentFamily:
      (reg?.document_family as string) ?? (proposal?.document_family as string) ?? null,
    primaryDomain:
      (reg?.primary_domain as string) ?? (proposal?.primary_domain as string) ?? null,
    proposedPath:
      (reg?.proposed_path as string) ?? (proposal?.proposed_folder_path as string) ?? null,
    confidence: (reg?.confidence as number) ?? (proposal?.confidence as number) ?? null,
  };
}

function ReviewQueuePage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ReviewQueueItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "document" | "mail">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "confidence">("newest");

  // Multi-row selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Central Bulk Classification Dialog state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkForm, setBulkForm] = useState<{
    document_type: { apply: boolean; value: string };
    document_family: { apply: boolean; value: string };
    sender_or_issuer: { apply: boolean; value: string };
    primary_domain: { apply: boolean; value: string };
    document_date: { apply: boolean; value: string };
    proposed_folder_path: { apply: boolean; value: string };
    topics: { apply: boolean; mode: "add" | "remove" | "replace"; valuesString: string };
  }>({
    document_type: { apply: false, value: "" },
    document_family: { apply: false, value: "" },
    sender_or_issuer: { apply: false, value: "" },
    primary_domain: { apply: false, value: "" },
    document_date: { apply: false, value: "" },
    proposed_folder_path: { apply: false, value: "04_Archive" },
    topics: { apply: false, mode: "add", valuesString: "" },
  });

  const load = async (uid: string) => {
    const { items: loaded, error } = await fetchReviewQueue(supabase, uid);
    if (error) {
      setLoadError(error);
      setItems([]);
      return;
    }
    setLoadError(null);
    setItems(loaded);
  };

  useEffect(() => {
    if (!user) return;
    void load(user.id);
  }, [user]);

  const kpis = useMemo(() => computeReviewKpis(items ?? []), [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    let list = items.filter((item) => {
      if (statusFilter !== "all" && item.reviewStatus !== statusFilter) return false;
      const f = fieldFromItem(item);
      if (typeFilter !== "all" && f.subjectKind !== typeFilter) return false;
      if (!q) return true;
      return [f.filename, f.documentType, f.documentFamily, f.primaryDomain, f.proposedPath]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
    list = [...list].sort((a, b) => {
      if (sort === "confidence") {
        const ca = fieldFromItem(a).confidence ?? -1;
        const cb = fieldFromItem(b).confidence ?? -1;
        return cb - ca;
      }
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return sort === "oldest" ? ta - tb : tb - ta;
    });
    return list;
  }, [items, statusFilter, typeFilter, search, sort]);

  const selectedItems = useMemo(() => {
    if (!items) return [];
    return items.filter((i) => selectedIds.has(i.approvalId));
  }, [items, selectedIds]);

  const bulkAnalysis = useMemo(() => {
    return analyzeBulkFieldValues(selectedItems);
  }, [selectedItems]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((i) => selectedIds.has(i.approvalId));

  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedIds);
      for (const item of filtered) {
        next.delete(item.approvalId);
      }
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      for (const item of filtered) {
        next.add(item.approvalId);
      }
      setSelectedIds(next);
    }
  };

  const toggleItemSelection = (approvalId: string) => {
    const next = new Set(selectedIds);
    if (next.has(approvalId)) {
      next.delete(approvalId);
    } else {
      next.add(approvalId);
    }
    setSelectedIds(next);
  };

  const openBulkDialog = () => {
    setBulkError(null);
    setBulkSaving(false);
    setBulkForm({
      document_type: { apply: false, value: bulkAnalysis.document_type?.commonValue || "" },
      document_family: { apply: false, value: bulkAnalysis.document_family?.commonValue || "" },
      sender_or_issuer: { apply: false, value: bulkAnalysis.sender_or_issuer?.commonValue || "" },
      primary_domain: { apply: false, value: bulkAnalysis.primary_domain?.commonValue || "" },
      document_date: { apply: false, value: bulkAnalysis.document_date?.commonValue || "" },
      proposed_folder_path: {
        apply: false,
        value: bulkAnalysis.proposed_folder_path?.commonValue || "04_Archive",
      },
      topics: { apply: false, mode: "add", valuesString: "" },
    });
    setBulkDialogOpen(true);
  };

  const handleCopyFromReference = (refApprovalId: string) => {
    const ref = selectedItems.find((i) => i.approvalId === refApprovalId);
    if (!ref) return;
    const p = ((ref.approval.payload as any)?.proposal ?? {}) as Record<string, any>;
    setBulkForm({
      document_type: { apply: Boolean(p.document_type), value: p.document_type || "" },
      document_family: { apply: Boolean(p.document_family), value: p.document_family || "" },
      sender_or_issuer: { apply: Boolean(p.sender_or_issuer), value: p.sender_or_issuer || "" },
      primary_domain: { apply: Boolean(p.primary_domain), value: p.primary_domain || "" },
      document_date: { apply: Boolean(p.document_date), value: p.document_date || "" },
      proposed_folder_path: {
        apply: Boolean(p.proposed_folder_path),
        value: p.proposed_folder_path || "04_Archive",
      },
      topics: {
        apply: Array.isArray(p.topics) && p.topics.length > 0,
        mode: "replace",
        valuesString: Array.isArray(p.topics) ? p.topics.join(", ") : "",
      },
    });
  };

  const handleSaveBulk = async () => {
    if (!user) return;
    setBulkSaving(true);
    setBulkError(null);

    const patch: BulkProposalOverridePatch = {
      ...(bulkForm.document_type.apply
        ? { document_type: { apply: true, value: bulkForm.document_type.value } }
        : {}),
      ...(bulkForm.document_family.apply
        ? { document_family: { apply: true, value: bulkForm.document_family.value } }
        : {}),
      ...(bulkForm.sender_or_issuer.apply
        ? { sender_or_issuer: { apply: true, value: bulkForm.sender_or_issuer.value } }
        : {}),
      ...(bulkForm.primary_domain.apply
        ? { primary_domain: { apply: true, value: bulkForm.primary_domain.value } }
        : {}),
      ...(bulkForm.document_date.apply
        ? { document_date: { apply: true, value: bulkForm.document_date.value } }
        : {}),
      ...(bulkForm.proposed_folder_path.apply
        ? { proposed_folder_path: { apply: true, value: bulkForm.proposed_folder_path.value } }
        : {}),
      ...(bulkForm.topics.apply
        ? {
            topics: {
              apply: true,
              mode: bulkForm.topics.mode,
              values: bulkForm.topics.valuesString
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            },
          }
        : {}),
    };

    const res = await applyBulkProposalOverride(
      supabase,
      user.id,
      Array.from(selectedIds),
      patch,
    );

    setBulkSaving(false);

    if (!res.ok) {
      setBulkError(res.error || "Bulk update failed");
      return;
    }

    setBulkDialogOpen(false);
    setSelectedIds(new Set());
    await load(user.id);
  };

  const claim = listClaim({
    loaded: items !== null,
    error: loadError,
    count: items?.length ?? 0,
  });

  if (authLoading || !items) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Intake & Filing
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Review Workbench</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {claim.message === "error" ? UNKNOWN_COUNT : items.length} item
          {items.length === 1 ? "" : "s"} in the last 60 days · click a row for the full review
        </p>
      </div>

      {/* KPI header — derived counts only, nothing persisted here. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard label="Pending" value={kpis.pending} />
        <KpiCard label="Clarifying" value={kpis.clarifying} />
        <KpiCard label="Approved today" value={kpis.approvedToday} />
        <KpiCard label="Needs attention" value={kpis.needsAttention} tone="warn" />
      </div>

      {/* Selection Action Bar (when rows are selected) */}
      {selectedIds.size > 0 && (
        <Card className="p-3 bg-primary/5 border-primary/20 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs">
              {selectedIds.size} selected
            </Badge>
            {filtered.length > selectedIds.size && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
                onClick={toggleSelectAllFiltered}
              >
                Select all {filtered.length} filtered items
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-3.5 w-3.5" /> Clear selection
            </Button>
            <Button
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={openBulkDialog}
            >
              <Layers className="h-3.5 w-3.5" /> Edit Classification
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-3 flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search filename, domain, type…"
            className="pl-8 h-8 text-sm"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-36 h-8 text-sm">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="mail">Emails</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-44 h-8 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {(Object.keys(STATUS_LABEL) as ReviewStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
          <SelectTrigger className="w-full sm:w-40 h-8 text-sm">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="confidence">Confidence</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={toggleSelectAllFiltered}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Item / Source</TableHead>
              <TableHead className="hidden md:table-cell">Type / Family</TableHead>
              <TableHead className="hidden lg:table-cell">Domain</TableHead>
              <TableHead className="hidden lg:table-cell">Proposed path</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Confidence</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="hidden sm:table-cell text-right">Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claim.message === "error" && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm" role="alert">
                  <span className="text-warning">
                    The review queue could not be loaded — {loadError}.
                  </span>
                </TableCell>
              </TableRow>
            )}
            {claim.message === "empty" && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  Nothing to review. Items needing a decision will appear here.
                </TableCell>
              </TableRow>
            )}
            {claim.message !== "error" && claim.message !== "empty" && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                  No items match this filter.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((item) => {
              const f = fieldFromItem(item);
              const isSelected = selectedIds.has(item.approvalId);
              return (
                <TableRow
                  key={item.approvalId}
                  className={`hover:bg-muted/40 ${isSelected ? "bg-primary/5" : ""}`}
                >
                  <TableCell className="text-center p-2">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleItemSelection(item.approvalId)}
                      aria-label={`Select ${f.filename}`}
                    />
                  </TableCell>
                  <TableCell className="p-0 max-w-[16rem]">
                    <Link
                      to="/review/$approvalId"
                      params={{ approvalId: item.approvalId }}
                      className="block p-2"
                    >
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {f.isMail ? "Mail" : "Doc"}
                        </Badge>
                        {f.itemKind === "manual_document_item" && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 border-amber-500/30 text-amber-500">
                            Manual{f.manualReason ? ` · ${f.manualReason}` : ""}
                          </Badge>
                        )}
                        <p className="text-sm font-medium truncate">{f.filename}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate md:hidden">
                        {f.documentType ?? "—"}
                        {f.documentFamily ? ` · ${f.documentFamily}` : ""}
                      </p>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell p-0 text-xs">
                    <Link
                      to="/review/$approvalId"
                      params={{ approvalId: item.approvalId }}
                      className="block p-2"
                    >
                      {f.documentType ?? "—"}
                      {f.documentFamily ? (
                        <span className="text-muted-foreground"> · {f.documentFamily}</span>
                      ) : null}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell p-0 text-xs">
                    <Link
                      to="/review/$approvalId"
                      params={{ approvalId: item.approvalId }}
                      className="block p-2 truncate max-w-[14rem]"
                    >
                      {f.primaryDomain ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell p-0 text-xs font-mono text-muted-foreground">
                    <Link
                      to="/review/$approvalId"
                      params={{ approvalId: item.approvalId }}
                      className="block p-2 truncate max-w-[16rem]"
                    >
                      {f.proposedPath ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell p-0 text-right text-xs font-mono">
                    <Link
                      to="/review/$approvalId"
                      params={{ approvalId: item.approvalId }}
                      className="block p-2"
                    >
                      {f.confidence != null ? `${Math.round(f.confidence * 100)}%` : "—"}
                    </Link>
                  </TableCell>
                  <TableCell className="p-0 text-center">
                    <Link
                      to="/review/$approvalId"
                      params={{ approvalId: item.approvalId }}
                      className="block p-2"
                    >
                      <Badge variant="outline" className={STATUS_BADGE[item.reviewStatus]}>
                        {STATUS_LABEL[item.reviewStatus]}
                      </Badge>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell p-0 text-right text-xs font-mono text-muted-foreground">
                    <Link
                      to="/review/$approvalId"
                      params={{ approvalId: item.approvalId }}
                      className="block p-2"
                    >
                      {format(new Date(item.createdAt), "MMM dd")}
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Central Bulk Classification Dialog (DMS-D1-0003-REVIEW-v2 §14) */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Bulk Classification ({selectedIds.size} items)
            </DialogTitle>
            <DialogDescription>
              Edit classification fields across all selected proposals. Fields set to 'Not applied'
              remain untouched.
            </DialogDescription>
          </DialogHeader>

          {bulkError && (
            <Card className="p-3 border-red-500/40 bg-red-500/10 text-red-500 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{bulkError}</span>
            </Card>
          )}

          {/* Reference item selector */}
          <div className="p-2.5 bg-muted/40 rounded border space-y-1.5">
            <p className="text-xs font-medium">Take values from reference item</p>
            <Select onValueChange={handleCopyFromReference}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Choose a reference item to populate fields…" />
              </SelectTrigger>
              <SelectContent>
                {selectedItems.map((it) => (
                  <SelectItem key={it.approvalId} value={it.approvalId}>
                    {fieldFromItem(it).filename}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2">
            {/* Document Type */}
            <BulkFieldRow
              label="Document Type"
              isMixed={bulkAnalysis.document_type?.isMixed}
              uniqueCount={bulkAnalysis.document_type?.uniqueValues.length}
              applied={bulkForm.document_type.apply}
              onToggleApply={(apply) =>
                setBulkForm({
                  ...bulkForm,
                  document_type: { ...bulkForm.document_type, apply },
                })
              }
            >
              <Input
                disabled={!bulkForm.document_type.apply}
                value={bulkForm.document_type.value}
                onChange={(e) =>
                  setBulkForm({
                    ...bulkForm,
                    document_type: { ...bulkForm.document_type, value: e.target.value },
                  })
                }
                placeholder="invoice, contract, receipt, etc."
                className="h-8 text-xs"
              />
            </BulkFieldRow>

            {/* Document Family */}
            <BulkFieldRow
              label="Document Family"
              isMixed={bulkAnalysis.document_family?.isMixed}
              uniqueCount={bulkAnalysis.document_family?.uniqueValues.length}
              applied={bulkForm.document_family.apply}
              onToggleApply={(apply) =>
                setBulkForm({
                  ...bulkForm,
                  document_family: { ...bulkForm.document_family, apply },
                })
              }
            >
              <Input
                disabled={!bulkForm.document_family.apply}
                value={bulkForm.document_family.value}
                onChange={(e) =>
                  setBulkForm({
                    ...bulkForm,
                    document_family: { ...bulkForm.document_family, value: e.target.value },
                  })
                }
                placeholder="Legal, Finance, Operations, etc."
                className="h-8 text-xs"
              />
            </BulkFieldRow>

            {/* Organisation / Issuer */}
            <BulkFieldRow
              label="Organisation / Issuer"
              isMixed={bulkAnalysis.sender_or_issuer?.isMixed}
              uniqueCount={bulkAnalysis.sender_or_issuer?.uniqueValues.length}
              applied={bulkForm.sender_or_issuer.apply}
              onToggleApply={(apply) =>
                setBulkForm({
                  ...bulkForm,
                  sender_or_issuer: { ...bulkForm.sender_or_issuer, apply },
                })
              }
            >
              <Input
                disabled={!bulkForm.sender_or_issuer.apply}
                value={bulkForm.sender_or_issuer.value}
                onChange={(e) =>
                  setBulkForm({
                    ...bulkForm,
                    sender_or_issuer: { ...bulkForm.sender_or_issuer, value: e.target.value },
                  })
                }
                placeholder="e.g. Deutsche Telekom, Stadtwerke"
                className="h-8 text-xs"
              />
            </BulkFieldRow>

            {/* Primary Domain */}
            <BulkFieldRow
              label="Primary Domain"
              isMixed={bulkAnalysis.primary_domain?.isMixed}
              uniqueCount={bulkAnalysis.primary_domain?.uniqueValues.length}
              applied={bulkForm.primary_domain.apply}
              onToggleApply={(apply) =>
                setBulkForm({
                  ...bulkForm,
                  primary_domain: { ...bulkForm.primary_domain, apply },
                })
              }
            >
              <Input
                disabled={!bulkForm.primary_domain.apply}
                value={bulkForm.primary_domain.value}
                onChange={(e) =>
                  setBulkForm({
                    ...bulkForm,
                    primary_domain: { ...bulkForm.primary_domain, value: e.target.value },
                  })
                }
                placeholder="Finance, RealEstate, Infrastructure"
                className="h-8 text-xs"
              />
            </BulkFieldRow>

            {/* Document Date */}
            <BulkFieldRow
              label="Document Date (YYYY-MM-DD)"
              isMixed={bulkAnalysis.document_date?.isMixed}
              uniqueCount={bulkAnalysis.document_date?.uniqueValues.length}
              applied={bulkForm.document_date.apply}
              onToggleApply={(apply) =>
                setBulkForm({
                  ...bulkForm,
                  document_date: { ...bulkForm.document_date, apply },
                })
              }
            >
              <Input
                disabled={!bulkForm.document_date.apply}
                value={bulkForm.document_date.value}
                onChange={(e) =>
                  setBulkForm({
                    ...bulkForm,
                    document_date: { ...bulkForm.document_date, value: e.target.value },
                  })
                }
                placeholder="YYYY-MM-DD"
                className="h-8 text-xs font-mono"
              />
            </BulkFieldRow>

            {/* Proposed PARA Target Folder */}
            <BulkFieldRow
              label="PARA Target Folder"
              isMixed={bulkAnalysis.proposed_folder_path?.isMixed}
              uniqueCount={bulkAnalysis.proposed_folder_path?.uniqueValues.length}
              applied={bulkForm.proposed_folder_path.apply}
              onToggleApply={(apply) =>
                setBulkForm({
                  ...bulkForm,
                  proposed_folder_path: { ...bulkForm.proposed_folder_path, apply },
                })
              }
            >
              <div className="space-y-1.5">
                <Select
                  disabled={!bulkForm.proposed_folder_path.apply}
                  value={bulkForm.proposed_folder_path.value.split("/")[0]}
                  onValueChange={(root) => {
                    const sub = bulkForm.proposed_folder_path.value.split("/").slice(1).join("/");
                    setBulkForm({
                      ...bulkForm,
                      proposed_folder_path: {
                        ...bulkForm.proposed_folder_path,
                        value: sub ? `${root}/${sub}` : root,
                      },
                    });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
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
                  disabled={!bulkForm.proposed_folder_path.apply}
                  value={bulkForm.proposed_folder_path.value}
                  onChange={(e) =>
                    setBulkForm({
                      ...bulkForm,
                      proposed_folder_path: {
                        ...bulkForm.proposed_folder_path,
                        value: e.target.value,
                      },
                    })
                  }
                  placeholder="02_Areas/Finanzen/Telekommunikation"
                  className="h-8 text-xs font-mono"
                />
              </div>
            </BulkFieldRow>

            {/* Topics */}
            <BulkFieldRow
              label="Topics"
              isMixed={bulkAnalysis.topics?.isMixed}
              uniqueCount={bulkAnalysis.topics?.uniqueValues.length}
              applied={bulkForm.topics.apply}
              onToggleApply={(apply) =>
                setBulkForm({
                  ...bulkForm,
                  topics: { ...bulkForm.topics, apply },
                })
              }
            >
              <div className="space-y-1.5">
                <Select
                  disabled={!bulkForm.topics.apply}
                  value={bulkForm.topics.mode}
                  onValueChange={(mode: "add" | "remove" | "replace") =>
                    setBulkForm({
                      ...bulkForm,
                      topics: { ...bulkForm.topics, mode },
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">Add topics to existing</SelectItem>
                    <SelectItem value="remove">Remove topics from existing</SelectItem>
                    <SelectItem value="replace">Replace all topics</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  disabled={!bulkForm.topics.apply}
                  value={bulkForm.topics.valuesString}
                  onChange={(e) =>
                    setBulkForm({
                      ...bulkForm,
                      topics: { ...bulkForm.topics, valuesString: e.target.value },
                    })
                  }
                  placeholder="telecom, billing, monthly (comma-separated)"
                  className="h-8 text-xs"
                />
              </div>
            </BulkFieldRow>
          </div>

          <DialogFooter className="mt-4 pt-3 border-t flex flex-row justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              disabled={bulkSaving}
              onClick={() => setBulkDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={bulkSaving || selectedIds.size === 0}
              onClick={handleSaveBulk}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              {bulkSaving ? "Applying…" : `Apply to ${selectedIds.size} items`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BulkFieldRow({
  label,
  isMixed,
  uniqueCount,
  applied,
  onToggleApply,
  children,
}: {
  label: string;
  isMixed?: boolean;
  uniqueCount?: number;
  applied: boolean;
  onToggleApply: (apply: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`p-2.5 rounded border transition-colors ${
        applied ? "bg-card border-primary/40" : "bg-muted/20 border-border/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium">
          <Checkbox
            checked={applied}
            onCheckedChange={(checked) => onToggleApply(Boolean(checked))}
          />
          <span>{label}</span>
        </label>
        {!applied && isMixed && (
          <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/40">
            Mixed ({uniqueCount} values)
          </Badge>
        )}
        {!applied && !isMixed && (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Not applied
          </Badge>
        )}
        {applied && (
          <Badge variant="default" className="text-[10px] bg-primary">
            Will apply
          </Badge>
        )}
      </div>
      <div className={applied ? "opacity-100" : "opacity-40 pointer-events-none"}>
        {children}
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`text-2xl font-semibold tabular-nums ${
          tone === "warn" && value > 0 ? "text-red-500" : ""
        }`}
      >
        {value}
      </p>
    </Card>
  );
}
