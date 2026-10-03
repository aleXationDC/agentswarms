# aXtn Development Swarm: headless SupaCase bootstrap

## Authority and scope

The execution authority is request commit
`1ecf56cee8773a0f5de6a954baa6986c885d5df0`, activated by handoff
`ee2193d70f5c86e88c03a1e540e9d24dd0c66fd6`, on
`work/AXTN-DEVELOPMENT-SWARM-0001`. This is the first prerequisite,
not the completed Development Swarm V1.

Execution host: `aleXation`; effective user: `alex`. Native Git fetch/push
uses the authenticated loopback Gitea origin. Separate task worktrees
are used for AgentSwarms, Host and Gitea-MCP. Unrelated dirty worktrees
are unchanged. The existing native stack is PROD; the credential-bootstrap
profile `AXTN_ENVIRONMENT=DEV` does not identify a separate deployment.

## Implemented trust boundary

- `POST /api/cases/work` derives the Case owner from a validated user JWT
  or an active, unrevoked, unexpired hashed Swarm key with explicit `cases`
  scope. Requests cannot supply an owner or another token.
- Native deterministic `case_work` uses the trusted execution-context owner
  and is allowed in headless runs. No parallel Case database is introduced.
- Additive migration `20260929010000_axtn_case_work.sql` keeps work Cases
  in the existing owner-scoped `axtn_cases` dataset. Its RPC is executable
  only by `service_role`.
- Identity replay, identity conflicts, transition replay/conflicts, Case
  state and native audit events are transactionally enforced. Required
  dependencies, child completion and completion Evidence are checked.
- The public work API/tool cannot declare `ACCEPTED`. Independent Acceptance
  authority, full work/result UI, KPI projection and executable Development
  Swarm are subsequent work packages, not claimed by this bootstrap.
- Existing document filing acceptance, SupaCase relations and D09
  checkpoint/resume/cancel paths are preserved.

The user-selected standard provider for the eventual graph is the connected
OpenAI integration through existing server-side credential resolution.
Neither a provider key nor a Case credential belongs in a graph or Case.

## Source verification

| Check | Actual result |
| --- | --- |
| Focused Case, filing, headless and related tests | 11 files, 67 tests passed |
| Rollback-only native PostgreSQL integration | Passed; fixtures and migration rolled back |
| Integration assertions | Identity replay/conflict; exactly-once transition audit; completion Evidence; missing parent integration denied |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed; 0 errors, 235 existing warnings |
| Complete `npm test -- --reporter=dot` | 550 files passed; 8,989 tests passed; 40 skipped |
| `npm run build` | Passed |
| Docs index, docs check, Markdown and doc commands | Passed |
| Infra check | Passed; unavailable PowerShell parsing skipped |

The first complete test run exposed an outdated fixed Tool-ID count after
adding `case_work`; the assertion now requires ten IDs and explicitly
includes the Case tool. A SQL test exposed the existing BIGINT row identity;
the migration now uses the correct type. A nullable parent integration phase
is explicitly denied rather than treated as SQL's unknown boolean.

## Deployment and remaining gates

At this source-validation checkpoint, this bootstrap is **IMPLEMENTED**
and **TESTED**, but **not yet DEPLOYED or RUNTIME_VERIFIED**.

The pre-existing runtime is AgentSwarms
`844eddf5fc60ca6cef8fcc948e293eecc2d6b22e`, image ID
`sha256:42896f82104f528c3909da6124cfb9e3d0e54702400afc0adafb2a33ea8d1b15`.
The original protected runtime config and this image are the rollback
references. No destructive or unrelated data operation is required.

Host convergence must build the clean committed exact Source, apply the
additive migration transactionally, and recreate only `agentswarms` through
the native Compose contract. All existing persistent mounts and other
services must remain unchanged. Authentication, owner isolation, idempotent
Case creation, native audit persistence and restart must then be measured.
Only afterwards is the implementation Parent and its required children
seeded through the trusted native Case endpoint; bootstrap work is
retrospectively attached to that durable lineage.

Further packages remain: scoped Gitea-MCP boundary, pinned Developer Runtime,
complete work contract/UI, executable Development Swarm, independent
production acceptance, low-risk real work and integration Evidence.
No merge, tag or release is performed.
