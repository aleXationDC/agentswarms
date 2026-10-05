import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { callCaseWork } from "./caseApi";
import { ProcessingStage, WaitingReason } from "./caseProcessingContract";
import { WorkReference } from "./workContract";

const CaseProjection = z.object({
  case_id: z.string().uuid(),
  subject: z.string(),
  status: z.string(),
  processing_stage: ProcessingStage.optional(),
  processing_version: z.number().int().nonnegative().optional(),
  waiting_reason: WaitingReason.nullable().optional(),
  required_capability_ref: WorkReference.nullable().optional(),
});
const View = z.object({
  scope: z.enum(["OWNED_LOCAL_CASES", "AUTHORIZED_CASES"]),
  rootCase: CaseProjection.nullable(),
  cases: z.array(CaseProjection),
  total: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  complete: z.boolean(),
  viewRoots: z.array(z.string().uuid()),
  processingCounts: z.record(z.string(), z.number().int().nonnegative()),
  processingDurationHours: z.record(z.string(), z.number().nonnegative()),
  forecastStatus: z.literal("UNKNOWN"),
});

export function CaseProcessingPanel({
  caseId,
  onChanged,
}: {
  caseId?: string;
  onChanged?: () => Promise<void>;
}) {
  const [view, setView] = useState<z.infer<typeof View> | null>(null);
  const [offset, setOffset] = useState(0);
  const [stage, setStage] = useState<z.infer<typeof ProcessingStage>>("ACTIVE");
  const [reason, setReason] = useState<z.infer<typeof WaitingReason>>("UNKNOWN");
  const [capability, setCapability] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(
    async () =>
      View.parse(
        await callCaseWork({
          operation: "subtree",
          ...(caseId ? { caseId } : {}),
          offset,
          limit: 50,
        }),
      ),
    [caseId, offset],
  );
  useEffect(() => {
    let cancelled = false;
    void load()
      .then((current) => {
        if (cancelled) return;
        setView(current);
        setError(null);
        setStage(current.rootCase?.processing_stage ?? "ACTIVE");
        setReason(current.rootCase?.waiting_reason ?? "UNKNOWN");
        setCapability(
          current.rootCase?.required_capability_ref
            ? JSON.stringify(current.rootCase.required_capability_ref)
            : "",
        );
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Case view failed.");
      });
    return () => {
      cancelled = true;
    };
  }, [load]);
  async function save() {
    if (!caseId || !view?.rootCase) return;
    setSaving(true);
    setError(null);
    try {
      await callCaseWork({
        operation: "processing",
        caseId,
        expectedVersion: view.rootCase.processing_version ?? 0,
        transitionKey: crypto.randomUUID(),
        reasonCode: "AUTHENTICATED_MANUAL_PROCESSING",
        patch: {
          processing_stage: stage,
          waiting_reason: stage === "ACTIVE" ? null : reason,
          required_capability_ref:
            capability === "" ? null : WorkReference.parse(JSON.parse(capability)),
        },
      });
      setView(await load());
      await onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Processing update rejected.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Processing and scoped Case view</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          This projection preserves the native lifecycle and Approval gates. Child/run work may
          proceed in parallel. Elapsed state time is not consumed hours. Forecast and capacity are
          unknown until supported by explicit evidence.
        </p>
        {error && <p role="alert">{error}</p>}
        {caseId && view?.rootCase && (
          <div className="space-y-2">
            <label className="block">
              Processing stage
              <select
                value={stage}
                onChange={(event) => setStage(ProcessingStage.parse(event.target.value))}
              >
                {ProcessingStage.options.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="block">
              Waiting reason
              <select
                value={reason}
                onChange={(event) => setReason(WaitingReason.parse(event.target.value))}
              >
                {WaitingReason.options.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="block">
              Required capability (canonical typed reference JSON)
              <Input value={capability} onChange={(event) => setCapability(event.target.value)} />
            </label>
            <Button disabled={saving} onClick={() => void save()}>
              Record processing
            </Button>
          </div>
        )}
        {view && (
          <>
            <p>
              {view.total} authorized Cases. Page {view.offset + 1}–
              {Math.min(view.offset + view.limit, view.total)}. Full totals are independent of
              paging. Scope: {view.scope}.
            </p>
            <p>
              Recorded calendar state-hours (may overlap across Cases; not consumption):{" "}
              {JSON.stringify(view.processingDurationHours)}. Earlier unrecorded history is unknown.
            </p>
            <p>
              Processing counts: {JSON.stringify(view.processingCounts)}. Forecast:{" "}
              {view.forecastStatus}.
            </p>
            {!caseId && (
              <div className="space-y-1">
                <p>Authorized view roots (a missing out-of-scope ancestor is not exposed):</p>
                {view.viewRoots.map((root) => (
                  <p key={root}>
                    <Link to="/cases/$caseId" params={{ caseId: root }}>
                      Open root {root}
                    </Link>
                  </p>
                ))}
              </div>
            )}
            <div className="space-y-1">
              {view.cases.map((row) => (
                <p key={row.case_id}>
                  <Link to="/cases/$caseId" params={{ caseId: row.case_id }}>
                    {row.subject}
                  </Link>
                  {" — "}
                  {row.status === "CLOSED"
                    ? "DONE (lifecycle projection, not Acceptance)"
                    : (row.processing_stage ?? "UNKNOWN")}
                  {row.waiting_reason ? ` / ${row.waiting_reason}` : ""}
                </p>
              ))}
            </div>
            <div className="flex gap-2">
              <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>
                Previous
              </Button>
              <Button
                disabled={offset + view.limit >= view.total}
                onClick={() => setOffset(offset + 50)}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
