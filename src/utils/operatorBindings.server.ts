export type ManagedN8nBinding = {
  baseUrl: string;
  apiKey: string;
};

export type OperatorBindingName = "n8n" | "gitea" | "matrix";

const OPERATOR_ENV: Record<OperatorBindingName, string> = {
  n8n: "AXTN_N8N_OPERATOR_URL",
  gitea: "AXTN_GITEA_OPERATOR_URL",
  matrix: "AXTN_MATRIX_OPERATOR_URL",
};

function configuredValue(env: NodeJS.ProcessEnv, name: string): string {
  return (env[name] ?? "").trim();
}

export function readManagedN8nBinding(
  env: NodeJS.ProcessEnv = process.env,
): { ok: true; binding: ManagedN8nBinding | null } | { ok: false; error: string } {
  const baseUrl = configuredValue(env, "N8N_BASE_URL");
  const apiKey = configuredValue(env, "N8N_API_KEY");
  if (!baseUrl && !apiKey) return { ok: true, binding: null };
  if (!baseUrl || !apiKey) {
    return {
      ok: false,
      error: "N8N_BASE_URL and N8N_API_KEY must both be configured to enable managed n8n.",
    };
  }

  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return { ok: false, error: "N8N_BASE_URL must be a valid HTTP or HTTPS URL." };
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return {
      ok: false,
      error:
        "N8N_BASE_URL must be an HTTP or HTTPS URL without embedded credentials or query data.",
    };
  }

  return {
    ok: true,
    binding: { baseUrl: url.toString().replace(/\/+$/, ""), apiKey },
  };
}

function validateOperatorUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+ts\.net$/.test(host) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    return null;
  }
  return url.pathname === "/" ? url.origin : url.href;
}

export function readOperatorUrls(
  env: NodeJS.ProcessEnv = process.env,
): { ok: true; urls: Partial<Record<OperatorBindingName, string>> } | { ok: false; error: string } {
  const urls: Partial<Record<OperatorBindingName, string>> = {};
  for (const [name, envName] of Object.entries(OPERATOR_ENV) as [OperatorBindingName, string][]) {
    const value = configuredValue(env, envName);
    if (!value) continue;
    const url = validateOperatorUrl(value);
    if (!url) {
      return {
        ok: false,
        error: `${envName} must be a credential-free HTTPS URL on a *.ts.net host with no query or fragment.`,
      };
    }
    urls[name] = url;
  }
  return { ok: true, urls };
}
