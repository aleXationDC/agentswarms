import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { useEffect, useState } from "react";

import {
  listWorkbenchDocuments,
  type WorkbenchDocument,
} from "@/axtn/workbenches/documents/documentsWorkbench";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { MetadataEditDialog } from "@/components/axtn/MetadataEditDialog";
import { CaseRelationsPanel } from "@/components/axtn/CaseRelationsPanel";
import { useServerFn } from "@tanstack/react-start";
import { saveAxtnWorkbenchMetadata } from "@/utils/axtnWorkbenchEdits.functions";

export const Route = createFileRoute("/_authenticated/documents_/$documentId")({
  component: DocumentDetailPage,
});

const value = (entry: string | number | null) => entry ?? "—";

function DocumentDetailPage() {
  const { documentId } = Route.useParams();
  const { user } = useAuth();
  const [document, setDocument] = useState<WorkbenchDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [reload, setReload] = useState(0);
  const saveMetadata = useServerFn(saveAxtnWorkbenchMetadata);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void listWorkbenchDocuments(supabase, user.id)
      .then(
        (documents) =>
          !cancelled && setDocument(documents.find((item) => item.id === documentId) ?? null),
      )
      .catch(
        (cause: unknown) =>
          !cancelled &&
          setError(cause instanceof Error ? cause.message : "Could not load document."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [documentId, reload, user]);

  return (
    <div className="space-y-6 p-6">
      <Link
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        to="/documents"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to aXtn Documents
      </Link>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading document...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !document ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This document is not present in the document registry.
          </CardContent>
        </Card>
      ) : (
        <div className="max-w-5xl space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Document</p>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                {document.displayName}
              </h1>
            </div>
            {document.sourceUrl && (
              <Button asChild variant="outline">
                <a href={document.sourceUrl} rel="noreferrer" target="_blank">
                  {document.sourceType === "google_drive" ? "Open in Drive" : "Open source"}
                  <ExternalLink className="ml-1 h-4 w-4" />
                </a>
              </Button>
            )}
            <Button onClick={() => setEditing(true)} variant="outline">
              <Pencil className="mr-1 h-4 w-4" /> Edit metadata / Human Correction
            </Button>
          </div>
          <Section
            title="Document"
            fields={[
              ["Filename", document.filename],
              ["Canonical filename", document.canonicalFilename],
              ["Original filename", document.originalFilename],
              ["Type", document.documentType],
              ["Family", document.documentFamily],
              ["Organisation / Issuer", document.organization],
              ["Document date", document.documentDate],
              ["Topics", document.topics],
            ]}
          />
          <Section
            title="Classification"
            fields={[
              ["Primary domain", document.primaryDomain],
              ["PARA class", document.paraClass],
              ["Current location", document.currentPath],
              ["Proposed location", document.proposedPath],
              ["Status", document.status],
              [
                "Confidence",
                document.confidence === null ? null : `${Math.round(document.confidence * 100)}%`,
              ],
            ]}
          />
          <Section
            title="Registration"
            fields={[
              ["Document ID", document.id],
              ["Registration status", document.processingStatus],
              ["Privacy status", document.privacyClass],
              ["Extraction status", document.extractionStatus],
              ["Registry schema", document.schemaVersion],
              ["Originating run", document.sourceSwarmRunId],
            ]}
          />
          <Section
            title="Source"
            fields={[
              ["Source kind", document.sourceType],
              ["Provider file ID", document.providerFileId],
              ["Source reference", document.sourceRef],
              ["Content hash", document.contentHash],
              ["Hash algorithm", document.hashAlgorithm],
              ["Source / Drive link", document.sourceUrl],
              ["MIME type", document.mimeType],
              [
                "File size",
                document.fileSize === null ? null : `${document.fileSize.toLocaleString()} bytes`,
              ],
              ["Modified", document.modifiedAt],
              ["Ingested", document.ingestedAt],
              ["Privacy class", document.privacyClass],
            ]}
          />
          <CaseRelationsPanel documentId={document.id} />
          <Card>
            <CardHeader>
              <CardTitle>History / Related</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Semantic history is not part of the registration record. Fields that a later lifecycle
              stage has not produced yet stay unresolved rather than being guessed.
            </CardContent>
          </Card>
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer text-sm font-medium">Technical metadata</summary>
            <pre className="mt-3 overflow-auto rounded-md bg-muted/30 p-3 text-xs">
              {JSON.stringify(document.metadata, null, 2)}
            </pre>
          </details>
        </div>
      )}
      {document && (
        <MetadataEditDialog
          count={1}
          onOpenChange={setEditing}
          onSave={async (edits) => {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (!session) throw new Error("Not signed in.");
            const result = await saveMetadata({
              data: {
                access_token: session.access_token,
                kind: "document",
                ids: [document.rowId],
                edits,
              },
            });
            if (result.updated.length) setReload((current) => current + 1);
            if (result.failed.length)
              setError(`${result.failed.length} item(s) could not be updated.`);
            setEditing(false);
          }}
          open={editing}
          records={[document.metadata]}
        />
      )}
    </div>
  );
}

function Section({
  title,
  fields,
}: {
  title: string;
  fields: Array<[string, string | number | null]>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          {fields.map(([label, field]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words">{value(field)}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
