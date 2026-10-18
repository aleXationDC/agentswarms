# Development Swarm UAT Operations Report

**Status: PARTIAL — platform fix isolated; case-bound proof and UAT remain outstanding.**

## Pinned authority and report lineage

This continuation follows `aXtn/aXtn-agentswarms@011773a9f096be8b4de525206a332073c6f1bcfd` and the active order `AXTN-DEVSWARM-DELIVERY-UAT-20261018`. The earlier report was published at `aXtn/aXtn-agentswarms@refs/heads/change/AXTN-MGMT-REPORTING-CONTENT-0001` commit `8bf88d2d9759ed2ed6d90d8b125ce8c66fd38aa8`. Exact commit readback returned report blob `983c63ad218a4f94d7117be84ebc80732d495c92`, SHA-256 `0c3bc282457923b34d13d36c1aad93f4b5eaef83d6630f005b25f80f6779bf83`. That branch is not the designated Handoff branch; this continuation is prepared on `work/AXTN-NATIVE-SWARM-COMPLETION-20261016`.

## PR #35: author and actual release scope

Gitea identifies PR #35 as authored by `axtn-codex`, head `14ad88b477b81ce123638e88b810f0e39990d4e5`, base `main@d87a155626d6564416b590bc0e0efb7e8f75436e`. Its recorded diff is 1,548 files, 309,687 additions, and 14,195 deletions (504 commits from that base), so PR #35 is not a safe, isolated platform-fix release PR.

The currently running AgentSwarms image is `axtn-agentswarms-native:f3bd040cfe2b3250e65a65fa58fde06f63feeebc`. The actual incremental changes after that deployed source are the already-versioned CI workflow commit `0a3cbf821dd9425f76462b8ed5986f5da0d49b5b` and the MCP-argument repair `14ad88b477b81ce123638e88b810f0e39990d4e5`: three files, 110 insertions, 7 deletions. The unrelated historical commits are part of the deployed source lineage, not new changes introduced after `f3bd040c`; merging PR #35 wholesale would conflate that lineage with this small repair.

An isolated candidate was prepared on `fix/AXTN-MCP-ARGUMENT-CONTRACT-20261018`, based exactly on deployed commit `f3bd040cfe2b3250e65a65fa58fde06f63feeebc`. Its commits are `193f9ecc` (standard Gitea CI workflow) and `d79152c3268c591f663b12d7f114756506a83bbc` (MCP argument repair). The candidate passes 21/21 targeted MCP tests, typecheck, production build, and `git diff --check`. ESLint on the changed files reports no errors and two existing `no-explicit-any` warnings. It has not been pushed or deployed.

The PR author and the Git commit author are distinct: the repair commit is authored `Copilot`, while Gitea records PR #35 as `axtn-codex`. The configured HTTP Git credential helper resolves to `axtn-codex`; it was used in the earlier PR-creation path and is not being used for further Copilot publication. The available `gh` login is for `github.com`, not Gitea. The already-pinned Gitea SSH host key on port 2222 was verified, but the existing SSH identity was rejected with `Permission denied (publickey)`. No Codex credentials were reused after identifying this mismatch.

## Official repository-scoped Actions runner

The existing Host runner path was executed from `aXtn/aXtn-host` commit `cad8500a00995c98707045b04bc337fd351a96aa`:

- Official Gitea CLI version 1.27.3 supports `gitea actions generate-runner-token --scope {owner}/{repo}`.
- A token scoped to `aXtn/aXtn-agentswarms` was generated directly to `/home/alex/.local/share/axtn/native/gitea-runner/registration-token`, mode `0600`; its value is not recorded here.
- The repository-isolated `axtn_git_ci` network has labels `axtn.scope=gitea-actions-ci` and `axtn.repository=aXtn/aXtn-agentswarms`.
- The pinned runner image is `docker.io/gitea/runner@sha256:63c33f51840e3c5ee6b4a404a739dcab8ceb2efd21e1d955261d002b96082a90`. The standard `scripts/native-compose.sh gitea-runner up -d --wait` path started it; Gitea logged “Runner registered successfully.”
- Gitea then assigned real repository CI jobs: run 164/job 327, run 165/job 328, and run 166/job 329. Run 166 was still active at the last safe runner-log read; no CI conclusion or PASS is claimed. The observed repository jobs establish that Actions is enabled for this repo and the outstanding runner-registration gap is resolved.

## Case and UAT

No platform redeployment or new case-bound Builder run has occurred. The previous MCP probe still lacks successful Corporate-MCP read/write/readback; the existing Case and product candidate remain unchanged. Product corrections remain Swarm-authored.

The UAT blocker is specifically the content-excluded vendor input `supabase/supabase@058b546b56b665cd95c2e1a872a263cd74faf59c:docker/docker-compose.yml`, required by the existing Host Compose path. Its content was not read, rendered, copied, or reconstructed. The policy blocks use of that input for isolated UAT; no UAT stack, URL, synthetic-data lifecycle, browser run, or acceptance exists.

## Required handoff

Publication of both the isolated candidate and this report is blocked only because this CLI environment has no authenticated `aXtn-copilot-cli` Gitea route: the configured HTTP helper identifies as `axtn-codex`, and the existing SSH identity is not accepted. The exact authorized publication action is to run these commands from the already provisioned `aXtn-copilot-cli` Gitea session, not from the Codex helper. The first push creates only a release-base ref at the verified live commit; the next publishes the two-commit, three-file candidate; the last publishes this report on the designated Handoff branch:

```bash
git -C /home/alex/aXtn-agentswarms-mcp-release-isolated-worktree push origin f3bd040cfe2b3250e65a65fa58fde06f63feeebc:refs/heads/release/AXTN-AGENTSWARMS-LIVE-20261018
git -C /home/alex/aXtn-agentswarms-mcp-release-isolated-worktree push origin fix/AXTN-MCP-ARGUMENT-CONTRACT-20261018
git -C /home/alex/aXtn-agentswarms-uat-handoff-report-worktree push origin work/AXTN-NATIVE-SWARM-COMPLETION-20261016
```

Then use Gitea's normal New Pull Request UI to open `fix/AXTN-MCP-ARGUMENT-CONTRACT-20261018` against `release/AXTN-AGENTSWARMS-LIVE-20261018`. This preserves the deployed `f3bd040cfe2b3250e65a65fa58fde06f63feeebc` base without cherry-picking onto stale `main`. Do not merge PR #35 or retarget it.

The separate UAT operator action is to authorize the existing Host UAT deployment path to consume `supabase/supabase@058b546b56b665cd95c2e1a872a263cd74faf59c:docker/docker-compose.yml` as its pinned canonical input, without copying or disclosing file contents or secrets. If that exact source-use operation remains denied, the operator must provide a policy-allowed canonical artifact at the established Host input location, identified to the same vendor revision, through the normal Host deployment process. Until that operation is completed, keep UAT deployment blocked and do not substitute a reconstructed Compose file.
