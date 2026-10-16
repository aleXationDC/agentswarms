# AXTN vLLM Swarm Selector — Update-first preflight (2026-10-16)

Status: **update candidate validated, NOT deployed; selector delta committed separately.**

## 1. Git basis

| Item | Value |
| --- | --- |
| Upstream target | `v1.6.0` @ `70c295f17af39c81b1a4b56e6552307f5d91eef3` (fixed tag, no moving main) |
| Accepted aXtn base | `904ac49d` (docs-only since `bdbdc5a3`) |
| Merge-base | `05df309f` (historical 1.5 assessment state, not v1.5.0) |
| Divergence | upstream +173 commits, aXtn +261 |
| Files changed | upstream 501, aXtn 512, overlap ≈ 30 |
| `package.json` before | 1.5.0 (not evidence of the base); after merge 1.6.0 |
| Public HEAD `7c95a699` | after v1.6.0; not taken, no concrete need shown |

Branch `work/AXTN-AGENTSWARMS-UPDATE-V1.6.0-20261016`:

- `6728dd67` — update merge (update only, no selector change)
- `e39ce442` — selector delta (separate commit)

## 2. Conflicts (13) and resolution

All resolved by keeping aXtn behaviour and carrying the upstream change.

| File | Resolution |
| --- | --- |
| `docs/IAM.md` | both parts kept; `## Use cases` heading restored (aXtn base had lost it → `docsUseCases` now green) |
| `src/lib/chatStream.ts`, `mcpApps.functions.ts`, `swarmResume.functions.ts`, `swarmApprovals.functions.ts` | both imports/types |
| `vitest.config.ts` | aXtn excludes + upstream `pool: "forks"`/`maxForks` |
| `swarmExecute.server.ts` | aXtn checkpoint rule + upstream R309 cancel handling |
| `swarmRuntime.ts` | Work/Document approval path kept; plain insert uses upstream `approver.id` |
| `routes/api/chat.ts` | Case chat resolution kept; upstream R297 503 on failed caller check and agent-config gate |
| `budgetGuard.server.ts` | upstream R250 null-cap / unknown-figure semantics; aXtn group spend (`groupSpendSince`) and Case budget decision keep, null cap fails closed |
| `swarmDeploy.functions.ts` | aXtn delegation to `swarmDeploy/operations.server.ts`; R297 moved into it |
| `integrations.functions.ts` | aXtn delegation kept; upstream R254 (unreadable row ⇒ nothing saved, winner's secrets kept) ported into `integrations/operations.server.ts` |
| `routes/_authenticated/account.tsx` | upstream profile panel + aXtn MFA/TOTP card |

## 3. Follow-on adaptations for upstream sweeps (aXtn files)

- R297 caller lookup: `axtn.document-intake`, `axtn.maintenance`, `cases.work`, `caseManagement.functions`, `caseSwarm.server`, `axtnWorkbenchEdits.functions`, `iam.server` (claims) now distinguish refusal from failed check.
- R298: `CaseWorkPanel` reads the session instead of `auth.getUser()`.
- NUL-safe fetch on three aXtn Supabase clients.
- Tests adapted to the aXtn architecture (not weakened): mocks for `groupSpendSince`, `integrations/operations.server`, chained `.eq` in park update, `AuthApiError(401)` for refused tokens; four aXtn document hooks added to the reviewed user-key list.

## 4. Migration / ledger distance

`git diff 05df309f v1.6.0 -- supabase/` is empty: no upstream migration is missing from the candidate (the 1.6 changelog's nine migrations are already in the shared base). Live ledger unchanged (030/040/050 applied; 060 repo-only, not live). Nothing applied by this step.

## 5. Checks (worktree at `6728dd67`, fresh `npm ci`)

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` (after `generate:routes`) | clean |
| `eslint . --quiet` | 0 errors |
| `npm run build` | success |
| `vitest run` | 11097 passed, 40 skipped, **2 failed** |

Remaining red: `documentRecoveryInventory` (2 tests), pre-existing baseline on `32481214` (recovery inventory hash/revision pins), unrelated to the update. `docsUseCases` is fixed by the restored heading. `duckdbEnginesParity` is green only with the real lockfile install (the symlinked node_modules was stale).

SQL regression (`case_execution_identity_parity`, `caseExecution.sql`) was not re-run: no `supabase/` delta in this step.

## 6. Selector status on the new base

- vLLM in the swarm provider list (`NodeInspector.tsx`): **native in v1.6.0 and present**.
- Gateway opt-in on the node (NodeInspector toggle, `routeThroughGateway`), runtime/execution forwarding (`swarmRuntime.ts`, `swarmExecute.server.ts`) and Case path: present from the accepted gateway work, tests green.
- Gap found and fixed (`e39ce442`): portable **export/import** dropped the flag. Now exported only when true and imported 1:1; test `tests/unit/vllmSwarmSelectorPortable.test.ts` (two nodes, different models, flag only on the opted-in node). Published snapshots copy node data wholesale and already retain it.
- Technical identifiers `vllm`, `llm_gateway`, `routeThroughGateway` unchanged. `route_all` stays off; no silent fallback.

## 7. Not done / limits

- **Not deployed.** No image, no host pin, no migration 060, no health/smoke, no corporate E2E (acceptance D). Historical probes with `gatewayRouted=false` are not gateway evidence.
- Registry push blocked: `axtn-codex` PAT lacks `write:package` (old leaked token still to be revoked).
- Backup blocked: `scripts/backup.sh` requires `AXTN_BACKUP_RECIPIENT` and `age`; no live step without the encrypted backup. Unencrypted legacy dump in the backup folder to be deleted once an encrypted one exists.

## 8. Human steps

1. Issue a `write:package` token for `axtn-codex`; revoke the old one.
2. Provide `AXTN_BACKUP_RECIPIENT`.
3. Then: backup → image digest → host pin → migration 060 → health/smoke → corporate E2E.
