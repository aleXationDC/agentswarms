import { useEffect, useState } from "react";

import {
  findWorkbenchDocumentByDocumentId,
  listWorkbenchDocuments,
  type WorkbenchDocument,
} from "@/axtn/workbenches/documents/documentsWorkbench";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Read-only lookup of the registry row behind a registration approval.
 *
 * Failures are swallowed on purpose: an approval must stay readable and
 * decidable even when this supplementary lookup cannot run. Both the review
 * detail page and the pending-approval drawer use it, so they can never
 * disagree about which document an approval is about.
 */
export function useRegisteredDocument(documentId: string | null): WorkbenchDocument | null {
  const { user } = useAuth();
  const [document, setDocument] = useState<WorkbenchDocument | null>(null);

  useEffect(() => {
    setDocument(null);
    if (!documentId || !user) return;
    let cancelled = false;
    void findWorkbenchDocumentByDocumentId(supabase, user.id, documentId)
      .then((resolved) => !cancelled && setDocument(resolved))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [documentId, user]);

  return document;
}

/**
 * The whole registered inventory keyed by document id, for surfaces that have
 * to render many approvals at once. One query for the page rather than one per
 * row, reusing the same dataset binding and RLS path as /documents.
 */
export function useRegisteredDocumentsById(): Map<string, WorkbenchDocument> {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Map<string, WorkbenchDocument>>(new Map());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void listWorkbenchDocuments(supabase, user.id)
      .then((resolved) => {
        if (cancelled) return;
        setDocuments(new Map(resolved.map((document) => [document.id, document])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  return documents;
}
