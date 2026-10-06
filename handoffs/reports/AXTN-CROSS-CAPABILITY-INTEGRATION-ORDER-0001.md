# Cross-capability native composition continuation

Status: COMMON_NATIVE_SLICE_FUNCTIONAL / DMS_FOUNDATIONS_DEPLOYED / ACCEPTANCE_PENDING.
Full semantic DMS and general Development are not complete or accepted.

Authority: reconciliation/order at
`aa7c37c555b95c45fbafe5a5627318e6a549ef65`; composition correction at
`f4e1f0722fddc46b6622d55341992ef43551b9c3`. Only these three documentation
files were imported through the retained `axtn-gitea-mcp` connector. No older
Productsource was imported. Actual implementation starts at
`7d7dc0113c4a2e7c0e58a0502ec9fdd22f56525e` on the existing execution branch;
same Issue #12, Draft PR #14 and five Cases remain authoritative.

## Existing work and actual runtime reconciliation

| Work | Retained identity |
|---|---|
| Parent | `732dec32-082a-423a-85cd-3cdda5ab1341` |
| Handover | `158a6a9c-d616-4908-8c67-efb102947eb0` |
| Reporting | `7ca8ce19-1ef5-42c2-80c1-d4d41e3e64c6` |
| Capacity/Learning | `f0339d48-33f6-4f9a-ab48-7b50361c7ba4` |
| Independent Acceptance | `8a9d01da-d0ff-4fc5-bd8f-ae8fcc47d75a` — open, not granted |

Before product work, the parent and three implementation Children received
idempotent STARTED events bound to both exact continuation contracts through
the actual authenticated native owner interface. No new Case was created.

Initial healthy App source before this continuation was
`730439b9794be410870d7133fc58f81d1d849ff4`,
image `sha256:c9e759c1dd0c79d8f5e189645fbb723822c8f4683470e2bba54635da076f8671`,
ledger 296. Existing Host branch HEAD is
`a401b498b46b15304b8a4cd89ccdedbba7f98641`; previous executing Host source is
`5a4ff6f1c4aec40bdc4888b324d34b925cf0aa8d`.
At initial inventory, the Host architecture pin described historical `10df3a8`,
not the actual running image. The final reconciliation below supersedes that
pin; the initial discrepancy is retained as history.

The initial authenticated inventory found 19 owned Swarms and five Agent Builder
objects, all five Demo/Sample Agents. Native Skills: zero. Native KBs: 17,
which does **not** establish historical DMS KB identity or content. The three
canonical DMS Registry datasets did not yet exist in this production DB.
Current configured providers/credentials, users, genuine Approval and ledger
fingerprints are unchanged. No active running Run or active schedule was present.

### Actual identity/use classification and retention

| Identity/use | Classification | Disposition |
|---|---|---|
| `62bbd9a0-2fb3-4241-828d-584fa76edc74`, Document Intake | PRODUCT | Keep actual five-node legacy publication; do not confuse with recovered eight-node composition |
| `ad06e17d-460b-4b65-946a-9b5d78c6fd02`, native Development V1 | PRODUCT, bounded fixture scope | Keep 31-node publication and ten retained Runs, including genuine suspended work |
| `f24d0334-470f-4cfb-887f-1d3e64351a04`, Native Approval Guard Regression | DEMONSTRATOR/regression, not Slice Acceptance | Three retained Runs and an active scoped API key; not disposable |
| Sixteen `Synthetic ...` Swarms, identified individually in protected inventory | DISPOSABLE_TEST definitions with retained regression evidence | Each has an actual retained Run; no deletion/unpublication performed |
| Five Demo/Sample Agent objects | DEMONSTRATOR | Preserve user-owned configurations, bindings and sample KBs |
| No reusable proposal sub-Swarm before this change | Native composition gap | Provision only the newly authorized native Case Work composition |

Actual FK inspection shows cascading deletion of Swarm keys, schedules, chats
and native versions, and nullable evaluation linkage. No safe archive facility
has been established; unpublish deliberately falls back to the live draft and
therefore is **not** a safe disable action. Blanket deletion or unpublication
would misrepresent disposal and risks evidence/dependency loss. Definitions
were captured to protected session evidence before any possible disposition;
Cases, Runs, audit/usage, all genuine Approvals and operator objects remain.

The genuine Development Run
`00ff44a5-760c-45dc-a605-7762ba72761a` remains suspended, with native snapshot
MD5 `9149798c20f63b7aadca0131470b4571` and checkpoint MD5
`41818c210be8c7ca4ea823edee544afc`. Guard Regression is a different Swarm,
not this genuine Approval and not independent acceptance of the fixture.
The pending genuine Approval fingerprint remains
`425a5cee5dc5d79337a7e3bd13d3dd14`.

## Orders 1–3: current source changes

- Unauthorized/nonexistent Case detail no longer shows an indefinite loading
  state after its authorized Case list has resolved.
- Manual Work STARTED and permission to return to machine processing explicitly
  say that they do not start a Run. Existing domain Work panels/Acceptance
  controls remain; no generic-editor bypass is introduced.
- Authoritative references now project the same Case's persisted native audit
  request/result references as well as inline references. Historical/new
  revisions remain distinct; malformed persisted references surface an error.
  No new reference store or audit rewriting is introduced.
- Four saved Development role definitions derive directly from the existing
  native graph's Builder/Security/Contract/Maintainability configurations.
  Native owner-RLS Agent/memory/version provisioning has stable IDs, precise
  purpose/input/output/scope descriptions, no fabricated Verify Agent and
  explicit operator-drift rejection. The old graph seed now refuses to
  overwrite a different draft/publication.
- Library import reads actual persisted native memory and current Agent/version
  data, preserves representable constraints, records an immutable source
  fingerprint/version, and keeps `agentId=null`. Shared Agent LTM is explicitly
  disclosed as unsupported: independent nodes use run-scoped memory rather
  than an automatic live Agent link.
- Native publication records an existing `swarm_versions` snapshot and pins
  `published_version_id`; unchanged publication is a no-op and concurrent
  draft modification is rejected. No new graph registry was introduced.
- `caseSwarm.functions.ts` is a thin authenticated transport into the existing
  native executor. The server derives user identity, rechecks Case access and
  exact published revision, and atomically claims the unique existing native
  Run ID. Exact retries read the persisted result; changed requests cannot
  reuse the claim. Existing global rate/concurrency limits apply.
- Native Case executions require durable existing run/step/edge/result writes;
  persistence failures no longer produce success-shaped tracing. Existing
  non-Case execution behavior remains unchanged.
- The Case workbench exposes published Swarm/revision, Canvas, explicit start,
  retained Run/Attempt/result and existing decision/resume links.
- The new named native Case Work parent invokes a reusable proposal sub-Swarm
  containing a saved Agent snapshot. Functions validate/minimize/shape; existing
  native tools enforce same-Case scope/version and human-takeover fencing.
  The bounded result is a native processing-stage readback, not closure,
  independent Acceptance, external provider effects or DMS recovery.

| Native artifact | Stable identity | Scope |
|---|---|---|
| Development Builder | `306c6741-09aa-46e8-965e-e89a1f6b9254` | Existing Python fixture only |
| Development Security Breaker | `8955bfae-7816-4e07-9994-3780dbe783db` | Exact immutable Candidate review |
| Development Contract Breaker | `35b790c1-a936-4a57-97d5-d5d6e3198a7c` | Exact immutable Candidate review |
| Development Maintainability Breaker | `72fbffb0-7137-444e-a3be-0729a13ae476` | Exact immutable Candidate review |
| Case Processing Proposal Agent | `034b6764-bbf8-43c2-8a82-b1e8743a1f67` | Minimized intent → bounded proposal; no tools |
| Case Work Proposal sub-Swarm | `50df9276-d044-441a-bd89-9e6d75b21de6` | Independent saved Agent snapshot, no effect |
| Case Work parent | `e50fd50b-edab-45fb-802a-cd9c7ad1094d` | Guarded native processing action/readback on same Case |

## Meaningful checks and remaining runtime proof

Candidate `e526a22c0c8388c9a0ecff0f072ca60faae2a764` was built and deployed
through the canonical Host process as image
`sha256:a08b90c6182d35512ec3aabc6377bc82f42fc71b7a2bf98c50ac8f86a278f725`.
The ledger remained 296; 38 neighboring services and genuine suspended
Development/Approval state were unchanged. Four Development roles, one Case
Worker and the two native Case Swarms were provisioned; second apply was an
exact no-op. This supersedes the initial inventory source, not its history.

The first actual-user Case start FAILED with
`CASE_WORK_BOUNDED_INTENT_REQUIRED`. Native Function input gathering supplied
the preceding scope Tool projection, not the original minimized intent.
The repair adds a visible native Input node and an explicit named preflight
input, with a regression exercising the real `gatherInputs` helper against
a 20,000-character preceding scope output. No dispatcher or hidden client
context is added. The failed Run/snapshot remains immutable evidence.
Historical failed Runs are labeled recorded failures rather than current
operation alerts. The repair was deployed as
`5727e073a8171c1999b74760578ba85dd17b5a7b`; the subsequent native binding
repair and successful actual-user proofs are recorded below. Neither failure
was relabeled an external gate.

The repair's first follow-up start exposed a separate integration mismatch:
the generic native binder correctly refused a second root execution under
the retained Work/Candidate attempt. The explicit Case entry now marks a
server-derived native start; the existing atomic binder uses that claimed
Run ID as its execution Attempt, preserving the Work/Candidate attempt,
generic API-key rules, old Runs and nested inheritance. A guarded additive
function migration plus transactional tests cover two deliberate starts,
exact replay, preserved Work attempt and missing-provenance denial. This
does not authorize repeat effects or bypass processing-version/takeover fences.

Eleven targeted unit files currently pass 162 tests, including executable native
Function-body fixtures, authenticated start/revision/injection denial, persisted
replay, atomic run-ID claim race, exact saved Development role import parity and
snapshot memory independence. Typecheck and documentation/infra checks pass;
targeted lint has only the three existing NodeInspector warnings.
The full lint gate has zero errors/235 existing warnings. The full unit run
initially passed 605 files/9,987 tests (40 skipped) and exposed the directly
coupled DMS executor checksum manifest, which still referenced predecessor
bytes. Its current source fingerprint is reconciled without changing any
recovered DMS definition or inventing configuration; the affected recovery
and native-execution gates are rerun before source publication.
This is source/contract evidence, **not PROD/UI/restart proof**.

Exact candidate `fc912dad2f8dfff8f9d80c1fdc39c800092105fa` subsequently passed
the full unit gate: 607 files/9,991 tests, 40 explicitly skipped. Its canonical
Docker build correctly caught a browser/server boundary defect in the new
Inspector provenance import: the existing canonical serializer module also
imports Node crypto for server digests. Canonical JSON serialization is now
extracted byte-for-byte to a pure shared module; browser snapshot hashing uses
Web Crypto, while existing server digest consumers retain the same API/bytes.
No failed image was activated; source730439b9 remained healthy and the active
compose environment was restored by the existing canonical build helper.
The repair and exact immutable build are verified before deployment.

| Capability | Implemented/source | Tested | Deployed | Visible/operable | Independently accepted |
|---|---|---|---|---|---|
| Inventory/current contract reconciliation | Actual bounded inventory/pin reconciliation | Actual owner/protection readback and Host contracts | Exact339/imagecaa/ledger297 | Actual user inventory | No |
| Manual Case fixes/clear mode vs Run wording | Implemented | Actual Human takeover/result/reload; unavailable Case denial | Exact339 | Same reporting Case; mode-only return starts no Run | No |
| Saved Development Agents/snapshot/drift | Implemented native seed/import/versioning | Role parity/snapshot tests; final second seed exact no-op | Exact339; five roles provisioned | Actual user cards and editable Case Worker dialog, without configuration mutation | No |
| Native Case parent/sub-Swarm/start | Implemented native graph/entry/UI | Actual start/result/replay/restart; concurrent claim/takeover proof atb92 | Exact339; exact publications below | Actual user Canvas, explicit start, Run/Attempt/result/readback | No |
| DMS Registry/Local Table foundations | Existing native seeds plus explicit internal tool-scope wiring | Seed exact no-op; native UI registration; two actual no-write denials; restart | Exact339; three datasets/private MCP | Actual user MCP Builder and native connected server | No |
| Full DMS | Shared native primitives retained, not complete semantic composition | Foundations only; no real-document/provider-write proof | No full composition | Historical semantic definitions/effects unresolved | No |
| General Development | Explicitly not enabled | Existing fixture tests retained | Existing fixture only | Exact locally accepted Solution Contract unproven | No |

## Sibling dependencies and concrete gaps

DMS stable Stage 1 Agent `54edaad4-4726-4781-ae07-5df795434837` and Stage 2
Agent `02482fe8-1970-447a-97d7-8898ab8abaae` are absent from actual Agent
Builder. Exact later Gemini model/prompt/temperature/Skills/KB/tools/guardrails
remain unrecovered in the previously checked canonical source/runtime/backups.
The user's Stage 1/Stage 2 reuse recollection is not evidence permitting
collapse of those distinct historic IDs or invented replacement settings.
Parent/Privacy/Cleanup recovery stays separately gated. Native Registry/Local
Table prerequisites have now been independently executed as documented below;
real source/privacy/provider-effect authority and reviewer gates are not
manufactured.

General Development requires a valid exact locally accepted Solution Contract
with allowed repository/path/runtime/effects. A generic contract reference,
these saved role objects or the parked Candidate Approval is not that gate.
The known 31-node Python fixture and its real pending reviewer are preserved.
No general repository/path expansion or Evaluate/Learn activation occurred.

Same DMS Issue #6/PR #11, Development #7, Routing #10, Host PR #9 and n8n PR #2
remain coordinated siblings, not duplicate work graphs. No peer/source/credential
configuration, CLI MCP change, second control plane, self-Approval, merge,
tag or release occurred. The existing P01–P38/SC01–SC18/35-question evidence
matrix remains individually qualified in the Pilot report; no 38-fold PASS
or economic/HA/peer conclusion is inferred from this candidate.

## Final exact runtime and functional evidence

Active Productsource:
`339a35b940bdffbec3839bbb8dd149482cd43d41`.
Immutable image:
`sha256:caa71819ccac64038d0ab511dcf728427668ec46c9df4b854407d0ab50e3cf76`.
Ledger: **297**, including additive
`20261006140000_native_case_start_attempt.sql`.
The intermediate binding repair was
`b92b1ca3d2298f7c031920398f40185afc825c49`; the final339 change wires the
existing native MCP registration UI to its existing reviewed tool hash and
explicit tool allowlist. Documentation commits after339 are not represented
as deployed Productsource.

| Persisted native evidence | Exact identity/result |
|---|---|
| Parent publication | `3fee099d-2b5a-4454-8104-0bc2a13c7c01` |
| Proposal sub-Swarm publication | `3371e58e-6910-455e-a101-e4e7858956fc` |
| Final339 parent Run | `37663eb9-2055-56ce-ab5e-54902783550e` — success |
| Final339 child Run | `eae415b1-e386-49a8-8ebb-e71d0d217d2a` — success |
| Same Case | `7ca8ce19-1ef5-42c2-80c1-d4d41e3e64c6` — persisted `VALIDATION_REVIEW`, Work remains open |
| Concurrent same claim atb92 | `4674bf6d-6a23-526e-ae03-00def69dcabd` — one root Run, one effect |
| First failed parent retained | `5fb98406-a684-52e4-a7b0-c5b73b8a71a2` — bounded-intent error |
| Failed unbound claim retained | `41b45624-79c6-5c40-a35d-4605e195b534` — explicit readback-recovery error |

Actual authenticated user proof at339 covers the five saved role cards, the
Case Worker **Edit Agent** dialog with editable fields (closed without save),
the parent Canvas's saved-Agent/sub-Swarm node, explicit native start and
persisted same-Case result/publication identity. Exact replay added neither
inference, effect, Run nor trace. A nonexistent Case presents an explicit
authorized-scope error rather than indefinite loading. Theb92 control proof
performed actual UI Human takeover, denied stale machine output with
`CASE_PROCESSING_HUMAN_TAKEOVER_FENCED` and unchanged Case state, recorded a
referenced result visible after reload, and returned processing mode without
starting a Run. No positive genuine reviewer decision/resume is claimed.

Final exact339 full unit gate: **608 files passed, 9,993 tests passed,
40 skipped**. This is distinct from the earlierfc607/9,991 gate. The existing
complete transactional native execution SQL suite also passed for theb92
additive binder: two explicit starts, exact replay, unchanged Work attempt,
missing-provenance denial and existing generic/nested behavior, then rollback
of test fixtures. Targeted typecheck/docs/infra checks and canonical immutable
build/convergence passed. Tests are not independent Acceptance.

The true339 App restart preserved all five owner Case projections, native
Runs/traces/checkpoints, Agent/memory/version and Swarm/publication definitions,
genuine Approval, users/providers/integrations, stable MCP definitions and BI.
There were zero running Runs and one genuine pending Approval. All **38 original**
neighboring services were retained; the final restart checked **39 current**
neighbors, including the single newly deployed owned Local Table MCP service.
No Supabase/n8n/Host reset, local Copilot MCP change or destructive restore
occurred.

Host architecture/default-source pins now agree with the actual339 image and
ledger297. Inactive base `compose.env` was compared in memory against its
encrypted pre-reconciliation copy: **only** `AXTN_AGENTSWARMS_COMMIT` and
`AXTN_AGENTSWARMS_SOURCE_DIR` changed, and both match the active development
compose. All other protected values remained identical. The runtime stayed
healthy; no bootstrap rerun was used to reconcile the pin.

Rollback retains predecessorb92/image
`sha256:060115be84693cec94a03ccc525ce74cc3965c8f2a9d7cb10ed5ab6c998e4aea`,
compatible additive ledger297 and encrypted verified checkpoint
`~/.local/share/axtn/native/pilot-checkpoints/execution-339a35b940bd/`.
The database ciphertext SHA256 is
`0fa3085a38cb8c85902b474f5f42999b4245a3b1618ff6a349d5527bb69d8b38`.
The separate pre-admission App env and pre-reconciliation base compose copies
support bounded configuration rollback without replacing unrelated credentials.
No rollback was performed or declared necessary.

## Independently executable DMS foundations

The retained DMS Parent `42a577cc-51cf-48ac-b6b8-8ec855714021`, Inventory Child
`e1685b29-9a29-45cf-a470-25d3503335c7` and Case Child
`b09920d3-8c66-40db-ad2c-e34bc017cb5a` received referenced STARTED tracking.
No duplicate Parent/Child was created; Filing/Learning/Acceptance were not
closed by foundation work.

| Native foundation | Exact identity/scope |
|---|---|
| Document Registry | `8d42d201-b02b-4056-a489-0d176ae51b95` |
| Recognition Patterns | `1a6d03a2-9377-41ef-b8ae-aa466ce899c4` — no active recognition rule |
| Classification Patterns | `fddf0cbf-b55c-4161-a83f-6ef328e42154` — six historical operational values |
| Local Table MCP app | `088f4a4d-915f-48d9-b458-4b50b96f23b8` — private |
| Native connected server | `bd45279e-bcb9-4123-b789-d8342da600e0` |
| Exact Python source SHA256 | `925c5324f7fd4c1a5e66e9972fd18b0a58212dc350a83722fb6cf98ed21a5c68` |
| Reviewed tool snapshot | `v2:3ae09ac179b3a58f2a0368ead3adf9fa` — only `local_table_upsert` |

The authenticated native document-intake seeds produced an exact second-apply
no-op across datasets/rows/MCP draft/audit. Deployment and registration used
the existing actual-user MCP Builder, native runtime and connected-server
mechanisms. Existing platform behavior automatically timestamps the initial
discovered tool approval on first successful deployment; no reviewer
**Approve** action or independent semantic acceptance was performed.

The existing registration backend already accepted a reviewed hash/allowlist;
the final UI now supplies both and explicitly rejects an empty or unavailable
list. The internal key is hashed, connected-server token encrypted, and no
plaintext credential is exported. Exactly the owned opaque app ID was added
to existing `LOCAL_TABLE_INTEGRATION_MCP_APP_IDS` after encrypted backup;
all pre-existing env values were verified identical.

Actual native calls rejected an undeclared `axtn_cases` table and an undeclared
Registry `key_column`, with no document/Registry data changes. The second
probe reached the existing platform broker through the legitimate app-ID/owner
binding. This proves functioning bounded admission/denial, **not** positive
real-document writes, semantic classification, privacy completeness or
physical provider filing. No document, source authority or historical rule
was invented. Initial deployment-driver timing/predicate failures were
diagnostic harness failures; persisted ready status and the successful binding
proof, rather than blindly repeated deployment, establish the product result.

## Concrete decision proposals and retained gaps

1. **Historical semantic settings:** absent Stage1/Stage2 IDs and exact Gemini,
   prompts, temperatures, Skills/KB/tool/guardrail bindings remain the precise
   recovery gap. If no authoritative source is supplied, the proposed
   replacement is an explicitly identified new native configuration revision
   for each distinct role, with exact reviewer-approved settings and Git/native
   version evidence, then a newly published immutable parent/sub-Swarm
   snapshot. Do not claim historical recovery, collapse the two roles, copy
   Development models or auto-adopt later Agent edits. This proposal has not
   been implemented or accepted.
2. **General Development:** supply/identify the exact locally accepted Solution
   Contract, authority and allowed repository/path/runtime/effects. Existing
   fixture and role provisioning remain usable; arbitrary repository work and
   Evaluate/Learn are not enabled by a generic reference or Candidate approval.
3. **Genuine resume/effects:** the actual authorized reviewer alone may decide
   the retained Approval. Positive protected resume, real source/privacy
   processing and provider effects remain separately unproven, not substituted
   by synthetic acceptance.
4. **Disposable definitions:** the final per-identity check below establishes
   the actual retention dependency, not merely a theoretical version cascade.
   Each of sixteen synthetic definitions has one retained Run, one inactive
   key and one idempotency receipt. Deleting its Swarm cascades through the
   key into that receipt, destroying existing replay evidence. No definition
   currently meets the requested evidence-preserving deletion condition.
   Unpublish makes the draft executable and is not a safe disable substitute.
   No new hidden registry/archive/control plane or library cleanup is claimed.
5. **BI/peer/economics:** existing immutable snapshot freshness and individually
   qualified Pattern evidence remain valid. Live semantic Case sourcing,
   genuine independent peer transport and economic/HA/DR claims retain their
   existing explicit decision/data boundaries.

The bounded common slice and DMS foundations are implemented, tested,
deployed and owner-visible. Full DMS/general Development and the overall
Parent remain unfinished; independent Acceptance remains open.

## Exact synthetic disposition list

All sixteen are **DISPOSABLE_TEST definitions / RETAIN_DEPENDENT_REPLAY_EVIDENCE**,
not product Swarms or native Case Work compositions. Final actual counts:
one Run/one inactive key per definition, sixteen retained idempotency receipts,
zero active synthetic keys, zero native versions/schedules/chats/evaluations.
`swarm_runs.swarm_id` has no deletion FK and its nodes/edges snapshots are
retained; the concrete obstacle is instead
`swarms → swarm_api_keys → swarm_run_idempotency` with cascading deletion.
Retaining Run rows alone would not preserve those original replay receipts.
Full definitions remain in protected inventory/checkpoint evidence; hashes
below identify the retained actual definition rows without exporting secrets.

| Swarm identity | Verified synthetic use | Definition-row MD5 |
|---|---|---|
| `09196515-d089-4eeb-948d-fe37f79b45ad` | F1 agent proposal | `0f9293f15c94e06364eb47122148af49` |
| `2c915ed0-75f3-44c0-b4f4-dd9fcfdee8ee` | F1 agent proposal | `691577bac6408139a291f8ef66bd6c62` |
| `b3cc4123-1d7a-482a-8330-312815308f7b` | F1 agent proposal | `0c2585eb97e77665f184aecf675db576` |
| `d0c76de6-4229-4539-8ece-1b69af3801ad` | F1 agent proposal | `8b8aece7d5bcab3b15341755fbb64d5c` |
| `8e17c0f1-1d60-422d-9429-9b6380cd707e` | F1 foreign-target denial | `5f06a491386bb62f3350a67830b940e2` |
| `38dae7fd-b753-4f24-a157-b1a8e9fc5283` | F1 forged-principal denial | `7c5c4151b4f8c81720f3dfea49b1001a` |
| `89e176dc-7a75-4795-97dc-ad51220d3830` | F1 malformed-input denial | `13461931dbd24824d0f78fc4e011ac70` |
| `e383c8bc-92d7-4b6e-a70c-abc7b3d133dd` | F1 stale-revision denial | `e287ba47bf06075177b5c882a0b3e71b` |
| `869a1e7e-3a31-455c-a707-9d4763617041` | F1 undeclared-effect denial | `86d42fb87b614bf083754191a5aa8d0b` |
| `b78fc82f-124d-4e1d-ad49-5faacf99680a` | F1 undeclared-effect denial | `71bf6fa57ca11fea1e4796c86ad1d093` |
| `feed3d4e-ac0c-4602-8c31-aca764cd2b50` | F1 undeclared-effect denial | `f317b5d9a5ea2b654f281b0f12d14304` |
| `6a28ca44-969e-4a3e-9c4d-1bc7a2e2b246` | Existing-provider probe | `a835e502f30eae5a222095a7db42ce71` |
| `ad4ad99a-5c1f-41a3-ad20-0ea101d045e2` | Existing-provider probe | `d4a298862de073eb2457b8efc7126011` |
| `ec2cec39-5de7-4c45-8f57-9ea07e5f2fbe` | Existing-provider probe | `3f77ceb78019c2eae8ac6e7a30445bb4` |
| `4e7b1f52-451b-48a6-9205-7fbbd9edd919` | Native execution a33a9c142bf4 | `4b7c468ddd0bf8e93355c6e3dee74d6e` |
| `b238e370-9457-4287-addc-9efc3a8f36fb` | Native execution a5f53aba1347 | `f6aa14780200954fdb4119b7084f1c5c` |

The owned temporary `environment-pilot-build.swap` was disabled and removed
after verifying sufficient available memory. Original
`development-graph-build.swap`, fstab and all other runtime facilities remain.

## Post-publication durability recheck

The same four Pilot executor Cases record CHECKS_PASSED, DEPLOYED_VERIFIED
and bounded RESULT for Productsource339; the retained DMS Parent/Inventory/
Case Children record foundation RESULT. Their exact result reference is this
report at `92a9921c20ff4a8d407d908d1577454b82e0946b`. Replaying all fifteen
events created no new audit entries. Candidate, attempt, processing mode and
lifecycle status remained unchanged; both independent Acceptance Cases and
the dependent DMS Filing/Learning Cases were unchanged.

A further true restart after publication preserved those five Case projections,
results/audit references, all native definition/version/checkpoint/Run hashes,
BI, protected env and39 neighboring service identities/start times. The
actual authenticated user then saw the full typed canonical92a9921c reference
under **Authoritative references** on the same reporting Case.

The first post-publication restart harness flagged a raw integration-row hash
change. In-memory comparison against the encrypted339 PostgreSQL checkpoint
proved that only OpenAI `config.health_checked_at` and its automatic row
`updated_at` changed; encrypted API keys, provider/owner identity, active state,
health status/detail and all other configuration were identical. The corrected
restart fingerprint excludes only those two legitimate health timestamps,
still hashes all credentials and other fields, and passed. No integration
configuration repair, credential replacement or timestamp rollback occurred.
Initial UI/readback assertions also wrongly assumed an inline reference array
and hyperlink: the existing native contract stores `result_ref`/audit request
references and renders a full typed reference. Corrected actual contract/UI
checks passed without product changes.
