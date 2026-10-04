# Native Development Swarm 0002: implementation and runtime evidence

## 2026-10-04: authorized native Approval binding and Slice 1 source

The operator authorized the minimal binding of the existing native Approval
node to protected SupaCase authority. The previous Approval authorization stop
below is historical, not a current restriction.

The source now contains one visible 31-node native Slice 1 graph and an
owner-authenticated idempotent seed at `axtn/swarms/axtn-development/`.
Builder, three parallel Breakers, deterministic Verify, merge/gate,
Approval, effect-bound Git writes and the existing Case Acceptance/completion
are separate native nodes. Function snippets only validate or shape data.
Evaluate/Learn remain gated on actual Slice 1 acceptance.

Protected native Approval creation derives reviewer routing from the persisted
run snapshot and Case/Attempt/Candidate/receipt authority from protected rows.
The existing trigger rejects the owner, current or historical human Builder,
and anyone outside the persisted reviewer/group assignment. Authenticated
decision RPC, immutable binding and atomic existing-table audit capture the
actual decision identity/time, Case, Attempt, Operation and Evidence.
Canvas parks with a required native checkpoint; the existing inbox and
headless continuation resume that exact snapshot. Protected resume validates
current authority and claims the suspended run once. No second Approval engine,
workflow dispatcher, retry engine or Acceptance plane was added.

Source validation: full repaired unit suite **9,129 PASS, 40 skipped**, 561 files PASS;
production client/server build PASS.
Actual PostgreSQL role fixture **PASS**, completely rolled back: owner,
unrelated reviewer, routed Builder, duplicate decision, binding edits and
Attempt drift denied; legitimate assigned reviewer/group decisions and atomic
audit verified. This is capability evidence, not an independent business
decision. Deployment/live evidence follows below with its explicit remaining
boundary; source validation is not business Acceptance.

Fresh actual AgentSwarms inference: existing **OpenAI / gpt-4.1-mini HTTP 200**,
READY present, no quota/authentication error. Provider integrations and
credentials were not changed.

Current independent-decision boundary: the actual database has one real
auth user and one reviewer-group member, both the Work Owner. No eligible
independent authenticated reviewer is present. Do not fabricate another
identity, impersonate a reviewer, weaken owner exclusion, or call a parked
PASS candidate accepted/PR_READY. Complete deployable source and bounded live
tests first; retain the existing parent and Acceptance Case until real review.

### Final verified PROD state

**Implementation and bounded PROD tests PASS; full Slice 1/V1 Acceptance
BLOCKED at the genuine independent-reviewer boundary.**

| Component | Exact deployed source | Immutable local image ID |
|---|---|---|
| AgentSwarms | `10df3a869c5dcb6c377840ca7a048a87d1aa4c6f` | `sha256:1f3e476e524674df9f5cd1333eab35da1e0d6f370b1435caf4bfdff49449769a` |
| Scoped Gitea MCP, unchanged | `6e18b49a46327a56a21444fd6ebb6aeac745718d` | `sha256:bd248c3fae4c0512292f20e737cc72c23b246858c77e039912e9f566a5962f7e` |
| Previous App / retained rollback | `ff43febf35bee35e5a8346e142628e20bdefa5b9` | `sha256:4a856a22f273dbdfe8540d461661d60de4d2e942ccee4055158d7c2e6bba4ac1` |

These are verified local image IDs, not claimed registry RepoDigests or a
distribution release. Only App was recreated/restarted. Source-only
`ab159334515e830105361444a7db8ab8aaa57dc8` was built, not deployed.
Intermediate App `489008641bf333b0caad13f9d57c9952fe14c185` /
`sha256:a2fd329273a4d09f15743c1b43fdd64a7d8edfc84e1fe352156628b6a2f7fa11`
was superseded by the native HTTP stream repair.

| Retained responsibility | SupaCase |
|---|---|
| Parent, not independently accepted | `85a1d829-39ac-49bd-9047-163ab52d427b` |
| Native implementation | `41039014-4a5e-4e8d-873a-2869cebea5f9` |
| Production Acceptance, unresolved | `11496f0f-360d-4069-b88e-05d34584ab65` |
| Guard regression Work / Verify | `fd6112dc-71eb-4534-9673-7662f1cd5839` / `c51c0674-2b0a-4ff2-b072-88596c700fbd` |
| Intentional FAIL Work / Verify | `09a2923a-2be9-4e46-87e7-5d76128b8340` / `8760b26c-8b18-4b43-9aba-bca5b3f0a3e8` |
| Intended PASS Work / completed Verify | `b3d864db-0a1c-4412-b3b1-95b3a0555b9c` / `11f84b7d-60be-4aa4-938d-568018613e87` |

The implementation and Acceptance references track the final immutable App
source. Acceptance now requires completion of the actual native rebuild;
the superseded dispatcher Work `43d22cf1-8767-40ef-b682-785607e6d724`
remains an INFORMS evidence dependency, not the implementation base.
This was updated through the existing authenticated directed-dependency
operation, preserving both Cases and the actual completion requirement.

Final Case readback: native implementation, guard Work and guard Verify are
CLOSED as completed Work, with immutable report/receipt Evidence; none is
self-accepted. Parent remains OPEN and unaccepted, now bound to final App
source. Overall Acceptance remains OPEN with persisted
`NO_ELIGIBLE_INDEPENDENT_REVIEWER` blocking reason. Only the three completed
guard-regression runs were stopped through existing `cancelParkedSwarmRun`;
their requests/trace/audit are retained. The real full PASS remains suspended
and pending. Native request audit and cancellation audit/binding/time rows
are durable; authenticated cancellation identity is also retained in the
existing `swarm_run.cancel` audit.

Actual retained live evidence:

- Full headless PASS-to-Approval run
  `00ff44a5-760c-45dc-a605-7762ba72761a`, Attempt `intended-pass-v4`,
  Candidate `9bb40cd54fa31b4a14613aa52d272ff5acdef752`.
  Real PASS receipt session `0564be1f-5e16-4b18-b408-6ff2bfc344f5`;
  pending native Approval `afe3d09b-f27b-41ce-a00a-60c82c06e8e3`;
  graph hash `a1ea24867435314470f61bb3e3d641c2351867a429214f043285355947582c74`;
  Evidence hash `251c01e33f20e1b26530592e9183af4eabd659d209ad6b722d5eb2c98ee7a0c3`.
  Native checkpoint is suspended at `approved`, after `verify_completed`.
  Actual owner approve/reject both denied without Approval/Case mutation.
  A pending callback cannot resume or create a PR.
- Final 31-node headless intentional FAIL
  `72933106-4a52-42be-b37e-40896c957f19`, Attempt `intentional-fail-v2`:
  genuine deterministic FAIL and retained accepted HIGH finding, native hard
  gate blocked, no Approval/PR.
- Actual full 31-node canvas intentional FAIL on the same retained Work/Verify:
  `062cb921-a153-47f2-9079-f3f69d92df9b`, Attempt `intentional-fail-v3`,
  Candidate `aeff56aa0e90f50f23b82c4f9c3fa88bf42749ca`,
  genuine FAIL receipt `d8cd1b08-6c02-4a8f-8b49-d0e8f475ef39`.
  The canvas branch matches headless: terminal hard-gate error, no Approval
  and no PR-node execution. No page exceptions.
- Actual 31-node published inventory in the authenticated browser.
  Actual protected native canvas Verify/Approval regression
  `a9024ee0-149f-4964-a99a-57424615ad11` suspended durably;
  checkpoint remained after browser reload. Earlier native headless/canvas
  guard runs `de6014ad-9b4d-4a77-ad25-4ae87955f08d` /
  `250f3d28-f320-47dc-8fa1-f8c71905432c` are retained.
- Actual final-image App restart: full PASS Approval binding, completed node
  set, native trace-step rows and checkpoint unchanged; original guard
  pending request/checkpoint also survived. No step reran.
- Final-image native canvas/API traffic has no recurring
  `ReadableStream is already closed` worker exit. Native OpenAI inference
  repeated HTTP 200/READY. Actual seed repeated UNCHANGED with 31 nodes.

Preservation PASS: ledger 278 (one additive migration), 1 real user, 1 group /
1 membership, 4 datasets, 2 unchanged integrations and all 16 Cases retained.
Dataset fingerprint `d29a8a2413cb6dfd2e967732d941d045`;
integration fingerprint `b64f21362192273693663450457d5288`;
Document Intake graph fingerprint `721350f8a9ab136006435b45928b6c38`.
Existing App egress mount, runtime/MCP configuration, credentials and provider
bindings are preserved. No unrelated worktree was changed.

The current real group has only the Work Owner. SQL reviewer/group fixtures
are rolled-back capability evidence, never a real human decision.
Positive live protected resume, rejection by a real assigned independent
reviewer, semantic PR_READY and full V1 Acceptance remain unclaimed.
Evaluate/Learn remain intentionally deferred until actual Slice 1 acceptance.
No impersonation, Builder self-acceptance or synthetic reviewer was used.
Canonical Issue #7 access was retried with the existing automation identity:
HTTP 403. Its index could not be updated; no credential or permission scope
was widened. Repository Handoff and this versioned report carry the state.

Rollback **not performed**: the current bounded App is healthy. Retained
mode-0600 runtime snapshot `development-swarm-compose.pre-native-0002-guard.env`
and the prior immutable App image are the platform rollback baseline.
Keep additive migration, Cases, receipts and MCP capability. Pre-guard App
must not execute this protected graph: any actual rollback first requires
a fail-closed execution freeze of the canary (including canvas and callbacks),
not merely an image swap. Missing independent review is not reason to roll
back the healthy platform or weaken the guard.

### Changed App files

Relative to corrected native authority `37e79a23a55a62aa7f796878fd52239ef59e4128`:

```text
axtn/swarms/axtn-development/README.md
axtn/swarms/axtn-development/apply.mts
docs/architecture/axtn-development-swarm/HANDOFF.md
handoffs/reports/AXTN-DEVELOPMENT-SWARM-NATIVE-0002.md
server.mjs
src/axtn/workbenches/cases/workAcceptance.server.ts
src/components/swarms/NodeInspector.tsx
src/hooks/use-approval-decision.ts
src/integrations/supabase/types.ts
src/lib/axtnDevelopmentSwarm.ts
src/lib/swarmRunManager.ts
src/lib/swarmRuntime.ts
src/routes/api/swarm.run.ts
src/utils/observability/serverTracer.server.ts
src/utils/swarmApprovals.functions.ts
src/utils/swarmCheckpoint.server.ts
src/utils/swarmExecute.server.ts
src/utils/swarmResume.functions.ts
src/utils/swarmWorkApproval.server.ts
supabase/migrations/20261004060000_native_work_approval_binding.sql
tests/case-work/native-approval-roles.sql
tests/unit/approvalDecisionInFlow.test.ts
tests/unit/caseWorkAcceptance.test.ts
tests/unit/nativeDevelopmentSeed.test.ts
tests/unit/nativeDevelopmentSwarm.test.ts
tests/unit/nativeWorkApproval.test.ts
tests/unit/productionServer.test.ts
tests/unit/supacaseResumeAcceptance.test.ts
tests/unit/swarmParkedRunWrites.test.ts
tests/unit/swarmResumeRunRecord.test.ts
```

### Earlier bounded live repairs

The first immutable App candidate `fcd643c18ed3e1fd626845c7530ea55f3ccfe972`
was deployed as image
`sha256:e9579a79a73c4726ac812cd796941bb31e01dd386b335b2997d41e73103eae6b`.
Only App was recreated; one additive migration reconciled ledger 277 -> 278.
Actual protected headless and canvas requests both suspended with the same
real Verify receipt. Owner approve/reject returned
`NATIVE_APPROVAL_WORK_OWNER_DENIED`, without changing Approval or Case.
The published 30-node graph is visible in the authenticated browser.

Live seed readback exposed JSONB object-key reordering. Publication itself had
succeeded; the comparison was wrong. The seed now reuses the existing
`canonicalJson` helper and three tests cover fresh-store publication,
idempotence/publication-time preservation and corrupt-readback denial.
Two actual subsequent applies returned UNCHANGED.

Actual semantic FAIL reached native parallel review/Verify and the hard gate
with retained findings and a genuine FAIL receipt; no Approval or PR was
created. The first intended-PASS Candidate missed finite-bound validation and
correctly failed. The same Work and stable Verify Child continued on Attempt
v2: real deterministic receipt and review gate PASS. Its Verify completion
then exposed a missing typed Evidence reference. The graph now carries the
actual immutable receipt reference through Verify and final Work completion;
no completion rule was weakened.

The next real run completed Verify, then the protected Approval correctly
rejected an unstarted root Work. Native `CANDIDATE_UPDATED` resets Case status
to NEW; a CLI STARTED event before materialization is insufficient. An explicit
native `candidate_started` Tool node now records STARTED after Candidate
binding. The graph therefore has 31 visible nodes. The guard still requires
OPEN; NEW/CLOSED authority was not admitted to hide this lifecycle defect.

First concurrent test traffic also observed the existing Node/Undici
`ReadableStream is already closed` worker exit. Baseline and candidate both
use Node 22.23.2 / Undici 6.28.0. The existing worker supervisor restored
service; later sequential native semantic runs reached real receipts/gates.
The interrupted run is retained as failure evidence, not claimed successful.
No exception suppression, provider fallback or retry engine was introduced.

The recurring HTTP failure was reproduced in an isolated Node process using
the installed `srvx` FastResponse, a real Node Readable and cancellation at
EOF: the exact Undici `ReadableByteStreamController.close` exception exits
the process. The custom static wrappers were forcing Node bodies through that
async-iterator bridge, including delegated application responses.
The repair removes body access/rebuilding and custom Web-stream compression.
Existing srvx performs native gzip; the request proxy excludes slow brotli
and retains the original request, native URL cache and next callback.
WASM MIME correction mutates only the existing headers.
No dependency upgrade, private adapter access, exception suppression or new
HTTP routing was introduced. Eight additional behavioral tests cover response
identity/body preservation, delegated partial/already-encoded responses and
a real isolated Node HTTP server with gzip/identity, correct length/Vary/MIME
and 40 cancelled asset requests.

### Native conformance and reviewed reuse

| Native node IDs | Kind | Contract actually used |
|---|---|---|
| input | input | immutable Task input |
| task, branch_args, file_args, candidate | function | pure validation/write-argument shaping/readback binding |
| builder | agent | existing configurable OpenAI, no credentials/tools |
| verify_work, candidate_case, candidate_started, verify_candidate, verify_started | tool | existing owner-derived `case_work` contract |
| branch, file | tool | existing native MCP connector/scoped effect-bound Gitea |
| security, contract, maintainability | agent | one immutable Candidate/content hash |
| verify | tool | actual existing Developer Runtime and protected receipt |
| join | merge | native object join; four upstream dependency peers |
| gate, hard_gate | function | deterministic fail-closed data validation |
| checks_case, review_case, verify_completed | tool | native Case transitions and typed receipt Evidence |
| approved | approval | existing node, guarded persisted assignment and checkpoint |
| pull_args, result | function | pure approved-effect/result validation |
| pull | tool | existing scoped MCP PR creation/readback |
| pr_case, accept_case, complete_case | tool | existing Case PR/Acceptance/completion contracts |
| output | output | PR_READY only after actual independent Approval/Acceptance |

Reviewed reuse: `workContract.ts`, `work.server.ts`, `workVerification.server.ts`,
the existing runtime source/receipt/harness modules and existing scoped MCP
capability remain authoritative. `workAcceptance.server.ts` is extended only
to read the exact later PR reference after Approval-before-PR; protected
receipt/Candidate/graph/head checks remain. No files from the superseded
dispatcher/controller/provider branch were copied. Advisory evaluate/Learn
remain deferred by the canonical Slice 1 acceptance gate.

## Historical 2026-10-03: source/runtime preflight and exact stop

Date: 2026-10-03.
Authority: `37e79a23a55a62aa7f796878fd52239ef59e4128`.
Both `HANDOFF.md` and the complete referenced assignment were reread after
fast-forwarding the clean task worktree.

**Current status: scoped Git effect capability IMPLEMENTED / TESTED /
DEPLOYED / RUNTIME_VERIFIED; native Slice 1 NOT IMPLEMENTED / NOT ACCEPTED.**
The original materialization gap below was specifically authorized by the
operator at 2026-10-03T20:44:29Z and is now closed through the existing native
AgentSwarms MCP Tool connector. No workflow dispatcher, controller, provider
change or placeholder execution graph was introduced.

## Authorized continuation result

The operator explicitly clarified that the existing native AgentSwarms MCP
connector is native implementation and authorized only the minimal external
effect contract. Existing Cases are retained, with a responsibility event
reopening the rebuild Child before this implementation.

Canonical `aXtn/aXtn-git` candidate:
`6e18b49a46327a56a21444fd6ebb6aeac745718d`,
branch `work/AXTN-DEVELOPMENT-SWARM-NATIVE-0002`.
Changed files:

- `mcp/src/axtn_gitea_mcp/server.py`;
- `mcp/tests/test_effects.py`;
- `mcp/README.md`.

The three existing operations now accept Case/attempt/operation `effect`.
The minimal PR effect surface is `pull_request(action="create")`;
unrelated update/review/merge semantics are not reimplemented.
Native Gitea branch names, commit messages and PR bodies store recovery evidence.
There is no effect database, general retry engine, scheduler or Case/Approval
authority in the MCP.

The exact candidate passes **49 full MCP unit/SDK/policy/effect tests**.
Fixtures cover lost responses, restart without ephemeral locks, concurrent
duplicates, conflicting payloads, malformed effect identities, protected
scope and bounded readback failure. Existing unscoped operations remain compatible.
The deployed profile remains one private non-root/read-only MCP process with no
host ports or persistent mounts. Multi-process write replicas are not supported.

Previous scoped image:
`sha256:ced79756b3248cc1473fcf105f6388301c52a96f95af348ad1c9d442475b3c67`.
Final scoped image:
`sha256:bd248c3fae4c0512292f20e737cc72c23b246858c77e039912e9f566a5962f7e`.
The image's revision label equals the exact canonical candidate.
Only `development-gitea-mcp` was recreated/restarted. The existing App was not
recreated; source/image and mounts remain the baseline recorded below.

Actual PROD calls used the existing authenticated native
`executeToolNode -> mcp_call_tool` RPC, not a replacement connector.
Observed PASS:

- effect-bound branch creation and replay;
- exact commit/content readback and replay;
- exact PR readback and replay;
- changed-payload conflict denial for all three operations;
- forbidden path, foreign repository and merge denial;
- same results after actual scoped MCP restart;
- unchanged default branch and unchanged App/provider integrations.

Retained deterministic fixture:
`aXtn/development-swarm-acceptance#6`, open/unmerged;
Candidate `1cdd213157afe6f7dc919f969f60c2b8246f14c5`;
base `0a38f20ccea94d937a5d4fa2ad18b37ae6439c09`;
branch
`work/native-effects-v1-effect-a03080cecc305674ecadd8adecedf647-a4617fc3c16b089c7353348736cde204`.
This is capability evidence, **not** a semantic Builder/Breaker run,
independent Approval, or V1 PASS.

Live defects were repaired rather than bypassed: Gitea rejects branch names
over 100 characters, so branch markers use 128-bit prefixes of SHA-256 identity
and payload hashes; commit/PR markers retain full hashes. Branch replay now
returns a stable original base envelope even after downstream commits.
Native-readiness checks precede post-restart calls. No write-retry loop was added.

## Next proven stop: independent native Approval

Continuing the node-contract inspection reveals a separate native gap:

- Both native Approval branches persist only
  `payload: { last_output: content.slice(0, 4000) }`.
  Source: `src/lib/swarmRuntime.ts:1192-1203` and
  `src/utils/swarmExecute.server.ts:218-235`.
- Routing a different approver does not remove the owner's decision right.
  The actual permissive owner policy remains OR'd with routed-approver policies:
  `supabase/migrations/20260724100000_swarm_approvals_and_runs.sql:45-58`.
- The existing SupaCase anti-self-approval/immutable-binding guard is activated
  only for server-created `payload.axtnDevelopment` requests:
  `supabase/migrations/20260929030000_axtn_work_contract.sql:82-129`.
  Native Approval has no configured payload-binding input for this guard.
- The existing Case Acceptance operation validates receipt, graph, Candidate
  and PR, but is not a replacement for the preceding native Approval node.
  It cannot retroactively prevent a generic self-approved node from creating PR.

This was verified against the **actual PROD PostgreSQL roles and policies** in
one completely rolled-back transaction. A generic native `swarm_step` Approval
was routed to a different reviewer UUID; its authenticated owner successfully
changed it to `approved`. The fixture printed
`GENERIC_NATIVE_APPROVAL_OWNER_CAN_APPROVE_WITH_OTHER_ROUTED_REVIEWER:approved`.
`ROLLBACK` removed all fixture effects. This is observed failure of the required
independence invariant, not an allegation inferred only from UI.

No graph was published that could use that bypass. No custom Approval controller,
second inbox or new Acceptance logic was built. The exact remaining decision is
whether to extend/wire the **existing native Approval creation/resume surface**
to the existing guarded SupaCase Case/Candidate/receipt binding, consistently
for canvas and headless execution. That is distinct from the single external
Git capability already authorized. The handoff's explicit stop condition and
Builder-self-acceptance prohibition apply here.

There are also still unimplemented deterministic gate/failure-branch composition
and canvas/headless durable resume acceptance. They are not claimed solved by
the successful Git capability test.

Post-change preservation: ledger 277, one user, four datasets, two integrations,
ten retained Cases. Dataset and integration fingerprints below are unchanged.
App, Gitea, n8n and Matrix health each PASS (HTTP 200).
No full App unit/build run is claimed: no product App source was changed.
Host pin/syntax/Python/Compose gates are recorded in
`aXtn/aXtn-host:evidence/development-swarm/20261003T-native-0002-effects.md`.
Actual protected credential scan passed across 2,446 task source/evidence files,
task logs and relevant App/MCP runtime logs. No protected value was printed.

The remainder of this report is the **historical initial preflight** retained
to explain the originally authorized materialization gap, not current blocker
status.

## Execution and retained work

- Host: `aleXation`; effective user: `alex`.
- Initial cwd: `/home/alex`.
- Clean worktree: `/home/alex/aXtn-agentswarms-development-native-0002-worktree`.
- Branch: `work/AXTN-DEVELOPMENT-SWARM-NATIVE-0002`.
- Origin fetch/push: `http://127.0.0.1:3000/aXtn/aXtn-agentswarms.git`.
- Authenticated native fetch/ls-remote: PASS; native credential helper retained.
- Gitea loopback health: PASS.
- Old App and Host dirty worktrees: preserved, not copied, staged or reset.
- Existing Parent: `85a1d829-39ac-49bd-9047-163ab52d427b`.
- Idempotently ensured native-rebuild Child:
  `41039014-4a5e-4e8d-873a-2869cebea5f9`.
- Existing production Acceptance Child:
  `11496f0f-360d-4069-b88e-05d34584ab65`.
- Execution channel: `COPILOT_CLI`; current preflight mode: `DETERMINISTIC`.
  Actor label: `axtn-codex`; the native API derives the credential principal.
- The old Graph Child `43d22cf1-8767-40ef-b682-785607e6d724` remains evidence;
  it was not accepted or closed.

The existing Parent is the same overall objective, not duplicated. Its old
OpenAI-credit reason is historical, not an asserted blocker for this rebuild.
Authority and current responsibility events are recorded through `/api/cases/work`.
No independent Acceptance has been supplied by the executor.

## Verified production baseline

| Item | Actual read-only observation |
|---|---|
| App source | `ff43febf35bee35e5a8346e142628e20bdefa5b9` |
| App image | `sha256:4a856a22f273dbdfe8540d461661d60de4d2e942ccee4055158d7c2e6bba4ac1` |
| App state / health endpoint | running, healthy; HTTP 200 |
| Migration ledger | 277 |
| Existing App mount | bind `/etc/agentswarms/egress`; retained |
| Supabase users | 1 |
| User fingerprint | `1a2439d868edf0dd277c38fd4cf123ca` |
| Datasets | 4 |
| Dataset fingerprint | `d29a8a2413cb6dfd2e967732d941d045` |
| Data rows after rebuild Child ensure | 10; only intended Case tracking added |
| Integrations | 2 |
| Integration fingerprint | `ea49665a36a2827ae9bc7505634fbe7c` |

Fingerprints are read-only aggregate MD5 change detectors, not cryptographic
Candidate proof. No credentials, user rows or integration configs are reproduced.
No App/service restart, migration, image replacement or volume change occurred.
Rollback therefore is **not needed**. For a future authorized deployment,
the rollback target remains the exact existing App source/image above and the
accepted native Compose configuration, without removing retained mounts/data.
This is a recorded target, not a tested deployment rollback.

**Host contract discrepancy:** published Host task HEAD
`f36942762e649dd2f345a15b87739887ee40ebe8` still describes App `2801faa7...`
as pending source candidate while separately recording deployed `ff43febf...`.
That superseded candidate is not the base or a deployment target here.
No Host pin was changed before a valid native App candidate exists.
The prior dirty Host remediation is preserved.

## Node-by-node native-conformance matrix

These are source-verified existing contracts, **not a published new graph**.
Code Review Pipeline in `src/lib/swarmTemplates.ts:1875-2045` supplies the
Agent fan-out/fan-in starting pattern. The new slice stops before materialization,
so no lifecycle stage is claimed as newly implemented or runtime accepted.

| Stage | Native contract and evidence | Disposition for this slice |
|---|---|---|
| Task | `input`; headless `swarmExecute.server.ts:532-535`, canvas input branch | Available; not seeded. |
| Build | `agent`; headless `swarmExecute.server.ts:935-945`, canvas `callAgent` | Available; explicit provider/model required. |
| Candidate materialization | `tool:mcp_call_tool`; `swarmNodes.server.ts:149-168`; scoped `create_branch` / `upsert_file` | **STOP:** no Effect-key/replay/recovery contract. |
| Security break | Independent native `agent` | Available; no new inference performed. |
| Architecture/contract break | Independent native `agent` | Available; no new inference performed. |
| Maintainability break | Independent native `agent` | Available; no new inference performed. |
| Deterministic verify | Native `tool:case_work` operation `verify`; `workVerification.server.ts:7-102` | Existing Developer Runtime receipt path; only started owner-bound immutable Verify Work qualifies. PENDING must not be treated as PASS. |
| Fan-out | `swarmGraph.ts:209` onward, dependency levels; headless level workers `swarmExecute.server.ts:1057-1081` | Native mechanism; no custom scheduling. |
| Join | Native object `merge`; headless `swarmExecute.server.ts:550-578`, canvas `swarmRuntime.ts:1743` onward | Available; declared inputs must include all four results. |
| Hard gate | Native sandbox `function`; `swarmRuntime.ts:1474-1524`, headless sandbox branch | Can validate supplied JSON or fail deterministically. Native `condition`/`router` are LLM classifiers, not deterministic receipt authorities. Secure receipt/branch composition is not yet implemented or claimed. |
| Independent Approval | Native `approval`; headless `swarmExecute.server.ts:867-933`, canvas `swarmRuntime.ts:1177-1252` | Existing park/resume; generic payload is truncated `last_output`, not structured `axtnDevelopment` binding. Existing Case-approval protections must not be bypassed. |
| Integration | Native `tool:mcp_call_tool`, scoped `pull_request:create` | Exact head SHA and repo policy exist; same missing external-write idempotency applies. |
| Result | Native `output` | Available; no PR_READY claimed. |
| Evaluate / Learn | Native advisory `evaluate` and bounded `output` | Intentionally deferred until Slice 1 runtime acceptance, per assignment. |

Checkpoint source `src/lib/swarmCheckpoint.ts:12-85` retains context, completed
nodes, dead edges and suspended node. Headless resume uses the run's graph
snapshot (`swarmExecute.server.ts:1162` onward). These do **not** make an
uncertain external write idempotent: a transport failure before completion or
checkpoint persistence can still lead to another native call.

Canvas Approval waits on the inbox in the tab; headless Approval parks with a
durable checkpoint. Cross-executor durable resume equivalence is a required
future acceptance gate, not inferred from one node name.

## File-level salvage disposition

| Existing file/capability | Disposition |
|---|---|
| `src/axtn/workbenches/cases/workContract.ts`, `work.server.ts`, `workVerification.server.ts` | Already present at deployed base; inspected and retained unchanged. |
| `src/utils/notebookRuntime/development.server.ts`, `developmentSource.server.ts` | Already present bounded native verification/snapshot capability; inspected and retained unchanged. |
| Scoped Gitea MCP at `aXtn-git` `4f80994b2c1d85da3ffa96c0f3212bf9f0993ad1` | Existing external capability inspected against live service signatures/policy; not modified. |
| Superseded Task/Candidate/Finding/Review/Evidence/Learning schemas | Potential future file-level salvage only; nothing copied at this stop. |
| Superseded `controller.server.ts`, `development_work` dispatcher and custom lifecycle graph | Forbidden implementation base; nothing copied. |
| Superseded provider/authentication implementation | Not copied or deployed. Not categorically excluded: any reuse requires fresh source/runtime fit evidence. |
| Existing provider integrations and credentials | Preserved unchanged; no provider silently selected, reassigned, removed or replaced. |

## Exact gap and executable evidence

Canonical MCP source:
`aXtn/aXtn-git:mcp/src/axtn_gitea_mcp/server.py:257-290,466-510`.

Live service imports expose exactly:

- `create_branch(owner, repository, branch, from_ref)`;
- `upsert_file(owner, repository, branch, path, content, message, current_sha)`;
- `pull_request(owner, repository, action, ..., expected_head_sha)`.

None accepts a Case/attempt/operation Effect key. A commit message or PR body
can contain a marker, but the service neither validates it nor uses it for
replay, conflict detection or uncertain-write recovery. The existing MCP schema
also has no operation implementing that complete bounded capability.

Live non-secret policy:

- repository: `aXtn/development-swarm-acceptance`;
- tools: `identity,fetch,repository_tree,create_branch,upsert_file,pull_request`;
- mode: `review`;
- paths: `src/*.py,tests/*.py,README.md,docs/*.md`;
- actions exclude merge, delete, deployment and admin.

An isolated test imported the **actual running MCP implementation**, replaced
only its HTTP transport with `AsyncMock`, and submitted identical operations:

| Actual-source fixture | Observed result |
|---|---|
| Two identical file-upsert calls, same Case/attempt marker in message | Two external POST requests; no service replay/readback |
| Two identical PR-create calls, same Case/attempt marker in body | Two external POST requests; no service replay/readback |
| Existing scoped policy suite against live module | **16 tests PASS** |

No real branch, commit or PR was created by these fixtures. Two POSTs do **not**
prove Gitea would create duplicate commits/PRs: it may reject the second request.
They prove the adapter lacks recovery of the prior successful result and the
mandatory idempotency binding. A duplicate conflict is not a recovered result.

Public run initiation idempotency (`tests/unit/swarmIdempotency.test.ts`) and
native checkpoint replay prevention cover different boundaries. Neither binds
this individual external effect or recovers a response lost after a Git write.

## Required bounded decision; no workaround implemented

The assignment explicitly requires stopping at an unexpressible native row.
This is not a generic deployment-approval request.

The smallest specific proposal is **one external capability extension**:
Case/attempt/operation-bound idempotent execution/recovery of the existing
scoped Gitea write operations. It must reject different payloads under the
same identity and return/read back an exact prior result after an uncertain
response. It must keep existing repository/path/effect/protected-branch policy,
without sequencing workflow stages, scheduling retries, deciding acceptance,
holding Case lifecycle state or introducing another control plane.

That proposal needs explicit authorization before implementation. Alternatively,
a source-proven native composition with equivalent effect binding and recovery
may be supplied. Native dependency levels/retries alone are not that proof.
No broader materialization dispatcher or deterministic routing extension is
implicitly requested or authorized by this report.

## Acceptance truth

- Source implementation, image build and full App unit/typecheck/lint gates:
  **NOT RUN**, because no product source changed before the mandatory stop.
- New visible Swarm/publication: **NOT IMPLEMENTED**.
- Intentional live FAIL/PASS runs: **NOT RUN**.
- New headless and durable Approval suspend/resume acceptance: **NOT RUN**.
- Independent Acceptance: **NOT PROVIDED**.
- Deployed App source/image: unchanged, exact baseline above.
- Work Case remains OPEN with a BLOCKED responsibility event; Acceptance and
  Parent remain unaccepted. No executor self-acceptance or completion claim.
