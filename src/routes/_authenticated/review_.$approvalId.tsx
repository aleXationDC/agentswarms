import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Pencil, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { reviewContext, type NativeApproval } from "@/axtn/workbenches/reviews/reviewWorkbench";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetadataEditDialog } from "@/components/axtn/MetadataEditDialog";
import { useApprovalDecision } from "@/hooks/use-approval-decision";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { saveAxtnWorkbenchMetadata } from "@/utils/axtnWorkbenchEdits.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/review_/$approvalId")({
  component: ReviewDetailPage,
});

function ReviewDetailPage() {
  const { approvalId } = Route.useParams();
  const { user } = useAuth();
  const [approval, setApproval] = useState<NativeApproval | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const decideApproval = useApprovalDecision();
  const saveMetadata = useServerFn(saveAxtnWorkbenchMetadata);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("approvals")
      .select("*")
      .eq("id", approvalId)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) setError(queryError.message);
        else setApproval(data);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [approvalId]);

  async function decide(status: "approved" | "rejected") {
    if (!approval) return;
    if (!(await decideApproval(approval, status))) return;
    setApproval({ ...approval, status });
  }

  return (
    <div className="space-y-6 p-6">
      <Link
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        to="/review"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to aXtn Reviews
      </Link>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading review...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !approval ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            This native approval was not found.
          </CardContent>
        </Card>
      ) : (
        <Card className="max-w-4xl">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{approval.action_title}</CardTitle>
                <CardDescription className="mt-1">
                  {approval.agent_name} · {approval.action_type}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{approval.risk_level}</Badge>
                <Badge variant={approval.status === "pending" ? "default" : "secondary"}>
                  {approval.status}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <h2 className="text-sm font-medium">Description</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                {approval.description || "No description provided."}
              </p>
            </div>
            <ReviewContext approval={approval} />
            {isEditableProposal(approval) && (
              <Button onClick={() => setEditing(true)} variant="outline">
                <Pencil className="mr-1 h-4 w-4" /> Edit proposal / Human Override
              </Button>
            )}
            <div>
              <h2 className="text-sm font-medium">Request context</h2>
              <pre className="mt-2 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
                {JSON.stringify(approval.payload, null, 2)}
              </pre>
            </div>
            {approval.status === "pending" && (
              <div className="flex gap-2 border-t pt-5">
                <Button onClick={() => void decide("rejected")} variant="outline">
                  <XCircle className="mr-1 h-4 w-4" /> Reject
                </Button>
                <Button onClick={() => void decide("approved")}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {approval && isEditableProposal(approval) && (
        <MetadataEditDialog
          count={1}
          onOpenChange={setEditing}
          onSave={async (edits) => {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            if (!session) throw new Error("Not signed in.");
            await saveMetadata({
              data: {
                access_token: session.access_token,
                kind: "approval",
                ids: [approval.id],
                edits,
              },
            });
            setApproval(
              (current) =>
                current && {
                  ...current,
                  payload: {
                    ...(current.payload as object),
                    proposal: {
                      ...((current.payload as Record<string, unknown>).proposal as object),
                      ...edits,
                    },
                  },
                },
            );
            setEditing(false);
          }}
          open={editing}
          values={(approval.payload as Record<string, unknown>).proposal as Record<string, unknown>}
        />
      )}
    </div>
  );
}

function isEditableProposal(approval: NativeApproval): boolean {
  return (
    typeof approval.payload === "object" &&
    approval.payload !== null &&
    typeof (approval.payload as Record<string, unknown>).proposal === "object" &&
    (approval.payload as Record<string, unknown>).proposal !== null
  );
}

function ReviewContext({ approval }: { approval: NativeApproval }) {
  const context = reviewContext(approval);
  const value = (field: string | number | null) => field ?? "—";
  const fields: Array<[string, string | number | null]> = [
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
  return (
    <div>
      <h2 className="text-sm font-medium">Review context</h2>
      <dl className="mt-2 grid gap-4 rounded-md border p-4 text-sm sm:grid-cols-2">
        {fields.map(([label, field]) => (
          <div key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="mt-1 break-words">{value(field)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
