# Native Case Work composition

`src/lib/axtnCaseWorkSwarm.ts` defines one saved native Processing Proposal
Agent, a reusable proposal sub-Swarm and a visible Case Work parent. This is
new authorized work composition, **not a reconstructed historical DMS Agent**.

The parent reads the same authorized Case/current processing version, bounds
the explicit minimized intent, invokes the saved Agent snapshot through the
native sub-Swarm node, validates the restricted processing patch, applies it
through existing native scope/version/takeover enforcement and records the
native result and linked parent/child Runs. It cannot close or accept a Case,
call providers for physical effects, invent privacy proof or grant Acceptance.

The visible Input node captures the original minimized intent as `intent`.
Preflight explicitly reads that named input; its preceding scope Tool output
is never treated as the user's intent.

The Case workbench shows explicitly published choices/revisions, Canvas,
actual server start, native Run/Attempt, readback and existing Approval resume
links. Allowing machine processing and recording Work as started remain
separate from actual execution. Repeating an exact start reconciles the same
native run-ID claim; a changed request under that identity fails. A deliberate
new attempt uses a new operation key. Native checkpoints/Approval own resume.
For this authenticated entry, the native execution Attempt is the claimed Run
ID, independently of the Case's retained Work/Candidate attempt. Child Runs
inherit it. Existing API-key/Work execution attempt and replay rules are unchanged.

Run `npx tsx axtn/swarms/axtn-case-work/seed.mts` in the existing protected owner
environment with `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, exact `AXTN_SOURCE_REVISION` and explicit existing
`AXTN_CASE_WORK_PROVIDER` / `AXTN_CASE_WORK_MODEL`. Native publication uses the
existing server publisher and its protected service-role environment.
No credential is stored in a graph or printed.

The seed uses native Agent/memory/version and Swarm/version rows, publishes the
sub-Swarm before the parent, preserves operator drift, and verifies exact
published definitions/revision. Second execution is a no-op. Missing historical
DMS settings remain missing; this seed does not substitute for them or prove
the full DMS/Development contracts.
