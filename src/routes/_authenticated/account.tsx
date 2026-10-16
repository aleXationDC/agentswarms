import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { deleteMyAccount } from "@/lib/account.functions";
import { mfaErrorMessage, totpQrCodeSource } from "@/lib/totpEnrollment";
import { TotpReauthentication } from "@/components/auth/TotpReauthentication";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  LogOut,
  KeyRound,
  Mail,
  ShieldCheck,
  UserCircle2,
  Trash2,
  AlertTriangle,
  Smartphone,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { ProfileSettingsPanel } from "@/components/settings/ProfileSettingsPanel";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [{ title: "Account Settings — AgentSwarms" }],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  // Set once the account is deleted, so the way out does not ask about the
  // profile form's unsaved edits (R282).
  const accountGoneRef = useRef(false);
  const callDelete = useServerFn(deleteMyAccount);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Auth controls
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaLevel, setMfaLevel] = useState<"aal1" | "aal2" | null>(null);
  const [totpFactor, setTotpFactor] = useState<{ id: string; friendlyName: string | null } | null>(
    null,
  );
  const [enrollment, setEnrollment] = useState<{
    id: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [qrLoadError, setQrLoadError] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  useEffect(() => {
    if (!user) return;
    void loadMfaStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function loadMfaStatus() {
    const [{ data: assurance, error: assuranceError }, { data: factors, error: factorsError }] =
      await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);
    if (assuranceError || factorsError) {
      toast.error(assuranceError?.message ?? factorsError?.message ?? "Could not load MFA status");
      return;
    }
    setMfaLevel(
      assurance.currentLevel === "aal2"
        ? "aal2"
        : assurance.currentLevel === "aal1"
          ? "aal1"
          : null,
    );
    const factor = factors.totp.find((item) => item.status === "verified");
    setTotpFactor(factor ? { id: factor.id, friendlyName: factor.friendly_name ?? null } : null);
  }

  async function beginTotpEnrollment() {
    setMfaLoading(true);
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      for (const factor of factors.all) {
        if (factor.factor_type !== "totp" || factor.status !== "unverified") continue;
        const { error: cleanupError } = await supabase.auth.mfa.unenroll({
          factorId: factor.id,
        });
        if (cleanupError) throw cleanupError;
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (error) throw error;
      setEnrollment({
        id: data.id,
        qrCode: totpQrCodeSource(data.totp.qr_code),
        secret: data.totp.secret,
      });
      setQrLoadError(false);
      setVerificationCode("");
    } catch (err) {
      toast.error(mfaErrorMessage(err, "Could not start TOTP enrollment."));
    } finally {
      setMfaLoading(false);
    }
  }

  async function verifyTotpEnrollment() {
    if (!enrollment || !verificationCode.trim()) return;
    setMfaLoading(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollment.id,
      });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollment.id,
        challengeId: challenge.id,
        code: verificationCode.trim(),
      });
      if (verifyError) throw verifyError;
      setEnrollment(null);
      setVerificationCode("");
      await loadMfaStatus();
      toast.success("Authenticator app verified. This session is now AAL2.");
    } catch (err) {
      toast.error(mfaErrorMessage(err, "Could not verify authentication code."));
    } finally {
      setMfaLoading(false);
    }
  }

  async function cancelTotpEnrollment() {
    if (!enrollment) return;
    setMfaLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: enrollment.id });
      if (error) throw error;
      setEnrollment(null);
      setQrLoadError(false);
      setVerificationCode("");
    } catch (err) {
      toast.error(mfaErrorMessage(err, "Could not cancel TOTP enrollment."));
    } finally {
      setMfaLoading(false);
    }
  }

  async function removeTotpFactor() {
    if (!totpFactor) return;
    setMfaLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
      if (error) throw error;
      setTotpFactor(null);
      await loadMfaStatus();
      toast.success("Authenticator app removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove authenticator app");
    } finally {
      setMfaLoading(false);
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setPwLoading(false);
    }
  };

  const handleEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      toast.success("Confirmation email sent to your new address");
      setNewEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update email");
    } finally {
      setEmailLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") {
      toast.error("Type DELETE to confirm");
      return;
    }
    setDeleting(true);
    try {
      await callDelete();
      toast.success("Your account has been deleted");
      await supabase.auth.signOut();
      accountGoneRef.current = true;
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
          Settings
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Account Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your AgentSwarms profile, password, and session.
        </p>
      </div>

      {/* PROFILE EDITOR — shared with the quick Settings dialog's Profile
          tab (see src/components/settings/ProfileSettingsPanel.tsx) so
          there's exactly one copy of this logic, not two that drift. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserCircle2 className="h-4 w-4 text-primary" /> Public Profile
          </CardTitle>
          <CardDescription>
            How you appear across the app — the dashboard greeting, the user list, and the audit log
            beside anything you do.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileSettingsPanel goneRef={accountGoneRef} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" /> Account
          </CardTitle>
          <CardDescription>Your current sign-in info.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user?.email ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">User ID</span>
            <span className="font-mono text-xs text-muted-foreground">{user?.id ?? "—"}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" /> Change Password
          </CardTitle>
          <CardDescription>
            Choose a new password. You'll stay signed in on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
            <Button type="submit" disabled={pwLoading}>
              {pwLoading ? "Updating..." : "Update Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4 text-primary" /> Change Email
          </CardTitle>
          <CardDescription>
            We'll send a confirmation link to your new email address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEmailChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">New Email</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="you@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="outline" disabled={emailLoading}>
              {emailLoading ? "Sending..." : "Send Confirmation"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-4 w-4 text-primary" /> Authenticator App
          </CardTitle>
          <CardDescription>
            Use a TOTP authenticator app for a second sign-in factor. Sensitive maintenance
            operations require an AAL2 session.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current session assurance</span>
            <span className="font-medium uppercase">{mfaLevel ?? "Loading..."}</span>
          </div>

          {totpFactor && !enrollment && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span>
                Authenticator app{totpFactor.friendlyName ? `: ${totpFactor.friendlyName}` : ""} is
                enrolled.
              </span>
              <Button variant="outline" size="sm" disabled={mfaLoading} onClick={removeTotpFactor}>
                Remove
              </Button>
            </div>
          )}

          {totpFactor && !enrollment && mfaLevel === "aal1" && (
            <div className="rounded-lg border border-primary/30 p-4">
              <TotpReauthentication onVerified={loadMfaStatus} />
            </div>
          )}

          {!totpFactor && !enrollment && (
            <Button disabled={mfaLoading} onClick={beginTotpEnrollment}>
              {mfaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set up authenticator app
            </Button>
          )}

          {enrollment && (
            <div className="space-y-4 rounded-lg border p-4">
              <p className="text-sm">
                Scan this QR code with your authenticator app, then enter its six-digit code.
              </p>
              {qrLoadError ? (
                <p className="rounded border border-destructive/40 p-3 text-sm text-destructive">
                  The QR code could not be rendered. Enter the manual setup key below instead.
                </p>
              ) : (
                <img
                  alt="TOTP enrollment QR code"
                  className="h-48 w-48 rounded bg-white p-2"
                  src={enrollment.qrCode}
                  onError={() => setQrLoadError(true)}
                />
              )}
              <div className="space-y-2">
                <Label htmlFor="totp-secret">Manual setup key</Label>
                <Input id="totp-secret" readOnly value={enrollment.secret} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="totp-code">Authentication code</Label>
                <Input
                  id="totp-code"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={mfaLoading || verificationCode.length !== 6}
                  onClick={verifyTotpEnrollment}
                >
                  {mfaLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>
                <Button
                  variant="outline"
                  disabled={mfaLoading}
                  onClick={() => void cancelTotpEnrollment()}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <LogOut className="h-4 w-4 text-destructive" /> Session
          </CardTitle>
          <CardDescription>Sign out of AgentSwarms on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <Button variant="destructive" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4" /> Delete Account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data — agents, swarms, knowledge
            bases, chats, traces, and credentials. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog
            onOpenChange={(open) => {
              if (!open) setDeleteConfirm("");
            }}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete my account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your account and all data associated with it. You
                  will be signed out immediately. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="confirm-delete">
                  Type <span className="font-mono font-semibold">DELETE</span> to confirm
                </Label>
                <Input
                  id="confirm-delete"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE"
                  autoComplete="off"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleting || deleteConfirm !== "DELETE"}
                  onClick={(e) => {
                    e.preventDefault();
                    void handleDeleteAccount();
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Permanently delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
