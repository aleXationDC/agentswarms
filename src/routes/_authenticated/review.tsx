import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Pencil, Search, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  NativeApproval,
  reviewContext,
  reviewSearchText,
  type ReviewStatus,
} from "@/axtn/workbenches/reviews/reviewWorkbench";
import { useApprovalDecision } from "@/hooks/use-approval-decision";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { MetadataEditDialog } from "@/components/axtn/MetadataEditDialog";
import { useServerFn } from "@tanstack/react-start";
import { saveAxtnWorkbenchMetadata } from "@/utils/axtnWorkbenchEdits.functions";

export const Route = createFileRoute("/_authenticated/review")({
  head: () => ({ meta: [{ title: "aXtn Reviews — AgentSwarms" }] }),
  component: ReviewsPage,
});

function ReviewsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<NativeApproval[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ReviewStatus | "all">("pending");
  const [sort, setSort] = useState<"newest" | "oldest" | "risk">("newest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const decideApproval = useApprovalDecision();
  const saveMetadata = useServerFn(saveAxtnWorkbenchMetadata);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void supabase
      .from("approvals")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) setError(queryError.message);
        else setItems(data ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filtered = useMemo(() => {
    const result = items.filter(
      (item) =>
        (status === "all" || item.status === status) &&
        reviewSearchText(item).includes(search.trim().toLowerCase()),
    );
    const riskOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return result.sort((left, right) => {
      if (sort === "risk") {
        return (
          (riskOrder[right.risk_level as keyof typeof riskOrder] ?? 0) -
          (riskOrder[left.risk_level as keyof typeof riskOrder] ?? 0)
        );
      }
      const chronological =
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      return sort === "newest" ? chronological : -chronological;
    });
  }, [items, search, sort, status]);
  const pendingCount = items.filter((item) => item.status === "pending").length;

  async function decide(item: NativeApproval, decision: "approved" | "rejected") {
    if (!(await decideApproval(item, decision))) return;
    setItems((current) =>
      current.map((candidate) =>
        candidate.id === item.id ? { ...candidate, status: decision } : candidate,
      ),
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Operations
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">aXtn Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review native AgentSwarms approvals. Decisions remain in the canonical approval workflow.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Pending" value={pendingCount} />
        <Metric
          label="High risk"
          value={items.filter((item) => ["high", "critical"].includes(item.risk_level)).length}
        />
        <Metric label="All reviews" value={items.length} />
        <Metric label="Visible" value={filtered.length} />
      </div>
      <Card>
        <CardContent className="flex flex-wrap gap-3 p-4">
          <div className="relative min-w-64 flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search approvals"
              value={search}
            />
          </div>
          <select
            aria-label="Review status"
            className="rounded-md border bg-background px-3 text-sm"
            onChange={(event) => setStatus(event.target.value as ReviewStatus | "all")}
            value={status}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          <Button
            disabled={selected.length === 0}
            onClick={() => setEditing(true)}
            variant="outline"
          >
            <Pencil className="mr-1 h-4 w-4" /> Bulk Edit ({selected.length})
          </Button>
          <select
            aria-label="Review sort order"
            className="rounded-md border bg-background px-3 text-sm"
            onChange={(event) => setSort(event.target.value as "newest" | "oldest" | "risk")}
            value={sort}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="risk">Highest risk</option>
          </select>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Review queue</CardTitle>
          <CardDescription>Native approval items, newest first.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading reviews...</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No native review items match the current filter.
            </p>
          ) : (
            filtered.map((item) => (
              <div
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border p-4"
                key={item.id}
              >
                {item.status === "pending" && isEditable(item) && (
                  <input
                    aria-label={`Select ${item.action_title}`}
                    checked={selected.includes(item.id)}
                    onChange={() =>
                      setSelected((current) =>
                        current.includes(item.id)
                          ? current.filter((id) => id !== item.id)
                          : [...current, item.id],
                      )
                    }
                    type="checkbox"
                  />
                )}
                <div className="min-w-0">
                  <Link
                    className="font-medium hover:underline"
                    params={{ approvalId: item.id }}
                    to="/review/$approvalId"
                  >
                    {item.action_title}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.agent_name} · {item.action_type} ·{" "}
                    {new Date(item.created_at).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {reviewContext(item).subject ?? "—"} ·{" "}
                    {reviewContext(item).primaryDomain ?? "—"} ·{" "}
                    {reviewContext(item).proposedLocation ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{item.risk_level}</Badge>
                  <Badge variant={item.status === "pending" ? "default" : "secondary"}>
                    {item.status}
                  </Badge>
                  {item.status === "pending" && (
                    <>
                      <Button
                        onClick={() => void decide(item, "rejected")}
                        size="sm"
                        variant="outline"
                      >
                        <XCircle className="mr-1 h-4 w-4" /> Reject
                      </Button>
                      <Button onClick={() => void decide(item, "approved")} size="sm">
                        <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
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
          await saveMetadata({
            data: { access_token: session.access_token, kind: "approval", ids: selected, edits },
          });
          setSelected([]);
          setEditing(false);
        }}
        open={editing}
        values={{}}
      />
    </div>
  );
}

function isEditable(item: NativeApproval) {
  return (
    typeof item.payload === "object" &&
    item.payload !== null &&
    typeof (item.payload as Record<string, unknown>).proposal === "object" &&
    (item.payload as Record<string, unknown>).proposal !== null
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
