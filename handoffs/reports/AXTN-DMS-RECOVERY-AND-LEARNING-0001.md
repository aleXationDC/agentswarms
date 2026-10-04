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
  That initial increment did not deliver the full dependency seed or Parent
  suspended registration ACK; the bounded ACK addition is recorded below.
- Recovered Parent/Privacy/Cleanup graph sources and pure recognition basis.
  Historical Cleanup implicit-all fallback removed; exact explicit selection
  and Approval reference required. Historical Filing `filed=true` alone no
  longer passes: actual provider file/name/exact parent must match instruction.
  These graphs are **not published or executable completion claims**; protected
  Approval graph composition, revision-bound effects and genuine agent
  dependencies are pending.
- Issue #8 optional opaque input is retained as untrusted
  `externalReferenceContext`, with `NEEDS_CLARIFICATION`; no correlation,
  local Parent inference, Core CRUD or Work-key derivation from external IDs.

Dependency source hashes, stable IDs, missing semantic definitions and distinct
implemented/tested/deployed/runtime states are retained in
`axtn/swarms/axtn-document-management/dependencies.json`.
Historical full DMS source is not an ancestor of current App basis; this is a
non-integration/provisioning gap, not a demonstrated deletion regression.

## Native Approval source increment

Previous Case/Manual increment is committed at
`29036ea3cb2d44a111ec791fd9b5d873be57b641`.
The following narrow extension keeps the existing native Approval, IAM,
canvas/headless runtime, checkpoint and atomic resume claim:

- Literal step operation `CLASSIFY`/`FILE`/`DELETE`, current
  Case/Attempt/Input/document/source/Decision revision, graph snapshot hash and
  minimized Evidence bind the same native Approval row. Persisted node routing,
  not prompt/client routing, defines eligible reviewers. Classification
  authority cannot be reused for deletion.
- Authenticated Owner and actual Builder decisions are denied; routed
  independent reviewers/current group members can approve or reject.
  Immutable proposal/routing/binding/run snapshot and atomic identity/time
  audit prevent mutation of retained decision evidence. Unauthorized decisions
  leave Approval/Case state unchanged.
- Pending callback replay/readback reuses the operation. Approved/rejected
  resume revalidates current proposal and reviewer/group authority;
  cancellations cannot be revived. Human takeover fences machine requests.
- Machine proposals still require protected private privacy evidence; no
  caller-supplied `ELIGIBLE` authority. Non-null Rule/Policy binding stays blocked
  pending its authoritative adapter. Native Approval is not source/target
  authorization, physical-effect evidence, acceptance or Case closure.
- Candidate migration `20261004100000_document_native_approval_binding.sql`,
  SHA256 `c593497e306921f8148564e27c4e128b86bb28cc3307f2143ee20a18d7851929`.
  No new engine, workflow controller, scheduler or Case store.

Targeted Document Approval/Development Approval/Document Work suite:
**65 tests PASS**. Actual schema-only PostgreSQL role suites pass with both
candidate migrations: DMS reviewer approve/reject/group, Owner/Builder/unrouted
denial, operation/routing/domain binding denial, source drift, revoked group at
resume, service-role decision denial, immutable run/proposal evidence and audit;
unchanged Development Approval roles also PASS.
Document profile and 16-session concurrency/lost-response rerun PASS.
The test DB ownership initially differed from production (`supabase_admin`
instead of `postgres`), causing a migration CREATE permission failure.
The isolated DB was recreated with production-matching ownership; all exact
migrations and role tests were then rerun successfully. No production grants
or privilege widening, and no failed run claimed as PASS.

Stable full Component gate for this Approval increment **PASS**:
typecheck, lint (warnings only), docs, infra, **567 files / 9,214 tests PASS /
40 skipped**, and build. Missing-tool infra check and Parquet/MinIO skips
remain skips, not runtime PASS. Recovered Parent/Cleanup graph composition and live native
Suspend/Resume/restart remain pending; synthetic SQL reviewers are not real
independent Acceptance. Native checkpoint context can still persist raw data;
the minimized Approval payload alone is not a DMS leakage/retention PASS.
Final protected-credential scan PASS across 2,441 source/evidence files,
browser assets and runtime logs. Final readback still shows App `10df3a869...`,
image `sha256:1f3e476e...`, 278 production ledger entries and the same suspended
Development run; unrelated worktrees remain clean.

## Executed evidence and remaining gates

### Canonical draft PR and Case references

Current-Decision/privacy increment is committed/pushed at
`2f2d67f2099888f0c4403f9cbcb9a4c2bdcdecda`; immediate existing push-mirror
synchronization and completion readback passed. Parent, Inventory and Case
retain this exact candidate/evidence and genuine PR_CREATED references,
all OPEN.

Canonical Gitea draft **PR #11** uses head `work/AXTN-DMS-RESTORE-0001` and
base `work/AXTN-DEVELOPMENT-SWARM-NATIVE-0002` at
`6bf776ef7c9abb59224f0477dc7257f94f93f4ca`. The compatible base is an
ancestor of the DMS head. No unrelated history was introduced into old main;
no Development branch write or merge was performed. The draft is explicitly
partial, not ready for full DMS deployment or independent acceptance.

### Native Parent registration ACK source increment

The existing public API and signed asynchronous callback now project the
completed Intake registration when the native Parent is suspended. The
read-only DMS adapter uses actual owner-bound persisted run/snapshot/checkpoint,
one completed native Intake writer, exact original request/manifest/provider
revision, and protected Case plus Registry identities. Raw client/context
claims alone cannot authorize an ACK. Unrelated Development and standalone
Intake behavior remain unchanged.

The Registry's immutable first Intake Case is retained for a separate request
on the same document; its protected owned identity is checked, not overwritten.
Drive ACKs cannot introduce `next_location`; mail keeps the existing
`00_Review`, not arbitrary caller destinations.

Pending idempotency remains `in_progress`. The existing run reference and
original output are saved before ACK projection: projection failure surfaces
an error but cannot make an already parked workflow reclaimable. A same-body
lost-response retry reads the native persisted registration without another
execution, write, approval, Case or workflow retry engine. Body mismatch still
rejects before readback. Native Suspend/Resume/approval authority are unchanged.

Executable isolated adapter and actual API-handler tests cover sync, async
callback, pending replay, mismatch, owner scoping, failed/missing persistence,
stale/fabricated bindings, ambiguous writers, metadata leakage exclusion and
transport destination restrictions. Targeted **60 tests PASS**, including
unchanged native parked/resumed-run and Intake tests. These use isolated
fixtures, not a published production Parent; full live S5/R9 remain pending.
There is no new migration, executor, orchestrator or production mutation.
Stable full Component gate **PASS**: typecheck, lint (warnings only), docs,
infra, **569 files / 9,251 tests PASS / 40 skipped**, and client/server build.
After the inventory/report update, docs/infra plus the 39-test inventory/ACK
subset passed again. Protected credential scan passed across 2,446
source/evidence files, browser assets and runtime logs. The native adapter
source SHA256 is
`8e2ba2f3c20ee3962f9243976fec515c5f64fd3225e50966ca2f85e98c9c9461`.
Fresh canonical branch readback still showed compatible Development `6bf776ef`
and prior DMS `2f2d67f`; actual live image/source remained `1f3e476e`/`10df3a869`.
Unrelated Development App/Host/MCP and own Host worktrees remain clean.

### Explicit native Registry seed source increment

Parent ACK increment is committed/pushed at
`53a6d085b969676acf2e7c6fcc6fd538674ceb77`, immediately mirrored with verified
completion readback. The same Parent/Inventory/Case are OPEN with this exact
candidate/evidence and PR #11 refs. Existing PR #11 remains draft and its
partial source/NOT_DEPLOYED evidence is updated; no merge or foreign branch
write.

The next bounded source increment restores an explicit native three-Dataset
seed/reconcile through the existing configured-bootstrap-superadmin endpoint
and a service-only atomic RPC. Dataset owner is server-derived, not a body
field. The existing owner/name uniqueness and owner Case advisory lock are
reused. Existing IDs, operator documents/custom taxonomy/unknown metadata and
source filenames remain unchanged; missing columns are appended. Sample
collisions, malformed metadata and ambiguous matching taxonomy fail without
reset or invented replacements. A no-op seed adds no audit or Dataset update.

Six exact historical operational document types are seeded only explicitly;
no active recognition pattern, business document, provider identity, Policy
or privacy authority is inserted. Historical seed-on-read and client-asserted
provider-safe pattern creation are not restored. The dedicated command is
`axtn/swarms/axtn-document-management/seed-registries.mjs`; no MCP or credential
configuration change is required.

Additive migration `20261004120000_document_registry_seed.sql`, SHA256
`836cbf6520bf6270e381e255937dfc37e66e5d5249054174621bf475f28e9697`,
was applied **only** to the isolated production-ownership-matching schema DB.
Fresh schema restore plus all four exact candidate migrations passed actual
Document Work, Approval, current Decision/privacy, Registry seed and unchanged
Development native Approval role suites. Anon/authenticated RPC bypass is
denied; the configured bootstrap endpoint authentication/IAM is executed in
isolated API-handler tests.

Sixteen independent native PostgreSQL Registry seed sessions plus a new-session
replay prove exactly three owned Datasets, six values, zero business/pattern
rows and four audit events. Work ensure/concurrency/lost-response also passes
with this migration. Both concurrency suites passed twice in separate sessions.
An intermediate repeat exposed old fixture cleanup leaving native deletion
audit events after auth deletion. The test helper was shared without weakening
its isolated-DB fence, fixture cleanup now commits exact fixture Dataset/auth
deletion followed by audit cleanup, and fresh/readback/repeat runs passed.
Only those synthetic owners in the isolated DB were cleaned; no production
business/evidence cleanup occurred and no failed test was counted as PASS.

This is partial native seed evidence, not R1/R15/R17 full-DMS PASS, active
recognition/editor delivery, real source effects, Learning or deployment.
Stable full Component gate **PASS**: typecheck, lint (warnings only), docs,
infra, **571 files / 9,269 tests PASS / 40 skipped**, client/server build.
Targeted Registry/bootstrap/Intake/inventory subset: **25 tests PASS**.
Protected credential scan passed across 2,457 source/evidence files,
browser assets and runtime logs. Production readback remains App `10df3a869`,
image `1f3e476e`, ledger 278 and the same suspended Development run.
Native local OCR restoration has started separately in uncommitted source;
it is not part of this Registry seed commit or a deployed capability.

### Current Decision and privacy revision increment

Native Approval increment is committed/pushed as
`6c3f055763dbd8dd33648fd9bf791480c95a34a7`; the existing repository push
mirror was synchronized immediately and read back with `last_update` after
that commit. Parent/Inventory/Case retain this exact candidate and evidence,
all still OPEN.

Further candidate migration `20261004110000_document_current_proposal.sql`,
SHA256 `1e2ce3d5e254074ee10dca0b776f0e300ed6287f488c2b04b50c48dc1bf474dd`,
extends the same Case RPC and native binding check, not another engine.
Current immutable Decision/revision is selected per operation atomically;
prior proposals remain retained, but a late callback cannot reselect one
after supersession. Existing native Approval decisions and approved resume
reject non-current Decision bindings. Shared readback and manual UI label
current/non-current proposals without asserting acceptance.

The wrapper also requires actual verified ELIGIBLE privacy for machine
proposals and all semantic mode transitions. A proof-shaped hash or even
claimed eligibility cannot override an original NO_AI manifest. Raw private
legacy delegates have no user/service-role execute grant. Existing native
owner/name Dataset uniqueness is reused, not replaced with another mechanism.

Fresh schema-only rehearsal with all three exact candidate migrations PASS:
Document profile/broker roles, native Document Approval roles including
superseded approved resume, current-proposal callback/readback/NO_AI/private
delegate suite, unchanged Development Approval roles, and 16-session
ensure/lost-response concurrency. The new fixture initially expected a
duplicate Dataset could be inserted; actual native uniqueness rejected it.
The test now verifies that exact existing constraint, and redundant custom
ambiguity logic was removed. No failing rehearsal counted as PASS.
Targeted current-binding suite: 66 tests PASS. Stable full Component gate for
this latest revision increment **PASS**: typecheck, lint (warnings only), docs,
infra, **567 files / 9,215 tests PASS / 40 skipped**, and build. Missing-tool
infra and Parquet/MinIO skips remain skips. Protected-credential scan PASS
across 2,443 source/evidence files, browser assets and runtime logs.
Production remains untouched (278 ledger entries, prior live image and
suspended Development run). This is tested source, not deployed full DMS.

Previous committed increment's stable Component check passed typecheck, lint (warnings only), docs,
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
local privacy/OCR; protected DMS receipts/closure and native Approval graph composition;
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
