import { useEffect, useState } from "react";

import {
  findWorkbenchDocumentByDocumentId,
  type WorkbenchDocument,
} from "@/axtn/workbenches/documents/documentsWorkbench";
import { reviewContext, type NativeApproval } from "@/axtn/workbenches/reviews/reviewWorkbench";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const display = (field: string | number | null) => field ?? "—";

/**
 * Renders the interpreted context of a native approval.
 *
 * Registration approvals produced by document intake do not contain a semantic
 * classification proposal yet — they carry the technical acknowledgement. In
 * that case the technical facts are shown instead of a grid of unresolved
 * semantic placeholders. Semantic proposals keep their existing rendering.
 *
 * Both surfaces (the review detail page and the pending-approval drawer) use
 * this single component so they can never disagree about what a review means.
 */
export function ReviewContextPanel({
  approval,
  compact = false,
}: {
  approval: NativeApproval;
  compact?: boolean;
}) {
  const context = reviewContext(approval);
  const semanticFields: Array<[string, string | number | null]> = [
    ["Subject / Filename", context.subject],
    ["Item kind", context.itemKind],
    ["Document type", context.documentType],
    ["Document family", context.documentFamily],
    ["Organisation / Issuer", context.organization],
    ["Primary domain", context.primaryDomain],
    ["Proposed location", context.proposedLocation],
    ["Confidence", context.confidence === null ? null : `${Math.round(context.confidence * 100)}%`],
    ["Topics", context.topics],
    ["Summary", context.summary],
    ["Clarification / context", context.clarification],
  ];
  const hasSemanticContext = semanticFields.some(([, field]) => field !== null);
  const registration = context.registration;
  const document = useRegisteredDocument(registration?.documentId ?? null);

  // The approval record stays the primary source. Registry facts only fill in
  // what the acknowledgement does not carry, so a missing or not-yet-loaded
  // registry row can never blank out something the approval already proved.
  const registrationFields: Array<[string, string | number | null]> = registration
    ? [
        ["Document ID", registration.documentId],
        // The document's own name, and nothing else. A provider file id is a
        // source locator; showing one here would answer "what is this file
        // called" with an identifier that is not a name.
        ["Filename", document?.filename ?? null],
        ["Source kind", registration.sourceType ?? document?.sourceType ?? null],
        ["Provider file ID", registration.providerFileId ?? document?.providerFileId ?? null],
        ["MIME type", document?.mimeType ?? null],
        ["Content hash", document?.contentHash ?? null],
        ["Hash algorithm", document?.hashAlgorithm ?? null],
        ["Current location", document?.currentPath ?? null],
        [
          "Registration status",
          registration.processingStatus ?? document?.processingStatus ?? null,
        ],
        ["Registry outcome", registration.registryOutcome],
        ["Processing route", registration.processingRoute],
        // Registration does not move a Drive file, so there is no next physical
        // location to report and the row is left out entirely rather than
        // claiming a destination the file was never sent to.
        ...(registration.nextLocation
          ? ([["Next location", registration.nextLocation]] as Array<
              [string, string | number | null]
            >)
          : []),
        ["Accepted", registration.accepted === null ? null : registration.accepted ? "yes" : "no"],
      ]
    : [];
  const sourceUrl = document?.sourceUrl ?? null;
  const isDrive = (registration?.sourceType ?? document?.sourceType) === "google_drive";

  return (
    <div className="space-y-4">
      {registration && (
        <>
          <Grid
            title="Registration"
            note="This step confirms the technical registration of the document. No classification has been proposed yet."
            fields={registrationFields}
            compact={compact}
          />
          {sourceUrl && (
            <a
              className="inline-flex items-center text-sm font-medium underline underline-offset-4"
              href={sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              {isDrive ? "Open in Drive" : "Open source"}
            </a>
          )}
        </>
      )}
      {(hasSemanticContext || !registration) && (
        <Grid title="Review context" fields={semanticFields} compact={compact} />
      )}
    </div>
  );
}

/**
 * Read-only lookup of the registry row behind a registration approval.
 *
 * Failures are swallowed on purpose: the approval must stay readable and
 * decidable even when the supplementary lookup cannot run.
 */
function useRegisteredDocument(documentId: string | null): WorkbenchDocument | null {
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

function Grid({
  title,
  note,
  fields,
  compact,
}: {
  title: string;
  note?: string;
  fields: Array<[string, string | number | null]>;
  compact?: boolean;
}) {
  return (
    <div>
      <h2 className={compact ? "text-xs font-semibold" : "text-sm font-medium"}>{title}</h2>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      <dl
        className={
          compact
            ? "mt-1.5 grid gap-2 rounded-md border p-2.5 text-[11px]"
            : "mt-2 grid gap-4 rounded-md border p-4 text-sm sm:grid-cols-2"
        }
      >
        {fields.map(([label, field]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words">{display(field)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
