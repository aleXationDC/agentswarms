# AXTN-DMS Recovery and Learning — implementation checkpoint

Status: **IMPLEMENTATION_IN_PROGRESS / NOT_DEPLOYED / ACCEPTANCE_PENDING**.
This is retained execution evidence, not a completion or production PASS.
Authority: request revision `dad9629ae1ae98465beefa63deccd6c76aa42031`.
G0 and exact root cause: [fresh preflight](AXTN-DMS-PREFLIGHT-0001.md).

## Full assignment gate ledger

This ledger records the **full gate**, not whether one source fixture passes.
PARTIAL means measured source/isolated evidence exists but required integration
or live proof is absent. PENDING means the complete gate has not been executed.
BLOCKED identifies a concrete unavailable definition/binding, not a substitute
for implementing unrelated technical work. No independent Acceptance PASS.
Exact evidence and limitations for each increment are recorded below and in
the dependency manifest; historical counts are not current gate executions.

| Gate | Full-gate state | Delivered evidence / missing requirement                                                                               |
| ---- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| R1   | PARTIAL         | Stable graph sources recovered; exact two semantic agents/Skills/KB absent.                                            |
| R2   | BLOCKED         | Full dependency seed/published Parent/Children require missing agent definitions.                                      |
| R3   | BLOCKED         | Exact later prompts/models/temperature/Skills/KB/guardrails irrecoverable in checked authority.                        |
| R4   | BLOCKED         | Exact native Skill definitions/bindings unavailable; no sample substitution.                                           |
| R5   | BLOCKED         | Exact DMS KB definitions/seed/bindings unavailable; platform samples are not evidence.                                 |
| R6   | PARTIAL         | Native Registry/LocalTable seed, roles/concurrency pass isolated; product MCP not registered live.                     |
| R7   | PARTIAL         | NO_AI fences/offline OCR/pseudonymization tested; protected current privacy/language/coverage proof absent.            |
| R8   | BLOCKED         | Stable Stage1/2 semantic definitions unavailable; Gemini assignment not replaced.                                      |
| R9   | PARTIAL         | Native Approval roles and actual Canvas/handler/resume fixtures; no full published DMS/live reviewer proof.            |
| R10  | PARTIAL         | Registry/proposal/owned registration readback fixtures; full live projection absent.                                   |
| R11  | PARTIAL         | Guarded proposal/Approval preparation; no complete current-rights/effect eligibility.                                  |
| R12  | PARTIAL         | Bounded native n8n filing/deletion readback tests; durable effect/receipt/live provider proof absent.                  |
| R13  | PARTIAL         | Development/domain/primary-relation isolated roles and unit regressions; live DMS relation proof pending.              |
| R14  | PENDING         | Full DMS live restart/resume persistence not executed.                                                                 |
| R15  | PARTIAL         | Isolated native migrations/individual reseeds; complete dependency empty-state rehearsal absent.                       |
| R16  | PARTIAL         | Protected secret scan source/evidence/assets/runtime logs passed; full newly converged DMS scope absent.               |
| R17  | PARTIAL         | Exact candidate ordered source/build gates; full convergence candidate/effect/runtime package absent.                  |
| L1   | PARTIAL         | Deterministic recognition/evaluation fixtures; real known-family/current target authority absent.                      |
| L2   | PARTIAL         | Candidate/evaluator abstention fixtures; complete current feature vocabulary absent.                                   |
| L3   | PARTIAL         | Recognition/assignment/evaluator ambiguity denial; full published graph execution absent.                              |
| L4   | PARTIAL         | Actual SQL NO_AI/UNRESOLVED semantic denial; live privacy/coverage loader absent.                                      |
| L5   | PARTIAL         | Same-Case Human takeover/proposal fences; full manual provider effect path absent.                                     |
| L6   | PARTIAL         | Append-only confirmed exception/taxonomy feedback fixtures; live complete workflow absent.                             |
| L7   | PARTIAL         | Actual native feedback dedup/roles/concurrency; full runtime feedback chain absent.                                    |
| L8   | PARTIAL         | Current proposal/attempt/input revision fences; same-Case current provider SourceRevision advancement absent.          |
| L9   | PARTIAL         | Disabled immutable policy/proposal guards; active-policy revocation at live suspend absent.                            |
| L10  | PENDING         | Protected current source/target rights loader and provider rights-loss proof absent.                                   |
| L11  | PARTIAL         | Same-key API blind rerun denied; provider UNKNOWN receipt/readback reconciliation absent.                              |
| L12  | PARTIAL         | Native Case/proposal concurrent fixtures and atomic resume-claim wiring; persistent provider EffectKey fencing absent. |
| L13  | PARTIAL         | Native filing verifier rejects filed-only/wrong identity/name/parent; durable provider receipt path absent.            |
| L14  | PENDING         | ProviderPASS/EVIDENCE_PENDING projection-only recovery not implemented end-to-end.                                     |
| L15  | PARTIAL         | Native Intake/feedback/candidate dedup/concurrency; provider collision proof absent.                                   |
| L16  | PARTIAL         | Deterministic family metrics/evaluation hard gates; accepted QualityProfile and independent evaluation absent.         |
| L17  | PARTIAL         | Evaluator privacy/rights/severe-error hard fail overrides aggregate score; full live review chain absent.              |
| L18  | PARTIAL         | Strict minimized schemas/untrusted reference and evaluation fixtures; full graph/model injection acceptance absent.    |
| L19  | PARTIAL         | Scoped trace/model barriers and suspended output omission; raw checkpoint/terminal/cache/audit/retention paths remain. |
| L20  | PARTIAL         | Immutable source/proposal/rule/evaluator revisions; complete live model/prompt drift enforcement absent.               |
| L21  | PENDING         | Live restart at DMS review/UNKNOWN not executed; UNKNOWN recovery missing.                                             |
| L22  | PARTIAL         | Individual native empty-state/reseed fixtures; complete dependency/recovery graph empty-state proof absent.            |
| L23  | PARTIAL         | Native candidate/policy direct-write scope fences; full reviewer/PR handoff runtime proof absent.                      |
| L24  | BLOCKED         | Disabled policies retained; accepted QualityProfile/promotion/drift-revocation decision unavailable.                   |
| C1   | PARTIAL         | Native atomic Intake Case-before-Registry incl privacy hold; full published semantic/effect graph absent.              |
| C2   | PARTIAL         | Native Ensure concurrency/owned lost-response/no-repeat fixtures; complete provider effect recovery absent.            |
| C3   | PARTIAL         | Actual protected owned assignment preserves primary relation; live DMS end-to-end absent.                              |
| C4   | PARTIAL         | Shared authenticated Human validator/UI seam; complete manual provider execution unavailable.                          |
| C5   | PARTIAL         | Native takeover stale-attempt/proposal/Approval fences; full graph/effect continuation absent.                         |
| C6   | PARTIAL         | Shared domain validation/Approval and actual Canvas wiring; current source rights/provider gate absent.                |
| C7   | PARTIAL         | RESULT cannot close without authority; UNKNOWN receipt/projection recovery missing.                                    |
| C8   | PARTIAL         | Strict native checkpoint/cursors/owned lineage fixtures; full live restart and original-free hydration absent.         |
| C9   | PARTIAL         | Native foreign-owner/Case/primary relation and Priority0 tests; converged DMS runtime proof absent.                    |
| C10  | PARTIAL         | Native inactive Candidate/disabled policy fixtures; full independent promotion contract absent.                        |
| C11  | PARTIAL         | Persistent same implementation Parent/Children/references; independent eligible reviewer unavailable.                  |
| C12  | PENDING         | Complete persistent acceptance Cases and channel-equal live KPI proof not executed.                                    |
| C13  | PENDING         | ProviderPASS/Case-projection failure recovery without repeat effect remains unimplemented.                             |
| S1   | PARTIAL         | Exact current full unit gates and isolated native Development guards; post-convergence live proof pending.             |
| S2   | PARTIAL         | Protected native domain/proposal/Approval compatibility fixtures; full FilingReceipt domain integration absent.        |
| S3   | PARTIAL         | Actual native dataset/row/LocalTable/audit bypass denial; broader effect/privacy receipt surfaces absent.              |
| S4   | PARTIAL         | Optional external refs remain untrusted/clarification; separate #8 correlation not duplicated.                         |
| S5   | PARTIAL         | Actual API top-level ACK and native n8n header/transport fixtures; live ingress/provider activation absent.            |
| S6   | PARTIAL         | Existing maintenance read scope preserved; real separate execution bindings absent.                                    |
| S7   | PARTIAL         | No provider/plan/group changes; exact later GeminiStage1 recovery blocked.                                             |

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
compatible base `85dbb7227e04a6a1406697a8b660bb1c8804d13e`, tested source-only
OCR overlay commit `c1a25fefd9934424d4023ad5ead12004d18007a8`.
No merge/tag/release, default-branch write, n8n runtime mutation or Host convergence.
Working local Copilot MCP, existing providers and Development worktrees preserved.

## Delivered source increment

- Separate registered DOCUMENT\_\* profile in the existing owner-bound Case API,
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
Native local OCR restoration started separately; it was not part of this
Registry seed commit or a deployed capability.

### Local deterministic OCR recovery increment

Registry seed increment is committed/pushed at
`894ab4479a5e268a1fdc001d87eb7446a9457caf`, retained by the same OPEN
Parent/Inventory/Case.
Existing App mirror completion was verified at `2026-10-05T00:30:43+02:00`.
PR #11 remains draft against the compatible Development base.

Historical local PDF OCR is restored under `services/local-ocr/`, adapted
without granting source rights or semantic/privacy authority. SHA-256 is
computed from actual received bytes and must match the declared original.
Existing n8n transport source ID/name/mime fields are retained but are not
provider-authoritative metadata. Unknown source metadata fails rather than
inventing an ID/name. There is no raw document logging or persistent volume.

Maximum 20 MiB/20 pages, two concurrent requests, 120-second whole-extraction
deadline, 1,000,000 output characters. Exact page count is checked before
rendering; excess pages fail instead of silently truncating. All pages must
render and yield text, numerically ordered. English/German OCR models are
installed explicitly (the historical Dockerfile omitted the German model).
Malformed framing, duplicate Content-Length, wrong hash/type, incomplete
render/empty page/tool failure and saturation return explicit failures.

The actual synthetic container proof built and ran image
`sha256:db5b6647a13ccc0e6a077f9c00041776e95eb6430337a38cd7b5b1fdbea5a54c`.
It used `network=none`, no mounts/ports, read-only filesystem, user nobody,
no-new-privileges, ALL caps dropped, 128 PIDs, 1 GiB/2 CPUs and 256 MiB tmpfs.
Actual Poppler/Tesseract eng/deu extracted a self-generated PDF with exact
original hash. A 21-page PDF, wrong hash and malformed PDFs failed explicitly.
Owned test-container restart returned the same extraction, transient files
were removed and raw text was absent from logs. The uniquely named test
container was removed; no live n8n/App/Host composition was changed.

Native source SHA256:
`a1ac364d0554ae67ebb68f0c92982b9508f21a58317217143df01b0c16bfe9b5`;
Dockerfile SHA256:
`ae73ce5092680069c4d92b7bc61998c2a29f57060fb86d787019c43fb7b3c822`.
The Vitest suite executes isolated Python extraction/HTTP tests as well;
actual external-tool/HTTP/restart proof is `services/local-ocr/test_container.py`.
This is not full DMS privacy/source/empty-state PASS. Native private-network
wiring candidate is now present in the own Host worktree; immutable production
image pin, genuine provider/source/execution bindings, protected privacy receipt
and full native graph remain pending.

The own Host candidate adds only an opt-in overlay to existing native n8n
Compose invocation. Default behavior is unchanged. It requires an immutable
image ID, exact clean matching Component source commit, and image provenance
label; mutable/missing/mismatched/dirty source and unlabelled images are denied.
The fixture image above has no committed-source provenance label and is
**not deployable** through that gate. A build labelled with the actual tested
committed Component source is required before any future activation.
Native n8n API/internal connections remain, with only a dedicated internal
OCR network added; OCR joins no other network, publishes no host ports and
has no persistent mount. Native Host tests/static contracts pass.
Actual Docker Compose rendering used n8n base
`24de6248f13b5fc250482dc8c3b3ef483c91cb55`, proving every existing n8n
field, volume and connection unchanged except the added private network.
An initial fixture assertion compared Compose's string memory size with a
number; the assertion was corrected to verify the exact numeric byte limit
and rerun PASS. No production config or network was changed.
Stable full Component gate passed typecheck, lint (warnings only), docs,
infra, **572 files / 9,270 tests PASS / 40 skipped**, and client/server build.
The 16 Python extraction/HTTP tests are executed by the Vitest wrapper.
A subsequent standalone repetition exposed a fixture race: the client can
receive the error body just before the server's finally releases its semaphore.
The assertion now waits at most two seconds for each released slot and cleans
any acquired slots in finally. All 16 tests then passed five consecutive runs,
the Vitest wrapper/inventory subset and final docs/infra passed again.
No production behavior was changed to hide that race, and the failed
standalone fixture is not counted as PASS.
The tested Host overlay is committed/pushed/mirrored at
`c1a25fefd9934424d4023ad5ead12004d18007a8`, immediate mirror completion verified
at `2026-10-05T00:45:13+02:00`. Canonical prior DMS Host head `5cfd749` was
verified a strict ancestor of the compatible `85dbb722` base before pushing;
there was no competing branch history or forced update.
Credential scan passed across 2,463 source/evidence files plus browser assets
and runtime logs. Missing PowerShell and the 40 existing skips are not
claimed as runtime gates. Full DMS remains NOT_DEPLOYED/IN_PROGRESS.

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

### Stable source identity and bounded local pseudonymization

The real native n8n envelope already separates stable `source_ref` from the
provider-version/attempt transport `idempotency_key`. The Intake Registry
mapping and protected Parent ACK readback instead keyed on idempotency.
They now consistently use valid explicit `source_ref`, retaining the legacy
transport-key fallback only when the field is absent. Empty/non-string/
oversized/control-character explicit identities fail, never silently fall back.
Different delivery submissions for one source retain the same Registry key and
Case manifest identity. Business request/revision update remains separately
protected; a source revision does not authorize a new Case or replace inputs.
Actual native mapping/Case/Parent adapter/API tests pass 82/82.

The historical offline pseudonymization source was inspected at 7123.
Its highest-score non-overlap selection could leave the uncovered tail of an
overlapping lower-score finding visible. `src/lib/privacy/pseudonymize.server.ts`
restores that one bounded local transformation with complete interval-union
coverage and exact Presidio/Python Unicode code-point offsets instead of
JavaScript UTF-16 slicing. Low/zero-score/unknown/whitespace findings are all
covered; malformed findings, partial results, invalid Unicode, out-of-bounds
spans or resource overruns fail the whole operation.
Tokens use random per-invocation namespaces with exact local reuse, not stable
cross-document IDs. Raw-to-token maps are neither returned nor logged/persisted.

This helper is not a detector, privacy receipt or ELIGIBLE decision. Empty
findings do not prove complete coverage. The unsafe historical endpoint
fallbacks, category claims, sensitivity thresholds/defaults and authority
setter were not restored. The capability is not exposed to clients/tools or
activated in a live graph. Native routing, Case, Approval, traces and provider
authority remain outside it; complete protected detector/source/rights/
coverage evidence and L19 trace/checkpoint retention gates remain incomplete.
Twenty-three actual-body transform tests pass, including 500 deterministic
overlap permutations comparing all visible output against the exact complement
of the original covered code points. The combined focused gate passes 105/105;
changed-file lint, docs/commands and actual three-repository credential scan
pass (2,503 files). The historical helper signature is not blindly retained:
its unused database/owner arguments implied persistence/authority this bounded
transformation does not possess. No current caller depended on that missing
historical signature.
The initial full Component gate correctly rejected the old Parent adapter
inventory hash after the stable-source fix. The inventory now binds the actual
validated source bytes
`b33c29732d5534cba2cf5ae87e25bf1f9ae53c32c7fb71d5fb299c97ebb859e5`;
the source/hash check was not disabled. The combined targeted Inventory/
Intake/Case/Parent/pseudonymization gate passes 108/108.
The corrected full Component gate passes typecheck, lint, docs/commands,
infrastructure checks, 575 test files / 9,342 tests (40 skipped), and the
production build. Actual isolated Work, Approval, current-proposal and Registry
SQL suites plus 16-session Work/Registry/Local Table concurrency and readback
also pass. Production still runs exact App `10df3a869c5dcb6c377840ca7a048a87d1aa4c6f`
and image `sha256:1f3e476e524674df9f5cd1333eab35da1e0d6f370b1435caf4bfdff49449769a`;
this source gate is not a DMS deployment or independent acceptance.

The native Drive emitter is now persisted in n8n commit
`5a90b70825c983e283fe9374d30404a49743472c`, immediately mirrored at
`2026-10-05T02:08:59+02:00` and read back in the same draft PR 2.
Its existing deterministic original-byte crypto/extraction path now emits
business request, delivery and exact provider revision. Missing or malformed
provider decimal-string version/original lowercase SHA-256 fails before
dispatch. Scheduled initial intake is one request `drive-intake:<file-id>`;
version changes distinguish delivery, not new business requests or source.
Explicit independently accountable request IDs also scope transport keys;
invalid explicit values never fall back to initial intake. The protected Case
still rejects changed immutable input, pending proper revision advancement.
All Case-bound ACKs must match the paired original source before transport
handling; ordinary legacy output compatibility is retained.

The complete native n8n suite passes 139/139. Actual synthetic cross-repository
execution proves generated Drive envelope → native Intake Registry mapping →
minimized Case request, exact original hash/revision, replay, source/request
stability across versions and distinct explicit-request idempotency.
No original document text enters the derived Case request. Provider node
operation/credentials/topology/settings/inactive state remain unchanged;
regeneration is byte-idempotent. Mail equivalent source provenance, genuine
provider authority, protected privacy/receipts and live graph remain pending.

### Bounded standard local analyzer recovery

The accepted historical Privacy/Presidio recovery scope is adapted at
`src/lib/privacy/piiDetection.server.ts`; native sequencing and Case authority
remain outside this one standard external capability. The historical source
tried fallback endpoints, omitted an explicit zero score threshold and silently
discarded malformed findings. The recovered boundary requires one explicitly
configured internal `presidio-analyzer:3000`, explicit `en`/`de`, actual
language-specific supported-entity readback before transmitting original text,
and fixed per-request German recognizers. The standard upstream REST routes
were verified against `microsoft/presidio`, `presidio-analyzer/app.py`, source
blob `567a796cd016da2b7e4dd961483087906515c5ec`.

All findings are validated together with the shared Unicode-code-point/span
validator; no bad/low-score/unknown finding is filtered away. Unknown labels
become generic PII, and unrequested metadata/explanations are not returned.
The passport pattern explicitly repairs the historical eight-digit suffix
restriction to the documented full alphanumeric shape; these coarse patterns
still do not prove complete detection. The analysis request sets zero score
threshold, no exemptions and no decision explanation.

Transport has one total eight-second deadline, including validation, a strict
actual-byte response cap, UTF-8/JSON validation and rejected-body cancellation.
There is no redirect, retry, fallback, logging, persistence or raw-error cause.
This is not a new detector service, native tool registration, privacy setter,
source/rights receipt, ELIGIBLE decision or full R7 PASS. Actual immutable
analyzer image/model/private-network/logging evidence and protected Case
binding remain mandatory before live use. Production and provider settings
remain untouched.
Fifty-five actual-body/transport tests pass, including actual HTTP redirect
rejection, both deadline-validation stages, rejected-body cancellation,
multibyte streaming and an actual stalled response aborted at 8.006 seconds.
Shared pseudonymization and byte-exact inventory tests give 81/81 PASS;
changed-file lint and docs/commands pass. These are isolated API fixtures, not
a genuine Presidio/model/private-network runtime acceptance.
The first full gate correctly rejected the new endpoint variable missing from
operator documentation. Its strict documentation-discovery test was not
weakened; the existing self-hosting configuration page now documents the
explicit endpoint and unfulfilled live-use gates. The failed run is not a
deployment gate PASS.
That documentation change also required the existing generated search index:
`npm run docs:index` regenerated it, and strict docs/commands plus actual
freshness/inventory tests pass. Neither rejected run is counted as a full
source gate. Fresh read-only production fences still show one auth principal,
one suspended Development run and no running Swarm writer, 278 migrations,
and unchanged Development App/Host/MCP source heads.
The subsequent full run exposed an unbounded await in native response-body
cancellation under the stalled-stream test. The eight-second assertion and
15-second test budget were not relaxed. Fetch, stream reads and cancellation
now explicitly settle against the same deadline, including transports that
ignore abort signals; 57 actual-body/HTTP tests and all 23 transform tests pass.

Actual standard-image evidence was then executed with pinned
`mcr.microsoft.com/presidio-analyzer@sha256:d459416c39345b60b72050a98aeef6be4f6b3d9da20e5ba9561e8b920f9abedb`.
The owned ephemeral fixture is non-root user 1001, network none, read-only root,
no published ports, 1 CPU/1536 MiB/no additional swap, bounded PID/log/tmpfs.
The exact adapter and transform run through real Docker-exec HTTP transport,
not a fabricated analyzer response. All ten requested labels fire on positive
English fixtures, and repeated proof after isolated restart passes with zero
generated original marker in logs.

The initial real-image assertion also exposed genuine negative evidence:
stock analysis misses the structural `example.invalid` email, and German
language is unsupported. The versioned probe
`tests/integration/documentPiiAnalyzer.mjs` retains that uncovered-marker
counterexample and verifies German rejection before text transmission.
Six reported entities are not a complete coverage receipt. This image is
isolated evidence only, not an accepted real privacy profile or live pin.
No ELIGIBLE, full R7, production deployment or independent acceptance is claimed.
The final unweakened Component gate passes typecheck, lint, docs/commands,
infrastructure checks, 576 test files / 9,399 tests (40 skipped), and the
production build. The focused corrected docs/inventory/analyzer/transform
gate passes 91/91. Actual three-repository credential scan passes across
2,506 source/evidence files, browser assets and runtime logs.
Only the owned temporary analyzer container was stopped/removed after
isolated restart proof; its immutable image and minimized evidence remain.
No production service/network/config, DMS migration, native key or workflow
was activated. Full DMS remains IN_PROGRESS/NOT_DEPLOYED/ACCEPTANCE_PENDING.

### Privacy-token recognition compatibility

The newly restored transform emits random invocation-scoped tokens. The
existing pure recognition normalizer understood only legacy numbered tokens,
so existing characteristic conditions could never match those fresh frames
and their namespaces would remain in normalized features. Its existing seam
now reduces exactly the nine emitted token categories to generic type
placeholders, preserving legacy behavior and leaving unrelated/malformed
frames alone. It retains neither namespace, sequence nor raw identity.

Fifteen actual recognition tests plus 23 transform tests pass (38/38), including
real transform output for every category, two distinct source values/namespaces
normalizing identically, cross-invocation legacy-condition matching and malformed
frames. Existing compatibility sample rules remain unseeded; no classifier,
policy, feedback path or Learning activation was added. Source inventory binds
the exact new normalizer bytes; bounded fuzzy/evaluation budget and the full
append-only Learning contracts remain unfinished.
The full Component gate for these exact recognition bytes passes typecheck,
lint, docs/commands, infrastructure checks, 576 test files / 9,410 tests
(40 skipped), and production build. Focused byte-exact inventory/recognition/
transform tests pass 41/41; actual credential scan remains PASS (2,506 files).

### Bounded deterministic recognition workload

The recovered pure recognizer used unbounded whole-text Levenshtein work and
re-normalized the complete text per condition. It now normalizes input once
and preflights the complete active manifest before ordered matching. Explicit
limits bound input/rules/conditions and aggregate exact/fuzzy work. Invalid
operators/connectors/modes, blank/oversized conditions and nonfinite/out-of-range
deviations fail explicitly instead of creating a false positive or implicit
semantic fallback. Ordered AND/OR and valid existing rule behavior remain.
Inactive rules remain inactive; no seeded policy or arbitrary quality threshold
was introduced.

Thirty-six recognition tests plus 23 transform tests pass (59/59), including
the exact two-million-cell boundary and one-cell-over rejection, aggregate
work refusal even after an earlier matching rule, independent exact scan cap,
rule/condition/text thresholds and invalid active manifests. This is a bounded
deterministic capability, not the full Learning/evaluation/acceptance package.

### Append-only native minimized feedback

The first real Learning prerequisite now extends the same authenticated
`/api/cases/work`, strict Document Work adapter, native `axtn_case_document`,
owner-bound logical Datasets and native audit. It is not a new Case/state
service, scheduler, learner, acceptance authority or workflow. The existing
Human Case panel uses those exact schemas and server guards for confirmation
and explicitly predecessor-bound correction, including without an LLM or
running Swarm orchestrator.

`document-feedback-v1` binds Case/Attempt/Input, exact provider SourceRevision,
current immutable DecisionID/Revision, minimized before/after family/target
identifiers, reason code and canonical Evidence references. Server identity,
timestamp, revision and verification authority are not client fields. Only a
real authenticated current Human may confirm/correct; machines may submit only
explicit UNVERIFIED observations. No original body/filename, free-text reason,
arbitrary URL, client owner/verified/approved flag or prompt is accepted.
This records minimized metadata for NO_AI Human work without enabling its
semantic processing, Learner/Judge or independent Acceptance.

Feedback is append-only. Same-ID conflicting content fails. Exact replay and
content duplicates with different IDs/reordered/repeated Evidence return the
canonical original row without another audit. Corrections require a verified
predecessor, exact before/after continuity and one successor; UNVERIFIED cannot
supersede confirmation. Current Decision/Attempt/Input/Source drift forbids
new events; immutable readback remains possible. No Case/Decision/privacy/
provider state is changed. Same owner advisory lock and native unique keys
serialize events. The returned canonical feedback ID must be used by successors.

Additive migration `20261004140000_document_feedback.sql` extends existing
Dataset/Row/LocalTable bypass guards; delegates remain private. Actual direct
service-role writes/deletes/metadata renaming and generic LocalTable mutation
are denied, while the registered native RPC works. Postgres retains its
existing administrative fixture authority, not new client permission.

Actual isolated SQL/role fixtures pass, including foreign owner, forged
machine confirmation, stale Attempt/Source/Decision, invented assignment,
unminimized/extra fields, replay after drift, immutable correction chain and
no lifecycle mutation. Actual independent service-role sessions prove
16-way event dedup, 16-way correction dedup, eight competing successors denied,
new-session findability and exactly two events/audits. Migration 6 also installs
atomically on a separate isolated five-migration baseline with empty feedback
storage; all existing Work/Approval/current-proposal/Registry suites and
Work/Registry/LocalTable concurrency remain passing.

Thirty-eight validator/service/readback tests and 11 actual API handler tests
pass; combined Work/recognition/inventory gate passes 117/117. Changed-file lint
and TypeScript pass. Early SQL syntax/variable-ambiguity and lint defects were
fixed only in own unapplied source/isolated fixtures, not deployed migrations.
No failed gate was reported as success. The full exact combined candidate
gate passes typecheck, lint, docs/commands, infrastructure checks, 578 test files
/ 9,480 tests (40 skipped) and production build. Actual credential scan passes
across 2,513 source/evidence files, browser assets and runtime logs.
Additional actual native machine-key fixtures confirm UNVERIFIED remains
unverified, confirmed events are denied, and lost Case scope/expiry/revocation
also deny immutable replay. Their protected privacy fields are explicitly
privileged synthetic receipt fixtures, not proof of a real privacy setter.
Production still has 278 migrations, one auth principal, no running Swarm and
the same suspended Development run. App `10df3a869c5dcb6c377840ca7a048a87d1aa4c6f`
and immutable image `sha256:1f3e476e524674df9f5cd1333eab35da1e0d6f370b1435caf4bfdff49449769a`
remain healthy; Development App/Host/MCP heads and own Host/n8n worktrees are
unchanged. No production migration, key, workflow or provider change occurred.

This is not complete Learning: the following increment adds inactive Improvement
Candidate Child creation; privacy-gated side-effect-free evaluation/splits/metrics, immutable disabled
policy, quality promotion, review/PR handoff, provider FilingReceipt and actual
Human UI/restart acceptance remain unfinished. Same implementation Cases stay
OPEN/NEW according to dependencies, with no false prerequisite completion.

### Native inactive Improvement Candidate increment

Source follows committed App `422e0fa4cc1ebe5407c64cdd5f8d50fe3215ba3a`
on the same own DMS worktree/branch. The full revision-0.5 request, DMS HANDOFF
and current AGENTS were reread. Canonical branch still matched 422 before edits.
No additional writer or runtime mutation was introduced.

The existing Case API/RPC, owner Dataset, advisory lock and audit now register
`document_candidate`/`document_candidates`. Strict inactive existing-rule
manifests, exact baseline/test-profile references, hypothesis/risk codes and
verified Feedback provenance feed one atomic NEW
`DOCUMENT_IMPROVEMENT_CANDIDATE` Child and one immutable artifact. No new control
plane, Workflow sequencing, Approval, policy activation or provider effect.
Server identity/time/revision, protected ELIGIBLE revision, current worker,
Input/Source/Decision pointer, confirmed family/target and terminal feedback
agreement are checked. NO_AI/UNRESOLVED, unverified/superseded/conflicting feedback,
forged authority and stale revisions fail without state/audit mutation.

Verified historical feedback remains usable across a responsibility/Attempt
change only with the same current Input/Source/Decision. Stable hypothesis dedup
excludes CandidateID and responsibility dimensions, preserving the same Child
without rewriting its original author. Exact immutable replay is readback-only
after drift; logical aliases must still pass current gates. Returned canonical
Candidate/Child IDs and revision are authoritative, not assumed request IDs.

The existing Human Case panel creates and lists these minimized records using
the shared validators/API. It never auto-selects a ground-truth assignment or
activates a policy. Actual production UI/restart acceptance is not claimed.
Pattern existence/revision/index resolution and baseline/profile semantics
remain evaluation obligations, not authority inferred from format-valid refs.
Direct authenticated/service Row/Dataset writes, marker omission, LocalTable
overwrite and private delegate access are denied.

Focused source evidence: 43 Candidate validator/service/readback tests and
10 actual shared API handler tests in addition to the unchanged 11 feedback
handler tests. Actual isolated PostgreSQL concurrency runs sixteen independent
service-role sessions, lost-response/new-session readback and exactly one NEW
Child/artifact/audit. Responsibility handoff reuses that Child; real scoped
machine-key loss/expiry/revocation deny even recovery. Synthetic privacy fields
are explicitly privileged fixtures, not a coverage/live privacy setter proof.
The test also proves confirmed-tip conflict/supersession, NO_AI/UNRESOLVED,
privacy/Decision drift and preserved parent state.

Initial rerun found four own auth-bootstrap deletion audits after cleanup;
cleanup now deletes only its owned synthetic auth/Swarm/key rows before the
final audit cleanup. All concurrent sessions settle before cleanup. The final
fixture reruns pass with no leftover fixture principal or business Case.
The initial new API-test placement was corrected after measured counts showed
they were not registered; all ten new tests now actually run (21 handler tests).
The Human panel's initial unknown-input type error was corrected using the same
strict manifest parser, not a cast.

Production remains healthy App `10df3a869c5dcb6c377840ca7a048a87d1aa4c6f`,
image `sha256:1f3e476e524674df9f5cd1333eab35da1e0d6f370b1435caf4bfdff49449769a`,
278 migrations/latest `20261004060000_native_work_approval_binding.sql`.
Development App/Host/MCP heads remain 6bf776e/85dbb72/6e18b49.
No production migration, key, Swarm, provider, Host or local MCP change.
Full recovery/evaluation/disabled policy/receipts/minimized persistence,
native graph convergence and independent Acceptance remain unfinished.

Final Candidate validation: canonical `npm run check` passed typecheck, lint
(zero errors), documentation/command/infra gates and all 579 test files,
9,533 tests with 40 skips. Its SSR build was terminated; direct trace confirmed
exit 137 and the existing shared user cgroup reported OOM kills. Lowering the
heap to 3,072 MiB exposed an explicit V8 heap exhaustion rather than fixing it.
The identical production Vite build then completed client and SSR successfully
with process-only resource parameters, without repository build/config changes:
`MALLOC_ARENA_MAX=2 node --optimize-for-size --max-old-space-size=3584 --max-semi-space-size=8 node_modules/vite/bin/vite.js build --sourcemap false`.
This is a successful resource-bounded build plus the complete preceding gates,
not a claim that the original uninterrupted `npm run check` exited zero.
No shared service was stopped or memory/network/provider configuration changed.

Final migration bytes were installed atomically from a clean six-migration
isolated baseline into `dms_native_contract_candidate_final_20261005`.
Candidate concurrency/roles and all existing Work/Approval/current-proposal/
Registry/Feedback SQL suites passed. Existing Work, Registry and Feedback
concurrency also passed with migration7. Final Candidate fixture cleanup read
back zero owned auth users, datasets, audits, Swarms and keys. Actual protected
credential scan passed across 2,518 own source/evidence files. Production
remains healthy on the exact prior image with ledger278.

### Side-effect-free evaluation basis increment

The prior native Candidate increment is committed as
`35c4af8495a1ad7f7cb2c3889b2834f545f9bac5`, canonical-pushed and immediately
mirrored at `2026-10-05T04:58:14+02:00`. Draft PR11 and the same OPEN
Parent/Inventory/Case Children carry its exact source/Host/n8n/PR/Evidence
references. No prerequisites were falsely closed to start a Learning Child.

The deterministic evaluation basis reuses the existing native recognition
function and shared classification metrics. It compares only bounded numeric
feature projections, exact existing rule revisions and held-out test partitions.
Both template and business-request groups are fenced across three independent
splits; dataset/split fingerprints reflect actual input. No original text/new
condition literals, code/prompts, authority flags or enabled policy fields.
NO_AI/UNRESOLVED, denied rights inputs, scope drift, unverified feedback revision
and original-content injection are rejected before recognition.

Thirty-two executed fixtures prove actual fuzzy improvement, severe wrong target
despite perfect family score, real family regression, unknown-family abstention,
source/identity/revision/split/condition fences and zero logging/effects.
Aggregate work tests execute 19,939,168 fuzzy cells and reject 20,050,560 before
recognition. An initial comparison treated elimination of an abstention-only
predicted category as regression; the real fuzzy-improvement test exposed this
and the gate now compares actual-family populations.

Output is minimized to references/revisions, descriptive per-family counts,
precision, correction/exception rates, severe targets, coverage, abstention,
estimated Human interactions, local elapsed time and zero model/provider calls.
Existing macro-F1/accuracy are family-only; assignment precision checks target.
Null cost/zero-denominator precision are explicit. Wilson intervals are labelled
unadjusted for within-split group correlation and are not promotion confidence.
Verdict is FAIL or REVIEW_REQUIRED, never PASS. All output carries
`UNATTESTED_MINIMIZED_INPUT`/`promotionAuthorized=false`; format-valid privacy/
rights/source/evaluator claims are not protected receipts or actual Git loading.

This increment adds no API, Dataset, Case/Approval mutation, scheduler, policy
activation, provider call or live runtime wiring. Protected vocabulary/features/
privacy/rights loading, native immutable EvaluationEvidence/recovery,
independent review/PR handoff, disabled policy and FilingReceipt remain pending.
Source-only comparison is not full Learning, DMS recovery or Acceptance.

Final ordered validation passed on these exact source bytes: typecheck, lint
(zero errors; existing 235 warnings), docs/Markdown/command/infra checks,
580 test files with 9,565 passing tests and 40 skips, then successful client
and SSR production build. The build uses the previously verified process-only
memory parameters documented above; repository build scripts are unchanged.
Infra reports one existing missing-tool skip. No failed gate is reported as PASS.

### Native append-only descriptive Evaluation persistence increment

Prior side-effect-free basis is committed as
`9b91638612eb287a0eddd72d7837f2000883125d`, canonical-pushed/mirrored and
bound to draft PR11 and the same OPEN implementation Cases.
This increment extends the same Case API/RPC/Human panel and native owner
Dataset/audit. It stores strict minimized Evaluation reports append-only,
binding exact Candidate revision/baseline and existing Improvement Child,
current source/worker/Attempt/Input and revalidated native Candidate privacy/
Decision/verified Feedback gates. No new orchestrator or authority.

All reports remain `UNATTESTED_MINIMIZED_INPUT`, FAIL/REVIEW_REQUIRED and
`promotion_authorized=false`. Internal count/rate/gate/verdict consistency is
validated by shared schema and SQL independently. Descriptive caller metrics,
source/dataset/evaluator reference syntax and input claims are explicitly not
an independent evaluator receipt, protected feature loader, quality threshold
or privacy authority. Original/sample/feature/prompt payloads are not stored.
Creation/replay do not start/promote the Child or change source effects.

Thirty-five executed validator/service/readback tests and four actual shared
API readback tests prove owner/hash binding, strict authority/leakage guards,
minimized count/gate consistency and native errors. Actual sixteen-session
SQL fixtures prove one report/audit, immutable response-loss recovery and current
Candidate/Child binding. Direct authenticated/service Row/Dataset writes,
marker omission, LocalTable overwrite, foreign owner and real key scope-loss/
expiry/revocation are denied. Exact authorized replay survives privacy drift;
new reports fail. Timing and repeated/reordered Evidence cannot duplicate reports.

The actual recognizer/comparison is also executed against the same owned native
Candidate and its numeric fixture, persisted through the native RPC and read
back after a lost response. Its measured fuzzy regression remains FAIL, never
invented PASS. No samples/features are copied into stored report. Synthetic
protected privacy fields are privileged isolated fixtures, not live coverage.
Initial migration8 syntax failure was transactionally rolled back in the own
isolated DB; corrected CASE parentheses applied successfully without partial
schema artifacts or production changes.

Existing native Work/Approval/current proposal/Registry/Feedback SQL suites pass
with migration8, including a clean final eight-migration install. Complete
ordered canonical typecheck/lint/docs/command/infra/full-unit gates pass:
581 files, 9,604 tests PASS, 40 skipped. The unchanged production client and
SSR build passes with the process-only resource bounds documented above;
no repository build script was changed. These counts cover this persistence
increment, not the subsequent isolated disabled-policy work in progress.
Owned fixture auth/Dataset/audit/key counts return to zero.
Full live semantic recovery, protected feature/privacy/source
loading, policy/effects/receipts, minimized checkpoints, production convergence
and independent Acceptance remain unfinished.

### Native immutable disabled Automation Policy increment

Native Evaluation persistence is committed as
`fa7cd4ad557ca2d0658e8afbaf9f019b6b3ce459`, pushed, immediately mirrored and
bound to the same draft PR11 and three OPEN SupaCases. The following additive
source increment preserves the same Case API/RPC/Human panel/native Dataset/
audit and creates only permanently disabled, unapproved CLASSIFY drafts.
It adds no activation pointer, new state machine, independent PASS, source
effect or authority to run/promote an Improvement Child.

Exact Candidate/Evaluation revisions, existing Child, source/Input, current
worker/Attempt and unchanged family/source/target/rule scope are bound server-
side and checked independently in SQL. All current native Candidate gates are
revalidated. A null QualityProfile is allowed for a disabled draft without
inventing a threshold; an exact profile reference does not grant approval.
All seven fail-closed triggers and explicit ordered validity are mandatory.

Thirty executed schema/service/readback tests and seven actual shared API
handler tests cover authenticated identity/hash, normalization, strict draft/
scope/authority/leakage boundaries and explicit native errors. Actual bounded
recognizer output is persisted as an unattested report and then sixteen native
sessions deduplicate one immutable disabled policy and initial audit. Real
scoped-key scope-loss/expiry/revocation, privacy/worker/revision drift and generic
role/broker overwrites fail. Exact authorized readback recovers after privacy
drift without allowing a new alias. A changed validity appends a new disabled
revision; missing Dataset metadata is reconciled without deleting an unknown
operator column. Own fixtures return to zero. Initial fixture UUID quotation
failure was corrected; final expanded native integration passes.

Migration9 is applied only to owned isolated policy DBs, never production.
A fresh final nine-migration install passes the expanded Policy fixture, actual
recognizer/report persistence, Evaluation/Work/Registry/Feedback concurrency
and all existing native Work/Approval/current proposal/Registry/Feedback SQL
role suites. Complete ordered canonical typecheck/lint/docs/commands/infra and
full-unit gates pass: 582 files, 9,641 tests PASS, 40 skipped. Unchanged
production client/SSR build passes with the documented process-only memory
bounds; no build script or live runtime was changed. These are exact measured
Policy-increment results, not inherited test counts or full DMS acceptance.
Protected feature/privacy/rights/evaluator authority, promotion/
activation/revocation and SCOPED_AUTO proof, FilingReceipt/effects, minimized
native checkpoints, full recovery/production convergence and independent
Acceptance remain unfinished.

### Minimized Parent input and compatible native registration increment

Disabled native Policies are committed at
`0a4913efd4097255101dbcb62be5f38c4213681a`, canonical-pushed/mirrored and bound
to draft PR11 and the same three OPEN SupaCases. An existing mirror concurrency
race already had the exact target ref; retry through the same configured mirror
completed with cleared error, without changing mirror settings or forcing refs.

The following source increment minimizes headless Parent run input to strict
owner-scoped business/delivery/source/revision hashes, source/content/privacy
metadata and the same InputHash. Original text/attachments/filenames/provider
secrets and raw identifiers are omitted. Existing protected Case/Registry
readback supports legacy/minimized/mixed registration ACKs and rehydrates the
same public ACK only after exact owned current bindings are checked.
Same-run DMS resume is owner/Parent-bound and failed trace persistence is
explicit, not a silent success. Generic/Development tracing and global
opt-out behavior are preserved; safe DMS technical metadata remains available.

Minimized run input exposed the tightly coupled Filing preparation identity
dependency. The actual resume handler now uses the existing immutable native
Approval's Document/Intake Case binding and the same existing Case validator,
not guesses from prompt fields. It neither invents another Case nor treats
READY_FOR_FILING as source effects or independent Acceptance.

Thirty-three executed codec tests, twelve additional minimized parked
registration tests, eleven actual constructor tests and six actual native
resume-handler tests pass. Eight focused suites total 115 tests PASS, including
existing Parent API and generic tracing/resume regressions. One preexisting
source-string assertion on update formatting was adjusted and paired with a
real generic-resume exact-payload test; no behavioral test was disabled.
The final ordered source gate passed: typecheck, lint (existing warnings only),
documentation/command/infra checks, **585 files / 9,703 tests PASS / 40 skipped**
and unchanged client/SSR build with the previously documented process-only
3584 MiB/8 MiB-semispace/arena limits. The separately executed actual isolated
PostgreSQL hash-parity integration also passed for canonical UUID casing,
NUL framing, quotes, escaped references, UTF8 and foreign-owner separation.
This proves algorithm parity, not protected source/privacy authority.

This is not a full original-free runtime claim: remaining step/model/tool and
browser/direct-write surfaces, all checkpoints, API/callback/cache responses,
historical retention and original-free resume hydration still require work.
Actual isolated full native runtime persistence proof is pending.
Production/Development/local MCP and existing providers
remain unchanged; full DMS restore, effects/receipts, protected rights/privacy/
evaluator and independent Acceptance remain incomplete.

### Scoped headless Parent trace-body increment

Minimized ingress is committed at `e7eebda4` and bound to the same draft PR11
and three OPEN SupaCases, with canonical push/mirror completion verified.
The next bounded extension uses that same source-defined Parent identity in
the existing native headless tracer. It omits step inputs/outputs, tool
arguments/results, edge previews, final bodies and free-form errors while
retaining technical status, topology, provider/model, token/latency/cost/byte
metadata. Generic/Development and global opt-out behavior remain unchanged.
No graph sequencing, model/provider configuration, Case authority, checkpoint,
native Approval routing or production state is changed.

Native DMS trace persistence/recovery failures are explicit content-free errors
rather than swallowed failures or raw database-error logging. The existing
two-attempt final-close behavior remains unchanged. An executed retry-count
fixture caught an early failure check preceding the existing retry; corrected
placement and the actual two-write assertion now pass.
Four focused suites pass **78 tests**, including 20 actual tracer tests;
typecheck and targeted lint pass. Final ordered typecheck/lint/documentation/
command/infra/full-unit gates and unchanged resource-bounded client/SSR build
passed: **585 files / 9,712 tests PASS / 40 skipped**. One existing tool-retention
source-string assertion was updated to the scoped conditional; actual generic
tool-body preservation remains exercised, not disabled.
This is only headless Parent trace protection, not full L19: child/canvas,
direct database writers, separate model traces, checkpoints, callbacks/cache
and historical retention still need protection and actual runtime proof.

### Native Parent trace storage-barrier increment

Headless trace protection is committed at `ff5966c2`, canonical-pushed/mirrored
and bound to draft PR11 and the same three OPEN SupaCases. A new additive
`20261004180000_document_parent_trace_bodies.sql` (SHA256
`213797240197c09e691d41d34a6954868b047e4df87ab922372716436bdf50ae`)
now protects the same Parent's step/edge and final/error bodies at their
existing native tables, including authenticated/browser and service-role
writes. Thinking/memory/RAG/extraction step bodies are also omitted. Persisted
Parent identity/owner governs the profile, not caller privacy flags; rebinding
run/owner or moving rows into/out of protection fails. Parent row locking
retains classification across concurrent writes. The function is private.
No second store, orchestrator, Approval or Case authority is introduced.

Actual fresh isolated native clone `dms_native_contract_trace_20261005` adds
this tenth migration to the exact empty nine-migration Policy basis. Executed
role tests prove marker exclusion, owner/rebinding denial and preserved generic,
technical and graph metadata. Sixteen independent native writer sessions and
new-session readback preserve 16 steps/16 edges and exact token/byte totals
with zero leakage markers; sixteen attempted Parent-identity downgrades fail.
The existing Work/Approval/current-proposal/Registry/Feedback SQL role suites
also pass against this exact schema. Expanded service/browser insert/update,
foreign step/edge owner, owner/run/row rebinding and generic-to-Parent denial
fixtures pass. All six existing native concurrency suites and actual bounded
recognizer-to-report and report-to-disabled-Policy integration pass, including
scoped key expiry/revocation and immutable response-loss recovery.
Full lint/documentation/command/infra/unit gates pass on this database-only
increment: **585 files / 9,712 tests PASS / 40 skipped**. Inventory exact-byte
tests pass 3/3 after the new dependency was added. The unchanged TypeScript
and client/SSR build were already verified at the preceding `ff5966c2`;
this SQL/docs increment did not rerun the build. Missing PowerShell remains
an explicit infra skip, not runtime evidence.

This is a narrow write-time barrier, not full L19: raw historical records are
not rewritten/deleted, ingress/snapshots/checkpoints unchanged, and child/
model/cache/callback protection and original-free resume remain incomplete.
Production migration ledger/config/image/Development/local MCP remain unchanged.

### Native Parent-correlated model trace storage increment

Parent step/edge storage protection is committed at `bfd0dd4c`, pushed/mirrored
and bound to draft PR11 and the same three OPEN SupaCases. Additive migration
`20261004190000_document_parent_model_trace_bodies.sql` (SHA256
`44ad2cc8485f439fe4f85eec5d566ec65762112ecf0b5c1702c8c024fae17dfb`)
now minimizes existing native model traces whose `decision_id` matches the
persisted owned Parent run. Explicit request/response markers, null prompt,
empty tool events and bounded errors preserve real model/provider, latency,
tokens/cost and cost-scope columns. Trace identity/owner cannot be detached or
rebound into/out of protection. A protected stored marker also prevents
body reinjection after its Parent run has been deleted. The guard is private,
not a new persistence, orchestration or privacy/source authority.

The fresh isolated native eleven-migration clone
`dms_native_contract_model_trace_final_20261005` passes actual auth/browser and
service-role insert/update, forged owner, identity/detach/rebinding,
deleted-Parent protection and exact generic/technical behavior tests.
Sixteen independent model upserts retain exactly one redacted trace with
tokens=7/cost=0.25; sixteen detach/injection attempts fail, with new-session
identity readback. Existing Parent body/concurrency and Work/Approval/current
proposal/Registry/Feedback SQL suites pass against this exact schema.
One initial fixture lacked actual auth rows and correctly failed its native
foreign key; proper isolated auth setup fixed the fixture, not the constraint.
The final fresh schema also retains typed estimated/missing/replayed pricing
flags, allowlisted price-source and numeric turn/image usage, keeping native
repricing/unknown-price semantics. Forged free-text/wrong-type usage fields
are excluded. The previous full regression run targeted the earlier iteration;
final exact-checksum source/native regressions also pass: all seven SQL role
suites, both trace concurrency suites, existing Work/Registry/Feedback/
Candidate/Evaluation concurrency and actual recognizer/report/disabled-Policy
integration. Full lint/docs/command/infra/unit gates pass **585 files /
9,712 tests / 40 skipped**, including exact-byte inventory checks. The unchanged
TypeScript/client/SSR build remains the preceding `ff5966c2` proof; no build
was rerun for this additive SQL/docs-only increment.

This is not full L19: nested model calls currently lose root correlation;
missing-correlated initial writes, separate gateway traces, logs/audit,
checkpoint context, callbacks/cache and historical retention still need work.
No production migration, provider/model/MCP setting or Development state changed.

### Existing native nested Parent provenance increment

The Parent-correlated native model storage increment is committed at
`88669444`, canonical-pushed/mirrored and bound to the same draft PR11/Cases.
The next bounded source fix carries that original DMS Parent run identity
through existing nested Execute-Swarm calls into the existing chat request
and scoped data-tool decision ID. Every nested call verifies persisted owned
Parent identity before effects; missing/read-failed identity is a content-free
error. No child run, decision, checkpoint, Case or orchestration is created.
Generic/Development nested behavior and provider/model settings are unchanged.

Actual two-level headless executor fixtures verify one top-level run/decision,
the captured real internal chat request, scoped tool/retrieve contexts and
explicit missing/error Parent denial. Model/tool replies are mocked; this is
source execution proof, not live privacy/provider or complete L19 acceptance.
Six executor fixtures and five focused suites pass **49 tests**.
Final ordered typecheck/lint/docs/command/infra/full-unit and unchanged
resource-bounded client/SSR build pass: **586 files / 9,718 tests PASS /
40 skipped**. One existing source-string provenance assertion expected the
old variable name; it now checks both `provenanceRunId` tool contexts, paired
with actual model/tool/retrieve/generic executor tests. No behavioral test was
disabled. These are exact measured candidate results, not live DMS acceptance.

### Strict same-run DMS checkpoint recovery increment

Nested Parent provenance is committed at `164d4b90`, pushed/mirrored and bound
to the same draft PR11 and OPEN SupaCases. DMS checkpoint read now validates
complete string context/output, routing arrays and integer level instead of
silently coercing invalid state to a legacy restart shape. Generic/protected
Development readers retain existing behavior. Database failures and missing
DMS state are explicit content-free errors. The existing Parent ACK reader
uses this same strict native checkpoint path.

Resume requires the owned Parent still suspended and validates its persisted
snapshot, Approval park, completed/skipped/dead-edge/level identity before
any tracing/effect. Valid state remains unchanged. The existing native executor
increments the cursor before storing suspension; an actual produced-checkpoint
roundtrip fixture fixed an initial validation assumption and verifies that
same cursor, one run/decision and preceding tool called exactly once.
Sixteen actual loader tests and eighteen additional actual resume fixtures
pass; five focused suites total **98 tests PASS**. A test group initially placed
inside fixture setup was corrected to module scope after measured discovery
counts exposed it; all 24 executor tests are now actually collected.
Final ordered typecheck/lint/docs/command/infra/full-unit gates and unchanged
resource-bounded client/SSR build pass: **587 files / 9,752 tests PASS /
40 skipped**. Exact-byte dependency checks pass 3/3. These are measured source
results, not live checkpoint/privacy/independent Acceptance.

This is no-repeat metadata validation, not privacy redaction. Raw checkpoint
context is still retained; protected hydration, all-surface L19, live restart,
provider/effect/receipt and independent Acceptance remain incomplete.
Production/Development/local MCP/provider settings are unchanged.

### Native canvas suspension-cursor compatibility correction

Strict checkpoint recovery is committed at `2ffffe0e`, canonical-pushed/
mirrored and bound to the same draft PR11/Cases. Follow-up source inspection
found the existing canvas writer stores its parked zero-based level, whereas
headless increments before capture. The initial exact-level guard accepted
only headless state. This tightly coupled compatibility defect is corrected:
both existing representations must match the actual persisted Approval level,
and all preceding levels still require completed/skipped identity.
No checkpoint rewriting, graph/cursor mutation or new restart behavior.

Actual resume tests cover the existing canvas cursor and the headless
produced-checkpoint roundtrip with no preceding tool repeat. Both focused
suites pass **40 tests**, with all 24 executor fixtures collected.
Final ordered typecheck/lint/docs/command/infra/full-unit gates and unchanged
resource-bounded client/SSR build pass: **587 files / 9,752 tests PASS /
40 skipped**. Exact-byte dependency tests pass 3/3.
The earlier `2ffffe0e` gate remains its own measured result, not evidence that
the correction is deployed or full L19/Acceptance has passed.

### Required native Parent checkpoint persistence increment

Canvas/headless cursor compatibility is committed at `7125916e`, pushed/
mirrored and bound to the same draft PR11/Cases. Every existing headless DMS
Parent level now requires native checkpoint persistence rather than allowing
best-effort gaps between Approval nodes. The strict write contract validates
complete state before storage; returned/thrown failures use content-free
errors, no raw database logging. Thrown read failures are similarly bounded.
Generic notifications and protected Development required failures remain.

Executed actual loader/writer tests cover native exact payload, intermediate
no-Approval checkpoint, invalid state before write, returned/thrown failures
and preserved generic/Development behavior. The actual executor stops before
later-level tool effects on an intermediate checkpoint failure. Five suites
pass **107 tests**, including 24 loader/writer and25 executor fixtures.
An initial rejecting thenable fixture omitted its reject callback and timed
out; fixed fixture now exercises the real throw path without unhandled errors.
Targeted lint passes. Final full ordered type/lint/docs/commands/infra/unit
gates PASS: **587 files /9,761 tests /40 skipped**, followed by unchanged
resource-bounded client/SSR build PASS. A first full gate was deliberately
stopped before a serialization-catch compatibility refinement, not reused as
final proof. Current protected-secret scan:2,437 source/evidence files PASS.

This is durable-error visibility, not atomic provider-effect recovery or
minimized context. Provider effect plus checkpoint failure still needs
revision-bound receipt/readback, not blind rerun. Full L19, privacy/rights,
effects/receipts/graph/runtime and independent Acceptance remain incomplete.
Production, Development and local MCP remain unchanged.

### Existing native DMS Approval resume claim ordering correction

Required intermediate Parent checkpoint persistence is committed/pushed/
mirrored at `0eaaa999`; same draft PR11/three OPEN Cases updated.
Source inspection found the earlier strict resume guard was incompatible
with the real Approval handler: it first claimed `suspended → running`, then
the executor required `suspended`. Existing synthetic executor-only resume
tests did not exercise this caller chain.

For DMS only, the same native atomic claim now occurs inside the existing
resume function after suspended checkpoint/snapshot/routing validation.
The handler retains persisted Approval authority and operation binding,
selects strict preliminary DMS reads by persisted Parent ID, and does not
claim twice. Invalid routing leaves the suspended run unchanged; missing/
failed claims return bounded errors before tracer/tool/model execution.
Development's existing handler claim/read modes remain unchanged.

Actual handler-through-executor tests cover valid same-run continuation,
invalid routing before claim, missing/failed claim, already-running denial
and unchanged Development behavior. These use synthetic database/Approval
authority, not real independent Acceptance or PostgreSQL concurrency.
Actual cancellation fixture additionally proves no checkpoint read/claim
after cancellation. Eight focused suites PASS: **85 tests**. The first full
gate found an old source-string cancellation assertion sensitive to the new
multiline load call; replaced with a whitespace-independent ordering check
and paired the actual cancellation fixture, without weakening cancellation.
Final full ordered type/lint/docs/commands/infra/unit gate PASS:
**587 files /9,768 tests /40 skipped**, followed by unchanged resource-bounded
client/SSR build PASS. Protected-secret scan:2,437 files PASS.

Fresh live readback still source`10df3a869c5dcb6c377840ca7a048a87d1aa4c6f`,
image`sha256:1f3e476e524674df9f5cd1333eab35da1e0d6f370b1435caf4bfdff49449769a`,
ledger278/latest`20261004060000_native_work_approval_binding.sql`;
3cancelled/9error/1suspended/no running Swarm. Development App/Host/MCP
heads6bf776/85dbb7/6e18b4 remain clean/preserved.
Production, Development and local MCP unchanged; remaining
L19/effect/rights/graph/runtime work not complete.

### Existing native Canvas strict checkpoint binding

Resume-claim ordering is committed/pushed/mirrored at `ad0be116`;
same PR11 and OPEN Cases retain that exact candidate.
The existing Canvas Approval function now determines strict DMS checkpoint
mode from the persisted authenticated owned Parent. No client flag or prompt
can select the profile. The native context/cursor remain unchanged; failed
checkpoint persistence prevents the suspension status write. DMS suspension
storage errors are content-free, Development's prior required boolean/errors
remain unchanged.

Nine actual Canvas handler fixtures plus writer/resume regressions pass
**65 tests**; targeted lint passes. Final full ordered type/lint/docs/
commands/infra/unit gate PASS: **588 files /9,777 tests /40 skipped**;
unchanged resource-bounded client/SSR build PASS. Protected-secret
scan:2,437 source/evidence files PASS.
Mocks prove wiring/order, not live roles, reviewer authority or atomic
Approval/checkpoint/effect persistence. Original-free hydration and the
remaining complete assignment remain pending; no runtime mutation.

### Suspended native output transport minimization

Canvas strict-write binding is committed/pushed/mirrored at `9ec31df4`.
An existing immediate/scheduled mirror ref race reported rejection although
the target already held this exact SHA. Retried only the existing sync;
completion09:34:42+02 with empty error, PR11/same OPEN Cases then updated.
No mirror settings or external repository architecture changed.

DMS Parent free suspended output is replaced with an explicit omission marker
in the existing pending cache, sync/async callback, legacy pending readback and
native continuation response. The same owned top-level registration ACK
and same pending run claim survive; no second execution or invented ACK.
Generic/Development output is unchanged. Terminal outputs/errors and raw
checkpoint contexts are intentionally not claimed protected by this increment.
Returned/thrown registration database read errors now carry bounded codes.

Five focused suites PASS **133 tests**, including actual API/cache/callback
leakage markers, legacy pending recovery, unchanged generic output, native
continuation and48 real readback fixtures. An initial helper was incorrectly
nested inside the JSON parser; actual readback tests caught it, corrected
module scope, no failure hidden. Targeted lint passes. Final full ordered
type/lint/docs/commands/infra/unit gates PASS:
**588 files /9,786 tests /40 skipped**; unchanged resource-bounded client/SSR
build PASS. Protected-secret scan:2,437 source/evidence files PASS.
No runtime/Development/local MCP change; complete DMS remains unfinished.

### Existing native API fail-closed DMS retry barrier

Suspended transport increment is committed/pushed/mirrored at `cc3c5f70`;
PR11/same OPEN Cases updated, completion09:50:36+02.
Inspection found generic API recovery automatically restarts failed records,
which may follow completed provider effects. DMS Parent now requires the
existing delivery idempotency header, checks its exact200char limit, and
refuses automatic takeover of failed/incomplete-result records or collided
claims. The error refers the caller to readback recovery at the same run ID;
no success-shaped result or new Case/run is fabricated.
Mismatch-before-recovery and generic/Development verdict/claim behavior remain.
Returned Parent read/claim failures and returned/thrown outcome write failures
surface explicit bounded codes; failed pending writes cannot return ACK success.

Actual API23 + generic verdict11 + registration48 tests PASS: **82 tests**;
targeted lint PASS. Fixtures cover exact200/201boundary, missing key, failed/
incomplete result, insert conflict/non-conflict error, read/write error,
generic failed takeover and generic no-key execution. An initial generic
no-key test incorrectly expected no key-last-used write; narrowed assertion
to the idempotency store while retaining actual execution check.
Read-only n8n source check finds existing header nodes:Drive2/IMAP1/Workspace1.
No n8n change, workflow publication or effect.

This is only fail-closed same-key prevention, **not** durable EffectKey/
FilingReceipt/current-rights/UNKNOWN provider reconciliation. Different
keys/deliveries and direct/canvas provider effects remain unprotected by this
API barrier. The exact inventory check initially caught a technical entry
referenced by name but registered only as an ID; aligned these source-only
entries with the existing named dependency convention, without disabling
the check. Final full ordered type/lint/docs/commands/infra/unit gate PASS:
**588 files /9,798 tests /40 skipped**; unchanged resource-bounded client/SSR
build PASS. Full assignment gate ledger added with explicit PARTIAL/PENDING/
BLOCKED states; documentation checks rerun PASS. Protected-secret scan:
2,437 source/evidence files PASS. Production unchanged.

### Native Local Table draft provisioning increment

The exact recovered Python definition now has an explicit native MCP Builder
draft seed: service-only migration
`20261004130000_document_local_table_seed.sql`, strict server adapter and
`seed-local-table.mjs` through the existing authenticated bootstrap-superadmin
endpoint. Both server and SQL independently require the byte-exact canonical
source hash. Owner comes from authenticated identity, never the request body.
Native random slug generation and the existing owner advisory lock retain one
app ID/slug across sixteen independent sessions and new-session replay.

Existing operator source/requirements/public exposure/origins/egress/secrets or
foreign connected-server binding conflicts fail without replacement; ambiguous
same-owner names are not guessed away. Unchanged replay retains the complete
native app row, including operator description/lifecycle state, and adds no
audit. Explicit provisioning adds one minimized audit event on top of the
existing native auth-bootstrap audit baseline.

Actual isolated schema tests passed twice: service-only roles, separate owners,
source/config/foreign-binding/ambiguity rejection, sixteen concurrent seeds,
durable no-op replay and zero minted keys, connected servers or runtime sessions.
The first fixture run exposed `psql` command tags before JSON; the shared
explicitly isolated query helper now uses quiet tuple output. A subsequent
fixture assertion counted existing auth-bootstrap audits as seed audits; it now
checks the actual before/after delta and exact action. All concurrent attempts
settle before fixture cleanup. Existing Work and Registry concurrency suites
also pass with the quiet helper. These fixes do not suppress database failures.

Focused adapter/bootstrap/Registry regression tests passed 33/33; typecheck,
changed-file lint and documentation/infra checks passed. Native deployment/
discovery, single-tool key, admission configuration and live Registry mutation
are **still pending**. The seed neither exposes the app nor starts a sandbox,
changes provider/local CLI MCP configuration or authorizes a capability.
The complete canonical `npm run check` passed: 573 test files, 9,285 tests,
40 skips, including typecheck/lint/documentation/infra and production build.
All four protected DMS SQL suites pass with the fifth candidate migration in
the isolated schema database. Actual protected-credential scan across the own
DMS App/Host source/evidence and browser assets passed (2,468 files).
Fresh production readback retains App 10df/image 1f3, 278 ledger entries
(latest `20261004060000_native_work_approval_binding.sql`) and the suspended
Development run; unrelated Development App/Host/MCP heads remain clean.

### Exact committed-source OCR and Host gate readback

App source `74f49fcead07e5099dbec6ad384f7c869efee8ab` was canonical-pushed and
immediately mirrored. Host source
`c1a25fefd9934424d4023ad5ead12004d18007a8` is retained on the own DMS worktree.
Canonical App draft PR **11** and Host draft PR **8** target the compatible
Development branches; neither is merged. Exact revisions and genuine PR refs
are bound to the same OPEN implementation Parent/Inventory/Case Children.

The later OCR build from clean, committed App source 74 has image
`sha256:a0423be24536757cab434f6411c29285880e7fb752219e87cb8ac09b5197e2b6`;
actual image readback verifies its OCI source revision equals that exact SHA.
This is distinct from the earlier unlabelled fixture image: that fixture is
not a deployable Host pin. The actual native Host entrypoint accepted the exact
74/image pin and rendered the opt-in overlay against existing n8n source
`24de6248`, with synthetic configuration only. Existing API/internal network
names are `axtn-native-api` and `axtn-native-n8n-internal`. No network, service,
production flag or Host/runtime source pin was changed.

That exact render-only evidence predates this Local Table increment. A later
report/source commit must not be relabelled as source 74 or passed to the clean
source/image guard with the older image. Runtime deployment/restart and full
DMS Acceptance remain unproven.

### Reviewed native internal key scope

The draft seed increment is now committed as
`74f09762bb2a75f78c0b1cb0062ed83c10f45ae4`,
canonical-pushed and immediately mirrored at `2026-10-05T01:24:30+02:00`.
App draft PR 11 was updated with exact candidate/report readback. The same
implementation Parent/Inventory/Case Children remain OPEN with source/Evidence
and Host PR 8 references; no parallel Case or acceptance claim was created.

The existing native `mcpAppRegisterInternal` now supports an optional explicit
nonempty `tool_allowlist` and required reviewed `tools_hash`. DMS can register
only `local_table_upsert` through that native path: current deployed tool-list
membership and approval are checked before any key revocation/issuance.
Timestamp checks compare actual instants, not lexical offset spellings.
The native key remains hashed at rest, the connected-server bearer encrypted,
and discovered advertisement filtered to the same one-tool scope.
Audit retains the reviewed fingerprint/scope, never the token.

Existing callers without scope retain unrestricted native registration;
existing deleted connected-server rows can still be recreated. Existing
foreign bindings are rejected before key rotation; updates also filter owner.
Native key-revocation/server-write/app-binding failures now return explicit
failure, not a false registration success or an error-shaped fallback insert.
This remains the existing native rotation lifecycle, not a new retry engine
or transactional/projection recovery claim.

Twenty-one actual server-handler/pure-schema fixtures and twenty-two existing
key/tool-approval/record-write regressions pass (43 total). Evidence covers
hashed scoped issuance/encrypted bearer/narrow advertisement, fingerprint/
approval/tool/owner/endpoint fences before writes, timestamp offsets, default
compatibility and native write failures. No key was minted in production.
The key hash is checked against the actual ephemeral plaintext supplied to
native encryption; the persisted-write payloads contain no plaintext token.
Hashing/encryption complete before any existing key is revoked. Native
encryption failure or a missing encrypted result therefore leaves the existing
working binding/key unchanged. No general retry or alternate credential path
was added. Changed-file lint has zero errors; the four existing `any` warnings
in the native MCP management module are unchanged.
Live deployment/discovery and exact app-ID mutation admission remain pending.
The complete canonical check passes (574 files / 9,304 tests / 40 skips);
the final typecheck and complete suite with the two additional encryption
fixtures passes (574 files / 9,306 tests / 40 skips). The successful production
SSR build is read back to verify the final encryption-before-rotation guard
is included. Final documentation/command/format checks and the actual protected
credential scan also pass. Production retains 278 migration ledger entries and
the existing suspended Development run; this source increment is not deployed.

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
scoped persistent effect claim/readback/projection recovery; complete own n8n
source envelope/protected deletion contracts beyond the tested parser/verifier; bounded persisted
Learning/side-effect-free evaluation/review handoff; full tested Host pins and
allowed production convergence. Missing QualityProfile blocks promotion only;
all new real auto-policies must stay disabled.

Real operator execution/OAuth/folders/naming/ingress authority remains unproven.
The n8n maintenance read key is not expanded into execution permission.
Sole current authenticated Owner cannot independently accept own work.
Issue API 403 is not bypassed; canonical Git and Case execution remain available.

## Production and rollback

### Persisted native Local Table and n8n recovery candidates

Scoped native registration is committed as
`bc1bbf2e9311ab66549a9628ad6680e48a130897`, canonical-pushed and immediately
mirrored at `2026-10-05T01:40:00+02:00`. The own n8n worktree/source/writer
preflight was committed separately at
`1ce463919d5806c61b821b8a61543f56632d00f8`, mirrored at
`2026-10-05T01:42:27+02:00`, and bound before n8n executor edits.
App draft PR 11 and the same OPEN Cases retain exact candidate readback.

Own n8n branch `work/AXTN-DMS-EXECUTORS-0001`, worktree
`/home/alex/aXtn-n8n-dms-executors-worktree`, now contains recovery commit
`3d7742d3697d09906f273e9e44f2656202108981` on compatible source 381.
It was canonical-pushed and immediately mirrored at
`2026-10-05T01:45:01+02:00`. Genuine n8n draft PR **2** targets the preserved
compatible `change/DMS-FILING-TARGET-RESOLUTION-0001-R2` branch at 381;
neither that branch nor default/deployed pin 24de was changed.

The source-native Delete verifier no longer converts arbitrary provider
errors or wrong/missing file identities into `not_found/deleted=true`.
Exactly one readable record, exact approved file ID and boolean `trashed=true`
are required. Generic errors/timeouts and HTTP 400/401/403/404/429/500/503,
including unavailable access disguised as 404, fail explicitly.
Permanent-delete/UNKNOWN outcomes still require the incomplete protected
operation/rights/receipt adapter; no fabricated receipt or retry loop is added.
This bounded repair is not full effect fencing, provider authority, Approval
validation or Case closure.

The complete native n8n suite passes **103/103**, without skips. Tests execute
the actual exported verifier, not a separate approximation. Canonical workflow
regeneration is byte-idempotent. Exact before/after JSON comparison proves only
the Delete verifier code changes: provider operation, credentials, inactive
state, all nodes/connections/settings and other exports remain unchanged.
Actual protected credential scan passed across the own App/Host/n8n source,
reports/artifacts and browser assets (2,500 files).
No native workflow was imported, activated or executed against a provider.
The full Filing Child remains NEW; no prerequisite was falsely completed.

The next own n8n increment is
`dd4dcb8ff8455e65b39ff16c3664a4c6e66f8942`, canonical-pushed and immediately
mirrored at `2026-10-05T01:51:17+02:00`; draft PR 2 readback matches that SHA.
The actual App Parent API spreads protected registration fields at top level
alongside suspended status/output/runId. The older n8n parser read only
`output`, so a real parked Approval response could be rejected. The canonical
core now supports that one exact Case-bound suspended contract; it does not
guess a carrier, parse the human Approval text, accept an incomplete ACK or
fall back to plausible legacy output after parked-contract failure.
Pending/error statuses cannot authorize source handling. Ordinary completed
Intake output and historical first-line compatibility are retained.

The complete native n8n suite passes **124/124**, without skips. All four actual
generated ACK nodes (Drive initial/retry, Gmail/IMAP) consume the complete
parked response and reject missing Case evidence, retaining per-item request/
run observability. Mail still requires `00_Review`; Drive still forbids a move
destination. Native topology/provider operation/credentials/settings/inactive
state are unchanged across all eight exports; regeneration is byte-idempotent.
Cross-repository protected Parent API/adapter and inventory tests pass 39/39.
The original n8n worktree at 381 remains clean and untouched.
Source-emitter Request/Delivery/original hash/exact revision, live Parent,
privacy rights and durable effects/receipts are still incomplete; this is not
full registration-to-filing Acceptance or production convergence.

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
