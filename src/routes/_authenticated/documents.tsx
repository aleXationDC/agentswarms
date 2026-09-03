import { Link, createFileRoute } from "@tanstack/react-router";
import { ExternalLink, FileText, Pencil, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  filterAndSortWorkbenchDocuments,
  listWorkbenchDocuments,
  type WorkbenchDocument,
} from "@/axtn/workbenches/documents/documentsWorkbench";
import { visibleSelectionIds } from "@/axtn/workbenches/shared/metadataEdit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { MetadataEditDialog } from "@/components/axtn/MetadataEditDialog";
import { useServerFn } from "@tanstack/react-start";
import { saveAxtnWorkbenchMetadata } from "@/utils/axtnWorkbenchEdits.functions";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "aXtn Documents — AgentSwarms" }] }),
  component: DocumentsPage,
});

const display = (value: string | number | null) => value ?? "—";
const options = (values: Array<string | null>) =>
  Array.from(new Set(values.filter((value): value is string => !!value))).sort();

function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<WorkbenchDocument[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [domain, setDomain] = useState("");
  const [para, setPara] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"document-date" | "name" | "organization" | "updated">(
    "document-date",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [reload, setReload] = useState(0);
  const saveMetadata = useServerFn(saveAxtnWorkbenchMetadata);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void listWorkbenchDocuments(supabase, user.id)
      .then((items) => !cancelled && setDocuments(items))
      .catch((cause: unknown) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Could not load documents.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, reload]);

  const visible = useMemo(
    () =>
      filterAndSortWorkbenchDocuments(documents, {
        search,
        documentType: type || undefined,
        primaryDomain: domain || undefined,
        paraClass: para || undefined,
        status: status || undefined,
        sort,
      }),
    [documents, domain, para, search, sort, status, type],
  );
  const selectedRecords = documents
    .filter((document) => selected.includes(document.rowId))
    .map((document) => document.metadata);

  useEffect(() => {
    setSelected((current) =>
      visibleSelectionIds(
        current,
        visible.map((document) => document.rowId),
      ),
    );
  }, [visible]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Operations
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">aXtn Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inventory and inspect declared document metadata.
        </p>
      </div>
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
          <div className="relative md:col-span-2 xl:col-span-2">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search filename, issuer, domain, topics..."
              value={search}
            />
          </div>
          <Filter
            label="Type"
            onChange={setType}
            value={type}
            values={options(documents.map((item) => item.documentType))}
          />
          <Filter
            label="Domain"
            onChange={setDomain}
            value={domain}
            values={options(documents.map((item) => item.primaryDomain))}
          />
          <Filter
            label="PARA"
            onChange={setPara}
            value={para}
            values={options(documents.map((item) => item.paraClass))}
          />
          <Filter
            label="Status"
            onChange={setStatus}
            value={status}
            values={options(documents.map((item) => item.status))}
          />
          <select
            aria-label="Document sort order"
            className="rounded-md border bg-background px-3 text-sm"
            onChange={(event) => setSort(event.target.value as typeof sort)}
            value={sort}
          >
            <option value="document-date">Document date</option>
            <option value="updated">Last modified</option>
            <option value="name">Filename</option>
            <option value="organization">Organisation</option>
          </select>
          <Button
            disabled={selected.length === 0}
            onClick={() => setEditing(true)}
            variant="outline"
          >
            <Pencil className="mr-1 h-4 w-4" /> Bulk Edit ({selected.length})
          </Button>
          <Button
            disabled={visible.length === 0}
            onClick={() => setSelected(visible.map((item) => item.rowId))}
            variant="ghost"
          >
            Select all filtered
          </Button>
          <Button disabled={selected.length === 0} onClick={() => setSelected([])} variant="ghost">
            Clear selection
          </Button>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Document inventory</CardTitle>
          <CardDescription>
            {visible.length} document{visible.length === 1 ? "" : "s"} available
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading documents...</p>
          ) : visible.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium">No documents available</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No registered documents are present in the document registry yet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <span className="sr-only">Select</span>
                  </TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead>Type / Family</TableHead>
                  <TableHead>Organisation / Issuer</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Document date</TableHead>
                  <TableHead>PARA location</TableHead>
                  <TableHead>Registration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead className="text-right">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>
                      <input
                        aria-label={`Select ${document.displayName}`}
                        checked={selected.includes(document.rowId)}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(document.rowId)
                              ? current.filter((id) => id !== document.rowId)
                              : [...current, document.rowId],
                          )
                        }
                        type="checkbox"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        className="hover:underline"
                        params={{ documentId: document.id }}
                        to="/documents/$documentId"
                      >
                        <span
                          className={document.filenameUnavailable ? "text-muted-foreground" : ""}
                        >
                          {document.displayName}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {display(document.documentType)}{" "}
                      <span className="text-muted-foreground">
                        / {display(document.documentFamily)}
                      </span>
                    </TableCell>
                    <TableCell>{display(document.organization)}</TableCell>
                    <TableCell>{display(document.primaryDomain)}</TableCell>
                    <TableCell>{display(document.documentDate)}</TableCell>
                    <TableCell
                      className="max-w-48 truncate"
                      title={document.proposedPath ?? document.currentPath ?? undefined}
                    >
                      {display(document.proposedPath ?? document.currentPath)}
                    </TableCell>
                    <TableCell>
                      {document.processingStatus ? (
                        <Badge variant="outline">{document.processingStatus}</Badge>
                      ) : (
                        "—"
                      )}
                      {document.privacyClass && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {document.privacyClass}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {document.status ? <Badge variant="outline">{document.status}</Badge> : "—"}
                    </TableCell>
                    <TableCell>
                      {document.confidence === null
                        ? "—"
                        : `${Math.round(document.confidence * 100)}%`}
                    </TableCell>
                    <TableCell className="text-right">
                      {document.sourceUrl && (
                        <Button asChild size="sm" variant="ghost">
                          <a href={document.sourceUrl} rel="noreferrer" target="_blank">
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only">
                              {document.sourceType === "google_drive"
                                ? "Open in Drive"
                                : "Open source"}
                            </span>
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <MetadataEditDialog
        count={selected.length}
        onOpenChange={setEditing}
        onSave={async (edits) => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) throw new Error("Not signed in.");
          const result = await saveMetadata({
            data: { access_token: session.access_token, kind: "document", ids: selected, edits },
          });
          if (result.failed.length)
            setError(`${result.failed.length} item(s) could not be updated.`);
          if (result.updated.length) setReload((current) => current + 1);
          setSelected([]);
          setEditing(false);
        }}
        open={editing}
        records={selectedRecords}
      />
    </div>
  );
}

function Filter({
  label,
  onChange,
  value,
  values,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
  values: string[];
}) {
  return (
    <select
      aria-label={`Document ${label}`}
      className="rounded-md border bg-background px-3 text-sm"
      disabled={values.length === 0}
      onChange={(event) => onChange(event.target.value)}
      value={value}
    >
      <option value="">All {label.toLowerCase()}s</option>
      {values.map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  );
}
