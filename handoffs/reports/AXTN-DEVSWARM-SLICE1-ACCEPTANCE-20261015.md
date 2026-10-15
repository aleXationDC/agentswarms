# AXTN-DEVSWARM-SLICE1-ACCEPTANCE-20261015 — Execution Report

Date: 2026-10-15
Request: handoffs/requests/AXTN-DEVSWARM-SLICE1-ACCEPTANCE-20261015.md @ b0f4f9d44f179e3e7c6ef8c8d9533fc8344685f2 (Issue #7)
Task branch: work/AXTN-DEVSWARM-SLICE1-ACCEPTANCE-20261015, based on PR #32 line f19854ec (contains ed66570a); the handoff branch was used only for the two documentation files.

Status: IMPLEMENTED/TESTED (source level) — **BLOCKED before publication**. Not DEPLOYED, no PASS_TO_APPROVAL, no PR_READY, no ACCEPTED.

## Verified
- Case lineage (native readback): Parent 85a1d829 OPEN `NATIVE_PRODUCTION_REGRESSION`; Acceptance-Child 11496f0f OPEN `NO_ELIGIBLE_INDEPENDENT_REVIEWER`; Implementation-Child 41039014 CLOSED. Release Parent 3fd852b0 / Child 003e81ab unchanged (registry blocker). The failed earlier read-only-pilot transition (409) is not counted as a Case event.
- Source: Development graph/seed/apply files are unchanged between the live source eb191e15 and the candidate (only the undeployed grant-only migration differs), so the live runtime is source-compatible with the 31-node slice.
- Focused tests (6 files, 76 tests: nativeDevelopmentAgents/Seed/Swarm, developmentRuntime/Controller/Source): **76/76 PASS**. Executed now; full suite not re-run.
- Runtime inventory (read-only): Swarm ad06e17d has 31 nodes, `published_at` 2026-10-04 06:25:14 equal to creation time but `published_version_id` NULL and 0 `swarm_versions` → cause: legacy pre-versioning publish flag; no immutable version ever created. Four saved Agent rows (Builder/Security/Contract/Maintainability, 1 version each, seeded 2026-10-06) exist. Suspended run 00ff44a5 and its Approval untouched.
- Approval source: migrations 20261004060000 (and DMS twin) raise `NATIVE_APPROVAL_WORK_OWNER_DENIED` when the decider is the Work owner. The environment has exactly one auth user (owner) and a one-member BoardMember group (that owner); the accepted owner-authority decision therefore needs a narrow, explicitly decided policy change before an owner can accept a separately built Candidate. Not changed here.

## Blocker (concrete)
`axtn/swarms/axtn-development/apply.mts` requires owner password authentication to publish through the native versioned lifecycle. The protected files `agentswarms-admin-password` and `agentswarms-superadmin-password` and `ADMIN_PASSWORD` in agentswarms.env are all rejected (`invalid_credentials`, HTTP 400); the account's `auth.users.updated_at` is 2026-10-12, i.e. the credential was rotated after those files were written. No reset, service-role publish or SQL shortcut was used.

## Single shortest required action
Owner/credential administrator refreshes the protected owner login for `x@alexation.com` in host storage (no value in chat/Git). Then execution continues: `apply.mts` with reviewer group 2a156ccf-9442-4e12-9717-ae89c71f0e1d (BoardMember, the group previously used), idempotency re-apply, FAIL/PASS Task runs through the Case-to-Swarm path, restart/resume checks.

Independent open items: registry `write:package` for the release candidate; decision on the owner-acceptance policy change; LLM Hub acceptance remains separate (current mapping is openai/gpt-4.1-mini and must not be presented as Corporate LLM Hub proof).

## Status vocabulary
IMPLEMENTED/TESTED: source only. DEPLOYED: no. PASS_TO_APPROVAL: no. PR_READY: no. ACCEPTED: no.

## Continuation 2026-10-16 — Owner-login source trace (commit 7691a4d5)

No further login attempts were made in this continuation; only source/metadata inspection. No values, hashes or env dumps recorded.

### Source and priority (apply.mts)
`apply.mts` reads `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` solely from process environment; it has no wrapper or file loader. Host producer chain (aXtn-host `scripts/prepare-agentswarms-env.py`):
1. `/home/alex/.local/share/axtn/native/agentswarms-superadmin-password` (mode 0600, alex, written 2026-10-01 20:02) is the single source of truth for the operator identity `AGENTSWARMS_SUPERADMIN_EMAIL=x@alexation.com`.
2. It is copied into `/home/alex/.local/share/axtn/native/agentswarms.env` as `ADMIN_EMAIL`/`ADMIN_PASSWORD` (mode 0600, written 2026-10-07 22:48). A derived copy, so it can only be as current as the file.
3. `/home/alex/.local/share/axtn/native/agentswarms-admin-password` belongs to the separate technical identity `admin@localhost.local` (`AGENTSWARMS_ADMIN_EMAIL`), which does not exist in `auth.users`; it is not a valid source for this publish.

### What the failed call actually used
My first call sourced `agentswarms.env` and then overrode `ADMIN_PASSWORD` with the `agentswarms-admin-password` file: the **wrong identity's file** (mapping error on my side). The two follow-up checks used the superadmin file and the env value (same source) and both returned `invalid_credentials`. Three attempts in total; none further.

### Cause (classification)
- Evidenced: Auth audit log shows one `user_updated_password` event for x@alexation.com on 2026-10-08 (after the superadmin file, 10-01, and `agentswarms.env`, partly before 10-07 regeneration was from the same file), plus an interactive login 2026-10-09. The protected file therefore most likely predates the password the owner actually uses.
- Not evidence: `auth.users.updated_at` 2026-10-12 coincides with token refresh; my earlier "rotated 12.10." statement is withdrawn.
- Unproven: who performed the 10-08 change (the owner via UI is the only logged actor) and whether the new password was ever stored on the host.
- Existing mechanism check: no host script takes hidden password input for this file. `scripts/bootstrap-admin.py` would force the account password to the stale file content (a password change; not authorized, not used). No account/password/MFA/recovery change, service-role publish or SQL was performed.

### Single remaining user step (needs Alex; proposal, not an existing host mechanism)
Run in a host terminal as user `alex`, type the current x@alexation.com password at the hidden prompt, no echo, not an argument, not in history:
```
umask 077; IFS= read -rs p && printf '%s\n' "$p" > /home/alex/.local/share/axtn/native/agentswarms-superadmin-password; unset p
```
(`read -rs` is a bash builtin; verified here only with a dummy value into a temp file: mode 0600 result.) Then tell Copilot "owner login updated". Copilot detects the handover by the file's mtime change, runs exactly one controlled password-grant check (status only), and on success continues `apply.mts` (reviewer group BoardMember 2a156ccf-9442-4e12-9717-ae89c71f0e1d, passing the password from that file in-process, then regenerating `agentswarms.env` via the existing `prepare-agentswarms-env.py` path), idempotent re-apply and the remaining acceptance steps. On failure it stops with the sanitized HTTP status.

Native gap (for decision, no implementation): the host lacks a hidden-input credential refresh that also verifies login; a small option on the existing `scripts/prepare-credentials.sh` flow would close it. Not built without approval.

Parent transition 85a1d829 remains rejected (409) and is not claimed. Acceptance-Child 11496f0f carries the BLOCKED event (`OWNER_CREDENTIAL_REFRESH_REQUIRED`) for 38f7d922; this continuation's evidence is referenced below.

## Continuation 2026-10-16b — Login updated; publication and first native runs

### Auth and publication (executed)
- One controlled password-grant check with the refreshed protected file `/home/alex/.local/share/axtn/native/agentswarms-superadmin-password` (mtime 2026-10-15 22:56): HTTP 200. (Cause of the earlier failure is thereby confirmed: stale host file.)
- `apply.mts` (unchanged source, reviewer group BoardMember 2a156ccf-9442-4e12-9717-ae89c71f0e1d, password passed in-process only) → `PUBLISHED`, 31 nodes, 4 saved Agent snapshots, **published_version_id 6caebb95-0f32-47e7-89e0-d729a31f8799** (provider/model openai / gpt-4.1-mini, existing mapping, unchanged).
- Second apply → `UNCHANGED`, same version id. Readback: 1 `swarm_versions` row, 4 Development Agents (no duplicates), 10 historical runs retained, suspended run 00ff44a5 still `suspended`. Existing `agentswarms.env` was not regenerated (not needed; apply received the password from the file).
- Status: IMPLEMENTED, TESTED (76 focused), **PUBLISHED (immutable version, Prod)**. Image/source not changed (live eb191e15); not a new deployment.

### Real native Swarm runs (driver: files/slice1-acceptance-run.mjs; only initiates `POST /api/swarm/run` and ensures/starts Cases; no Candidate, Breaker output or receipt authored by Copilot)
Cases under Acceptance-Child 11496f0f, stable assignment keys = taskId, idempotency `<taskId>:<attempt>:run-v1`:

| Run | Case | Task / attempt | Result |
|---|---|---|---|
| 7e1d2283-8a14-4165-8036-f2d28cd13395 | a97ee104-5efd-4771-b4db-c0e78a3d8208 | …-20261015-NEGATIVE / negative-v1 | Hard gate BLOCKED: two blocking HIGH findings by real Breaker agents (constant-0 implementation). No Approval node, no PR. |
| 70a4b233-880e-481f-89aa-3bcaa534d3aa | 402a1966-b74c-4780-8f13-70a124cef38c | …-20261015 / acceptance-v1 | Hard gate BLOCKED: deterministic Verify FAIL (candidate 4adc9bbd0c82…, baseline run: 19 failures). No Approval node, no PR. |

Trace (both): Builder → branch/file/candidate/Case nodes → contract, security, maintainability **and** verify started in the same second (parallel level) → join → gate → checks_case → review_case → hard_gate (error, fail-closed). 22 nodes executed per run, approval/PR nodes never reached.

### Findings
1. Genuine FAIL path proven twice through the native graph (blocking agent finding; deterministic Verify FAIL) → no Approval/PR: matches request acceptance bullet "FAIL ohne PR".
2. The PASS path is **not** reached with the literal Task text of the request ("finite numeric inputs, bool rejection, ordered bounds and clipping to [0,1]"): the Developer Runtime harness (profile python-normalization-v1) failed 19 tests. The earlier NATIVE-0002 PASS used a more explicit Task text that names the exact signature `normalize_score(value, minimum=0, maximum=100)` and all parameters. So the request text is under-specified relative to the harness (probable cause, not proven: signature/default mismatch). Copilot did not change the Task text or Verify harness.
3. Case events for the two attempts: STARTED written; no CHECKS/COMPLETED events written for failed attempts. Cases a97ee104 / 402a1966 stay open (not claimed as completed).

### Decision needed (single)
Approve either (A) a new fachlicher attempt `acceptance-v2` with the previously proven explicit Task text (same Work Contract, same Case 402a1966, request text amended in the request document), or (B) a harness/spec clarification. Recommendation: A. Until then PASS_TO_APPROVAL is not reached.

### Still separate/open
Owner-Acceptance policy (owner-exclusion migration 20261004060000; single auth user), registry `write:package`, LLM Hub mapping (openai/gpt-4.1-mini is not LLM Hub evidence), reload/restart durability checks (need a PASS-to-suspend run).

## Continuation 2026-10-16c — acceptance-v2 (request commit dab4cd98)

**Current summary: PUBLISHED / RUNS_EXECUTED / PASS_TO_APPROVAL / SUSPENDED.** The earlier owner-login blockade is resolved (see 16b). No new App deploy (live eb191e15, version 6caebb95 unchanged). PR_READY: no. ACCEPTED: no.

- Same Work Case 402a1966-b74c-4780-8f13-70a124cef38c, new attempt `acceptance-v2`, Task text = the updated request JSON (explicit signature/bounds). Work-contract ref kept at the Case's original revision 7691a4d5 (re-ensuring with a different revision was rejected 409 and nothing was changed). v1 evidence preserved.
- Native run **f615d338-ea36-4b49-b06b-16507540fa60**: Builder → effect-bound branch/file → Candidate **67a3a681665c4237bf7ad5d72fc6818eb26926bb** → contract/security/maintainability/verify in parallel → join → gate **PASS, 0 findings** → checks_case → review_case → hard_gate → verify_completed → native Approval node (24 steps), status `suspended`.
- Receipt (Verify Child 5e9e2b02-fa12-4014-b797-eb9bce5dfcf1, CLOSED `NATIVE_DETERMINISTIC_RECEIPT`, session e686e558-8c68-4987-8327-0443f39e1a16, harness hash 64dc7eb3…, runtime image sha256:bf7a9345…): **baseline** (README-only base, function missing) fail, 2 tests / 19 failures — expected, not candidate failures; **candidate** pass, 2 tests / 0 failures / 0 errors. Candidate-PASS is the decisive result.
- Approval 7aa0dcb3-60ae-4e37-9d94-91a84a5a2ff5 pending, bound to Case 402a1966 / attempt acceptance-v2; checkpoint suspended at `approved`, 23 completed nodes.
- Owner decision denied natively (`NATIVE_APPROVAL_WORK_OWNER_DENIED` for approve and reject); approval, checkpoint (24 steps), Run 00ff44a5 and run count (43) unchanged. No Copilot decision, no bypass.
- Restart durability: `docker restart` of the App container (same image/source, healthy afterwards); approval still pending, checkpoint still `approved`, step count 24, run count 43, 00ff44a5 still suspended; no write node repeated. Reload/headless checks via the same persisted rows; no UI reload test was done.
- Case readback: 402a1966 OPEN `NATIVE_REVIEW_GATE_PASS` (candidate 67a3a681…); negative Case a97ee104 OPEN `HARD_GATE_FAIL_CLOSED`.
- Not done / open: the Candidate branch/PR in aXtn/development-swarm-acceptance were not read back (no PR exists by design before approval; the CLI has no credentials for that repo's remote in this shell — readback pending). Idempotent duplicate-initiation and v2 repeat were not re-run.

### Remaining owner step
A decision-eligible principal other than the Work owner (Owner-Acceptance policy under AXTN-ENV-OWNER-AUTHORITY-0001 vs. migration 20261004060000) must decide Approval 7aa0dcb3. Separate open limits: registry `write:package`, LLM Hub mapping (openai/gpt-4.1-mini only), owner-acceptance policy change decision.
