import { Link, createFileRoute } from "@tanstack/react-router";
import { BriefcaseBusiness, Building2, Contact, type LucideIcon } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import {
  createCase,
  listCaseManagement,
  type CaseRecord,
} from "@/axtn/workbenches/cases/caseManagement.functions";
import { CaseProcessingPanel } from "@/axtn/workbenches/cases/CaseProcessingPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/cases")({
  head: () => ({ meta: [{ title: "Cases — AgentSwarms" }] }),
  component: CasesPage,
});

function asCases(rows: Record<string, unknown>[]): CaseRecord[] {
  return rows
    .filter((row) => typeof row.case_id === "string")
    .map((row) => ({
      ...(row as CaseRecord),
      case_id: row.case_id as string,
      subject: typeof row.subject === "string" ? row.subject : "Untitled Case",
      case_type: typeof row.case_type === "string" ? row.case_type : "TODO",
      status: (typeof row.status === "string" ? row.status : "NEW") as CaseRecord["status"],
      priority: typeof row.priority === "number" ? row.priority : 3,
    }));
}

function CasesPage() {
  const listFn = useServerFn(listCaseManagement);
  const createFn = useServerFn(createCase);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function accessToken() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Not signed in.");
    return data.session.access_token;
  }
  async function load() {
    setLoading(true);
    try {
      setCases(asCases((await listFn({ data: { access_token: await accessToken() } })).cases));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load Cases.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const actionable = useMemo(() => cases.filter((item) => item.status !== "CLOSED"), [cases]);
  async function addCase() {
    if (!subject.trim()) return;
    try {
      await createFn({
        data: {
          access_token: await accessToken(),
          subject: subject.trim(),
          status: "NEW",
          priority: 3,
          actor: "human",
        },
      });
      setSubject("");
      setMessage("Case created.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create Case.");
    }
  }
  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          aXtn SupaCase Management
        </p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Case Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cockpit · {actionable.length} actionable · {cases.length} total
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <CockpitLink to="/cases" icon={BriefcaseBusiness} label="Cases" />
        <CockpitLink to="/accounts" icon={Building2} label="Accounts" />
        <CockpitLink to="/contacts" icon={Contact} label="Contacts" />
      </div>
      <Card id="case-list">
        <CardHeader>
          <CardTitle>New Case</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            aria-label="Case Subject"
            onChange={(event) => setSubject(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void addCase();
            }}
            placeholder="Subject"
            value={subject}
          />
          <Button disabled={!subject.trim()} onClick={() => void addCase()}>
            Create
          </Button>
        </CardContent>
      </Card>
      {!loading && <CaseProcessingPanel key={`scoped-${cases.length}`} />}
      <Card>
        <CardHeader>
          <CardTitle>Case list</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading Cases...</p>
          ) : cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Cases yet.</p>
          ) : (
            <div className="divide-y">
              {cases.map((item) => (
                <div className="flex items-center justify-between gap-3 py-3" key={item.case_id}>
                  <div>
                    <Link
                      className="font-medium underline underline-offset-4"
                      to="/cases/$caseId"
                      params={{ caseId: item.case_id }}
                    >
                      {item.subject}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {item.status} · priority {item.priority} · {item.case_type}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{item.case_id.slice(0, 8)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

function CockpitLink({
  to,
  icon: Icon,
  label,
}: {
  to: "/cases" | "/accounts" | "/contacts";
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link className="block" to={to}>
      <Card className="h-full transition-colors hover:border-primary">
        <CardContent className="flex items-center gap-3 p-4">
          <Icon className="h-5 w-5 text-primary" />
          <span className="font-medium">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
