# AXTN Environment UI readiness execution

**Status:** source changes implemented and verified; not deployed; authenticated
UI evidence not captured; independent Acceptance remains pending.

Authority: `AXTN-ENVIRONMENT-UI-READINESS-0001.md` at
`2c7c8df076a747a617a9ac5b97346fa18f3efd26`. Work continues on the existing
App PR #14 branch `work/AXTN-ENVIRONMENT-PATTERN-PILOT-EXECUTION-0001`. Its
starting source was `6beae0921d461c16415a1016d5b604b644877a4f`; the implemented
candidate is `ee4ffe5e7acbd6c88953f011b4231002cedc326c`. Work is attached to
existing implementation Parent Case `85a1d829-39ac-49bd-9047-163ab52d427b`.
No Case, Run, Approval, production release or independent Acceptance was
created or changed by this work.

## Gap, repair and source evidence

| Area | Implemented source change | Evidence and limit |
|---|---|---|
| Case work | `CaseSwarmPanel.tsx` offers published entry workflows rather than arbitrary published components. Case list/detail make IDs, parent-child lineage and next work more apparent while retaining technical run/evidence details. | Typecheck and full unit suite pass. No authenticated Case UI session or screenshot was available; no new Case or Run was created. |
| Development | `axtn-development/apply.mts` reads exact saved Agent/version/memory rows, checks owner and representable-configuration parity, then uses the existing native publish lifecycle. Graph nodes retain `agentId: null` with saved Agent/version/fingerprint provenance; this is an immutable snapshot, not a live binding. | Snapshot, drift, native-seed and node-limit regression tests pass. The source change is not deployed, so actual Builder visibility and runtime readback remain unverified. |
| Runtime parity | Agent `max_tokens` becomes a validated node output limit in browser and headless execution. | Agent conversion and reachable-node tests pass; valid range is 1–128000. |
| Library | `swarmUsage.ts` and `SwarmGallery.tsx` classify main workflows, components and tests from published graph structure and references, with reversible full/search views. No artifact is deleted. | `swarmUsage` unit tests pass. Existing test definitions and replay evidence were not removed. |
| DMS recovery | The DMS README now records the exact historical Stage Agent blocker and the evidence boundary. Existing Document Intake was not replaced and no incomplete parent was published. | Across fetched Gitea history, IDs `54edaad4-4726-4781-ae07-5df795434837` and `02482fe8-1970-447a-97d7-8898ab8abaae` occur only in graph/dependency/request/report artifacts; no saved Agent or Agent-version payload was found. Provider/model, prompts, tools, guardrails, Skills and Knowledge Base settings are therefore not reconstructible. No substitute historical settings were created. |

The missing DMS Agent versions are a hard recovery gap, not an external
Acceptance gate. Consequently the earlier complete DMS Parent, its bindings,
and the Stage 1/Stage 2 reuse cannot honestly be shown or called restored.
Development source changes also do not replace the locally accepted,
exact-version Solution Contract required before general Development use.

## Verification

- `npm run typecheck`: PASS.
- `npm test`: 609 files passed; 10,001 tests passed, 40 skipped.
- `npm run build`: PASS (existing large-chunk size warnings).
- `npm run lint`: 0 errors, 235 warnings.
- Documentation checks: 45 pages, 50 Markdown files and 78 documented-command
  files checked with no problems. Infrastructure checks passed; PowerShell
  parsing was skipped because PowerShell is unavailable.
- `tests/unit/documentRecoveryInventory.test.ts`: 3/3 passed.
- `git diff --check`: PASS.

## Runtime, UI and acceptance boundary

No deployment, seed execution, runtime mutation, restart or production
convergence was performed. The assignment's reported App/Host pins and active
writer state were not re-read in this execution. No authenticated browser
session or browser binary/automation package was available, so there are no
screenshots or actual-user/tablet UI observations. A server HTTP response is
not treated as proof of authenticated visibility or usability. The source
candidate is not independently accepted.

Host PR #9 was not updated: the unauthenticated local Gitea API request was
denied with HTTP 403, and no authorized PR-editing connector was available.
No access gate was bypassed. App changes remain on the existing PR #14 branch;
no merge, tag or release was made.

## Short demonstration flow after authorized deployment and login

1. Open `/swarms`, use the workflow/component/test views and search, inspect
   the existing Document Intake graph, then distinguish it from the
   unrecovered DMS Parent. Do not present the Intake graph as full DMS.
2. Open `/agents` and inspect a saved Development role/version. In the
   Development Canvas, inspect its `agentSnapshot` provenance and token cap;
   later Agent edits must not silently alter the published snapshot.
3. Open `/cases`, select an existing Case, follow its Parent/Child lineage,
   and inspect the published entry workflow, Run, result and any existing
   human decision. Keep manual Case work available and do not create a
   reporting Case or Run.
4. Leave existing pending Approval and suspended Run state unchanged. Show
   Replay/Takeover only from existing evidence; do not initiate new effects.

This is a proposed click path, not a claim that the UI was actually
demonstrated. UI readiness remains unproven until the three compositions are
visible and operable under the actual user and the DMS restoration gap is
resolved from authoritative Agent-version evidence.
