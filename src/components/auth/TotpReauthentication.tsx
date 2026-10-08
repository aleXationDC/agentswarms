import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { mfaErrorMessage } from "@/lib/totpEnrollment";
import { reauthenticateWithTotp } from "@/lib/totpReauthentication";

type Props = {
  onVerified?: () => void | Promise<void>;
};

export function TotpReauthentication({ onVerified }: Props) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loadingFactor, setLoadingFactor] = useState(true);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.mfa
      .listFactors()
      .then(({ data, error: factorError }) => {
        if (cancelled) return;
        if (factorError) {
          setError(mfaErrorMessage(factorError, "Unable to read authenticator status."));
        } else {
          setFactorId(data.totp.find((factor) => factor.status === "verified")?.id ?? null);
        }
        setLoadingFactor(false);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(mfaErrorMessage(reason, "Unable to read authenticator status."));
        setLoadingFactor(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      await reauthenticateWithTotp(factorId, code);
      setCode("");
      setVerified(true);
      await onVerified?.();
    } catch (reason) {
      setCode("");
      setError(mfaErrorMessage(reason, "Authenticator verification failed."));
    } finally {
      setBusy(false);
    }
  }

  if (loadingFactor) {
    return <p className="text-sm text-muted-foreground">Checking verified authenticator…</p>;
  }

  if (!factorId) {
    return (
      <>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No verified TOTP authenticator is available. Set one up in Account settings.
          </p>
        )}
      </>
    );
  }

  return (
    <form onSubmit={verifyCode} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {verified
          ? "Authenticator verified. This session has been confirmed at AAL2."
          : "Enter the current six-digit code from your authenticator to raise this session to AAL2."}
      </p>
      {!verified && (
        <>
          <div className="space-y-2">
            <Label htmlFor="totp-reauth-code">Authenticator code</Label>
            <Input
              id="totp-reauth-code"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              aria-describedby={error ? "totp-reauth-error" : undefined}
              required
            />
          </div>
          {error && (
            <p id="totp-reauth-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || code.length !== 6}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify authenticator
          </Button>
        </>
      )}
    </form>
  );
}
