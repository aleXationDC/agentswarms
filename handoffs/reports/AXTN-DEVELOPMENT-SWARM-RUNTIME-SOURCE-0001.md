# Development Runtime source gate

Work Parent `85a1d829-39ac-49bd-9047-163ab52d427b`;
Runtime Child `e9d954a7-8c37-48c9-988d-5942f21bbb19` remains OPEN.
Base: `79f40ec86bf7a38e20499a64931e739a61ad8e18`.
Branch: `work/AXTN-DEVELOPMENT-SWARM-0001`, canonical native loopback Gitea.

## Implemented

- Existing notebook session/orchestrator, no second job store.
- Strict owner/Case/grant-bound native verification action and idempotent effect
  identity. No privileged-user bypass of the direct native grant.
- Both supplied snapshots compared against complete immutable Gitea reads
  through the existing scoped native broker before verification.
- Pinned-base wrapper with credentialless child execution, trusted parent
  assertions, compileall/unittest and separate baseline/candidate results.
- Fixed native Docker isolation: no network or host mounts, non-root, read-only,
  dropped capabilities, no-new-privileges, bounded CPU/memory/PIDs/tmpfs/time/output.
- Server-owned persisted receipts, replay image/harness/input checks, explicit
  pending/failed results and bounded Docker logs. Generic GPU/tmpfs settings remain
  effective outside the native profile.
- Native token, source and result callbacks denied. Actual database roles, not
  caller-editable claims text, control receipt writes.
- Additive migration `20260929020000_development_runtime.sql`; it has **not**
  been persistently applied at this source checkpoint.

## Executed evidence

| Gate | Result |
|---|---|
| Native authority/source/contract and generic lifecycle focused tests | 7 files, 63 PASS |
| Coupled settings/GPU/docs regressions | 3 files, 35 PASS |
| Complete Unit Suite | 555 files, 9,039 PASS, 40 SKIP |
| Typecheck | PASS |
| Lint | 0 errors; existing 235 warnings |
| Docs/Markdown/doc commands | PASS |
| Infrastructure | PASS; PowerShell syntax skipped because unavailable |
| Production build | PASS |
| Hermetic verifier tests in installed immutable base image | 7 PASS |
| Actual PostgreSQL role/receipt policy | PASS, transaction rolled back |
| Protected credential scan | 2,416 source/evidence files and task logs, PASS |
| Browser output scan | 479 assets, no native credential/runtime authority projection |

The hermetic image was
`sha256:bacda8045e082305ee804de291ed094d36f3320880e5a57c823c2559e934a95a`.
Tests exercised correct and broken candidates, syntax errors, attempted
parent-assertion monkeypatching, output overflow, infinite-process timeout,
credentialless child environment and documentation checks.

The real database test installed the candidate guard/index only inside one
transaction. It proved duplicate-effect denial, authenticated insert/update/
entrypoint-laundering/delete denial, forged-role-claims denial and successful
actual service-role writes. After ROLLBACK, schema guard presence, sessions,
grants, settings hash and migration ledger exactly matched their initial state.
The ledger remains 275; sessions/grants remain zero.

Initial focused/full replay exposed three brittle source-string assertions and
missing runtime-variable documentation. They were updated to retain generic
resource/lifecycle invariants alongside native isolation; the final full suite
and build above passed. An untracked-file documentation check was rerun after
staging the newly created canonical artifacts.

## Production continuation

**IMPLEMENTED / TESTED** for this source gate.
**NOT DEPLOYED / NOT RUNTIME_VERIFIED** for the new native runtime profile.
Current app remains `79f40ec...`; runtime settings are still disabled.

Host mutation/rollback plan is published at
`aXtn/aXtn-host@33f9dc85ced4afde4f085164069faa901fddf419`:
`evidence/development-swarm/20261003T-runtime-mutation-plan.md`.
It records the observed app/Squid ACL bind mismatch and the bounded remediation.
Next: pin this published source candidate, build/inspect its immutable wrapper,
snapshot protected configuration/settings, share deterministic ACLs, provision
the explicit grant/additive migration, target app/Squid convergence, then run
authenticated runtime and restart acceptance. Do not close this Work Child on
source tests alone.

The existing connected OpenAI account is the designated V1 default provider.
Its native server-side resolver and `/models` request were previously verified
with HTTP 200; credentials remain unchanged and never enter the verifier.
The executable OpenAI-default graph is a later pending Work Package, not part
of this source-gate deployment claim.

The first wrapper replay found that Docker COPY's file mode also left the new
`/opt/axtn` directory non-traversable for UID 1000. The wrapper explicitly restores
directory mode 0755 while keeping harness files read-only. Production deployment
remains gated on replay against the corrected exact-candidate image.
