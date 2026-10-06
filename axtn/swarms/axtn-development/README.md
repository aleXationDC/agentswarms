# Native Development Swarm V1

Canonical graph: `src/lib/axtnDevelopmentSwarm.ts`. The factory produces visible
native nodes; its Function snippets only validate and shape data. Native graph
levels provide sequencing and the parallel Break/Verify stage. There is no
dispatcher, controller, retry engine or alternate Case/Approval store.

Run `npx tsx axtn/swarms/axtn-development/seed-agents.mts` first with the
protected native owner environment and exact `AXTN_SOURCE_REVISION`. This
provisions the four current roles and their Agent-version/memory records.
Then run `node --experimental-strip-types axtn/swarms/axtn-development/apply.mts`
with `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` and explicit existing
`AXTN_DEVELOPMENT_REVIEWER_USERS` and/or `AXTN_DEVELOPMENT_REVIEWER_GROUPS`
(comma-separated UUIDs). The applier reads each exact saved Agent version and
memory row, imports the representable configuration with the existing native
snapshot helper, and rejects missing versions, dropped restrictions or role
drift. Each graph node retains `agentId: null` and records the exact saved Agent
ID, version ID and configuration-plus-memory fingerprint as provenance. It is
not a live link.
The current saved roles also carry their configured 4096-token output cap;
browser and headless runtimes now honor the same validated node-level limit.

The applier uses owner-authenticated access plus the existing versioned native
publish lifecycle for stable Swarm
`ad06e17d-460b-4b65-946a-9b5d78c6fd02`; it verifies the published version and
readback and is idempotent. It never edits provider integrations or credentials.
Unrecognized draft/published graph changes fail explicitly rather than
replacing operator edits. Publishing the new snapshot leaves existing parked
runs pinned to their original version.

`seed-agents.mts` uses the same protected owner environment plus explicit
`AXTN_DEVELOPMENT_PROVIDER`,
`AXTN_DEVELOPMENT_MODEL` and exact `AXTN_SOURCE_REVISION`. It provisions the
four current Builder/Security/Contract/Maintainability roles as native Agent
Builder objects with native version/memory rows. It neither provisions a fake
Verify Agent nor changes any published Development graph or parked Run.
Existing configuration/memory drift is an explicit error; unchanged reseeds
create no duplicate Agents or versions.

The saved roles retain the **bounded Python fixture** contract. Their presence,
a generic work-contract reference or Candidate Approval does not authorize
general Development. General use still requires a valid exactly versioned
locally accepted Solution Contract and its permitted effects.

Provider/model remain configurable through `AXTN_DEVELOPMENT_PROVIDER` and
`AXTN_DEVELOPMENT_MODEL`, defaulting to the requested existing OpenAI integration
and `gpt-4.1-mini`. No automatic fallback is configured.

The bounded Slice 1 changes `src/normalize_score.py` in
`aXtn/development-swarm-acceptance`, using the existing
`python-normalization-v1` Developer Runtime profile and immutable base SHA.
Input is strict JSON:

```json
{
  "schema": "axtn.development.task/v1",
  "repository": "aXtn/development-swarm-acceptance",
  "baseSHA": "0a38f20ccea94d937a5d4fa2ad18b37ae6439c09",
  "caseId": "<started owner-bound DEVELOPMENT_CHANGE Case UUID>",
  "taskId": "native-normalization",
  "attemptId": "attempt-v1",
  "path": "src/normalize_score.py",
  "request": "Implement normalize_score with finite numeric inputs, bool rejection, ordered bounds and clipping to [0,1]."
}
```

The run Case must already carry the same typed task/base/profile contract.
The native Case tool idempotently ensures a separately measurable Verify Child.
Builder emits Candidate content; effect-bound native MCP nodes materialize a
branch and commit. Three independent reviewer Agents and native Verify run in
one dependency level, inspecting the same Candidate SHA/content hash. An object
Merge joins all four outputs. Findings and runtime Evidence are validated and
persisted before the fail-closed Function gate. FAIL/PENDING/blocking accepted
MEDIUM-or-higher findings cannot reach Approval or PR creation.

## Protected native Approval

`approvalWork` on the existing Approval Node declares flow-state references for
`caseId`, `runtimeSessionId` and `operationId`. Both runtimes use the same
server-side binding to the persisted run snapshot, owner-bound Case,
Candidate/Attempt and protected Developer Runtime receipt. Reviewers are read
from that snapshot, never from prompts or the creation request. The existing
SupaCase trigger enforces authenticated reviewer/group membership, excludes
the Work owner and persisted Builders for both approval and rejection, and
rejects binding edits, stale Attempts and stale receipts. The native inbox
uses the authenticated `decide_swarm_approval` RPC; denial is an explicit error
and changes neither Approval nor Case.

Decision identity, server timestamp, reviewer assignment and full
Case/Attempt/Operation/Evidence binding are audited atomically in the existing
SupaCase audit store. A unique native run/operation index prevents duplicate
requests. No credentials or caller-provided owner identities enter graph state.

Protected canvas runs persist the existing native checkpoint and park. Closing
the tab loses no completed nodes. The existing inbox resumes that same run from
its snapshot through the headless executor; a still-open tab does not race a
second continuation. Resume revalidates the native binding/current receipt.
Approval ID and decision flow to the native PR node. The existing Case
Acceptance contract verifies the later exact open PR from protected Case
references, without mutating the pre-PR Approval payload.

Generic non-work approvals retain their existing behavior. Only the protected
work path requires durable checkpoint success. Missing provider output,
malformed contracts and pending verification fail honestly; no synthetic PASS
or self-acceptance is permitted.

Advisory Evaluate/Learn are deliberately absent until Slice 1 runtime
Acceptance passes. Manual takeover continues through the existing SupaCase
Work/Result contract, not a separate state or approval mechanism.

## Validation

`npm test -- tests/unit/nativeDevelopmentSwarm.test.ts
tests/unit/nativeWorkApproval.test.ts tests/unit/caseWorkAcceptance.test.ts`
checks graph shape, native parallelism, gate contracts and immutable binding.
`tests/case-work/native-approval-roles.sql` is an opt-in real-PostgreSQL test:
load the migration and fixture inside `BEGIN`, run with `ON_ERROR_STOP`, then
`ROLLBACK`. All fixture users, Cases, receipts and decisions are synthetic and
fully rolled back; they are not independent business Acceptance.
