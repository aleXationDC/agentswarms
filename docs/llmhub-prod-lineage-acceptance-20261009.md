# LLMHub accepted-production-lineage integration

Assignment: `AXTN-LLMHUB-PROD-LINEAGE-ACCEPTANCE-0001`, authorized by
`handoffs/AXTN-LLMHUB-PROD-LINEAGE-ACCEPTANCE-0001.md` at
`16dc91da61ea6342e9435c8432712f9405af2f0d`. Evidence date: 2026-10-09 UTC.

## Result and authority

The native corrections are **IMPLEMENTED and isolated TESTED** on the accepted
application lineage, not transplanted wholesale from the older predecessor.
Implementation revision: `8ec0d54588d5e16534e8d7ac428d4ea60c3f7e0a`.
Source review: [PR #19](https://git.alexation.com/aXtn/aXtn-agentswarms/pulls/19),
head branch `work/AXTN-LLMHUB-PROD-LINEAGE-ACCEPTANCE-0001-integration`,
base branch `work/AXTN-MFA-REAUTH-REPAIR-0001` at
`ab11bf0e63e91f4c65551a77661f0865e2a0ea0a`.
Assignment/evidence carrier: [PR #18](https://git.alexation.com/aXtn/aXtn-agentswarms/pulls/18).

| State | Evidence / limit |
| --- | --- |
| PREPARED | Accepted-lineage source, review PR, conflict inventory, isolated tests, bounded live-test plan and affected-object inventory |
| IMPLEMENTED | Immutable source revision `8ec0d54588d5e16534e8d7ac428d4ea60c3f7e0a` |
| TESTED | STATIC/MOCK; 234 focused tests pass, build/typecheck/lint/docs pass; full suite retains two demonstrated baseline failures |
| DEV-LIVE / PROD-LIVE | BLOCKED: no current-key rotation attestation and no separate target-environment live-test authorization |
| DEPLOYED | NO; existing PROD container/image/pin remain in place |
| ACCEPTED | NO; independent review/acceptance and release decisions remain separate |

Verified execution identity: host `aleXation`, Linux user `alex`, initial cwd
`/home/alex`. Current host contract is
`aXtn/aXtn-host/architecture/HOST-EXECUTION-CONTRACT.yaml` v3; host checkout
revision `c71260dc20382ac0af1f180ba90ee8ef03b7d7d3`.
Canonical native Git origin is
`http://127.0.0.1:3000/aXtn/aXtn-agentswarms.git`.
Gitea health and scoped repository/PR access work; Issue API access is optional.
Neither token scopes nor MCP configuration were changed.

The actual native runtime is **Prod**, compose project `axtn-native`, not an
implicitly authorized DEV environment. Supabase composition pin is
`058b546b56b665cd95c2e1a872a263cd74faf59c`.
Healthy AgentSwarms container `axtn-native-agentswarms-agentswarms-1` runs
`eb191e152de0132b0107329d7bf444b10150fccb`, image
`sha256:7964d7dba772907902200455c1b7bad37a7bcfedf1d868b0b990991aebd43e87`.
Its start time remains `2026-10-08T10:36:22.796325914Z`.

## Source lineage and conflict inventory

Gitea `main` is `d87a155626d6564416b590bc0e0efb7e8f75436e`, not the running
production source authority. API metadata reports it unprotected; this is not
permission to merge or write it. The accepted reachable successor is
`ab11bf0e63e91f4c65551a77661f0865e2a0ea0a`, existing PR #15. Its source, tests,
schema and dependency manifests equal deployed `eb191e15`; the two intervening
commits are public-login/signup and n8n-owner-access evidence documentation.

There are **504 accepted-lineage commits after `d87a1556`**. Replacing this tree
with predecessor `072c6ec0bc8b50332c9677d226cea7a3b472fc16` would discard native
Case-first routing/credentials, snapshots and token limits, DMS provenance and
exact routing, n8n integration, MFA/signup and other intervening fixes.

Work was isolated in
`/home/alex/aXtn-agentswarms-llmhub-prod-lineage-worktree`, based exactly on
`ab11bf0e`. A scoped `git cherry-pick --no-commit 072c6ec0...` exposed three real
textual conflicts; all were resolved against accepted semantics:

| Touched path | Reconciliation / preserved invariant |
| --- | --- |
| `src/lib/swarmRuntime.ts` | Preserve `agentSnapshot`, max-token handling, native tool configuration and execution; carry node gateway flag |
| `src/utils/swarmExecute.server.ts` | Preserve `decisionId`, server-bound run/node/operation identity, tracer and owner context; add only gateway payload field |
| `src/utils/providers/credentials.server.ts` | Preserve `CaseCredentialContext` and Case-only credential selection; reuse owner-scoped gateway resolver only outside Case-bound routing |
| `src/lib/agentToSwarmNode.ts` | Keep `agentId=null`, immutable snapshot provenance, memory, maxTokens and allowlists; preserve boolean gateway preference, absent/malformed stays absent |
| `src/routes/api/chat.ts` | Keep Case routing/budget/model/tool checks and trusted internal authentication; owner-scoped non-Case gateway; explicit Case gateway fails `ROUTING_DECISION_REQUIRED` |
| `src/routes/api/embed.chat.ts` | Preserve existing published/owner/tool restrictions and carry the saved or explicitly overridden gateway intent |
| `src/utils/providerModels.functions.ts` | Authenticated effective-route discovery; exact model IDs/base paths; reject malformed catalogue; exclude embedding/rerank model types |
| `src/hooks/use-provider-models.ts` | Cache/in-flight requests partitioned by caller, provider and explicit route; errors not cached as successful empty results |
| `AgentForm.tsx`, `ModelCombobox.tsx`, `NodeInspector.tsx` | Existing model/IAM rules and saved exact ID retained; route-aware picker, visible discovery error/retry and native node opt-in |
| `docs/engineering/02-agent-runtime.md` | Document explicit fail-closed opt-in, global best-effort semantics and Case-bound restriction |
| DMS `dependencies.json` | Update only executor candidate-source SHA256 to actual changed bytes; no historical runtime/source claims rewritten |
| Six changed/added unit-test files | Actual native importer, Canvas/headless runtime, credential adapters and model function tested with synthetic HTTP/storage fixtures |

The executor SHA256 is
`384a2fe62161e399c5a33add6289c0f2214735c8a53bea089828b4264a2dc3a4`.
No migration, dependency-manifest, seed graph, IAM policy, credential store or
alternate orchestration/control plane was added or changed.

Explicit node routing overrides linked-agent preference. Explicit `false` does
not disable independent `route_all=true`. Explicit opt-in fails closed if the
executing owner's gateway is unavailable; unsupported signed transports are not
silently routed elsewhere. Existing global route-all lookup remains logged
best-effort, **not egress enforcement**. Gateway streaming short-circuits
unrelated upstream provider credentials.

**Case-bound routing remains server-derived.** A personal/global gateway must
not substitute for the Case's selected routing decision/credential. The shared
transport skips global gateway lookup in Case context and refuses explicit
gateway substitution; chat refuses explicit node/agent gateway opt-in there.
Existing Case execution continues through its native selected credential.
Adding a Case-bound LLMHub route requires a separately reviewed routing decision
contract; no new binding architecture was implemented under this assignment.

## Verification and regression diagnosis

Commands run from the isolated integration worktree, using accepted 1.5.0
dependencies. After a missing-Vitest failure, dependencies were restored using
the existing installation with byte-identical accepted package/lock manifests;
no installation or dependency upgrade was invented.

| Command / profile | Exit | Result |
| --- | --- | --- |
| Original predecessor's exact 15 unit-test selectors below | 0 | 202 tests / 15 files PASS; accepted tests expanded from predecessor's 183 |
| Same profile plus five Case execution selectors below | 0 | 234 tests / 20 files PASS |
| Seed/docs/checksum coupled-regression profile below | 0 | 132 tests / 7 files PASS |
| `npm test` | 1 | 10,085 PASS, 40 skipped, **2 baseline failures**, 619 files; not an overall PASS |
| Pristine `ab11bf0e` failed-selector reproduction below | 1 | 87 PASS / 2 FAIL; same baseline failures |
| `npm run build` | 0 | Client/server production-mode local bundle builds; not a container build or deployment |
| `npx tsc --noEmit`, then `npm run typecheck` | 0 | Generated native routes and full typecheck pass |
| `npm run lint` | 0 | 0 errors / 235 warnings; warnings not suppressed |
| `npm run check:docs` | 0 | 45 pages |
| `npm run check:md-docs` | 0 | 51 files including this report; predecessor's ignored-temp-link issues do not recur on accepted lineage |
| `npm run check:doc-commands` | 0 | 79 documents including this report |
| `npm run check:infra` | 0 | Native checks pass; PowerShell unavailable, one check explicitly skipped |
| `git diff --check`, ancestry/schema/dependency/source-hash checks | 0 | Accepted ancestry retained; no schema/dependency drift |
| Native read-only before/after comparison | 0 | All 36 sanitized metadata records equal; image/revision/health/container start time equal |

Exact original profile:

```sh
npm test -- tests/unit/gatewayRouting.test.ts tests/unit/providerModelGateway.test.ts tests/unit/providerModelCache.test.ts tests/unit/swarmGatewayExecution.test.ts tests/unit/agentToSwarmNode.test.ts tests/unit/swarmPublish.test.ts tests/unit/swarmExecutorParity.test.ts tests/unit/headlessTraceBilling.test.ts tests/unit/iamRules.test.ts tests/unit/iamGrantTypes.test.ts tests/unit/iamModelDefaultDeny.test.ts tests/unit/apiRouteAuthz.test.ts tests/unit/toolLoop.test.ts tests/unit/toolRegistrySafety.test.ts tests/unit/approvalDecisionInFlow.test.ts
```

The 234-test command appends exactly
`tests/unit/caseExecutionCredentials.test.ts`,
`tests/unit/caseExecutionNested.test.ts`,
`tests/unit/caseExecutionBudget.test.ts`,
`tests/unit/caseExecutionFailures.test.ts` and
`tests/unit/caseSwarmStart.test.ts` to that command.
The 132-test command is:

```sh
npm test -- tests/unit/nativeDevelopmentSeed.test.ts tests/unit/inAppDocsAccuracy.test.ts tests/unit/agentToSwarmNode.test.ts tests/unit/gatewayRouting.test.ts tests/unit/providerModelGateway.test.ts tests/unit/swarmGatewayExecution.test.ts tests/unit/caseExecutionCredentials.test.ts
```

The original full integration run had five failures. Three transfer-induced
failures were corrected at their causes: absent gateway preference had been
serialized as `false`, causing native seed reapply drift; the accurate global
route-all documentation literal was lost; executor source bytes changed without
updating the DMS source manifest. An earlier focused failure was an obsolete
resume-test mock missing native Case readback/decision provenance; the mock now
overlays the real Case module rather than replacing accepted runtime behavior.

Two failures remain and were reproduced in a pristine detached `ab11bf0e`
worktree with identical dependencies, using:

```sh
npm test -- tests/unit/docsUseCases.test.ts tests/unit/documentRecoveryInventory.test.ts tests/unit/inAppDocsAccuracy.test.ts tests/unit/nativeDevelopmentSeed.test.ts
```

`docsUseCases.test.ts` expects literal `## Use cases` in `docs/IAM.md`.
`documentRecoveryInventory.test.ts` expects stale router revision `6c13432b`
instead of authoritative inventory
`2bada0814fca2ac719518310cea2ce5113fd0a2c`.
Neither assertion was weakened and neither unrelated baseline defect was fixed.

An initial standalone typecheck ran before native route generation and failed
on generated-route types. The normal build and native typecheck command resolve
that prerequisite and pass. A tool-level `.env` probe was denied by organization
content policy; the excluded file was not read or reconstructed. The ordinary
isolated build subsequently passed without sourcing protected PROD environment.

STATIC/MOCK coverage includes snapshot import, explicit/default/global route
precedence, owner isolation, credential refusal, caller/provider/route cache
isolation, `/v2` and `/v2/coding` base preservation, catalogue/error/timeout paths,
Canvas/headless/published/nested execution and simulated approval resume,
tool-loop/JSON contracts, IAM default-deny and native trace/billing paths.
Synthetic fixtures are **not actual LLMHub inference or tool/schema acceptance**.

Local implementation-run evidence artifact SHA256s (not committed raw logs;
the docs-check artifact predates addition of this report):

| Artifact | SHA256 |
| --- | --- |
| `llmhub-lineage-original-15-final.log` | `071c3763eb24598987a3b85c5e7953483cdf2e32e7869efb318cc3c4675df499` |
| `llmhub-lineage-targeted-final.log` | `71d566cd96974259820eb735d0dea6ce076ad668a9a41a4829e61eb28c0beac6` |
| `llmhub-lineage-regression-fixes.log` | `958def412b659b4d50171a41ac0af1ce5acb1ec71f856f85375fed7cb59efffc` |
| `llmhub-lineage-full-final.log` | `71c38bc1600a3d1b77808d7bcec6d185aee1c9194f98e00d74d4f2d57005453b` |
| `llmhub-lineage-baseline-failures.log` | `e5bb94ef61410c7ab49f4e7a8d9246847505d05c2b5a34315cb82ce49fc44b20` |
| `llmhub-lineage-build.log` | `b20e269d151e4c16313f549af4976dcdd7e3507fb0ffe8ae56ae973d4f9340a8` |
| `llmhub-lineage-lint.log` | `bcbe231844d4ea8ed8a890e8581913b3c6154ff8b830b61686b75934c21fe237` |
| `llmhub-lineage-doc-checks.log` | `78271844fb3ef6c73933e150cc06a3970cdd3cc63ccfe5feb23df1fa9addec55` |
| `llmhub-lineage-preservation-result.json` | `b6d088444599a5fbb34b49c187fd94f7e49883da244c8ba494a524709ef67baa` |

## Current effective models and preserved runtime

Development Swarm `ad06e17d-460b-4b65-946a-9b5d78c6fd02` has four snapshot
agent nodes, all `openai/gpt-4.1-mini`, `agentId=null`, gateway flag absent and
empty tool allowlists. Its legacy `published_at` is present but
`published_version_id=null`; do not claim modern immutable publication or
successful live execution from that timestamp.

| Node / role | Existing source agent ID | Measured LLMHub replacement |
| --- | --- | --- |
| `builder` | `306c6741-09aa-46e8-965e-e89a1f6b9254` | Pending real capability/quality measurement; unchanged |
| `security` | `8955bfae-7816-4e07-9994-3780dbe783db` | Pending; unchanged |
| `contract` | `35b790c1-a936-4a57-97d5-d5d6e3198a7c` | Pending; unchanged |
| `maintainability` | `72fbffb0-7137-444e-a3be-0729a13ae476` | Pending; unchanged |

Case Work parent `e50fd50b-edab-45fb-802a-cd9c7ad1094d` references child
`50df9276-d044-441a-bd89-9e6d75b21de6`; child `propose` remains
`openai/gpt-4.1-mini`, with gateway absent. Published version IDs remain
`3fee099d-2b5a-4454-8104-0bc2a13c7c01` and
`3371e58e-6910-455e-a101-e4e7858956fc`, respectively.
DMS `9b9ea6c2-a554-4fa7-9c40-908dad632ae7` remains version
`811c5e93-2d5e-4b7f-913d-3f8ad19ed243`; `stage1_triage` and
`stage2_processing` remain `openai/gpt-4o-mini` with `kb_search`. Router and
subswarm nodes retain their existing absence of explicit model/provider.

Before/after saved and published graph fingerprints are equal:

| Swarm | MD5 of `nodes::text || edges::text`, same for published columns |
| --- | --- |
| Development | `908b09b96c76c52497867603bcad0d51` |
| Case Work parent | `8e9d3076fcb25837f2b3823c4be2db1e` |
| Case Work child | `c52ec48f9c283348802a3d1a72287ecd` |
| DMS | `a6b169472bfbf0b9055e6e219e10a4a3` |

Historical run `00ff44a5-760c-45dc-a605-7762ba72761a` remains suspended,
approval `afe3d09b-f27b-41ce-a00a-60c82c06e8e3` remains pending with
`decided_by=null`, and checkpoint `approved` retains
`2026-10-04T06:25:29.954694+00:00`. No resume/approval/republication occurred.

## Live-test preparation and outstanding release gates

Protected current integration metadata identifies active gateway
`5936c3dc-6cab-40fc-842c-ea0992dc541d` at
`https://llm-server.llmhub.t-systems.net/v2`, `route_all=false`, and active
vLLM integration `36d6a480-b65f-495e-ba2f-efe6df65353d` at `/v2/`.
Encrypted-key presence and modification timestamps are **not** proof of rotation,
revocation, validity or authorization. No plaintext, ciphertext, key hash or
previously exposed key was retrieved, compared, decrypted or used.

After owner-side rotation/revocation attestation and explicit target-environment
live-test authorization, use the existing protected integration through its
native resolver. The bounded plan is one catalogue GET, then at most five
synthetic inference calls: minimal completion, streamed completion, one existing
JSON/schema contract, one tool-call round trip, one invalid-model negative path.
Use at most two measured catalogue model IDs, single concurrency, 128 output
tokens per call and a 15-second deadline; keep provider/IAM budget limits and
stop on auth, 429, unexpected endpoint/schema or budget denial. No automatic
retry storm or induced rate-limit load. Test `/v2/coding` only if independently
authorized and its advertised/native contract supports it. Preserve the raw
model ID in requests. Record endpoint/schema, capability flags, latency,
finish reason, token/cost observations and sanitized error codes, not content or
secrets. An unpriced model must not be recorded as zero-cost.

Only after those measurements may a per-role model recommendation be made.
The potential change-set is limited to the four source agents and four
Development snapshot nodes above, with exact selected provider/model/gateway
intent and IAM/budget/tool limits recorded. Editing an agent does not update its
reviewed snapshot automatically. No Case Work or DMS model reassignment is
implicit. A Case-bound LLMHub choice additionally needs the reviewed native
routing/credential binding. Do not overwrite the suspended run or its checkpoint.

No release action is authorized here. Before a prospective release: obtain
independent source review and baseline-failure disposition; converge the accepted
lineage through the existing PR chain rather than merging older `main` over it;
record immutable application pin/image and a separate host-owned release
decision. A future deployment must retain current `eb191e15`/image as rollback,
verify private/public login, signup/MFA/Maintenance, native Case credentials,
swarm import/seed idempotency, DMS/n8n and authorized LLMHub acceptance. Any
authorized binding update must retain pre-change saved/published definitions
and restore them through the existing native publication mechanism if required.
No tag, merge, container rebuild/restart, pin edit or productive binding change
was performed.

## SupaCase and review handoff

Parent Case: `6abaffbf-1ccf-4394-aada-d95c49e901de`, stable sourceId
`AXTN-LLMHUB-PROD-LINEAGE-ACCEPTANCE-0001`.
Accountable integration/test Child:
`7f6bc8bc-79ac-4ff4-9177-0191b5b78c36`, sourceId suffix `:integration`.
Execution channel `COPILOT_CLI`, Actor `copilot-cli`, Processing Mode `SEMANTIC`
are separate native dimensions. Candidate, PR #18/#19 and this versioned Evidence
are bound through the existing `/api/cases/work` contract, never direct DB writes.
Native Work completion records only executor delivery, not independent
Acceptance. The Parent remains open for independent acceptance/live/release
gates. Findability and durable transitions are reloaded through the native API;
post-service-restart persistence is not claimed because no restart is authorized.

PR #18 cannot change its head branch in Gitea and descends the predecessor's
older lineage. It receives **report-only evidence**, not the production patch.
PR #19 is the correctly based source integration review. The evidence commit
adds only this report; application bytes remain exactly those tested at
`8ec0d54588d5e16534e8d7ac428d4ea60c3f7e0a`. Both PRs remain unmerged.
Do not deploy or merge PR #18's old-lineage tree as the candidate.
