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

## Minimum replacement design — decision required

This is a new-version proposal, **not** a recovered historical configuration
and not yet authorized for provisioning:

1. Keep the recovered Parent, Intake, Privacy and Cleanup graph identities and
   deterministic routing/projection/Approval controls. Do not replace them
   with a hidden dispatcher or parallel registry.
2. If no authoritative Agent export is supplied, create two distinctly named
   native Agent Builder roles with new IDs: `Document Triage (replacement
   v1)` and `Document Processing (replacement v1)`. Preserve the two separate
   Stage contracts in the recovered graph; no evidence authorizes treating
   them as one reused historical Agent.
3. Triage may propose only one of the six already seeded document classes,
   a bounded confidence/abstention result and typed candidate fields.
   Processing may propose only fields accepted by the existing deterministic
   Registry projection. Both agents have no direct effect tools, cannot decide
   privacy/rights/approval/filing, and must abstain on ambiguity. The native
   graph/server remains the authority for validation and effects.
4. Use only the already configured Gemini integration if its normal native
   test succeeds; pin the selected model and exact settings in the new saved
   Agent version. Proposed deterministic settings are temperature `0.0` and
   max output `4096`; these are new choices, not historical facts. Do not
   change provider credentials.
5. Bind no Skills or KBs in this minimal version: none are present and the
   only existing KB content is marked sample. If operational Skills/KBs are
   required, their exact nonsecret source/content and rights must be provided
   or explicitly authorized before provisioning.
6. Save each Agent through Agent Builder, then import its exact saved version
   into the native Canvas using the existing faithful snapshot helper. The
   node must retain `agentId: null` plus saved Agent ID, exact version ID and
   config/memory fingerprint. Updating an Agent requires an explicit new
   snapshot and Swarm publication; existing Runs stay pinned.
7. Exercise only a synthetic document on the existing DMS Work Case, with
   external filing disabled until current n8n workflow/credential/provider
   rights and effect readback have been verified. Keep the current suspended
   Run and pending Approval untouched.

Before this replacement may be provisioned, implement/test the DMS-specific
exact-version import/publish path and obtain the explicit architecture decision
on two new Agent roles, the proposed settings, and intentional absence of
Skills/KBs. Exact historical exports from Gitea remain preferred and may
replace this proposal if they are complete and authoritative.

## UI evidence boundary and demonstration steps

Source-known native entry routes are `/swarms`, `/agents`, `/skills`,
`/knowledge`, `/documents` and `/cases`, served through the HTTPS Tailscale
App entrypoint above. The active Environment currently has no DMS parent,
Privacy or Cleanup Swarm to open, no Stage Agents/Skills, and the Intake draft
is not published. No authenticated browser/session or browser capture tool was
available in this execution. Therefore no click path, reload persistence,
tablet view or screenshot is claimed.

After the decision, native installation and authorized deployment, the
privacy-safe click path is:

1. In `/swarms`, open Document Management and inspect its published revision;
   open its Intake, Privacy and Cleanup child Swarms from the actual graph.
2. Open `/agents`; inspect each saved replacement Agent's exact version,
   provider/model and the no-tool/no-Skill/no-KB boundary.
3. Return to the Canvas; inspect each `agentSnapshot` ID/version/fingerprint,
   save a controlled draft change, publish a new version, reload and confirm
   the same new version. Keep any existing Run snapshots unchanged.
4. On the existing DMS Work Case in `/cases`, start the authorized synthetic
   path and inspect its Case-bound Run/result, then verify reload persistence.
   Do not create a reporting Case or alter the pending Approval/suspended Run.

This sequence is not yet executed. DMS state is therefore **source: recovered
and verified / installed: partial foundations only / UI checked: no /
functional end-to-end: no / independently accepted: no**.
