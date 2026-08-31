import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import {
  listWorkbenchDocuments,
  type WorkbenchDocument,
} from "@/axtn/workbenches/documents/documentsWorkbench";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/documents_/$documentId")({
  component: DocumentDetailPage,
});

function DocumentDetailPage() {
  const { documentId } = Route.useParams();
  const { user } = useAuth();
  const [document, setDocument] = useState<WorkbenchDocument | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void listWorkbenchDocuments(supabase, user.id)
      .then((documents) => {
        if (!cancelled) setDocument(documents.find((item) => item.id === documentId) ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, user]);

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
      ) : !document ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This document is not available in the current dataset.
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-4xl">
          <CardHeader>
            <CardTitle>{document.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Type</dt>
                <dd>{document.type ?? "Unclassified"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last updated</dt>
                <dd>
                  {document.updatedAt
                    ? new Date(document.updatedAt).toLocaleString()
                    : "Not recorded"}
                </dd>
              </div>
            </dl>
            {document.sourceUrl && (
              <Button asChild variant="outline">
                <a href={document.sourceUrl} rel="noreferrer" target="_blank">
                  Open source document <ExternalLink className="ml-1 h-4 w-4" />
                </a>
              </Button>
            )}
            <pre className="overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
              {JSON.stringify(document.metadata, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
