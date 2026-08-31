// Documents — canonical lifetime inventory and workbench.
//
// A full native page over the canonical `document_registry` dataset.
// No 60-day Review horizon, server/client query over native dataset store.
//
// DMS-D1-0005-DOCUMENTS-v2 §10 - §14
import { useEffect, useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  FileText,
  Search,
  ExternalLink,
  Filter,
  ArrowUpDown,
  Layers,
  ChevronRight,
  Shield,
  FolderTree,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  fetchDocumentsInventory,
  type DocumentListItem,
  type DocumentFilterOptions,
} from "@/lib/documentsWorkbench";
import { CANONICAL_PARA_ROOTS } from "@/lib/reviewWorkbench";
import { DocumentsAnalyst } from "@/components/documents/DocumentsAnalyst";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
});

function DocumentsPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<DocumentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Search states
  const [search, setSearch] = useState("");
  const [documentType, setDocumentType] = useState<string>("all");
  const [primaryDomain, setPrimaryDomain] = useState<string>("all");
  const [paraClass, setParaClass] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<DocumentFilterOptions["sortBy"]>("document_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const load = async (uid: string) => {
    setLoading(true);
    const filters: DocumentFilterOptions = {
      search: search || undefined,
      documentType: documentType !== "all" ? documentType : undefined,
      primaryDomain: primaryDomain !== "all" ? primaryDomain : undefined,
      paraClass: paraClass !== "all" ? paraClass : undefined,
      status: status !== "all" ? status : undefined,
      sortBy,
      sortOrder,
    };
    const { items: loaded, error: loadErr } = await fetchDocumentsInventory(supabase, uid, filters);
    setError(loadErr || null);
    setItems(loaded);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    void load(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, search, documentType, primaryDomain, paraClass, status, sortBy, sortOrder]);

  // Distinct filter values
  const availableTypes = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.documentType) set.add(it.documentType);
    }
    return Array.from(set).sort();
  }, [items]);

  const availableDomains = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) {
      if (it.primaryDomain) set.add(it.primaryDomain);
    }
    return Array.from(set).sort();
  }, [items]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Lifetime Inventory
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Canonical archive inventory backed by Google Drive authoritative bytes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {items.length} document{items.length === 1 ? "" : "s"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => user && void load(user.id)}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Embedded AI Analyst (DMS-D1-0005 §14) */}
      <DocumentsAnalyst />

      {/* Search & Filter Toolbar */}
      <Card className="p-3.5 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename, issuer, domain, topics…"
              className="pl-8 h-8 text-xs"
            />
          </div>

          {/* Type Filter */}
          <Select value={documentType} onValueChange={setDocumentType}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {availableTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Domain Filter */}
          <Select value={primaryDomain} onValueChange={setPrimaryDomain}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="All Domains" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              {availableDomains.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* PARA Root Filter */}
          <Select value={paraClass} onValueChange={setParaClass}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="All PARA Roots" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All PARA</SelectItem>
              {CANONICAL_PARA_ROOTS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-8 text-xs w-32">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="clarifying">Clarifying</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort Selector */}
          <Select
            value={`${sortBy}_${sortOrder}`}
            onValueChange={(val) => {
              const [sb, so] = val.split("_") as [DocumentFilterOptions["sortBy"], "asc" | "desc"];
              setSortBy(sb);
              setSortOrder(so);
            }}
          >
            <SelectTrigger className="h-8 text-xs w-40">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="document_date_desc">Date (Newest)</SelectItem>
              <SelectItem value="document_date_asc">Date (Oldest)</SelectItem>
              <SelectItem value="canonical_filename_asc">Name (A-Z)</SelectItem>
              <SelectItem value="canonical_filename_desc">Name (Z-A)</SelectItem>
              <SelectItem value="organization_asc">Organization (A-Z)</SelectItem>
              <SelectItem value="ingested_at_desc">Ingested (Recent)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Documents Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">
            Failed to load documents: {error}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium text-foreground">No documents found</p>
            <p className="text-xs text-muted-foreground mt-1">
              Documents will appear here after being ingested and classified.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="text-xs font-semibold">
                <TableHead>Filename</TableHead>
                <TableHead>Type / Family</TableHead>
                <TableHead>Organisation / Issuer</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>PARA Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.documentId} className="text-xs">
                  <TableCell className="font-medium max-w-[280px]">
                    <Link
                      to={`/documents/${encodeURIComponent(item.documentId)}` as any}
                      className="hover:text-primary transition-colors block truncate"
                      title={item.canonicalFilename || item.originalFilename || item.documentId}
                    >
                      {item.canonicalFilename || item.originalFilename || item.documentId}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.documentType || "—"}
                    {item.documentFamily ? ` (${item.documentFamily})` : ""}
                  </TableCell>
                  <TableCell>{item.organization || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{item.primaryDomain || "—"}</TableCell>
                  <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                    {item.documentDate || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-muted-foreground max-w-[200px] truncate" title={item.proposedPath || item.currentPath || "—"}>
                    {item.proposedPath || item.currentPath || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        item.status === "approved"
                          ? "border-emerald-500/40 text-emerald-500"
                          : item.status === "rejected"
                            ? "border-muted-foreground/40 text-muted-foreground"
                            : "border-amber-500/40 text-amber-500"
                      }`}
                    >
                      {item.status || "unreviewed"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {item.driveUrl && (
                        <a
                          href={item.driveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline px-2 py-1 rounded hover:bg-muted"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <Link
                        to={`/documents/${encodeURIComponent(item.documentId)}` as any}
                        className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
                      >
                        Details <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
