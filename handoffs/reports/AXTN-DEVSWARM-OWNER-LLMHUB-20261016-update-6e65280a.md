# Update @6e65280a – end-to-end closure, reference defect #2, LLMHub status

Continues `…-update-782b497c.md` (aaf12908). Native-first; no DB row patching, no historical run changed, no merge/deploy.

## Ist-Matrix

| Area | Status | Evidence |
|---|---|---|
| Live migration `20261016000000` owner review eligibility | DEPLOYED | ledger row, sha256 `eabec5bb…5169c` |
| Live migration `20261016010000` bootstrap reference persistence | DEPLOYED | sha256 `45617550…cced` |
| Live migration `20261016020000` ABANDONED reference persistence | DEPLOYED | sha256 `19b2aca8e924270c6c01185c1bcfc3129ba9e0b7f357dbfef8a7f9b705487427`; rollback body `backups-owner-policy-20261016/axtn_case_work_before_responsibility.before.sql` |
| grant-only migration `20261009113000` | NOT applied (not authorised here) | ledger |
| Historical run `f615d338` | stays `error` at `accept_case` (not edited, not recoloured) | run row |
| Historical run `00ff44a5` | suspended, untouched | run row |
| Old Work Case `402a1966` | CLOSED via the regular native COMPLETED transition `acceptance-v2:complete` (reason `NATIVE_PR_READY_VERIFIED`, PR #7 + receipt `e686e558…` refs). This does **not** make run `f615d338` green. | case row |
| New regression run | **success** `089928f2-e14b-4013-956c-cf6253599f0e`; all of `accept_case`, `work_completed`, `output` executed (31 steps) | run steps |
| Regression Case | `ead79a6f-c4c8-43c0-b15d-ceb1aaaebf10` (child of acceptance case `11496f0f`, task `…-REGRESSION-REFFIX`, attempt `regression-v1`, refs to old run/PR) – CLOSED, accepted_sha = Candidate | case row |
| Candidate / PR | `047c8660dbd788a9dc48c5570ac940dc55040003`; PR #8 `aXtn/development-swarm-acceptance` open, unmerged, head = Candidate, main unchanged `0a38f20c…` | Gitea DB + git + product MCP |
| Approval | `1f16840d-24ed-44b7-ab4c-345657fc6354` approved by Owner principal through native UI/RPC. **TEST_SIMULATION** (delegated by Owner authorisation `@782b497c`/`@6e65280a`; evidence transition `regression-v1:test-simulation-delegation` on the regression Case). Not a personal decision by Alex. Gate verdict PASS was read and bound to Case/run/attempt/Candidate before the decision. | approvals row, case audit |
| Duplicate initiation (same Idempotency-Key) | PASS: same runId returned, run count 44→44, steps 31→31, PR count unchanged (8) | counts |
| UI reload | PASS: reloaded `/review/1f16840d…` shows `approved` | headless browser |
| Product MCP readback | PASS with the product token (independent of ChatGPT connector): `fetch pull 7/8` return head SHAs and open/unmerged; `repository_tree` at Candidate lists `src/normalize_score.py` | MCP @127.0.0.1:18000/mcp |

## Defect #2 (ABANDONED path)
Installed `axtn_case_work_before_responsibility` contained `COALESCE(current_case->'references','[]')||payload->'references'` (parsed as `(…||payload)->'references'` = NULL). Reproduced in an isolated clone (`supabase/tests/case_abandoned_reference_persistence.test.sql`: FAIL refs=0, i.e. **all** references were lost, also prior ones). Additive migration `20261016020000` replaces only that expression, guarded exactly-once. Clone: applied twice (idempotent), fingerprint: only that function differs, test PASS refs=2.

## Parent 409
Not reproducible now: RESULT-type evidence transitions on parent `85a1d829` and acceptance `11496f0f` returned 200 for a non-child-result event. The earlier 409 body was not retained, so its exact code is unproven; likely a lifecycle guard on child-style events (STARTED/RESULT with attempt binding). Note: these probe events set `attempt_id=regression-v1` on those two Cases (evidence reference to the new run). Unproven items are not asserted as fixed.

## LLMHub (corporate route)
- Native `/api/chat` with Owner JWT, provider `vllm` (integration `36d6a480…`, host `llm-server.llmhub.t-systems.net`), bounded 30-token JSON prompt, models `gpt-oss-120b`, `Qwen3.6-35B-A3B-FP8`, `Mistral-Small-4-119B-2603` (names from earlier LLMHub evidence): IAM/route passed (request reached upstream) but upstream returned **401 "Your API Key is deactivated"** for all. No key value was read.
- Therefore no corporate discovery/inference, no measured role mapping, no corporate Case attempt. A prior OpenAI-fixture success is not corporate evidence.
- **Human step 1 (immediate):** T-Systems LLMHub administrator reactivates (or issues a new) API key for the integration; if a new key, Owner updates it in AgentSwarms UI → Integrations → "vLLM (self-hosted)" (never in chat/Git). Then re-run discovery/inference and the role measurement.
- Role mapping recommendation (unmeasured, proposal only): keep one explicit model per role via the existing agent snapshots; start with `gpt-oss-120b` for builder/breaker and `Qwen3.6-35B-A3B-FP8` for the two reviewer roles, then confirm by measured pass/latency/budget once the key works. No global override.

## Release / registry
Registry probe with the protected `axtn-codex` credential: `GET /v2/` 200, blob-upload initiation **401 `reqPackageAccess`** → PAT still lacks `write:package` (probe upload cancelled/never created). **Human step 2:** log in to Gitea as `axtn-codex` (account owner) → User Settings → Applications → generate a token with `write:package` plus the scopes the current token has; write it to `/home/alex/.config/axtn-codex/git-http-credential` as `axtn_username=axtn-codex` / `axtn_password=<token>` (mode 0600). An org/repo grant does not replace the scope. The CLI creates no tokens. After that: publish image, verify RepoDigest (D06), update host pin, migrate/deploy on PR #32 source cumulatively with the already-applied migrations, keep rollback.
(Process note: one diagnostic command printed the `axtn-codex` token into the local tool log; rotate that token when issuing the new one.)

## Backup
`scripts/backup.sh` requires `AXTN_BACKUP_RECIPIENT` (age) for every run, so the contract is encrypted-at-rest; the manual pre-migration dumps in `backups-owner-policy-20261016/` are **not encrypted** (0600 in 0700 dir, not exported, not in Git). No age recipient is configured and none was invented. **Human step 3:** provide the Owner's age *public* key (`age1…`) for `AXTN_BACKUP_RECIPIENT` in the host env; then encrypt/remove the plain dumps.

## Open
- Corporate LLMHub inference + corporate Case attempt (blocked by deactivated key, then release).
- Registry scope / release of PR #32.
- Age recipient.
- Run `f615d338` remains a historical error.
