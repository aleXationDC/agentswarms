# DMS host/source/writer preflight

Observed 2026-10-04, host `aleXation`, authenticated host executor `alex`.
Authority: Issue #6 contract revision `dad9629ae1ae98465beefa63deccd6c76aa42031`,
`handoffs/requests/AXTN-DMS-RECOVERY-AND-LEARNING-0001.md`, revision 0.5.
This is execution evidence, not a replacement assignment or DMS acceptance.

## Source and writer boundary

| Component | Dedicated worktree | Branch | Verified compatible base |
|---|---|---|---|
| App | `/home/alex/aXtn-agentswarms-dms-recovery-worktree` | `work/AXTN-DMS-RESTORE-0001` | `6bf776ef7c9abb59224f0477dc7257f94f93f4ca` |
| Host | `/home/alex/aXtn-host-dms-recovery-worktree` | `work/AXTN-HOST-DMS-RESTORE-0001` | `85dbb7227e04a6a1406697a8b660bb1c8804d13e` |

Previously existing DMS heads `86d10fe9f871a0a12dab2de788f52f5bc68423c8`
and `5cfd74912d420793ebf65db1c6ac2dde67fb82a6` were strict ancestors of
the compatible bases. Only these dedicated branches were fast-forwarded.
The App/Host Development worktrees and scoped MCP worktree remain untouched.
No reset, force push, merge, tag, release, or default-branch write.
Only the three authoritative planning documents were imported from the exact
plan commit, not its older product tree.

Read the current root `AGENTS.md`, Development Case/Work contracts, Host
execution/access/network/credential/pin contracts, complete DMS assignment,
and the separate External References assignment. No simultaneous bootstrap,
convergence, seed, build, or running Swarm writer was observed. One live Copilot
session owns DMS writes. Product mutations are serialized.

Development run `00ff44a5-760c-45dc-a605-7762ba72761a` remains suspended
awaiting real independent approval. Its graph, Cases, provider bindings,
approval and checkpoint were not resumed, cancelled or accepted.
Historical terminal `error` runs are not active writers.

## Actual runtime pins and state

| Surface | Readback |
|---|---|
| Deployed App source | `10df3a869c5dcb6c377840ca7a048a87d1aa4c6f` |
| Deployed App image | `sha256:1f3e476e524674df9f5cd1333eab35da1e0d6f370b1435caf4bfdff49449769a` |
| Scoped product MCP source | `6e18b49a46327a56a21444fd6ebb6aeac745718d` |
| Scoped product MCP image | `sha256:bd248c3fae4c0512292f20e737cc72c23b246858c77e039912e9f566a5962f7e` |
| Latest applied migration | `axtn_host.migration_ledger`: `20261004060000_native_work_approval_binding.sql` |
| Host n8n source pin | `24de6248f13b5fc250482dc8c3b3ef483c91cb55` |
| Native n8n image | `axtn-n8n:2.36.9-imap-2.17.1`, `sha256:e6b1f34a3fdcc8ba7398b47e53db8c7c62508a280b00aa6171344114b4614f5c` |
| Available newer n8n source, not deployed | `381e706176dc53b536139424240d0824569a91d7` |
| Database metadata | 278 applied migrations; one auth user; two integrations; four logical datasets |
| Cases after DMS lineage creation | 22 retained Case rows |
| D09 external unauthenticated request | HTTP 403; no access widening |

App container is healthy. Published Intake has five nodes, Development has
31 nodes, and the existing guard-regression Swarm has four nodes.
Only the existing Development Gitea MCP is registered in native `mcp_servers`,
with six scoped tools. Local Table MCP is not registered.

n8n readback used the existing maintenance **read** key at the actual loopback
listener `127.0.0.1:25678`. All six pinned workflows exist and are inactive.
Drive Intake and both Mail Ingress workflows reference credentials; that
reference alone does not prove valid OAuth or usable provider rights.
Drive Filing, Mail Filing and Mail Materialization have zero bound credential
nodes. No Drive Deletion executor exists in the actual workflow readback.
No workflow was activated, executed, imported or changed.

## Persisted SupaCase execution lineage

Stable Parent identity:
`implementation:dms-recovery-and-learning-v1:agentswarms-6`.
The existing server-derived owner-bound `/api/cases/work` endpoint performed
ensure, repeated ensure, STARTED and list readback. Parent replay returned the
same Case ID. Actor `copilot-cli`, channel `COPILOT_CLI`, mode `DETERMINISTIC`;
typed references bind the exact accepted request and own App/Host branches.

| Work | Case ID | State |
|---|---|---|
| Parent | `42a577cc-51cf-48ac-b6b8-8ec855714021` | OPEN, unaccepted |
| Inventory/Recovery | `e1685b29-9a29-45cf-a470-25d3503335c7` | OPEN |
| Case/Manual adapter | `b09920d3-8c66-40db-ad2c-e34bc017cb5a` | OPEN |
| Privacy/Filing/Executor | `4ecf0e5e-a855-43f9-a247-176d1832c805` | NEW, requires Case adapter |
| Learning/Evaluation | `2ea37676-0b44-4ff3-8a36-fa296d055d2e` | NEW, requires Case adapter |
| Independent Acceptance | `85c2f455-b4db-44ad-9e14-fce2efacd7fe` | NEW, requires all implementation Children |

No document-runtime Cases, forged reviewer, self-acceptance, or shadow Case store.

## Root cause and recovery boundary

Historical implementation `7123d0ef167e72b39ee39a944e418003a253f50f`
is available through canonical Git. Its last complete report is on
`a6a10ab52d43174c7fbf95dd6387ee32ad878e87`.
The merge base with the current compatible App base is
`c372cb809fa66bcdc7a1d2bc55e4270aa9b23584`.
The historical full implementation is **not an ancestor** of the current
App base. There is no deletion commit for Parent/Privacy/Recognition on the
current ancestry: those changes were never integrated into this lineage.
Do not describe the cross-branch tree difference as a Copilot deletion.

Current ancestry recovered only Intake at
`5eced7e8d69eb1636d7a3736882bbb133fd9dbd5`; module path correction followed
at `21a435d5f7f306f41d01c2c5e7dc504ccd1e46d8`.
The historical Parent applier explicitly updated existing Parent/Privacy rows
and required two already-active agents. It did not create those dependencies.
That provisioning gap cannot satisfy fresh-install DMS recovery.

The historical Parent/Privacy/Cleanup native graphs and exact/fuzzy
recognition/registry sources are recoverable. Current production has neither
Parent/Privacy/Cleanup nor the two stable DMS agents. The only five agents are
platform demo/sample agents. All 17 knowledge bases and 49 knowledge documents
are platform samples; no DMS KB binding is demonstrated. No native skills exist.
No document/recognition/taxonomy/identity registry dataset exists.
Presidio/local OCR are absent from current running services.

Read-only recovery checks included the existing pre-reset database backup,
retained DMS reset snapshots, and historical canonical DMS branches/reports.
The August backup has an older, differently identified DMS Triage agent and
classification skill; it is not evidence for the two later stable agent
identities. Retained DMS reset snapshots contain registry/approval/run metadata,
not full agent definitions. No raw business rows, provider originals,
credentials or backup contents were exported into Git or Cases.
Exact later prompts/model/temperature/skills/KB content remain an explicit
recovery dependency; predecessor/sample configuration must not be substituted.

## Capability gates

| Capability | Result | Next bounded action |
|---|---|---|
| Canonical request, source/host identity, writer handoff | PASS | Execute in dedicated DMS branches |
| Existing native owner-bound work carrier | PASS | Preserve Development guards; register narrow DMS profiles |
| Complete DMS graph/source availability | PARTIAL | Recover historical source and dependency manifest |
| Complete fresh-install seed | BLOCKED by existing provisioning defect | Implement dependency-ordered native reconcile |
| Exact Stage 1/2 semantic settings and DMS skills/KB | PARTIAL, not yet recovered | Continue protected provenance search; no invented Gemini/prompt fallback |
| Local Table/registries/privacy services | BLOCKED by missing provisioning | Implement/test bounded native restoration |
| Provider filing/deletion | BLOCKED by actual missing execution bindings | Keep workflows inactive; validate authorized bindings before effects |
| Learning quality promotion | BLOCKED, no accepted QualityProfile | Implement disabled learning/evaluation independently |
| External References core | PENDING separate Issue #8 | Its checked head `8e40dc8a831a3deff6aee8b3751571b2dd42cb0e` changes documentation only; no duplicate Core |
| Independent acceptance | PENDING | Sole current auth user is work Owner; do not invent reviewer |

Issue #6 authenticated API read returns HTTP 403; exact Git authority and
Case access remain usable. No scope/permission widening. Repository operations
after authority read use canonical smart HTTP loopback Gitea plus the existing
credential helper. One initial exact-commit fetch used the pre-existing SSH
alias before the new transport restriction was read; no subsequent SSH fallback.
The working local Copilot MCP configuration was not modified.

G0 is delivered; complete DMS implementation, full current-source checks,
live convergence and the R/L/C/S acceptance matrix are not yet delivered.
Historical report test counts are not current tests.
