// /system-extensions — the single authenticated "System Extensions" area for
// aleXation One: status, configuration, and entry points for the small set
// of infrastructure surfaces that sit alongside AgentSwarms (Matrix system
// access, the Maintenance Gate, and "open in new tab" links to Gitea/n8n/
// Renovate/System Monitor). AgentSwarms remains the primary human entry
// point and the only authenticated admin surface: this page does not
// reimplement Gitea/n8n/Renovate's own UIs, it only surfaces status +
// config + a link out to their native UI.
import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, Loader2, Puzzle, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useIsSuperadmin } from "@/hooks/use-iam";
import {
  sysExtCloseMaintenance,
  sysExtGetState,
  sysExtUpdateMaintenanceConfig,
  sysExtUpdateMatrixAccess,
  type SysExtState,
} from "@/utils/systemExtensions.functions";

export const Route = createFileRoute("/_authenticated/system-extensions")({
  head: () => ({
    meta: [
      { title: "System Extensions — AgentSwarms" },
      {
        name: "description",
        content:
          "Status, configuration, and entry points for Matrix system access, the Maintenance Gate, and connected infrastructure (Gitea, n8n, Renovate, System Monitor).",
      },
    ],
  }),
  component: SystemExtensionsPage,
});

function SystemExtensionsPage() {
  const { user, session } = useAuth();
  const isSuperadmin = useIsSuperadmin();
  const token = session?.access_token;

  if (!user) return null;

  if (!isSuperadmin) {
    return (
      <div className="p-6">
        <Card className="mx-auto mt-12 max-w-lg border-destructive/40">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <h2 className="mb-1 text-lg font-semibold">Restricted area</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              System Extensions are only available to superadmins.
            </p>
            <Link to="/dashboard" className="text-sm text-primary hover:underline">
              Go back to dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Admin
        </p>
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold tracking-tight">
          <Puzzle className="h-6 w-6 text-primary" /> System Extensions
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          AgentSwarms is the single human entry point for aleXation One. Gitea, n8n, Renovate and
          the System Monitor are not rebuilt here — this page shows their status and a link to their
          native UI.
        </p>
      </div>
      <div className="max-w-3xl">
        <SystemExtensionsTabs token={token!} />
      </div>
    </div>
  );
}

function SystemExtensionsTabs({ token }: { token: string }) {
  const [state, setState] = useState<SysExtState | null>(null);
  const [loading, setLoading] = useState(true);

  const getStateFn = useServerFn(sysExtGetState);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await getStateFn({ data: { access_token: token } });
    if (!res.ok) {
      toast.error(res.error);
    } else {
      setState(res);
    }
    setLoading(false);
  }, [getStateFn, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loading || !state) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <Tabs defaultValue="matrix" className="w-full">
      <TabsList>
        <TabsTrigger value="monitor">System Monitor</TabsTrigger>
        <TabsTrigger value="matrix">Matrix</TabsTrigger>
        <TabsTrigger value="maintenance">Maintenance Access</TabsTrigger>
        <TabsTrigger value="gitea">Gitea</TabsTrigger>
        <TabsTrigger value="renovate">Renovate</TabsTrigger>
        <TabsTrigger value="n8n">n8n</TabsTrigger>
        <TabsTrigger value="matrix-admin">Matrix Admin</TabsTrigger>
      </TabsList>

      <TabsContent value="monitor">
        <ExtensionLinkCard
          title="System Monitor"
          description="Host/service health overview."
          link={state.extensions.find((e) => e.key === "system_monitor") ?? null}
        />
      </TabsContent>

      <TabsContent value="matrix">
        <MatrixAccessCard token={token} state={state} onSaved={reload} />
      </TabsContent>

      <TabsContent value="maintenance">
        <MaintenanceAccessCard token={token} state={state} onSaved={reload} />
      </TabsContent>

      <TabsContent value="gitea">
        <ExtensionLinkCard
          title="Gitea"
          description="Source of truth for aleXation One repositories. Full Gitea UI opens in a new tab; not reimplemented here."
          link={state.extensions.find((e) => e.key === "gitea") ?? null}
          publicTarget="gitea"
          maintenanceOpen={state.maintenance.status === "OPEN"}
          token={token}
        />
      </TabsContent>

      <TabsContent value="renovate">
        <ExtensionLinkCard
          title="Renovate"
          description="Dependency update automation. Configured natively in-repo (renovate.json); this is a status/entry point only."
          link={state.extensions.find((e) => e.key === "renovate") ?? null}
        />
      </TabsContent>

      <TabsContent value="n8n">
        <ExtensionLinkCard
          title="n8n"
          description="Workflow automation. Not part of the Matrix↔AgentSwarms conversation path — this is a status/entry point only."
          link={state.extensions.find((e) => e.key === "n8n") ?? null}
          publicTarget="n8n"
          maintenanceOpen={state.maintenance.status === "OPEN"}
          token={token}
        />
      </TabsContent>

      <TabsContent value="matrix-admin">
        <ExtensionLinkCard
          title="Matrix Admin"
          description="Native Ketesa administration UI for the Matrix homeserver. It opens in a new tab and keeps its own Matrix administrator authentication."
          link={state.extensions.find((e) => e.key === "matrix_admin") ?? null}
          publicTarget="matrix_admin"
          maintenanceOpen={state.maintenance.status === "OPEN"}
          token={token}
        />
      </TabsContent>
    </Tabs>
  );
}

function ExtensionLinkCard({
  title,
  description,
  link,
  publicTarget,
  maintenanceOpen,
  token,
}: {
  title: string;
  description: string;
  link: { url: string | null } | null;
  // When set, this extension also supports the generic one-use ticket
  // launch for public (non-Tailscale) access, gated by Maintenance status.
  publicTarget?: "gitea" | "n8n" | "matrix_admin";
  maintenanceOpen?: boolean;
  token?: string;
}) {
  const [launching, setLaunching] = useState(false);

  const launchPublicly = async () => {
    setLaunching(true);
    try {
      const res = await fetch("/api/system-extensions/request-access-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token, target: publicTarget }),
      });
      const body = (await res.json()) as { ok: boolean; redirect_url?: string; error?: string };
      if (!body.ok || !body.redirect_url) {
        toast.error(body.error ?? "Could not create a public access ticket");
        return;
      }
      window.open(body.redirect_url, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Could not reach AgentSwarms to issue an access ticket");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {link?.url ? (
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={link.url} target="_blank" rel="noreferrer noopener">
              Open via Tailscale <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Not configured. Set the corresponding URL environment variable to enable this link.
          </p>
        )}
        {publicTarget && (
          <div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={!maintenanceOpen || launching}
              onClick={launchPublicly}
            >
              {launching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Launch publicly (one-use link) <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            {!maintenanceOpen && (
              <p className="mt-1 text-xs text-muted-foreground">
                Only available while Maintenance is OPEN. This never permanently exposes this
                host — it issues a single-use, host-bound, 60-second ticket that opens the Network Gate
                for a short grant; native {title} login is still required.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MatrixAccessCard({
  token,
  state,
  onSaved,
}: {
  token: string;
  state: SysExtState;
  onSaved: () => void;
}) {
  const [controlRoomId, setControlRoomId] = useState(state.matrix.control_room_id);
  const [operatorMxids, setOperatorMxids] = useState(state.matrix.operator_mxids.join("\n"));
  const [saving, setSaving] = useState(false);
  const updateFn = useServerFn(sysExtUpdateMatrixAccess);

  const save = async () => {
    setSaving(true);
    const res = await updateFn({
      data: {
        access_token: token,
        control_room_id: controlRoomId,
        operator_mxids: operatorMxids.split("\n"),
      },
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Matrix system access updated");
    onSaved();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Matrix system access</CardTitle>
        <CardDescription>
          Privileged Matrix system commands (e.g. the Maintenance opening phrase) require ALL of:
          E2EE valid, room_id allowed, AND sender_mxid allowed. This consolidates the same
          room+sender check already used by the canonical Matrix policy — the adapter reads this
          config instead of a static environment variable.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="control-room-id">Control room (matrix_room_id)</Label>
          <Input
            id="control-room-id"
            value={controlRoomId}
            onChange={(e) => setControlRoomId(e.target.value)}
            placeholder="!system-room:alexation.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="operator-mxids">Operator MXIDs (one per line)</Label>
          <Textarea
            id="operator-mxids"
            value={operatorMxids}
            onChange={(e) => setOperatorMxids(e.target.value)}
            placeholder="@alex:alexation.com"
            rows={4}
          />
        </div>
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

function MaintenanceAccessCard({
  token,
  state,
  onSaved,
}: {
  token: string;
  state: SysExtState;
  onSaved: () => void;
}) {
  const [answerPhrase, setAnswerPhrase] = useState(state.maintenance.answer_phrase);
  const [maintenancePath, setMaintenancePath] = useState(state.maintenance.maintenance_path);
  const [openingPhrase, setOpeningPhrase] = useState("");
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const updateFn = useServerFn(sysExtUpdateMaintenanceConfig);
  const closeFn = useServerFn(sysExtCloseMaintenance);

  const save = async () => {
    setSaving(true);
    const res = await updateFn({
      data: {
        access_token: token,
        answer_phrase: answerPhrase,
        maintenance_path: maintenancePath,
        opening_phrase: openingPhrase || undefined,
      },
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setOpeningPhrase("");
    toast.success("Maintenance Access updated");
    onSaved();
  };

  const close = async () => {
    setClosing(true);
    const res = await closeFn({ data: { access_token: token } });
    setClosing(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Maintenance closed");
    onSaved();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Maintenance Access
          <Badge variant={state.maintenance.status === "OPEN" ? "default" : "secondary"}>
            {state.maintenance.status}
          </Badge>
        </CardTitle>
        <CardDescription>
          Exactly three admin-configurable values. Opening Phrase is write-only (hashed with bcrypt
          inside Postgres via pgcrypto; never displayed again). Automatically closes after 30
          minutes without genuine interactive Maintenance-session activity — this is a fixed system
          rule, not a 4th configurable value.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="opening-phrase">
            Opening Phrase{" "}
            {state.maintenance.has_opening_phrase && "(currently set — leave blank to keep)"}
          </Label>
          <Input
            id="opening-phrase"
            type="password"
            value={openingPhrase}
            onChange={(e) => setOpeningPhrase(e.target.value)}
            placeholder={state.maintenance.has_opening_phrase ? "••••••••" : "not set"}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="answer-phrase">Answer Phrase</Label>
          <Textarea
            id="answer-phrase"
            value={answerPhrase}
            onChange={(e) => setAnswerPhrase(e.target.value)}
            rows={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maintenance-path">Maintenance Path</Label>
          <Input
            id="maintenance-path"
            value={maintenancePath}
            onChange={(e) => setMaintenancePath(e.target.value)}
            placeholder="https://maintenance.example.com"
          />
          <p className="text-xs text-muted-foreground">
            Pure config — no code references this domain. Changing it never requires a code change
            (only, if the domain itself changes, a one-time reverse-proxy update).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
          {state.maintenance.status === "OPEN" && (
            <Button onClick={close} disabled={closing} size="sm" variant="destructive">
              {closing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Close Maintenance now
            </Button>
          )}
        </div>
        {state.maintenance.opened_at && (
          <p className="text-xs text-muted-foreground">
            Opened at {state.maintenance.opened_at}. Last activity:{" "}
            {state.maintenance.last_activity_at ?? "—"}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
