import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { createCase, listCaseManagement } from "@/axtn/workbenches/cases/caseManagement.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/cases_/$caseId")({
  component: CaseDetailPage,
});

function CaseDetailPage() {
  const { caseId } = Route.useParams();
  const listFn = useServerFn(listCaseManagement);
  const createFn = useServerFn(createCase);
  const [result, setResult] = useState<Awaited<ReturnType<typeof listCaseManagement>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [childSubject, setChildSubject] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  async function token() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Not signed in.");
    return data.session.access_token;
  }
  useEffect(() => {
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) return setError("Not signed in.");
      try {
        setResult(await listFn({ data: { access_token: data.session.access_token } }));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load Case.");
      }
    });
  }, [caseId]);
  async function addChild() {
    if (!childSubject.trim()) return;
    try {
      await createFn({
        data: {
          access_token: await token(),
          parent_case_id: caseId,
          subject: childSubject.trim(),
          status: "NEW",
          priority: 3,
          actor: "human",
        },
      });
      setChildSubject("");
      setMessage("Child Case created.");
      setResult(await listFn({ data: { access_token: await token() } }));
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not create Child Case.");
    }
  }
  const item = result?.cases.find((row) => row.case_id === caseId) as
    | Record<string, unknown>
    | undefined;
  const relations = (result?.relations ?? []).flatMap((row) => {
    if (
      row.case_id === caseId &&
      typeof row.relation_id === "string" &&
      typeof row.relation_type === "string" &&
      typeof row.target_id === "string" &&
      typeof row.target_kind === "string"
    ) {
      return [
        {
          relation_id: row.relation_id,
          relation_type: row.relation_type,
          target_id: row.target_id,
          target_kind: row.target_kind,
        },
      ];
    }
    return [];
  });
  return (
    <div className="space-y-6 p-6">
      <Link className="text-sm underline underline-offset-4" to="/cases">
        Back to Cases
      </Link>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !item ? (
        <p className="text-sm text-muted-foreground">Loading Case...</p>
      ) : (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Case</p>
            <h1 className="font-display text-2xl font-semibold">{String(item.subject)}</h1>
            <p className="text-sm text-muted-foreground">
              {String(item.status)} · priority {String(item.priority)} · {String(item.case_type)}
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>New Child Case</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Input
                aria-label="Child Case Subject"
                onChange={(event) => setChildSubject(event.target.value)}
                placeholder="Child Case Subject"
                value={childSubject}
              />
              <Button disabled={!childSubject.trim()} onClick={() => void addChild()}>
                Create
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Case details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <Field label="Status reason" value={item.status_reason} />
              <Field label="Due date" value={item.due_date} />
              <Field label="Follow up" value={item.follow_up} />
              <Field label="Account" value={item.account_id} />
              <Field label="Primary Contact" value={item.primary_contact_id} />
              <Field label="Parent Case" value={item.parent_case_id} />
            </CardContent>
          </Card>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          <Card>
            <CardHeader>
              <CardTitle>Related Documents / Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {relations.length === 0 ? (
                <p className="text-muted-foreground">No relations yet.</p>
              ) : (
                relations.map((relation) => (
                  <div key={relation.relation_id}>
                    <span className="font-medium">{relation.relation_type}</span> ·{" "}
                    {relation.target_kind === "document" ? (
                      <Link
                        className="underline underline-offset-4"
                        to="/documents/$documentId"
                        params={{ documentId: relation.target_id }}
                      >
                        {relation.target_id}
                      </Link>
                    ) : (
                      relation.target_id
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{typeof value === "string" && value ? value : "—"}</dd>
    </div>
  );
}
