# aXtn Case Responsibility and Execution Routing

**Status:** Architecture locked for implementation  
**Date:** 2026-10-04  
**Canonical repository:** `aXtn/aXtn-agentswarms`  
**Implementation branch:** `work/AXTN-CASE-EXECUTION-ROUTING-CHATGPT-PLAN-0001`  
**Tracking issue:** `aXtn/aXtn-agentswarms#10`  
**Required base:** `6bf776ef7c9abb59224f0477dc7257f94f93f4ca`  
**Deployed AgentSwarms source at analysis time:** `10df3a869c5dcb6c377840ca7a048a87d1aa4c6f`  
**Host authority:** `aXtn/aXtn-host@85dbb7227e04a6a1406697a8b660bb1c8804d13e`

## 1. Purpose

Extend the existing native AgentSwarms, IAM, provider, tracing and SupaCase contracts so that:

1. a Case may be responsibly assigned to a user or IAM group without moving or duplicating the Case;
2. Child Cases inherit responsibility in a controlled and auditable way;
3. every semantic execution has a server-derived execution principal and credential policy;
4. system automations use configured company integrations;
5. person-funded work uses that person's own eligible integration, including the new `aXtn ChatGPT Plan` provider;
6. deterministic and human work remain provider-free unless they explicitly invoke a semantic step;
7. no silent provider or payer substitution occurs;
8. the existing Swarm remains the orchestration plane, SupaCase remains the work plane, traces/evaluations remain the evidence plane and Git/PR remains the integration boundary.

This design does not create another runner, dispatcher, workflow engine, Case store, approval store or evidence store.

## 2. Source-verified current state

| Area | Current contract | Consequence |
|---|---|---|
| Headless Swarm | `/api/swarm/run` authenticates a `swarm_api_key` and executes with `key.user_id` | API-key owner currently becomes run owner, data scope, budget subject and credential lookup subject |
| Agent inference | `swarmExecute.server.ts` sends `internalUserId: opts.userId` to `/api/chat` | One ID currently carries several meanings |
| Provider credentials | `credentials.server.ts` resolves own credential first, then IAM-granted credential, then limited operator fallback | System and personal funding cannot be selected explicitly |
| IAM | Native users, groups, model rules and resource grants exist | Reuse; do not create a parallel group or policy model |
| SupaCase | Cases are rows in the existing owner-scoped `axtn_cases` dataset | Keep this dataset; do not copy or physically transfer Case rows |
| Work Contract | Native `axtn_case_work` RPC provides idempotent transitions, dependencies, evidence references and acceptance guards | Extend this contract; do not bypass it |
| Case assignment | `caseContract.ts` and the Case row have no responsible user/group or assignee contract | Additive platform gap |
| Shared Case access | IAM data-table grants are read-only; Case mutations are owner-bound | Add narrow Case-specific authorization; never grant generic shared writes |
| Provider model | `ProviderId` and Integrations UI have no ChatGPT-plan provider | Add a native provider entry and bounded adapter |
| ChatGPT-plan transport | Current provider tool loop is Chat Completions based | ChatGPT-plan use must use Responses/Codex app-server contract, not masquerade as Chat Completions |

## 3. Locked terminology

These dimensions MUST remain separate.

| Term | Meaning | Source |
|---|---|---|
| Case custodian | Stable owner of the physical `axtn_cases` dataset | Server/database; never caller supplied |
| Responsible principal | User, IAM group or system responsible for the Case | SupaCase assignment contract |
| Assignee | Concrete user selected for current responsibility; nullable for system or unclaimed group work | Server-authorized Case state |
| Run initiator | Authenticated session, API key, schedule/webhook or internal system that started the run | Native run/audit context |
| Execution principal | Concrete system or user identity whose execution policy applies to one Attempt | Server-derived and sticky per Attempt |
| Credential owner | Owner of the selected provider connection | Provider resolver only; not a graph payload field |
| Actor | Human or automation that performed a transition | Existing SupaCase audit dimension |
| Processing mode | `SEMANTIC`, `DETERMINISTIC` or `HUMAN` | Existing Work Contract |
| Execution channel | `SWARM`, `COPILOT_CLI` or `HUMAN` | Existing Work Contract |

The user who clicks Run is not automatically the execution principal. The Swarm/API-key owner is not automatically the payer. The Case custodian is not automatically the responsible principal.

## 4. Locked architecture decisions

### AD-01 — Keep one Case and one Case store

The existing `axtn_cases` row remains the fachlicher Träger. Assignment changes mutate only responsibility metadata and audit events. The row, Case ID, parent/child lineage, references, findings and evidence links remain stable. No second Case table or duplicated per-assignee Case is allowed.

### AD-02 — Stable custody, transferable responsibility

Do not move a Case between `user_data_tables`. The existing dataset `user_id` is stable custody. Add server-controlled responsibility fields to the Case JSON and Case-specific access functions. A responsible user/group may read and perform permitted Case operations through those functions without receiving generic write access to the custodian's data table.

### AD-03 — Assignment schema

Each Case supports the following additive fields:

```text
responsible_principal_type: USER | GROUP | SYSTEM
responsible_principal_id: uuid | null
assignee_user_id: uuid | null
assignment_policy: MANUAL | LEAST_ACTIVE_ELIGIBLE
assignment_inheritance: INHERIT | OVERRIDE
assignment_version: positive integer
assignment_updated_at: timestamp
assignment_updated_by: authenticated user id or trusted system principal
semantic_route_mode: SYSTEM_INTEGRATION | PERSONAL_CONNECTION
semantic_route_provider_id: provider id | null
semantic_route_model_id: model id | null
semantic_route_version: positive integer
```

Rules:

- `USER` requires `responsible_principal_id` referencing an active AgentSwarms user and sets the same user as assignee.
- `GROUP` requires a native `iam_groups.id`; an assignee must be a current member.
- `SYSTEM` has no personal assignee and uses company integration policy.
- Only an authenticated authorized human or an explicitly trusted system operation may change responsibility.
- Caller-supplied custodian IDs, credential IDs, tokens and provider secrets are rejected.
- Every assignment mutation is idempotent and emits one audit event containing old/new principal, assignee, policy, assignment version and actor. It contains no secret.
- The semantic route selects only execution class, provider and model. It never contains or selects a credential row, token or credential owner.
- The native Agent node's provider/model remains the default. An authorized Case route may override provider/model for the next Attempt; the effective route and route version are persisted in the Attempt binding.

### AD-04 — Child inheritance

- A new Child Case defaults to `INHERIT` and copies the parent's current responsibility and assignment policy.
- A Child may explicitly use `OVERRIDE` when authorized.
- Reassigning a parent cascades to open descendants that remain `INHERIT`.
- Closed children retain their historical assignment.
- A running Attempt is never rebound mid-call. Reassignment affects the next Attempt or a suspended Attempt after explicit resume/rebind.
- The cascade and its audit events commit transactionally and are idempotent.

### AD-05 — Deterministic group claim

For a `GROUP` Case that needs a personal execution principal and has no assignee:

1. obtain an advisory/transactional lock on the Case;
2. load active group members;
3. filter to members allowed for the requested provider/model and possessing an active eligible personal connection;
4. select the member with the smallest count of active personal Attempts in the group;
5. break ties by stable user UUID order;
6. persist the assignee and Attempt binding before inference;
7. reuse that binding for every retry/resume of the same Attempt.

No random choice is permitted. If no eligible member exists, return `NO_ELIGIBLE_EXECUTION_PRINCIPAL`, block the Case and perform no provider call.

### AD-06 — Server-derived Attempt binding

At the first semantic step of an Attempt, resolve and persist a binding:

```text
case_id
attempt_id
assignment_version
execution_class: SYSTEM_INTEGRATION | PERSONAL_CONNECTION
execution_principal_type: SYSTEM | USER
execution_principal_user_id: uuid | null
provider_id
model_id
routing_reason
bound_at
```

The binding belongs to existing Case/run state and evidence; it is not a new control plane. Credential material and refresh tokens never appear in the Case, graph, run input, trace payload or client response.

### AD-07 — Resolve from run and Case, not arbitrary IDs

The headless run accepts an authorized `case_id` and persists it on the native `swarm_runs` record. Internal agent calls send `runId` and `nodeId`. `/api/chat` reloads the run and Case server-side, validates the Case access and Attempt binding, and derives:

- data scope/custodian;
- budget subject;
- execution principal;
- provider/model policy;
- credential lookup subject.

Do not add a graph field that accepts `user_id`, credential owner or integration ID. Do not trust `internalUserId` as all four identities for Case-bound runs. Non-Case legacy runs retain current behavior until deliberately migrated.

### AD-08 — System and personal credential policies

`SYSTEM_INTEGRATION`:

- resolves exactly one active company/provider integration reachable through the existing IAM grant/configuration for the selected provider;
- returns `SYSTEM_INTEGRATION_UNAVAILABLE` when none is eligible and `SYSTEM_INTEGRATION_AMBIGUOUS` when more than one is eligible;
- must not choose a credential by newest-row, insertion-order or other implicit preference;
- does not add a second routing-policy table merely to resolve ambiguity in V1;
- may use existing IAM resource grants;
- must not consume a member's personal ChatGPT-plan connection;
- remains the default for unattended document intake and other declared system automations.

`PERSONAL_CONNECTION`:

- uses only the concrete assignee's own eligible connection;
- never falls back to another user's connection or a group-shared personal token;
- checks model access for the execution principal;
- attributes local usage and trace evidence to the Case, run and execution principal.

The existing own-first/grant-fallback resolver must not decide between these policies implicitly. Add an explicit server-only credential-resolution context.

Budget attribution follows the same separation:

- personal execution checks and records usage against the concrete execution principal;
- group/company execution uses the native responsible-group budget when one is configured, otherwise the existing organization/operator budget contract;
- the run initiator is not automatically the budget subject.

### AD-09 — No silent fallback

Quota, plan limit, expired authorization, missing connection, unavailable model or IAM denial must produce a typed failure and no automatic payer/provider switch. For Development Cases, expose authorized human actions:

- retry the same route;
- select another allowed provider/model integration;
- switch to company API funding;
- assign/take over the Case as another eligible user;
- leave the Case waiting.

The selection increments `assignment_version` or creates a new Attempt binding as appropriate and is audited. Data-classification/provider allow rules filter the offered alternatives. A restricted Case must never offer an external provider prohibited by policy.

### AD-10 — `aXtn ChatGPT Plan` is a provider integration

Add display name `aXtn ChatGPT Plan` and provider ID `axtn_chatgpt_plan` to the existing provider/integration architecture. It is not an MCP server and not a development-only controller.

It must reuse:

- the Integrations page/card pattern;
- encrypted server-side credential storage;
- IAM model access checks;
- existing budget/trace/run correlation;
- provider/model selectors;
- the native Swarm agent-node path;
- existing Case and run state.

It must not use generic credential sharing. Personal plan credentials are non-shareable even if other provider credentials can be IAM-granted.

### AD-11 — Official ChatGPT-plan protocol

Implementation must follow the current official Sign in with ChatGPT open-source-app contract:

- first registration uses `client_id=dynamic_agent_client`;
- PKCE S256, state and nonce are mandatory;
- scopes are `openid profile email offline_access resource.invoke chatgpt.tokens.use.direct`;
- resource is `https://api.openai.com/v1`;
- the callback is HTTP loopback on `127.0.0.1`, never `localhost` and never an invented public callback;
- issued `client_id`, refresh token rotation, ID-token issuer/audience/nonce/signature and subject binding are validated;
- remote self-hosting completes OAuth locally and transfers protected credentials to the VM;
- inference uses Responses semantics, directly or through Codex app-server; it must not pretend to be `/chat/completions`;
- `model/list` is a catalog, not entitlement proof; only a successful inference verifies the selected model for the request;
- tokens refresh server-side and are encrypted at rest.

Authoritative references:

- https://developers.openai.com/siwc/token-sharing-open-source/sign-in
- https://developers.openai.com/siwc/token-sharing-open-source/self-hosted-vms
- https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server
- https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations

The Integrations card may provide a local pairing/import helper, but it may not bypass the loopback rule. A public website OAuth flow requires an approved website client and is outside V1 unless such a client is actually available.

### AD-12 — Bounded V1 provider capability

V1 must support normal text inference for native Agent nodes and the Development Swarm. Use the existing node sequencing, fan-out, retry, suspension and tracing. Do not embed orchestration in the provider adapter.

Agent-embedded tools are permitted only when mapped to the existing AgentSwarms tool registry with the same allow-list, data scope, trace and approval contracts. If that mapping cannot be proven, V1 must reject agent-embedded tools for `axtn_chatgpt_plan` with a typed capability error; it must not silently execute Codex shell, MCP, web, child-agent or filesystem tools. Separate native Tool nodes remain usable in the graph.

## 5. Execution decision table

| Case/step | Execution principal | Credential policy | Expected behavior |
|---|---|---|---|
| DMS unattended Stage 1 | SYSTEM | SYSTEM_INTEGRATION | Existing configured Gemini/API integration; no personal plan use |
| Development Case assigned to user | That user | PERSONAL_CONNECTION by explicit Case route | Use user's `aXtn ChatGPT Plan` or other selected personal provider |
| Development Case assigned to group, unclaimed | Deterministically claimed member | PERSONAL_CONNECTION | Persist sticky assignee/Attempt binding before inference |
| Development Case set to company funding | SYSTEM | SYSTEM_INTEGRATION | Use selected allowed company API integration |
| Deterministic build/test node | SYSTEM | none | No LLM credential resolution |
| Human step | Authenticated human | none unless human starts semantic action | Audit actual actor independently |
| Provider/plan unavailable | none until decision | none | Block/suspend Case; present allowed continuation choices |

## 6. Security boundaries

- Personal ChatGPT tokens are encrypted, write-only from the UI and usable only for the same verified AgentSwarms user.
- Never expose tokens to graph JSON, browser state, Case rows, traces, logs, evidence files, callbacks or MCP tools.
- Do not allow IAM resource grants for `axtn_chatgpt_plan` credentials.
- Server-side ID-token validation and subject continuity are mandatory.
- Refresh-token replacement commits atomically; reuse or identity change forces reauthorization.
- The pairing/import path uses one-time, short-lived, single-use binding to the authenticated AgentSwarms user and rejects replay.
- Company integrations and personal integrations are visibly distinguished.
- Case reassignment requires authorization and does not itself grant unrelated data-table access.
- Existing independent Approval and builder-self-acceptance guards remain unchanged.
- No PROD credential, token or personal identifier is committed to Git evidence.

## 7. Failure semantics

Minimum typed outcomes:

```text
CASE_ACCESS_DENIED
CASE_ASSIGNMENT_CONFLICT
CASE_ASSIGNMENT_VERSION_CONFLICT
NO_ELIGIBLE_EXECUTION_PRINCIPAL
PERSONAL_CONNECTION_REQUIRED
PERSONAL_CONNECTION_REAUTH_REQUIRED
PERSONAL_PLAN_LIMIT_REACHED
MODEL_ACCESS_DENIED
PROVIDER_CAPABILITY_UNSUPPORTED
SYSTEM_INTEGRATION_REQUIRED
SYSTEM_INTEGRATION_UNAVAILABLE
SYSTEM_INTEGRATION_AMBIGUOUS
ROUTING_DECISION_REQUIRED
```

All outcomes must be safe to retry. A failed or repeated request must not duplicate a Case, assignment event, Attempt binding, model call or billing event. Provider failures never close or accept a Case.

## 8. Required acceptance scenarios

1. Assign a Case from user A to user B; Case ID, custody, lineage and references remain unchanged; both authorized views show the same Case.
2. Assign a Case to a group and create two Child Cases; inheritance is correct and no Case is duplicated.
3. Run two group Child Cases concurrently; deterministic least-active selection is race-safe and approximately balanced, with stable tie-breaking.
4. Retry/resume one Attempt; the same execution principal and provider binding is reused and no second inference occurs for an idempotent replay.
5. Reassign a parent; open inherited descendants change, overridden and closed descendants do not, and active Attempt identity does not change mid-call.
6. Execute unattended DMS Stage 1; it continues to use the company Gemini/API integration and no personal credential.
7. Execute a Development Swarm semantic node on user A's `aXtn ChatGPT Plan`; trace/Case/run correlations identify user A as execution principal without exposing a token.
8. Exhaust or simulate plan capacity; no silent fallback occurs, the Case remains open/blocked and authorized continuation choices are offered.
9. Select OpenAI API or Gemini as continuation; a new audited binding is created and the Swarm resumes through the existing graph path.
10. Attempt to use user A's ChatGPT-plan credential for user B or a group grant; deny without provider call.
11. Attempt caller-supplied user/credential IDs in run or graph payload; reject or ignore and derive server-side.
12. Restart the app during a suspended run; Case assignment, Attempt binding, checkpoint and allowed resume action persist.
13. Run deterministic Build/Verify steps; no semantic credential is fetched.
14. Verify builder cannot accept its own result after assignment/takeover changes.
15. Verify legacy non-Case swarms and all existing provider integrations remain operational.
16. Verify the Integration card reports Connected only after a real authenticated inference, not model catalog discovery.
17. Verify the ChatGPT-plan adapter refuses unsupported agent-embedded tools instead of enabling Codex local tools.

## 9. Explicit non-goals

- No replacement for native AgentSwarms orchestration.
- No n8n-based dispatcher.
- No separate Case, queue, retry, approval or evidence service.
- No automatic cross-provider fallback.
- No shared personal ChatGPT-plan account.
- No claim that local counters reveal OpenAI's exact remaining 5-hour or weekly allowance.
- No public OAuth callback invented for the open-source dynamic-client flow.
- No merge, tag or release without the separate integration decision required by repository governance.

## 10. Genuine stop gates

Stop and report with source/runtime evidence if and only if:

1. the required behavior cannot be implemented by extending the existing native Case, run, IAM, provider and tracing contracts without a second control plane;
2. the current official ChatGPT-plan flow rejects the compliant local-pairing/remote-import path;
3. a required provider capability would require enabling unscoped Codex shell/MCP/filesystem access;
4. an additive migration cannot preserve existing Case IDs, lineage and evidence;
5. PROD data integrity or secret confidentiality cannot be maintained;
6. an actual source/runtime contract contradicts an Architecture Decision above.

At a stop gate, do not substitute another architecture. Record the exact contradiction, affected decision, source path/runtime evidence and smallest possible amendment for human decision.
