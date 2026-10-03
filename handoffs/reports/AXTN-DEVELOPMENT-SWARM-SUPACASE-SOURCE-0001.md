# SupaCase work contract source gate

Work Child: `569f26fe-4799-4548-8c9e-7b74d75eeb63` (STARTED).
Parent: `85a1d829-39ac-49bd-9047-163ab52d427b` (OPEN; not independently accepted).
Branch: `work/AXTN-DEVELOPMENT-SWARM-0001`.
Previous source/evidence checkpoint:
`c7bb6e603d01cc1839fbc041ea8c53c321c33e04`.

## Scope and status

**IMPLEMENTED / TESTED** at source level. **Not yet DEPLOYED or
RUNTIME_VERIFIED** for this work package at this checkpoint. The live application
remains source `189e7960530207415d6cef45c1dd5b3c6e6695ba`, image
`sha256:0ab3e7d7a0e053386c895591c0dd4cb28667bfd938f179a03459b367e6ce6fbd`;
ledger 276 and all eight retained Cases remain present.

The existing connected encrypted OpenAI integration is preserved as the specified
default for the forthcoming graph. This work package changes no provider
credential and introduces no Gemini fallback.

## Implementation

- One existing Case dataset and native audit remain authoritative. The additive
  `20260929030000_axtn_work_contract.sql` wraps the original native RPC without
  editing any previously applied migration.
- Real database roles guard generic row/dataset/event bypasses, deletion,
  identity laundering and the existing SECURITY DEFINER Local Table broker.
  Private aliases are not executable by public/anonymous/authenticated/server
  callers. Dataset cache updates and non-development Case behavior remain intact.
- Typed owned dependencies validate kind, duplicates, self-links and cycles.
  Legacy heterogeneous implementation dependencies retain completion semantics;
  same-Candidate edges and required native Review/Verify contracts enforce exact
  revisions. Relevant failures, new revisions/Attempts, dependency changes and
  accountable Children invalidate affected own/ancestor/dependent gates.
- Trusted authenticated Actor/provenance is supplied outside caller schemas.
  Machines cannot pretend to be Human, continue Human-owned work without release,
  promote an Improvement Candidate or consciously abandon work.
- Native details preserve priority/due/follow-up and Human Critical restrictions.
  Result references, takeover/release, Candidate/Attempt/PR references, completion,
  block/reopen, promotion and conscious abandonment use the same Case.
- Acceptance consumes the existing native Approval and hard receipt. It binds
  owner, task, attempt, Case lineage, current PR head, graph snapshot and protected
  image/harness/input hashes. Generic free-text ACCEPTED and invented hard checks
  cannot substitute. Human Builder provenance survives later Actor changes and
  prevents self-approval/self-acceptance.
- The manual deterministic Verify action derives its request from owned Case
  state, reads immutable source through the existing scoped MCP broker and uses
  the existing isolated runtime. PENDING is explicit; PASS/FAIL creates an
  authoritative receipt reference rather than a fabricated success.
- The native Case detail contains the Work surface; non-development editing,
  existing relations, document assignment and DMS/resume remain separate and
  unchanged. Parent closure rechecks native V1's actual PR_READY endpoint.
- One shared metrics helper measures all producers/scenarios without duplicate
  counters. Primary mode/history and independent Child overlap replace misleading
  final-mode/Parent-overlap shortcuts.

Operating contract:
`docs/architecture/axtn-development-swarm/SUPACASE-WORK-OPERATIONS.md`.

## Executed gates

| Gate | Result |
|---|---|
| Full Unit Suite | 558 files PASS; 9,071 PASS / 40 SKIP |
| SupaCase/runtime/D09 focused scope | 14 files / 97 PASS |
| Latest acceptance/manual/KPI/dialog replay | 4 files / 30 PASS |
| Typecheck | PASS |
| Lint | 0 errors / 235 existing warnings |
| Docs / Markdown / documented commands | PASS |
| Infra | PASS; existing PowerShell-unavailable skip |
| Production build | `npm run build` PASS, unchanged 4096 MiB heap |
| Actual native PostgreSQL policy | PASS; transaction/schema/fixtures rolled back |
| Actual protected credential/signing-secret scan | PASS across source/evidence, task logs, browser assets and runtime logs |
| Current old live app health | HTTP 200 after source gates |

The rollback SQL policy covers real authenticated and server-role bypasses,
claim spoofing, native replay/conflicts, dependencies/cycles, Human Critical,
takeover/release, native receipt/task/attempt/lineage, exact approval, hard failure,
double decision, binding tampering, historical Builder laundering and conscious
abandonment. Its synthetic authenticated decisions are policy fixtures, not a
real independent production approval.

The initial production build and a reduced-heap equivalent were globally OOM
killed. An explicit protected, root-owned temporary 4-GiB build reserve resolved
this; the unchanged production build subsequently passed. No unrelated tmpfs
checkout or service was deleted/stopped. Host mutation/cleanup contract:
`aXtn-host/evidence/development-swarm/20261003T-temporary-build-reserve.md`.

## Next progressive gate, not completion

Publish this tested source, align Host candidate pins, preserve the previous
image/config and data snapshot, apply exactly the new additive migration, then
recreate only the app. Actual authenticated API/UI, policy, KPI, preservation and
restart acceptance are still required before closing this Work Child.

Executable graph/manual semantic consumption and full synthetic/real independent
Acceptance remain subsequent accountable work. No whole-V1 PASS, merge, tag or
release is claimed.
