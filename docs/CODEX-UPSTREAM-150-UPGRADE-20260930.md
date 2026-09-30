# Codex task: upgrade aXtn AgentSwarms to current upstream

Status: READY_FOR_EXECUTION
Repository: `aXtn/aXtn-agentswarms`
Working branch: `work/AXTN-AGENTSWARMS-UPSTREAM-150-0001`
Starting aXtn commit: `cb50394e1b0647862b85bce224a30934d96a59da`
Verified upstream repository: `AgentSwarms-fyi/agentswarms`
Verified upstream head at preparation time: `05df309fbabfa3612e3b86f1860d76c6d95f22b3`
Verified upstream package version at preparation time: `1.5.0`

## Objective

Bring the aXtn AgentSwarms fork onto the current verified upstream while preserving only the aXtn-specific capabilities that still add value.

AgentSwarms is the leading application/runtime. Prefer current upstream-native functionality, contracts, deployment patterns, integrations, developer runtime, draft/published semantics, backup/restore and operational mechanisms over maintaining parallel aXtn implementations.

Do not redesign the host in this task. Produce a tested AgentSwarms candidate that can become the new platform baseline.

## Source policy

- Gitea is authoritative for the aXtn fork and aXtn-specific work.
- GitHub `AgentSwarms-fyi/agentswarms` is the verified upstream source.
- Use the architect-selected upstream target `05df309fbabfa3612e3b86f1860d76c6d95f22b3`. Record if upstream `main` has moved, but do not change the selected target during this execution.
- Do not rewrite or modify existing working branches or dirty worktrees.
- Use the dedicated task worktree and this branch only.
- No merge to `main`, no release, no deployment, no production mutation.

## Architecture authority

The architecture assessment is already complete and authoritative for this task:

- `docs/AXTN-UPSTREAM-150-ASSESSMENT.md`

Do not redo or override its architectural classifications. Implement them mechanically and report any concrete contradiction discovered in source or tests.

## Existing aXtn delta to implement

Apply the classifications in the architecture assessment. At minimum inspect the following paths while porting:

- `axtn/**`
- `src/axtn/**`
- `src/components/axtn/**`
- `src/routes/api/axtn/**`
- retired System Extension Access implementation (deleted in this candidate)
- `src/utils/axtnWorkbenchEdits.functions.ts`
- `deploy/axtn/**`
- aXtn MCP/local-table integration
- aXtn workbench registry and workbenches
- security fixes and stream/protocol compatibility changes recorded in `docs/AXTN-ISSUE3-COMPATIBILITY.yaml`
- prepared Engagement Control Plane material on existing aXtn branches/issues

Required decisions already made:
- aXtn Workbenches: port
- aXtn Local Table MCP integration: REASSESS; prefer a native AgentSwarms data/write path and port the old service only if a documented native gap remains
- aXtn Document Intake swarm: port business logic; use native publish/deploy contract
- SSE/SDK protocol patch: retire as aXtn delta because it is already upstream-identical
- aXtn System Extension Access: do not port in the first candidate
- deploy/axtn helpers: port only what remains necessary after current upstream composition
- Engagement Control Plane: do not implement in this upgrade
- security fixes: port only where an exact current upstream comparison still shows a gap


## Immediate correction for current execution

Do not continue adding aXtn-specific lifecycle/token helpers into native AgentSwarms core merely because legacy Local Table/service tests expect them.

For the currently observed focused-test failures:

- JSON-RPC handshake failures returned under HTTP 200 and missing protocol negotiation may be fixed only if they are reproducible defects of the current native MCP contract itself. If so, make the smallest generic upstream-oriented fix and regression test.
- The missing aXtn lifecycle helper in the token module is not, by itself, an upstream defect. Stop that port unless current native AgentSwarms independently requires the same behavior.
- Reassess the legacy Local Table MCP service against AgentSwarms 1.5 native data, MCP Builder/runtime, scoped-key and runtime-session capabilities before implementing any replacement.
- Treat failing legacy aXtn tests as evidence to classify, not as requirements to restore old APIs.

If work on the token/lifecycle helper is already in progress, preserve the diff for inspection but do not commit it as the chosen solution until the native-gap classification is complete.

## Upgrade strategy

1. Verify repository, worktree, remotes, branch and HEAD.
2. Fetch the authoritative aXtn branch state from local Gitea.
3. Fetch the verified public upstream repository.
4. Confirm the selected upstream target SHA and determine merge base, aXtn-only delta and likely conflict zones.
5. Integrate the architect-selected upstream revision into this branch using the least disruptive method that preserves traceability.
6. Resolve conflicts by preserving upstream behavior first, then porting only justified aXtn deltas.
7. Do not reintroduce removed upstream profile/operating assumptions unless an aXtn requirement proves they are still necessary.
8. Keep aXtn extensions modular and clearly namespaced; do not move native AgentSwarms functionality behind aXtn-specific control planes.

## Required implementation compatibility checks

Verify during implementation that the already-reviewed native contracts still behave as expected for:

- self-hosting and Docker deployment
- `setup.sh --dev` / local development flow
- stateless app + Supabase persistence model
- draft/published swarm behavior
- Developer Workspace / notebooks / sandboxing
- n8n integration
- MCP integration
- backup and restore
- migrations
- IAM / approvals / audit behavior
- health/readiness
- deployment and scaling contracts

Do not redesign the host here. If implementation reveals a contradiction with the architecture assessment, record exact source/test evidence and stop only if it crosses a documented stop condition.

## Validation

Run the strongest relevant upstream-native checks available at the selected revision, including at minimum:

- dependency install from lockfile
- typecheck
- lint
- docs/infra checks where part of upstream `npm run check`
- full unit test suite
- integration tests
- production build
- migration compatibility against an isolated test database
- targeted aXtn regression tests
- workbench registry/load tests
- MCP/SSE protocol tests
- local-table/document-intake contract tests, interpreted according to the architecture assessment; obsolete implementation-specific expectations must be adapted or retired
- extension-access tests only as read-only regression evidence if they still apply; the extension-access feature is not part of this first upgraded candidate

Use upstream's own canonical `npm run check` where feasible, then add aXtn-specific checks.

If the current upstream test suite materially changed, adapt the aXtn compatibility evidence rather than weakening upstream checks.

## Runtime smoke

After static/test acceptance, start the upgraded candidate in an isolated runtime using the upstream-native supported path as far as possible.

Verify:
- UI reachable
- login/auth path
- primary health/readiness
- database connectivity
- one agent/small swarm smoke
- draft/published behavior
- one n8n integration path if testable without production mutation
- one MCP integration path
- restart/persistence
- no secret leakage

Do not activate public production routing or change retained production services.

## Evidence and deliverables

Version on this branch:

1. `docs/AXTN-UPSTREAM-150-ASSESSMENT.md`
   - exact selected upstream SHA/version
   - aXtn delta classification
   - upstream-native capabilities replacing old aXtn/host assumptions
   - conflicts and resolutions
   - remaining architecture decisions

2. Updated machine-readable compatibility evidence replacing stale upstream references in `docs/AXTN-ISSUE3-COMPATIBILITY.yaml` or a successor document.

3. All required code ports/fixes.

4. Secret-free runtime/test evidence.

5. A concise result stating:
   - selected upstream SHA
   - resulting candidate SHA
   - tests/build/migrations/runtime status
   - which aXtn deltas remain
   - which were retired because upstream superseded them
   - blockers, if any
   - whether the candidate is ready for host integration review

## Stop conditions

Stop for user decision only if:
- a material aXtn capability would need to be dropped without an upstream equivalent,
- preserving an aXtn capability requires a new security or data-boundary architecture,
- migration would require destructive production data changes,
- secrets or retained production state would be at risk,
- a major upstream licensing/operational change materially changes the platform decision.

Ordinary merge conflicts, test failures and compatibility fixes inside this repository are part of the task and should be resolved autonomously.

## Not authorized

- merge to `main`
- release/tag
- production deployment
- host cutover
- destructive production data migration
- changing retained Matrix, n8n, Gitea or Supabase production state
