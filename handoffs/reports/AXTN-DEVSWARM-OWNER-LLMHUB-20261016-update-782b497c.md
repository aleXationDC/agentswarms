# Update @782b497c – live execution results

Supersedes the "remaining decisions" item 1 of the main report.

## DEPLOYED (PROD local host; ledger rows present; backup `backups-owner-policy-20261016/`; rollback bodies stored)
- `20261016000000_development_owner_review_eligibility.sql` (sha256 `eabec5bb…5169c`); clone-tested twice; fingerprint: only `guard_axtn_work_approval` changed.
- `20261016010000_case_transition_reference_persistence.sql` (sha256 `45617550…cced`): fixes an operator-precedence defect in `axtn_case_work_bootstrap` (`a || p->'references'` parsed as `(a || p)->'references'` = NULL). Transition references were never persisted, so native Acceptance could not find the PR. Clone-tested twice (idempotent); only that function changed.

## EXECUTED
- TEST_SIMULATION delegation evidence on Case `402a1966` (owner-delegated automated test simulation, not a personal decision by Alex).
- Approval `7aa0dcb3` approved via native UI / RPC `decide_swarm_approval` by the real Owner principal. Audit `APPROVAL_DECIDED` shows processingMode HUMAN; read it as TEST_SIMULATION.
- Run `f615d338` resumed: `pull` created PR #7 (`aXtn/development-swarm-acceptance`, head = Candidate `67a3a681…`, open, unmerged); `result` = PR_READY.
- Run ended `error` at `accept_case` because of the reference defect. The historical run state is left as-is. After the fix the PR_CREATED reference was added by native transition `acceptance-v2:pr-reference-repair`; native `accept` (`acceptance-v2:independent-acceptance`) succeeded: Case `INDEPENDENT_NATIVE_APPROVAL`, accepted_sha = Candidate, approval `7aa0dcb3`.

## OPEN
- Run `f615d338` stays `error` (`work_completed` never executed); a fresh native run is needed for a green run record.
- Same precedence pattern probably in `axtn_case_work_before_responsibility` (ABANDONED path, `20260929030000` ~l.218): follow-up, unchanged.
- Parent Case 409 untouched.
- Candidate-MCP readback, UI reload / duplicate-initiation, LLMHub discovery / inference / role mapping not executed; Corporate LLMHub attempt waits for release (PR #32; registry `write:package` grant for `axtn-codex` by Gitea org/package admin missing).
- Backups are not age-encrypted (no `AXTN_BACKUP_RECIPIENT`).
