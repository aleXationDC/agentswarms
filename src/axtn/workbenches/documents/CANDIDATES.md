# Native inactive Document Learning Candidates V1

`document_candidate` and `document_candidates` extend the existing authenticated
Case API, Document Work adapter, `axtn_case_document`, native owner-bound Dataset
and audit. No learner, scheduler, approval engine or second Case service is added.
Additive migration `20261004150000_document_learning_candidate.sql` follows the
six earlier DMS migrations.

The strict `document-learning-candidate-v1` payload references exact App baseline
and test-profile revisions, current Case/Attempt/InputHash, immutable Decision,
verified Feedback IDs/revisions, a bounded hypothesis, risk codes and Evidence.
The rule manifest references an existing pattern revision and condition indices;
only match-mode/deviation and family/target mapping changes are representable.
It cannot contain new condition text, original document content, arbitrary URLs,
executable code, broader source/operation scope or an enabled policy.

Server identity and record revision are derived, not supplied by the caller.
Native storage checks the current worker and source scope, exact protected
ELIGIBLE privacy revision and current Decision pointer. NO_AI, UNRESOLVED,
unverified/superseded feedback, source/input/Decision drift, mismatched confirmed
family/target or disagreeing confirmed terminal assignments deny creation without
mutating Case, Approval, Feedback or Candidate state. Verified historical feedback
survives responsibility/Attempt changes only while the same Input/Source and
selected Decision remain valid; it cannot authorize a stale worker's new request.

Creation atomically ensures one existing-type `DOCUMENT_IMPROVEMENT_CANDIDATE`
Child **NEW** under the source Case and stores one append-only minimized artifact.
It does not start the Child, promote/enable a policy, change the source Decision,
invoke a model/Swarm/provider, or re-file anything. Artifact `status=NEW` describes
creation; subsequent work status belongs exclusively to the actual Child Case.
Source pattern existence, exact content/index resolution and baseline/test-profile
semantics must be proved by the later evaluation/review contract. Format-valid
references alone are not evaluation, quality or promotion authority.

Exact CandidateID replay returns the immutable original record even after drift,
but still requires current owner/key scope. Changed content/author/revision under
that ID is rejected. Logical dedup canonicalizes feedback/condition/risk/Evidence
order and repeated Evidence, excluding transport CandidateID and responsibility
Attempt/Principal from the stable hypothesis key. A currently authorized worker
can recover the same candidate/Child after handoff without creating a second Case
or rewriting its original author. **Use returned `candidate_id`, `revision` and
`improvement_case_id`**. Logical dedup must pass current privacy/source/feedback
checks; only exact replay is readback-only after drift.

The existing Human Case panel accepts minimized draft JSON and the operator's
explicit confirmed feedback selection. It binds Case/Attempt/Input/Decision and
Feedback references from native records and uses the same request/schema/API.
Original fields and authority injection fail validation before submission.
The draft includes `schemaVersion`, `baseline`, `hypothesis`, `risks`,
`testProfile` and `changeManifest`; identifiers and Evidence are supplied by the
existing panel rather than guessed from text. Candidate records remain findable
in the same panel. A lost response retains the CandidateID until successful
readback. UI disabling is not the authority gate; the native server checks all
bindings. Actual production UI/restart acceptance remains pending.

Protected Dataset/Row and LocalTable guards reject direct authenticated/service
writes, marker-omission inserts, renaming/deletion and generic broker overwrites.
Private delegates remain inaccessible; revoked/expired/non-Case keys cannot
create or read back candidates. Postgres retains its existing administrative
authority. Isolated tests explicitly inject synthetic privacy receipt fields
as postgres; they do **not** prove a real privacy setter or coverage profile.

Actual isolated contract/concurrency fixture:

```bash
AXTN_DOCUMENT_TEST_CONTAINER=axtn-native-supabase-db AXTN_DOCUMENT_TEST_DATABASE=dms_native_contract_candidate_20261005 node tests/integration/documentCandidateConcurrency.mjs
```

The existing helper refuses a database outside `dms_native_contract_*`.
Seven candidate migrations must already be installed transactionally in that
isolated schema. The fixture runs sixteen actual service-role sessions and
new-session readback, real scoped-key expiry/revocation/scope loss, verified
correction/supersession/conflict gates and native Child/one-audit assertions.
It waits for all concurrent calls before cleaning only its own synthetic owner.
No production key, state, policy or provider operation is created.

**Still incomplete:** side-effect-free evaluation with independently split
datasets and family metrics, immutable disabled AutomationPolicy, promotion
QualityProfile, protected FilingReceipt, independent review/PR handoff and full
live DMS graph/acceptance. Missing QualityProfile blocks promotion, not this
inactive candidate function. Builder feedback/candidate creation is not
independent Acceptance.

The [deterministic comparison basis](EVALUATION.md) now executes the existing
recognizer on bounded minimized projections and independently grouped splits.
Its output is explicitly unattested, never protected privacy or promotion
authority. Native evaluation persistence and the protected loader remain pending.
