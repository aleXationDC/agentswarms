# Native minimized Document Feedback V1

The accepted DMS recovery/learning request requires append-only verified
feedback; silent filing success is not confirmation. This increment extends
the existing authenticated `/api/cases/work`, Document Work adapter,
`axtn_case_document` RPC, owner-bound logical Datasets and native audit.
It introduces no scheduler, Case store, approval engine or learner.

`document_feedback` accepts the strict `document-feedback-v1` contract.
It binds Case, current Attempt/InputHash, exact provider SourceRevision,
immutable DecisionID/Revision, minimized before/after family/target IDs,
reason code and canonical Evidence references. Authenticated identity,
confirmation authority, record revision and timestamp are server-derived.
No original text, filenames, arbitrary URLs, free-text explanations,
caller-supplied owner/approval/verified flags or prompts are accepted.
Family/target values are bounded categorical identifiers, not document text.

Verified confirmation/correction/exception/taxonomy events require the real
authenticated Human owning the current Case work. Machines may submit only
explicit `UNVERIFIED` observations; neither those observations nor provider
success become verified feedback. The original assignment is checked against
the current persisted Decision. Corrections require an explicit confirmed
predecessor, matching before/after continuity and a single successor.
Unverified events cannot supersede confirmed events.

Event identity is immutable. Identical replay returns the original row;
equivalent content with another EventID, reordered/repeated Evidence references
returns the canonical existing event. **Use the returned feedback_id**, not an
assumed caller EventID, for later corrections. Changed content under the same
EventID fails. After Decision drift only immutable exact/equivalent readback is
allowed; new events fail. Same owner advisory lock and unique logical keys
serialize concurrent events/corrections. Replay never adds another audit.
Timestamp/identity/Case/Attempt/Input/Decision revisions and Evidence remain
durably findable through `document_feedback_events`.

The existing Case-detail Document Work panel loads the same records, exposes
Human confirmation and explicit correction, and retains a submission EventID
until success so a lost response can be replayed. Multiple confirmed tips
produce an explicit clarification error, never arbitrary predecessor choice.
UI/headless share the exact schema/server/RPC validators and gates; neither
requires an LLM or running Swarm orchestrator. Feedback does not change Case,
Decision, source file, privacy state or independent Acceptance.

Additive migration `20261004140000_document_feedback.sql` creates the protected
native logical feedback seam and extends Row/Dataset/LocalTable bypass guards.
Its delegates are private; only the existing service-role boundary can invoke
the registered Case RPC. Direct client/service-role Row writes, deletions,
Dataset renaming and generic LocalTable upserts are denied. Postgres retains
its existing administrative/test authority; no new public role is granted.

Actual isolated fixtures:

```bash
docker exec -i axtn-native-supabase-db psql -X -q -U postgres -d dms_native_contract_feedback_20261005 -v ON_ERROR_STOP=1 < tests/integration/documentFeedback.sql
AXTN_DOCUMENT_TEST_CONTAINER=axtn-native-supabase-db AXTN_DOCUMENT_TEST_DATABASE=dms_native_contract_feedback_20261005 node tests/integration/documentFeedbackConcurrency.mjs
```

The helper refuses databases outside the explicit isolated
`dms_native_contract_*` scope. Six candidate migrations must already exist in
that fixture database. These fixtures are not real human Acceptance or
production deployment. A Human may record minimized feedback for NO_AI work
without granting semantic authority; this does not authorize a Learner/Judge
to process its original or unapproved features.

**Incomplete and not activated:** LearningCandidate Child construction,
side-effect-free evaluation/splits/metrics, immutable disabled AutomationPolicy,
quality promotion, protected provider FilingReceipt, full native graph and
live UI/restart acceptance still require completion. Feedback writes do not
create/promote a candidate, enable a policy, trigger learning or re-file.
