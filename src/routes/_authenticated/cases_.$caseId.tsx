import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import {
  createCase,
  createCaseRelation,
  listCaseManagement,
  updateCase,
  type CaseRecord,
} from "@/axtn/workbenches/cases/caseManagement.functions";
import type { CaseDraft } from "@/axtn/workbenches/cases/caseContract";
import { CaseWorkPanel } from "@/axtn/workbenches/cases/CaseWorkPanel";
import { CaseEnvironmentPanel } from "@/axtn/workbenches/cases/CaseEnvironmentPanel";
import { CaseProcessingPanel } from "@/axtn/workbenches/cases/CaseProcessingPanel";
import { CaseCapacityPanel } from "@/axtn/workbenches/cases/CaseCapacityPanel";
import { CasePatternPanel } from "@/axtn/workbenches/cases/CasePatternPanel";
import { CaseAssignmentPanel } from "@/axtn/workbenches/cases/CaseAssignmentPanel";
import { CaseSwarmPanel } from "@/axtn/workbenches/cases/CaseSwarmPanel";
import { DocumentWorkPanel } from "@/axtn/workbenches/documents/DocumentWorkPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/cases_/$caseId")({
  component: CaseDetailPage,
});

type ManagementData = Awaited<ReturnType<typeof listCaseManagement>>;
type RelatedRow = Record<string, unknown>;
type RelationKind = "case" | "account" | "contact" | "document";
type DisplayRelation = {
  relation_id: string;
  relation_type: string;
  target_id: string;
  target_kind: RelationKind;
};

function isRelationKind(value: unknown): value is RelationKind {
  return value === "case" || value === "account" || value === "contact" || value === "document";
}

function caseRecord(row: RelatedRow | undefined): CaseRecord | null {
  if (!row || typeof row.case_id !== "string" || typeof row.subject !== "string") return null;
  return {
    case_id: row.case_id,
    subject: row.subject,
    case_type: typeof row.case_type === "string" ? row.case_type : "TODO",
    status:
      row.status === "OPEN" || row.status === "WAITING_CONTACT" || row.status === "CLOSED"
        ? row.status
        : "NEW",
    status_reason: typeof row.status_reason === "string" ? row.status_reason : null,
    priority: typeof row.priority === "number" ? row.priority : 3,
    due_date: typeof row.due_date === "string" ? row.due_date : null,
    follow_up: typeof row.follow_up === "string" ? row.follow_up : null,
    account_id: typeof row.account_id === "string" ? row.account_id : null,
    primary_contact_id: typeof row.primary_contact_id === "string" ? row.primary_contact_id : null,
    related_entity: typeof row.related_entity === "string" ? row.related_entity : null,
    parent_case_id: typeof row.parent_case_id === "string" ? row.parent_case_id : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    closed_at: typeof row.closed_at === "string" ? row.closed_at : null,
    case_version: typeof row.case_version === "number" ? row.case_version : 0,
  };
}

function rows(data: ManagementData | null, key: "cases" | "accounts" | "contacts") {
  return (data?.[key] ?? []) as RelatedRow[];
}

function CaseDetailPage() {
  const { caseId } = Route.useParams();
  const listFn = useServerFn(listCaseManagement);
  const createFn = useServerFn(createCase);
  const updateFn = useServerFn(updateCase);
  const relateFn = useServerFn(createCaseRelation);
  const [result, setResult] = useState<ManagementData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [childSubject, setChildSubject] = useState("");
  const [targetKind, setTargetKind] = useState<"case" | "contact" | "account">("case");
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function token() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Not signed in.");
    return data.session.access_token;
  }

  async function load() {
    const accessToken = await token();
    setResult(await listFn({ data: { access_token: accessToken } }));
  }

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        if (!cancelled) setError("Not signed in.");
        return;
      }
      try {
        const current = await listFn({ data: { access_token: data.session.access_token } });
        if (!cancelled) {
          setResult(current);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load Case.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [caseId, listFn]);

  const record = caseRecord(rows(result, "cases").find((row) => row.case_id === caseId));
  const parentCase = record?.parent_case_id
    ? rows(result, "cases").find((row) => row.case_id === record.parent_case_id)
    : undefined;
  const childCases = rows(result, "cases").filter((row) => row.parent_case_id === caseId);
  const isDevelopmentWork = rows(result, "cases").some(
    (row) => row.case_id === caseId && row.source_kind === "development_work",
  );
  const isDocumentWork = rows(result, "cases").some(
    (row) => row.case_id === caseId && row.source_kind === "document_work",
  );
  const relations: DisplayRelation[] = (result?.relations ?? []).flatMap((row) => {
    if (
      row.case_id === caseId &&
      typeof row.relation_id === "string" &&
      typeof row.relation_type === "string" &&
      typeof row.target_id === "string" &&
      isRelationKind(row.target_kind)
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
  const targetKey = {
    case: "cases",
    account: "accounts",
    contact: "contacts",
  } as const;
  const targetTable = targetKey[targetKind];
  const targetIdField = {
    case: "case_id",
    account: "account_id",
    contact: "contact_id",
  } as const;
  const targetIdColumn = targetIdField[targetKind];
  const targets = rows(result, targetTable).flatMap((row) => {
    const id = row[targetIdColumn];
    if (typeof id !== "string" || (targetKind === "case" && row.case_id === caseId)) return [];
    return [{ row, id }];
  });

  async function addChild() {
    if (!childSubject.trim()) return;
    setSaving(true);
    setMessage(null);
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
      await load();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not create Child Case.");
    } finally {
      setSaving(false);
    }
  }

  async function save(patch: CaseDraft & { relevant_activity?: boolean }) {
    setSaving(true);
    setMessage(null);
    try {
      await updateFn({
        data: {
          access_token: await token(),
          case_id: caseId,
          case_version: record?.case_version ?? 0,
          subject: patch.subject ?? record?.subject ?? "",
          case_type: patch.case_type ?? record?.case_type ?? "TODO",
          status: patch.status ?? record?.status ?? "NEW",
          status_reason:
            patch.status_reason !== undefined ? patch.status_reason : record?.status_reason,
          priority: patch.priority ?? record?.priority ?? 3,
          due_date: patch.due_date !== undefined ? patch.due_date : record?.due_date,
          follow_up: patch.follow_up !== undefined ? patch.follow_up : record?.follow_up,
          account_id: patch.account_id !== undefined ? patch.account_id : record?.account_id,
          primary_contact_id:
            patch.primary_contact_id !== undefined
              ? patch.primary_contact_id
              : record?.primary_contact_id,
          related_entity:
            patch.related_entity !== undefined ? patch.related_entity : record?.related_entity,
          parent_case_id:
            patch.parent_case_id !== undefined ? patch.parent_case_id : record?.parent_case_id,
          relevant_activity: patch.relevant_activity,
          actor: "human",
        },
      });
      await load();
      setMessage("Case updated.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not update Case.");
    } finally {
      setSaving(false);
    }
  }

  async function addRelation() {
    if (!targetId) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await relateFn({
        data: {
          access_token: await token(),
          case_id: caseId,
          target_kind: targetKind,
          target_id: targetId,
        },
      });
      await load();
      setMessage(result.created ? "Relation created." : "Relation already exists.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not create relation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <Link className="text-sm underline underline-offset-4" to="/cases">
        Back to Cases
      </Link>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : result && !record ? (
        <p role="alert" className="text-sm text-destructive">
          Case is not available in your authorized scope.
        </p>
      ) : !record ? (
        <p className="text-sm text-muted-foreground">Loading Case...</p>
      ) : (
        <>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Case</p>
            <h1 className="font-display text-2xl font-semibold">{record.subject}</h1>
            <p className="text-sm text-muted-foreground">
              {record.status} · priority {record.priority} · {record.case_type}
            </p>
            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
              Case ID: {record.case_id}
            </p>
            {record.parent_case_id && (
              <p className="mt-1 text-sm text-muted-foreground">
                Child Case of{" "}
                {parentCase ? (
                  <Link
                    className="underline underline-offset-4"
                    to="/cases/$caseId"
                    params={{ caseId: record.parent_case_id }}
                  >
                    {String(parentCase.subject ?? record.parent_case_id)}
                  </Link>
                ) : (
                  record.parent_case_id
                )}
              </p>
            )}
            {childCases.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {childCases.length} child Case{childCases.length === 1 ? "" : "s"}:{" "}
                {childCases.map((child, index) => (
                  <span key={String(child.case_id)}>
                    {index > 0 ? ", " : ""}
                    <Link
                      className="underline underline-offset-4"
                      to="/cases/$caseId"
                      params={{ caseId: String(child.case_id) }}
                    >
                      {String(child.subject ?? child.case_id)}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </div>

          {isDevelopmentWork ? (
            <CaseWorkPanel caseId={caseId} onChanged={load} />
          ) : isDocumentWork ? (
            <DocumentWorkPanel caseId={caseId} onChanged={load} />
          ) : (
            <CaseEditor
              accounts={rows(result, "accounts")}
              contacts={rows(result, "contacts")}
              key={`${record.case_id}:${record.updated_at}`}
              record={record}
              saving={saving}
              onSave={save}
            />
          )}

          <section aria-label="Native work and human processing" className="space-y-3">
            <h2 className="text-lg font-semibold">Work, execution and hand-off</h2>
            <CaseSwarmPanel key={`swarm-${caseId}`} caseId={caseId} onChanged={load} />
            <CaseProcessingPanel key={`processing-${caseId}`} caseId={caseId} onChanged={load} />
          </section>
          <CaseEnvironmentPanel key={caseId} caseId={caseId} onChanged={load} />
          <CaseAssignmentPanel key={`assignment-${caseId}`} caseId={caseId} onChanged={load} />
          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">
              Capacity and pattern diagnostics
            </summary>
            <div className="mt-4 space-y-4">
              <CaseCapacityPanel key={`capacity-${caseId}`} caseId={caseId} />
              <CasePatternPanel key={`patterns-${caseId}`} caseId={caseId} />
            </div>
          </details>
          {!isDevelopmentWork && !isDocumentWork && (
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
                <Button disabled={saving || !childSubject.trim()} onClick={() => void addChild()}>
                  Create
                </Button>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Related Cases, Accounts and Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {relations.length === 0 ? (
                <p className="text-muted-foreground">No relations yet.</p>
              ) : (
                <div className="divide-y">
                  {relations.map((relation) => (
                    <RelationRow key={relation.relation_id} relation={relation} data={result} />
                  ))}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                <select
                  aria-label="Relation type"
                  className="h-10 rounded-md border bg-background px-3"
                  onChange={(event) => {
                    setTargetKind(event.target.value as typeof targetKind);
                    setTargetId("");
                  }}
                  value={targetKind}
                >
                  <option value="case">Related Case</option>
                  <option value="account">Related Account</option>
                  <option value="contact">Related Contact</option>
                </select>
                <select
                  aria-label={`Related ${targetKind}`}
                  className="h-10 rounded-md border bg-background px-3"
                  onChange={(event) => setTargetId(event.target.value)}
                  value={targetId}
                >
                  <option value="">Choose {targetKind}...</option>
                  {targets.map(({ row, id }) => {
                    const label =
                      targetKind === "case" || targetKind === "account"
                        ? String(row.subject ?? row.name ?? id)
                        : String(row.name ?? id);
                    return (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <Button disabled={saving || !targetId} onClick={() => void addRelation()}>
                  Add relation
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

function CaseEditor({
  record,
  accounts,
  contacts,
  saving,
  onSave,
}: {
  record: CaseRecord;
  accounts: RelatedRow[];
  contacts: RelatedRow[];
  saving: boolean;
  onSave: (patch: CaseDraft & { relevant_activity?: boolean }) => Promise<void>;
}) {
  const [subject, setSubject] = useState(record.subject);
  const [caseType, setCaseType] = useState(record.case_type);
  const [status, setStatus] = useState<CaseRecord["status"]>(record.status);
  const [statusReason, setStatusReason] = useState(record.status_reason ?? "");
  const [priority, setPriority] = useState(String(record.priority));
  const [accountId, setAccountId] = useState(record.account_id ?? "");
  const [contactId, setContactId] = useState(record.primary_contact_id ?? "");
  const [dueDate, setDueDate] = useState(record.due_date ?? "");
  const [followUp, setFollowUp] = useState(record.follow_up ?? "");
  const [relatedEntity, setRelatedEntity] = useState(record.related_entity ?? "");

  function patch(nextStatus = status, relevant_activity?: boolean) {
    return {
      subject,
      case_type: caseType,
      status: nextStatus,
      status_reason: statusReason || null,
      priority: Number(priority),
      due_date: dueDate || null,
      follow_up: followUp || null,
      account_id: accountId || null,
      primary_contact_id: contactId || null,
      parent_case_id: record.parent_case_id,
      related_entity: relatedEntity || null,
      relevant_activity,
    };
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Update Case</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Subject</span>
          <Input
            maxLength={500}
            onChange={(event) => setSubject(event.target.value)}
            value={subject}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Case type</span>
          <Input
            maxLength={80}
            onChange={(event) => setCaseType(event.target.value)}
            value={caseType}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Status</span>
          <select
            aria-label="Case status"
            className="h-10 w-full rounded-md border bg-background px-3"
            onChange={(event) => setStatus(event.target.value as CaseRecord["status"])}
            value={status}
          >
            <option value="NEW">New</option>
            <option value="OPEN">Open</option>
            <option value="WAITING_CONTACT">Waiting for Contact</option>
            <option value="CLOSED">Closed</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Priority (0 is Human Critical)</span>
          <select
            aria-label="Case priority"
            className="h-10 w-full rounded-md border bg-background px-3"
            onChange={(event) => setPriority(event.target.value)}
            value={priority}
          >
            {[0, 1, 2, 3].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Due date</span>
          <Input onChange={(event) => setDueDate(event.target.value)} type="date" value={dueDate} />
        </label>
        <label className="space-y-1 text-sm">
          <span>Follow-up date</span>
          <Input
            onChange={(event) => setFollowUp(event.target.value)}
            type="date"
            value={followUp}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>Account</span>
          <select
            aria-label="Primary Account"
            className="h-10 w-full rounded-md border bg-background px-3"
            onChange={(event) => setAccountId(event.target.value)}
            value={accountId}
          >
            <option value="">No Account</option>
            {accounts.map((account) =>
              typeof account.account_id === "string" ? (
                <option key={account.account_id} value={account.account_id}>
                  {String(account.name ?? account.account_id)}
                </option>
              ) : null,
            )}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Primary Contact</span>
          <select
            aria-label="Primary Contact"
            className="h-10 w-full rounded-md border bg-background px-3"
            onChange={(event) => setContactId(event.target.value)}
            value={contactId}
          >
            <option value="">No Contact</option>
            {contacts.map((contact) =>
              typeof contact.contact_id === "string" ? (
                <option key={contact.contact_id} value={contact.contact_id}>
                  {String(contact.name ?? contact.contact_id)}
                </option>
              ) : null,
            )}
          </select>
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span>Status reason</span>
          <Input
            maxLength={500}
            onChange={(event) => setStatusReason(event.target.value)}
            value={statusReason}
          />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span>Related entity</span>
          <Input
            maxLength={500}
            onChange={(event) => setRelatedEntity(event.target.value)}
            value={relatedEntity}
          />
        </label>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button disabled={saving || !subject.trim()} onClick={() => void onSave(patch())}>
            Save changes
          </Button>
          {record.status !== "CLOSED" ? (
            <Button
              disabled={saving}
              onClick={() => {
                setStatus("CLOSED");
                void onSave(patch("CLOSED"));
              }}
              variant="outline"
            >
              Close Case
            </Button>
          ) : (
            <Button
              disabled={saving}
              onClick={() => {
                setStatus("OPEN");
                setStatusReason("Reopened by user");
                void onSave({ ...patch("OPEN"), status_reason: "Reopened by user" });
              }}
              variant="outline"
            >
              Reopen Case
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RelationRow({
  relation,
  data,
}: {
  relation: DisplayRelation;
  data: ManagementData | null;
}) {
  const kind = relation.target_kind;
  const target =
    kind === "case"
      ? rows(data, "cases").find((row) => row.case_id === relation.target_id)
      : kind === "account"
        ? rows(data, "accounts").find((row) => row.account_id === relation.target_id)
        : kind === "contact"
          ? rows(data, "contacts").find((row) => row.contact_id === relation.target_id)
          : undefined;
  const label = String(target?.subject ?? target?.name ?? relation.target_id);
  return (
    <div className="py-2" key={relation.relation_id}>
      <span className="font-medium">{relation.relation_type}</span> ·{" "}
      {kind === "case" ? (
        <Link
          className="underline underline-offset-4"
          to="/cases/$caseId"
          params={{ caseId: relation.target_id }}
        >
          {label}
        </Link>
      ) : kind === "account" ? (
        <Link className="underline underline-offset-4" to="/accounts">
          {label}
        </Link>
      ) : kind === "contact" ? (
        <Link className="underline underline-offset-4" to="/contacts">
          {label}
        </Link>
      ) : kind === "document" ? (
        <Link
          className="underline underline-offset-4"
          to="/documents/$documentId"
          params={{ documentId: relation.target_id }}
        >
          {relation.target_id}
        </Link>
      ) : (
        label
      )}
    </div>
  );
}
