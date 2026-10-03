# AGENTS.md

These instructions apply to the entire repository unless a more specific nested `AGENTS.md` narrows them.

## Authoritative state

- Gitea repository state and verified runtime behavior are authoritative.
- Before material work, read the current repository handoff and any assignment it names.
- Do not substitute GitHub, chat excerpts or local assumptions for Gitea contracts.
- Work in a clean task branch/worktree and preserve unrelated changes.

## Mandatory SupaCase work protocol

Material implementation or operational work must be conducted through SupaCase. Material work includes source, schema/migration, configuration, runtime, deployment, integration or multi-step repair work.

1. Ensure exactly one idempotent Parent Case represents the assignment.
2. Create Child Cases only for independently accountable, dependent, parallelizable or separately measurable work packages.
3. Do not create Cases for individual nodes, commands, tool calls, retries, CI jobs or log entries.
4. Use the same Case, lifecycle and KPI contracts regardless of whether the executor is Copilot CLI, a Swarm or a human.
5. Record execution channel, Actor and Processing Mode as separate dimensions; never fork the Case model by executor.
6. Keep dependencies, status, Candidate SHA and typed repository/Issue/PR/Run/Evidence references current while working.
7. Record responsibility-relevant transitions, including takeover, result completion, review/approval, integration, deployment/canary and rollback.
8. Retain completed Cases and their references. Retry/Resume must update the same stable work identity and must not create duplicate Cases.
9. An executor may close its own Work Case when the Work/Result Contract is fulfilled and Evidence is referenced. This records work completion only.
10. Independent Acceptance must remain separate from executor completion. A Builder must not accept its own result.
11. Close the Parent only when all required Children are complete, dependencies are satisfied, Acceptance is independently positive and the configured integration endpoint is verified.
12. Reopen the affected Case for a relevant failure or rollback. Create a repair Child only when the repair is an independently accountable work package.
13. Do not copy complete logs, diffs, findings, prompts or traces into Cases. Store stable references to the authoritative Git/Evidence sources.
14. Do not place tokens, secrets, credentials or caller-supplied owner identities in Cases or graph payloads.

If safe headless Case access is itself being implemented, follow the repository handoff's bootstrap contract: implement the server-derived owner binding first, then idempotently materialize and backfill the Parent/Child lineage and Git/Run/Evidence references before continuing. Do not create a temporary Case store or parallel workflow.

A Case-access failure after the bootstrap capability exists is an execution defect to repair. It is not permission to continue untracked.

## Verification and completion

- Separate deterministic build/test/contract gates from probabilistic evaluation.
- Bind work result, findings, approval and integration evidence to the exact immutable Candidate revision.
- Preserve a manual takeover path through the same Case and Work Contract.
- Before declaring completion, verify Case persistence and findability after restart.
- Report the Parent Case, relevant Child Cases, PRs, Runs, Evidence and exact deployed revisions in the repository-backed completion report.
