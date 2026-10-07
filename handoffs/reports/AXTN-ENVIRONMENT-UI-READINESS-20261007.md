# Native UI readiness — DMS recovery follow-up

**Status:** exact recovery sources identified; complete current DMS composition
not installed; no runtime mutation or independent Acceptance.

Authority: clarification at Gitea commit
`ad921802ade26d3a68125f5d65e1745dfc5d09d2`. App work remains on
`work/AXTN-ENVIRONMENT-PATTERN-PILOT-EXECUTION-0001`; its Gitea head at
preflight was `8668c074449a0ce7def01b1c85c9f4afed4f5160`. Host PR #9 remains
`ae1221b693b0f6509ae745876173eb0307511622` on
`work/AXTN-HOST-ENVIRONMENT-PATTERN-PILOT-0001`. Source-of-truth reads used
Gitea; live runtime inspection was limited to source/image labels, catalog
metadata and aggregate execution state. No credentials, prompts, document
bodies, provider settings, Approval payloads or user IDs were read.

The historical DMS is treated as previously functional as reported by the
user. The findings below describe only what can be recovered from the
authoritative Gitea refs and what is present now; they do not revise that
historical account.

## Exact current Environment readback

| Surface | Observed state |
|---|---|
| AgentSwarms | Healthy. Container OCI revision `339a35b940bdffbec3839bbb8dd149482cd43d41`; image `sha256:caa71819ccac64038d0ab511dcf728427668ec46c9df4b854407d0ab50e3cf76`. This matches the App pin in Host PR #9. |
| Host source | Gitea branch `work/AXTN-HOST-ENVIRONMENT-PATTERN-PILOT-0001`, head `ae1221b693b0f6509ae745876173eb0307511622`. Its architecture pin declares the active App revision above. |
| Supabase | Native migration ledger has 297 entries; exact latest entry is `20261006140000_native_case_start_attempt.sql`. The five deployed DMS profile, Approval, current-proposal, Registry-seed and Local-Table-seed migrations match their Gitea source hashes. |
| n8n | Running image `axtn-n8n:2.36.9-imap-2.17.1`, digest `sha256:e6b1f34a3fdcc8ba7398b47e53db8c7c62508a280b00aa6171344114b4614f5c`. Host PR #9 declares source pin `24de6248f13b5fc250482dc8c3b3ef483c91cb55`; the image has no OCI source-revision label. Workflow activation/credential readback was not performed in this pass. |
| Native DMS run/Approval safety | Aggregate read-only counts: zero running Runs, one suspended Run, one pending Approval. No Case, Run, Approval, provider, credential, graph, migration or runtime was changed. |
| Operator UI route | Tailscale maps `https://ops-alexation-one.tailf4170c.ts.net:8446/` to the local App listener; HTTPS requests return 200. This verifies a route only, not an authenticated user session or usable UI. |

## Single dependency list: source → live object → gap

The full machine-readable inventory is
`axtn/swarms/axtn-document-management/dependencies.json`; its
`activeEnvironmentReadback` records the scoped evidence below.

| Dependency | Canonical Gitea source | Present under current native owner? | Gap |
|---|---|---|---|
| Document Management parent | `axtn/swarms/axtn-document-management/graph.mjs`, exact SHA-256 `e4740e0b187e302d091ce0b4175c7b329761387a227e1f6b30226750b26b9c31`; source is present at active App `339a35b9` and current App candidate. | No native Swarm row for recovered ID `9b9ea6c2-a554-4fa7-9c40-908dad632ae7`; no retained parent version or DMS-labelled Run snapshot. | Recovered native definition is not applied/published. Builder needs complete saved Stage Agent versions. |
| Intake Sub-Swarm | `axtn/swarms/axtn-document-intake/graph.mjs`, present at active App `339a35b9`. | ID `62bbd9a0-2fb3-4241-828d-584fa76edc74` exists as a five-node draft; `published_version_id` is null and `is_deployed=false`. | Runtime is the legacy five-node state, not the recovered eight-node Case-bound definition. |
| Privacy Sub-Swarm | `buildPrivacyGraph()` in the recovered DMS `graph.mjs`, present at active App `339a35b9`. | No row for ID `6dcd7938-f9fb-4254-be9e-6f9a06793f0e`. | Definition can be recovered; no native publication or current protected privacy/source-rights binding. |
| Blacklisted-file Cleanup Sub-Swarm | `axtn/swarms/axtn-blacklisted-file-cleanup/graph.mjs`, exact SHA-256 `f307b0ef542b4494aee98a91e5c49b728b754fdb5460e530cb8127d4b7af6640`, present at active App `339a35b9`. | No row for ID `d0c6b64b-6a54-4db3-93ab-11be9d8d93a5`. | No native publication; deletion effect/receipt and current rights remain separate gates. |
| Stage 1 Triage Agent | Expected ID `54edaad4-4726-4781-ae07-5df795434837`; references in the recovered graph and inventory. | No matching `agents` or `agent_versions` row. | No authoritative provider/model, prompt, temperature, tool/guardrail, Skill, KB or saved-version payload. |
| Stage 2 Processing Agent | Expected ID `02482fe8-1970-447a-97d7-8898ab8abaae`; references in the recovered graph and inventory. | No matching `agents` or `agent_versions` row. | Same missing configuration fields. No evidence that Stage 2 reused Stage 1; do not merge the roles or assert historical reuse. |
| Skills | Historical bindings referenced by the Stage Agent dependency contract; native table `agent_skills`. | Zero native Skills. | Exact Skill IDs and content unavailable. No synthetic Skill has been created. |
| Knowledge Bases | Historical Agent bindings absent; native catalog read only as metadata. | Seventeen Knowledge Bases and 49 documents; all are marked samples. | None is an authoritative DMS KB/source. No sample content was rebound. |
| Registry and native tools | DMS graph and Registry seed in the active App source; five DMS migrations are applied. | Three exact owner-bound DMS Datasets exist: Registry 0 rows, Recognition Patterns 0 rows, Classification Values 6 rows. `aXtn Local Table Integration` is connected with `local_table_upsert`. The other registered MCP is the scoped Development Gitea integration. | Registry schema/taxonomy exists, but no live DMS documents or recognition patterns. Provider and Drive effects are not proven by tool presence. |
| Provider/model | Runtime has active integration records for `gemini` and `openai`. | Integration metadata is present; no credentials or config values were read. | Neither credential usability nor the historical model pin was tested. |
| n8n filing/deletion | Pinned n8n source and DMS exports are separately inventoried in Gitea. | Current image is known; workflow/credential state was not freshly read. | Do not claim a Drive filing or deletion execution path until its exact workflow, credentials, rights and readback are inspected through the authorized maintenance-read contract. |

Exact Stage Agent IDs were searched in all fetched Gitea branches and in
current `agents`, `agent_versions`, retained `swarm_versions` and
`swarm_runs` snapshots. Runtime queries returned zero exact Agent/version
rows, zero snapshots containing either ID, zero versions for the recovered
parent, and zero Runs named for Document Management or containing the
historical Stage labels. Gitea matches are references in the recovered graph,
inventory, request and report history (including `7123d0ef`, `6e507811`,
`5eced7e8`, `29036ea3` and `7b480773`), not complete saved Agent payloads.
This is bounded negative evidence, not a claim that no older external backup
could exist.

## Approved Reconstruction v1

Decision `801b96c30b62da7c34374b8cd205af324191313a` explicitly authorizes
provisioning two new bounded Stage Agents, required Skills and Knowledge Base,
exact version snapshots, native publication, deployment and a synthetic
functional/UI demonstration. This authorizes a new version; it does **not**
recover the historical Stage Agent IDs or payloads. The historical provider,
prompts, Skills and KB remain unrecovered.

Implementation is source-controlled under
`axtn/swarms/axtn-document-management/reconstruction-v1.mjs` and
`src/utils/axtnDocumentManagementSeed.server.ts`. The authenticated bootstrap
endpoint is reused; no new credential, dispatcher or registry is introduced.
The owner-scoped seed rejects ID/name ownership conflicts and configuration
drift, creates a non-sample contract KB using the existing embedding pipeline,
saves exact Agent versions, imports nodes using `agentToNodePatch`, and stores
`agentId: null` with saved Agent ID/version/hash provenance. Publication uses
`publishSwarmForOwner`, retaining prior versions and existing Run snapshots.

Provider/model/temperature `openai` / `gpt-4o-mini` / `0` and `max_tokens: 2048`
are explicit Reconstruction v1 settings, not recovered history. Both Skills
and the KB are sourced only from recovered Stage/route/projection constraints
and the approved safety boundary; they contain no customer documents or
invented operational examples. Agents have no effect tools, reject PII and
cannot decide privacy, rights, approval or external effects.

## Privacy, Approval and effect gates

The recovered Privacy graph still references the unregistered
`privacy_preflight` tool. The installed source has a bounded Presidio client
and offline pseudonymizer but no registered resolver, protected
source/rights/coverage receipt or active internal analyzer in the current
runtime. No local detector or caller assertion is substituted for this
authority. Thus `UNRESOLVED` content must fail closed; the synthetic demo must
use an explicit NO_AI path and cannot exercise semantic processing or imply
Stage-Agent execution. Full semantic DMS remains blocked until those already
specified privacy boundaries can be activated through the existing service.
Native DMS Approval binding, current rights, provider credentials/effect
receipt and independent acceptance remain separate. No real file or deletion
effect is authorized by this seed.

## UI evidence boundary and demonstration steps

Source-known native entry routes are `/swarms`, `/agents`, `/skills`,
`/knowledge`, `/documents` and `/cases`, served through the HTTPS Tailscale
App entrypoint above. The active Environment currently has no DMS parent,
Privacy or Cleanup Swarm to open, no Stage Agents/Skills, and the Intake draft
is not published. No authenticated browser/session or browser capture tool was
available in the earlier recovery execution; it did not claim a click path,
reload persistence, tablet view or screenshot.

After the authorized native installation and deployment, the privacy-safe
click path is:

1. In `/swarms`, open Document Management and inspect its published revision;
   open its Intake, Privacy and Cleanup child Swarms from the actual graph.
2. Open `/agents`; inspect each saved replacement Agent's exact version,
   provider/model and the no-tool/no-Skill/no-KB boundary.
3. Return to the Canvas; inspect each `agentSnapshot` ID/version/fingerprint,
   save a controlled draft change, publish a new version, reload and confirm
   the same new version. Keep any existing Run snapshots unchanged.
4. On an existing DMS Work Case in `/cases`, run only the supported NO_AI
   synthetic route, inspect the persisted Case/Run/result and verify reload
   persistence. This route does not execute either semantic Stage Agent. Do not
   create a reporting Case or alter the pending Approval/suspended Run.

This is the pre-install recovery state. The approved Reconstruction v1
implementation and each subsequent install, deploy, UI and Run evidence update
must be recorded below without collapsing source, installation, visibility,
execution and independent Acceptance into one status.

## Approved decision execution — source/test checkpoint

Decision `801b96c30b62da7c34374b8cd205af324191313a` authorized the new
version. The implementation was committed and pushed to the existing Gitea
App branch as `4cc87eb94f231adb1dd7341a8678f123d3920708`. It adds the
owner-bound `seed_dms` action to the existing superadmin-protected bootstrap,
two new Agent Builder objects and manual version snapshots, two Skills, a
non-sample KB embedded/indexed with the connected provider's exact model-space
stamp, and native Parent/Privacy/Cleanup publication through
`publishSwarmForOwner`. No migrations, providers, credentials or other
worktrees were changed.

**Source/test status:** implemented and source-pushed; `npm run check` exited
0: typecheck, 610 test files / 10,005 PASS / 40 SKIP, docs and infrastructure
checks, and production build. Lint passed with the repository's existing 235
warnings. The single missing-tool infrastructure check and 40 skips remain
skips, not runtime passes. Inventory fixtures distinguish the unrecovered
historical Agent IDs from the newly authorized v1 IDs.

**Still pending at this checkpoint:** exact Host-pin update, candidate build
and deployment, authenticated browser proof, owner-bound install/publish
readback and any synthetic Run. The active runtime remains App
`339a35b940bdffbec3839bbb8dd149482cd43d41`; read-only recheck found one
suspended Run and one pending Approval, both preserved. The live Parent
remains blocked on the missing registered `privacy_preflight` resolver and
protected privacy evidence; no semantic Agent execution or real external
effect is claimed.

## Continued reconstruction — graph correction and measured build gate

**Readback time:** 2026-10-07 09:01 UTC. The earlier pre-install and initial
UI sections above are point-in-time evidence; this section supersedes them for
the current runtime and build state.

The approved Reconstruction v1 seed had already installed and published the
Parent and its Intake, Privacy and Cleanup children. Runtime readback before
the run below showed Parent `9b9ea6c2-…` at published version
`341feee6-…` (58 nodes), Intake `62bbd9a0-…` at `35bc8e8a-…` (8 nodes),
Privacy `6dcd7938-…` at `5a0db7a0-…` (3 nodes), and Cleanup
`d0c6b64b-…` at `deb82de4-…` (12 nodes). Two `Reconstruction v1` Agent
versions, their required Skills, and the non-sample DMS contract KB (three
indexed chunks) were also present. The prior seed rerun was idempotent.

### Failed synthetic run and correction

The existing synthetic Case `e6119ef6-9850-4e00-a992-f619e7803f0a` was used;
no duplicate Case was created. Parent Run
`f32988fb-28f2-51da-a6d8-af62a1e0e2a2` on Parent version `341feee6-…`
failed with `DOCUMENT_NATIVE_RUN_FAILED` before the Intake or a child Run
started. Readback found seven graph roots: `ingress` plus six disconnected
duplicate Cleanup nodes. The seven steps made no tool calls and used zero
tokens; no n8n workflow or external effect ran. The existing suspended Run
and pending Approval were not changed.

The local correction removes only those six disconnected duplicate nodes and
their now-unused constants. The connected Cleanup child path remains
`filing_result_route` → `run_blacklist_cleanup`. The added regression test
requires `ingress` to be the only graph root and verifies that connected
Cleanup path. The corrected graph SHA-256 is
`dd584ccb22570fb9372cc4a94252809c567b5ea4a0a4b5c146a1abff64577799`; the
dependency inventory records the same hash.

**Validation:** three focused unit-test files passed (24 tests).
`npm run check` passed typecheck, lint, documentation/infrastructure checks
and the unit suite (610 files; 10,006 passed; 40 skipped). The skips are not
runtime evidence.

### Build investigation

No remote or separately provisioned BuildKit worker is configured: `docker
buildx ls` reports only the local Docker builder (four workers). The
canonical Host candidate helper also builds on this same host; it is not an
independent resource pool.

At measurement, the host had 15 GiB RAM, 6.4 GiB available, and 4 GiB swap
fully occupied; the root filesystem had 19 GiB free. Parallel RSS included
the Copilot process at about 2.8 GiB, AgentSwarms at 308 MiB and n8n at
282 MiB, alongside the other running application, database and support
containers. These services were left running.

The current session cgroup has no configured `memory.max`; its measured
`memory.peak` was 11,356,581,888 bytes and its cumulative `oom_kill` counter
was 51. The containing user slice also has no configured maximum and showed
6.6 GiB current use, a 14,603,075,584-byte peak and 114 cumulative
`oom_kill` events. These are cumulative counters, not proof that every
recorded kill was from this build. Kernel logs were unavailable for
per-process attribution.

A measured 2-GiB Node heap build aborted during client transformation with
V8 `Ineffective mark-compacts near heap limit` / JavaScript heap OOM.
Earlier 3-GiB and 4-GiB heap attempts were killed during chunk rendering;
the session reached the 11.36-GB peak. Raising the heap again on this host
would repeat an unbounded attempt under current memory pressure, so no such
retry was made.

**Concrete build requirement:** provide an isolated builder with 16 GiB RAM
and at least 12 GiB available before build start, retaining at least 4 GiB
for the running host services. This recommendation is based on the observed
11.36-GB session peak, the 2-GiB V8 heap failure, and the default
4-GiB-heap production build; it is not a claim that a build has passed at
that size. No suitable independent builder was available at this check.

### Reviewed authenticated UI evidence

The screenshots copied below were visually inspected before inclusion. They
show the authorized Reconstruction v1 Agent edit and its Skill/KB bindings,
the saved Agent version history, the indexed KB document, and the failed
synthetic Case run. They contain no credentials, browser tokens, user
identity or customer document contents. The old Parent-canvas screenshot
was deliberately excluded because it predates the graph correction.

- [Stage 1 Agent edit](evidence/dms-reconstruction-v1/agent-edit-stage1.png)
- [Skill binding](evidence/dms-reconstruction-v1/agent-skill-binding.png)
- [Knowledge Base binding](evidence/dms-reconstruction-v1/agent-knowledge-binding.png)
- [Saved Agent version history](evidence/dms-reconstruction-v1/agent-version-history.png)
- [Indexed DMS contract document](evidence/dms-reconstruction-v1/knowledge-document.png)
- [Failed synthetic Run on the existing Case](evidence/dms-reconstruction-v1/failed-synthetic-run.png)

These captures prove the earlier authenticated UI state only. The corrected
graph has not yet been installed, shown in the Canvas, or exercised in a new
Run.

### Current handoff status

| Dimension | Status |
|---|---|
| Implemented | Graph correction, regression test and matching source hash exist locally on `work/AXTN-ENVIRONMENT-PATTERN-PILOT-EXECUTION-0001`; not yet committed/pushed at this checkpoint. |
| Tested | Focused tests and `npm run check` passed; production build remains blocked by measured memory headroom. |
| Deployed | No. Host still pins App source `fdd0013c8c2714e832646901aa5698f87fa7aede`. |
| Native graph active | No. The deployed Parent remains the pre-correction published version `341feee6-…`. |
| Authenticated UI | Prior Agent Builder, bindings, version history and KB state were captured; no post-correction Parent Canvas proof yet. |
| Synthetic execution | Failed Run documented above; no post-correction retry yet. The same synthetic Case must be reused. |
| Independent Acceptance | Not performed. |

Next, commit and push the reviewed correction, tests, inventory and this
report to the existing implementation branch/PR #14. Then a successful
production build on the specified adequately provisioned builder is required
before using the existing Host candidate helper. After deployment, install
and publish the corrected Parent through the existing seed, read back its
exact published revision and every child/Agent/Skill/KB binding, then rerun
the same synthetic Case and capture the authenticated Canvas and persisted
result. Preserve the suspended Run, pending Approval, credentials and all
existing data throughout.
