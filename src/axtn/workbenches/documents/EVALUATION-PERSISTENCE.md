# Native minimized Evaluation report persistence

Additive migration `20261004160000_document_evaluation_evidence.sql` extends the
existing Case RPC/API and native owner-bound logical Dataset/audit.
`document_evaluation` accepts `DocumentEvaluationSubmission`;
`document_evaluations` lists stored reports for the owned source Case.
There is no new data service, evaluator scheduler, Approval engine or control
plane. The pure [comparison function](EVALUATION.md) remains side-effect-free.

**Stored does not mean attested.** Reports are immutable descriptive submissions
with `UNATTESTED_MINIMIZED_INPUT`, FAIL/REVIEW_REQUIRED and permanently false
promotion authority. The same API accepts the output of the deterministic
comparison or a strictly validated minimized Human/headless report. It does not
claim the supplied metrics, source SHA, privacy/rights input flags, dataset
hashes or evaluator revision have been independently verified. Format and
internal counts/gates/verdict are validated server-side and independently in
SQL, but are not a protected feature loader, evaluator receipt or quality gate.
No report can authorize model access, source effects, policy activation or
independent Acceptance.

Creation binds an existing Candidate's exact revision, baseline SHA, source
Case, current worker/Attempt/Input and the actual existing Improvement Child.
Current Candidate gates are revalidated through the existing private native
Candidate delegate: protected ELIGIBLE revision, current Decision pointer and
verified terminal Feedback/source/assignment bindings. That readback uses a
logical replay key and neither creates another Candidate/Child nor starts work.
An unverified/stale/wrong-Case/foreign-owner candidate cannot be attached.
Reports contain no sample, feature, original text, prompts or arbitrary URLs.
Families, counts/rates, bounded intervals and categorical metadata are strict.

Exact evaluation identity/content/principal/revision/Attempt/Input replay returns
the original record even after privacy drift, only after current owner/key
authorization. Changed content under that ID is denied. Logical dedup is bound
to Candidate revision and minimized result; elapsed-time measurements and
transport EvaluationID/responsibility Attempt are excluded. Reordered/repeated
Evidence references are canonicalized. Different metrics/dataset/source
revisions produce a distinct append-only report, not an overwrite. Logical
recovery still requires current Candidate gates. Use the returned canonical
evaluation ID/revision; the stored principal/time and first elapsed measurements
are not rewritten by retries. Exactly one native audit records the initial
report and its Candidate/Case/Child/Attempt/Input/identity bindings.

The existing Human Case panel lists reports and accepts strict minimized JSON
under an explicit Candidate selection. Same API/schema/RPC validators are used
without a model or running Swarm orchestrator. The submission ID survives a lost
response until successful readback. UI guards are not authority; SQL checks the
actual persisted bindings. Live production UI/restart proof remains pending.

Dataset/Row triggers and the existing LocalTable broker guard reject direct
authenticated/service writes, marker-omission inserts, overwrite, deletion or
renaming. Private pre-evaluation delegates are not externally callable.
Scoped machine-key expiry/revocation/Case-scope loss deny even report readback.
Existing postgres administrative authority is unchanged. Synthetic isolated
privacy fields remain explicitly privileged fixtures, not real coverage proof.

Actual isolated checks after eight DMS migrations:

```bash
AXTN_DOCUMENT_TEST_CONTAINER=axtn-native-supabase-db AXTN_DOCUMENT_TEST_DATABASE=dms_native_contract_evaluation_20261005 node tests/integration/documentEvaluationPersistence.mjs
AXTN_DOCUMENT_TEST_CONTAINER=axtn-native-supabase-db AXTN_DOCUMENT_TEST_DATABASE=dms_native_contract_evaluation_20261005 npx vite-node --script tests/integration/documentEvaluationNative.ts
```

The first fixture proves sixteen real PostgreSQL sessions, canonical one-report/
one-audit dedup, immutable/new-session readback, native role/broker denial and
current candidate/privacy/key guards. The second runs the actual bounded
recognizer/comparison and persists its measured verdict through that same RPC,
then verifies exact lost-response and list readback. An actual fuzzy regression
is retained as FAIL rather than converted into acceptance. Both use the owned
Candidate fixture and wait for all sessions before targeted cleanup.

Remaining: protected approved feature/vocabulary/source/rights/privacy loader,
independent evaluator/review/PR receipts, approved QualityProfile and controlled
policy promotion/activation ([disabled native drafts](POLICIES.md) do not provide
that authority); FilingReceipt/effects, minimized native checkpoints and full
live graph/restart/Acceptance. This migration does not silently upgrade
unattested report inputs into any of those authorities.
