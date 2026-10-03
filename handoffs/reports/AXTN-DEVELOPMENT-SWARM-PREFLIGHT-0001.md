# AXTN Development Swarm V1 — Phase-A Preflight

**Date:** 2026-10-03
**Repository / branch:** `aXtn/aXtn-agentswarms`, `work/AXTN-DEVELOPMENT-SWARM-0001`
**Status:** `PREFLIGHT_PARTIAL_BLOCKED`
**Scope:** Read-only source/runtime inspection plus this report. No application source, configuration, product data, database, branch state outside this report, or runtime was changed.

## 1. Result

The authorized documentation-only continuation is complete. Phase A found that the deployed AgentSwarms pin does include SupaCase, and the run API has a server-derived owner identity suitable for a future headless binding. SupaCase itself is not currently exposed as a headless tool, however. The live Gitea-MCP service is not reachable from AgentSwarms, its running source disagrees with the Host manifest, and the AgentSwarms MCP registry is empty. The Notebook Runtime is disabled; its effective image setting is a mutable tag, there are no grants or sessions, and Squid's mounted generated ACL files are absent.

These are entry blockers, not reasons to bypass the contracts. No Phase-B implementation, service/network repair, runtime enablement, repository write, or acceptance drill was started. The current user authorization and `HANDOFF.md` permit only this report and its commit/push.

## 2. Verified pins, worktrees, and runtime

| Item | Verified state |
|---|---|
| AgentSwarms deployed pin | `844eddf5fc60ca6cef8fcc948e293eecc2d6b22e`; Host pin and live image agree. The deployed source has `86d10fe9f871a0a12dab2de788f52f5bc68423c8` in its ancestry. |
| Host state | `aXtn/aXtn-host`, `work/AXTN-HOST-MAINTENANCE-BINDINGS-0001`, clean at `5a437f454cf984238d554e26eadf43851c9624f2`. |
| AgentSwarms task worktree | `/home/alex/aXtn-agentswarms-development-swarm-worktree`, `work/AXTN-DEVELOPMENT-SWARM-0001`, clean before this report at `bb4b68789cccd415cc6baf6d243911213378ed2f`; authenticated `origin` ref resolved to the same SHA. Fetch/push URL is the host-local Gitea loopback URL. |
| Acceptance repository | `aXtn/development-swarm-acceptance`, default branch `main` at `0a38f20ccea94d937a5d4fa2ad18b37ae6439c09`. |
| Live AgentSwarms | Container reports healthy and runs image `axtn-agentswarms-native:844eddf5fc60ca6cef8fcc948e293eecc2d6b22e`. |
| Live Gitea | Container reports healthy; AgentSwarms resolves `axtn-gitea` but not `axtn-gitea-mcp`. |
| Unrelated `aXtn/aXtn-git` checkout | Existing branch `change/GIT-NATIVE-PUSH-MIRROR-0001` has staged deletions of `mirror-hooks/axtn-github-mirror` and `scripts/install-github-push-mirror-hooks.sh`. It was not altered. |
| Repository instructions | AgentSwarms `CONTRIBUTING.md`, this branch's `HANDOFF.md`, both referenced architecture contracts, and the Host execution/pin/network contracts were read. The handoff explicitly makes Issue API access unnecessary; no access boundary was bypassed. |

Host-pin evidence: `aXtn-host/architecture/AGENTSWARMS-PIN.yaml:8,33`, `COMPONENT_MANIFEST.yaml:35`, `STATUS.yaml:19,113,121-122`. Task-worktree evidence: `HANDOFF.md:5,24-32`; the current Git status/log/remote and `ls-remote` checks matched the values above.

## 3. Phase-A entry-condition matrix

| Entry condition | Result | Evidence / reason |
|---|---|---|
| Resolve current Host and AgentSwarms pins | **PASS** | Host status, pin contract and live AgentSwarms image agree on `844eddf5…`; task branch is based on that deployed source. |
| Use a clean, task-specific AgentSwarms worktree | **PASS** | Exact canonical branch and SHA verified in a separate clean worktree. The unrelated dirty `aXtn-git` checkout was left untouched. |
| Current Gitea-MCP source/image provenance | **BLOCKED** | Live `axtn-gitea-mcp` uses `axtn-gitea-mcp:dev-dfbb45a` / source `dfbb45ad6ee546e4b84cea35a106a0bce20c7070`; Host manifest requires `a85a33332d1d398fed9942032fad35a2283f76f9`. A second `angry_yalow` container has image `axtn-gitea-mcp:gate-e-a85a333`, but is on the default bridge, not the AgentSwarms or `axtn_git_internal` network. Do not treat its presence as proof that the active service uses that candidate. |
| AgentSwarms internal MCP reachability and registry | **BLOCKED** | Current AgentSwarms has no `axtn-gitea-mcp` DNS result; `axtn-gitea` resolves. Live `mcp_servers`, `mcp_apps`, and `mcp_app_keys` counts are all zero. |
| MCP identity, write mode, and rights | **PARTIAL** | Read-only Gitea identity lookup returned `axtn-gitea-mcp`, `is_admin=false`; target repository permissions are `pull=true`, `push=true`, `admin=false`. Runtime owner scope is `aXtn`, write mode is `review`, and the live MCP lists 11 tools. This is not a repository-specific permission boundary. |
| MCP tool allowlist adequate for V1 | **BLOCKED** | AgentSwarms only filters connected MCP server **names** through the agent's `mcp_server_names`; it does not establish a per-tool allowlist. The live server offers `integrate_pull_request` and `stage_file_deletion` alongside read/branch/file/PR tools. A V1 graph cannot safely rely on a server-name allowlist to exclude a capability it must not use. |
| Notebook Runtime enablement / grants / sessions | **BLOCKED** | Live settings: runtime disabled, Docker backend, `require_grant=false`, zero grants, zero sessions. Enabling this as-is would not establish a grant requirement. |
| Notebook image and limits | **PARTIAL** | Effective configured image is the mutable tag `agentswarms/notebook-runtime:latest`; no notebook session is running. A local image exists at `sha256:bacda8045e082305ee804de291ed094d36f3320880e5a57c823c2559e934a95a`, but no active runtime setting pins that digest or proves its build provenance. Live limits: interactive 1 CPU / 2048 MB, batch 2 CPU / 4096 MB, 3 sessions/user, 50 total, 30-minute idle TTL, 480-minute max session, 120-second cell timeout. |
| Notebook egress readiness | **BLOCKED** | Squid mounts the component's egress directory read-only. Only `allowed_domains.default`, `allowed_ips.default`, and `squid.conf` exist; the configured `allowed_domains` and `allowed_ips` files are missing. `squid -k parse` reports both ACL files cannot be opened and both ACLs are empty. `http_access deny all` keeps this fail-closed, but the configured allowlist is not active. |
| SupaCase source and deployed availability | **PASS, with evidence limitation** | The deployed pin descends from the required SupaCase restoration. Prior Phase-A evidence recorded authenticated HTTP 200 smoke results for Cases, Accounts, and Contacts. The raw response was not committed as an independent artifact; the source contracts and test inventory are independently inspectable. |
| SupaCase headless CRUD/relation binding | **BLOCKED** | Current CRUD server functions require an `access_token`; there is no SupaCase tool in the headless tool registry. The run API does resolve the API key's `user_id` server-side, but that owner is not currently connected to these Case functions. |
| Source execution contracts for required V1 node types | **PARTIAL** | The headless executor implements the required structural node types, but the Gitea tool binding is absent, the verifier runtime is disabled, HTTP is not intrinsically restricted to the acceptance repository, and Approval notification persistence is best-effort. See the node matrix below. |
| Reproducible deterministic runtime harness | **BLOCKED** | The server Notebook Runtime is disabled, and no active session/image digest or current execution proves that the V1 verifier can run in the pinned environment. The tracked `deploy/notebooks/test/verify-runtime.sh` and `security-suite.sh` are harnesses, not proof of a currently usable V1 runtime. |
| Focused SupaCase regression tests | **PARTIAL** | Prior Phase-A checkpoint records 63 focused tests passing. A replay in this clean worktree could not start: `vitest` is not installed (`sh: 1: vitest: not found`, exit 127). No dependency install was made for this documentation-only task. |
| Overall Gate A | **BLOCKED** | MCP provenance, network binding, tool scope, and deterministic runtime image/enablement are unresolved. No implementation or runtime workaround is authorized by the current handoff. |

### Commands and read-only probes

The following checks were run against the task worktree and live containers. They did not write application or product state:

```text
git -C /home/alex/aXtn-agentswarms-development-swarm-worktree status --short --branch
git -C /home/alex/aXtn-agentswarms-development-swarm-worktree log -1 --format='%H%n%D%n%s'
git -C /home/alex/aXtn-agentswarms-development-swarm-worktree remote -v
git -C /home/alex/aXtn-agentswarms-development-swarm-worktree ls-remote origin refs/heads/work/AXTN-DEVELOPMENT-SWARM-0001
docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}'
docker exec axtn-native-agentswarms-agentswarms-1 sh -lc 'getent hosts axtn-gitea-mcp axtn-gitea'
docker exec axtn-native-supabase-db psql -X -U postgres -d postgres -At -F '|' -c "SELECT server_runtime_enabled,require_grant,backend,default_image,max_sessions_per_user,max_sessions_total,idle_ttl_minutes,session_max_minutes,cell_timeout_seconds,cpu_limit,mem_limit_mb,batch_cpu_limit,batch_mem_limit_mb,batch_max_minutes,pip_allowed,cardinality(egress_allowlist) FROM public.notebook_runtime_settings WHERE id=true"
docker exec axtn-native-supabase-db psql -X -U postgres -d postgres -At -F '|' -c "SELECT audit_retention_days,provenance_retention_days FROM public.iam_settings ORDER BY id LIMIT 1"
docker exec agentswarms-notebook-egress squid -k parse
npm run test -- --reporter=dot tests/unit/caseContract.test.ts tests/unit/caseDetailCapabilities.test.ts tests/unit/caseManagement.test.ts tests/unit/caseManagementPersistence.test.ts tests/unit/supacaseResumeAcceptance.test.ts tests/unit/swarmResumeRunRecord.test.ts tests/unit/swarmParkedCancel.test.ts tests/unit/swarmParkedRunWrites.test.ts tests/unit/axtnDocumentsWorkbench.test.ts
```

The authenticated read-only Gitea probes were `GET /api/v1/user`, `GET /api/v1/repos/aXtn/development-swarm-acceptance`, and the target repository's default-branch endpoint. A fresh MCP initialize followed by `tools/list` on the loopback MCP endpoint returned HTTP-successful JSON-RPC and 11 tool names. The credential values and authorization headers were not printed, saved, or included here.

### Source-level node execution contracts

The deployed API runs the published graph snapshot under the API key's owner. The source has explicit headless handlers for the V1 structure, but source support does not substitute for the blocked external bindings or the harness acceptance:

| V1 node / mechanism | Current source contract | Phase-A implication |
|---|---|---|
| `input` / `output` | `input` copies the run input into graph state; `output` gathers incoming state. Neither performs the V1 task/evidence schema validation by itself. | The graph needs deterministic validator functions before any side effect and before its terminal verdict. |
| `function` | Runs code in the separate JS sandbox service; execution fails if that service is not configured. | Suitable for small deterministic validators only after the service is proven and the validator contracts are tested. It is not the Python verifier harness. |
| `tool` / Gitea | Headless `tool` nodes reject tool IDs outside the explicit headless-safe/scoped sets. `mcp_call_tool` is permitted, and `toolConfigs.mcp_server_names` filters server names. The MCP call still accepts a tool name and the AgentSwarms registry has no tool-name allowlist. | Cannot meet the V1 repo/tool scope until the graph-to-MCP boundary is narrowed and negatively tested. |
| `agent` / Builder, Breakers, Learner | Headless agent nodes call `/api/chat` using the run owner. Internal chat caps tools to the headless-safe set; user memory is disabled for these runs. | LLM nodes can draft/review/learn but do not independently establish a deterministic verdict; provider/model access and same-SHA inputs still need run evidence. |
| `merge` | Deterministic `array`, `object`, `first`, or default concatenation of named graph values. | Can preserve original reviewer outputs, but schema/completeness validation must be an explicit deterministic step. |
| `http` / verifier call | Resolves the run owner's secret references server-side, then uses `safeFetch`. Metadata/link-local targets and unsafe redirect hops are blocked; private/internal targets are permitted unless separately disabled. | It is not an automatic isolated harness boundary or target-repository allowlist. V1 must bind the exact runtime endpoint and constrain effects before use. |
| `evaluate` | Calls an LLM judge and emits a scorecard; the current implementation has a threshold and score but no deterministic test verdict. | Advisory only. It cannot override test/build/contract failure, in accordance with the V1 contract. |
| `approval` / resume | With `rejectApprovals=true`, the API/scheduled run fails closed instead of waiting. Otherwise it checkpoints and suspends; resume loads the run's graph snapshot and checkpoint and derives the decision from the approval row. | API-key configuration must permit parking. Approval-row creation is best-effort: if its write fails, the run retains its checkpoint but the approver may not receive an inbox row. That durability/visibility path needs an explicit negative test before V1 acceptance. |

Unsupported headless node types fail explicitly rather than silently running. The API accepts an optional idempotency key for request replay, but that does not make non-idempotent Gitea/HTTP side effects safe without per-effect keys and readback. The parent V1 contract still requires those checks.

Evidence: `src/routes/api/swarm.run.ts:46-65,188-222,282-289`; `src/utils/swarmExecute.server.ts:68-117,165-190,520-700,700-920,920-1030,1137-1185`; `src/utils/swarmNodes.server.ts:20-71`; `src/utils/tools/registry.server.ts:1350-1515,1732-1755,1976-2000`; `src/utils/swarmResume.functions.ts:73-164`.

## 4. Gitea-MCP source, identity, scope, and network

- The live `axtn-gitea-mcp` service is attached only to `axtn_git_internal`; the AgentSwarms container is on its native, API, JS, and notebook networks. There is no shared network/service alias for the MCP container. The API service is reachable separately as `axtn-gitea`.
- `MCP_ALLOWED_OWNERS=aXtn` is an owner boundary, not an allowlist for the single acceptance repository. `MCP_WRITE_MODE=review` is active. The live identity is non-admin and has push/pull rights on `aXtn/development-swarm-acceptance`.
- The current MCP inventory is `create_branch`, `fetch`, `identity`, `integrate_pull_request`, `issue`, `list_repositories`, `pull_request`, `repository_tree`, `search`, `stage_file_deletion`, and `upsert_file`.
- Existing Host evidence records successful denial of direct `main` writes, foreign owners, and generic merge in review mode. It does not turn the AgentSwarms `mcp_server_names` filter into a tool-level restriction, and the exposed `integrate_pull_request` operation still needs a source-level effect review before V1 can be built around it.
- The Host manifest's required source `a85a333…` does not match the live service's `dfbb45ad…`. The `a85a333…`-tagged container is a separate bridge-only container, not a substitute for resolving the active service's provenance.

**Smallest safe future binding:** first resolve and pin one canonical MCP candidate, prove its reviewed operation semantics from that exact source, then provide an explicit internal network alias to AgentSwarms and a target-repository boundary. Expose only read, branch, upsert, readback, PR-create, and review operations to the V1 graph. Preserve review mode; do not add direct-main, merge, deletion, owner-wide, or admin capabilities. The current runtime does not yet prove that boundary.

Evidence: `aXtn-host/architecture/COMPONENT_MANIFEST.yaml:53,58-68`; `aXtn-host/evidence/gitea-mcp-runtime/20260916T195016Z-pr6-runtime-acceptance.md:17,45-60,71-85`; live container/image, network, owner/mode, tool-list, and Gitea permission probes above.

## 5. Notebook Runtime contract and cause of the missing ACLs

The source setting is intentionally opt-in (`server_runtime_enabled=false`). Effective enablement also requires a runtime signing secret. The live row is disabled, `require_grant=false`, backend `docker`, image `agentswarms/notebook-runtime:latest`, and the queried limits are recorded in the matrix. There are no live runtime sessions or grants. The local digest is not the effective configured image pin.

The egress templates are tracked; live `allowed_domains` and `allowed_ips` files are generated and untracked. `scripts/setup.sh` seeds these files from the `.default` templates before its own Compose startup. The native deployment has the directory mounted but has not materialized those generated files; therefore Squid is running with empty ACLs and fails closed at `http_access deny all`. The application can write the shared source directory when its egress-apply path is invoked, but no such settings-save/ensure event was performed during this preflight. A passing Squid process status is not evidence that its allowlist works.

The minimal safe continuation is not “turn it on”: resolve and pin a reproducible image, establish an explicit IAM/grant policy before enablement, deterministically seed/apply the ACL files from the selected allowlist, verify deny-by-default and positive/negative egress cases, then run only the pinned synthetic Python harness. Do not widen egress or enable the runtime as part of this report.

Evidence: `supabase/migrations/20260730000000_notebook_runtime.sql:57-85`; `src/utils/notebookRuntime/config.server.ts:355-380`; `src/utils/notebookRuntime/egressApply.server.ts:45-49,152-190`; `scripts/setup.sh:59-73`; `deploy/notebooks/egress/squid.conf`; live settings/grant/session query, image inspect, mount listing, file listing, and Squid parse above.

## 6. SupaCase section-13 findings

| # | Read-only question | Result |
|---:|---|---|
| 1 | Is SupaCase available at the resolved pin and in Runtime? | **PASS, limited evidence.** SupaCase source is in the deployed `844eddf5…` ancestry and the previous Phase-A authenticated smoke recorded HTTP 200 for `/cases`, `/accounts`, and `/contacts`. The deployed image is still that pin. The raw response artifact was not preserved, so this is not a claim of a new smoke run in this documentation worktree. |
| 2 | Which Case CRUD/relation functions can a headless Swarm actually call? | **BLOCKED.** `listCaseManagement`, `createCase`, `updateCase`, `createCaseRelation`, and related server functions all validate an `access_token` and resolve it with `auth.getUser()`. They are not registered as headless tools. `mcp_call_tool` is generic MCP, not a SupaCase function binding. |
| 3 | Can the run owner be bound without a token in graph payload? | **PARTIAL / implementation seam exists.** `/api/swarm/run` resolves the API key's `user_id` server-side and passes it to `executeSwarmServer`; headless tool contexts carry `scopeUserId=userId`. A future SupaCase tool should use only this trusted context and explicitly owner-scope every service-role operation. No graph-supplied owner or access token is needed, but no such tool exists yet. |
| 4 | Is there generic idempotent ensure-by-source? | **PARTIAL / no.** `ensureCaseForAcceptance` ensures `source_kind=dms_document` and `source_id=documentId`, repairs a missing document relation, and reuses the same Case. Manual `createCaseForUser` generates a new UUID and uses `source_kind=manual`; no generic source-identity contract is present. |
| 5 | Can Case relations be validated as directed work dependencies without a new model? | **PARTIAL / no current dependency contract.** Relations store a directed `case_id` → `target_id`, validate same-owner target existence, reject self-links, and make the same directed tuple idempotent. The API hardcodes `related_case`; it does not accept a dependency type or detect cycles/order violations. `parent_case_id` is separately validated as existing, not as a cycle-free dependency DAG. |
| 6 | What UI/server work is missing for mode, assignment, contract, and human takeover? | **PARTIAL.** Case detail supports normal field/status edits, parent/child creation and related Case/Account/Contact selection. The current Case fields include no work-contract reference, required-dependency set, processing mode, actor reference/assignment, result reference, or evidence reference. `actor` is a per-operation `human|automation` guard, not an assignment or takeover lifecycle. The UI does not model mode switches or hand off the same Child Case between an automated and human actor. |
| 7 | Does native Audit support the required events/metrics and retention? | **PARTIAL / insufficient for V1 metrics.** `audit_events` supports action/resource/detail/time, user/time and time indexes; live retention is 365 days for ordinary events and 183 days for provenance events. The Case source emits `axtn_case.create` only; updates, relation/assignment, mode changes, handovers, retries and dependency transitions are not recorded there. `auditEvent()` is asynchronous/fire-and-forget and warns on failure, so it does not guarantee a transition event. Existing fields are queryable, but the event coverage is not sufficient to calculate the requested automation, handoff, rework, blocked-time and duration metrics. |
| 8 | What minimal typed references are needed? | **PARTIAL / existing fields are insufficient.** `parent_case_id` and Case relation targets are typed only for Case/Account/Contact/Document. `related_entity` is a free-form string. Use a validated reference object with a closed `kind` (`repository`, `issue`, `pull_request`, `run`, `evidence`), canonical repository identity, stable external ID/URI, and revision/hash where applicable. Keep evidence payloads out of Case rows; store only stable references. |
| 9 | Which tests can be extended without changing DMS/Resume contracts? | **PASS for identified seams; execution partial.** Extend `caseContract.test.ts`, `caseManagement.test.ts`, `caseManagementPersistence.test.ts`, and `caseDetailCapabilities.test.ts` for Case contracts/UI; add focused cases to `supacaseResumeAcceptance.test.ts` only for preserving DMS ensure/relation replay; keep `swarmResumeRunRecord.test.ts`, `swarmParkedCancel.test.ts`, and `swarmParkedRunWrites.test.ts` as D09 regression gates. The prior preflight recorded 63 focused passes; the replay command in this task did not run because `vitest` is absent in the clean worktree. |

Source references:

- Run owner and headless context: `src/routes/api/swarm.run.ts:64-65,282-289`; `src/utils/swarmExecute.server.ts:68-75,102-117,600-618`.
- Token-required Case functions: `src/axtn/workbenches/cases/caseManagement.functions.ts:33,53-110`.
- Owner-scoped storage, manual creation, and audit: `src/axtn/workbenches/cases/caseManagement.server.ts:16-48,132-170,197-240`.
- DMS-only ensure: `src/axtn/workbenches/cases/caseManagement.server.ts:336-423`.
- Current Case contract/UI: `src/axtn/workbenches/cases/caseContract.ts:1-27`; `src/routes/_authenticated/cases_.$caseId.tsx:130-225,330-385`.
- Audit shape and retention: `supabase/migrations/20260723300000_audit_log.sql:7-33`; `supabase/migrations/20260735000000_audit_publish_embed.sql:145-152`; `supabase/migrations/20260849000000_provenance_retention.sql:21-24`; `src/utils/audit.server.ts:73-91,112-168`.

## 7. Affected repositories, files, and proposed clean branches

No repository other than the AgentSwarms task worktree was changed.

| Repository | Likely implementation/evidence surface | Proposed branch |
|---|---|---|
| `aXtn/aXtn-agentswarms` | V1 graph/contract validators, headless SupaCase tools, tool registry, tests, and this report | Existing `work/AXTN-DEVELOPMENT-SWARM-0001` |
| `aXtn/aXtn-host` | Native MCP network binding/provenance pin, notebook image and ACL seeding contract, secret-free runtime evidence | New clean `work/AXTN-DEVELOPMENT-SWARM-0001` from current Host task state |
| `aXtn/aXtn-git` | MCP source/pin, repository scope, review-mode/tool-effect behavior and tests | New clean `work/AXTN-DEVELOPMENT-SWARM-GITEA-MCP-0001` after reconciling the canonical source SHA; do not use the dirty checkout |
| `aXtn/development-swarm-acceptance` | Synthetic V1 drill only; one task/attempt branch and PR after Gates A-D | Task/attempt-specific branch from the freshly resolved target default-branch SHA; no write to `main` |

Likely AgentSwarms source surfaces include `src/utils/swarmExecute.server.ts`, `src/utils/tools/registry.server.ts`, `src/axtn/workbenches/cases/**`, the authenticated Case routes, `tests/unit/**`, and the versioned graph/harness location prescribed by the contract. Likely Host surfaces include `architecture/COMPONENT_MANIFEST.yaml`, `architecture/AGENTSWARMS-PIN.yaml`, the native AgentSwarms Compose/network binding, and the bootstrap path that seeds egress ACLs. Exact paths must be re-confirmed in clean task worktrees before any later authorized mutation.

## 8. Minimum safe implementation sequence

1. Resolve the exact Gitea-MCP canonical source SHA versus both live containers and the Host manifest. Review the exact source's side-effect implementations and tests; establish repository-level plus tool-level restrictions, retaining non-admin identity and review mode.
2. Add a native internal network alias/binding only after provenance and isolation are clear. Prove AgentSwarms-to-MCP connectivity, target-repository allowlisting, allowed tools, and negative cases for another repository, main-branch write, deletion, merge/integration, and admin operations.
3. Keep Notebook Runtime disabled until an immutable harness image is selected, its source/build provenance is reproducible, IAM requires explicit grants, the generated Squid ACL files are deterministically materialized, and both allow/deny egress checks pass.
4. Implement deterministic V1 task/candidate/finding/evidence contracts and synthetic fixtures. Add a server-side SupaCase tool using the run's trusted `userId`/`scopeUserId`, never an access token or caller-provided owner in graph input; preserve DMS ensure/replay and D09 checkpoint/resume/cancel semantics.
5. Add typed work/evidence references, idempotent source identity for parent/child work packages, directed dependency validation, mode/takeover events, and explicit hard-gate/approval revision binding. Keep this in existing AgentSwarms orchestration and SupaCase storage; do not add a second scheduler or persistence/control plane.
6. Run focused and full tests, typecheck/lint/docs/infra checks, and production build in the exact AgentSwarms task worktree. Then run the deterministic harness against synthetic fixtures only and bind all breaker/verifier/approval evidence to one immutable PR head.
7. Only after Gates A-D pass, run the isolated acceptance drill against `aXtn/development-swarm-acceptance`. No merge, release, deployment, or PROD capability is part of V1.

## 9. Stop decisions and outstanding risks

- **Stop before Phase B.** The current handoff allows only documentation-related continuation; independently, V1 Gate A is blocked on MCP source provenance/reachability/tool scope and on the deterministic runtime image/enablement contract.
- **No MCP workaround.** Do not attach an unverified image/container to the AgentSwarms network, use the Gitea API instead of the contracted MCP tool surface, or rely on UI/manual writes.
- **No Notebook workaround.** Do not enable the runtime, weaken default-deny egress, install harness dependencies dynamically, or treat the local `latest` image as a verified immutable runtime.
- **No SupaCase token workaround.** Do not put an access token, owner ID, or service credential into graph payloads, prompts, traces, or evidence. The supported future seam is the server-derived run owner.
- **No dirty checkout changes.** The unrelated staged `aXtn-git` deletions remain untouched.
- **No product/runtime mutation.** There was no database write, service restart, branch write outside this report, MCP tool side effect, or acceptance repository change.

Evidence reviewed: this report; `docs/architecture/axtn-development-swarm/HANDOFF.md`; `V1-IMPLEMENTATION-CONTRACT.md`; `SUPACASE-CASE-MODEL.md`; `handoffs/reports/AXTN-SUPACASE-RESTORE-0001.md`; Host pin/manifest/status contracts; `aXtn-host/evidence/gitea-mcp-runtime/20260916T195016Z-pr6-runtime-acceptance.md`; current read-only Docker, Gitea, Supabase and MCP probes above; and local preflight checkpoint 009 for the earlier 63-test result and authenticated SupaCase smoke.
