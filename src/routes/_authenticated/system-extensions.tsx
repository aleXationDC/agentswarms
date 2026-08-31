import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ExternalLink,
  Loader2,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useIsSuperadmin } from "@/hooks/use-iam";
import { supabase } from "@/integrations/supabase/client";
import {
  axtnCloseSystemExtensionAccess,
  axtnIssueSystemExtensionTicket,
  axtnListSystemExtensions,
  type AxtnSystemExtension,
} from "@/utils/axtnSystemExtensions.functions";

export const Route = createFileRoute("/_authenticated/system-extensions")({
  head: () => ({
    meta: [{ title: "System Extensions — AgentSwarms" }],
  }),
  component: SystemExtensionsPage,
});

function SystemExtensionsPage() {
  const { user, session } = useAuth();
  const isSuperadmin = useIsSuperadmin();
  const listExtensions = useServerFn(axtnListSystemExtensions);
  const issueTicket = useServerFn(axtnIssueSystemExtensionTicket);
  const closeAccess = useServerFn(axtnCloseSystemExtensionAccess);
  const [authToken, setAuthToken] = useState<string | null>(session?.access_token ?? null);
  const [assuranceLevel, setAssuranceLevel] = useState<"aal1" | "aal2" | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [extensions, setExtensions] = useState<AxtnSystemExtension[] | null>(null);
  const [extensionsLoading, setExtensionsLoading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAuthToken(session?.access_token ?? null);
  }, [session?.access_token]);

  useEffect(() => {
    if (!user || !isSuperadmin || !authToken) return;
    let cancelled = false;
    setAssuranceLevel(null);
    setError(null);

    void Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]).then(([assurance, factors]) => {
      if (cancelled) return;
      if (assurance.error || factors.error) {
        setError(
          assurance.error?.message ??
            factors.error?.message ??
            "Could not verify session assurance.",
        );
        return;
      }
      setAssuranceLevel(
        assurance.data.currentLevel === "aal2"
          ? "aal2"
          : assurance.data.currentLevel === "aal1"
            ? "aal1"
            : null,
      );
      setFactorId(factors.data.totp.find((factor) => factor.status === "verified")?.id ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [authToken, isSuperadmin, user]);

  useEffect(() => {
    if (!authToken || assuranceLevel !== "aal2" || !isSuperadmin) {
      setExtensions(null);
      return;
    }
    let cancelled = false;
    setExtensionsLoading(true);
    setError(null);
    void listExtensions({ data: { access_token: authToken } })
      .then((configured) => {
        if (!cancelled) setExtensions(configured);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Could not load system extensions.");
        }
      })
      .finally(() => {
        if (!cancelled) setExtensionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assuranceLevel, authToken, isSuperadmin, listExtensions]);

  async function verifySecondFactor() {
    if (!factorId || verificationCode.length !== 6) return;
    setMfaLoading(true);
    setError(null);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: verificationCode,
      });
      if (verifyError) throw verifyError;

      const {
        data: { session: elevatedSession },
      } = await supabase.auth.getSession();
      if (!elevatedSession?.access_token) {
        throw new Error("The elevated session was not available.");
      }
      setAuthToken(elevatedSession.access_token);
      setVerificationCode("");
      setAssuranceLevel("aal2");
      toast.success("Session elevated to AAL2.");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not verify authentication code.";
      setError(message);
      toast.error(message);
    } finally {
      setMfaLoading(false);
    }
  }

  async function openExtension(extension: AxtnSystemExtension) {
    if (!authToken || assuranceLevel !== "aal2") return;
    const maintenanceWindow = window.open("about:blank", "_blank");
    if (maintenanceWindow) maintenanceWindow.opener = null;
    setOpeningId(extension.id);
    setError(null);
    try {
      const issued = await issueTicket({
        data: { access_token: authToken, extension_id: extension.id },
      });
      if (maintenanceWindow) maintenanceWindow.location.replace(issued.redeem_url);
      else window.location.assign(issued.redeem_url);
    } catch (cause) {
      maintenanceWindow?.close();
      const message =
        cause instanceof Error ? cause.message : "Could not issue an extension access link.";
      setError(message);
      toast.error(message);
      setOpeningId(null);
    }
  }

  async function closeExtension(extension: AxtnSystemExtension) {
    if (!authToken || assuranceLevel !== "aal2") return;
    setClosingId(extension.id);
    setError(null);
    try {
      const closed = await closeAccess({
        data: { access_token: authToken, extension_id: extension.id },
      });
      window.open(closed.close_url, "_blank", "noopener,noreferrer");
      toast.success("Maintenance access closed.");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not close maintenance access.";
      setError(message);
      toast.error(message);
      setClosingId(null);
    }
  }

  if (!user) return null;

  if (!isSuperadmin) {
    return (
      <div className="p-6">
        <Card className="mx-auto mt-12 max-w-lg border-destructive/40">
          <CardContent className="p-8 text-center">
            <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-destructive" />
            <h1 className="mb-1 text-lg font-semibold">Restricted area</h1>
            <p className="mb-4 text-sm text-muted-foreground">
              System extensions are only available to superadmins.
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
          <Wrench className="h-6 w-6 text-primary" /> System Extensions
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Open host maintenance tools through a short-lived, single-use access link. The
          extension&apos;s own sign-in remains required. Access closes automatically after 15
          minutes, or immediately when you choose Close maintenance.
        </p>
      </div>

      {error && (
        <Card className="max-w-3xl border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {assuranceLevel === null && !error && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking session assurance...
        </p>
      )}

      {assuranceLevel === "aal1" && (
        <Card className="max-w-xl border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LockKeyhole className="h-4 w-4 text-primary" /> Verify your second factor
            </CardTitle>
            <CardDescription>
              Maintenance access requires a current Supabase AAL2 session, not only an enrolled
              factor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {factorId ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="maintenance-totp">Authentication code</Label>
                  <Input
                    id="maintenance-totp"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ""))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void verifySecondFactor();
                    }}
                  />
                </div>
                <Button
                  disabled={mfaLoading || verificationCode.length !== 6}
                  onClick={verifySecondFactor}
                >
                  {mfaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify and continue
                </Button>
              </>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  No verified authenticator app is available for this account.
                </p>
                <Button asChild variant="outline">
                  <Link to="/account">Set up an authenticator app</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {assuranceLevel === "aal2" && (
        <Card className="max-w-3xl border-emerald-500/30">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <span>Your current session is verified at AAL2.</span>
          </CardContent>
        </Card>
      )}

      {extensionsLoading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading system extensions...
        </p>
      )}

      {assuranceLevel === "aal2" && extensions?.length === 0 && (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>No system extensions configured</CardTitle>
            <CardDescription>
              This instance has no technical entry points configured yet.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
        {assuranceLevel === "aal2" &&
          extensions?.map((extension) => (
            <Card key={extension.id}>
              <CardHeader>
                <CardTitle>{extension.label}</CardTitle>
                <CardDescription>{extension.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  disabled={openingId !== null || closingId !== null}
                  onClick={() => void openExtension(extension)}
                >
                  {openingId === extension.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-2 h-4 w-4" />
                  )}
                  Open maintenance
                </Button>
                <Button
                  variant="outline"
                  disabled={openingId !== null || closingId !== null}
                  onClick={() => void closeExtension(extension)}
                >
                  {closingId === extension.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldOff className="mr-2 h-4 w-4" />
                  )}
                  Close maintenance
                </Button>
              </CardContent>
            </Card>
          ))}
      </div>
    </div>
  );
}
