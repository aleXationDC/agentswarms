import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import {
  listCaseManagement,
  assignDocumentToCase,
  createCase,
  type CaseRecord,
} from "@/axtn/workbenches/cases/caseManagement.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

function records(rows: Record<string, unknown>[]): CaseRecord[] {
  return rows
    .filter(
      (row): row is CaseRecord =>
        typeof row.case_id === "string" && typeof row.subject === "string",
    )
    .map((row) => ({
      ...row,
      case_id: row.case_id as string,
      subject: row.subject as string,
      case_type: typeof row.case_type === "string" ? row.case_type : "TODO",
      status: (typeof row.status === "string" ? row.status : "NEW") as CaseRecord["status"],
      priority: typeof row.priority === "number" ? row.priority : 3,
      parent_case_id: typeof row.parent_case_id === "string" ? row.parent_case_id : null,
      status_reason: typeof row.status_reason === "string" ? row.status_reason : null,
      due_date: typeof row.due_date === "string" ? row.due_date : null,
      follow_up: typeof row.follow_up === "string" ? row.follow_up : null,
      account_id: typeof row.account_id === "string" ? row.account_id : null,
      primary_contact_id:
        typeof row.primary_contact_id === "string" ? row.primary_contact_id : null,
      related_entity: typeof row.related_entity === "string" ? row.related_entity : null,
      created_at: typeof row.created_at === "string" ? row.created_at : "",
      updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
      closed_at: typeof row.closed_at === "string" ? row.closed_at : null,
    }));
}

export function CaseRelationsPanel({ documentId }: { documentId: string }) {
  const listFn = useServerFn(listCaseManagement);
  const assignFn = useServerFn(assignDocumentToCase);
  const createFn = useServerFn(createCase);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [selectedCase, setSelectedCase] = useState("");
  const [subject, setSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Not signed in.");
    return data.session.access_token;
  }

  async function load() {
    setLoading(true);
    try {
      const result = await listFn({ data: { access_token: await token() } });
      setCases(records(result.cases));
      const relation = result.relations.find(
        (row) => row.target_kind === "document" && row.target_id === documentId,
      );
      setSelectedCase(typeof relation?.case_id === "string" ? relation.case_id : "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load Cases.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [documentId]);

  const assigned = useMemo(
    () => cases.find((item) => item.case_id === selectedCase) ?? null,
    [cases, selectedCase],
  );

  async function assign(caseId: string) {
    setMessage(null);
    try {
      await assignFn({
        data: { access_token: await token(), case_id: caseId, document_id: documentId },
      });
      setSelectedCase(caseId);
      setMessage("Case relation saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not assign Case.");
    }
  }

  async function makeCase() {
    if (!subject.trim()) return;
    setCreating(true);
    setMessage(null);
    try {
      const result = await createFn({
        data: {
          access_token: await token(),
          subject: subject.trim(),
          status: "OPEN",
          priority: 3,
          actor: "human",
        },
      });
      await assign(result.caseId);
      setSubject("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create Case.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <details className="rounded-md border" open>
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Case / Relations</summary>
      <div className="space-y-3 border-t p-3 text-sm">
        {loading ? (
          <p className="text-muted-foreground">Loading Cases...</p>
        ) : assigned ? (
          <p>
            Assigned Case:{" "}
            <Link
              className="underline underline-offset-4"
              to="/cases/$caseId"
              params={{ caseId: assigned.case_id }}
            >
              {assigned.subject}
            </Link>
            <span className="ml-2 text-xs text-muted-foreground">
              {assigned.status} · priority {assigned.priority}
            </span>
          </p>
        ) : (
          <p className="text-muted-foreground">No Case assigned yet.</p>
        )}
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <select
            aria-label="Assign existing Case"
            className="h-10 rounded-md border bg-background px-3"
            value={selectedCase}
            onChange={(event) => {
              if (event.target.value) void assign(event.target.value);
            }}
          >
            <option value="">Assign existing Case...</option>
            {cases.map((item) => (
              <option key={item.case_id} value={item.case_id}>
                {item.subject} · {item.status}
              </option>
            ))}
          </select>
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md border px-3 text-sm"
            to="/cases"
          >
            Manage Cases
          </Link>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <Input
            aria-label="New Case Subject"
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Create new Case Subject"
            value={subject}
          />
          <Button disabled={creating || !subject.trim()} onClick={() => void makeCase()}>
            {creating ? "Creating..." : "Create and assign"}
          </Button>
        </div>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </div>
    </details>
  );
}
