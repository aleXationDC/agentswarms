# aXtn AgentSwarms upstream 1.5 architecture assessment

Date: 2026-09-30
Status: ARCHITECTURE_REVIEW_COMPLETE_FOR_UPGRADE_EXECUTION
Repository: `aXtn/aXtn-agentswarms`
Upgrade branch: `work/AXTN-AGENTSWARMS-UPSTREAM-150-0001`
aXtn starting point: `cb50394e1b0647862b85bce224a30934d96a59da`
Selected upstream candidate: `AgentSwarms-fyi/agentswarms@05df309fbabfa3612e3b86f1860d76c6d95f22b3`
Upstream package version: `1.5.0`
Previously tested upstream base: `7c6e48bca030675dbb47d4309e3a12d958e3e8f2`

## Result

Adopt the current upstream as the new application baseline and port only justified aXtn-specific extensions.

The permanent target is AgentSwarms-first. The previous full-stack DEV/Prod duplication in `aXtn-host` is acceptance evidence, not the default operating model to preserve.

The upgrade must not transplant the old host/runtime topology into AgentSwarms 1.5. Upstream-native development, publishing, MCP, n8n integration, IAM, backup/restore and runtime mechanisms take precedence.

## Verified upstream delta

GitHub comparison from the previously tested base to the selected upstream candidate reports:

- 330 upstream commits
- package version 1.5.0
- materially expanded deployment and runtime model
- current Docker/Kubernetes deployment support
- native backup and restore commands
- expanded Developer Workspace / sandbox runtime
- expanded MCP Builder and Streamable HTTP MCP runtime
- expanded IAM / SSO / SCIM
- native n8n workflow integration
- native draft/published swarm lifecycle
- 269 Supabase migration files at the selected candidate, compared with 191 in the previously accepted aXtn runtime

This is a platform upgrade, not a patch update.

## Native upstream capabilities that become authoritative

### Application lifecycle

The AgentSwarms app is stateless; durable application state is held in Supabase. Multiple app instances can target the same backend when required.

Upstream provides separate supported development and deployed execution modes. Do not recreate a second application architecture merely to obtain a development workspace.

### Swarm promotion

Upstream implements draft versus published swarm state.

- canvas edits modify the draft
- API keys, schedules and headless sub-swarm execution use the published snapshot
- publishing explicitly promotes the current draft
- unpublish is explicit

This is the normal content-level development/promotion mechanism for swarms and should replace custom DEV/Prod duplication for ordinary swarm editing.

### n8n

n8n is a native AgentSwarms integration surface. AgentSwarms connects to n8n workflows through the Integration Hub and exposes them to agents as tools.

n8n is therefore an integrated platform service, not a second control plane and not an application that should be duplicated merely because AgentSwarms has development work in progress.

### MCP

Upstream now provides a mature MCP Builder and MCP runtime:

- Streamable HTTP MCP
- internal-only or public exposure
- hashed/scoped/expiring keys
- per-tool restrictions
- session handling
- runtime sandboxing
- tool-change re-approval

aXtn-specific MCP applications should use this native lifecycle rather than introduce a parallel MCP runtime.

### IAM and approvals

Upstream IAM, RLS, resource grants, SSO/SCIM, approvals, audit and headless execution semantics are the base security model.

aXtn extensions may narrow authority but must not replace or duplicate these controls.

### Backup / restore

Upstream now provides native backup and restore scripts. Host recovery orchestration should consume these capabilities rather than maintain an independent application backup implementation unless a demonstrated gap remains.

## aXtn delta classification

### 1. aXtn Workbenches

Paths include:
- `axtn/workbenches/**`
- `src/axtn/workbenches/**`
- `src/components/axtn/**`
- related workbench UI/server functions

Classification: **STILL_REQUIRED / NEEDS_PORT**

Reason:
The Workbench contract is intentionally compositional: it packages task-oriented aXtn UI and behavior around native AgentSwarms capabilities. It does not replace agents, swarms, orchestration, approvals, runtimes or providers.

Target:
Keep the registry/manifest concept and aXtn namespace. Port against current upstream APIs with the minimum core touchpoints possible.

Rule:
If a workbench feature is now provided natively by AgentSwarms, the native surface wins and the duplicated aXtn implementation is retired.

### 2. aXtn Local Table MCP integration

Paths:
- `axtn/mcp-servers/axtn-local-table-integration/**`

Classification: **REASSESS / NATIVE_REPLACEMENT_PREFERRED**

Reason:
The business need is controlled, auditable writing of document-intake state into AgentSwarms-managed data. The legacy `local_table_upsert` MCP service is only one historical implementation of that need and is not itself an architectural requirement. AgentSwarms 1.5 now has materially expanded native data, MCP Builder/runtime, scoped-key and runtime-session capabilities, so the first task is to prove whether the business contract can be satisfied natively.

Target:
Prefer an upstream-native AgentSwarms data/write path. Retain an aXtn MCP application only if a concrete functional or security gap remains after testing current upstream behavior. Do not add aXtn-specific lifecycle/token helpers to native upstream core merely to satisfy legacy tests.

Decision rule:
- legacy aXtn tests are compatibility evidence, not requirements;
- if a failing test exposes a general defect in current upstream behavior, fix upstream minimally and add an upstream-oriented regression test;
- if it only encodes an obsolete aXtn implementation contract, adapt or retire that test;
- if the document-intake business invariant cannot be met by native AgentSwarms, document the exact gap before porting the old service.

Security:
Whatever implementation remains must keep credentials server-side, preserve fail-closed authorization, and avoid direct service-role exposure to sandboxes or external callers.

### 3. aXtn Document Intake swarm

Paths:
- `axtn/swarms/axtn-document-intake/**`

Classification: **STILL_REQUIRED BUSINESS WORKFLOW / NEEDS_PORT**

Keep:
- deterministic envelope validation
- privacy gate before model execution
- stable source locator/idempotency semantics
- explicit document identity generation/immutability
- deterministic ACK/error behavior

Change:
The current `apply.mjs` directly patches the Supabase swarm row with service-role access and updates draft and published snapshots together. Current upstream has an explicit native publish lifecycle. The upgraded implementation must use the current native deployment/publish contract where practical and must not bypass platform invariants merely to update node source.

The swarm definition is aXtn content; the publish mechanism is AgentSwarms infrastructure.

### 4. SSE / SDK protocol compatibility fix

Path:
- `sdk/react/src/protocol.ts`

Classification: **REPLACED_BY_UPSTREAM**

Evidence:
The aXtn candidate and selected upstream have the identical Git blob SHA:
`60d41f4da5abb9b0fe5f982289c92cb63602e3a3`.

Consequence:
Do not carry this as an aXtn patch. Keep regression coverage only where it adds independent value.

### 5. aXtn System Extension Access

The candidate deletes the former System Extension Access implementation,
including its source/API/Caddy paths; historical database migrations remain
only for ledger compatibility.

Classification: **DEFER / ARCHITECTURE_REVIEW_REQUIRED BEFORE PORT**

Reason:
This mechanism was built to surface separate Gitea, n8n and Matrix-admin UIs through temporary cross-UI access tickets.

Under AgentSwarms-first:
- normal n8n use belongs to the native AgentSwarms n8n integration
- Gitea is the canonical source service and is normally reached through Git/MCP workflows
- Matrix admin is an operator surface, not an AgentSwarms application environment

Do not port this mechanism into the first 1.5 candidate.

After the base candidate is operational, identify concrete operator workflows that still require external UI access. Prefer Tailscale/private Caddy operator access or native integration before restoring application-specific ticket exchange.

No existing retained access path is removed by this upgrade task.

### 6. deploy/axtn composition helpers

Classification: **PARTIAL / REASSESS AFTER UPSTREAM BASE**

Do not transplant the old AgentSwarms Compose profile model. Current upstream deliberately changed its deployment composition and expects the normal install to provide the platform capabilities together.

Keep only aXtn-specific edge/integration material that remains necessary after the upgraded application is accepted.

Immutable release pinning remains an aXtn-host responsibility; it must not force an obsolete AgentSwarms topology.

### 7. Engagement Control Plane (Issue #3 / PR #4)

Classification: **VALID PRODUCT DIRECTION / DEFER IMPLEMENTATION UNTIL AFTER UPSTREAM PORT**

The ECP preparation explicitly intends to reuse native AgentSwarms IAM, approvals, suspend/resume and audit rather than introduce a second runtime.

Because upstream IAM, approvals, MCP, runtime and integration capabilities have materially changed since the ECP review, do not implement the old prepared work order against the old base.

After the 1.5 candidate is operational:
- rebase the ECP design against current native APIs and schemas
- retain the business semantics
- remove design elements now covered natively
- then request the existing architecture gate for material ECP implementation

### 8. Existing aXtn security fixes

Classification: **COMPARE INDIVIDUALLY; DO NOT BLINDLY CARRY**

Known protocol delta already landed upstream. For each remaining security patch:
- compare exact upstream implementation
- retire it if upstream equivalent is equal or stronger
- port only demonstrated gaps
- preserve targeted regression tests where useful


## Legacy-test interpretation rule

During this upgrade, a failing aXtn regression test does not by itself justify restoring an old implementation contract.

For every failing legacy test:

1. identify the business/security invariant it protects;
2. compare that invariant with current AgentSwarms 1.5 native behavior;
3. if upstream already satisfies the invariant, update or retire the legacy test;
4. if upstream violates a generally valid invariant, fix the native helper minimally and test that native behavior;
5. only preserve an aXtn-specific implementation when no native path satisfies the requirement.

In particular, missing aXtn-only token/lifecycle helpers are not defects in upstream unless a current native AgentSwarms contract independently requires that behavior.

## Data and migration consequence

The selected upstream candidate contains 269 migration files; the last accepted aXtn runtime reconciled 191.

Therefore the upgraded candidate requires a migration compatibility run from a representative copy of the accepted schema state.

Requirements:
- never test destructive migration behavior on retained production data
- run all missing migrations in an isolated database
- verify RLS, auth, storage and existing aXtn tables/contracts
- verify aXtn workbench/local-table dependencies after migration
- version the exact before/after migration ledger

No production migration is authorized by this assessment.

## Host/resource consequence

Current upstream Docker composition states roughly 8 GB RAM for the full platform service set.

The current Hetzner host has previously been observed near 13 GiB used out of 15 GiB while retained/legacy stacks were still present.

Therefore:
- do not start a full additional 1.5 stack beside all retained and historical test stacks without a current resource audit
- first remove/stop only clearly disposable isolated test runtimes under an explicit cleanup task, or use a reduced isolated acceptance path
- retained continuity services must not be sacrificed merely to fit the candidate
- production cutover remains separate

## Upgrade execution decisions

The mechanical upgrade shall use these architecture decisions:

1. Pin the upgrade attempt to upstream `05df309fbabfa3612e3b86f1860d76c6d95f22b3`. Do not chase a moving `main` during this run.
2. Start from the dedicated aXtn upgrade branch.
3. Integrate upstream first.
4. Port aXtn Workbenches and the Document Intake business logic; reassess the legacy Local Table MCP implementation against current native AgentSwarms before carrying it forward.
5. Do not port the old system-extension-access mechanism in the first candidate.
6. Do not implement ECP in this upgrade.
7. Do not restore old Compose/profile semantics merely to reduce merge conflicts.
8. Use current upstream-native n8n, MCP, draft/published, IAM, Developer Workspace and backup/restore contracts.
9. Resolve ordinary code/test conflicts autonomously; escalate only an actual capability/security/data-boundary loss.
10. Produce a candidate; no main merge, release, host cutover or production data mutation.

## Acceptance before host integration

Candidate is ready for host integration review only when:

- selected upstream revision is traceable
- aXtn required deltas are ported
- superseded deltas are explicitly retired
- upstream canonical checks pass
- aXtn regression checks pass
- isolated migration from the accepted 191-migration state succeeds to the new ledger
- isolated login/UI/agent/swarm smoke succeeds
- draft/published behavior is verified
- native n8n integration contract is verified at least synthetically
- native data/MCP path satisfies the Document Intake write contract; an aXtn Local Table tool is required only if a documented native gap remains
- restart/persistence succeeds
- no secrets or retained production state were changed


## Existing n8n workflow continuity

Canonical n8n source: `aXtn/aXtn-n8n@24de6248f13b5fc250482dc8c3b3ef483c91cb55`.

The following six versioned workflows are part of the functional aXtn platform state and must be preserved across the AgentSwarms upgrade:

- `aXtn-Drive-Document-Intake.json`
- `aXtn-Drive-Filing-Executor.json`
- `aXtn-Mail-Filing.json`
- `aXtn-Mail-Ingress-Google-Workspace.json`
- `aXtn-Mail-Ingress-IMAP.json`
- `aXtn-Mail-Materialization.json`

Continuity rule:

- migrate/recreate the workflow definitions and deterministic behavior,
- preserve trigger/webhook semantics and AgentSwarms integration contracts,
- preserve generator/source-of-truth relationships such as `workflows/lib/mail-ingress-core.js` and `tools/build-workflows.mjs`,
- preserve inactive/fail-closed state until target bindings are verified,
- **do not migrate or copy n8n credential objects, credential IDs, OAuth tokens, passwords, API keys or encryption-key-protected credential state**,
- create or re-authorize credentials cleanly in the target runtime and bind workflows only after read/health verification,
- keep repository exports free of secrets and use explicit placeholders/logical names,
- activate each workflow only after its target AgentSwarms endpoint, provider access and expected response contract have been verified.

Credential continuity is therefore configuration re-provisioning, not credential migration.

## Host follow-up

Only after candidate acceptance should `aXtn-host` be reconciled around the actual AgentSwarms 1.5 operating model.

Expected direction:
- shared platform services by default where continuity and native integration support it
- targeted isolation for schema/data/credentials/blast radius
- no permanent full-platform DEV/Prod duplication without a demonstrated requirement

## Execution result — 2026-09-30

The canonical execution contract was re-read from Gitea at task-doc commit
`8f884135460b5b5bf502024f117e5edcb5a46224`. The selected upstream remains
`05df309fbabfa3612e3b86f1860d76c6d95f22b3` (`1.5.0`); the merge base is
`7c6e48bca030675dbb47d4309e3a12d958e3e8f2`.

The candidate integrates upstream first and keeps the native operating model:

- Workbenches and Document Intake business logic remain namespaced under
  `axtn/` and use native approvals, data, MCP Builder/runtime and publish
  contracts.
- Local Table was reassessed against native `user_data_tables`,
  `user_data_rows`, scoped MCP keys, MCP Builder and runtime sessions. The
  exact controlled `local_table_upsert` contract is not exposed natively, so
  the aXtn broker remains namespaced and app-facing; no aXtn helper was added
  to native AgentSwarms core.
- The old System Extension Access UI/API/Caddy path was not ported. Its
  historical migrations remain only for upgrade-ledger compatibility, and the
  deployment documentation marks the path deferred.
- The missing aXtn token/service lifetime helper was explicitly not ported.
  The only native runtime correction is the generic stale-row reread in
  `refreshSession`; generic MCP JSON-RPC negotiation/error handling was fixed
  only for reproducible native HTTP-200 handshake defects.
- Migration filenames are unique: the baseline Local Table function is
  preserved under the candidate's `20260901000001_axtn_local_table_upsert.sql`
  name after the upstream `20260901000000_saas_ga4.sql` collision.

Validation evidence is recorded in
`docs/AXTN-UPSTREAM-150-COMPATIBILITY.yaml`. In summary: `npm ci` passed;
the full unit/differential suite passed with 541 files and 8,949 tests (40
environmental skips); lint, docs, doc-command and infra checks passed; focused
aXtn/MCP/runtime checks passed; integration tests collected 7 files and
skipped 40 tests because no external integration environment was configured.
The final typecheck attempt after the last native runtime narrowing change was
terminated by the host without a diagnostic, so it is recorded as a
resource-blocked verify rather than claimed as green.

the isolated migration run completed baseline 191 → 269 upstream migrations
plus the idempotent candidate aXtn migration and verified native tables,
RLS, policies and the namespaced broker.

The isolated Dev server served `/api/health` and `/login` with HTTP 200. Its
readiness endpoint correctly returned HTTP 503 because no Supabase/key
environment was injected into that smoke process. The production Vite build
was attempted with the canonical script and direct 2/3 GiB heap limits; the
host killed the process during chunk rendering / the 2 GiB process reached
V8 OOM. The host had about 3.4 GiB available and no swap while retained
continuity stacks were running, so no retained service was stopped. This is an
environmental host-integration blocker, not a code or migration failure.
