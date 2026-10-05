import { supabase } from "@/integrations/supabase/client";
import { CaseRequest } from "../documents/documentWorkContract";

export async function callCaseWork(input: unknown): Promise<unknown> {
  const request = CaseRequest.parse(input);
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Not signed in.");
  const response = await fetch("/api/cases/work", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  const body: unknown = await response.json();
  if (!response.ok) {
    const code =
      body &&
      typeof body === "object" &&
      "code" in body &&
      typeof body.code === "string" &&
      /^CASE_[A-Z0-9_]+$/.test(body.code)
        ? body.code
        : null;
    throw new Error(code ?? `Case operation rejected (HTTP ${response.status}).`);
  }
  if (!body || typeof body !== "object" || !("result" in body))
    throw new Error("Invalid Case response.");
  return body.result;
}
