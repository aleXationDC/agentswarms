# Native immutable disabled Automation Policy drafts

Additive migration `20261004170000_document_disabled_automation_policy.sql`
registers `document_policy` and `document_policies` on the existing Case
API/RPC, owner Dataset, audit and Human panel. It creates no activation pointer,
policy runtime, Approval engine, scheduler or second control plane.

Every revision is permanently `enabled=false`,
`authority=UNAPPROVED_DISABLED_DRAFT` and `promotionCaseId=null`. Operation is
only CLASSIFY in one explicit family/source-kind/target scope. FILE, DELETE,
wildcards, an approval claim or an activation flag are rejected. A draft is not
an automatic classification instruction and cannot authorize any source effect.
Even a retained FAIL report can be described by a disabled draft; neither report
nor draft becomes an approval, protected evaluator receipt or independent PASS.

Creation requires the owned, exact existing Candidate and Evaluation revisions,
the same source Case/Input, current worker/Attempt, matching Candidate scope
and the report's candidate-rule revision. All current Candidate privacy/
Decision/verified Feedback gates are revalidated through the existing private
delegate, with no extra Child or Candidate. The original NEW Improvement Child
is referenced, not started, promoted or accepted.

The complete seven fail-closed review triggers are mandatory, as is an ordered
explicit validity interval. A QualityProfile may be null for a disabled draft:
no quality threshold is invented. An optional exact canonical contract reference
is only a reference, not protected approval or authority to promote. Validity
metadata does not automatically activate a draft before, during or after its
interval. Promotion, controlled activation/revocation and execution consumers
remain unimplemented and cannot use these drafts.

Server-side authenticated identity and normalized revision bind each submission.
Safety-trigger order and repeated/reordered minimized Evidence do not duplicate
logical policies. The key excludes transport PolicyID and responsibility
Attempt/principal; scope, Candidate/Evaluation revisions, validity and profile
remain included. Exact ID replay requires immutable content/principal/revision/
Attempt/Input after current owner/key authorization. It can recover the
original disabled record after privacy drift; new logical aliases cannot bypass
current privacy gates. Use the returned canonical ID/revision.

Changed content under an existing ID fails explicitly. A genuinely new validity/
scope/reference revision appends a distinct disabled artifact and audit instead
of overwriting its predecessor. Native records retain Case, Improvement Child,
Attempt, Input, authenticated identity, creation time and minimized Evidence.
Dataset columns are reconciled without dropping operator-owned unknown metadata.
Direct Row/Dataset/LocalTable writes, marker omission, overwrite/delete/rename
and public calls to private delegates are denied under actual database roles.
Existing postgres administrative authority is unchanged.

The Human panel selects an existing report and accepts only strict draft JSON
with `validFrom`, `validUntil` and `qualityProfile`. Identity, references, scope,
disabled authority and safety triggers are bound from the same persisted
Candidate/report and shared validator. PolicyID survives lost responses until
confirmed readback. SQL guards, not client values or button visibility, grant
authority. No model or running Swarm orchestrator is needed for this draft path.
Production UI/restart evidence is still pending.

Actual isolated check after nine DMS migrations:

```bash
AXTN_DOCUMENT_TEST_CONTAINER=axtn-native-supabase-db AXTN_DOCUMENT_TEST_DATABASE=dms_native_contract_policy_20261005 npx vite-node --script tests/integration/documentAutomationPolicyNative.ts
```

This runs the actual bounded comparator, stores its report through the native
RPC and creates sixteen concurrent disabled drafts with one initial artifact/
audit. It proves lost-response/immutable recovery, privacy drift, real scoped
machine-key expiry/revocation/Case-scope loss, worker and scope/revision checks,
generic native write denial, append-only new revision and lossless metadata
reconciliation. Explicit privileged privacy fields and numeric fixture features
are isolated test authority, not live source rights or coverage receipts.

Remaining: protected feature/source/privacy/rights and independent evaluator/
review receipts, professionally approved QualityProfile, controlled promotion/
activation/revocation and synthetic SCOPED_AUTO proof, protected FilingReceipt/
effect recovery, original-free traces/checkpoints and full live Acceptance.
