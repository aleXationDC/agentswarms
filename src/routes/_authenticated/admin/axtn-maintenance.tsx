import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Clock3, ExternalLink, LockKeyhole, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useIsSuperadmin } from "@/hooks/use-iam";
import { supabase } from "@/integrations/supabase/client";
import { TotpReauthentication } from "@/components/auth/TotpReauthentication";
import {
  getAxtnMaintenanceSettings,
  getManagedN8nStatus,
} from "@/utils/axtnMaintenanceSettings.functions";
import type { ManagedWorkflow } from "@/utils/integrations/nativeN8n.server";

type Lease = { open: boolean; expires_at: string | null };
type ManagedStatus = {
  configured: boolean;
  connected: boolean;
  workflows: ManagedWorkflow[];
  detail: string;
};

export const Route = createFileRoute("/_authenticated/admin/axtn-maintenance")({
  head: () => ({
    meta: [
      { title: "Maintenance access — AgentSwarms" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MaintenanceAccessPage,
});

function MaintenanceAccessPage() {
  const { session } = useAuth();
  const isSuperadmin = useIsSuperadmin();
  const [lease, setLease] = useState<Lease | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = session?.access_token;
  const [mfa, setMfa] = useState<{ level: string | null; enrolled: boolean } | null>(null);
  const [operators, setOperators] = useState<{ label: string; url: string | null }[] | null>(null);
  const [managedN8n, setManagedN8n] = useState<ManagedStatus | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    setMfa(null);
    setOperators(null);
    setManagedN8n(null);
    setSettingsError(null);
    if (!isSuperadmin || !token) return;
    let cancelled = false;
    void Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ])
      .then(([assurance, factors]) => {
        if (cancelled) return;
        if (assurance.error || factors.error) {
          setSettingsError("Unable to read MFA status. Manage MFA in Account settings.");
          return;
        }
        setMfa({
          level: assurance.data.currentLevel,
          enrolled: factors.data.totp.some((factor) => factor.status === "verified"),
        });
      })
      .catch(() => {
        if (!cancelled)
          setSettingsError("Unable to read MFA status. Manage MFA in Account settings.");
      });
    void getAxtnMaintenanceSettings({ data: { access_token: token } })
      .then((settings) => {
        if (!cancelled) setOperators(settings.operators);
      })
      .catch(() => {
        if (!cancelled)
          setSettingsError("Private operator links require a current superadmin AAL2 session.");
      });
    void getManagedN8nStatus({ data: { access_token: token } })
      .then((status) => {
        if (!cancelled) setManagedN8n(status);
      })
      .catch(() => {
        if (!cancelled)
          setManagedN8n({
            configured: false,
            connected: false,
            workflows: [],
            detail: "Native n8n status requires a current superadmin AAL2 session.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [isSuperadmin, token]);

  const request = useCallback(
    async (action?: "open" | "close" | "touch") => {
      if (!token) throw new Error("Your authenticated session is not available.");
      const response = await fetch("/api/axtn/maintenance", {
        method: action ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(action ? { "Content-Type": "application/json" } : {}),
        },
        ...(action ? { body: JSON.stringify({ action }) } : {}),
        cache: "no-store",
      });
      const body = (await response.json()) as Lease & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Maintenance service request failed.");
      setLease(body);
    },
    [token],
  );

  useEffect(() => {
    if (!isSuperadmin || !token) return;
    void request().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Unable to read maintenance status.");
    });
  }, [isSuperadmin, request, token]);

  useEffect(() => {
    if (!isSuperadmin || !token || !lease?.open) return;
    let lastTouch = 0;
    const onActivity = (event: Event) => {
      if (!event.isTrusted || document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastTouch < 60_000) return;
      lastTouch = now;
      void request("touch").catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "Unable to refresh maintenance lease.");
      });
    };
    document.addEventListener("pointerdown", onActivity, { passive: true });
    document.addEventListener("keydown", onActivity);
    return () => {
      document.removeEventListener("pointerdown", onActivity);
      document.removeEventListener("keydown", onActivity);
    };
  }, [isSuperadmin, lease?.open, request, token]);

  const changeLease = async (action: "open" | "close") => {
    setBusy(true);
    setError(null);
    try {
      await request(action);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Maintenance request failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!isSuperadmin) {
    return (
      <div className="p-6">
        <Card className="mx-auto mt-12 max-w-lg border-destructive/40">
          <CardHeader>
            <CardTitle>Restricted area</CardTitle>
            <CardDescription>
              Only AgentSwarms superadmins can manage maintenance access.
            </CardDescription>
          </CardHeader>
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
          <ShieldCheck className="h-6 w-6 text-primary" /> Maintenance access
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The public AgentSwarms entry at axtn.alexation.com is normally closed. Opening it does not
          bypass AgentSwarms authentication or MFA. This control is available from the private
          Tailscale path.
        </p>
      </div>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Multi-factor authentication</CardTitle>
          <CardDescription>
            Maintenance requires a current AAL2 session, not only an enrolled authenticator.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            {mfa
              ? `Authenticator ${mfa.enrolled ? "enrolled" : "not enrolled"} · Session ${mfa.level?.toUpperCase() ?? "unknown"}`
              : "MFA status unavailable or loading."}
          </p>
          <Link to="/account" className="text-sm font-medium text-primary hover:underline">
            Manage MFA in Account settings
          </Link>
          {mfa?.enrolled && mfa.level !== "aal2" && (
            <TotpReauthentication
              onVerified={() =>
                setMfa((current) => (current ? { ...current, level: "aal2" } : current))
              }
            />
          )}
          {settingsError && (
            <p role="alert" className="text-sm text-destructive">
              {settingsError}
            </p>
          )}
        </CardContent>
      </Card>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Private operator services</CardTitle>
          <CardDescription>
            These private links do not pass through the public maintenance route. Opening D09 does
            not expose n8n, Gitea, Matrix Admin, databases, or other operator services.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!operators && (
            <p className="text-sm text-muted-foreground">
              Operator links are available after superadmin AAL2 verification.
            </p>
          )}
          {operators?.map(({ label, url }) => (
            <div key={label} className="text-sm">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  Open {label} (private) <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-muted-foreground">
                  {label}: private operator URL not configured
                </span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Native aXtn n8n</CardTitle>
          <CardDescription>
            Platform-managed workflow access. The endpoint and API key remain server-side; no
            per-user integration credential or internal URL is required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm" role="status">
            {!managedN8n
              ? "Checking native n8n status…"
              : managedN8n.connected
                ? `Authenticated · ${managedN8n.workflows.length} workflows readable`
                : managedN8n.configured
                  ? `Configured but unavailable · ${managedN8n.detail}`
                  : `Not configured · ${managedN8n.detail}`}
          </p>
          {managedN8n?.connected && managedN8n.workflows.length > 0 && (
            <ul className="space-y-1 text-sm">
              {managedN8n.workflows.map((workflow) => (
                <li key={workflow.id} className="flex justify-between gap-4">
                  <span>{workflow.name}</span>
                  <span className="text-muted-foreground">
                    {workflow.active ? "Active" : "Inactive"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5" />
            {lease?.open ? "Maintenance access is open" : "Maintenance access is closed"}
          </CardTitle>
          <CardDescription>
            Authenticated activity in this page renews the shared lease. Background requests and
            static assets do not.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lease?.open && lease.expires_at && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Idle expiry: {new Date(lease.expires_at).toLocaleString()}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            variant={lease?.open ? "destructive" : "default"}
            disabled={busy || !lease}
            onClick={() => void changeLease(lease?.open ? "close" : "open")}
          >
            {busy ? "Updating…" : lease?.open ? "Close maintenance" : "Open maintenance"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
