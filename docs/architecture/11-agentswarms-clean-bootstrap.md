# AgentSwarms Clean Bootstrap Report

**Date:** 2026-08-27  
**Host:** `aleXation`  
**Scope:** Phase A inventory and safe clean-core bootstrap

## Executive status

The deployed AgentSwarms application is the upstream `v1.2.1` release
(`bdc397a718d581c2045f7ea1a87f73bff7e0d8b8`). The upstream repository has no
newer release tag; `origin/main` is unchanged relative to this release tag at
the time of inspection. The app is healthy on the existing Supabase stack and
has produced successful chat and trace records.

The AgentSwarms listener is published on `127.0.0.1` only. Browser access goes
exclusively through the Tailscale HTTPS proxy, which terminates TLS with a real
tailnet certificate. The direct user URL is:

`https://ops-alexation-one.tailf4170c.ts.net:8446`

No public reverse-proxy route was added for the admin UI. The plain-HTTP
Tailscale-IP origin was deliberately removed; see section 7a.

## 1. Starting state

- Ubuntu 26.04 LTS, Linux 7.0.0-28-generic, 8 CPUs, 15 GiB RAM, 150 GiB
  filesystem (59 GiB used, 85 GiB available), no swap.
- Docker Server 29.6.1.
- Running AgentSwarms container: `agentswarms-poc-agentswarms-1`, local image,
  port 8080, healthy HTTP API (`{"status":"ok","service":"agentswarms"}`).
- Running supporting stacks include Supabase, n8n, Matrix/Synapse/Element,
  Gitea, the existing MCP server, and the conversation-state service.
- Tailscale is active at `100.103.167.122`.
- Caddy serves `alexation.com`, `axtn.alexation.com`, Matrix, n8n, Gitea and
  MCP routes. Existing websites returned successfully during the check.

## 2. Preserved components

No containers, volumes, websites, Matrix services, n8n workflows, Git
repositories, credentials, or existing databases were removed or reset.
AgentSwarms continues to use the existing Supabase deployment and its
persistent volume.

## 3. Legacy components not migrated

The legacy Ops Panel, custom execution/state machines, review orchestration,
and n8n orchestration were not moved into the AgentSwarms core. n8n remains
running as an integration adapter and temporary Copilot worker dependency.
The existing Copilot worker, Matrix integration, websites, and Gitea were not
modified.

## 4. Upstream and deployment

- Repository: `https://github.com/AgentSwarms-fyi/agentswarms`
- Local repository: `/home/alex/agentswarms-poc`
- Branch: `main`
- Release/tag: `v1.2.1`
- Release commit: `bdc397a718d581c2045f7ea1a87f73bff7e0d8b8`
- Compose file: `/home/alex/agentswarms-poc/docker-compose.yml`
- Supabase Compose file:
  `/home/alex/agentswarms-poc/supabase-docker/docker/docker-compose.yml`

The local core source is upstream-clean for the release, with one pre-existing
`.dockerignore` modification and an untracked local `.env` backup. Those local
changes were not overwritten.

## 5. Database state and backup

The Supabase database contains the standard AgentSwarms tables in `public` and
the standard Supabase schemas. No `alexation_core` schema was found in this
database. Examples of populated native tables at inspection time were:

| Table | Rows |
|---|---:|
| agents | 8 |
| swarms | 5 |
| swarm_runs | 39 |
| execution_traces | 49 |
| approvals | 2 |
| knowledge_bases | 18 |
| semantic_models | 2 |
| integrations | 1 |

The model registry, provider credentials, MCP apps, schedules, catalog assets
and user prompt table were empty at inspection time. This is a valid empty
state, not treated as a read failure.

A fresh custom-format dump was created before any reset:

`/home/alex/backups/postgres/20260827T001747Z/supabase.dump`

Checksum: `/home/alex/backups/postgres/20260827T001747Z/SHA256SUMS.txt`.
No destructive database action was performed.

## 6. Access, websites, Matrix and n8n

- AgentSwarms: Tailscale HTTPS access at `https://ops-alexation-one.tailf4170c.ts.net:8446`.
- `https://alexation.com`: HTTP 200.
- `https://axtn.alexation.com`: active redirect.
- `https://matrix.alexation.com`: active redirect.
- `https://n8n.alexation.com`: protected (HTTP 403 from this non-Tailscale
  probe), service remains healthy.
- `https://git.alexation.com`: HTTP 200.
- Synapse, Element, Matrix bridges, n8n and Gitea containers remain running.

No Matrix integration was implemented. The existing native Slack integration
and its Application Service-style interaction model remain future reference
work, not bootstrap scope.

## 7. Runtime capability verification

`EXISTS_IN_SOURCE` means a native route/component exists. `DEPLOYED` means the
current container serves the release. `CONFIGURED` reflects the current
database/environment state. `RUNTIME_VERIFIED` is limited to unauthenticated
HTTP route/API checks; authenticated UI workflows require a user login.

| Capability | EXISTS_IN_SOURCE | DEPLOYED | CONFIGURED | RUNTIME_VERIFIED | Notes |
|---|---|---|---|---|---|
| Agent Chat | yes | yes | yes | **yes** | real OpenRouter turn rendered + persisted over the HTTPS origin |
| Agents | yes | yes | yes | partial | 8 rows |
| Swarms | yes | yes | yes | partial | 5 rows; builder at `/swarms` |
| Runs | yes | yes | yes | partial | 39 rows |
| Traces | yes | yes | yes | partial | 49 rows |
| Evaluate | yes | yes | yes | partial | native evaluations route |
| Approval | yes | yes | yes | partial | 2 rows and approval nodes |
| Pause/Resume | yes | yes | yes | partial | native run/checkpoint support |
| Scheduler | yes | yes | empty | partial | no schedules currently |
| Skills | yes | yes | empty | partial | route serves successfully |
| Prompt Library | yes | yes | empty | partial | route serves successfully |
| Knowledge Base | yes | yes | yes | partial | 18 rows |
| Data Catalog | yes | yes | empty | partial | no catalog assets currently |
| Semantic Layer | yes | yes | yes | partial | 2 semantic models |
| Model Registry | yes | yes | empty | partial | no registry rows currently |
| Secrets | yes | yes | empty | partial | no user secrets; provider keys live in `integrations` |
| MCP | yes | yes | empty | partial | native MCP routes; no apps |
| Integrations | yes | yes | yes | **yes** | Gemini, OpenAI, OpenRouter all `health_status: ok` |
| OpenRouter | yes | yes | **yes** | **yes** | real key connected; completed a billed turn |
| Web Embedding | yes | yes | not exercised | partial | native embed route exists |
| BI Workspace | yes | yes | yes | **yes** | dashboard loads clean over HTTPS; 9 sample dashboards |

## 7a. Agent Chat defect — root cause and runtime verification

### Symptom

In Agent Chat (`/playground`, agent "Demo · Friendly Assistant") the typed text
disappeared on submit. No user message and no assistant reply appeared, and
`public.messages` stayed empty while `public.conversations` already held a row.

### Ruled out

Each layer below was tested directly and is healthy — none is the cause:

- **Auth:** a real user session authenticates and RLS-scoped reads succeed.
- **Conversation creation:** the conversation row exists and loads.
- **Database writes:** an authenticated `INSERT` into `public.messages` under
  RLS returns `201`.
- **Chat API:** `POST /api/chat` returns `200 text/event-stream` and completes
  a real turn.
- **Model provider:** the turn reaches genuine OpenRouter (`provider: "Azure"`,
  `openai/gpt-4o-mini`) and returns real content with usage and cost. Server
  logs record `status: success`. Gemini, OpenAI and OpenRouter integrations are
  all stored encrypted in `public.integrations` and report `health_status: ok`.
  (`public.provider_credentials` is empty by design — its check constraint only
  accepts `bedrock`, `vertex`, `anthropic`, `azure_openai`.)

### Root cause

The failure is entirely client-side and is a **deployment/access defect, not an
upstream bug**. A headless-browser reproduction against the live app captured:

```
TypeError: crypto.randomUUID is not a function
```

`sendMessage()` clears the input, then builds the optimistic user message with
`crypto.randomUUID()`. That call throws, so the message is never appended, never
persisted, and `/api/chat` is never called — exactly the observed symptom.

`crypto.randomUUID()` and the whole Web Crypto API are only exposed in a
**secure context**. Measured directly in the browser:

| Origin | `isSecureContext` | `crypto.randomUUID` |
|---|---|---|
| `http://100.103.167.122:8080` (Tailscale IP, plain HTTP) | `false` | unavailable |
| `http://localhost:8080` | `true` | available |

The bootstrap exposed the app on the bare Tailscale IP over plain HTTP, which
browsers treat as an insecure origin. Upstream documents access via
`http://localhost:8080`, which is a secure context, so upstream's assumption is
sound. No upstream code was changed.

### Runtime verification (secure context)

Driving the real UI in a headless browser against `http://localhost:8080` with a
genuine user session and the already-connected provider:

- `isSecureContext: true`, `crypto.randomUUID` available
- zero page errors
- `POST /api/chat` → `200`
- `POST /rest/v1/messages` → `201` twice (user turn and assistant turn)
- user message and streamed assistant reply both rendered
- rows persisted in `public.messages` and survive reload

Agent Chat is therefore **RUNTIME_VERIFIED end-to-end with a real provider** and
real persistence. The reply content follows the agent's system prompt and
knowledge base rather than echoing the test phrase, which is correct behavior.

### Fix applied — HTTPS on the tailnet

The app is now served from a secure origin. Supabase was moved to HTTPS as well,
because `VITE_SUPABASE_URL` is inlined into the client bundle at build time and a
plain-HTTP Supabase URL would be blocked as mixed content.

`tailscale serve` endpoints (tailnet only, real TLS certificate):

| URL | Target | Purpose |
| --- | --- | --- |
| `https://ops-alexation-one.tailf4170c.ts.net:8446` | `127.0.0.1:8080` | AgentSwarms UI |
| `https://ops-alexation-one.tailf4170c.ts.net:8444` | `127.0.0.1:8000` | Supabase API |
| `https://ops-alexation-one.tailf4170c.ts.net:8443` | `127.0.0.1:5678` | n8n (pre-existing) |

Port `443` was intentionally **not** used: Caddy already owns `:443` on this host
for the public websites, and taking it would have broken them. Port `8446` is the
AgentSwarms entry point instead. The legacy Ops Panel proxy was retired from the
tailnet root, matching the native-first premise.

Configuration changes (no upstream source code touched):

- `.env`: `VITE_SUPABASE_URL`, `SITE_URL`, `PUBLIC_APP_URL` moved to the HTTPS
  hostnames.
- `supabase-docker/docker/.env`: `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`,
  `SITE_URL`, `ADDITIONAL_REDIRECT_URLS` moved to the HTTPS hostnames;
  `auth`/`rest`/`api-gw`/`studio` recreated.
- `.env`: added `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`. Vite's preview server
  rejects unknown `Host` headers with `Blocked request`, and the proxied
  hostname is not in `vite.config.ts`'s `allowedHosts`. This is Vite's official
  environment hook, so `vite.config.ts` remains unmodified.
- Rebuilt the image (`docker compose up -d --build agentswarms`), mandatory
  because `VITE_*` values are inlined at build time.
- Narrowed the published port to `127.0.0.1:8080`, removing the insecure origin
  so the failure mode cannot recur.

### Verification after the fix

Headless browser against `https://ops-alexation-one.tailf4170c.ts.net:8446` with
a genuine session:

- `isSecureContext: true`, `crypto.randomUUID: true`, `crypto.subtle: true`
- Agent Chat: message echoed in the transcript, `POST /rest/v1/messages` → `201`
  (user), `POST /api/chat` → `200`, `POST /rest/v1/messages` → `201` (assistant)
- zero page errors, no HTTP >= 400
- row `https-verify 1787797337492` confirmed persisted in `public.messages`
  together with its assistant reply
- BI dashboard (`/bi/<id>`) loads with zero page errors and no failed requests,
  confirming it shared the same root cause

Unaffected services re-checked after the change: `alexation.com` 200,
`axtn.alexation.com` 302, `matrix.alexation.com` 302, `git.alexation.com` 200,
n8n 200, no unhealthy containers.

## 8. Credentials and blockers

The checked-in/runtime environment contains an OpenRouter-looking placeholder
classification and points `OPENROUTER_BASE_URL` at the local mock LLM. However,
the account-level OpenRouter, OpenAI and Gemini keys stored encrypted in
`public.integrations` are real and healthy, and a live Agent Chat turn was
billed through genuine OpenRouter. No credential was invented.

The secure-origin blocker from section 7a is **resolved**: the user granted
`tailscale set --operator=alex`, HTTPS was configured, and Agent Chat plus BI are
verified working. No blockers remain for the clean core.

Optional and not blocking: supplying a dedicated `OPENROUTER_API_KEY` in `.env`
and pointing `OPENROUTER_BASE_URL` at the official endpoint, so the environment
matches the credential already stored in `public.integrations`.

## 9. Changes made

1. Restricted the AgentSwarms Docker publication to loopback only in
   `docker-compose.yml` (the sole edited upstream file).
2. Added this discovery/bootstrap report.
3. Created the Supabase backup listed above.
4. Configured `tailscale serve` HTTPS endpoints for AgentSwarms (`:8446`) and
   Supabase (`:8444`); retired the legacy Ops Panel proxy from the tailnet root.
5. Updated `.env` and `supabase-docker/docker/.env` to the HTTPS origins and
   added `__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS`; recreated the Supabase auth
   and gateway containers and rebuilt the AgentSwarms image.
6. Did not reset databases, remove services, alter public website routes, or
   migrate legacy runtime state. No upstream source file was modified.

## 10. Recommended next steps (maximum five)

1. Open `https://ops-alexation-one.tailf4170c.ts.net:8446` over Tailscale and
   walk the native UI acceptance paths.
2. Replace the placeholder/mock model configuration with the user's
   OpenRouter API key and official OpenRouter base URL.
3. Register the desired model(s) in the native Model Registry.
4. Create the first native Agent, test Agent Chat, then create a small Swarm
   with an Approval node.
5. Selectively review old `alexation_core` backups for durable knowledge; do
   not migrate legacy execution state by default.
