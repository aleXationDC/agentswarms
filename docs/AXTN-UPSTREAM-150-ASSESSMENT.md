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

Classification: **STILL_REQUIRED BUSINESS CAPABILITY / NEEDS_PORT**

Reason:
The specific controlled `local_table_upsert` contract, allowlist, ownership checks and document-registry semantics are aXtn-specific. Upstream has Local Tables and a mature MCP Builder but does not expose this exact aXtn tool contract.

Target:
Rebuild/revalidate this as a native current MCP Builder application. Reuse current upstream session, key, tool-approval and sandbox contracts. Do not preserve obsolete transport/session code.

Security:
The sandbox must never receive Supabase service-role credentials. Table/tool/owner allowlists remain fail-closed.

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

Paths include:
- `src/lib/axtnExtensionAccess.ts`
- `src/utils/axtnExtensionAccess.server.ts`
- `src/utils/axtnSystemExtensions.functions.ts`
- `src/routes/api/axtn/extension-access/**`
- `deploy/axtn/caddy.*extension-access*`

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
4. Port aXtn Workbenches and the business-specific Local Table / Document Intake capabilities.
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
- native MCP path plus aXtn Local Table tool is verified
- restart/persistence succeeds
- no secrets or retained production state were changed

## Host follow-up

Only after candidate acceptance should `aXtn-host` be reconciled around the actual AgentSwarms 1.5 operating model.

Expected direction:
- shared platform services by default where continuity and native integration support it
- targeted isolation for schema/data/credentials/blast radius
- no permanent full-platform DEV/Prod duplication without a demonstrated requirement
