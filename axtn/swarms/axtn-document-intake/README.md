# aXtn Document Intake seed

`graph.mjs` restores the last committed DMS R1 graph source from
`7123d0ef167e72b39ee39a944e418003a253f50f`. The fresh Greenfield Supabase
database inspected on 2026-10-01 had no row for this swarm, so its definition
was recovered from version history rather than copied from runtime state. The
versioned validation and acknowledgement node bodies remain the current files
under `nodes/`.

The fresh-install sequence is:

1. `node axtn/swarms/axtn-document-intake/seed.mjs` creates the fixed-ID draft
   only when absent and publishes it through AgentSwarms' shared native
   `publishSwarmForOwner` implementation.
2. `node axtn/swarms/axtn-document-intake/apply.mjs` reconciles only the two
   versioned function-node bodies and republishes through that same native
   lifecycle. Re-running it without source changes is a no-op.

Both operations require a valid session for the configured `ADMIN_EMAIL`
bootstrap superadmin. The seed endpoint cannot create arbitrary swarms or
assign ownership to another account.

## Case-bound DMS recovery

`seed-case.mjs` is the explicit DMS recovery operation. It publishes the
eight-node native Intake composition: validation, minimized Work input,
`case_work`, persisted Case/document binding, Registry write, ACK and output.
The existing compatibility seed remains unchanged. Once Case-bound Intake
is installed, ordinary `apply.mjs` recognizes it and reconciles its versioned
function bodies without removing the Case boundary.

The source envelope must supply a stable `business_request_id`, a delivery ID
(`delivery_id` or `transport.delivery_id`), exact provider revision
(`source_revision`, `source_identity.provider_revision` or
`source_identity.etag`), and SHA-256 of original bytes. Missing bindings fail
before Case creation or Registry write. The request is technical only; no
original/extracted text enters its Work input. The native Case profile mints
an opaque document ID when needed and preserves existing Registry identities.
Case and immutable input hash are included in the registration ACK.

The public synchronous Intake response retains `output` and `runId` and also
projects the validated ACK at top level for the existing n8n consumer.
This does not assert Filing, semantic processing or independent acceptance.

When the existing Document Management Parent parks at a native Approval, the
same endpoint and signed callback expose the completed Intake ACK at top level,
alongside `status: "suspended"`, the original `output` and `runId`. Readback uses
the owner-bound persisted run snapshot/checkpoint, a completed native Intake
node, the original technical manifest, and protected Case/Registry identities.
It cannot accept caller-supplied ACK fields or substitute another request.
The Registry's first Intake Case remains unchanged when another explicit
request uses the same document.

The existing idempotency claim remains `in_progress`, not completed. A retry
with the same body reads the durable registration without executing the
Parent again. Projection failure retains the parked run reference and reports
an error; it does not make the claim reclaimable or replay the workflow.
Drive registration emits no move instruction; mail retains only `00_Review`.
This source adapter does not claim full Parent publication, live Approval
verification, provider effects, Case closure or DMS restoration PASS.

### Shared manual Case profile

The owner-bound `/api/cases/work` endpoint registers `document_ensure`,
`document_transition`, `document_assign`, `document_propose` and
`document_proposals` without changing the Development
profile. The existing Case relations UI uses the same `document_assign`
validator and native RPC for protected documents. Assignment requires a real
authenticated user session and a document already registered in that owner's
Work scope. It preserves an existing primary relation; conflicting assignment
is an error. A missing relation can be restored idempotently with a durable
identity/time audit, without changing the Work attempt or asserting acceptance.

`document_propose` persists strict minimized `document-decision-v1` proposals
in the existing owner's logical `axtn_document_decisions` Dataset. Case,
attempt, input hash, opaque document and exact source revision must match the
current worker. The server derives the immutable proposal revision and records
principal/time/evidence. Proposals are append-only, deduplicated by Decision ID,
and remain `PROPOSED`; they neither change Case state nor grant Approval or
provider effect rights. No raw text, arbitrary extras or SCOPED_AUTO assertion
is accepted. Machine proposals require protected persisted privacy evidence;
claimed `ELIGIBLE` alone is insufficient. Human takeover uses this same validator,
with null graph/rule revisions rather than inventing a graph or document SHA.
`document_proposals` reads only that owner's Case proposals through the same
endpoint. Generic Row/Dataset/LocalTable mutations cannot rewrite or insert
Decision records, including rows that omit the protected marker.

Optional `externalReferenceContext` accepts only opaque `external_ref_id` and
`external_parent_ref_id`. It is untrusted input, retained separately from the
pending Issue #8 Core fields. It does not change the Work key, document identity
or local Parent. Such requests expose `external_reference_status` as
`NEEDS_CLARIFICATION`; no correlation or external lookup is inferred.

The empty-database seed/apply regression is covered by
`tests/unit/axtnDocumentIntakeSeed.test.ts`:

```sh
npx vitest run tests/unit/axtnDocumentIntakeSeed.test.ts
```
