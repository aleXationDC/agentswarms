# Development Swarm UAT Operations Report

**Status: PARTIAL — platform fix deployed and Case-bound MCP reads verified; product write/readback, CI conclusion, independent acceptance, and UAT remain outstanding.**

## Pinned authority and report lineage

This continuation follows `aXtn/aXtn-agentswarms@011773a9f096be8b4de525206a332073c6f1bcfd` and the active order `AXTN-DEVSWARM-DELIVERY-UAT-20261018`. The earlier report was published at `aXtn/aXtn-agentswarms@refs/heads/change/AXTN-MGMT-REPORTING-CONTENT-0001` commit `8bf88d2d9759ed2ed6d90d8b125ce8c66fd38aa8`. Exact commit readback returned report blob `983c63ad218a4f94d7117be84ebc80732d495c92`, SHA-256 `0c3bc282457923b34d13d36c1aad93f4b5eaef83d6630f005b25f80f6779bf83`. That branch is not the designated Handoff branch; this continuation is prepared on `work/AXTN-NATIVE-SWARM-COMPLETION-20261016`.

## PR #35: author and actual release scope

Gitea identifies PR #35 as authored by `axtn-codex`, head `14ad88b477b81ce123638e88b810f0e39990d4e5`, base `main@d87a155626d6564416b590bc0e0efb7e8f75436e`. Its recorded diff is 1,548 files, 309,687 additions, and 14,195 deletions (504 commits from that base), so PR #35 is not a safe, isolated platform-fix release PR.

The pre-fix deployed baseline was `axtn-agentswarms-native:f3bd040cfe2b3250e65a65fa58fde06f63feeebc`. The actual incremental changes after that baseline are the already-versioned CI workflow commit `0a3cbf821dd9425f76462b8ed5986f5da0d49b5b` and the MCP-argument repair `14ad88b477b81ce123638e88b810f0e39990d4e5`: three files, 110 insertions, 7 deletions. The unrelated historical commits are part of the deployed source lineage, not new changes introduced after `f3bd040c`; merging PR #35 wholesale would conflate that lineage with this small repair.

An isolated candidate was prepared locally on `fix/AXTN-MCP-ARGUMENT-CONTRACT-20261018`, based exactly on deployed commit `f3bd040cfe2b3250e65a65fa58fde06f63feeebc`. Its commits are `193f9ecc` (standard Gitea CI workflow) and `d79152c3268c591f663b12d7f114756506a83bbc` (MCP argument repair). The candidate passes 21/21 targeted MCP tests, typecheck, production build, and `git diff --check`. ESLint on the changed files reports no errors and two existing `no-explicit-any` warnings. This local branch remains unpushed.

The full unit suite was compared on the deployed baseline and patched source. Baseline `f3bd040c` had 10,044 passed, 40 skipped, and 2 failed; PR head `14ad88b4` had 10,049 passed, 40 skipped, and the same 2 failures in `tests/unit/documentRecoveryInventory.test.ts`, with identical expected/received source-hash evidence. Thus the failures are reproduced before the repair and no new full-suite failure was observed; both full-suite commands still exit nonzero, so this is not a CI PASS.

The PR author and the Git commit author are distinct: the repair commit is authored `Copilot`, while Gitea records PR #35 as `axtn-codex`. The configured HTTP Git credential helper resolves to `axtn-codex`; it was used in the earlier PR-creation path and is not being used for further Copilot publication. The available `gh` login is for `github.com`, not Gitea. The already-pinned Gitea SSH host key on port 2222 was verified, but the existing SSH identity was rejected with `Permission denied (publickey)`. No Codex credentials were reused after identifying this mismatch.

## Official repository-scoped Actions runner

The existing Host runner path was executed from `aXtn/aXtn-host` commit `cad8500a00995c98707045b04bc337fd351a96aa`:

- Official Gitea CLI version 1.27.3 supports `gitea actions generate-runner-token --scope {owner}/{repo}`.
- A token scoped to `aXtn/aXtn-agentswarms` was generated directly to `/home/alex/.local/share/axtn/native/gitea-runner/registration-token`, mode `0600`; its value is not recorded here.
- The repository-isolated `axtn_git_ci` network has labels `axtn.scope=gitea-actions-ci` and `axtn.repository=aXtn/aXtn-agentswarms`.
- The pinned runner image is `docker.io/gitea/runner@sha256:63c33f51840e3c5ee6b4a404a739dcab8ceb2efd21e1d955261d002b96082a90`. The standard `scripts/native-compose.sh gitea-runner up -d --wait` path started it; Gitea logged “Runner registered successfully.”
- Gitea then assigned real repository CI jobs: run 164/job 327, run 165/job 328, and run 166/job 329. The latest safe runner-log read shows all three jobs started but no terminal result; their conclusions remain unverified and no CI PASS is claimed. The observed repository jobs establish that Actions is enabled for this repo and the runner-registration gap is resolved.

## Case and UAT

The platform fix was deployed through the existing Host candidate-convergence path from PR head `14ad88b477b81ce123638e88b810f0e39990d4e5` (same source tree as isolated local commit `d79152c3268c591f663b12d7f114756506a83bbc`). The running AgentSwarms image/revision now reports `14ad88b477b81ce123638e88b810f0e39990d4e5`; `/api/health` and HTTP liveness returned 200. PR #35 remains open and was not merged.

The existing Case lineage was re-read through the normal Owner path: parent `ad8690f3-ecb3-4db1-a5e9-44a9752de2d2` under umbrella `85a1d829-39ac-49bd-9047-163ab52d427b`, with child `913dbf33-9891-4712-b945-aab9a5cfe5b9` still OPEN at external-reference version 21 and candidate `e4ca073195ada22dc378f6da0f300f498f2ebbf2`. No Cases were created. The existing Swarm is `ad06e17d-460b-4b65-946a-9b5d78c6fd02`, published version `a5fd64e8-20f3-4dae-9de8-33d90d795b46`, a temporary three-node Builder graph; it is not the full delivery graph or acceptance evidence.

After deployment, case-bound Builder runs `eb032f3d-50af-5108-a7da-327c3fbc30a2`, `110836e3-58de-53e9-adfd-5baa71fce323`, `660b97de-1d82-523a-a848-47f90899052b`, `b1e68c7e-c95a-57e4-afec-bb64b985d352`, and `31409374-1bc9-5f6e-a53c-7dc17ddcc2f2` persisted native MCP tool events. The first run read a product file successfully; its attempt to create the diagnostic branch `work/AXTN-DEVSWARM-MCP-PROBE-20261018T1007Z` was explicitly denied because that branch is outside the repository-specific write scope. The configured scope permits product writes only to `work/AXTN-SUPACASE-USABILITY-0001` and its allowlisted paths; no scope was expanded.

The later case-bound runs verified that the MCP argument fix now transports nested JSON-string arguments and successfully fetched the pinned work-order files and current product sources. On the verified candidate, the Builder found the Account/Contact master-data package already implemented across the five scoped route/server/function files (source blob SHAs are recorded in the run output). A subsequent read of the Case list/detail/service/function/relation-panel sources found the principal queue/detail behaviors already present. It also reported that the “Mir zugewiesen” quick view is only an explanatory placeholder because the inspected Case-list contract has no responsibility field; that observation still needs an independently authorized assignment-contract check. These were read-only findings, not Swarm product changes: no `upsert_file` was made, no commit or source readback after a write exists, and branch head remains `e4ca073195ada22dc378f6da0f300f498f2ebbf2`. The Swarm must make any justified product change; no CLI product patch was made.

The actual MCP write/readback probe is therefore **not complete**. Its only attempted write precursor was `create_branch` to the disallowed diagnostic branch; it stopped before any `upsert_file`. Product writes remain limited to the authorized Case branch. The supplied per-run effect binding was verified against Case attempt IDs, but no write consumed it. No product CI, independent review, Approval, review PR, browser test, UAT address, or Acceptance is evidenced.

The separate UAT blocker is specifically the content-excluded vendor input `supabase/supabase@058b546b56b665cd95c2e1a872a263cd74faf59c:docker/docker-compose.yml`, required by the existing Host Compose path. Its content was not read, rendered, copied, or reconstructed. No UAT stack, URL, synthetic-data lifecycle, browser run, or acceptance exists. The inspected Host `scripts/native-compose.sh` exposes a `supabase` component that runs under the fixed production project `axtn-native-supabase`; it exposes no UAT component, so running that production command is not a safe substitute for isolated UAT. The operator action is to authorize the pinned canonical input for an explicitly isolated UAT-scoped Host Compose project and provision its approved runtime input/location; do not expose or copy the vendor file contents. If that use is not allowed, the operator must provide a policy-approved canonical artifact with the same pinned provenance through the approved Host process. No reconstructed substitute is acceptable.

## Required handoff

Publication of both the isolated candidate and this report is blocked only because this CLI environment has no authenticated `aXtn-copilot-cli` Gitea route: the configured HTTP helper identifies as `axtn-codex`, and the existing SSH identity is not accepted. The exact authorized publication action is to run these commands from the already provisioned `aXtn-copilot-cli` Gitea session, not from the Codex helper. The first push creates only a release-base ref at the verified live commit; the next publishes the two-commit, three-file candidate; the last publishes this report on the designated Handoff branch:

```bash
git -C /home/alex/aXtn-agentswarms-mcp-release-isolated-worktree push origin f3bd040cfe2b3250e65a65fa58fde06f63feeebc:refs/heads/release/AXTN-AGENTSWARMS-LIVE-20261018
git -C /home/alex/aXtn-agentswarms-mcp-release-isolated-worktree push origin fix/AXTN-MCP-ARGUMENT-CONTRACT-20261018
git -C /home/alex/aXtn-agentswarms-uat-handoff-report-worktree push origin work/AXTN-NATIVE-SWARM-COMPLETION-20261016
```

After those pushes, verify exact remote heads with:

```bash
git -C /home/alex/aXtn-agentswarms-mcp-release-isolated-worktree ls-remote --heads origin refs/heads/release/AXTN-AGENTSWARMS-LIVE-20261018 refs/heads/fix/AXTN-MCP-ARGUMENT-CONTRACT-20261018
git -C /home/alex/aXtn-agentswarms-uat-handoff-report-worktree ls-remote --heads origin refs/heads/work/AXTN-NATIVE-SWARM-COMPLETION-20261016
```

Expected heads are `f3bd040cfe2b3250e65a65fa58fde06f63feeebc` and `d79152c3268c591f663b12d7f114756506a83bbc`. Compare the report branch’s `ls-remote` result with the local `git -C /home/alex/aXtn-agentswarms-uat-handoff-report-worktree rev-parse refs/heads/work/AXTN-NATIVE-SWARM-COMPLETION-20261016` result after its final local commit; its own SHA is intentionally not embedded in the report. Only after matching these refs should the normal Gitea UI open `fix/AXTN-MCP-ARGUMENT-CONTRACT-20261018` against `release/AXTN-AGENTSWARMS-LIVE-20261018`. Do not merge PR #35 or retarget it.

Rollback is only for a newly-created, incorrect ref that no PR or deployment uses, and only in the same authorized Gitea session:

```bash
git -C /home/alex/aXtn-agentswarms-mcp-release-isolated-worktree push origin :refs/heads/release/AXTN-AGENTSWARMS-LIVE-20261018
git -C /home/alex/aXtn-agentswarms-mcp-release-isolated-worktree push origin :refs/heads/fix/AXTN-MCP-ARGUMENT-CONTRACT-20261018
git -C /home/alex/aXtn-agentswarms-uat-handoff-report-worktree push origin :refs/heads/work/AXTN-NATIVE-SWARM-COMPLETION-20261016
```

Until the canonical input action is completed, keep UAT deployment blocked and do not substitute a reconstructed Compose file.
