// Document Review — full detail page for one review item.
//
// A real page, not a Sheet: reached via /review/$approvalId, bookmarkable,
// reopenable, and it is the same target the compact ApprovalInbox's
// "Open full review" link points at. All data comes from
// src/lib/reviewWorkbench.ts (a read-only composition over canonical
// `approvals` / `clarification_cases` / `document_registry`); all actions go
// through the same useApprovalActions hook ApprovalInbox uses, which in turn
// calls the canonical server functions (resumeApprovedSwarmRun,
// startClarification, applyDomainApproval). Nothing here decides anything on
// its own, and nothing here creates a conversation — only "Discuss" does,
// via the existing startClarification flow.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowLeft, CheckCircle2, ExternalLink, MessageSquare, XCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { fetchReviewDetail, type ReviewDetail, type ReviewStatus } from "@/lib/reviewWorkbench";
import { useApprovalActions, canClarifyApproval } from "@/hooks/use-approval-actions";

export const Route = createFileRoute("/_authenticated/review_/$approvalId")({
  component: ReviewDetailPage,
});

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "Pending",
  clarifying: "Clarifying",
  consensus: "Consensus reached",
  approved: "Approved",
  rejected: "Rejected",
  abandoned: "Needs attention",
};

const STATUS_BADGE: Record<ReviewStatus, string> = {
  pending: "border-amber-500/40 text-amber-500",
  clarifying: "border-sky-500/40 text-sky-500",
  consensus: "border-violet-500/40 text-violet-500",
  approved: "border-emerald-500/40 text-emerald-500",
  rejected: "border-muted-foreground/40 text-muted-foreground",
  abandoned: "border-red-500/40 text-red-500",
};

type Proposal = Record<string, any>;

function ReviewDetailPage() {
  const { approvalId } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [clarifyLink, setClarifyLink] = useState<{
    conversationId: string;
    agentId: string;
    caseId: string;
  } | null>(null);
  const { decide, rejectWithReason, busy } = useApprovalActions();

  const load = async (uid: string) => {
    const { detail: d, error } = await fetchReviewDetail(supabase, uid, approvalId);
    setLoadError(error);
    setDetail(d);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    void load(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, approvalId]);

  const proposal: Proposal = useMemo(
    () => (detail?.approval.payload as { proposal?: Proposal })?.proposal ?? {},
    [detail],
  );
  const naming = useMemo(
    () => (detail?.approval.payload as { naming?: Record<string, any> })?.naming ?? {},
    [detail],
  );
  const registry = detail?.registryRow;

  if (authLoading || loading) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 space-y-3">
        <BackLink />
        <p className="text-sm text-warning">This review could not be loaded — {loadError}.</p>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6 space-y-3">
        <BackLink />
        <p className="text-sm text-muted-foreground">
          Review item not found, or you do not have access to it.
        </p>
      </div>
    );
  }

  const { approval, reviewStatus, case: kase } = detail;

  const filename =
    registry?.canonical_filename ?? registry?.original_filename ?? proposal.source_filename ?? null;
  const driveUrl = proposal.drive_url ?? registry?.drive_url ?? null;

  const isActionable = reviewStatus === "pending";
  const isInDialogue = reviewStatus === "clarifying" || reviewStatus === "consensus";
  const canDiscuss = canClarifyApproval(approval);

  const openConversationLink = clarifyLink
    ? {
        to: "/playground" as const,
        search: {
          agentId: clarifyLink.agentId,
          conversationId: clarifyLink.conversationId,
          caseId: clarifyLink.caseId,
          approvalId,
        },
      }
    : kase?.conversation_id && kase.agent_id
      ? {
          to: "/playground" as const,
          search: {
            agentId: kase.agent_id,
            conversationId: kase.conversation_id,
            caseId: kase.id,
            approvalId,
          },
        }
      : null;

  const onApprove = async () => {
    await decide(
      {
        id: approval.id,
        user_id: approval.user_id,
        agent_name: approval.agent_name,
        action_type: approval.action_type,
        action_title: approval.action_title,
        payload: approval.payload,
        swarm_run_id: approval.swarm_run_id,
      },
      "approved",
    );
    if (user) void load(user.id);
  };

  const onRejectPlain = async () => {
    await decide(
      {
        id: approval.id,
        user_id: approval.user_id,
        agent_name: approval.agent_name,
        action_type: approval.action_type,
        action_title: approval.action_title,
        payload: approval.payload,
        swarm_run_id: approval.swarm_run_id,
      },
      "rejected",
    );
    if (user) void load(user.id);
  };

  const onDiscuss = async () => {
    const res = await rejectWithReason(
      {
        id: approval.id,
        user_id: approval.user_id,
        agent_name: approval.agent_name,
        action_type: approval.action_type,
        action_title: approval.action_title,
        payload: approval.payload,
        swarm_run_id: approval.swarm_run_id,
      },
      reason,
    );
    if (res.ok) {
      setRejecting(false);
      setReason("");
      setClarifyLink({
        conversationId: res.conversation_id,
        agentId: res.agent_id,
        caseId: res.case_id,
      });
      if (user) void load(user.id);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Document Intake · Review
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {filename ?? approval.action_title}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {format(new Date(approval.created_at), "PPpp")} · approval {approval.id.slice(0, 8)}
            {kase ? ` · cycle ${kase.cycle_count}` : ""}
          </p>
        </div>
        <Badge variant="outline" className={`text-sm ${STATUS_BADGE[reviewStatus]}`}>
          {STATUS_LABEL[reviewStatus]}
        </Badge>
      </div>

      {/* SOURCE */}
      <Section title="Source">
        <FieldGrid>
          <Field label="Filename" value={filename ?? proposal.source_filename} />
          <Field
            label="Source link"
            value={
              driveUrl ? (
                <a
                  href={driveUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open in Drive <ExternalLink className="h-3 w-3" />
                </a>
              ) : null
            }
          />
          <Field label="MIME type" value={proposal.mime_type ?? registry?.mime_type} />
          <Field
            label="File size"
            value={
              proposal.file_size
                ? `${Math.round(Number(proposal.file_size) / 1024)} KB`
                : registry?.file_size
                  ? `${Math.round(Number(registry.file_size) / 1024)} KB`
                  : null
            }
          />
        </FieldGrid>
      </Section>

      {/* CLASSIFICATION */}
      <Section title="Classification">
        <FieldGrid>
          <Field label="Document type" value={registry?.document_type ?? proposal.document_type} />
          <Field
            label="Document family"
            value={registry?.document_family ?? proposal.document_family}
          />
          <Field label="Organisation" value={proposal.sender_or_issuer ?? registry?.organization} />
          <Field
            label="Primary domain"
            value={registry?.primary_domain ?? proposal.primary_domain}
          />
          <Field label="Domain status" value={registry?.primary_domain_status} />
          <Field
            label="Topics"
            value={
              Array.isArray(proposal.topics)
                ? proposal.topics.join(", ")
                : (registry?.topics ?? null)
            }
          />
          <Field label="Document date" value={registry?.document_date ?? proposal.document_date} />
          <Field
            label="Date source"
            value={registry?.document_date_source ?? proposal.document_date_source}
          />
        </FieldGrid>
      </Section>

      {/* FILING PROPOSAL */}
      <Section title="Filing proposal">
        <FieldGrid>
          <Field
            label="Proposed path"
            value={registry?.proposed_path ?? proposal.proposed_folder_path}
            mono
          />
          <Field
            label="Canonical filename"
            value={naming.canonical_filename ?? registry?.canonical_filename}
            mono
          />
          <Field
            label="Filename change required"
            value={
              naming.rename_required != null
                ? naming.rename_required
                  ? "Yes"
                  : "No"
                : registry?.filename_change_required
            }
          />
          <Field
            label="Confidence"
            value={
              proposal.confidence != null
                ? `${Math.round(Number(proposal.confidence) * 100)}%`
                : registry?.confidence != null
                  ? `${Math.round(Number(registry.confidence) * 100)}%`
                  : null
            }
          />
        </FieldGrid>
        {proposal.summary && (
          <p className="text-sm mt-3 text-muted-foreground whitespace-pre-wrap">
            {proposal.summary}
          </p>
        )}
        {proposal.reason_for_classification && (
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Reasoning
            </p>
            <p className="text-sm whitespace-pre-wrap">{proposal.reason_for_classification}</p>
          </div>
        )}
        {proposal.warnings && proposal.warnings !== "none" && (
          <p className="text-sm mt-3 text-amber-500">⚠ {proposal.warnings}</p>
        )}
        {proposal.extraction_status && proposal.extraction_status !== "ok" && (
          <p className="text-xs mt-2 text-muted-foreground">
            Extraction status: {proposal.extraction_status}
            {proposal.extraction_error ? ` — ${proposal.extraction_error}` : ""}
          </p>
        )}
      </Section>

      {/* REVIEW STATE */}
      <Section title="Review state">
        <FieldGrid>
          <Field label="Approval status" value={approval.status} />
          <Field label="Created" value={format(new Date(approval.created_at), "PPp")} />
          <Field
            label="Decided"
            value={approval.decided_at ? format(new Date(approval.decided_at), "PPp") : null}
          />
          <Field label="Clarification status" value={kase?.status ?? "—"} />
          {approval.decision_note && <Field label="Decision note" value={approval.decision_note} />}
        </FieldGrid>
      </Section>

      {/* CLARIFICATION */}
      {(kase || clarifyLink) && (
        <Section title="Clarification">
          <p className="text-sm text-muted-foreground">
            {isInDialogue
              ? "A clarification conversation is in progress for this document."
              : kase?.status === "resolved"
                ? "This document's clarification history is resolved."
                : "A clarification conversation exists for this document."}
          </p>
          {openConversationLink && (
            <Link {...openConversationLink}>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" /> Open conversation
              </Button>
            </Link>
          )}
        </Section>
      )}

      {/* HISTORY */}
      {detail.history.length > 1 && (
        <Section title="Proposal history">
          <div className="space-y-1.5">
            {detail.history.map((h, i) => (
              <div key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Cycle {i + 1}</span>
                <span
                  className={
                    h.status === "approved"
                      ? "text-emerald-500"
                      : h.status === "rejected"
                        ? "text-red-500"
                        : "text-amber-500"
                  }
                >
                  {h.status}
                </span>
                <span className="font-mono text-muted-foreground">
                  {format(new Date(h.created_at), "MMM dd HH:mm")}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ACTIONS */}
      <Card className="p-4">
        {!isActionable ? (
          <p className="text-sm text-muted-foreground">
            {isInDialogue
              ? "This item is in an active clarification dialogue. Continue the conversation to reach a revised proposal."
              : `This review is resolved (${STATUS_LABEL[reviewStatus].toLowerCase()}). No further action is available.`}
          </p>
        ) : rejecting ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Why is this wrong? The agent will discuss it with you.
            </p>
            <Textarea
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. This belongs under Deutsche Telekom, not AI — and keep the folders shallow."
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={busy} onClick={onDiscuss}>
                {busy ? "Starting…" : "Discuss with agent"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => (canDiscuss ? setRejecting(true) : onRejectPlain())}
            >
              <XCircle className="h-4 w-4" /> {canDiscuss ? "Discuss / Reject" : "Reject"}
            </Button>
            <Button className="gap-1.5" onClick={onApprove}>
              <CheckCircle2 className="h-4 w-4" /> Approve
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/review"
      className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Review queue
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
        {title}
      </p>
      {children}
    </Card>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{children}</div>;
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  if (value == null || value === "") return null;
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm truncate ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}
