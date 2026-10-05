import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { callCaseWork } from "./caseApi";
import { CapacityPurpose, CaseCapacityRequest } from "./caseCapacityContract";

const CapacityRecord = z.object({
  id: z.string().uuid(),
  kind: z.enum(["allocation", "commitment", "consumption"]),
  caseId: z.string().uuid(),
  providerRef: z.string(),
  poolRef: z.string(),
  hours: z.number().nonnegative().optional(),
  purpose: CapacityPurpose.optional(),
  supersedes: z.string().uuid().optional(),
});
const CapacityView = z.object({
  scope: z.enum(["OWNED_LOCAL_CASES", "AUTHORIZED_CASES"]),
  canAllocate: z.boolean(),
  canCommit: z.boolean(),
  total: z.number().int().nonnegative(),
  records: z.array(CapacityRecord),
  actualHours: z.number().nonnegative(),
  purposeHours: z.record(z.string(), z.number().nonnegative()),
  capacityPeriods: z.array(
    z.object({
      allocationId: z.string().uuid(),
      providerRef: z.string(),
      poolRef: z.string(),
      startsOn: z.string(),
      endsOn: z.string(),
      netAvailableHours: z.number().nonnegative(),
      committedHours: z.number().nonnegative(),
    }),
  ),
  forecastStatus: z.literal("UNKNOWN"),
});
type Action = "allocation" | "commitment" | "consumption";

export function CaseCapacityPanel({ caseId }: { caseId?: string }) {
  const [view, setView] = useState<z.infer<typeof CapacityView> | null>(null);
  const [scope, setScope] = useState<"CURRENT" | "RECORDED">("CURRENT");
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState<Action>("allocation");
  const [provider, setProvider] = useState("");
  const [pool, setPool] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [hours, setHours] = useState("");
  const [unavailable, setUnavailable] = useState("0");
  const [parentId, setParentId] = useState("");
  const [supersedes, setSupersedes] = useState("");
  const [capability, setCapability] = useState("");
  const [purpose, setPurpose] = useState<z.infer<typeof CapacityPurpose>>("DELIVERY");
  const [identity, setIdentity] = useState(() => crypto.randomUUID());
  const [pending, setPending] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    async () =>
      CapacityView.parse(
        await callCaseWork({
          operation: "capacity_view",
          ...(caseId ? { caseId } : {}),
          scope,
          offset,
          limit: 50,
        }),
      ),
    [caseId, scope, offset],
  );
  useEffect(() => {
    let cancelled = false;
    void load()
      .then((result) => {
        if (!cancelled) {
          setView(result);
          if (!result.canAllocate || !result.canCommit) setAction("consumption");
          setError(null);
        }
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Capacity view failed.");
      });
    return () => {
      cancelled = true;
    };
  }, [load]);
  async function record() {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    try {
      if (hours === "" || (action === "allocation" && unavailable === ""))
        throw new Error("Explicit nonnegative hours are required.");
      const request = CaseCapacityRequest.parse(
        pending ?? {
          operation: `capacity_${action}`,
          expectedVersion: 0,
          transitionKey: `capacity:${identity}`,
          ...(action === "allocation"
            ? {
                allocationId: identity,
                contextCaseId: caseId,
                providerRef: provider,
                poolRef: pool,
                startsOn,
                endsOn,
                availableHours: Number(hours),
                unavailableHours: Number(unavailable),
              }
            : action === "commitment"
              ? {
                  commitmentId: identity,
                  allocationId: parentId,
                  caseId,
                  hours: Number(hours),
                }
              : {
                  consumptionId: identity,
                  commitmentId: parentId,
                  caseId,
                  bookedOn: startsOn,
                  hours: Number(hours),
                  capabilityRef: capability,
                  purpose,
                  ...(supersedes ? { supersedes } : {}),
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
      setError(cause instanceof Error ? cause.message : "Capacity write rejected.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Explicit capacity and consumption</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Calendar state time is not consumption. Provider/pool labels grant no credentials or
          authority. Human specialist is one provider, not two additive person classes.
          Unavailability is an aggregate number, without private reasons. Net is subtracted once.
        </p>
        {error && <p role="alert">{error}</p>}
        <label className="block">
          Hierarchy scope
          <select
            value={scope}
            onChange={(event) => {
              setScope(event.target.value === "RECORDED" ? "RECORDED" : "CURRENT");
              setOffset(0);
            }}
          >
            <option value="CURRENT">Current subtree</option>
            <option value="RECORDED">Recorded booking/commitment scope</option>
          </select>
        </label>
        {caseId && (
          <fieldset disabled={saving || pending !== null} className="space-y-2">
            <label className="block">
              Record type
              <select
                value={action}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next === "allocation" || next === "commitment" || next === "consumption") {
                    setAction(next);
                    setIdentity(crypto.randomUUID());
                  }
                }}
              >
                <option value="allocation" disabled={!view?.canAllocate}>
                  Allocation / calendar availability
                </option>
                <option value="commitment" disabled={!view?.canCommit}>
                  Commitment within net allocation
                </option>
                <option value="consumption">Explicit consumption / append-only correction</option>
              </select>
            </label>
            {action === "allocation" && (
              <>
                <label className="block">
                  Provider label
                  <Input value={provider} onChange={(e) => setProvider(e.target.value)} />
                </label>
                <label className="block">
                  Pool label
                  <Input value={pool} onChange={(e) => setPool(e.target.value)} />
                </label>
                <label className="block">
                  End date
                  <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
                </label>
                <label className="block">
                  Aggregate unavailable hours
                  <Input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={unavailable}
                    onChange={(e) => setUnavailable(e.target.value)}
                  />
                </label>
              </>
            )}
            {action !== "commitment" && (
              <label className="block">
                {action === "allocation" ? "Start date" : "Booking date"}
                <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
              </label>
            )}
            {action !== "allocation" && (
              <label className="block">
                {action === "commitment" ? "Allocation ID" : "Commitment ID"}
                <Input value={parentId} onChange={(e) => setParentId(e.target.value)} />
              </label>
            )}
            <label className="block">
              {action === "allocation" ? "Gross available hours" : "Hours"}
              <Input
                type="number"
                min="0"
                step="0.0001"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </label>
            {action === "consumption" && (
              <>
                <label className="block">
                  Capability label
                  <Input value={capability} onChange={(e) => setCapability(e.target.value)} />
                </label>
                <label className="block">
                  Purpose
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
                  Superseded consumption ID (optional correction)
                  <Input value={supersedes} onChange={(e) => setSupersedes(e.target.value)} />
                </label>
              </>
            )}
          </fieldset>
        )}
        {caseId && (
          <div className="flex gap-2">
            <Button disabled={saving} onClick={() => void record()}>
              {pending ? "Retry identical record" : "Record explicit hours"}
            </Button>
            {pending !== null && (
              <p>
                Unconfirmed response: retry the identical record to reconcile. No new booking
                identity is created.
              </p>
            )}
          </div>
        )}
        {view && (
          <>
            <p>
              Actual: {view.actualHours} h. Purpose: {JSON.stringify(view.purposeHours)}. Forecast /
              remaining estimate / EAC: {view.forecastStatus}.
            </p>
            {view.capacityPeriods.map((period) => (
              <p key={period.allocationId}>
                {period.providerRef} / {period.poolRef}: {period.startsOn} to {period.endsOn}, net{" "}
                {period.netAvailableHours} h, committed {period.committedHours} h. Allocation{" "}
                {period.allocationId}.
              </p>
            ))}
            <p>{view.total} authorized records; totals cover all pages.</p>
            {view.records.map((row) => (
              <p key={row.id}>
                {row.kind}: {row.id}, {row.providerRef} / {row.poolRef}
                {row.hours !== undefined ? `, ${row.hours} h` : ""}
                {row.purpose ? `, ${row.purpose}` : ""}
                {row.supersedes ? `; supersedes ${row.supersedes}` : ""}
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
