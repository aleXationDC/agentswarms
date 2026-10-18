# Development Swarm UAT Operations Report

**Status: PARTIAL — the dedicated Development MCP binding and its exact repository/branch/path scope are live and verified. The existing Case-bound Swarm now produced and natively read back candidate `e8f8cafd…`; focused local typecheck/tests pass, but ESLint still reports formatting errors, the latest Maintainability review contradicts the source readback, no CI result is available, and UAT remains policy-blocked. No acceptance or PASS is claimed.**

## Continuation from Handoff `114da1b3f62cfc5be892f03114d681703de715af`

The exact Handoff and its linked Source Audit `AXTN-DEVSWARM-MCP-BINDING-AUDIT-20261018.md` at `276111b79ef9cc2ed5b7a8e5cfcb2284cfa0c3a2` were read. The Handoff was integrated by fast-forward from the prior report commit `d185fb07d8aded2ce039e81b756d91d661524b71`; no history was rewritten.

### Actual Development MCP binding and effective scope

The published Builder uses `mcp_call_tool` with server name `aXtn Development Gitea`. The owner-bound registry row is `73ac0c94-a037-4ba7-b1fa-5a4c395aa482` for owner `83727979-ed5f-4a1b-8090-05e7bc3fe453`, connected to `http://axtn-development-gitea-mcp:8000/mcp`. AgentSwarms' bound server identity/endpoint matches that row. From the AgentSwarms network, the DNS alias resolves to `172.28.0.3`, the same address as the running dedicated container `axtn-native-agentswarms-development-gitea-mcp-1`. Its image ID is `sha256:63799d7f2c0837c8514d15210027d3af14e07506ef74d729c6d02750ae79bec1`, and its source-revision label is `9b700ff5d1cbd8205d356b1413375767f630960a`. This is separate from the general `axtn-gitea-mcp` image `dev-dfbb45a`; inspection of that general service is not used as evidence for the Builder's endpoint.

Live non-secret limits on the dedicated service are:

| Setting | Effective value |
|---|---|
| Readable repositories | `aXtn/development-swarm-acceptance`, `aXtn/axtn-agentswarms`, `aXtn/axtn-architecture` |
| Writable repositories | `aXtn/development-swarm-acceptance`, `aXtn/axtn-agentswarms` |
| Writable branch in `aXtn/axtn-agentswarms` | exactly `work/AXTN-SUPACASE-USABILITY-0001` |
| Writable route used by this Case | exactly `src/routes/_authenticated/cases.tsx` (also other explicitly listed Case/account/contact routes and test/report paths) |
| Allowed tools | `identity`, `fetch`, `repository_tree`, `create_branch`, `upsert_file`, `pull_request` |
| Allowed actions | `identity:call`; `fetch:repo/file/branch/issue/pull`; `repository_tree:call`; `create_branch:call`; `upsert_file:call`; `pull_request:list/create/update/review` |
| Write mode / transport | `review` / `streamable-http` |

No credential or token value was read into the report. `effect` remains optional at the connector API and supplies idempotency when present; it is not external Case authorization. The AgentSwarms native Case start and persisted attempt ID bind the run, but that must not be represented as independent Case authorization enforced by the MCP service. The exact branch allowlist does not admit an effect-derived probe-branch name; no `create_branch` or probe write was attempted.

### Native model comparison and Case product work

The existing graph was not enlarged. Through owner RLS and the normal native publish function, only the Builder model was changed from `vllm/GLM-5.3-Flash` to the already configured `vllm/GLM-5.2` reviewer model for a bounded comparison. Draft and published snapshots matched at 69 nodes/118 edges, published version `a5094bd9-98d5-42ef-93ef-77fbcb5c7aed`; previous version `e9688945-eebe-460d-b48a-3069d045f499` remains available.

The first comparison run, `32a9869d-c08b-57d9-ac55-02fcc2b6b30c`, is persisted for Case `913dbf33-9891-4712-b945-aab9a5cfe5b9` with `case_attempt_id` equal to the run ID, terminal `success`, 69/69 steps, and zero step errors. Its Builder step ran as `GLM-5.2` and recorded two `upsert_file` tool calls plus a `fetch` through the dedicated MCP server. Both writes targeted the existing authorized branch and exact Cases route, using the attempt-derived `operation_id`; native fetch read the result at commit `81f6442e8a015de720aa1949a00a2390c51f6bd7`, blob `f138a3a22a302438b5f69d53ce72bb285ab8a3c3`. The product change exposed `case_access_mode`, made “Mir zugewiesen” depend on `RESPONSIBLE`, and displayed the responsibility signal without deriving it from owner/contact.

Three independent graph reviewers checked `81f6442…`: Security returned no findings; Contract required an explicit “Verantwortlicher” filter; Maintainability reported a blocking memoization issue. The existing Case reference advanced normally from version 21 / `e4ca073195ada22dc378f6da0f300f498f2ebbf2` to version 22 / `81f6442…`.

The follow-up run `3d2063df-6316-50b4-ae83-77993065f691` was also persisted against the same Case with matching run/attempt IDs and terminal `success`, 69/69 steps, zero step errors. It fetched `81f6442…`, performed two `upsert_file` events on the same authorized branch/path with the attempt-bound operation ID, then fetched the resulting file at commit `e8f8cafd15fb7ba563bb344f8ed3a530d0cea3b9`, blob `9c77c63b1d44a5dba39d18196ec8c3411372ecd9` (25,429 bytes). The Case reference advanced from version 22 to version 23 and now points to that exact commit. A separate `git ls-remote` read confirmed the branch head is `e8f8cafd…`.

Native file readback of that commit confirms the previously requested filter is present: `responsible` is carried through query state, `responsibleOptions` derives from `case_access_mode`, the filter UI is rendered, and `responsibleFilter` is applied in the `filtered` memo. The memo dependencies include `cases` and each filter/view/search input. The review graph nevertheless reported blocking HIGH findings that the filter was absent. Those findings contradict the source read back at the exact candidate SHA and remain unresolved review-quality discrepancies; they are not accepted as approvals or silently dismissed. Security returned no findings and Contract returned no findings on this candidate.

The focused validations were run in an isolated local clone at exact candidate `e8f8cafd…` using the same `package-lock.json` SHA as the existing dependency installation:

| Check | Result |
|---|---|
| `npm run typecheck` | passed |
| `npx vitest run tests/unit/supacaseUsabilityAcceptance.test.ts tests/unit/caseAssignment.test.ts tests/unit/caseManagement.test.ts` | passed, 42/42 tests |
| `npx eslint src/routes/_authenticated/cases.tsx` | failed: 11 Prettier-formatting errors at lines 6, 20–24, 133, 321, 336, 502, 525, and 587 |
| Gitea Actions / CI | not verified; no PASS |

Two subsequent Case-bound attempts to address formatting did not change the candidate. Run `46179ac5-ddd7-5dbc-a956-d246cd3865a6` completed with 69 steps and no product write; its Builder emitted no persisted `upsert_file` call. Run `6b5cd3f9-4875-5168-a1c9-92c0343d4a2c` also completed with 69 steps, but the Builder output was empty and had no tool calls. The branch remains at `e8f8cafd…`. Their reviewer outputs include additional claims inconsistent with the same source readback; a valid independent final review is still required. No further identical run should be started without a concrete change to the execution inputs.

### Remaining probe, CI, and UAT boundaries

The connector's single allowed write branch is the product branch, and its allowed path list has no independent harmless probe path/branch. Because the effect-derived branch cannot pass the exact branch allowlist, a distinct synthetic probe remains blocked by existing scope. The real product writes above are Case-bound product work, not a synthetic probe and not proof that the connector itself enforces Case authorization. No scope was widened and no isolated probe file/branch was created.

The three historical Actions run endpoints were rechecked without credentials: runs `164`, `165`, and `166` each return HTTP 403. The official `tea` CLI is not installed in this environment, and no repository-authorized signed-in Gitea Actions read session is available here. **Exact needed operation:** provide the normal repository-authorized read-only Gitea UI/API session for `aXtn/axtn-agentswarms` Actions runs/jobs/logs `164`/`327`, `165`/`328`, and `166`/`329`. No admin credential or Runner reinstallation is requested; none of these runs is treated as terminal or as CI PASS.

UAT remains blocked by the content exclusion on `supabase/supabase@058b546b56b665cd95c2e1a872a263cd74faf59c:docker/docker-compose.yml`. The blocked operation is consuming that exact pinned file as the isolated Host deployment input; its contents were not read, copied, or reconstructed. The existing Host source was previously checked at `aXtn/aXtn-host@cad8500a00995c98707045b04bc337fd351a96aa`: its Supabase target uses the production project and it has no separate `uat` target. **Concrete operator action:** the organization policy administrator must make that exact pinned artifact available through the approved Host deployment path (or supply that exact-provenance input at an approved isolated-runtime location); the Host operator must then configure/use a separately named isolated UAT target in the existing native Compose flow and verify it is isolated before running it. No unverified command or production-target substitution is proposed.

## Continuation from Handoff `f828292285852663cc2075d093a4a6dba8f27574`

The exact Handoff was fetched from `ssh://axtn-gitea/aXtn/axtn-agentswarms.git`; SSH authenticated as `aXtn-copilot-cli`. Its current remote branch was integrated without rewriting history: local report commit `9f0eecf28ec62a0f146ac7a236291bb8a49b7183` and remote Handoff `f828292285852663cc2075d093a4a6dba8f27574` are both parents of merge commit `725a9e51f7ce0909e11b8015a52a1a274ff616a6`. The updated report was subsequently published to that branch over the same SSH remote.

All three PR-#8 work orders were read in full through the existing native Gitea MCP read at the exact architecture ref `14b51ce781eeecfe766f6fe8dd83c0b393b2c2c1`; their native blob IDs match the canonical contract:

| File | Blob |
|---|---|
| `work-orders/AXTN-SUPACASE-USABILITY-0001.md` | `e7b4d81cccb9244210020edda41b16da01d099cf` |
| `work-orders/AXTN-SUPACASE-USABILITY-0001-SWARM.md` | `6488f5fa774a71498f1eecc9152289b3f79dc14b` |
| `work-orders/AXTN-SUPACASE-USABILITY-0001-TEST.md` | `1cb06ac62b73c82f653b113f6041dcfe8c334085` |

### Builder-call diagnosis

The three existing attempts remain `a87f6e56-943d-5154-a408-c384671d81d4`, `380e3746-fc38-5486-a452-d38c51d5969d`, and `4c9c4fc7-5516-54a7-a77e-8cd03b243b70`. Their published snapshots bind the Builder to `vllm/GLM-5.3-Flash`, `enabledTools: ["mcp_call_tool"]`, and the connected server `aXtn Development Gitea`; the current 69-node/118-edge snapshot `e9688945-eebe-460d-b48a-3069d045f499` retains that configuration and the current Builder prompt. The native tool registry exposes `mcp_call_tool` with required `server_name`, `tool_name`, and JSON-string `arguments`, and only offers it when a connected HTTP MCP server is present. The graph's native Gitea reads succeeded.

For all three Builder steps, persisted run evidence has assistant text but no tool-call event/frame. No `create_branch` or `upsert_file` was sent, so there is no connector rejection or parser error attributable to these attempts. The traces do not persist the effective per-request tool schema, raw tool-call frame, or provider `finish_reason`; the exact stop reason cannot be reconstructed. Completion-token counts (4,096 per response in the first attempt; 32,768 and 3,820 in the second; 18,806 in the third) do not by themselves prove a token-limit stop. These results identify a model response without an emitted/recorded tool call; they do not prove an allowlist denial. No identical Builder run was repeated.

A bounded comparison with another existing model was not started. AgentSwarms' MCP allowlist restricts the server name, not individual remote operations, and the deployed connector permits non-protected writes across owner `aXtn`; a “read-only” prompt alone cannot prevent an unintended write. Restore enforceable connector scope before exposing this capability to any alternative Builder model.

### Deployed connector scope contradicts the Handoff

The running `axtn-gitea-mcp` container is image `axtn-gitea-mcp:dev-dfbb45a`, labeled with source revision `dfbb45ad6ee546e4b84cea35a106a0bce20c7070`. Its compose source defines only `MCP_ALLOWED_OWNERS` (default `aXtn`) and `MCP_WRITE_MODE` (default `review`) for write authorization. The live container has `MCP_ALLOWED_OWNERS=aXtn` and `MCP_WRITE_MODE=review`; it has neither `MCP_ALLOWED_WRITE_BRANCHES_BY_REPOSITORY` nor `MCP_ALLOWED_WRITE_PATHS_BY_REPOSITORY`, and no mounted runtime config supplies them.

At the deployed source revision, `create_branch` checks owner and write mode; `upsert_file` checks owner, write mode, rejects `main`/`master`, and validates relative path traversal. Neither operation has a per-repository branch/path allowlist or accepts/verifies a Case/attempt/operation effect binding. `review` permits writes to non-protected branches across the allowed owner. Therefore the Handoff statement that exact branch/path allowlist variables already exist is not supported by the running image or its source. Setting those variable names would not enforce a limit. The old helper's proposed branch `work/AXTN-DEVSWARM-MCP-PROBE-20261018T1007Z` is not a final effect-derived branch result; no `create_branch` result established such a name. No probe branch or file was created, and no product write was attempted through the broader connector.

**Concrete required platform action:** the authorized Gitea-MCP operator must provide and deploy an approved connector revision/configuration that enforces one exact repository, the exact branch returned by a Case-bound `create_branch`, and one exact harmless probe path, while validating the Case/attempt/operation binding. The current `dfbb45a` connector cannot be made to enforce this by environment configuration alone. Do not set ignored variables, use a product branch as a substitute, or fall back to SSH/another identity. After deployment, read back the active exact scope before any probe write.

### Actions and UAT

The repo-scoped runner log still shows only task starts: runs `164`/job `327`, `165`/job `328`, and `166`/job `329`; no terminal success/failure/cancelled result is present. The previously tested unauthenticated `GET /api/v1/repos/aXtn/axtn-agentswarms/actions/runs/164` returned 403, `Only signed in user is allowed to call APIs`, and `tea` is not installed. SSH Git authentication does not authenticate the Gitea REST Actions endpoint. No CI result or PASS is claimed. The exact missing operation is a repository-authorized read of those three Gitea Actions runs/jobs/logs through the normal signed-in Gitea UI/API; no admin credential is requested.

The UAT content exclusion remains `supabase/supabase@058b546b56b665cd95c2e1a872a263cd74faf59c:docker/docker-compose.yml`; its content was not read or reconstructed. The Host script was checked at `aXtn/aXtn-host@cad8500a00995c98707045b04bc337fd351a96aa`: its only `supabase` target uses the fixed production project `axtn-native-supabase`; the component whitelist has no `uat` target. **Concrete UAT operator action:** the organization policy administrator must make that exact pinned input available only through the approved Host deployment path (or provide the same exact-provenance input at an approved isolated-runtime location); the Host operator must then add/use a separately named isolated UAT target in the existing native Compose process. No UAT command currently exists, so do not run the production `supabase` target or invent a replacement command.

The Case remains `913dbf33-9891-4712-b945-aab9a5cfe5b9`; the product branch remains at candidate `e4ca073195ada22dc378f6da0f300f498f2ebbf2`. The existing reviewers' latest findings remain unchanged: Security reported no finding, Contract reported a blocking HIGH responsibility-view finding, and Maintainability's findings remain unsupported/unaccepted. No product bytes, graph nodes, skills, KBs, Cases, connector scopes, or protected inputs were changed in this continuation.

## Pinned authority and report lineage

This continuation follows `aXtn/aXtn-agentswarms@7ecaa468ba047d087d2444dc87f22fe7db99cc08` and the active order `AXTN-DEVSWARM-DELIVERY-UAT-20261018`. The earlier report was published at `aXtn/axtn-agentswarms@refs/heads/change/AXTN-MGMT-REPORTING-CONTENT-0001` commit `8bf88d2d9759ed2ed6d90d8b125ce8c66fd38aa8`. Exact commit readback returned report blob `983c63ad218a4f94d7117be84ebc80732d495c92`, SHA-256 `0c3bc282457923b34d13d36c1aad93f4b5eaef83d6630f005b25f80f6779bf83`. That branch is not the designated Handoff branch; this continuation is prepared on `work/AXTN-NATIVE-SWARM-COMPLETION-20261016`.

## PR #35: author and actual release scope

Gitea identifies PR #35 as authored by `axtn-codex`, head `14ad88b477b81ce123638e88b810f0e39990d4e5`, base `main@d87a155626d6564416b590bc0e0efb7e8f75436e`. Its recorded diff is 1,548 files, 309,687 additions, and 14,195 deletions (504 commits from that base), so PR #35 is not a safe, isolated platform-fix release PR.

The pre-fix deployed baseline was `axtn-agentswarms-native:f3bd040cfe2b3250e65a65fa58fde06f63feeebc`. The actual incremental changes after that baseline are the already-versioned CI workflow commit `0a3cbf821dd9425f76462b8ed5986f5da0d49b5b` and the MCP-argument repair `14ad88b477b81ce123638e88b810f0e39990d4e5`: three files, 110 insertions, 7 deletions. The unrelated historical commits are part of the deployed source lineage, not new changes introduced after `f3bd040c`; merging PR #35 wholesale would conflate that lineage with this small repair.

An isolated candidate was prepared locally on `fix/AXTN-MCP-ARGUMENT-CONTRACT-20261018`, based exactly on deployed commit `f3bd040cfe2b3250e65a65fa58fde06f63feeebc`. Its commits are `193f9ecc` (standard Gitea CI workflow) and `d79152c3268c591f663b12d7f114756506a83bbc` (MCP argument repair). The candidate passes 21/21 targeted MCP tests, typecheck, production build, and `git diff --check`. ESLint on the changed files reports no errors and two existing `no-explicit-any` warnings. This local branch remains unpushed.

The full unit suite was compared on the deployed baseline and patched source. Baseline `f3bd040c` had 10,044 passed, 40 skipped, and 2 failed; PR head `14ad88b4` had 10,049 passed, 40 skipped, and the same 2 failures in `tests/unit/documentRecoveryInventory.test.ts`, with identical expected/received source-hash evidence. Thus the failures are reproduced before the repair and no new full-suite failure was observed; both full-suite commands still exit nonzero, so this is not a CI PASS.

The PR author and the Git commit author are distinct: the repair commit is authored `Copilot`, while Gitea records PR #35 as `axtn-codex`. The configured HTTP Git credential helper resolves to `axtn-codex`; it was used in the earlier PR-creation path and is not being used for further Copilot publication. The available `gh` login is for `github.com`, not Gitea. At that earlier check, the existing SSH identity was rejected with `Permission denied (publickey)`. **This SSH result is historical and superseded:** the current continuation authenticated with the pinned `aXtn-copilot-cli` key via `axtn-gitea` and fetched the canonical report branch; see the current continuation above.

## Official repository-scoped Actions runner

The existing Host runner path was executed from `aXtn/aXtn-host` commit `cad8500a00995c98707045b04bc337fd351a96aa`:

- Official Gitea CLI version 1.27.3 supports `gitea actions generate-runner-token --scope {owner}/{repo}`.
- A token scoped to `aXtn/aXtn-agentswarms` was generated directly to `/home/alex/.local/share/axtn/native/gitea-runner/registration-token`, mode `0600`; its value is not recorded here.
- The repository-isolated `axtn_git_ci` network has labels `axtn.scope=gitea-actions-ci` and `axtn.repository=aXtn/aXtn-agentswarms`.
- The pinned runner image is `docker.io/gitea/runner@sha256:63c33f51840e3c5ee6b4a404a739dcab8ceb2efd21e1d955261d002b96082a90`. The standard `scripts/native-compose.sh gitea-runner up -d --wait` path started it; Gitea logged “Runner registered successfully.”
- Gitea then assigned real repository CI jobs: run 164/job 327, run 165/job 328, and run 166/job 329. The latest safe runner-log read still shows only the three task-start records and no terminal result. An unauthenticated Gitea Actions API read returned HTTP 403, `Only signed in user is allowed to call APIs`; no signed-in Gitea read route is available in this CLI session. Tested SHAs and conclusions therefore remain unverified and no CI PASS is claimed. The observed repository jobs establish that Actions is enabled for this repo and the runner-registration gap is resolved.

## Case and UAT

The platform fix was deployed through the existing Host candidate-convergence path from PR head `14ad88b477b81ce123638e88b810f0e39990d4e5` (same source tree as isolated local commit `d79152c3268c591f663b12d7f114756506a83bbc`). The running AgentSwarms image/revision now reports `14ad88b477b81ce123638e88b810f0e39990d4e5`; `/api/health` and HTTP liveness returned 200. PR #35 remains open and was not merged.

The existing Case lineage was re-read through the normal Owner path: parent `ad8690f3-ecb3-4db1-a5e9-44a9752de2d2` under umbrella `85a1d829-39ac-49bd-9047-163ab52d427b`, with child `913dbf33-9891-4712-b945-aab9a5cfe5b9` still OPEN at external-reference version 21 and candidate `e4ca073195ada22dc378f6da0f300f498f2ebbf2`. No Cases were created. The existing Swarm is `ad06e17d-460b-4b65-946a-9b5d78c6fd02`; its current published version is `e9688945-eebe-460d-b48a-3069d045f499` (69 nodes, 118 edges, 20 native MCP tool nodes, 40 explicit source projections, and 3 native retrieval nodes). Published readback confirms the existing Builder (GLM-5.3-Flash; `mcp_call_tool` only; configured Development Gitea server) and three independent, read-only reviewers: Security (`gpt-oss-120b`), Contract (`GLM-5.2`), and Maintainability (`Mistral-Small-4-119B-2603`). Existing Delivery/Review/UAT Skills and Development Standards/UAT Operations KBs are assigned; no duplicate objects were created.

After deployment, case-bound Builder runs `eb032f3d-50af-5108-a7da-327c3fbc30a2`, `110836e3-58de-53e9-adfd-5baa71fce323`, `660b97de-1d82-523a-a848-47f90899052b`, `b1e68c7e-c95a-57e4-afec-bb64b985d352`, and `31409374-1bc9-5f6e-a53c-7dc17ddcc2f2` persisted native MCP tool events. The first run read a product file successfully; its attempt to create the diagnostic branch `work/AXTN-DEVSWARM-MCP-PROBE-20261018T1007Z` was recorded as denied. **The earlier attribution that this was enforced by a repository-specific write scope is unverified and superseded by the deployed-source/configuration inspection above:** the current connector image has no such branch/path allowlist. No branch/path effect scope was expanded.

The later case-bound runs verified the deployed MCP argument transport and completed the pinned native reads. An intermediate Builder call sent the right inner fetch fields but omitted the required outer `tool_name`, producing nested `Invalid request parameters (-32602)` responses. The prompt was corrected to specify all outer parameters explicitly. Subsequent native graph fetch nodes successfully read `caseAssignmentContract.ts`, `caseManagement.server.ts`, and `cases.tsx` at candidate `e4ca073195ada22dc378f6da0f300f498f2ebbf2`, including the complete route through direct native source projection. The verified chain is: `CaseAccessView` exposes `case_access_mode` (`CUSTODIAN`/`RESPONSIBLE`); `accessibleCases` executes `case_access` for the authenticated `user_session` and returns those rows; `updateCaseForUser` treats `RESPONSIBLE` as the current principal's responsibility. The route drops that field, renders `view === "mine"` as empty, and claims responsibility is unavailable.

Case-bound run `4c9c4fc7-5516-54a7-a77e-8cd03b243b70` used published graph `e9688945-eebe-460d-b48a-3069d045f499`, with `case_attempt_id` equal to the run ID, status `success`, 69/69 steps, and zero step errors. The Builder concluded the smallest justified route-only correction is to expose `case_access_mode`, filter “Mir zugewiesen” on `RESPONSIBLE`, and render responsibility from that signal without deriving it from ownership or contact. However, the persisted Builder output ends at “Applying the smallest change … now”; the Builder step has no MCP tool events and the run records no `upsert_file`. The same behavior occurred in the immediately preceding attempts (`a87f6e56-943d-5154-a408-c384671d81d4` and `380e3746-fc38-5486-a452-d38c51d5969d`): each produced an intended-action statement but no writer call. A post-run native branch read confirms head `e4ca073195ada22dc378f6da0f300f498f2ebbf2`; no product bytes changed. This is not a product-write or readback success.

The three reviewers ran read-only on the exact candidate file blob `4212a8b13cd0c1e065869d4f4e5075a9d4f49197`. Security returned no findings. Contract returned a blocking HIGH finding for the empty “Mir zugewiesen” view and additional MEDIUM findings for the missing responsibility display/filter. Maintainability emitted findings that remain unaccepted and unsupported; they are not treated as approvals. The reviews therefore do not establish acceptance, and the actionable Contract finding is still open.

The requested synthetic MCP write/readback probe on an isolated branch is **not complete**. The earlier report stated that the connector permits only the product branch and configured product paths; that statement is withdrawn because the deployed source and container configuration do not implement those restrictions. The earlier branch-creation denial remains a recorded result, but its cause is not established by current evidence. AgentSwarms persisted the Case/run attempt binding; no connector write consumed or verified a Case/attempt/operation binding. No product-branch write was substituted for the isolated probe. Product CI, native Approval, review PR, browser test, UAT address, and Acceptance are not evidenced.

The separate UAT blocker is specifically the content-excluded vendor input `supabase/supabase@058b546b56b665cd95c2e1a872a263cd74faf59c:docker/docker-compose.yml`. The blocked operation is reading/consuming that exact pinned file as an isolated Host deployment input; its content was not read, rendered, copied, or reconstructed through another channel. No UAT stack, URL, synthetic-data lifecycle, browser run, or acceptance exists. The Host script was checked at `aXtn/aXtn-host@cad8500a00995c98707045b04bc337fd351a96aa`: its only `supabase` target uses the fixed production project `axtn-native-supabase`, and its component whitelist has no isolated `uat` target. **Concrete operator action:** the organization policy administrator must make that exact pinned input available only through the approved Host deployment path (or provide the same exact-provenance input at an approved isolated-runtime location); the Host operator must then add/use a separately named isolated UAT target in the existing native Compose process. No UAT command currently exists, so do not run the production `supabase` target or invent a replacement command.

## Superseded publication state

The prior report's SSH-publication blocker and multi-branch push/rollback instructions are obsolete. SSH authenticated as `aXtn-copilot-cli`, the current remote Handoff was merged without force, and the updated report was published to `work/AXTN-NATIVE-SWARM-COMPLETION-20261016`. No release-base or product-candidate ref was published here.
