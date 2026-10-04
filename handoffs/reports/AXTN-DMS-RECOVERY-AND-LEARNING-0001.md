# AXTN-DMS Recovery and Learning — implementation checkpoint

Status: **IMPLEMENTATION_IN_PROGRESS / NOT_DEPLOYED / ACCEPTANCE_PENDING**.
This is retained execution evidence, not a completion or production PASS.
Authority: request revision `dad9629ae1ae98465beefa63deccd6c76aa42031`.
G0 and exact root cause: [fresh preflight](AXTN-DMS-PREFLIGHT-0001.md).

## Ownership, branches and boundaries

Parent `42a577cc-51cf-48ac-b6b8-8ec855714021` is OPEN.
Inventory/Recovery Child `e1685b29-9a29-45cf-a470-25d3503335c7` and Case/Manual
Child `b09920d3-8c66-40db-ad2c-e34bc017cb5a` are OPEN.
Filing `4ecf0e5e-a855-43f9-a247-176d1832c805`, Learning
`2ea37676-0b44-4ff3-8a36-fa296d055d2e` and independent Acceptance
`85c2f455-b4db-44ad-9e14-fce2efacd7fe` remain NEW with registered dependencies.
No Child or Parent was falsely completed.

Own App worktree `/home/alex/aXtn-agentswarms-dms-recovery-worktree`,
branch `work/AXTN-DMS-RESTORE-0001`, compatible base
`6bf776ef7c9abb59224f0477dc7257f94f93f4ca`; G0 commit
`7b4807734ecd7dc113c7ada0f178f31b8490f944`.
Own Host worktree `/home/alex/aXtn-host-dms-recovery-worktree`,
branch `work/AXTN-HOST-DMS-RESTORE-0001`, unchanged
`85dbb7227e04a6a1406697a8b660bb1c8804d13e`.
No merge/tag/release, default-branch write, n8n mutation or Host convergence.
Working local Copilot MCP, existing providers and Development worktrees preserved.

## Delivered source increment

- Separate registered DOCUMENT_* profile in the existing owner-bound Case API,
  same datasets, advisory lock and append-only audit. Original Development
  schemas/RPC/receipt/Approval verification remain unchanged.
- Atomic Case-before-Registry ensure, request/delivery dedup and immutable
  manifest hashing. Original provider ETag, input hash and code SHA are distinct.
  Opaque document IDs preserve actual existing IDs; no UUID-only restriction.
- Human takeover/release fence old attempts; actual authenticated principal is
  server-bound. Human priority 0 survives machine continuation.
  RESULT records evidence but cannot assert acceptance, provider PASS or closure.
- Minimized `document-decision-v1` proposals use the same service, owner-bound
  logical Dataset and audit. Immutable server-derived revision, current
  worker/Case/attempt/input/source fences and readback through the shared API.
  UI/headless use the same validator; UI retains the request's Decision ID
  until confirmed readback. Proposals stay PROPOSED and do not change Case
  status or constitute independent Approval. Claimed privacy eligibility
  cannot authorize machine proposals; protected persisted evidence is required.
  Actual generic role marker-omission inserts, overwrites, LocalTable writes
  and Dataset deletion are denied.
  Reserved Decision dataset insertion/rename without a protected marker is
  also denied under the actual service_role; projection/read APIs do not infer
  authority from arbitrary rows.
- Existing Case relations UI routes protected assignment to the same native
  domain validator/RPC. Owned identity, explicit Human authority, preservation
  of primary Business relation, conflicting assignment denial and idempotent
  missing-projection recovery are tested under actual DB roles.
- Additive candidate migration `20261004080000_document_work_profile.sql`.
  Generic Row/Dataset/LocalTable writes cannot bypass document Work or primary
  relation guards. Dataset metadata reconciliation preserves unknown columns.
- Explicit eight-node native Case-bound Intake seed/publish/apply; compatibility
  five-node seed remains. Strict technical request/delivery/provider revision
  required before writes. Validated top-level ACK retains old output/runId.
  This is not the full dependency seed or Parent suspended registration ACK.
- Recovered Parent/Privacy/Cleanup graph sources and pure recognition basis.
  Historical Cleanup implicit-all fallback removed; exact explicit selection
  and Approval reference required. Historical Filing `filed=true` alone no
  longer passes: actual provider file/name/exact parent must match instruction.
  These graphs are **not published or executable completion claims**; protected
  revision-bound DMS Approval/effects and genuine agent dependencies are pending.
- Issue #8 optional opaque input is retained as untrusted
  `externalReferenceContext`, with `NEEDS_CLARIFICATION`; no correlation,
  local Parent inference, Core CRUD or Work-key derivation from external IDs.

Dependency source hashes, stable IDs, missing semantic definitions and distinct
implemented/tested/deployed/runtime states are retained in
`axtn/swarms/axtn-document-management/dependencies.json`.
Historical full DMS source is not an ancestor of current App basis; this is a
non-integration/provisioning gap, not a demonstrated deletion regression.

## Executed evidence and remaining gates

Final stable Component check passed typecheck, lint (warnings only), docs,
infra, **566 files / 9,195 tests PASS / 40 skipped**, and build.
The skipped Parquet/MinIO tests are not claimed as runtime PASS.
Subsequent targeted recovered-graph/manual suite: 50 tests PASS, including
16 actual Function-body safety fixtures.
Latest proposal/profile/manual/graph subset: 64 tests PASS and typecheck/lint
PASS. Isolated current migration/proposal/roles/concurrency rerun PASS.
An intermediate full-suite inventory-hash check failed while the candidate
SQL was still being hardened. Its source hash was updated only after the
exact SQL passed the isolated DB tests; the complete stable check was then
rerun successfully. No failed check was treated as a deploy gate PASS.
Passing this source increment does not make the still-incomplete full DMS
restoration deployment-ready.

Dedicated schema-only DB `dms_native_contract_20261004`, no production business
records copied: candidate migration, actual service_role bypass/owner fencing,
Human priority, metadata preservation, primary assignment/projection recovery,
untrusted reference clarification and immutable replay passed.
16 separate concurrent PostgreSQL sessions plus lost-response replay prove one
Case/document/attempt/delivery. Test fixtures rollback or clean only their
synthetic owner; production schema remains unchanged.
The existing Development native Approval SQL role suite also passes with the
DMS candidate migration present: owner/builder/unrouted denial, immutable
bindings, independent reviewer approve/reject, reviewer-group authorization,
duplicate decision, stale attempt and atomic identity/time audit.
Actual protected credential scan passed across 2,437 source/evidence files,
task artifacts, browser assets and runtime logs; credential values were never
printed or copied into Evidence.

Partial coverage only: C1/C2/C3/C5/C9, S1/S3/S4/S5 have implemented adapter
evidence; complete end-to-end R1–R17/L1–L24/C1–C13/S1–S7 is not delivered.
No LLM/orchestrator outage-to-provider closure, independent DMS review,
restart/full empty-state, real filing/delete or Learning/promotion PASS claimed.

## Concrete unresolved dependencies and next packages

The Local Table MCP Python template already exists in the compatible current
basis, byte-identical to the historical source; the gap is its native
app/key/runtime authorization provisioning, not missing template source.
It must use the existing SDK broker and fail-closed app-ID allowlist.

Exact later Triage/Processing prompts/model/temperature/Skill/KB/guardrail/tool
bindings are not present in checked later Source/runtime/backups. Earlier
differently identified settings and platform samples cannot replace them.
Gemini scope is not changed. Restore independent deterministic surfaces while
keeping affected semantic capability blocked.

Pending: complete dependency-ordered native seed; Local Table/Registry editor;
local privacy/OCR; protected DMS receipts/closure and native Approval adapter;
scoped persistent effect claim/readback/projection recovery; own n8n executor
branch with compatible source envelope/deletion contracts; bounded persisted
Learning/side-effect-free evaluation/review handoff; full tested Host pins and
allowed production convergence. Missing QualityProfile blocks promotion only;
all new real auto-policies must stay disabled.

Real operator execution/OAuth/folders/naming/ingress authority remains unproven.
The n8n maintenance read key is not expanded into execution permission.
Sole current authenticated Owner cannot independently accept own work.
Issue API 403 is not bypassed; canonical Git and Case execution remain available.

## Production and rollback

No DMS deployment or production schema/seed/config mutation performed.
Fresh readback before this source commit confirms active App source
`10df3a869c5dcb6c377840ca7a048a87d1aa4c6f`,
image `sha256:1f3e476e524674df9f5cd1333eab35da1e0d6f370b1435caf4bfdff49449769a`.
Development run `00ff44a5-760c-45dc-a605-7762ba72761a` remains suspended,
independent acceptance remains pending. Last migration ledger has 278 entries,
latest `20261004060000_native_work_approval_binding.sql`.
Actual ledger is `axtn_host.migration_ledger`, not the Supabase CLI
`supabase_migrations` table. The unrelated Development App/Host/MCP worktrees
and the own DMS Host worktree remain clean.
Only the current CLI writer and an unrelated August long-lived Node service
were observed, with no active native bootstrap/convergence writer.
Rollback **not triggered**; exact live baseline/config/checksums and actual
rollback validation must be refreshed before eventual targeted convergence.
