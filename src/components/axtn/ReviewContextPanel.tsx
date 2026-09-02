import { reviewContext, type NativeApproval } from "@/axtn/workbenches/reviews/reviewWorkbench";

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

  const registrationFields: Array<[string, string | number | null]> = registration
    ? [
        ["Document ID", registration.documentId],
        ["Source kind", registration.sourceType],
        ["Provider file ID", registration.providerFileId],
        ["Registration status", registration.processingStatus],
        ["Registry outcome", registration.registryOutcome],
        ["Processing route", registration.processingRoute],
        ["Next location", registration.nextLocation],
        ["Accepted", registration.accepted === null ? null : registration.accepted ? "yes" : "no"],
      ]
    : [];

  return (
    <div className="space-y-4">
      {registration && (
        <Grid
          title="Registration"
          note="This step confirms the technical registration of the document. No classification has been proposed yet."
          fields={registrationFields}
          compact={compact}
        />
      )}
      {(hasSemanticContext || !registration) && (
        <Grid title="Review context" fields={semanticFields} compact={compact} />
      )}
    </div>
  );
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
