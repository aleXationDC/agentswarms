# Cross-capability native composition continuation

Status: SOURCE_IMPLEMENTATION_IN_PROGRESS — not runtime-complete or independently accepted.

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

Actual healthy App source is
`730439b9794be410870d7133fc58f81d1d849ff4`,
image `sha256:c9e759c1dd0c79d8f5e189645fbb723822c8f4683470e2bba54635da076f8671`,
ledger 296. Existing Host branch HEAD is
`a401b498b46b15304b8a4cd89ccdedbba7f98641`; previous executing Host source is
`5a4ff6f1c4aec40bdc4888b324d34b925cf0aa8d`.
The Host architecture pin still describes historical `10df3a8`, not the
actual running image. It is not evidence of that old image being active.
Source/image/rollback reconciliation must be updated after candidate convergence.

The authenticated inventory finds 19 owned Swarms and five Agent Builder
objects, all five Demo/Sample Agents. Native Skills: zero. Native KBs: 17,
which does **not** establish historical DMS KB identity or content. The three
canonical DMS Registry datasets do not yet exist in this production DB.
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

| Capability | Implemented/source | Tested | Deployed | Visible/operable | Independently accepted |
|---|---|---|---|---|---|
| Inventory/current contract reconciliation | Actual bounded inventory | Actual owner/protection readback | Existing runtime observed | Existing inventory/UI only | No |
| Manual Case fixes/clear mode vs Run wording | Candidate source | Source checks; actual UI pending | No | Pending candidate | No |
| Saved Development Agents/snapshot/drift | Candidate source/seed | Exact role parity/snapshot tests | No | Pending authenticated provision/UI | No |
| Native Case parent/sub-Swarm/start | Candidate source/seed/UI | Bounded Functions/auth/replay/race tests | No | Pending real start/takeover/result/restart | No |
| Full DMS | Shared native primitives retained | Previous bounded tests retained | No full composition | Historical semantic definitions/effects unresolved | No |
| General Development | Explicitly not enabled | Existing fixture tests retained | Existing fixture only | Exact locally accepted Solution Contract unproven | No |

## Sibling dependencies and concrete gaps

DMS stable Stage 1 Agent `54edaad4-4726-4781-ae07-5df795434837` and Stage 2
Agent `02482fe8-1970-447a-97d7-8898ab8abaae` are absent from actual Agent
Builder. Exact later Gemini model/prompt/temperature/Skills/KB/tools/guardrails
remain unrecovered in the previously checked canonical source/runtime/backups.
The user's Stage 1/Stage 2 reuse recollection is not evidence permitting
collapse of those distinct historic IDs or invented replacement settings.
Parent/Privacy/Cleanup recovery stays separately gated. Native registry/Local
Table prerequisites remain independently actionable after the usable common
slice; real source/privacy/provider-effect authority and reviewer gates are
not manufactured.

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
