import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WorkState } from "../cases/workContract";
import {
  CaseRequest,
  DocumentInputManifest,
  DocumentRevision,
  DocumentWorkTransition,
} from "./documentWorkContract";

const StoredProposals = z.array(
  z.object({
    decision_id: z.string().uuid(),
    revision: DocumentRevision,
    status: z.literal("PROPOSED"),
  }),
);

export function DocumentWorkPanel({
  caseId,
  onChanged,
}: {
  caseId: string;
  onChanged: () => Promise<void>;
}) {
  const [state, setState] = useState<WorkState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("MANUAL_DOCUMENT_WORK");
  const [evidencePath, setEvidencePath] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState(3);
  const [family, setFamily] = useState("");
  const [proposalOperation, setProposalOperation] = useState<"CLASSIFY" | "FILE" | "DELETE">(
    "CLASSIFY",
  );
  const [targetId, setTargetId] = useState("");
  const [targetName, setTargetName] = useState("");
  const [proposals, setProposals] = useState<z.infer<typeof StoredProposals>>([]);
  const [proposalId, setProposalId] = useState(() => crypto.randomUUID());
  const call = useCallback(async (input: unknown) => {
    const body = CaseRequest.parse(input);
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Not signed in.");
    const response = await fetch("/api/cases/work", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Document operation rejected (HTTP ${response.status}).`);
    const result: unknown = await response.json();
    if (!result || typeof result !== "object" || !("result" in result))
      throw new Error("Invalid native Case response.");
    return result.result;
  }, []);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      call({ operation: "list" }),
      call({ operation: "document_proposals", caseId }),
    ])
      .then(([value, decisions]) => {
        if (cancelled) return;
        const next = WorkState.parse(value);
        setState(next);
        setProposals(StoredProposals.parse(decisions));
        const record = next.cases.find((row) => row.case_id === caseId);
        if (record) {
          setSubject(record.subject);
          setPriority(record.priority);
        }
      })
      .catch((cause) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Could not load Document Work.");
      });
    return () => {
      cancelled = true;
    };
  }, [call, caseId]);
  const record = state?.cases.find((row) => row.case_id === caseId);
  const human = record?.processing_mode === "HUMAN";
  async function propose() {
    if (!record) return;
    setSaving(true);
    setError(null);
    try {
      const manifest = DocumentInputManifest.parse(record.document_input);
      await call({
        operation: "document_propose",
        proposal: {
          schemaVersion: "document-decision-v1",
          decisionId: proposalId,
          caseId,
          attemptId: record.attempt_id,
          inputHash: record.input_hash,
          documentId: record.document_id,
          sourceRef: manifest.sourceRef,
          sourceRevision: manifest.sourceRevision,
          graphRevision: null,
          ruleRevision: null,
          featureSchemaRevision: "document-features-v1",
          family: family || null,
          operation: proposalOperation,
          target: proposalOperation === "CLASSIFY" ? null : { id: targetId, name: targetName },
          automationMode: "ASSISTED",
          evidence: [{ kind: "evidence", repository: "aXtn/aXtn-agentswarms", id: evidencePath }],
        },
      });
      setProposals(StoredProposals.parse(await call({ operation: "document_proposals", caseId })));
      setProposalId(crypto.randomUUID());
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Document proposal failed.");
    } finally {
      setSaving(false);
    }
  }
  async function transition(eventType: typeof DocumentWorkTransition._output.eventType) {
    if (!record) return;
    setSaving(true);
    setError(null);
    try {
      await call({
        operation: "document_transition",
        transition: {
          caseId,
          transitionKey: `human-document:${crypto.randomUUID()}`,
          eventType,
          reasonCode: reason,
          attemptId: record.attempt_id,
          inputHash: record.input_hash,
          ...(eventType === "RELEASE"
            ? { processingMode: "DETERMINISTIC", executionChannel: "SWARM" }
            : {}),
          ...(eventType === "DETAILS"
            ? {
                details: {
                  subject,
                  priority,
                  dueDate: record.due_date ?? null,
                  followUp: record.follow_up ?? null,
                },
              }
            : {}),
          references: evidencePath
            ? [
                {
                  kind: "evidence",
                  repository: "aXtn/aXtn-agentswarms",
                  id: evidencePath,
                },
              ]
            : [],
        },
      });
      setState(WorkState.parse(await call({ operation: "list" })));
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Document operation failed.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Work Contract</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {!record ? (
          <p>Loading native Document Work...</p>
        ) : (
          <>
            <p>
              {record.status} · {record.processing_mode} · {record.execution_channel}
            </p>
            <p>Reason: {record.status_reason}</p>
            <p>
              Input manifest hash: <code>{String(record.input_hash)}</code>
            </p>
            <p>
              Current fenced attempt: <code>{record.attempt_id}</code>
            </p>
            <p>
              Human takeover uses this same Case without the LLM or Swarm orchestrator. Source
              revision, input hash and code revision are separate. Recording work does not assert
              provider success or independent acceptance.
            </p>
            <Input
              aria-label="Document Work reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button disabled={saving || human} onClick={() => void transition("TAKEOVER")}>
                Take over this Case
              </Button>
              <Button disabled={saving || !human} onClick={() => void transition("RELEASE")}>
                Release to deterministic Swarm work
              </Button>
              <Button disabled={saving || !human} onClick={() => void transition("BLOCKED")}>
                Record blocker
              </Button>
            </div>
            <Input
              aria-label="Document Work subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
            <select
              aria-label="Document Work priority"
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value))}
            >
              {[0, 1, 2, 3].map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? "0 - Human Critical" : value}
                </option>
              ))}
            </select>
            <Button
              disabled={saving || !human || !subject.trim()}
              onClick={() => void transition("DETAILS")}
            >
              Save Human work details
            </Button>
            <Input
              aria-label="Document Work evidence path"
              value={evidencePath}
              onChange={(event) => setEvidencePath(event.target.value)}
            />
            <Button
              disabled={saving || !human || !evidencePath}
              onClick={() => void transition("RESULT")}
            >
              Record work evidence
            </Button>
            <p>
              Provider effects and closure remain gated by protected approval and readback evidence.
            </p>
            <strong>Minimized decision proposal</strong>
            <p>
              No original text. This records an immutable proposal only, not Approval, source
              authorization or Filing/Delete success.
            </p>
            <Input
              aria-label="Proposed document family"
              value={family}
              onChange={(event) => setFamily(event.target.value)}
            />
            <select
              aria-label="Proposed document operation"
              value={proposalOperation}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "CLASSIFY" || value === "FILE" || value === "DELETE")
                  setProposalOperation(value);
              }}
            >
              <option value="CLASSIFY">Classify</option>
              <option value="FILE">File (proposal only)</option>
              <option value="DELETE">Delete (proposal only)</option>
            </select>
            {proposalOperation !== "CLASSIFY" && (
              <>
                <Input
                  aria-label="Proposed target identifier"
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                />
                <Input
                  aria-label="Proposed target name"
                  value={targetName}
                  onChange={(event) => setTargetName(event.target.value)}
                />
              </>
            )}
            <Button disabled={saving || !human || !evidencePath} onClick={() => void propose()}>
              Record proposal (not Approval)
            </Button>
            {proposals.map((proposal) => (
              <p key={proposal.decision_id}>
                {proposal.status} · {proposal.decision_id} · <code>{proposal.revision}</code>
              </p>
            ))}
            <strong>Durable transitions</strong>
            {state?.events
              .filter((event) => event.caseId === caseId)
              .map((event) => (
                <p key={`${event.timestamp}:${event.action}`}>
                  {event.timestamp} · {event.action}
                </p>
              ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
