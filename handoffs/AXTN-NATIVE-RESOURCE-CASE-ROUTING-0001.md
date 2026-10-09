# AXTN-NATIVE-RESOURCE-CASE-ROUTING-0001

Status: USER-APPROVED ARCHITECTURE CORRECTION AND IMPLEMENTATION TASK. Greenfield release prerequisite.

## Decision (supersedes incompatible part of AD-08)

All normal Gemini, OpenAI API, and T-Systems LLM Hub integrations are existing platform resources assigned through native integrations/IAM/group and Agent/Swarm configuration. Case binding adds work ownership, audit, data/budget policy and routing context, **not** a separate credential entitlement requirement. Native owner access and effective group-shared resource rights continue to work for the same provider/model within or outside a Case. Do not silently bypass native IAM or select another actor's inaccessible resources. Personal ChatGPT-plan connections are explicitly OUT OF SCOPE for this release; no personal OAuth/chat plan implementation, workaround, special credential ownership or additional gateway.

Current docs/architecture/axtn-case-execution-routing/ARCHITECTURE.md AD-08 lines 156-171 require explicit resource grants even when the executing policy principal owns an integration. This conflicts with the user's confirmed intended native-standard behavior. PR #23 head 22b0a0af46bc10d16a8198ea97ead11b753d0f91 and migration 20261009113000_case_system_integration_grant_only.sql implement that excess Case-only rule; do NOT deploy the migration unchanged.

## Required implementation

1. Revalidate latest accepted source, PR #19/#23 lineage, release artifacts aXtn-host PR #13, app PR #30, read AGENTS.md. Use existing Parent Case 3fd852b0-8a1c-4a07-8ac8-a8c3c8529063 with authenticated cases-only key; create a genuine Child only if justified; persist refs.
2. Trace ordinary native credential resolution (owner and IAM group grant) against Case-specific selection. Align Case SYSTEM_INTEGRATION with the existing native provider permission semantics; preserve server-derived principal, exact provider/model, sticky Attempt identity, tenant/data scope, cost, denial for inaccessible resources and ambiguity safeguards. No custom controller, no new gateway/credential type, no personal-plan access.
3. Update the architecture decision in versioned documentation, recording prior restrictive rule, user decision, rationale, migration compatibility and review consequences. Correct/remove the pending grant-only migration via a safe branch-based design; since not applied on Greenfield, ensure release migration chain cannot apply the obsolete restriction. Do not edit historical applied migrations; verify ledger first. Preserve ordinary DMS behavior.
4. Regression tests: existing owner-only integration in Case succeeds without extra grant; IAM-group-shared integration succeeds; unauthorized other-user resource denied; revoked grant denied; model IAM restrictions enforced; multiple eligible resources fail closed; provider/model/Attempt binding stable; PERSONAL_CONNECTION does not become sharable; non-Case Gemini/OpenAI/vLLM and DMS unchanged; native Swarm/headless parity. Run SQL migration tests, focused suites, typecheck/build/lint, compare two known baseline failures.
5. Commit implementation and evidence on a fresh isolated working branch and raise review PR based on current accepted candidate. Seek eligible independent review. Update host release plan/manifest only after new reviewed immutable candidate SHA is known; previous PR #13 image is obsolete as final candidate. No extra IAM grants to compensate for Case-only restriction.
6. Greenfield release is explicitly desired, but protected merge, material security decision, PROD DB migration and deployment must follow verified host gates/authorizations. Once authorized and reviewed, use host-controlled backup/rollback, pin convergence and actual vLLM inference; do not declare deployed from a build. Keep personal ChatGPT outside acceptance.

## Acceptance

One normal native enterprise integration behaves consistently for Agent execution inside and outside a Case under the same effective IAM principal, without an additional Case-only entitlement. Existing Case policy and security remain enforced; obsolete grant-only migration is not deployed. Exact tested source SHAs, reviewed candidate, migration state, host pin and Case/Evidence links documented. Never stop at a generic preflight when independent source work is possible.
