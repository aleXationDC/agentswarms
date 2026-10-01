import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Clock3, LockKeyhole, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useIsSuperadmin } from "@/hooks/use-iam";

type Lease = { open: boolean; expires_at: string | null };

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
    const onActivity = () => {
      if (document.visibilityState !== "visible") return;
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
