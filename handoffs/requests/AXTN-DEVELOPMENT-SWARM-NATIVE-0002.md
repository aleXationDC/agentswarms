# AXTN-DEVELOPMENT-SWARM-NATIVE-0002

Status: READY_FOR_IMPLEMENTATION
Priority: native capability > standard > reuse > configure > integrate > custom build
Repository: aXtn/aXtn-agentswarms
Branch: work/AXTN-DEVELOPMENT-SWARM-NATIVE-0002
Base: ff43febf35bee35e5a8346e142628e20bdefa5b9 (last documented deployed AgentSwarms source pin)
Superseded implementation branch: work/AXTN-DEVELOPMENT-SWARM-0001

## Objective

Build the smallest actually executable native aXtn Development Swarm:

Task -> Build -> Break + Verify -> Gate -> independent Approval -> PR_READY

Learn is represented only as a bounded improvement-candidate output after a completed run. It must never mutate prompts, graphs, policies or source automatically.

SupaCase is the persistent fachliche carrier. Nodes and tool calls are not Cases. Decomposed work and improvement candidates may be Child Cases. Manual, deterministic and semantic execution use the same work/result contract.

## Hard stop on the superseded implementation

The previous branch is evidence and salvage input only.

Do not copy or revive:

- src/axtn/development/controller.server.ts as an orchestrator;
- the development_work stage dispatcher;
- a graph that models all lifecycle stages as the same custom Tool;
- custom sequencing, fan-out, retry, checkpoint, approval or acceptance logic;
- ChatGPT/OpenAI-plan authentication or provider-specific integration;
- any second workflow, Case or state control plane.

Do not delete or rewrite the previous branch.

Potentially reusable only after a file-level review:

- immutable Task/Candidate/Finding/Review/Evidence/Learning schemas;
- SupaCase headless work contracts;
- scoped Gitea-MCP and Developer-Runtime bindings;
- deterministic verification harness;
- tests and secret-free evidence.

## Verified native starting points at the branch base

Use source contracts, not UI assumptions.

- src/lib/swarmTemplates.ts:
  - approval-durability-check proves native input, agent, approval, condition and output;
  - support-copilot proves native router, retrieve, agent, evaluate, condition, approval and output;
  - bundled templates cover input, set_var, tool, agent, extract, foreach, merge, loop, http, function, router, condition, retrieve, evaluate, approval and output.
- src/lib/swarmGraph.ts:
  - topological dependency levels provide native parallel execution;
  - parallel writes are deterministically reduced in level order;
  - condition/router own branch selection and may not continue on error;
  - retry policy is native and bounded to five attempts and 30 seconds delay;
  - foreach and loop limits are native;
  - sub-swarm depth is bounded by MAX_SUBSWARM_DEPTH = 3.
- src/lib/swarmCheckpoint.ts:
  - context, completed/skipped nodes, dead edges, level and suspended approval node are checkpointed;
  - completed nodes must not rerun after resume.

Before editing, inspect the corresponding headless executor contracts and tests at this exact base. Canvas behavior alone is insufficient.

## Mandatory implementation shape

Start from the native Code Review Pipeline pattern and the verified templates above. The visible graph must use native node kinds directly.

Minimum intended disposition:

| Stage | Required native representation |
|---|---|
| Task | input |
| Build | agent |
| Candidate materialization | existing scoped tool/MCP operation; thin adapter only if no registered native tool can express it |
| Security break | agent |
| Architecture/contract break | agent |
| Maintainability break | agent |
| Deterministic verify | scoped tool against Developer Runtime |
| Fan-out | graph dependency levels, not controller code |
| Join | merge or native level convergence, whichever the headless executor contract proves correct |
| Hard gate | native function/condition composition with deterministic receipt input; evaluate must not decide acceptance |
| Quality score | evaluate, advisory only |
| Human decision | approval with durable suspend/resume |
| Integration | scoped Gitea tool limited to branch, allowed paths and PR creation |
| Result | output |
| Learn | output of Improvement Candidates with autoExecute=false; optional Child Cases only |

If a row cannot be implemented with a proven native contract, stop at that row and report the exact source/runtime gap. Do not fill the gap with a controller or dispatcher.

## Independence and acceptance rules

- Builder identity may not approve or accept its own Candidate.
- Breakers inspect one immutable Candidate revision and content-hash set.
- Deterministic verify is authoritative for build, tests and contract checks.
- evaluate is probabilistic and advisory; it cannot turn a deterministic failure into PASS.
- Integrate means create/update a task branch and reviewable PR only.
- The Development Swarm itself may create a task branch and reviewable PR only; it may not merge, release, deploy or write to target PROD systems. This restriction does not prohibit deploying and testing the AgentSwarms product change under the explicit Greenfield PROD authorization below.
- No PROD credentials are available to Builder or Breakers.
- All write tools are allowlisted by repository, branch/effect and path.
- Every external write requires an idempotency key derived from Case, attempt and operation.
- A resumed run must not repeat a successful write node.
- Provider selection remains configurable and provider-neutral. Do not add or modify OpenAI integration. Do not silently assign Gemini or any other provider.

## SupaCase contract

One Parent Case represents the overall development request.

Create Child Cases only for independently ownable work:

- implementation task(s);
- acceptance/run;
- unresolved defect requiring separate work;
- verified improvement candidate.

Do not create Cases for individual nodes or tool calls.

Required references/events:

- parent_case_id and child_case_id;
- swarm_id, run_id and attempt_id;
- repository, base SHA, candidate SHA, branch and PR;
- execution mode: semantic, deterministic or human;
- actor and credential principal as separate fields where available;
- transitions, blocking reason and final outcome;
- evidence references, not duplicated logs.

A manually completed Child Case must satisfy the same typed result and evidence contract as an automated completion.

## First executable slice

Do not implement the whole conceptual blueprint first.

Slice 1 must be visible in AgentSwarms and runnable on the canvas and headlessly:

input -> Builder agent
      -> [Security agent, Contract agent, Maintainability agent, deterministic Verify tool]
      -> native join
      -> hard gate
      -> Approval
      -> bounded Gitea PR tool
      -> output

The rejection/failure branch must return findings and leave the Case OPEN or BLOCKED. It must not create a PR.

Only after Slice 1 passes runtime acceptance may advisory evaluate and Learn be added.

## Required tests

1. Graph inventory test proves there is no development_work dispatcher and no custom orchestration controller.
2. Every lifecycle stage maps to its native node kind.
3. Three breaker nodes and Verify execute in the same dependency level.
4. All four results are present before the gate.
5. Builder cannot supply approval.
6. Deterministic failure always blocks, regardless of evaluate score.
7. Medium-or-higher accepted blocking findings prevent PR creation.
8. Approval suspends and resumes without rerunning Builder, Verify or write nodes.
9. Rejection fails or blocks cleanly with the reason retained.
10. Duplicate initiation and duplicate callback do not duplicate Cases, branches, commits or PRs.
11. Manual result submission uses the same result validation.
12. Headless and canvas executors produce equivalent branch decisions.
13. Unauthorized repo/path/effect and PROD attempts are denied.
14. Evidence binds Case, run, attempt, graph hash, candidate SHA, runtime digest and test receipt.
15. Provider errors block honestly without fabricated output.

## Direct Greenfield PROD implementation and acceptance

Implementation, deployment, live testing and bounded repair in the existing Greenfield PROD system are explicitly authorized by this request. Do not stop merely to ask again for deployment permission.

Required sequence:

1. record the current App source pin, image digest, schema ledger, mounts and relevant data fingerprints without secrets;
2. implement and test the native first executable slice on this branch;
3. produce the node-by-node native-conformance matrix and file-level salvage list;
4. build an immutable candidate image and record its digest;
5. deploy only the AgentSwarms App changes and additive migrations required by this slice; preserve SupaCase data, Cases, integrations, MCP configuration, users and existing mounts;
6. seed/publish the native Development Swarm so it is visible in the AgentSwarms UI;
7. execute and retain in SupaCase at least one intentional FAIL run and one PASS run, including Child Cases, transitions, evidence links and human/semantic/deterministic execution modes;
8. prove headless execution and durable approval suspend/resume in PROD;
9. repair failures in the same bounded scope and rerun acceptance;
10. close completed implementation/test Child Cases and leave genuine unresolved blockers OPEN/BLOCKED;
11. update aXtn-host to the exact immutable AgentSwarms pin and rollback contract;
12. push all source and secret-free evidence to Gitea.

No merge to main, release, destructive data migration or unrelated platform change is authorized. Roll back the App image if the bounded slice cannot be made healthy without expanding scope. Do not remove retained test Cases: they are operational and measurement evidence.

## Completion response

Report only:

- exact commit SHA;
- changed files;
- native node inventory actually used;
- tests and results;
- remaining platform gaps;
- previous and deployed PROD source/image pins;
- retained SupaCase Case IDs for implementation and acceptance runs;
- live PASS/FAIL, headless and suspend/resume results;
- rollback status;
- remaining genuine platform gaps.
