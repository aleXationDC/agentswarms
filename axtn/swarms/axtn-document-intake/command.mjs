const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const appUrl = (process.env.AXTN_AGENTSWARMS_BOOTSTRAP_URL || "http://127.0.0.1:8080").replace(
  /\/+$/,
  "",
);

export async function runDocumentIntakeCommand(action) {
  if (!supabaseUrl || !publishableKey || !email || !password) {
    throw new Error("Supabase URL/key and the configured AgentSwarms admin identity are required.");
  }

  const login = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(10000),
  });
  if (!login.ok) {
    throw new Error(`AgentSwarms admin authentication failed with HTTP ${login.status}.`);
  }
  const session = await login.json();
  if (typeof session.access_token !== "string" || !session.access_token) {
    throw new Error("AgentSwarms admin authentication returned no access token.");
  }

  const response = await fetch(`${appUrl}/api/axtn/document-intake`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action }),
    signal: AbortSignal.timeout(action === "seed_dms" ? 120000 : 15000),
  });
  if (!response.ok) {
    throw new Error(`Document Intake ${action} failed with HTTP ${response.status}.`);
  }
  const result = await response.json();
  console.log(result.message);
}
