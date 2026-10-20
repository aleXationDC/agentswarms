# Native standalone Development Builder

Authority: approved plan `f3c198df50181366fa8c8b327f8853c84436e6f6`;
execution request `f6c53b6d65a29ecdadb2baf359b5fa48e67c108e`.
The existing 69-node process and standalone Intake remain unchanged.

`graph.mjs` contains graph configuration, not a dispatcher or runtime.
`builderGraph` uses native Input, Tool, Set Variable, bounded Function
projections, Agent, exact Router, Merge and Output nodes. Functions only decode
MCP response envelopes; exact Routers own all branching and Merge composes the
typed evidence arguments.
`devVerificationGraph` uses native HTTP, Set Variable, Merge, Tool,
exact Router, Approval and Output nodes. There are no Functions, model judges,
hidden waits, automatic retries or custom lifecycle stores.

The two independently callable native Swarms are the concrete `build` and
`verify` stages. The earlier qualification work order describes these as
invocation modes; they are separate published Swarms, not a new mode dispatcher.
An asynchronous Actions result requires a later explicit verifier invocation.
Automatic CI waiting/consumption and bounded corrective reruns are not yet a
qualified native lead-process composition and must not be claimed as delivered.

## Bound native dependencies

Reuse the existing Builder Agent/version provenance:
`306c6741-09aa-46e8-965e-e89a1f6b9254` /
`13668b4b-e54a-4b43-94d7-612547d71077`.
The published process snapshot overrides its historical task-specific prompt;
the reusable standalone prompt has no product paths or fixed business sources.
The actual frozen node configuration is authoritative, not a mutable Agent row.

The existing Development Delivery and UAT Skills are
`834fc6f7-e21f-435d-b3cc-51d5210a3ddc` and
`085e5b49-6fc7-42b0-adf6-574f60f7da13`; Development Standards KB is
`574645b0-1ea3-42a1-b73a-e4746710cfe6`.
The live-compatible skill forwarding repair is
`2140f2f70503d3ae3471f92feb0b186d419a1d50`.

The dedicated MCP server is `aXtn Development Builder Gitea`, native owner-scoped
Registry ID `da000253-0ddf-454e-a616-c2787e6dabd8`.
The separate Reviewer/Audit profiles are documented in Host commit
`25468590052b3589d12889a6b01541d93bdbca37`,
`docs/DEVELOPMENT-ROLE-MCP-20261019.md`.
Graph configuration does not grant Git scope or external Case authorization.

## Build input

Start through the existing authenticated `startCaseSwarm` contract with its
actual Case, published version and fresh operation key. Derive the native
Attempt using the existing contract before configuring the tight profile.
Input JSON supplies:

```json
{
  "caseId": "<existing accountable Work Case>",
  "owner": "aXtn",
  "repository": "axtn-agentswarms",
  "baseline": "<immutable approved baseline SHA>",
  "branchPrefix": "<configured exact task prefix>",
  "effect": {
    "case_id": "<same Case>",
    "attempt_id": "<actual derived native Attempt>",
    "operation_id": "<stable branch operation>"
  },
  "primarySourcePath": "<task-selected complete primary source>",
  "workOrderPath": "<versioned approved work order>",
  "workOrderRevision": "<immutable work order SHA>",
  "formatConfigPath": "<actual repository formatting configuration>",
  "relatedSourcePaths": ["<task-selected smaller sources>"],
  "candidateEvidencePath": "<allowed candidate report>",
  "authorizedPaths": ["<exact configured artifact paths>"]
}
```

Native Tool nodes read the complete primary source, work order and format
configuration; two native projections decode the MCP envelopes before the Agent.
This avoids truncating a large primary file in the model tool transcript without
raising its limit or chunking writes. It is not a general arbitrary-source
fetch loop. The Agent remains responsible for necessary smaller source reads.

Each full-file write needs its own Effect operation and actual Git blob SHA.
The Builder writes only the authorized primary source, then the graph reads it
back and stops before evidence/CI if the source is unchanged, returning an
explicit `NO CANDIDATE` result. The Builder applies only source transformations
explicitly authorized in the task using the supplied pinned formatting
configuration; the existing exact-SHA Dev workflow is the authority for
formatting and test results. The graph creates
the case-, attempt-, baseline-, source- and branch-bound candidate report from
that Git readback, writes it through the same scoped MCP integration, fetches
it back exactly, and requires the evidence commit to be the branch head.
Intermediate commits skip CI; the native final evidence commit triggers the
existing standard workflow. Git success is not Dev success, and technical Run
success does not mean the work contract was fulfilled. Preserve source/Run
evidence when the model returns incomplete or empty output. This remains a
minimum candidate check, not a substitute for exact-commit CI or independent
review.

## Verify input and result gate

Supply the exact candidate SHA, branch, allowed new `evidencePath`, work order
path/revision, accountable Case and actual verifier Attempt Effect.
The native HTTP node reads Gitea's exact-commit combined status with the existing
encrypted secret reference `MODULAR_GITEA_CI_READ`; no secret enters model input.

Pending/failure/error cannot reach result approval. On success, native Set
Variable plus object Merge compose the scoped Git evidence write, followed by
native MCP write-success and file-readback gates. The Approval payload names the
tested SHA separately from the evidence-only commit. This temporary human
Builder-result review is not another plan gate, independent package acceptance,
UAT or deployment permission.

Different exact-router labels use different targets: an unselected duplicate
target is pruned by the current native executor. The actual failed-CI path was
qualified with no Git write and zero Approvals.

Run configuration checks:

```sh
node --test axtn/swarms/axtn-development-builder/graph.test.mjs
```
