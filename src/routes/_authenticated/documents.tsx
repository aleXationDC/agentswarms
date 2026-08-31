import { Link, createFileRoute } from "@tanstack/react-router";
import { ExternalLink, FileText, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  listWorkbenchDocuments,
  type WorkbenchDocument,
} from "@/axtn/workbenches/documents/documentsWorkbench";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "aXtn Documents — AgentSwarms" }] }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<WorkbenchDocument[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState<"name" | "updated">("updated");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void listWorkbenchDocuments(supabase, user.id)
      .then((items) => {
        if (!cancelled) setDocuments(items);
      })
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Could not load documents.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const visibleDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = documents.filter(
      (document) =>
        [document.name, document.type, ...Object.values(document.metadata)]
          .filter((value): value is string => typeof value === "string")
          .join(" ")
          .toLowerCase()
          .includes(query) &&
        (type === "all" || document.type === type),
    );
    return result.sort((left, right) => {
      if (sort === "name") return left.name.localeCompare(right.name);
      return (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "");
    });
  }, [documents, search, sort, type]);
  const types = Array.from(
    new Set(documents.map((document) => document.type).filter((value): value is string => !!value)),
  ).sort();

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Operations
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">aXtn Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A reusable inventory surface for the declared document dataset. Document intake is not
          part of this workbench.
        </p>
      </div>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-64 flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search documents"
                value={search}
              />
            </div>
            <select
              aria-label="Document type"
              className="rounded-md border bg-background px-3 text-sm"
              onChange={(event) => setType(event.target.value)}
              value={type}
            >
              <option value="all">All types</option>
              {types.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              aria-label="Document sort order"
              className="rounded-md border bg-background px-3 text-sm"
              onChange={(event) => setSort(event.target.value as "name" | "updated")}
              value={sort}
            >
              <option value="updated">Last updated</option>
              <option value="name">Name</option>
            </select>
          </div>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Document inventory</CardTitle>
          <CardDescription>
            {visibleDocuments.length} document{visibleDocuments.length === 1 ? "" : "s"} available
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading documents...</p>
          ) : visibleDocuments.length === 0 ? (
            <div className="py-10 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium">No documents available</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The Greenfield document dataset is currently empty.
              </p>
            </div>
          ) : (
            visibleDocuments.map((document) => (
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                key={document.id}
              >
                <div>
                  <Link
                    className="font-medium hover:underline"
                    params={{ documentId: document.id }}
                    to="/documents/$documentId"
                  >
                    {document.name}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {document.type ?? "Unclassified"}
                    {document.updatedAt
                      ? ` · ${new Date(document.updatedAt).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                {document.sourceUrl && (
                  <Button asChild size="sm" variant="outline">
                    <a href={document.sourceUrl} rel="noreferrer" target="_blank">
                      Source <ExternalLink className="ml-1 h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
