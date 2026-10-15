# AXTN-DEVSWARM-OWNER-LLMHUB-20261016 — technical report (interim)

Base: `ce8311956e93ee9a198b22af3cd146649a33c916` (fast-forward of `0304f453`). Branch `work/AXTN-DEVSWARM-SLICE1-ACCEPTANCE-20261015` (same worktree, single writer).

## Status (strictly separated)

| State | WP1 owner approval | WP2 Corporate LLMHub |
|---|---|---|
| IMPLEMENTED | SQL candidate unchanged from handoff (no correction needed) | no source change made |
| TESTED | yes, isolated clone (below) | isolated metadata read only; no inference test |
| DEPLOYED | **no** (live ledger unchanged, live approval still pending) | **no** |
| ACCEPTED | no | no |

## WP1 — migration `20261016000000_development_owner_review_eligibility.sql`

- SHA-256: `eabec5bb93940e827f95cf19b07a615a295bca5c258a82cb914e578955b5169c`. Replaces only `public.guard_axtn_work_approval` (drops only the `auth.uid()=OLD.user_id` denial). `assert_axtn_work_reviewer`, `is_swarm_approver`, audit trigger, DMS guard, RPC untouched.
- Clone: `pg_dump` of live DB into throw-away database `axtn_clone` (112 non-fatal restore messages from extension/role objects; guard, triggers, the pending approval row present). Migration applied twice without error (re-runnable: `CREATE OR REPLACE`). Live DB not touched; approval `7aa0dcb3` still `pending` live and in the clone after all tests (all test work is rolled back).
- New test `supabase/tests/development_owner_review_eligibility.test.sql` (run twice, 0 failures, 15 checks):
  1 owner in reviewer group with separate swarm builder → decision allowed; 2 owner without assignment → `NATIVE_APPROVAL_REVIEWER_DENIED`; 3 other group reviewer approve/reject allowed; 4 `human_builder_ids` and `user_session` actor → `NATIVE_APPROVAL_BUILDER_DENIED`; 5 unauthenticated (zero rows via RLS), service_role, candidate/attempt/receipt/payload drift, decided-row re-decision, human cancel → all denied with the native error; 6 DMS guard still present.
- Builder metadata of the live fixture (read-only): Work case `402a1966` and Verify child `5e9e2b02` have `actor_principal.kind=swarm` (owner id as swarm principal) and no `human_builder_ids`; all `axtn_work.*` audit principals are `swarm` or `swarm_api_key`, none `user_session`/TAKEOVER. Therefore the unchanged builder guard does **not** classify the owner as human builder; the owner is only blocked by the line this migration removes. No audit/builder history rewritten.
- Impact if applied: the pending approval row/snapshot stays unchanged, but the policy then governs its future decision: the owner (member of reviewer group `2a156ccf…`, the only member) could decide `7aa0dcb3` through the native inbox/RPC with a real authenticated session, subject to current Case/attempt/candidate/receipt revalidation. Rollback = re-apply the previous guard body from `20261004060000` as a new migration.
- Not covered: the app-layer path (`swarmWorkApproval.server.ts`, `workAcceptance.server.ts`) was not run end-to-end after the change; native resume after a decision is untested.

## WP2 — Corporate LLMHub (not completed)

Read-only live metadata: integrations `vLLM (self-hosted)` (provider `vllm`), `LLM Gateway` (`llm_gateway`), `OpenAI`, `Google Gemini`; model rules for group `2a156ccf…` on vllm/openai/gemini/openrouter (`*`); one `integration` resource grant. Live runtime stays `eb191e15` without the owner-or-grant correction (PR #32 / grant-only migration `20261009113000` not applied). No model discovery, inference, case-route override, role mapping or credential access was attempted in this step, so no Corporate-inference evidence exists. The concrete role/model proposal needs measured discovery against a deployed owner-or-grant build and remains open.

## Remaining restchecks

- Candidate readback via product-side Gitea MCP, UI reload of the suspended run, duplicate-initiation with the same Idempotency-Key: not run in this step.
- Parent-case 409 (`85a1d829`): the parent rejects child-style transitions from this principal; summary evidence is attached to Work case `402a1966` (result `PASS_TO_APPROVAL_SUSPENDED`). Not repaired directly.

## Human decisions remaining

1. Authorize applying `20261016000000` live (revision-bound), then decide `7aa0dcb3` via the native inbox.
2. Release of the PR #32 owner-or-grant build (host gate: registry `write:package` still missing), then LLMHub role mapping approval.
