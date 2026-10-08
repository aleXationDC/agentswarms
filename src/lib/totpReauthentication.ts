import { supabase } from "@/integrations/supabase/client";

export async function reauthenticateWithTotp(factorId: string, code: string): Promise<void> {
  const normalizedCode = code.trim();
  if (!/^\d{6}$/.test(normalizedCode)) {
    throw new Error("Enter the current six-digit authenticator code.");
  }

  const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: normalizedCode,
  });
  if (verifyError) throw verifyError;

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session) {
    throw new Error("Authenticator verified, but the refreshed session is unavailable.");
  }

  const { data: assurance, error: assuranceError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel(sessionData.session.access_token);
  if (assuranceError) throw assuranceError;
  if (assurance.currentLevel !== "aal2") {
    throw new Error("Authenticator verification did not elevate this session to AAL2.");
  }
}
