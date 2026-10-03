# aXtn Development Swarm – Repository Handoff

**Canonical repository:** `aXtn/aXtn-agentswarms`  
**Canonical branch:** `work/AXTN-DEVELOPMENT-SWARM-0001`  
**Branch base:** deployed AgentSwarms `844eddf5fc60ca6cef8fcc948e293eecc2d6b22e`  
**Tracking issue:** `aXtn/aXtn-agentswarms#7`  
**Status:** `IMPLEMENTATION_AND_PRODUCTION_ACCEPTANCE_AUTHORIZED`  
**Authorization date:** 2026-10-03

## Authority and operating model

Gitea repository and verified runtime behavior are authoritative. This repository-backed handoff is the complete execution contract for the server-side executor. Git branches, commits and pull requests remain the integration and source-of-truth boundary.

The user has explicitly authorized Copilot to implement the greenfield system end to end. The Phase-A findings are implementation backlog, not approval gates. Do not create repeated authorization loops between the workstreams. Continue through repair, implementation, deterministic verification, isolated runtime acceptance and integration preparation unless a genuine stop condition below occurs.

Issue API access is not required by an executor that can read this branch. Do not widen credentials merely to read the tracking Issue.

## Mandatory reads

1. `docs/architecture/axtn-development-swarm/V1-IMPLEMENTATION-CONTRACT.md`
2. `docs/architecture/axtn-development-swarm/SUPACASE-CASE-MODEL.md`
3. `handoffs/reports/AXTN-DEVELOPMENT-SWARM-PREFLIGHT-0001.md`
4. applicable repository instructions
5. current Host execution, image, network and pin contracts referenced by those documents

## Accepted Phase-A baseline

Phase A is complete at report commit `d0c070df6738ac520606bcfb170f6ee74973620f`.

Preserve these verified facts:

- AgentSwarms and the live application use `844eddf5fc60ca6cef8fcc948e293eecc2d6b22e`.
- The inspected Host state was `5a437f454cf984238d554e26eadf43851c9624f2`.
- SupaCase source ancestry and the server-derived Run owner seam exist.
- The current SupaCase functions are not yet exposed as safe headless tools.
- AgentSwarms does not yet have a working internal Gitea-MCP binding or registry entry.
- Live Gitea-MCP source/image provenance and the Host manifest pin disagree.
- Current MCP owner scoping is too broad for the Development Swarm; tool/action and repository boundaries are missing.
- Notebook Runtime is disabled, uses an unpinned effective image setting, and lacks materialized Squid ACL files.
- The existing dirty `aXtn-git` checkout is unrelated and must remain untouched.
- The prior 63-test result is historical evidence. The clean-worktree replay did not start because the test dependency was absent; produce a current hermetic replay.

These are tasks to resolve. They do not by themselves authorize another stop-before-implementation report.

## Authorized implementation scope

Copilot is authorized to make and test the source, configuration, schema/migration, deployment-manifest and greenfield runtime changes necessary to deliver the executable V1 across:

- `aXtn/aXtn-agentswarms`
- `aXtn/aXtn-host`
- `aXtn/aXtn-git`
- `aXtn/development-swarm-acceptance`

Use clean, dedicated worktrees and task branches. Preserve unrelated dirty worktrees and existing non-greenfield data. Never place tokens, secrets or credentials in Git, graph payloads, prompts, traces, logs or evidence.

Suggested branch topology:

- AgentSwarms: continue `work/AXTN-DEVELOPMENT-SWARM-0001`
- Host: clean `work/AXTN-DEVELOPMENT-SWARM-0001`
- aXtn-git: clean `work/AXTN-DEVELOPMENT-SWARM-GITEA-MCP-0001`
- acceptance repository: task/attempt branch from the freshly resolved default-branch SHA

Branches and pull requests may be created and advanced without another planning approval. Integration must still satisfy repository protection and the Development Swarm rule that the builder cannot declare its own work accepted. Acceptance must be supported by deterministic checks and an independent review/approval role.

## Production-first execution authorization

Use the existing production AgentSwarms, Host, Gitea and SupaCase environment as the implementation and acceptance plane. Do not create a parallel staging/control plane merely to avoid working in the real system.

Copilot is authorized to deploy, test, observe and repair the Development Swarm directly in production, including required service/network configuration, additive database migrations, immutable image updates, scoped runtime enablement and service restarts, subject to the controls below.

Apply the changes progressively in the same production plane:

1. Before each production mutation, record the exact current commit/image/config/schema revision and a tested rollback action.
2. Use backward-compatible and additive migrations. Do not destructively rewrite or remove established data.
3. Pin every deployed source/image/config revision; do not deploy mutable tags.
4. Activate the new capability first for one dedicated SupaCase Parent Case and `aXtn/development-swarm-acceptance`, using synthetic fixtures but the real production services, IAM, network, persistence, tracing and approval path. Mark all resulting Cases as synthetic Acceptance/Regression Cases and retain them after execution.
5. Keep repository, tool/action, egress, Case-owner and runtime grants narrowly scoped during this canary.
6. Run positive and negative security tests in production without targeting unrelated repositories, Cases, credentials or data.
7. Repair failures in place on the authorized task branches, redeploy pinned candidates and repeat the same acceptance contract. Ordinary defects are not reasons to return for another authorization.
8. After the synthetic production canary passes, execute one low-risk real Development task through the same Parent/Child Case, Swarm, Evidence and PR boundaries.
9. Expand availability only from verified evidence; retain immediate disable/rollback capability throughout.
10. The Builder still cannot self-accept. Deterministic gates and an independent review/approval role must bind Acceptance to the exact deployed candidate revision.

Production operation must remain manually operable if AI execution is unavailable. A human takeover continues the same Case/work contract; it must not create a duplicate process or a second source of truth.

## Required delivery sequence

The workstreams may run in parallel where dependencies allow. Do not pause merely to request approval between them.

### 1. Gitea-MCP boundary

- Reconcile commit ancestry, exact source and image provenance for `dfbb45ad…`, `a85a333…` and the active Host manifest.
- Build and pin one canonical image by immutable digest.
- Add exact repository scoping plus server-enforced tool and action scoping.
- Preserve denial of direct protected/default-branch writes and generic merge.
- The V1 graph must not receive `integrate_pull_request`, `stage_file_deletion`, merge, delete or admin capability.
- Prove positive operations and negative cases for foreign repositories, forbidden actions, protected branches, deletion and merge.
- Establish the native Host network alias/binding and AgentSwarms registry entry.

### 2. Developer Runtime

- Build or select a reproducible, immutable runtime image; do not use `latest`.
- Materialize Squid ACLs deterministically.
- Keep deny-by-default egress and prove both allowed and denied destinations.
- Require explicit IAM/grant semantics and enforce workspace, CPU, memory, timeout and output isolation.
- Establish a hermetic dependency/test path from a lockfile or pinned image.
- Enable only the scoped greenfield runtime needed for the synthetic acceptance drill.

### 3. SupaCase work contract

- Implement headless Case access using trusted server-derived `userId`/`scopeUserId`; never accept an owner ID or access token from graph input.
- Add generic idempotent parent/child work identity without changing existing DMS/Document/Resume behavior.
- Create Child Cases only for independently accountable sub-work, parallel work, escalation or Improvement Candidates—not for every node/tool call.
- Add validated typed references for repository, issue, pull request, run and evidence.
- Validate directed dependency types, cycles and status transitions.
- Record durable processing-mode and takeover transitions for semantic, deterministic and human processing.
- Make Acceptance-relevant audit events durable and usable for automation, intervention, rework, depth and duration measurements.
- Track PR creation/update, checks, review/approval, merge, deployment/canary and rollback as idempotent Case lifecycle transitions bound to typed references and the exact Candidate SHA.
- Keep Gitea/PR, Runtime and Evidence authoritative for technical detail; do not duplicate CI jobs, tool calls or logs as Cases. Create an integration-repair Child Case only for independently accountable work.

### 4. Executable Development Swarm V1

Implement and execute:

`Task → Build → Break → Verify → Integrate → Learn`

- Start Break/Review from the native Code Review Pipeline pattern.
- Use independent Security, Architecture/Contract and Maintainability breakers where the actual node/runtime contracts permit.
- Separate deterministic build/test/contract gates from probabilistic `evaluate` evidence.
- Use native baseline-vs-candidate/regression capabilities.
- Bind findings, evidence, approval and integration state to one immutable candidate revision.
- The Builder may provide evidence but may not mark its own result accepted.
- Preserve suspend/resume and a manually operable path through the same Case/work contracts.
- Learn must use Finding → Root Cause → Improvement Candidate → verified change; no uncontrolled self-modification.

### 5. End-to-end acceptance

Run the complete flow against synthetic content in `aXtn/development-swarm-acceptance`.

Acceptance requires:

- Case and Child-Case lineage;
- parallel work where applicable;
- branch and candidate revision binding;
- breaker findings and dispositions;
- deterministic build/test/contract evidence;
- probabilistic evaluation reported separately;
- approval/takeover behavior;
- reviewable PR and integration evidence;
- Case-visible integration lifecycle through the configured endpoint (`PR_READY`, `MERGED`, `DEPLOYED_VERIFIED` or `ABANDONED`), without duplicating technical step detail;
- measurement events for automation depth, human interventions, retries/rework and elapsed time;
- negative security tests;
- current test, typecheck, lint, docs, infrastructure and production-build results as applicable;
- persistent, restart-safe synthetic Acceptance/Regression Cases whose Parent/Child lineage, Scenario identity, Candidate SHA, attempt/run history, integration events and Evidence references remain queryable after completion and are filterable from normal business KPIs.

Do not substitute another planning report for this runnable acceptance.

## Reporting and handoff discipline

Commit implementation and evidence to the appropriate Gitea branches. Update this handoff only when the executable contract or cross-repository continuation changes. Use Issue #7 as status/index, not as the sole execution contract.

Progress reports are non-blocking. A report marked PARTIAL or BLOCKED must identify an actual remaining external blocker and must include everything already completed. Ordinary implementation defects are to be fixed and retested.

## Genuine stop conditions

Stop only when continuing would require one of the following:

- exposing or committing a token, secret or credential;
- destructively changing unrelated or established non-greenfield data;
- modifying the unrelated dirty `aXtn-git` checkout instead of using a clean worktree;
- exercising privileges that are genuinely unavailable and cannot be provided by the authorized greenfield configuration;
- introducing a second control plane;
- proceeding despite an irreconcilable source/runtime fact after the relevant repositories and runtime have been checked;
- bypassing repository protection or allowing the Builder to self-accept.

Missing pins, bindings, ACLs, dependencies, tests, migrations, registrations and greenfield runtime configuration are implementation work, not stop conditions.
