import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { confirmAsk } from "@/components/ui/confirm-dialog";
import { WorkRequest, WorkState, type WorkDependency } from "./workContract";
import { workMetrics } from "./workMetrics";
import { callCaseWork } from "./caseApi";
import { workReferences } from "./workReferences";

export function CaseWorkPanel({
  caseId,
  onChanged,
}: {
  caseId: string;
  onChanged?: () => Promise<void>;
}) {
  const [state, setState] = useState<WorkState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("MANUAL_WORK_RESULT");
  const [evidenceRepository, setEvidenceRepository] = useState("aXtn/aXtn-agentswarms");
  const [evidencePath, setEvidencePath] = useState("");
  const [evidenceRevision, setEvidenceRevision] = useState("");
  const [dependencyId, setDependencyId] = useState("");
  const [dependencyKind, setDependencyKind] =
    useState<WorkDependency["kind"]>("REQUIRES_COMPLETION");
  const [childKey, setChildKey] = useState("");
  const [childSubject, setChildSubject] = useState("");
  const [childType, setChildType] = useState("DEVELOPMENT_BUILD");
  const [approvalId, setApprovalId] = useState("");
  const [operationResult, setOperationResult] = useState<string | null>(null);
  const [manualCandidate, setManualCandidate] = useState("");
  const [manualAttempt, setManualAttempt] = useState("");
  const [manualPull, setManualPull] = useState("");

  const call = useCallback(async (value: unknown) => {
    return callCaseWork(WorkRequest.parse(value));
  }, []);
  useEffect(() => {
    let cancelled = false;
    void call({ operation: "list" })
      .then((value) => {
        if (!cancelled) setState(WorkState.parse(value));
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load Work.");
      });
    return () => {
      cancelled = true;
    };
  }, [caseId, call]);
  const record = state?.cases.find((row) => row.case_id === caseId);
  const dependencies =
    record?.dependencies ??
    (record?.required_dependencies ?? []).map((id) => ({
      caseId: id,
      kind: "REQUIRES_COMPLETION" as const,
    }));

  async function mutate(request: unknown) {
    setSaving(true);
    setError(null);
    try {
      const result = await call(request);
      setOperationResult(
        result && typeof result === "object" && "status" in result
          ? `Native operation: ${String(result.status)}`
          : "Native Work operation recorded.",
      );
      setState(WorkState.parse(await call({ operation: "list" })));
      await onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Native Work operation failed.");
    } finally {
      setSaving(false);
    }
  }
  async function transition(
    eventType:
      | "TAKEOVER"
      | "STARTED"
      | "RESULT"
      | "BLOCKED"
      | "REOPENED"
      | "COMPLETED"
      | "PROMOTED"
      | "ABANDONED",
    returnToSwarm = false,
  ) {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setError("Not signed in.");
      return;
    }
    await mutate({
      operation: "transition",
      transition: {
        caseId,
        transitionKey: `human:${caseId}:${crypto.randomUUID()}`,
        eventType,
        reasonCode: reason,
        actorRef: data.user.id,
        ...(record?.candidate_sha ? { candidateSHA: record.candidate_sha } : {}),
        ...(eventType === "TAKEOVER"
          ? {
              processingMode: returnToSwarm ? "SEMANTIC" : "HUMAN",
              executionChannel: returnToSwarm ? "SWARM" : "HUMAN",
            }
          : {}),
        ...(eventType === "RESULT" && evidencePath
          ? {
              resultRef: {
                kind: "evidence",
                repository: evidenceRepository,
                id: evidencePath,
                ...(evidenceRevision ? { revision: evidenceRevision } : {}),
              },
            }
          : {}),
        references: evidencePath
          ? [
              {
                kind: "evidence",
                repository: evidenceRepository,
                id: evidencePath,
                ...(evidenceRevision ? { revision: evidenceRevision } : {}),
              },
            ]
          : [],
      },
    });
  }
  async function verify() {
    if (!record?.candidate_sha || !record.attempt_id) {
      setError("Native Verify requires a bound candidate and attempt.");
      return;
    }
    const bytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${caseId}:${record.attempt_id}:${record.candidate_sha}`),
    );
    const effect = Array.from(new Uint8Array(bytes), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    await mutate({ operation: "verify", caseId, transitionKey: `manual-verify:${effect}` });
  }
  async function bindCandidate() {
    await mutate({
      operation: "transition",
      transition: {
        caseId,
        transitionKey: `manual-candidate:${crypto.randomUUID()}`,
        eventType: "CANDIDATE_UPDATED",
        reasonCode: "MANUAL_IMMUTABLE_CANDIDATE",
        candidateSHA: manualCandidate,
        attemptId: manualAttempt,
        actorRef: "human",
        references: [],
      },
    });
  }
  async function referencePull() {
    await mutate({
      operation: "transition",
      transition: {
        caseId,
        transitionKey: `manual-pull:${crypto.randomUUID()}`,
        eventType: "PR_CREATED",
        reasonCode: "MANUAL_PULL_REFERENCE",
        candidateSHA: record?.candidate_sha,
        actorRef: "human",
        references: [
          {
            kind: "pull_request",
            repository: evidenceRepository,
            id: manualPull,
            revision: record?.candidate_sha,
          },
        ],
      },
    });
  }
  async function createChild() {
    const { data } = await supabase.auth.getUser();
    const contract = record?.work_identity?.workContractRef ?? record?.work_contract_ref;
    const scenarioClass = record?.work_identity?.scenarioClass ?? record?.scenario_class;
    if (!data.user || !record || !contract || !scenarioClass) {
      setError("Visible exact Work contract required.");
      return;
    }
    await mutate({
      operation: "ensure",
      work: {
        ...record.work_identity,
        sourceId: `${record.work_identity?.sourceId ?? `shared-child:${caseId}`}:manual:${childKey}`,
        workContractRef: contract,
        scenarioClass,
        scenarioId: record.work_identity?.scenarioId ?? `shared-child:${caseId}:${childKey}`,
        subject: childSubject,
        caseType: childType,
        parentCaseId: caseId,
        actorRef: data.user.id,
        processingMode: "HUMAN",
        executionChannel: "HUMAN",
        requiredDependencies: [],
        references: [],
      },
    });
  }
  async function abandonWork() {
    try {
      if (
        await confirmAsk({
          title: "Consciously abandon this Work?",
          body: "The Case and Evidence remain. This records abandonment, not successful Acceptance.",
          actionLabel: "Abandon Work",
        })
      )
        await transition("ABANDONED");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not confirm abandonment.");
    }
  }
  const metrics = state ? workMetrics(state) : null;
  const evidence = record && state ? workReferences(record, state.events) : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Development Work Contract</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {operationResult && <p role="status">{operationResult}</p>}
        {!record ? (
          <p>Loading native Work...</p>
        ) : (
          <>
            <p>
              {record.status} · {record.processing_mode} · {record.execution_channel} ·{" "}
              {record.actor_ref}
            </p>
            <p>
              Candidate: <code>{record.candidate_sha ?? "Not bound"}</code>
            </p>
            <p>
              Contract:{" "}
              <code>
                {(record.work_identity?.workContractRef ?? record.work_contract_ref)?.repository}:
                {(record.work_identity?.workContractRef ?? record.work_contract_ref)?.id}
              </code>
            </p>
            <p>
              Work completion is not independent Acceptance. Deterministic hard failures cannot be
              overridden here.
            </p>
            {record.view_root_reason && (
              <p>This is a Work-view root. Its authorized parent remains in the Case workbench.</p>
            )}
            <WorkDetails
              key={`${record.case_id}:${record.updated_at}`}
              record={record}
              saving={saving}
              mutate={mutate}
            />
            <div className="space-y-2">
              <strong>Manual immutable source binding</strong>
              <p>
                Materialize the change in Gitea first. New revisions invalidate dependent gates.
              </p>
              <Input
                aria-label="Manual Candidate SHA"
                value={manualCandidate}
                onChange={(event) => setManualCandidate(event.target.value)}
              />
              <Input
                aria-label="Manual Attempt ID"
                value={manualAttempt}
                onChange={(event) => setManualAttempt(event.target.value)}
              />
              <Button
                disabled={
                  saving || !/^[a-f0-9]{40}$/.test(manualCandidate) || !manualAttempt.trim()
                }
                onClick={() => void bindCandidate()}
              >
                Bind Candidate and Attempt
              </Button>
              <Input
                aria-label="Manual Pull Request number"
                value={manualPull}
                onChange={(event) => setManualPull(event.target.value)}
              />
              <Button
                disabled={saving || !record.candidate_sha || !/^[1-9][0-9]*$/.test(manualPull)}
                onClick={() => void referencePull()}
              >
                Reference existing Pull Request
              </Button>
            </div>
            <div className="space-y-2">
              <strong>Accountable Child Work Package</strong>
              <p>Create only independently accountable work, not a node, command or retry.</p>
              <Input
                aria-label="Stable Work Package key"
                value={childKey}
                onChange={(event) => setChildKey(event.target.value)}
              />
              <Input
                aria-label="Child Work subject"
                value={childSubject}
                onChange={(event) => setChildSubject(event.target.value)}
              />
              <select
                aria-label="Child Work type"
                value={childType}
                onChange={(event) => setChildType(event.target.value)}
              >
                {[
                  "DEVELOPMENT_BUILD",
                  "DEVELOPMENT_REVIEW_SECURITY",
                  "DEVELOPMENT_REVIEW_CONTRACT",
                  "DEVELOPMENT_REVIEW_MAINTAINABILITY",
                  "DEVELOPMENT_VERIFY",
                  "DEVELOPMENT_IMPROVEMENT_CANDIDATE",
                ].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <Button
                disabled={saving || !/^[a-z0-9_-]+$/.test(childKey) || !childSubject.trim()}
                onClick={() => void createChild()}
              >
                Ensure Child Work
              </Button>
              {state?.cases
                .filter((row) => row.parent_case_id === caseId)
                .map((row) => (
                  <p key={row.case_id}>
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: row.case_id }}
                      className="underline"
                    >
                      {row.subject}
                    </Link>{" "}
                    · {row.status}
                  </p>
                ))}
            </div>
            <div className="space-y-1">
              <strong>Dependencies</strong>
              {dependencies.map((dependency) => (
                <p key={dependency.caseId}>
                  {dependency.kind}:{" "}
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: dependency.caseId }}
                    className="underline"
                  >
                    {state?.cases.find((row) => row.case_id === dependency.caseId)?.subject ??
                      dependency.caseId}
                  </Link>
                </p>
              ))}
              <div className="flex flex-wrap gap-2">
                <select
                  aria-label="Work dependency"
                  value={dependencyId}
                  onChange={(event) => setDependencyId(event.target.value)}
                >
                  <option value="">Choose Work...</option>
                  {state?.cases
                    .filter((row) => row.case_id !== caseId && row.work_identity)
                    .map((row) => (
                      <option key={row.case_id} value={row.case_id}>
                        {row.subject}
                      </option>
                    ))}
                </select>
                <select
                  aria-label="Dependency contract"
                  value={dependencyKind}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (
                      value === "REQUIRES_COMPLETION" ||
                      value === "REQUIRES_CANDIDATE" ||
                      value === "INFORMS"
                    )
                      setDependencyKind(value);
                  }}
                >
                  <option value="REQUIRES_COMPLETION">Requires completion</option>
                  <option value="REQUIRES_CANDIDATE">Requires same candidate</option>
                  <option value="INFORMS">Informs</option>
                </select>
                <Button
                  disabled={saving || !dependencyId}
                  onClick={() =>
                    void mutate({
                      operation: "dependencies",
                      caseId,
                      transitionKey: `human-dependencies:${crypto.randomUUID()}`,
                      actorRef: "human",
                      dependencies: [
                        ...dependencies.filter((row) => row.caseId !== dependencyId),
                        { caseId: dependencyId, kind: dependencyKind },
                      ],
                    })
                  }
                >
                  Set dependency
                </Button>
              </div>
            </div>
            <Input
              aria-label="Work reason code"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <Input
              aria-label="Evidence repository"
              value={evidenceRepository}
              onChange={(event) => setEvidenceRepository(event.target.value)}
            />
            <Input
              aria-label="Evidence artifact path"
              value={evidencePath}
              onChange={(event) => setEvidencePath(event.target.value)}
            />
            <Input
              aria-label="Evidence immutable revision"
              value={evidenceRevision}
              onChange={(event) => setEvidenceRevision(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button disabled={saving} onClick={() => void transition("TAKEOVER")}>
                Take over this Work
              </Button>
              <Button
                disabled={saving || record.processing_mode !== "HUMAN"}
                onClick={() => void transition("TAKEOVER", true)}
              >
                Allow Swarm processing (does not start a Run)
              </Button>
              <Button disabled={saving} onClick={() => void transition("STARTED")}>
                Record Work as started (does not start a Run)
              </Button>
              <Button disabled={saving || !evidencePath} onClick={() => void transition("RESULT")}>
                Reference result
              </Button>
              <Button disabled={saving} onClick={() => void transition("BLOCKED")}>
                Block Work
              </Button>
              <Button disabled={saving} onClick={() => void transition("REOPENED")}>
                Reopen Work
              </Button>
              <Button
                disabled={saving || !evidencePath}
                onClick={() => void transition("COMPLETED")}
              >
                Complete Work only
              </Button>
              {record.case_type === "DEVELOPMENT_IMPROVEMENT_CANDIDATE" && (
                <Button disabled={saving} onClick={() => void transition("PROMOTED")}>
                  Promote Improvement Candidate
                </Button>
              )}
              <Button disabled={saving || !evidencePath} onClick={() => void abandonWork()}>
                Abandon without Acceptance
              </Button>
            </div>
            {record.case_type === "DEVELOPMENT_VERIFY" && (
              <Button disabled={saving || record.status !== "OPEN"} onClick={() => void verify()}>
                Run native deterministic Verify
              </Button>
            )}
            {record.case_type === "DEVELOPMENT_CHANGE" && (
              <div className="space-y-2">
                <p>
                  Decide through the existing native Approval inbox first. The Builder cannot accept
                  its own result.
                </p>
                <Input
                  aria-label="Native Approval ID"
                  value={approvalId}
                  onChange={(event) => setApprovalId(event.target.value)}
                />
                {approvalId && (
                  <Link to="/review/$approvalId" params={{ approvalId }} className="underline">
                    Open native Approval
                  </Link>
                )}
                <Button
                  disabled={saving || !approvalId || !record.candidate_sha}
                  onClick={() =>
                    void mutate({
                      operation: "accept",
                      caseId,
                      transitionKey: `manual-accept:${approvalId}`,
                      approvalId,
                      candidateSHA: record.candidate_sha,
                    })
                  }
                >
                  Bind independently decided Acceptance
                </Button>
              </div>
            )}
            <strong>Authoritative references</strong>
            {evidence?.errors.map((message) => (
              <p key={message} role="alert">
                {message}
              </p>
            ))}
            {(evidence?.references ?? []).map((ref) => (
              <p key={JSON.stringify(ref)}>
                {ref.kind}:{" "}
                <code>
                  {ref.repository}:{ref.id}
                  {ref.revision ? `@${ref.revision}` : ""}
                </code>
              </p>
            ))}
            <strong>Durable transitions</strong>
            {state?.events
              .filter((event) => event.caseId === caseId)
              .map((event) => (
                <p
                  key={JSON.stringify([event.caseId, event.timestamp, event.action, event.detail])}
                >
                  {event.timestamp} · {event.action}
                </p>
              ))}
            {metrics && (
              <p>
                Shared owner metrics, all scenarios/channels included: {metrics.totalCases} Cases,{" "}
                {metrics.completedCases} completed, depth {metrics.maxDepth},{" "}
                {metrics.humanInterventions} Human interventions, {metrics.reworkEvents} rework
                events.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function WorkDetails({
  record,
  saving,
  mutate,
}: {
  record: WorkState["cases"][number];
  saving: boolean;
  mutate: (request: unknown) => Promise<void>;
}) {
  const [subject, setSubject] = useState(record.subject);
  const [priority, setPriority] = useState(record.priority);
  const [dueDate, setDueDate] = useState(record.due_date?.slice(0, 10) ?? "");
  const [followUp, setFollowUp] = useState(record.follow_up?.slice(0, 10) ?? "");
  return (
    <div className="space-y-2">
      <strong>Work details</strong>
      <Input
        aria-label="Work subject"
        value={subject}
        onChange={(event) => setSubject(event.target.value)}
      />
      <select
        aria-label="Work priority"
        value={priority}
        onChange={(event) => setPriority(Number(event.target.value))}
      >
        {[0, 1, 2, 3].map((value) => (
          <option key={value} value={value}>
            {value === 0 ? "0 — Human Critical" : value}
          </option>
        ))}
      </select>
      <Input
        aria-label="Work due date"
        type="date"
        value={dueDate}
        onChange={(event) => setDueDate(event.target.value)}
      />
      <Input
        aria-label="Work follow-up date"
        type="date"
        value={followUp}
        onChange={(event) => setFollowUp(event.target.value)}
      />
      <Button
        disabled={saving || !subject.trim()}
        onClick={() =>
          void mutate({
            operation: "details",
            caseId: record.case_id,
            transitionKey: `human-details:${crypto.randomUUID()}`,
            actorRef: "human",
            subject,
            priority,
            dueDate: dueDate || null,
            followUp: followUp || null,
          })
        }
      >
        Save Work details
      </Button>
    </div>
  );
}
