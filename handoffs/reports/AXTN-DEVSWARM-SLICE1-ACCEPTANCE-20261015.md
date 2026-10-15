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
