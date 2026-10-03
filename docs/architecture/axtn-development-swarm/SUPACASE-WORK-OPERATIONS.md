# Native SupaCase work operations

Development work uses the existing owner-scoped `axtn_cases` dataset and native
`audit_events`. There is no separate job store, scheduler, approval inbox or
Copilot-specific lifecycle. Non-development Cases and the document/review
assignment contracts remain unchanged.

## Identity and responsibility

The authenticated `/api/cases/work` endpoint resolves its owner from the actual
Supabase session or a scoped native Swarm API key. The `case_work` tool resolves
the same owner from trusted execution context. Neither accepts an owner, JWT,
credential or principal in its request body.

The original Work identity is immutable and retryable. Editable subject,
priority, due date and follow-up are current Case details, not a replacement
identity. Channel, processing mode and Actor are distinct dimensions.
Authentication supplies Human actor identity; a machine cannot claim Human mode,
promote an Improvement Candidate or consciously abandon work.

Generic dataset/row/audit writes, deletion, identity laundering and the Local
Table SECURITY DEFINER broker cannot bypass the native contract. Harmless dataset
cache metadata remains writable. The configured native audit retention applies;
Human Builder provenance is also retained in protected Case state so changing
Actor or expiring an audit trail cannot enable self-acceptance.

## Manual operation on the same Case

Open the existing Case detail, then use **Development Work Contract**:

1. Inspect the Work Contract, current immutable Candidate, Children, dependencies,
   typed references and durable transitions.
2. Take over that Case in Human mode. Machine mutation stays denied until an
   authenticated release; takeover does not create another Case.
3. Edit its subject, priority, due date or follow-up through native Work details.
   Automation can neither set nor overwrite Human Critical priority 0.
4. Materialize a change through Gitea, then bind its exact SHA and Attempt and
   reference the existing PR. New Candidate/Attempt/dependency contracts invalidate
   relevant own, ancestor and dependent gates.
5. Start the accountable Work; reference its result or Evidence in the required
   output contract. References are canonical repository/path/revision or native
   Run identities, not complete logs, prompts or findings.
6. On `DEVELOPMENT_VERIFY`, **Run native deterministic Verify** derives task,
   attempt, input revision and profile from the owned Case. It reads both immutable
   Git snapshots through the scoped native broker and uses the same isolated
   verifier as a Swarm. Repeated polling reuses the effect identity. `PENDING` is
   not PASS; a failed receipt cannot be replaced by free-text success.
7. Complete the Work only after its Result Contract is met, or block/reopen it.
   Work completion is not independent Acceptance. Conscious abandonment is
   recorded separately, keeps its evidence and does not manufacture Acceptance.
8. Decide through the existing native Approval route. **Bind independently
   decided Acceptance** accepts only an existing native approval identity. Exact
   Candidate, owned frozen run, current PR head, native receipt, protected
   image/harness pins, task, attempt and Case lineage must agree. Human Builders
   cannot approve or accept their own result.

Native V1 deterministic verification/approval is scoped to
`aXtn/development-swarm-acceptance`; the generic Case work carrier does not
grant additional repository or merge privileges. The executable graph consumer
and its complete manual semantic continuation are delivered by the executable
Swarm work package, not inferred from the presence of these controls.

## Dependencies and closure

`REQUIRES_COMPLETION` requires a closed predecessor; heterogeneous implementation
repositories do not implicitly share one SHA. `REQUIRES_CANDIDATE` additionally
requires the same immutable Candidate. `INFORMS` records context without gating
execution. All targets are owned, duplicates/self-links/cycles are rejected.

Required native Review/Verify Children bind to the Parent Candidate. Parent
closure requires required Children, independent native Acceptance, an integration
endpoint and a fresh PR-head check. Changing the predecessor revision or Attempt,
reopening it, failing checks, changing dependencies or rolling back invalidates
affected gates. Improvement Candidates remain unstarted until explicit Human
promotion; their creation itself does not block completion or execute a change.

## Shared measurements

UI and API use `workMetrics` rather than redundant Case counters. Every Case,
including Copilot, Swarm, Human, real work, synthetic acceptance and regression,
participates in totals and explicit segmentation.

Measurements derive hierarchy/root/depth, decomposition, independent concurrent
Child work, primary processing mode, automatic completed chains, interventions,
handover, recorded attempts/rework, completed/blocking/integration duration,
Improvement promotion/completion and verified rollout/rollback counts. Open
intervals remain open; elapsed values are not silently filled with fabricated
durations. Parallel width excludes ancestor/dependency overlap.

## Reproducible policy replay

```sh
python3 tests/case-work/contract_policy.py
```

This opt-in native PostgreSQL test installs the candidate additive migration and
all proof fixtures in one transaction and rolls back. It compares ledger, schema,
Cases/datasets/events, sessions/grants, approvals and runs before/after. Its
synthetic authenticated SQL decisions test policy only; they are not a real
independent production approval or acceptance claim.

Focused tests are `caseWork`, `caseWorkMetrics`, `caseWorkVerification` and
`caseWorkAcceptance`, together with existing SupaCase, DMS, D09/resume and native
runtime regression tests. Full source gates remain required before convergence.
