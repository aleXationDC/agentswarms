# AXTN-CASE-SYSTEM-GRANTS-0001 — Grant-only Case credentials

**Status:** Implemented and isolated-tested; independent review required. No
production grants, migration, merge, or deployment authorized or performed.
**Source:** PR #19 head `c05d74230ffae1db67538ebfa038e585693996a5`, on
`work/AXTN-LLMHUB-PROD-LINEAGE-ACCEPTANCE-0001-integration`.
**Implementation branch:** `work/AXTN-CASE-SYSTEM-GRANTS-0001-implementation`.
**Date:** 2026-10-09 UTC.

## Decision and change

Case-bound `SYSTEM_INTEGRATION` now requires an effective native
`iam_resource_grants` record for the server-derived policy user or a group the
user currently belongs to. The rule covers both `integrations` resources of
type `llm_provider` and `provider_credentials`. In either store, the resource
must be active, match the selected provider, and belong to a non-deleted,
non-banned auth user. A grant to a different provider or to an inactive or
deleted resource does not authorize it.

The resolver still returns each eligible resource once, even if multiple
grants reach it. More than one distinct eligible credential remains an
ambiguity error; it is not resolved by owner, insertion order, or recency.
Caller-supplied credential/resource IDs are not accepted. The change adds no
grants, owner changes, secret reads, or new IAM principal/control plane.

`PERSONAL_CONNECTION` remains owner-only. Non-Case provider lookup and the
existing DMS automation path are unchanged; no `llm_gateway` fallback or Case
gateway mapping was introduced. Existing model, budget, custody, and sticky
Attempt rules remain in their current code paths.

### Compatibility and grant migration matrix

| Existing state | Case `SYSTEM_INTEGRATION` result after this change | Required authorized action |
| --- | --- | --- |
| `llm_provider` integration was eligible only because the policy user owned it | `SYSTEM_INTEGRATION_UNAVAILABLE` until explicitly granted | Use the existing IAM grant operation for the exact integration and server-derived policy user or a group they belong to |
| `provider_credentials` row was eligible only because the policy user owned it | `SYSTEM_INTEGRATION_UNAVAILABLE` until explicitly granted | Use the existing IAM grant operation for the exact provider credential and authorized user/group |
| Group grant exists, but the policy user is no longer a current member | Not eligible | Restore legitimate membership or grant through existing IAM operations, with separate authorization |
| More than one distinct active, matching, granted resource is eligible | `SYSTEM_INTEGRATION_AMBIGUOUS` | Narrow existing grants or active resources; no implicit winner |
| Resource is inactive, its owner is deleted/banned, or provider differs | Not eligible | Correct the underlying resource/account state through its existing owner/admin process |
| `PERSONAL_CONNECTION` or non-Case/DMS lookup | Existing behavior | No grant migration from this change |

This is a **required migration procedure, not a data migration**. No production
credential or usage inventory was written, and no grant was created or changed.
The absence of a standalone `system` IAM principal is deliberate; service-owned
execution would require a separate versioned grant contract.

## Source and tests

Changed files:

- `supabase/migrations/20261009113000_case_system_integration_grant_only.sql`
  replaces the native Case candidate resolver with grant-only system eligibility.
- `tests/integration/caseExecution.sql` covers no-grant actor-owned and
  third-party credentials, explicit user/group grants, inherited Child Cases,
  current group membership, grant revocation, inactive/deleted resources,
  wrong provider/model, ambiguity, and retained personal routing.
- `tests/unit/caseExecutionCredentials.test.ts` proves an unavailable Case
  system credential does not fall back to the executing user's credential.
- `docs/architecture/axtn-case-execution-routing/ARCHITECTURE.md` records the
  grant invariant and the unchanged non-Case/DMS boundary.

Verification from the isolated worktree:

| Check | Result |
| --- | --- |
| Exact established gateway/Case selector profile plus the new regression | 235 tests / 20 files passed |
| Expanded Case, IAM, connection-grant, and gateway profile | 244 tests / 26 files passed |
| `tests/integration/caseExecution.sql` | Passed transactionally; fixture data rolled back |
| Complete repository migrations, then grant-only migration twice | Applied successfully to a disposable database; reapplication was idempotent |
| `npm run typecheck` | Passed |
| `npm run build` | Passed |
| `npm run lint` | Passed (the repository lint command emitted warnings) |
| `npm run check:docs`, `npm run check:md-docs`, `npm run check:doc-commands` | Passed |
| `git diff --check` | Passed |

The database was a disposable `supabase/postgres:17.6.1.136` container with
`--network none` and tmpfs storage. To represent platform services not started
by that image alone, the test harness supplied minimal local Storage schema
tables/function and auth compatibility fields/helpers (`deleted_at`,
`banned_until`, JWT claim parsing). The native Case RPCs were owned by the
trusted `postgres` test role because the repository's guards explicitly check
that role. These harness-only adjustments were not added to the repository.
The SQL test performed no provider call or Acceptance.

## Scope boundaries and handoff

No production database was connected or modified. No production grant,
migration, credential, Case, Run, merge, release, or deployment operation was
performed. The source work is authorized independently of a personal Case
assignment by the task handoff. Native SupaCase writes/runs were not attempted:
the required authorized system actor / Case binding was unavailable in this
execution context. This report is versioned source evidence, not a replacement
Case record.

The existing DMS route was not changed or live-smoke-tested; it remains subject
to its existing non-Case credential contract. Before rollout, an authorized
owner must inventory actual Case `SYSTEM_INTEGRATION` consumers, map intended
resources to policy users/groups, and provision only the specifically approved
grants using existing IAM operations. An independent reviewer should verify
this migration and the compatibility matrix against that inventory, then
record a separate acceptance/release decision. This PR must not be merged or
deployed without those independent gates.

The task handoff is carried separately by PR #22 and its branch
`work/AXTN-CASE-SYSTEM-GRANTS-0001`; that branch is not the implementation
source. The implementation is based on PR #19's current head and is isolated
on `work/AXTN-CASE-SYSTEM-GRANTS-0001-implementation`.

**Review PR:** to be opened against
`work/AXTN-LLMHUB-PROD-LINEAGE-ACCEPTANCE-0001-integration` after the candidate
commit is pushed. No independent approval or Acceptance is claimed.
