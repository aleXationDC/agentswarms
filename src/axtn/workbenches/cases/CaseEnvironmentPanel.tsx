import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { callCaseWork } from "./caseApi";
import { ExternalCaseReference } from "./caseEnvironmentContract";
import { WorkState } from "./workContract";

const ReferenceState = z.object({
  case_id: z.string().uuid(),
  external_environment_id: ExternalCaseReference.nullable().optional(),
  external_ref_id: ExternalCaseReference.nullable().optional(),
  external_parent_ref_id: ExternalCaseReference.nullable().optional(),
  external_reference_version: z.number().int().nonnegative().optional(),
});

export function CaseEnvironmentPanel({
  caseId,
  onChanged,
}: {
  caseId: string;
  onChanged: () => Promise<void>;
}) {
  const [record, setRecord] = useState<z.infer<typeof ReferenceState> | null>(null);
  const [environment, setEnvironment] = useState("");
  const [reference, setReference] = useState("");
  const [parentReference, setParentReference] = useState("");
  const [integrationId, setIntegrationId] = useState("");
  const [integrationVersion, setIntegrationVersion] = useState("0");
  const [integrations, setIntegrations] = useState<{ id: string; name: string }[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const call = callCaseWork;
  const load = useCallback(
    async (cancelled: () => boolean = () => false) => {
      const state = WorkState.parse(await call({ operation: "list" }));
      const current = state.cases.find((row) => row.case_id === caseId);
      if (!current) throw new Error("Authorized Case not found.");
      const parsed = ReferenceState.parse(current);
      if (cancelled()) return;
      setRecord(parsed);
      setEnvironment(parsed.external_environment_id ?? "");
      setReference(parsed.external_ref_id ?? "");
      setParentReference(parsed.external_parent_ref_id ?? "");
    },
    [call, caseId],
  );
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      load(() => cancelled),
      supabase.from("integrations").select("id, name").eq("is_active", true),
    ])
      .then(([, response]) => {
        if (cancelled) return;
        if (response.error) throw new Error("Could not read authorized integration names.");
        setIntegrations(response.data ?? []);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Could not load references.");
      });
    return () => {
      cancelled = true;
    };
  }, [load]);
  useEffect(() => {
    if (!integrationId) return;
    let cancelled = false;
    void call({ operation: "environment_binding_state", integrationId })
      .then((response) => {
        const binding = z
          .object({
            environmentId: ExternalCaseReference.nullable(),
            enabled: z.boolean(),
            version: z.number().int().nonnegative(),
          })
          .parse(response);
        if (!cancelled) setIntegrationVersion(String(binding.version));
      })
      .catch((cause) => {
        if (!cancelled)
          setError(cause instanceof Error ? cause.message : "Binding readback failed.");
      });
    return () => {
      cancelled = true;
    };
  }, [call, integrationId]);
  async function mutate(input: unknown) {
    setSaving(true);
    setError(null);
    try {
      const response = await call(input);
      if (
        response &&
        typeof response === "object" &&
        "version" in response &&
        typeof response.version === "number"
      )
        setIntegrationVersion(String(response.version));
      const references = ReferenceState.safeParse(response);
      setResult(JSON.stringify(references.success ? references.data : response, null, 2));
      await load();
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Case environment operation failed.");
    } finally {
      setSaving(false);
    }
  }
  if (!record) return <p role="alert">{error ?? "Loading external references..."}</p>;
  return (
    <Card>
      <CardHeader>
        <CardTitle>External environment and handover</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Opaque external references are independent of local hierarchy and source identity. Saving
          references does not approve work or send a message.
        </p>
        <label className="block">
          External Environment ID
          <Input value={environment} onChange={(event) => setEnvironment(event.target.value)} />
        </label>
        <label className="block">
          External Ref ID
          <Input value={reference} onChange={(event) => setReference(event.target.value)} />
        </label>
        <label className="block">
          External Parent Ref ID
          <Input
            value={parentReference}
            onChange={(event) => setParentReference(event.target.value)}
          />
        </label>
        <Button
          disabled={saving}
          onClick={() =>
            void mutate({
              operation: "external_references",
              caseId,
              transitionKey: crypto.randomUUID(),
              expectedVersion: record.external_reference_version ?? 0,
              patch: {
                external_environment_id: environment === "" ? null : environment,
                external_ref_id: reference === "" ? null : reference,
                external_parent_ref_id: parentReference === "" ? null : parentReference,
              },
            })
          }
        >
          Save exact references
        </Button>
        <label className="block">
          Existing authorized integration
          <select
            className="block rounded border p-2"
            value={integrationId}
            onChange={(event) => setIntegrationId(event.target.value)}
          >
            <option value="">Select integration</option>
            {integrations.map((integration) => (
              <option key={integration.id} value={integration.id}>
                {integration.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Expected integration binding version
          <Input
            value={integrationVersion}
            onChange={(event) => setIntegrationVersion(event.target.value)}
          />
        </label>
        <p className="text-sm text-muted-foreground">
          Confirm only a verified counterpart identity. This never grants provider credentials.
          Correlation and export recheck the current active binding server-side.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={saving || !integrationId}
            onClick={() =>
              void mutate({
                operation: "environment_binding",
                integrationId,
                environmentId: environment,
                enabled: true,
                expectedVersion: Number(integrationVersion),
                transitionKey: crypto.randomUUID(),
              })
            }
          >
            Confirm counterpart binding
          </Button>
          <Button
            disabled={saving || !integrationId}
            onClick={() =>
              void mutate({
                operation: "environment_binding",
                integrationId,
                environmentId: environment,
                enabled: false,
                expectedVersion: Number(integrationVersion),
                transitionKey: crypto.randomUUID(),
              })
            }
          >
            Disable counterpart binding
          </Button>
          <Button
            disabled={saving}
            onClick={() =>
              void mutate({
                operation: "external_correlate",
                ...(integrationId ? { integrationId } : {}),
                external_environment_id: environment === "" ? null : environment,
                external_ref_id: reference === "" ? null : reference,
                external_parent_ref_id: parentReference === "" ? null : parentReference,
              })
            }
          >
            Check exact correlation
          </Button>
          <Button
            disabled={saving || !integrationId}
            onClick={() =>
              void mutate({
                operation: "external_handover",
                caseId,
                integrationId,
                expectedVersion: record.external_reference_version ?? 0,
              })
            }
          >
            Read minimized handover (no send)
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {result && <pre className="whitespace-pre-wrap break-all text-xs">{result}</pre>}
      </CardContent>
    </Card>
  );
}
