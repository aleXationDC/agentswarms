# aXtn Development Swarm – Repository Handoff

**Canonical repository:** `aXtn/aXtn-agentswarms`
**Canonical branch:** `work/AXTN-DEVELOPMENT-SWARM-NATIVE-0002`
**Branch base:** deployed AgentSwarms source pin `ff43febf35bee35e5a8346e142628e20bdefa5b9`
**Tracking issue:** `aXtn/aXtn-agentswarms#7`
**Status:** `READY_FOR_DIRECT_IMPLEMENTATION_AND_PROD_ACCEPTANCE`
**Authorization date:** 2026-10-03

## Execute this assignment

Read completely and execute:

`handoffs/requests/AXTN-DEVELOPMENT-SWARM-NATIVE-0002.md`

This request is the complete current implementation contract. Issue #7 is the status/index. Repository and verified runtime truth override chat summaries.

## Superseded work

`work/AXTN-DEVELOPMENT-SWARM-0001` is not an implementation base. Preserve it as evidence and inspect individual files only for explicitly allowed salvage.

Do not reuse its:

- `development_work` stage dispatcher;
- `src/axtn/development/controller.server.ts` orchestration;
- graph made primarily from repeated custom Tool nodes;
- custom lifecycle/sequencing/fan-out/retry/checkpoint/acceptance logic;
- unaccepted provider/authentication code from that branch without a fresh source/runtime fit check.

## Mandatory execution order

1. Read root `AGENTS.md` and the complete assignment.
2. Use a clean worktree on the canonical branch; leave unrelated worktrees untouched.
3. Locate the existing Development-Swarm Parent Case by stable assignment/Issue reference. Continue it when it represents this same overall objective; do not duplicate it.
4. Create or continue an independently accountable Child Case for this native rebuild and a Child Case for production acceptance. Keep Copilot CLI as execution channel and record semantic/deterministic/human modes independently.
5. Record current production source/image/schema/mount/data fingerprints and rollback action without secrets.
6. Verify the exact native canvas and headless contracts at the branch base.
7. Implement the first executable slice using visible native nodes. Do not build a controller or dispatcher.
8. Test source, build immutable image, deploy directly to the existing Greenfield PROD environment, publish the Swarm visibly, execute retained FAIL and PASS Cases, repair within scope and repeat.
9. Update the exact immutable AgentSwarms pin and rollback contract in `aXtn/aXtn-host`.
10. Commit and push implementation plus secret-free evidence to Gitea; update Issue #7.
11. Close completed Work Cases. Independent Acceptance remains separate; the Builder cannot accept its own Candidate.

## Authorization

Direct implementation, deployment, live production testing, bounded repair, additive migration, immutable image update and required service restart are authorized.

Do not pause for another generic deployment approval. Do not create a parallel staging/control plane.

The Development Swarm itself remains limited to a task branch and reviewable PR. It receives no merge, release, deletion, protected-branch or target-PROD capability.

Preserve existing provider integrations and credentials. Provider selection must remain configurable and must not be silently added, removed, replaced or reassigned. Provider/authentication changes require source/runtime fit evidence and remain separate from orchestration.

## Genuine stop conditions

Stop only for:

- unavoidable secret exposure;
- destructive change to unrelated or established data;
- required use of an unrelated dirty worktree;
- unavailable privilege that cannot be supplied through the authorized Greenfield configuration;
- a second control plane;
- a genuine native platform gap that would require a custom extension not yet explicitly authorized;
- bypass of repository protection or Builder self-acceptance.

Ordinary defects, missing pins, dependencies, registrations, tests, bindings, ACLs and Greenfield configuration are implementation work to repair, not reasons to return another planning report.
