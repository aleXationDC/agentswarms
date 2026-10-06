# aXtn — Cross-capability reconciliation and dependency order 0001

Date: 2026-10-06
Status: REPOSITORY_REVIEW_COMPLETE / ORDER_RECOMMENDED / RUNTIME_RECONCILIATION_REQUIRED
Scope: SupaCase, native reusable composition, DMS, Development, Environment Pattern Pilot, Reporting/Capacity/Learning, collaboration.
Authority: Alex requests a complete cross-check and a clean implementation order so existing Patterns build on one another. Gitea only, through the aXtn MCP Connector.
No new runtime test, deployment, live inventory or independent Acceptance was executed by this review.

## 1. Executive finding

The repository has substantial native, tested and partly deployed primitives. The main gap is not absence of all functionality; it is incomplete restoration and assembly into understandable reusable Agent/Swarms and an operable Case-to-execution path.

Three different truths must not be conflated:
1. Native mechanism/source exists.
2. A bounded fixture executed successfully.
3. The intended Environment capability is published, discoverable, authorized and usable end-to-end.

Existing functional-slice evidence supports 1/2 and selected runtime surfaces. It does not establish 3 for the full DMS, reusable Development Agent library or generic agentic Case-work experience. Enterprise/longitudinal proof remains a separate fourth dimension.

## 2. Fresh authoritative baseline

| Artifact | Verified Gitea revision / interpretation |
| --- | --- |
| App PR #14 | 7d7dc0113c4a2e7c0e58a0502ec9fdd22f56525e; all inspected current App paths below unless otherwise noted |
| Reported deployed App | 730439b9794be410870d7133fc58f81d1d849ff4; later report commit is not a deployed-image pin |
| Host PR #9 | a401b498b46b15304b8a4cd89ccdedbba7f98641; current evidence says executing Host source 5a4ff6f1c4aec40bdc4888b324d34b925cf0aa8d |
| DMS PR #11 | 9dbabbed77499e456e87b94205712d1d24d96d43; separate incomplete recovery candidate |
| n8n PR #2 | a8de04ca4acb4418a4f18bf3e5f73d2d93db312c; source/test recovery, not complete active live integration |
| Native-composition correction | f4e1f0722fddc46b6622d55341992ef43551b9c3 on work/AXTN-ENVIRONMENT-PATTERN-PILOT-0001 |

A later Pilot convergence applied compatible DMS/pilot migrations and native fixes. Therefore older DMS NOT_DEPLOYED tables must not be interpreted as proof that every listed file/migration is absent from today's runtime. Conversely deployed shared migrations do not mean the full DMS graph/dependency set is restored. Per-object active state must be freshly reconciled on the Host.

## 3. Read sources

- AGENTS.md; primary Pilot, continuation, canonical P01-P38 definitions, native-composition correction.
- handoffs/reports/AXTN-ENVIRONMENT-PATTERN-PILOT-0001.md: current SC01-SC18, all 35 questions, individual P01-P38 and F1-F4; historical rows are not substituted for current coverage.
- handoffs/requests/AXTN-DMS-RECOVERY-AND-LEARNING-0001.md; DMS HANDOFF and recovery/repository-review reports.
- axtn/swarms/axtn-document-management/{README.md,dependencies.json,graph.mjs}.
- handoffs/requests/AXTN-DEVELOPMENT-SWARM-NATIVE-0002.md; Development V1/Case contracts and current native report.
- axtn/swarms/axtn-development/{README.md,apply.mts}; src/lib/axtnDevelopmentSwarm.ts.
- Issue #10; Case Execution Routing architecture and request.
- src/lib/agentToSwarmNode.ts; src/components/swarms/NodeInspector.tsx; src/lib/swarmRuntime.ts; src/utils/swarmExecute.server.ts; native Agent form/list and Swarm versioning.
- src/axtn/workbenches/cases/{caseContract.ts,caseManagement.functions.ts,caseManagement.server.ts,workContract.ts,caseAssignmentContract.ts,caseProcessingContract.ts,caseExecution.server.ts,CaseWorkPanel.tsx,CaseProcessingPanel.tsx}.
- src/routes/_authenticated/{cases.tsx,cases_.$caseId.tsx,agents.tsx}.
- tests/fixtures/environment-pattern/agentic-case-graph.mjs.
- Current Host PR #9 and n8n PR #2 repository-backed completion/evidence descriptions.

This is contract/source/report reconciliation, not an exhaustive proof that all product code is correct, and not independently repeated runtime evidence.

## 4. Consolidated capability disposition

| Area | Established source/repository evidence | Actual remaining work | Reuse / no rebuild |
| --- | --- | --- | --- |
| Case persistence/identity | axtn_cases and Work RPC; local Parent, Account/Contact/relations, source identities | Native own/shared manual edit diagnosis and clear Work/result/action presentation | Existing rows and native validators; no generic Work-object kernel |
| Lifecycle/processing | NEW/OPEN/WAITING_CONTACT/CLOSED; SEMANTIC/DETERMINISTIC/HUMAN plus ACTIVE/waiting/review | Clear user-visible separation and mode transitions tied to actual execution | Do not replace lifecycle with P23 enum or duplicate DONE truth |
| Responsibility/routing | USER/GROUP/SYSTEM, custody/assignee, execution binding and failure semantics | Verify actual configured route/eligibility for intended users; separate metadata from real credential binding | Existing Issue10 and native integrations; no new payer/router/credential system |
| Agent library | Native saved Agents, form/versioning and import-to-node snapshot | Idempotently publish actual aXtn reusable roles; source provenance and settings parity | Native Agent objects/import, not new registry or live linkage |
| Native Swarm/Sub-Swarm | Native graph/executor/dependencies/Approval/checkpoints/subSwarmId | Publish intended understandable compositions with dependency-ordered recovery and explicit purpose | Existing graph nodes and native composition; no lifecycle hidden in Tool/controller |
| Case -> Swarm | Native Case/run/attempt binding, takeover guards and UI mode actions | Explicit authorized launch/resume/select/open and result trail for named Case-work Swarm | Existing run APIs/Canvas/headless/Work; small UI integration only if missing |
| DMS | Recovered Parent/Privacy/Cleanup sources; existing Intake; native domain/Registry/privacy/Approval repairs | Missing exact Agent/Skill/KB recovery; original-free checkpoints, protected source/rights/privacy receipts, provider effect/recovery; full publication | DMS is reference composition; restore compatible definitions, not unsafe historical behavior |
| Development | Native 31-node first slice; real Verify receipt/parallel reviews/suspended Approval | Saved Agent definitions, fixture-specific scope, accepted Solution Contract precondition and genuine reviewer outcome | Preserve scoped Gitea/Runtime/Case guards; no revival of old dispatcher |
| Reporting | Authorized recursive Case projections; native persisted governed BI snapshot/Refresh/rollback | Clear scope/source labels; deliberate live semantic Case-source integration if chosen | Same query and BI; no ETL mirror/sync/reporting service by default |
| Capacity | Explicit pool/allocation/commitment/consumption/correction and subtree totals | Actual limited authorized bookings/calendars and understandable use | Existing contract; no activity monitoring or state-time-to-hours conversion |
| Pattern/Learning | Native usage/artifact version/R/E/I/outcome/Improvement Work; controlled fixtures | Real reusable artifact evidence, controlled intervention, comparable measured reuse | Git/Agents/Skills/Swarms; no new Pattern registry or automatic promoter |
| Federation | Opaque external triple, scoped matching/minimized handover; local scoped capability exchange | Full portable composition package and eventual genuine authorized peer roundtrip | Existing integration binding and contracts; no global shared hierarchy/control plane |

### Important concrete source findings

1. **Development is native but not the desired library composition.** Its factory constructs Builder and three Breaker Agent nodes directly with embedded configuration. Its native applier upserts/publishes the Swarm but does not provision Agent rows. This explains a legitimate native graph without a matching reusable Agent library; it does not satisfy Alex's specified reusable operating model.
2. **Snapshot semantics are deliberate.** agentToNodePatch writes agentId:null. Later edits to a saved Agent must not silently alter a reviewed/deployed graph. DMS recovery graph separately sets agentId and embeds configuration. Preserve actual guarded runtime behavior and record provenance; do not introduce a universal live-link resolver.
3. **DMS has a real dependency gap.** dependencies.json has recovered:false for triage, processing, skills and knowledge-bases. Parent/Privacy graph sources exist. Historical applier was intentionally not restored because it directly modified published snapshots and required existing dependencies.
4. **Native Approval Guard Regression is explained by Development evidence.** The report retains guard Work/Verify Cases and actual regression runs/checkpoints; it is not an unexplained business Sub-Swarm. Match exact runtime identity before cleanup/classification.
5. **Case editability has domain-specific paths.** cases_.$caseId.tsx selects CaseWorkPanel for source_kind=development_work and DocumentWorkPanel for document_work; other Cases use CaseEditor. Source includes save/update/manual actions. Alex's uneditable observation needs actual Case/status/authority/error diagnosis, not removal of the protected domain contract.
6. **Release to Swarm is not dispatch.** The inspected Work transition only records SEMANTIC/SWARM. The UI must distinguish release/readiness from an actual started/resumed Run.
7. **Development is still fixture bounded.** Its native task validator restricts repository/path/profile to the synthetic normalization acceptance test. This is a valid slice, not a general development service.
8. **Accepted Solution Contract is not proven as an input gate.** Current inspected Work contract carries a generic workContractRef; the Development Task schema/factory lacks an explicit accepted exact Solution Contract check. This review cannot assert absence in every repository path, but cannot credit the mandatory business gate as implemented. Verify and bind existing native contract/Approval records before general Development use. Work contract, Candidate Approval and Solution acceptance are distinct.
9. **Prior seed can overwrite graph differences.** The current Development applier compares graph equality then publishes the generated graph when different. Reconciliation must distinguish authorized known upgrade from operator edits; idempotent same-input behavior alone does not justify silently replacing a user-edited composition.
10. **Evidence retention and test cleanup are different requirements.** Keep business/test Cases and protected Runs/audit; remove only verified disposable working graph duplicates with identity/dependency/cascade/replay checks.

## 5. DMS dependency chain and open gates

The full existing DMS ledger remains authoritative: R1-R17, L1-L24, C1-C13, S1-S7. Do not flatten PARTIAL rows into PASS.

| Dependency group | Current recovery gap | Safe order |
| --- | --- | --- |
| Stable definitions | Parent/Intake/Privacy/Cleanup sources recovered; later semantic Agent/Skill/KB settings unresolved | Complete per-object inventory and bounded authoritative recovery search first |
| Native capability bindings | Registry/Local Table draft/seed exists; actual deployment/discovery/scoped admission unresolved in DMS record | Verify existing runtime state, then reconcile native bindings; no new service |
| Original handling | OCR and analyzer/transform fixtures; accepted language/coverage/current source rights and private runtime binding incomplete | Establish protected privacy/source evidence before real semantic input |
| Agent stages | Exact Stage1 Gemini binding and Stage2 configuration absent in checked recovery authority | Recover authoritative definitions; missing settings stay explicit; replacement is a separate design decision |
| Persist/resume | Native checkpoint fixes exist; DMS context can still contain originals; hydration and storage/retention gaps | Minimize/rehydrate from authorized references before safe full real Parent use |
| Review/proposal | Protected current proposal/Approval adapters, roles and revocation fixtures | Wire native domain graph to current records, not opaque approval strings |
| External effect | Rights/revision/EffectKey/receipt and UNKNOWN reconciliation incomplete | Readback after actual bounded effect; provider success/Case-projection failure must recover projection without repeating effect |
| Full usability | Full dependency seed/publication/empty-state/reseed/real manual fallback/restart not proven | Integrate one coherent end-to-end slice; then original full DMS gates |

Do not declare all these prerequisites user-only external blockers. Missing adapters/wiring/recovery are implementation work; source authorization and independent decision are external gates. Missing authoritative Agent settings are a specific recovery/design decision, not grounds to invent replacements.

## 6. Dependency-ordered implementation recommendation

The sequence is an integration order, not a mandate to freeze all independent work or rewrite completed foundations. Inventory/recovery and external reviewer/source/peer preparation can proceed alongside common integration.

| Order | Work package | Prerequisite | Concrete exit evidence |
| --- | --- | --- | --- |
| 0 | One fresh runtime/artifact/Case inventory and safe baseline | Existing read authority | Exact source/image/schema; product/Sub-Swarm/test classification; preserved originals and rollback; precise local vs external gaps |
| 1 | SupaCase functional contract and manual usability | 0 | Authorized own/shared Case editing, domain Work contract/results, responsibility, Contact/follow-up, revisions, dependency/closure and Human takeover readable and operable |
| 2 | Native reusable definitions and deployment lifecycle | 0; Case tracking from1 | Actual aXtn Agent definitions + Skills/KB/tools where known; dependency-ordered saved/published Swarms/Sub-Swarms; safe reseed/drift detection, descriptions and rollback |
| 3 | Visible native Case-work Swarm and Case launch/resume | 1+2 | Bounded real native proposed action -> enforced same-Case result; explicit selected graph/version/run; Human takeover/stale-result guard; UI and restart |
| 4 | DMS coherent vertical restore | 1+2+3 common seams; DMS-specific recovery/privacy/effect gates | Existing Parent->Intake/Privacy->Agent stages->Review/effect/readback/Case result; safe manual continuation; exact restored definitions and real-source gates explicit |
| 5 | Development operational Blueprint | 1+2+3; accepted Solution Contract and scoped Runtime/Git | Reusable Builder/Breakers; contract-bound intent, native parallel Verify/review/gate and independent Approval->PR_READY; no PROD/merge capability inside Swarm |
| 6 | Common reporting/capacity/pattern use consolidated | 1+3 and completed bounded domain outputs | Same authorized subtree; exact explicit actuals/usage/outcomes; source freshness shown; no double counting or forecast fabrication |
| 7 | Controlled Improvement and portable composition | 2+6; Developer prerequisite for actual code change | Signal -> Case -> approved intervention -> versioned reusable artifact -> measured reuse; package Agent/Skill/Swarm dependencies without secrets; genuine peer when authorized |
| 8 | Empirical forecasting and Enterprise hardening | Actual comparable data and intended operations authority | Honest calibrated EAC/ROI, HA/DR/long-term operations/security/scale; separate from functional pilot |

Stage4 and5 need not block one another: DMS is the architectural reference, not a global requirement to finish every real-source/reviewer gate before preparing Development. After common foundations, execute the first safe end-to-end DMS slice first where its dependencies are available; if exact recovery is blocked, keep that local blocker explicit and continue the independently executable Development integration. Do not use this flexibility to defer source/rights/privacy enforcement.

Stages6/7 already have primitives. Use existing telemetry from stage1 onward and native reusable artifacts from stage2 onward. The sequence delays additional forecasting/automation until trustworthy inputs, not visibility of existing data.

Prepare authorized real-source/reviewer/peer decisions early, so they do not become late surprises; never manufacture them.

## 7. All SC01-SC18 — disposition and dependency

| SC | Existing bounded evidence | Next integration / order |
| --- | --- | --- |
| 01 External reference | Native exact triple and scope/matching/roundtrip fixtures | Preserve in1/3/4; real peer in7 |
| 02 Processing history | Native atomic audit/clock/Waiting | Present correctly in1; tie actual execution in3 |
| 03 Required Capability | Versioned processing reference | Case-work intent/blocked requirement in3; actual provider commitments later |
| 04 Pattern reference | Versioned native usage/outcomes | Tie actual reusable compositions in2/6 |
| 05 Recursive reporting | Authorized root/subtree/paging, finite deep-tree proof | Reuse in1/6, not new hierarchy |
| 06 Allocation | Explicit private net availability/commitment | Small authorized real plan in6, no private calendar copying |
| 07 Consumption | Explicit idempotent booking/correction | Actual declared booking in6; no monitoring |
| 08 Improvement | Native Work/candidate/relations | Controlled native intervention in7 |
| 09 Evidence/Acceptance | Protected exact-revision native gates | Same shared seam in1/3/domain4/5; genuine decider separately |
| 10 Capability investment | Purpose/artifact/usage fixtures | Real UPLIFT/ASSURANCE provenance in6/7 |
| 11 Pattern registry link | Existing Git/agent_skills/import | Extend portable Agent/Swarm dependencies in2/7; no registry |
| 12 R/E/I | Validated classifications/versioned assurance | Reuse in5/6; ordinal, not invented multipliers |
| 13 Forecast derived metrics | Actuals and honest UNKNOWN | Actuals in6; calibrated remaining/EAC only8 |
| 14 Waiting taxonomy | Native reasons/UNKNOWN/failure codes | Usable block/recovery actions in1/3 |
| 15 Provider contract | Pool/provider/commitment independent of credentials | Preserve in1/6/7; capability promise != credential authority |
| 16 Learning forecast | Experimental disabled/sample counts | Empirical only8 |
| 17 Team recommendation | Evidence/classification, no autonomous composition | Experiment only8; no people ranking |
| 18 Investment return | ROI unknown without baseline | Empirical only8 |

All 35 V6 inventory questions were reconciled against the current Pilot matrix; they must now receive a separate usable-composition/runtime state, rather than reusing mechanism PASS as an operability claim. No new blanket35/38 PASS.

## 8. All P01-P38 — integration ownership

| Pattern | Use existing primitive and prove it in | Remaining distinction |
| --- | --- | --- |
| P01 Secure Intake | Case/domain intake and deterministic admission, DMS4 | Full safe real object admission not generic fixture PASS |
| P02 Identity Separation | Case1, DMS4, collaboration7 | Source/document/external/Case/Run identities independent |
| P03 Persistent Business Object | Case1/3 and both domain flows | Same Work survives runs/takeover |
| P04 Hierarchical Outcome Graph | Existing scoped subtree1/6 | Relations/dependencies not hierarchy descendants |
| P05 Agentic over Deterministic | Case-work3, domain4/5 | Proposal not effect authority |
| P06 Asynchronous Continuation | Existing native run/checkpoint/Approval3/4/5 | DMS raw-context recovery remains specific gap |
| P07 Human Gate | Existing protected Approval3/4/5 | Real decision distinct from fixture/Work completion |
| P08 Fractional Assurance | Bounded specialist Work7 | Genuine independent review/measured effort still needed |
| P09 Portable Workbench | Existing Case UI/API1/6 | UI usability is now explicit acceptance dimension |
| P10 Deterministic Automation | Native graph and n8n4 | No competing lifecycle/transport controller |
| P11 Capability Boundary | Existing IAM/MCP/API1/4/5/7 | Actual effect scope never inferred from assignment |
| P12 Minimum Context | DMS privacy4, minimized Case-work3 | Synthetic token comparison not real privacy authorization |
| P13 IAM/RLS/Authority | Existing custody/responsibility/routing1/3 | Actual configured routes/rights verified per user |
| P14 Evidence/Audit | Existing Case/Run/Git/revision evidence1 onward | Trace retention must survive test cleanup |
| P15 Decision/Evidence/Acceptance | Shared guards plus domain criteria4/5 | Accepted Solution Contract, Candidate decision, final Acceptance distinct |
| P16 Semantic Reporting | Existing native scoped projections/BI6 | Snapshot versus live Case source is explicit decision |
| P17 Agentic Development | Existing native Development5 | Fixture-limited implementation versus general workflow |
| P18 Agentic Change | Controlled versioned definition/config/PR flow5/7 | Existing owner BI edits not autonomous Enterprise change |
| P19 Capability Transfer | Native Agent/Skill/Swarm manifests2/7 | Current transfer evidence covers one skill package, not all types |
| P20 External Reference | Existing environment/opaque refs1/7 | No shared model/hierarchy assumption |
| P21 Work/Capability Federation | Existing scoped request/commitment7 | Genuine peer/transport not local group fixture |
| P22 Capability Composition | Reusable artifacts2/7 | Personal/shared Environments remain separate |
| P23 Processing Telemetry | Existing modes/stages/events1/6 | State duration != consumption |
| P24 Human Capacity | Existing explicit ledger6 | Real availability/actual declaration, no performance surveillance |
| P25 Delivery vs Capability Creation | Existing purpose/artifact usage6/7 | Investment evidenced by reusable artifact |
| P26 Pattern Amortisation | Comparable reuse observations7/8 | No causal economic claim from small synthetic samples |
| P27 Demand Telemetry | Existing scope/waiting/capability/outcomes6 | Unknown forecast stays unknown |
| P28 Learning Loop | Existing Improvement Work/intervention7 | Native controlled process, no auto-promotion |
| P29 Bottleneck Improvement | Same candidate/root-cause path7 | Do not duplicate DMS and generic learner |
| P30 Capacity/Economics | Existing once-only explicit metrics6/8 | Economic forecast needs business inputs |
| P31 Recursive Reporting | Same native query for every root1/6 | Reparent must preserve historical booking/evidence scope |
| P32 Selective Transparency | Existing row/subtree/commitment boundary1/7 | No private ancestors/calendars/count leakage |
| P33 Specialist Investment | Same purpose/usage/evidence6/8 | Actual specialist effort and return separate |
| P34 Predictive Capacity | Existing availability/period primitives6/8 | Real calendar binding and predictive evidence not proven |
| P35 Learning EAC | Same trusted actuals and estimates8 | No fabricated remaining demand |
| P36 Reuse × Complexity | Existing R/E/I5/6 | Classification not an uncalibrated numeric multiplier |
| P37 Failure Semantics | Existing idempotency/denial; DMS readback4 and Git5 | Unknown external effect must not be retried blindly |
| P38 Runtime + Human Core | Existing durable continuation3/4/5 | Long-run operations and Human SLA only8 |

## 9. Explicit architecture decisions — not silently adopted

D1 — Adopt existing native Agent->node snapshot behavior for reusable roles; record configuration provenance using native versions/Git/evidence. User has authorized saved reusable roles and composition. Live binding/runtime resolver is not proposed.

D2 — Case Work Swarm is an explicit user-controlled native agentic entry, not a mandatory global dispatcher for every Case. Human/deterministic actions can directly use existing contracts. User has authorized this visible native entry and actual Case/Run linkage. Automatic universal intent routing is not implied.

D3 — Accepted Solution Contract precondition is required before general Development. Verify/reuse existing exact contract/Acceptance surfaces; any materially new contract entity or Solution Architecture Swarm requires a concrete gap/design decision. A human/partner/external authorized producer is acceptable after local validation/acceptance; no dependency on building our own Architecture Swarm first.

D4 — Live BI Case source remains a bounded decision proposal, not approved by this ordering exercise. Prefer existing authorized Case projections into existing native semantic execution; do not automatically create mirrors, sync engines or custom reports. Snapshot is legitimate if clearly labeled, but not a live dashboard claim.

D5 — Missing historical DMS Agent/Skill/KB settings: exhaust bounded authoritative recovery; if unrecoverable, present a precise replacement-definition proposal. Restoration must not invent historical truth. New canonical configuration is a new version/design decision.

D6 — Preserve existing independent Acceptance rules. No new approval loops for already-authorized additive own-CX correction. Existing actual source/privacy/reviewer/peer gates remain; no self-Acceptance or fake actor.

## 10. Execution and work continuity

Use existing native-composition correction as detailed requirements. The subsequent consolidated request defines sequencing; it supplements, does not erase original Pilot/DMS/Development/Routing contracts.

Retain:
- Pilot Parent 732dec32-082a-423a-85cd-3cdda5ab1341 and its same three execution Children plus independent Acceptance.
- DMS and Development existing Parents/Children as their authoritative reports identify.
- Existing pending genuine Development run/Approval exactly as frozen; publishing a new graph version does not mutate its snapshot or invalidate it silently.
- Local CLI MCP/provider/credentials, source branches/worktrees, Cases/data, original graph/evidence and unrelated services.

One shared integration owner/current compatible worktree; sequential Host convergence and no competing migration/publish writers. Do not merge old documentation trees as product source. Native migration ledger and active deployable candidate must be freshly resolved before each controlled convergence.

Complete each usable vertical slice with actual authenticated UI and headless/native action plus persisted readback/replay/restart appropriate to the change. Work completion may be recorded; Parent independent Acceptance remains separate.

The safe immediate next package is orders0-3, with DMS recovery inventory collected from0 onward. No more disconnected Synthetic swarms as substitutes for product composition.
