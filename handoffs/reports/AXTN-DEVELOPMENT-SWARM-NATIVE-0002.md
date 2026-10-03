# Native Development Swarm 0002: source/runtime preflight and exact stop

Date: 2026-10-03.
Authority: `37e79a23a55a62aa7f796878fd52239ef59e4128`.
Both `HANDOFF.md` and the complete referenced assignment were reread after
fast-forwarding the clean task worktree.

**Status: NOT IMPLEMENTED / NOT DEPLOYED.**
The first unfulfilled native contract is Candidate materialization:
existing scoped Git write operations lack the mandatory Case/attempt/operation
idempotency binding and recovery contract. No adapter, dispatcher, controller,
provider change or placeholder execution graph was introduced.

## Execution and retained work

- Host: `aleXation`; effective user: `alex`.
- Initial cwd: `/home/alex`.
- Clean worktree: `/home/alex/aXtn-agentswarms-development-native-0002-worktree`.
- Branch: `work/AXTN-DEVELOPMENT-SWARM-NATIVE-0002`.
- Origin fetch/push: `http://127.0.0.1:3000/aXtn/aXtn-agentswarms.git`.
- Authenticated native fetch/ls-remote: PASS; native credential helper retained.
- Gitea loopback health: PASS.
- Old App and Host dirty worktrees: preserved, not copied, staged or reset.
- Existing Parent: `85a1d829-39ac-49bd-9047-163ab52d427b`.
- Idempotently ensured native-rebuild Child:
  `41039014-4a5e-4e8d-873a-2869cebea5f9`.
- Existing production Acceptance Child:
  `11496f0f-360d-4069-b88e-05d34584ab65`.
- Execution channel: `COPILOT_CLI`; current preflight mode: `DETERMINISTIC`.
  Actor label: `axtn-codex`; the native API derives the credential principal.
- The old Graph Child `43d22cf1-8767-40ef-b682-785607e6d724` remains evidence;
  it was not accepted or closed.

The existing Parent is the same overall objective, not duplicated. Its old
OpenAI-credit reason is historical, not an asserted blocker for this rebuild.
Authority and current responsibility events are recorded through `/api/cases/work`.
No independent Acceptance has been supplied by the executor.

## Verified production baseline

| Item | Actual read-only observation |
|---|---|
| App source | `ff43febf35bee35e5a8346e142628e20bdefa5b9` |
| App image | `sha256:4a856a22f273dbdfe8540d461661d60de4d2e942ccee4055158d7c2e6bba4ac1` |
| App state / health endpoint | running, healthy; HTTP 200 |
| Migration ledger | 277 |
| Existing App mount | bind `/etc/agentswarms/egress`; retained |
| Supabase users | 1 |
| User fingerprint | `1a2439d868edf0dd277c38fd4cf123ca` |
| Datasets | 4 |
| Dataset fingerprint | `d29a8a2413cb6dfd2e967732d941d045` |
| Data rows after rebuild Child ensure | 10; only intended Case tracking added |
| Integrations | 2 |
| Integration fingerprint | `ea49665a36a2827ae9bc7505634fbe7c` |

Fingerprints are read-only aggregate MD5 change detectors, not cryptographic
Candidate proof. No credentials, user rows or integration configs are reproduced.
No App/service restart, migration, image replacement or volume change occurred.
Rollback therefore is **not needed**. For a future authorized deployment,
the rollback target remains the exact existing App source/image above and the
accepted native Compose configuration, without removing retained mounts/data.
This is a recorded target, not a tested deployment rollback.

**Host contract discrepancy:** published Host task HEAD
`f36942762e649dd2f345a15b87739887ee40ebe8` still describes App `2801faa7...`
as pending source candidate while separately recording deployed `ff43febf...`.
That superseded candidate is not the base or a deployment target here.
No Host pin was changed before a valid native App candidate exists.
The prior dirty Host remediation is preserved.

## Node-by-node native-conformance matrix

These are source-verified existing contracts, **not a published new graph**.
Code Review Pipeline in `src/lib/swarmTemplates.ts:1875-2045` supplies the
Agent fan-out/fan-in starting pattern. The new slice stops before materialization,
so no lifecycle stage is claimed as newly implemented or runtime accepted.

| Stage | Native contract and evidence | Disposition for this slice |
|---|---|---|
| Task | `input`; headless `swarmExecute.server.ts:532-535`, canvas input branch | Available; not seeded. |
| Build | `agent`; headless `swarmExecute.server.ts:935-945`, canvas `callAgent` | Available; explicit provider/model required. |
| Candidate materialization | `tool:mcp_call_tool`; `swarmNodes.server.ts:149-168`; scoped `create_branch` / `upsert_file` | **STOP:** no Effect-key/replay/recovery contract. |
| Security break | Independent native `agent` | Available; no new inference performed. |
| Architecture/contract break | Independent native `agent` | Available; no new inference performed. |
| Maintainability break | Independent native `agent` | Available; no new inference performed. |
| Deterministic verify | Native `tool:case_work` operation `verify`; `workVerification.server.ts:7-102` | Existing Developer Runtime receipt path; only started owner-bound immutable Verify Work qualifies. PENDING must not be treated as PASS. |
| Fan-out | `swarmGraph.ts:209` onward, dependency levels; headless level workers `swarmExecute.server.ts:1057-1081` | Native mechanism; no custom scheduling. |
| Join | Native object `merge`; headless `swarmExecute.server.ts:550-578`, canvas `swarmRuntime.ts:1743` onward | Available; declared inputs must include all four results. |
| Hard gate | Native sandbox `function`; `swarmRuntime.ts:1474-1524`, headless sandbox branch | Can validate supplied JSON or fail deterministically. Native `condition`/`router` are LLM classifiers, not deterministic receipt authorities. Secure receipt/branch composition is not yet implemented or claimed. |
| Independent Approval | Native `approval`; headless `swarmExecute.server.ts:867-933`, canvas `swarmRuntime.ts:1177-1252` | Existing park/resume; generic payload is truncated `last_output`, not structured `axtnDevelopment` binding. Existing Case-approval protections must not be bypassed. |
| Integration | Native `tool:mcp_call_tool`, scoped `pull_request:create` | Exact head SHA and repo policy exist; same missing external-write idempotency applies. |
| Result | Native `output` | Available; no PR_READY claimed. |
| Evaluate / Learn | Native advisory `evaluate` and bounded `output` | Intentionally deferred until Slice 1 runtime acceptance, per assignment. |

Checkpoint source `src/lib/swarmCheckpoint.ts:12-85` retains context, completed
nodes, dead edges and suspended node. Headless resume uses the run's graph
snapshot (`swarmExecute.server.ts:1162` onward). These do **not** make an
uncertain external write idempotent: a transport failure before completion or
checkpoint persistence can still lead to another native call.

Canvas Approval waits on the inbox in the tab; headless Approval parks with a
durable checkpoint. Cross-executor durable resume equivalence is a required
future acceptance gate, not inferred from one node name.

## File-level salvage disposition

| Existing file/capability | Disposition |
|---|---|
| `src/axtn/workbenches/cases/workContract.ts`, `work.server.ts`, `workVerification.server.ts` | Already present at deployed base; inspected and retained unchanged. |
| `src/utils/notebookRuntime/development.server.ts`, `developmentSource.server.ts` | Already present bounded native verification/snapshot capability; inspected and retained unchanged. |
| Scoped Gitea MCP at `aXtn-git` `4f80994b2c1d85da3ffa96c0f3212bf9f0993ad1` | Existing external capability inspected against live service signatures/policy; not modified. |
| Superseded Task/Candidate/Finding/Review/Evidence/Learning schemas | Potential future file-level salvage only; nothing copied at this stop. |
| Superseded `controller.server.ts`, `development_work` dispatcher and custom lifecycle graph | Forbidden implementation base; nothing copied. |
| Superseded provider/authentication implementation | Not copied or deployed. Not categorically excluded: any reuse requires fresh source/runtime fit evidence. |
| Existing provider integrations and credentials | Preserved unchanged; no provider silently selected, reassigned, removed or replaced. |

## Exact gap and executable evidence

Canonical MCP source:
`aXtn/aXtn-git:mcp/src/axtn_gitea_mcp/server.py:257-290,466-510`.

Live service imports expose exactly:

- `create_branch(owner, repository, branch, from_ref)`;
- `upsert_file(owner, repository, branch, path, content, message, current_sha)`;
- `pull_request(owner, repository, action, ..., expected_head_sha)`.

None accepts a Case/attempt/operation Effect key. A commit message or PR body
can contain a marker, but the service neither validates it nor uses it for
replay, conflict detection or uncertain-write recovery. The existing MCP schema
also has no operation implementing that complete bounded capability.

Live non-secret policy:

- repository: `aXtn/development-swarm-acceptance`;
- tools: `identity,fetch,repository_tree,create_branch,upsert_file,pull_request`;
- mode: `review`;
- paths: `src/*.py,tests/*.py,README.md,docs/*.md`;
- actions exclude merge, delete, deployment and admin.

An isolated test imported the **actual running MCP implementation**, replaced
only its HTTP transport with `AsyncMock`, and submitted identical operations:

| Actual-source fixture | Observed result |
|---|---|
| Two identical file-upsert calls, same Case/attempt marker in message | Two external POST requests; no service replay/readback |
| Two identical PR-create calls, same Case/attempt marker in body | Two external POST requests; no service replay/readback |
| Existing scoped policy suite against live module | **16 tests PASS** |

No real branch, commit or PR was created by these fixtures. Two POSTs do **not**
prove Gitea would create duplicate commits/PRs: it may reject the second request.
They prove the adapter lacks recovery of the prior successful result and the
mandatory idempotency binding. A duplicate conflict is not a recovered result.

Public run initiation idempotency (`tests/unit/swarmIdempotency.test.ts`) and
native checkpoint replay prevention cover different boundaries. Neither binds
this individual external effect or recovers a response lost after a Git write.

## Required bounded decision; no workaround implemented

The assignment explicitly requires stopping at an unexpressible native row.
This is not a generic deployment-approval request.

The smallest specific proposal is **one external capability extension**:
Case/attempt/operation-bound idempotent execution/recovery of the existing
scoped Gitea write operations. It must reject different payloads under the
same identity and return/read back an exact prior result after an uncertain
response. It must keep existing repository/path/effect/protected-branch policy,
without sequencing workflow stages, scheduling retries, deciding acceptance,
holding Case lifecycle state or introducing another control plane.

That proposal needs explicit authorization before implementation. Alternatively,
a source-proven native composition with equivalent effect binding and recovery
may be supplied. Native dependency levels/retries alone are not that proof.
No broader materialization dispatcher or deterministic routing extension is
implicitly requested or authorized by this report.

## Acceptance truth

- Source implementation, image build and full App unit/typecheck/lint gates:
  **NOT RUN**, because no product source changed before the mandatory stop.
- New visible Swarm/publication: **NOT IMPLEMENTED**.
- Intentional live FAIL/PASS runs: **NOT RUN**.
- New headless and durable Approval suspend/resume acceptance: **NOT RUN**.
- Independent Acceptance: **NOT PROVIDED**.
- Deployed App source/image: unchanged, exact baseline above.
- Work Case remains OPEN with a BLOCKED responsibility event; Acceptance and
  Parent remain unaccepted. No executor self-acceptance or completion claim.
