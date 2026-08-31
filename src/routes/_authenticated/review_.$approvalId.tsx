import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import type { NativeApproval } from "@/axtn/workbenches/reviews/reviewWorkbench";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/review_/$approvalId")({
  component: ReviewDetailPage,
});

function ReviewDetailPage() {
  const { approvalId } = Route.useParams();
  const { user } = useAuth();
  const [approval, setApproval] = useState<NativeApproval | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    const { error: updateError } = await supabase
      .from("approvals")
      .update({ status, decided_at: new Date().toISOString(), decided_by: user?.id ?? null })
      .eq("id", approval.id)
      .eq("status", "pending");
    if (updateError) {
      toast.error(updateError.message);
      return;
    }
    setApproval({ ...approval, status });
    toast.success(status === "approved" ? "Approval recorded." : "Rejection recorded.");
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
    </div>
  );
}
