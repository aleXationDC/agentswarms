import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { startCaseSwarm } from "./caseSwarm.functions";
import { classifySwarmUsage, type SwarmUsageRow } from "@/lib/swarmUsage";

type Swarm = Pick<
  Database["public"]["Tables"]["swarms"]["Row"],
  | "id"
  | "name"
  | "description"
  | "published_version_id"
  | "published_at"
  | "nodes"
  | "edges"
  | "published_nodes"
  | "published_edges"
>;
type Run = Pick<
  Database["public"]["Tables"]["swarm_runs"]["Row"],
  | "id"
  | "swarm_id"
  | "swarm_name"
  | "status"
  | "final_output"
  | "error_message"
  | "case_attempt_id"
  | "swarm_snapshot"
>;

export function CaseSwarmPanel({
  caseId,
  onChanged,
}: {
  caseId: string;
  onChanged?: () => Promise<void>;
}) {
  const start = useServerFn(startCaseSwarm);
  const [swarms, setSwarms] = useState<Swarm[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [approvals, setApprovals] = useState<
    { id: string; swarm_run_id: string | null; status: string }[]
  >([]);
  const [swarmId, setSwarmId] = useState("");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<{
    caseId: string;
    swarmId: string;
    publishedVersionId: string;
    operationKey: string;
    input: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entrySwarms = useMemo(() => {
    const usage = classifySwarmUsage(swarms as SwarmUsageRow[]);
    return swarms.filter((swarm) => usage.get(swarm.id)?.category === "workflow");
  }, [swarms]);
  const selected = entrySwarms.find((swarm) => swarm.id === swarmId);
  const load = useCallback(async () => {
    const [{ data: available, error: swarmError }, { data: persisted, error: runError }] =
      await Promise.all([
        supabase
          .from("swarms")
          .select(
            "id,name,description,published_version_id,published_at,nodes,edges,published_nodes,published_edges",
          )
          .not("published_version_id", "is", null)
          .order("name"),
        supabase
          .from("swarm_runs")
          .select(
            "id,swarm_id,swarm_name,status,final_output,error_message,case_attempt_id,swarm_snapshot",
          )
          .eq("case_id", caseId)
          .order("started_at", { ascending: false })
          .limit(20),
      ]);
    if (swarmError) throw swarmError;
    if (runError) throw runError;
    const ids = persisted.map((run) => run.id);
    const decisions = ids.length
      ? await supabase.from("approvals").select("id,swarm_run_id,status").in("swarm_run_id", ids)
      : { data: [], error: null };
    if (decisions.error) throw decisions.error;
    setSwarms(available);
    setRuns(persisted);
    setApprovals(decisions.data ?? []);
  }, [caseId]);
  useEffect(() => {
    void load().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Native Swarm view unavailable."),
    );
  }, [load]);
  async function execute() {
    if (!pending && !selected?.published_version_id) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Not signed in.");
      const request = pending ?? {
        caseId,
        swarmId,
        publishedVersionId: selected!.published_version_id!,
        operationKey: crypto.randomUUID(),
        input,
      };
      setPending(request);
      const result = await start({ data: { ...request, access_token: data.session.access_token } });
      await load();
      await onChanged?.();
      if (result.error) throw new Error(result.error);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Native Case Swarm execution failed.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Native Case Work Swarm</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3" aria-label="Native Case Work Swarm">
        <p className="text-sm">
          Explicit published snapshot, native server execution and persisted Run on this Case.
          Allowing Swarm processing does not start a Run. A result does not grant independent
          Acceptance.
        </p>
        <p className="text-xs text-muted-foreground">
          Only published entry workflows and orchestrators are startable here. Reusable sub-swarms,
          standalone helpers and drafts remain in the complete Swarm Library and are not deleted.
        </p>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        <select
          aria-label="Published Case Swarm"
          value={swarmId}
          disabled={saving || pending !== null}
          onChange={(event) => setSwarmId(event.target.value)}
        >
          <option value="">Choose an explicitly published Swarm</option>
          {entrySwarms.map((swarm) => (
            <option key={swarm.id} value={swarm.id}>
              {swarm.name}
            </option>
          ))}
        </select>
        {selected && (
          <>
            <p>{selected.description}</p>
            <p>
              Published revision: <code>{selected.published_version_id}</code>
            </p>
            <Link
              to="/swarms"
              search={{ swarm: selected.id, view: "canvas" }}
              className="underline"
            >
              Inspect selected Swarm in Canvas
            </Link>
          </>
        )}
        <Textarea
          aria-label="Minimized Case work intent"
          value={input}
          maxLength={8000}
          disabled={saving || pending !== null}
          onChange={(event) => setInput(event.target.value)}
          placeholder="State the bounded work intent; do not include credentials or original documents."
        />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={saving || (!pending && (!selected || !input.trim()))}
            onClick={() => void execute()}
          >
            {pending ? "Read back / retry same native Run" : "Start published Case Swarm"}
          </Button>
          <Button variant="outline" disabled={saving || !pending} onClick={() => setPending(null)}>
            Prepare a new explicit attempt
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() =>
              void load().catch((cause) =>
                setError(cause instanceof Error ? cause.message : "Native Run readback failed."),
              )
            }
          >
            Refresh persisted Runs
          </Button>
        </div>
        {runs.map((run) => {
          const snapshot = run.swarm_snapshot;
          const revision =
            snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
              ? snapshot.publishedVersionId
              : undefined;
          return (
            <div key={run.id} className="space-y-1 rounded border p-3">
              <p>
                {run.swarm_name} · {run.status}
              </p>
              <p>
                Run <code>{run.id}</code> · Attempt{" "}
                <code>{run.case_attempt_id ?? "No binding"}</code>
              </p>
              <p>
                Published revision{" "}
                <code>{typeof revision === "string" ? revision : "Historical snapshot"}</code>
              </p>
              {run.swarm_id && (
                <Link
                  to="/swarms"
                  search={{ swarm: run.swarm_id, view: "canvas" }}
                  className="underline"
                >
                  Open Swarm Canvas
                </Link>
              )}
              {run.error_message && (
                <p className="text-destructive">Recorded failure: {run.error_message}</p>
              )}
              {run.final_output && (
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                  {run.final_output}
                </pre>
              )}
              {approvals
                .filter((approval) => approval.swarm_run_id === run.id)
                .map((approval) => (
                  <p key={approval.id}>
                    <Link
                      to="/review/$approvalId"
                      params={{ approvalId: approval.id }}
                      className="underline"
                    >
                      Native decision / resume: {approval.status}
                    </Link>
                  </p>
                ))}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
