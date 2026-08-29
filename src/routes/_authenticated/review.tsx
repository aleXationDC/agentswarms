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
import { ClipboardList, Search } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
  type ReviewQueueItem,
  type ReviewStatus,
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
  const proposal = (item.approval.payload as { proposal?: Record<string, unknown> })?.proposal;
  const registry = item.registryRow;
  return {
    filename:
      (registry?.canonical_filename as string) ??
      (registry?.original_filename as string) ??
      (proposal?.source_filename as string) ??
      (proposal?.subject as string) ??
      item.approval.action_title,
    documentType:
      (registry?.document_type as string) ?? (proposal?.document_type as string) ?? null,
    documentFamily:
      (registry?.document_family as string) ?? (proposal?.document_family as string) ?? null,
    primaryDomain:
      (registry?.primary_domain as string) ?? (proposal?.primary_domain as string) ?? null,
    proposedPath:
      (registry?.proposed_path as string) ?? (proposal?.proposed_folder_path as string) ?? null,
    confidence: (registry?.confidence as number) ?? (proposal?.confidence as number) ?? null,
  };
}

function ReviewQueuePage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<ReviewQueueItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "confidence">("newest");

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    void (async () => {
      const { items: loaded, error } = await fetchReviewQueue(supabase, user.id);
      if (!mounted) return;
      if (error) {
        setLoadError(error);
        setItems([]);
        return;
      }
      setLoadError(null);
      setItems(loaded);
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const kpis = useMemo(() => computeReviewKpis(items ?? []), [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase();
    let list = items.filter((item) => {
      if (statusFilter !== "all" && item.reviewStatus !== statusFilter) return false;
      if (!q) return true;
      const f = fieldFromItem(item);
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
  }, [items, statusFilter, search, sort]);

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
          Document Intake
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Review</h1>
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
              <TableHead>Document</TableHead>
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
                <TableCell colSpan={7} className="py-8 text-center text-sm" role="alert">
                  <span className="text-warning">
                    The review queue could not be loaded — {loadError}.
                  </span>
                </TableCell>
              </TableRow>
            )}
            {claim.message === "empty" && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  <ClipboardList className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  Nothing to review. Documents needing a decision will appear here.
                </TableCell>
              </TableRow>
            )}
            {claim.message !== "error" && claim.message !== "empty" && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                  No items match this filter.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((item) => {
              const f = fieldFromItem(item);
              return (
                <TableRow key={item.approvalId} className="hover:bg-muted/40">
                  <TableCell className="p-0 max-w-[16rem]">
                    <Link
                      to="/review/$approvalId"
                      params={{ approvalId: item.approvalId }}
                      className="block p-2"
                    >
                      <p className="text-sm font-medium truncate">{f.filename}</p>
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
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={`text-2xl font-semibold tabular-nums ${tone === "warn" && value > 0 ? "text-red-500" : ""}`}
      >
        {value}
      </p>
    </Card>
  );
}
