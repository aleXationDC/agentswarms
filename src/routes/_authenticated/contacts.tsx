import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import {
  createContact,
  listCaseManagement,
} from "@/axtn/workbenches/cases/caseManagement.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/contacts")({ component: ContactsPage });

function ContactsPage() {
  const listFn = useServerFn(listCaseManagement);
  const createFn = useServerFn(createContact);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  async function token() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("Not signed in.");
    return data.session.access_token;
  }
  async function load() {
    try {
      setRows(
        (await listFn({ data: { access_token: await token() } })).contacts as Record<
          string,
          unknown
        >[],
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load Contacts.");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function add() {
    if (!name.trim()) return;
    try {
      await createFn({
        data: { access_token: await token(), name: name.trim(), email: email.trim() || null },
      });
      setName("");
      setEmail("");
      setMessage("Contact created.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not create Contact.");
    }
  }
  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          aXtn SupaCase Management
        </p>
        <h1 className="font-display text-2xl font-semibold">Contacts</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            aria-label="Contact name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            value={name}
          />
          <Input
            aria-label="Contact email"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            value={email}
          />
          <Button disabled={!name.trim()} onClick={() => void add()}>
            Create
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length ? (
            <div className="divide-y">
              {rows.map((row) => (
                <div className="py-3" key={String(row.contact_id)}>
                  <p className="font-medium">{String(row.name)}</p>
                  <p className="text-xs text-muted-foreground">
                    {String(row.email ?? "No email")} · {String(row.contact_id).slice(0, 8)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No Contacts yet.</p>
          )}
        </CardContent>
      </Card>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
