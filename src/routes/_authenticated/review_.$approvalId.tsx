// Document Review — full detail page for one review item.
//
// A real page, not a Sheet: reached via /review/$approvalId, bookmarkable,
// reopenable, and it is the same target the compact ApprovalInbox's
// "Open full review" link points at. All data comes from
// src/lib/reviewWorkbench.ts (a read-only composition over canonical
// `approvals` / `clarification_cases` / `document_registry`); all actions go
// through the same useApprovalActions hook ApprovalInbox uses, which in turn
// calls the canonical server functions.
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  XCircle,
  Edit3,
  Copy,
  Layers,
  Save,
  Send,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchReviewDetail,
  applyHumanProposalOverride,
  findDuplicateCandidates,
  CANONICAL_PARA_ROOTS,
  type ReviewDetail,
  type ReviewStatus,
  type DuplicateCandidate,
} from "@/lib/reviewWorkbench";
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
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [duplicateDecision, setDuplicateDecision] = useState<
    "separate" | "duplicate" | "new_version" | "related_successor"
  >("separate");
  const [selectedTargetDocId, setSelectedTargetDocId] = useState<string>("");

  // Direct Human Override State
  const [isEditing, setIsEditing] = useState(false);
  const [overrideForm, setOverrideForm] = useState<{
    document_type: string;
    document_family: string;
    sender_or_issuer: string;
    primary_domain: string;
    document_date: string;
    proposed_folder_path: string;
    canonical_filename: string;
    summary: string;
  }>({
    document_type: "",
    document_family: "",
    sender_or_issuer: "",
    primary_domain: "",
    document_date: "",
    proposed_folder_path: "",
    canonical_filename: "",
    summary: "",
  });
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [savingOverride, setSavingOverride] = useState(false);

  // Embedded Chat State
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; text: string; time: string }>
  >([]);
  const [sendingChat, setSendingChat] = useState(false);

  const { decide, rejectWithReason, busy } = useApprovalActions();

  const load = async (uid: string) => {
    const { detail: d, error } = await fetchReviewDetail(supabase, uid, approvalId);
    setLoadError(error);
    setDetail(d);
    setLoading(false);

    if (d) {
      const p = ((d.approval.payload as any)?.proposal ?? {}) as Record<string, any>;
      const reg = d.registryRow as Record<string, any>;
      const naming = ((d.approval.payload as any)?.naming ?? {}) as Record<string, any>;

      setOverrideForm({
        document_type: p.document_type || reg?.document_type || "",
        document_family: p.document_family || reg?.document_family || "",
        sender_or_issuer: p.sender_or_issuer || reg?.organization || "",
        primary_domain: p.primary_domain || reg?.primary_domain || "",
        document_date: p.document_date || reg?.document_date || "",
        proposed_folder_path: p.proposed_folder_path || reg?.proposed_path || "04_Archive",
        canonical_filename: p.canonical_filename || naming.canonical_filename || reg?.canonical_filename || "",
        summary: p.summary || reg?.summary || "",
      });

      // Find duplicate candidates
      const candidates = await findDuplicateCandidates(supabase, uid, {
        currentDocumentId: d.documentId || undefined,
        contentHash: reg?.content_hash || (d.approval.payload as any)?.envelope?.content_hash,
        senderOrIssuer: p.sender_or_issuer || reg?.organization,
        documentType: p.document_type || reg?.document_type,
        documentDate: p.document_date || reg?.document_date,
      });
      setDuplicates(candidates);
      if (candidates.length > 0) {
        setSelectedTargetDocId(candidates[0].documentId);
      }
    }
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
  const driveUrl = proposal.drive_url ?? (registry as any)?.drive_url ?? null;

  const isActionable = reviewStatus === "pending";
  const isInDialogue = reviewStatus === "clarifying" || reviewStatus === "consensus";
  const canDiscuss = canClarifyApproval(approval);

  const onSaveOverride = async () => {
    if (!user) return false;
    setSavingOverride(true);
    setOverrideError(null);

    const res = await applyHumanProposalOverride(supabase, user.id, approvalId, {
      ...overrideForm,
      duplicate_decision: duplicateDecision,
      target_canonical_document_id: selectedTargetDocId || undefined,
    });

    setSavingOverride(false);
    if (!res.ok) {
      setOverrideError(res.error || "Failed to save edits");
      return false;
    }

    setIsEditing(false);
    await load(user.id);
    return true;
  };

  const onApproveWithEdits = async () => {
    if (isEditing) {
      const saved = await onSaveOverride();
      if (!saved) return;
    }
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

  const onSendChatMessage = async () => {
    if (!chatInput.trim() || sendingChat) return;
    const text = chatInput.trim();
    setChatInput("");
    setSendingChat(true);

    const newMsgs = [...chatMessages, { role: "user" as const, text, time: new Date().toLocaleTimeString() }];
    setChatMessages(newMsgs);

    // If agent clarification case exists, send to chat API or update prompt
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversation_id: kase?.conversation_id,
          agent_id: kase?.agent_id,
          approval_id: approvalId,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setChatMessages([
          ...newMsgs,
          { role: "assistant" as const, text: data.reply || "Understood. I will take this into account.", time: new Date().toLocaleTimeString() },
        ]);
      } else {
        setChatMessages([
          ...newMsgs,
          { role: "assistant" as const, text: "Noted your feedback: " + text, time: new Date().toLocaleTimeString() },
        ]);
      }
    } catch {
      setChatMessages([
        ...newMsgs,
        { role: "assistant" as const, text: "Noted your instruction: " + text, time: new Date().toLocaleTimeString() },
      ]);
    } finally {
      setSendingChat(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <BackLink />

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            Review Workbench
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {filename ?? approval.action_title}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            {format(new Date(approval.created_at), "PPpp")} · approval {approval.id.slice(0, 8)}
            {kase ? ` · cycle ${kase.cycle_count}` : ""}
            {proposal.human_overridden ? " · Human Override Active" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isActionable && (
            <Button
              variant={isEditing ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setIsEditing(!isEditing)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              {isEditing ? "Viewing Proposal" : "Direct Override"}
            </Button>
          )}
          <Badge variant="outline" className={`text-sm ${STATUS_BADGE[reviewStatus]}`}>
            {STATUS_LABEL[reviewStatus]}
          </Badge>
        </div>
      </div>

      {overrideError && (
        <Card className="p-3 border-red-500/50 bg-red-500/10 text-red-500 text-sm">
          {overrideError}
        </Card>
      )}

      {/* 1. SOURCE (Immutable) */}
      <Section title="1. Source (Immutable Facts)">
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
          <Field label="MIME type" value={proposal.mime_type ?? (registry as any)?.mime_type} />
          <Field
            label="File size"
            value={
              proposal.file_size
                ? `${Math.round(Number(proposal.file_size) / 1024)} KB`
                : (registry as any)?.file_size
                  ? `${Math.round(Number((registry as any).file_size) / 1024)} KB`
                  : null
            }
          />
          <Field
            label="Content Hash"
            value={(registry as any)?.content_hash || (registry as any)?.raw_sha256 || (approval.payload as any)?.envelope?.content_hash}
            mono
          />
          <Field
            label="Provider Identity"
            value={(registry as any)?.provider_type ? `${(registry as any).provider_type} (${(registry as any).provider_message_id || 'UID ' + (registry as any).current_uid})` : "Drive"}
            mono
          />
        </FieldGrid>
      </Section>

      {/* 2 & 3. CLASSIFICATION & FILING PROPOSAL (Direct Human Override Form) */}
      <Section title="2 & 3. Classification & Filing Proposal">
        {isEditing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Document Type</label>
                <Input
                  value={overrideForm.document_type}
                  onChange={(e) => setOverrideForm({ ...overrideForm, document_type: e.target.value })}
                  placeholder="invoice, contract, receipt, etc."
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Document Family</label>
                <Input
                  value={overrideForm.document_family}
                  onChange={(e) => setOverrideForm({ ...overrideForm, document_family: e.target.value })}
                  placeholder="e.g. Legal, Finance, Operations"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Organisation / Issuer</label>
                <Input
                  value={overrideForm.sender_or_issuer}
                  onChange={(e) => setOverrideForm({ ...overrideForm, sender_or_issuer: e.target.value })}
                  placeholder="e.g. Deutsche Telekom, Stadtwerke"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Primary Domain</label>
                <Input
                  value={overrideForm.primary_domain}
                  onChange={(e) => setOverrideForm({ ...overrideForm, primary_domain: e.target.value })}
                  placeholder="e.g. Finance, RealEstate"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Document Date (YYYY-MM-DD)</label>
                <Input
                  value={overrideForm.document_date}
                  onChange={(e) => setOverrideForm({ ...overrideForm, document_date: e.target.value })}
                  placeholder="YYYY-MM-DD"
                  className="h-8 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Proposed PARA Target Folder</label>
                <Select
                  value={overrideForm.proposed_folder_path.split("/")[0]}
                  onValueChange={(root) => {
                    const sub = overrideForm.proposed_folder_path.split("/").slice(1).join("/");
                    setOverrideForm({
                      ...overrideForm,
                      proposed_folder_path: sub ? `${root}/${sub}` : root,
                    });
                  }}
                >
                  <SelectTrigger className="h-8 text-sm mb-1">
                    <SelectValue placeholder="PARA Root" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANONICAL_PARA_ROOTS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={overrideForm.proposed_folder_path}
                  onChange={(e) => setOverrideForm({ ...overrideForm, proposed_folder_path: e.target.value })}
                  placeholder="02_Areas/Finanzen/Telekommunikation"
                  className="h-8 text-sm font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Canonical Filename</label>
              <Input
                value={overrideForm.canonical_filename}
                onChange={(e) => setOverrideForm({ ...overrideForm, canonical_filename: e.target.value })}
                placeholder="2026-08-30_Invoice_Telekom.pdf"
                className="h-8 text-sm font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Summary / Note</label>
              <Textarea
                value={overrideForm.summary}
                onChange={(e) => setOverrideForm({ ...overrideForm, summary: e.target.value })}
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={savingOverride} onClick={onSaveOverride} className="gap-1.5">
                <Save className="h-3.5 w-3.5" /> {savingOverride ? "Saving…" : "Save Edits"}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <FieldGrid>
              <Field label="Document type" value={(registry as any)?.document_type ?? proposal.document_type} />
              <Field label="Document family" value={(registry as any)?.document_family ?? proposal.document_family} />
              <Field label="Organisation" value={proposal.sender_or_issuer ?? (registry as any)?.organization} />
              <Field label="Primary domain" value={(registry as any)?.primary_domain ?? proposal.primary_domain} />
              <Field label="Document date" value={(registry as any)?.document_date ?? proposal.document_date} />
              <Field label="Date source" value={(registry as any)?.document_date_source ?? proposal.document_date_source} />
              <Field label="Proposed PARA path" value={(registry as any)?.proposed_path ?? proposal.proposed_folder_path} mono />
              <Field label="Canonical filename" value={naming.canonical_filename ?? (registry as any)?.canonical_filename ?? proposal.canonical_filename} mono />
              <Field
                label="Confidence"
                value={
                  proposal.confidence != null
                    ? `${Math.round(Number(proposal.confidence) * 100)}%`
                    : (registry as any)?.confidence != null
                      ? `${Math.round(Number((registry as any).confidence) * 100)}%`
                      : null
                }
              />
            </FieldGrid>
            {proposal.summary && (
              <p className="text-sm mt-3 text-muted-foreground whitespace-pre-wrap">{proposal.summary}</p>
            )}
          </div>
        )}
      </Section>

      {/* 4. DUPLICATE & VERSION CANDIDATES */}
      {duplicates.length > 0 && (
        <Section title="4. Duplicate / Version Matches">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Potential matching documents were detected in the canonical archive. Select how this document should be filed:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <Card className="p-3 border-primary/20 bg-primary/5">
                <p className="text-[11px] font-semibold text-primary uppercase">Current Intake</p>
                <p className="text-sm font-medium mt-1">{filename}</p>
                <p className="text-xs text-muted-foreground">Date: {proposal.document_date || "—"}</p>
                <p className="text-xs text-muted-foreground font-mono truncate">Path: {proposal.proposed_folder_path || "—"}</p>
              </Card>
              {duplicates.slice(0, 1).map((cand) => (
                <Card key={cand.documentId} className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground">Existing Archive Match</p>
                    <Badge variant="outline" className="text-[10px]">
                      {cand.matchType === "exact_hash" ? "Exact Byte Duplicate" : "Semantic Candidate"}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium mt-1">{cand.canonicalFilename || cand.originalFilename}</p>
                  <p className="text-xs text-muted-foreground">Date: {cand.documentDate || "—"}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">Path: {cand.proposedPath || "—"}</p>
                  <p className="text-[11px] text-amber-500 mt-1">{cand.matchReason}</p>
                </Card>
              ))}
            </div>

            <div className="pt-2">
              <label className="text-xs text-muted-foreground block mb-1">Human Decision</label>
              <Select
                value={duplicateDecision}
                onValueChange={(v: any) => setDuplicateDecision(v)}
              >
                <SelectTrigger className="h-8 text-sm w-full sm:w-80">
                  <SelectValue placeholder="Select duplicate handling" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="separate">1. Separate document (file independently)</SelectItem>
                  <SelectItem value="duplicate">2. Duplicate of existing (keep provenance, skip 2nd file)</SelectItem>
                  <SelectItem value="new_version">3. New version of same logical document (Drive revision)</SelectItem>
                  <SelectItem value="related_successor">4. Related successor / follow-on document</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>
      )}

      {/* 5. EMBEDDED CLARIFICATION CHAT */}
      <Section title="5. Embedded Clarification Chat">
        <div className="space-y-2">
          {chatMessages.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Ask questions or instruct the agent on corrections directly. No need to reject first.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-muted/20 rounded border text-sm">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`p-2 rounded max-w-[85%] ${
                    msg.role === "user"
                      ? "ml-auto bg-primary text-primary-foreground"
                      : "mr-auto bg-card border"
                  }`}
                >
                  <p className="text-xs opacity-70 mb-0.5">{msg.role === "user" ? "You" : "Agent"} · {msg.time}</p>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSendChatMessage()}
              placeholder="Type instruction (e.g. 'File under Projects instead' or 'Explain classification')…"
              className="h-8 text-sm"
            />
            <Button size="sm" disabled={sendingChat || !chatInput.trim()} onClick={onSendChatMessage} className="gap-1">
              <Send className="h-3.5 w-3.5" /> Send
            </Button>
          </div>
        </div>
      </Section>

      {/* 6. PROPOSAL HISTORY */}
      {detail.history.length > 1 && (
        <Section title="6. Proposal History">
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

      {/* 7. ACTIONS */}
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => (canDiscuss ? setRejecting(true) : onRejectPlain())}
            >
              <XCircle className="h-4 w-4" /> {canDiscuss ? "Reject / Discuss" : "Reject"}
            </Button>
            <Button className="gap-1.5" onClick={onApproveWithEdits}>
              <CheckCircle2 className="h-4 w-4" /> {isEditing ? "Save Edits & Approve" : "Approve & File"}
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
