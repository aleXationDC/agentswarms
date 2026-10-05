import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { callCaseWork } from "./caseApi";
import {
  CasePatternRequest,
  PatternArtifactReference,
  PatternClassification,
  PatternHypothesis,
  PatternOutcome,
} from "./casePatternContract";
import { WorkReference } from "./workContract";
import { CapacityPurpose } from "./caseCapacityContract";

const Usage = z.object({
  usageId: z.string().uuid(),
  caseId: z.string().uuid(),
  version: z.number().int().positive(),
  artifact: PatternArtifactReference,
  purpose: CapacityPurpose,
  ...PatternClassification,
  outcome: PatternOutcome,
  evidence: z.array(WorkReference),
  improvementCaseId: z.string().uuid().optional(),
});
const PatternView = z.object({
  scope: z.literal("OWNED_LOCAL_CASES"),
  total: z.number().int().nonnegative(),
  usages: z.array(Usage),
  artifacts: z.array(
    z.object({
      artifact: PatternArtifactReference,
      distinctCaseCount: z.number().int().nonnegative(),
      positiveCount: z.number().int().nonnegative(),
      negativeCount: z.number().int().nonnegative(),
      unknownCount: z.number().int().nonnegative(),
    }),
  ),
  forecastStatus: z.literal("EXPERIMENTAL_DISABLED"),
  acceptanceGranted: z.literal(false),
});
type Action = "pattern_usage" | "pattern_assurance" | "pattern_improvement";

export function CasePatternPanel({ caseId }: { caseId?: string }) {
  const [view, setView] = useState<z.infer<typeof PatternView> | null>(null);
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState<Action>("pattern_usage");
  const [selectedId, setSelectedId] = useState("");
  const [artifact, setArtifact] = useState("");
  const [evidence, setEvidence] = useState("");
  const [rClass, setRClass] = useState<z.infer<typeof PatternClassification.rClass>>("R0");
  const [eClass, setEClass] = useState<z.infer<typeof PatternClassification.eClass>>("E0");
  const [iClass, setIClass] = useState<z.infer<typeof PatternClassification.iClass>>("I0");
  const [outcome, setOutcome] = useState<z.infer<typeof PatternOutcome>>("UNKNOWN");
  const [purpose, setPurpose] = useState<z.infer<typeof CapacityPurpose>>("DELIVERY");
  const [hypothesis, setHypothesis] = useState<z.infer<typeof PatternHypothesis>>("REWORK");
  const [scenarioClass, setScenarioClass] = useState<
    "real_work" | "synthetic_acceptance" | "regression"
  >("synthetic_acceptance");
  const [identity, setIdentity] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    async () =>
      PatternView.parse(
        await callCaseWork({
          operation: "pattern_view",
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
      .then((result) => {
        if (!cancelled) {
          setView(result);
          setError(null);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Pattern view failed.");
      });
    return () => {
      cancelled = true;
    };
  }, [load]);
  const selected = view?.usages.find(
    (usage) => usage.usageId === selectedId && usage.caseId === caseId,
  );
  async function record() {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    try {
      if (action !== "pattern_usage" && !selected)
        throw new Error("Select a usage on this Case and its displayed version.");
      const request = CasePatternRequest.parse(
        pending ?? {
          operation: action,
          caseId,
          usageId: action === "pattern_usage" ? identity : selectedId,
          expectedVersion: action === "pattern_usage" ? 0 : selected?.version,
          transitionKey: `pattern:${identity}`,
          ...(action === "pattern_improvement"
            ? {
                hypothesis,
                scenarioClass,
                signal: JSON.parse(evidence),
              }
            : {
                rClass,
                eClass,
                iClass,
                evidence: JSON.parse(evidence),
                ...(action === "pattern_usage"
                  ? { artifact: JSON.parse(artifact), outcome, purpose }
                  : {}),
              }),
        },
      );
      setPending(request);
      await callCaseWork(request);
      setPending(null);
      setIdentity(crypto.randomUUID());
      setView(await load());
    } catch (cause) {
      if (cause instanceof Error && /^CASE_[A-Z0-9_]+$/.test(cause.message)) {
        setPending(null);
        setIdentity(crypto.randomUUID());
      }
      setError(cause instanceof Error ? cause.message : "Pattern operation rejected.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Versioned Pattern Usage and learning candidates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Existing Git/skill artifacts are referenced at exact revisions. R/E/I are ordinal classes,
          not multipliers. Reuse counts demonstrate samples, not ROI or causality. Assurance
          reclassification does not grant Acceptance. Improvement requires the existing native Human
          promotion, Work/verification and independent gates.
        </p>
        {error && <p role="alert">{error}</p>}
        {caseId && (
          <>
            <fieldset disabled={saving || pending !== null} className="space-y-2">
              <label className="block">
                Operation
                <select
                  value={action}
                  onChange={(e) => {
                    const next = e.target.value;
                    if (
                      next === "pattern_usage" ||
                      next === "pattern_assurance" ||
                      next === "pattern_improvement"
                    ) {
                      setAction(next);
                      setIdentity(crypto.randomUUID());
                    }
                  }}
                >
                  <option value="pattern_usage">Record versioned usage</option>
                  <option value="pattern_assurance">
                    Evidence-based reclassification (not Acceptance)
                  </option>
                  <option value="pattern_improvement">Signal to existing Improvement Work</option>
                </select>
              </label>
              {action !== "pattern_usage" && (
                <label className="block">
                  This Case's usage
                  <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                    <option value="">Select usage</option>
                    {view?.usages
                      .filter((usage) => usage.caseId === caseId)
                      .map((usage) => (
                        <option key={usage.usageId} value={usage.usageId}>
                          {usage.usageId} v{usage.version}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {action === "pattern_usage" && (
                <>
                  <label className="block">
                    Artifact/evidence purpose
                    <select
                      value={purpose}
                      onChange={(e) => setPurpose(CapacityPurpose.parse(e.target.value))}
                    >
                      {CapacityPurpose.options.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    Versioned artifact reference JSON
                    <Input value={artifact} onChange={(e) => setArtifact(e.target.value)} />
                  </label>
                  <label className="block">
                    Observed outcome
                    <select
                      value={outcome}
                      onChange={(e) => setOutcome(PatternOutcome.parse(e.target.value))}
                    >
                      {PatternOutcome.options.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              {action !== "pattern_improvement" ? (
                <div className="flex gap-2">
                  <label>
                    R class
                    <select
                      value={rClass}
                      onChange={(e) =>
                        setRClass(PatternClassification.rClass.parse(e.target.value))
                      }
                    >
                      {PatternClassification.rClass.options.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    E class
                    <select
                      value={eClass}
                      onChange={(e) =>
                        setEClass(PatternClassification.eClass.parse(e.target.value))
                      }
                    >
                      {PatternClassification.eClass.options.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    I class
                    <select
                      value={iClass}
                      onChange={(e) =>
                        setIClass(PatternClassification.iClass.parse(e.target.value))
                      }
                    >
                      {PatternClassification.iClass.options.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <>
                  <label className="block">
                    Hypothesis
                    <select
                      value={hypothesis}
                      onChange={(e) => setHypothesis(PatternHypothesis.parse(e.target.value))}
                    >
                      {PatternHypothesis.options.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    Scenario
                    <select
                      value={scenarioClass}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (
                          value === "real_work" ||
                          value === "synthetic_acceptance" ||
                          value === "regression"
                        )
                          setScenarioClass(value);
                      }}
                    >
                      <option value="synthetic_acceptance">Synthetic experiment</option>
                      <option value="regression">Regression</option>
                      <option value="real_work">Authorized real work</option>
                    </select>
                  </label>
                </>
              )}
              <label className="block">
                {action === "pattern_improvement"
                  ? "Exact signal evidence reference JSON"
                  : "Exact minimized evidence references JSON array"}
                <Input value={evidence} onChange={(e) => setEvidence(e.target.value)} />
              </label>
            </fieldset>
            <Button disabled={saving} onClick={() => void record()}>
              {pending ? "Retry identical request" : "Record with native audit"}
            </Button>
            {pending !== null && (
              <p>Unconfirmed response: reconcile this same request, not another usage.</p>
            )}
          </>
        )}
        {view && (
          <>
            <p>
              {view.total} usages; full artifact/reuse counts are independent of paging. Forecasts:{" "}
              {view.forecastStatus}. ROI: UNKNOWN.
            </p>
            {view.artifacts.map((item) => (
              <p key={JSON.stringify(item.artifact)}>
                {item.artifact.id}@{item.artifact.revision}: {item.distinctCaseCount} distinct
                Cases,
                {item.positiveCount} positive / {item.negativeCount} negative / {item.unknownCount}{" "}
                unknown.
              </p>
            ))}
            {view.usages.map((usage) => (
              <p key={`${usage.caseId}:${usage.usageId}`}>
                {usage.usageId} v{usage.version}: {usage.rClass}/{usage.eClass}/{usage.iClass},{" "}
                {usage.outcome}; purpose {usage.purpose}.
                {usage.improvementCaseId
                  ? ` Native Improvement Case: ${usage.improvementCaseId} (no automatic promotion).`
                  : ""}
              </p>
            ))}
            <div className="flex gap-2">
              <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>
                Previous
              </Button>
              <Button disabled={offset + 50 >= view.total} onClick={() => setOffset(offset + 50)}>
                Next
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
