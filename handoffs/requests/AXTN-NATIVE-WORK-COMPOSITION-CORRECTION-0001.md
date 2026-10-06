# AXTN Native Work Composition — Audit and Correction 0001

Status: REPOSITORY_AUDIT_COMPLETE / CORRECTION_AUTHORIZED / RUNTIME_IMPLEMENTATION_PENDING
Date: 2026-10-06
Repository: aXtn/aXtn-agentswarms
Assignment continuation: Issue #12, App PR #14; coordinate existing DMS Issue #6/PR #11 and Development Issue #7; Host PR #9 only where required.
Authority: Alex explicitly requires intensive verification and correction of native reusable Agent -> Swarm/Sub-Swarm -> Case processing composition. DMS is the reference architecture. User-visible control of agentic Case logic is required. This document does not claim executor launch or runtime repair.

## 1. Verified sources and limits

Fresh Gitea MCP read:
- App PR #14 head: 7d7dc0113c4a2e7c0e58a0502ec9fdd22f56525e.
- Reported deployed App: 730439b9794be410870d7133fc58f81d1d849ff4; runtime proof is executor-reported, not independently repeated by this audit.
- DMS PR #11 head: 9dbabbed77499e456e87b94205712d1d24d96d43.
- Documentation PR #13 head before this correction: 228c18b241cbaa84453f3cd781f5517834f94304.
- User screenshots show 19 My Swarms including repeated Synthetic entries, Native Approval Guard Regression, Development Swarm and Document Intake; Agent Builder shows five platform Demo/Sample Agents and no identifiable aXtn functional Agents. Screenshots are an observed visibility gap, not a complete database inventory.

Read current AGENTS.md and existing primary/continuation pilot requests completely before execution. Existing bounded own-CX convergence authority remains; no new external peer provisioning, credentials, merge/tag/release or independent self-Acceptance is authorized. Import this document only from the documentation branch; do not import its older product tree.

## 2. Source-backed findings

| ID | Finding | Evidence at App PR #14 head | Conclusion |
| --- | --- | --- | --- |
| N1 | Native Agent-library import is a snapshot, not a live link | src/lib/agentToSwarmNode.ts agentToNodePatch copies prompt/model/tools/guardrails/skills and explicitly sets agentId:null; src/components/swarms/NodeInspector.tsx importFromLibrary uses it | Missing Agent cards alone do not prove custom execution. Preserve reviewed deployed snapshots; do not introduce live prompt synchronization. |
| N2 | Development embeds four semantic roles directly | src/lib/axtnDevelopmentSwarm.ts createNativeDevelopmentSwarm constructs Builder and Security/Contract/Maintainability Breaker native agent nodes with embedded prompts/provider/model; factory does not create saved Agent rows or import from library | Native graph execution exists, but independently reusable visible Agent definitions and their composition provenance are not supplied by this factory. Verify actual runtime graph before correction. |
| N3 | Native headless execution and Sub-Swarm mechanism exist | src/utils/swarmExecute.server.ts agent branch calls existing native chat path; subswarm branch resolves subSwarmId; src/lib/swarmRuntime.ts defines both mechanisms | Do not falsely relabel these paths as hidden custom orchestration. Inspect actual graph/functions/tools for orchestration leakage separately. |
| N4 | Full DMS recovery is an explicit outstanding requirement | handoffs/requests/AXTN-DMS-RECOVERY-AND-LEARNING-0001.md inventory and R1/R2/R3/R8; handoffs/reports/AXTN-DMS-REPOSITORY-REVIEW-20261004.md and AXTN-DMS-RECOVERY-AND-LEARNING-0001.md | Published Parent/Children/Agents and exact later semantic settings are not demonstrated complete. Document Intake alone is not the full DMS. |
| N5 | Human release is not a start/dispatch operation in inspected UI | src/axtn/workbenches/cases/CaseWorkPanel.tsx transition(TAKEOVER,true) sets SEMANTIC/SWARM through Work transition; no Swarm choice/start in that handler | Mode change must not be presented as an executed Swarm. Verify other native launch surfaces and provide explicit Case-to-Swarm control. |
| N6 | Pilot F1 is a narrow test graph | tests/fixtures/environment-pattern/agentic-case-graph.mjs proposes ACTIVE/VALIDATION_REVIEW for a fixed synthetic instruction then case_work enforcement/output | This is native effect evidence, not a published usable Case processing workflow. |
| N7 | Pilot graph retention polluted ordinary library | pilot report explicitly retains published synthetic graph/run/audit/usage evidence; screenshots show Synthetic variants in ordinary My Swarms | Preserve evidence without leaving disposable test graph copies as ordinary working compositions. Cleanup needs identity/dependency/cascade checks. |
| N8 | Human editing functions exist in source | CaseWorkPanel.tsx details/TAKEOVER/STARTED/RESULT/COMPLETED and CaseProcessingPanel.tsx save processing | User-observed uneditable Cases require actual user/Case/type/status/visibility and UI error diagnosis; do not claim missing platform editing or bypass protected Acceptance. |

The earlier FUNCTIONAL_SLICES_COMPLETE label applies only to narrow stated tests. It is not complete usable Environment composition or restored DMS acceptance.

## 3. Mandatory native target

- Persist reusable semantic roles as existing native Agent Builder objects, with aXtn names, useful descriptions and their actual constrained configuration.
- Build native Swarms from those definitions through verified existing native import/composition. Native import is a reviewed snapshot: record source definition/version/configuration fingerprint using existing version/evidence facilities; later Agent edits do not silently change deployed Swarms.
- Actual orchestration, branching, parallel reviews, wait/Approval/resume and Sub-Swarm boundaries remain visible native canvas nodes. Function nodes may perform bounded validation/shaping, not hide a lifecycle dispatcher.
- Use real native saved Sub-Swarms for justified reusable deterministic/semantic compositions. Do not arbitrarily split every Node into a Sub-Swarm or every operation into a Case.
- Names distinguish Agent, main Swarm, Sub-Swarm and retained demonstration/test. Descriptions explain purpose, input/output, dependencies, permitted effects, invoked Agent roles and expected Human gates.
- Case remains persistent Work. Human action uses existing Case contracts directly. Agentic Case work runs a named published native Swarm against the same Case/Work contract, with exact execution identity, version, outcome and evidence.
- No new generic scheduler, Federation service, Agent registry, live-link resolver or second Case/control plane.

## 4. Ordered execution

### W1 — Inventory and recovery baseline

Continue the same Parent/Children where responsibilities fit. Use a repair Child only for independently accountable work; no per-Node/per-command Cases.

Freshly verify active source/image, compatible task worktree, current handoffs and existing runtime read authority. Produce one exact inventory:
artifact type/identity/name/purpose/owner-visible scope; authoritative source/version; current stored/published/deployed state; Agent/Skill/KB/Tool/Sub-Swarm dependencies; Case/Run bindings; classification PRODUCT / REUSABLE_SUBSWARM / DEMONSTRATOR / DISPOSABLE_TEST / UNKNOWN.

For DMS retain the canonical inventory:
- Document Management Parent: 9b9ea6c2-a554-4fa7-9c40-908dad632ae7.
- Document Intake: 62bbd9a0-2fb3-4241-828d-584fa76edc74.
- Privacy Preflight: 6dcd7938-f9fb-4254-be9e-6f9a06793f0e.
- Blacklisted File Cleanup: d0c6b64b-6a54-4db3-93ab-11be9d8d93a5.
- Stage 1 Document Triage: 54edaad4-4726-4781-ae07-5df795434837.
- Stage 2 Document Processing: 02482fe8-1970-447a-97d7-8898ab8abaae.

Resolve historic identities/settings using authorized Gitea source and existing recovery evidence. Alex recalls possible Stage-1 reuse in Stage-2: verify it, do not collapse separately recorded IDs or assume different prompts without evidence. Existing report says exact later settings unavailable; do not manufacture equivalent-looking replacements or swap Gemini to Development provider. Preserve explicit unresolved recovery gaps while correcting independently recoverable components.

Trace every Development Agent-role configuration to source and actual runtime. Inspect native Functions/Tools for forbidden custom sequencing. Deterministic verifiers are not artificial Agents; independence of Breaker authority and Approval remains.

### W2 — Reusable Agent and Swarm composition

Idempotently provide the verified semantic roles in the native Agent Builder, named aXtn <role>, accurately described and visible/editable to Alex under legitimate existing ownership/IAM. Reuse exact existing Development prompt/configuration where verified; do not invent expanded capability or permissions.

Recompose or reconcile native Swarms from those saved definitions using existing snapshot import semantics, preserving reviewed settings, graph behavior, Skill/KB/Tool allowlists, memory/privacy boundaries and exact native lifecycle. Save/publish through existing mechanisms and retain the previous working graph/version for rollback.

Restore DMS Parent/Sub-Swarm/Agent composition only where authoritative definitions are recovered and compatible; honor all existing DMS gates. No full DMS acceptance from deterministic restored surfaces alone.

### W3 — Case processing Swarm and user control

Provide a clearly named, described and published native aXtn Case Work Swarm as the visible agentic Case-work entry, reusing existing native primitives and verified domain Swarms. First inspect existing capability/templates; reuse an existing suitable composition if present.

Minimal bounded flow:
authorized selected Case + explicit work intent -> deterministic visibility/scope/input-version/context-minimization validation -> saved aXtn Agent proposes bounded next action or clarification -> native deterministic action/Work enforcement -> persisted result/readback, or explicit Human/Approval wait.

Show native nodes, constrained inputs/outputs and available effects in the canvas. This is not a global automatic dispatcher for all Cases. DMS/Development domain Swarms must keep their own preconditions; every Development change still requires a valid locally accepted Solution Contract. No automatic LLM selection of privileged actions or self-Acceptance.

At the Case, expose the selected permitted published Swarm and its current revision, an explicit launch or existing pending-run resume action, run state/result/evidence and Human takeover. Reuse existing native launch/resume contracts; do not simulate execution by setting SEMANTIC/SWARM. If the minimal Case launch UI binding is missing, document that precise gap and implement the bounded integration within this explicit user-authorized correction. Material new backend/orchestration mechanisms still require a visible decision proposal before implementation.

Manual work and Swarm work persist on the same Case. Human takeover must fence stale Agent effects. Releasing to agentic work must distinguish ready-for-processing from actually resumed/started. Diagnose Alex's uneditable Cases and repair actual defects without weakening protected Acceptance or custody checks. Cosmetic redesign is deferred.

### W4 — Safe test-artifact cleanup

Classify actual IDs and dependency graph before mutation. Names alone are not ownership or deletion authority. Native Approval Guard Regression must be inspected: retain as explicit test Evidence if needed, not unexplained product capability.

Use existing native archive/unpublish/cleanup features where adequate. Before removing a disposable test object, preserve its secret-free versioned definition and needed evidence and verify actual FK/cascade behavior, Run replay, trace/usage links and dependent compositions. Do not delete business Cases, protected Run/audit Evidence, user work or platform samples wholesale. If no evidence-preserving native removal exists, retain the object pending an explicit bounded alternative; do not add a parallel test registry.

Ensure future fixtures reuse stable identities where justified and use reliable finally cleanup for temporary artifacts. Keep only deliberately selected documented demonstrators visible.

## 5. Acceptance evidence

Under Alex's actual authenticated user:
1. Required aXtn Agents are visible, understandable and editable; only legitimate native configured authority.
2. Main/Sub-Swarms have accurate names/descriptions and inspectable native composition; agent snapshots match the saved source configuration for all representable settings, differences disclosed.
3. Case processing can be explicitly launched from its native UI binding; actual Run/Attempt/graph revision and persisted result are attached to the same Case.
4. Human takeover, stale-result rejection and explicit safe return/resume are demonstrated on a bounded synthetic Case.
5. Native Swarm publish/reload/headless/UI compatibility, retry/lost-ACK/concurrency where affected and a true restart preserve definitions, references, configurations and Case data.
6. Ordinary My Swarms is free of verified disposable Pilot duplicates, with required Evidence retained.
7. DMS restoration separately records recovered vs unresolved definitions and real-source/privacy/reviewer gates; no invented full PASS.
8. Reconciliation/seed second execution creates no duplicate Agents/Swarms/Cases and overwrites no user-edited object silently.

Run meaningful checks appropriate to actual changes plus repository-required gates; no blanket repeated test count or source-string-only PASS. Preserve providers, local MCP configuration, credentials, unrelated services and neighboring worktrees. Bounded native own-CX convergence uses existing backup/canary/rollback rules; no bootstrap reset or destructive database restore.

## 6. Deliverables and completion boundaries

Version exact inventory and Node -> saved Agent snapshot -> Skills/KB/Tools -> Sub-Swarm -> Case/Run matrix, individual findings/disposition, changed native artifacts/configuration/source, check results, runtime/UI/restart evidence and rollback.

Update existing Issue #12 / PR #14 and relevant DMS/Development references; same work identities. Report usability and native composition separately from prior functional-slice evidence. Independent Acceptance remains independent. Do not close Parent or claim full DMS/peer/Enterprise proof without their real gates.

No automatic Copilot execution was triggered by publishing this assignment.
