import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import {
  createAccount,
  listCaseManagement,
} from "@/axtn/workbenches/cases/caseManagement.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/accounts")({ component: AccountsPage });

function AccountsPage() {
  const listFn = useServerFn(listCaseManagement);
  const createFn = useServerFn(createAccount);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  async function token() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Not signed in.");
    return data.session.access_token;
  }
  async function load() {
    try {
      setRows(
        (await listFn({ data: { access_token: await token() } })).accounts as Record<
          string,
          unknown
        >[],
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load Accounts.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function add() {
    if (!name.trim()) return;
    try {
      await createFn({ data: { access_token: await token(), name: name.trim() } });
      setName("");
      setMessage("Account created.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not create Account.");
    }
  }
  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          aXtn SupaCase Management
        </p>
        <h1 className="font-display text-2xl font-semibold">Accounts</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New Account</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            aria-label="Account name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Account name"
            value={name}
          />
          <Button disabled={!name.trim()} onClick={() => void add()}>
            Create
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length ? (
            <div className="divide-y">
              {rows.map((row) => (
                <div className="py-3" key={String(row.account_id)}>
                  <p className="font-medium">{String(row.name)}</p>
                  <p className="text-xs text-muted-foreground">
                    {String(row.account_type ?? "Account")} · {String(row.account_id).slice(0, 8)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No Accounts yet.</p>
          )}
        </CardContent>
      </Card>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
