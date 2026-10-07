# Native DMS recovery sources

`graph.mjs` recovers the Parent and deterministic Privacy graph definitions
from `7123d0ef167e72b39ee39a944e418003a253f50f`. Cleanup is retained separately
under `../axtn-blacklisted-file-cleanup/`. These definitions are **not a complete
seed, runtime activation or production-ready DMS**.

`dependencies.json` inventories exact stable IDs, provenance/source hashes,
native dependencies, observed missing values and separate implementation,
test, deployment and runtime-verification states. Historical Agent, Skill and
Knowledge Base payloads remain unrecovered. The separately approved
`Reconstruction v1` definitions below are new versions, not historical
recovery; demo/predecessor settings and provider credentials are not imported.

## Historical Agent restoration blocker

The inventory marks the exact historical Stage Agent
IDs `54edaad4-4726-4781-ae07-5df795434837` (triage) and
`02482fe8-1970-447a-97d7-8898ab8abaae` (processing) as unrecovered. The
inventory records that the exact later provider/model, prompts, temperatures,
tools, guardrails, Skills and Knowledge Base bindings are unavailable in the
checked sources. A search across all fetched Gitea branches/history found
these IDs only in graph, dependency, request and report artifacts; no saved
Agent or Agent-version payload was present. The earlier live report only
documents partial wiring and does not supply these configurations. Decision
`801b96c30b62da7c34374b8cd205af324191313a` explicitly authorizes the new
`Reconstruction v1` Agents, required Skills and Knowledge Base. Their names,
version labels, prompts and source hashes must never be represented as the
historical payloads.

## Approved Reconstruction v1

`reconstruction-v1.mjs` is the owner-bound source for two bounded proposal
Agents, their two native Agent Builder Skills and a non-sample contract
Knowledge Base. Its contents are limited to the recovered Stage 1/2 projection
and route contracts and the approved safety boundaries; it contains no
customer document or invented historical setting.

Run the existing authenticated bootstrap transport as the configured
superadmin:

```sh
node axtn/swarms/axtn-document-management/seed.mjs
```

The endpoint reuses native Registry, Local Table and Case-bound Intake seed
operations; Skills and KB are owner-bound; the KB is embedded through the
owner's existing connected provider and stamped with the actual model-space
provenance. Missing providers, foreign ownership, name collisions and drift
fail rather than reset existing rows. Agent configurations are saved as
`manual` `DMS reconstruction-v1` versions and imported through
`agentToNodePatch`; the Parent Canvas stores `agentId: null` and immutable
Agent/version/hash metadata. Published snapshots and existing Runs are not
rewritten when an Agent is edited later. The Parent is published only after
the native Children and exact Agent snapshots are persisted.

This seed does not activate real filing/deletion, invent privacy authority or
resolve historical settings. The recovered `privacy_preflight` node still has
no current registered resolver; the local analyzer requires the separately
configured and verified internal Presidio service plus protected
source/rights/coverage evidence. Therefore `UNRESOLVED` input remains blocked.
The seed's deployment or a successful non-privacy route is not a complete
semantic DMS acceptance; current gates are tracked in the UI-readiness report.

The 2026-10-07 Gitea/runtime dependency readback and explicitly non-historical
minimal replacement proposal are recorded in
[UI readiness follow-up](../../../handoffs/reports/AXTN-ENVIRONMENT-UI-READINESS-20261007.md).

The historical applier was deliberately not restored: it required existing
Parent/Privacy/Agents and directly changed published snapshots. The recovery
must use the existing authenticated native publish lifecycle and a complete
dependency-ordered seed, with protected DMS Approval/Case/effect bindings.

The recovered sources include two bounded safety repairs:

- Filing verification requires actual provider file ID, exact name and sole
  target parent to match the explicit instruction. `filed=true` alone cannot
  produce FILED. This check does not substitute for pending revision/rights/
  decision/policy/Approval validation or durable effect fencing.
- Cleanup never defaults to all candidates. It requires a nonempty, duplicate-
  free explicit selection wholly within the offered scope and an Approval
  reference. The reference alone is not approval authority; protected native
  reviewer/receipt binding is still required before activation.

Executed Function-body fixtures live in
`tests/unit/documentRecoveredGraphSafety.test.ts`. Pure recognition recovery
does not automatically seed or activate a learned rule. Full Parent execution,
privacy services, persisted registries, independent review, provider effects
and Learning remain separately gated.

## Protected native Approval adapter

The existing Approval row, IAM reviewer routing and native Suspend/Resume now
have a tested DMS adapter in
`src/axtn/workbenches/documents/documentApproval.server.ts` and additive migration
`20261004100000_document_native_approval_binding.sql`. It is not deployed or
materialized into the recovered graphs.

An Approval node declares `approvalDocument` with `caseId`, `decisionId`,
`operationId` and a literal `operation` (`CLASSIFY`, `FILE` or `DELETE`).
The identifiers may use existing native context interpolation; the operation
may not. A classification step cannot authorize a deletion proposal. The
server derives the binding from protected current Case/Proposal data and
the persisted run snapshot, never client-provided routing or free-text output.
Owner/Builder self-decision is denied; only authenticated routed reviewers
or current members of the routed group can decide. Current proposal and
reviewer authority are rechecked before decided resume. Binding, minimized
proposal, routing and run snapshot remain immutable and auditable.

Callback readback reuses the same native run/operation; cancelled operations
cannot be revived. Human takeover fences machine requests. Machine requests
need protected privacy evidence; claimed `ELIGIBLE` is insufficient. Non-null
Rule/Policy bindings remain blocked until their authoritative adapter exists.
Approval alone proves no provider permission, physical effect or Case closure.
The native checkpoint still can persist context; payload minimization here
does not claim complete DMS trace redaction or retention acceptance.

Tests: `tests/unit/documentApproval.test.ts` and
`tests/integration/documentApproval.sql`. SQL fixtures run only against a
dedicated schema-only test database and roll back; they are not real human
Acceptance or production runtime evidence.

Additive migration `20261004110000_document_current_proposal.sql` extends that
same domain RPC with a protected current Decision/revision pointer per
operation in the existing Case. A new proposal selects its immutable revision
atomically without changing the Case lifecycle. Prior proposals remain
append-only and findable, but their late callbacks cannot reactivate them and
their Approvals cannot resume after supersession. The shared read API exposes
derived `current` status; the manual panel labels non-current proposals.
Machine proposals and all semantic mode transitions require verified
`ELIGIBLE` privacy and may never use a NO_AI manifest, even with a plausible
proof hash. Private legacy delegates have no service/user execute grant.
The additional actual SQL suite is `tests/integration/documentCurrentProposal.sql`.

## Explicit native Registry seed

After additive migration `20261004120000_document_registry_seed.sql`, run
`node axtn/swarms/axtn-document-management/seed-registries.mjs` with the existing
Intake bootstrap environment. This reuses the configured authenticated
bootstrap-superadmin endpoint; the SQL RPC is service-only and the owner is
derived server-side. No new credential, public setup endpoint or CLI MCP change
is needed.

The native owner/name Dataset constraint and same owner advisory lock protect
atomic creation/reconciliation of `axtn_document_registry`,
`axtn_document_recognition_patterns` and
`axtn_document_classification_values`. Existing IDs, unknown column metadata,
operator documents, custom taxonomy values and source filenames are retained.
Malformed/ambiguous metadata or sample collisions fail, not silently reset.
Missing columns are appended; an unchanged second seed writes no audit or
Dataset update.

Only the six historical operational document types are seeded: Rechnung,
Vertrag, Vertragsanpassung, Mahnung, Bescheid and Nachweis. No sample document,
active recognition rule, provider identity, Policy or privacy proof is created.
The seed is explicit, never a side effect of reading the Registry.
Operator-owned identity settings and full native dependency provisioning
remain separate requirements.

Actual isolated role/reseed tests are in
`tests/integration/documentRegistrySeed.sql`. For sixteen-session concurrency
and a new-session replay, use the explicitly isolated test DB environment:

```sh
AXTN_DOCUMENT_TEST_CONTAINER=axtn-native-supabase-db \
AXTN_DOCUMENT_TEST_DATABASE=dms_native_contract_20261004 \
node tests/integration/documentRegistryConcurrency.mjs
```

This proves the bounded Dataset seed, not the complete DMS empty-state or
production restoration gate. The restored historical editor is not blindly
activated: raw provider-safe claims and seed-on-read remain excluded.

## Native Local Table MCP Builder draft seed

Migration `20261004130000_document_local_table_seed.sql` and
`node axtn/swarms/axtn-document-management/seed-local-table.mjs` provision the
existing canonical Python definition under the authenticated bootstrap owner.
The fixed source SHA-256 is checked independently by the server and service-only
RPC. The native slug generator and same owner advisory lock retain one
`aXtn Local Table Integration` app across concurrent seeds and lost-response
replays. Existing app source/configuration, public exposure or foreign server
binding conflicts fail explicitly; duplicate names are never guessed away.
Unchanged reseeds preserve the full app row and emit no new audit.

This is native **draft metadata provisioning**, not deployment or capability
activation. It creates no MCP key, connected server, sandbox or provider
credential and does not change `LOCAL_TABLE_INTEGRATION_MCP_APP_IDS`.
Existing MCP Builder deployment, discovery/approval, single-tool scoped key
and exact app-ID admission remain separate gates. Source availability does not
prove live Registry mutation or the complete fresh-install DMS matrix.
For native internal registration, the existing `mcpAppRegisterInternal` accepts
`tool_allowlist: ["local_table_upsert"]` plus the actual reviewed `tools_hash`.
Only currently deployed approved names can be registered; the native key is
hashed, its connected-server token encrypted, and advertisements narrowed.
The native Builder's internal registration passes the displayed fingerprint
and explicit current tool names. Later tools do not silently expand that key.
This extension does not deploy the draft, approve a tool list or change app-ID
admission. No credentials are returned by internal registration.

Actual isolated role/source/config/owner and sixteen-session concurrency tests:

```sh
AXTN_DOCUMENT_TEST_CONTAINER=axtn-native-supabase-db \
AXTN_DOCUMENT_TEST_DATABASE=dms_native_contract_20261004 \
node tests/integration/documentLocalTableSeed.mjs
```
