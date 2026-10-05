import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { callCaseWork } from "./caseApi";
import { CaseAccessView, CaseAssignment } from "./caseAssignmentContract";

export function CaseAssignmentPanel({
  caseId,
  onChanged,
}: {
  caseId: string;
  onChanged?: () => Promise<void>;
}) {
  const [current, setCurrent] = useState<ScopedCase | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<
    | ({
        operation: "case_assignment";
        caseId: string;
        transitionKey: string;
        expectedVersion: number;
      } & ReturnType<typeof CaseAssignment.parse>)
    | null
  >(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const view = CaseAccessView.parse(
      await callCaseWork({
        operation: "case_access",
        caseId,
        sharedOnly: false,
        offset: 0,
        limit: 1,
      }),
    );
    const row = view.cases[0];
    if (!row) throw new Error("CASE_ACCESS_DENIED");
    return row;
  }, [caseId]);
  useEffect(() => {
    let cancelled = false;
    void load()
      .then((row) => {
        if (cancelled) return;
        setCurrent(row);
        setDraft(
          JSON.stringify(
            {
              responsiblePrincipalType: row.responsible_principal_type,
              responsiblePrincipalId: row.responsible_principal_id,
              assigneeUserId: row.assignee_user_id,
              assignmentPolicy: row.assignment_policy,
              assignmentInheritance: row.assignment_inheritance,
              semanticRouteMode: row.semantic_route_mode,
              semanticRouteProviderId: row.semantic_route_provider_id,
              semanticRouteModelId: row.semantic_route_model_id,
            },
            null,
            2,
          ),
        );
        setError(null);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Case responsibility unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [load]);
  async function save() {
    if (!current || current.case_access_mode !== "CUSTODIAN") return;
    setSaving(true);
    setError(null);
    try {
      if (typeof current.assignment_version !== "number")
        throw new Error("CASE_ASSIGNMENT_VERSION_REQUIRED");
      const request = pending ?? {
        operation: "case_assignment" as const,
        caseId,
        transitionKey: crypto.randomUUID(),
        expectedVersion: current.assignment_version,
        ...CaseAssignment.parse(JSON.parse(draft)),
      };
      setPending(request);
      await callCaseWork(request);
      setPending(null);
      setCurrent(await load());
      await onChanged?.();
    } catch (cause) {
      if (cause instanceof Error && /^CASE_[A-Z0-9_]+$/.test(cause.message)) {
        setPending(null);
      }
      setError(cause instanceof Error ? cause.message : "Responsibility update failed.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Case responsibility</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {current && (
          <>
            <p className="text-sm">
              {String(current.responsible_principal_type)} ·{" "}
              {String(current.responsible_principal_id ?? "SYSTEM")}
              {" · version "}
              {String(current.assignment_version)} · {current.case_access_mode}
            </p>
            <p className="text-sm text-muted-foreground">
              Responsibility does not transfer custody, credentials or Acceptance authority. Route
              metadata is not proof of an execution binding.
            </p>
            {current.case_access_mode === "CUSTODIAN" && (
              <>
                <Textarea
                  aria-label="Case responsibility and route"
                  value={draft}
                  disabled={saving || pending !== null}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={12}
                />
                <Button disabled={saving} onClick={() => void save()}>
                  {pending ? "Reconcile same assignment" : "Update responsibility"}
                </Button>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

type ScopedCase = ReturnType<typeof CaseAccessView.parse>["cases"][number];
