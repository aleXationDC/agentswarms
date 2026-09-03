import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Pencil, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  hasEditableReviewProposal,
  isActionableReview,
  registrationContext,
  reviewSubject,
  type NativeApproval,
} from "@/axtn/workbenches/reviews/reviewWorkbench";
import { useRegisteredDocument } from "@/hooks/use-registered-document";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetadataEditDialog } from "@/components/axtn/MetadataEditDialog";
import { useApprovalDecision } from "@/hooks/use-approval-decision";
import { useAuth } from "@/hooks/use-auth";
import { ReviewContextPanel } from "@/components/axtn/ReviewContextPanel";
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
  const [reload, setReload] = useState(0);
  const decideApproval = useApprovalDecision();
  const saveMetadata = useServerFn(saveAxtnWorkbenchMetadata);
  const document = useRegisteredDocument(
    approval ? (registrationContext(approval)?.documentId ?? null) : null,
  );
  const isRegistration = approval ? registrationContext(approval) !== null : false;

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
  }, [approvalId, reload]);

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
                <CardTitle>{reviewSubject(approval, document)}</CardTitle>
                <CardDescription className="mt-1">
                  {approval.action_title} · {approval.agent_name} · {approval.action_type}
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
            {/* A registration acknowledgement is JSON. Rendering it as the
                Description made the raw payload the main working surface while
                the same facts were interpreted directly below it. Structured
                facts come first now; the raw forms stay one click away. */}
            {!isRegistration && (
              <div>
                <h2 className="text-sm font-medium">Description</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {approval.description || "No description provided."}
                </p>
              </div>
            )}
            <ReviewContextPanel approval={approval} />
            {hasEditableReviewProposal(approval) && (
              <Button onClick={() => setEditing(true)} variant="outline">
                <Pencil className="mr-1 h-4 w-4" /> Edit proposal / Human Override
              </Button>
            )}
            <details className="rounded-md border">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                Technical metadata
              </summary>
              <div className="space-y-3 border-t p-3">
                {isRegistration && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground">
                      Acknowledgement (description)
                    </h3>
                    <pre className="mt-1 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
                      {approval.description || "No description provided."}
                    </pre>
                  </div>
                )}
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground">Request context</h3>
                  <pre className="mt-1 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">
                    {JSON.stringify(approval.payload, null, 2)}
                  </pre>
                </div>
              </div>
            </details>
            {isActionableReview(approval) && (
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
      {approval && hasEditableReviewProposal(approval) && (
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
                kind: "approval",
                ids: [approval.id],
                edits,
              },
            });
            if (result.updated.length) setReload((current) => current + 1);
            if (result.failed.length)
              setError(`${result.failed.length} item(s) could not be updated.`);
            setEditing(false);
          }}
          open={editing}
          records={[
            (approval.payload as Record<string, unknown>).proposal as Record<string, unknown>,
          ]}
        />
      )}
    </div>
  );
}
