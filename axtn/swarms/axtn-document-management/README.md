# Native DMS recovery sources

`graph.mjs` recovers the Parent and deterministic Privacy graph definitions
from `7123d0ef167e72b39ee39a944e418003a253f50f`. Cleanup is retained separately
under `../axtn-blacklisted-file-cleanup/`. These definitions are **not a complete
seed, runtime activation or production-ready DMS**.

`dependencies.json` inventories exact stable IDs, provenance/source hashes,
native dependencies, observed missing values and separate implementation,
test, deployment and runtime-verification states. It must not be consumed as
invented Agent, Skill, Knowledge Base, provider credential or owner settings.
Exact later semantic definitions remain unresolved; demo/predecessor settings
are not replacements.

The historical applier was deliberately not restored: it required existing
Parent/Privacy/Agents and directly changed published snapshots. The recovery
must use the existing authenticated native publish lifecycle and a complete
dependency-ordered seed, with protected DMS Approval/Case/effect bindings.

The recovered sources include two bounded safety repairs:

- Filing verification requires actual provider file ID, exact name and sole
  target parent to match the explicit instruction. `filed=true` alone cannot
  produce FILED. This check does not substitute for pending revision/rights/
  decision/policy/Approval validation or durable effect fencing.
- Cleanup never defaults to all candidates. It requires a nonempty, duplicate-
  free explicit selection wholly within the offered scope and an Approval
  reference. The reference alone is not approval authority; protected native
  reviewer/receipt binding is still required before activation.

Executed Function-body fixtures live in
`tests/unit/documentRecoveredGraphSafety.test.ts`. Pure recognition recovery
does not automatically seed or activate a learned rule. Full Parent execution,
privacy services, persisted registries, independent review, provider effects
and Learning remain separately gated.

## Protected native Approval adapter

The existing Approval row, IAM reviewer routing and native Suspend/Resume now
have a tested DMS adapter in
`src/axtn/workbenches/documents/documentApproval.server.ts` and additive migration
`20261004100000_document_native_approval_binding.sql`. It is not deployed or
materialized into the recovered graphs.

An Approval node declares `approvalDocument` with `caseId`, `decisionId`,
`operationId` and a literal `operation` (`CLASSIFY`, `FILE` or `DELETE`).
The identifiers may use existing native context interpolation; the operation
may not. A classification step cannot authorize a deletion proposal. The
server derives the binding from protected current Case/Proposal data and
the persisted run snapshot, never client-provided routing or free-text output.
Owner/Builder self-decision is denied; only authenticated routed reviewers
or current members of the routed group can decide. Current proposal and
reviewer authority are rechecked before decided resume. Binding, minimized
proposal, routing and run snapshot remain immutable and auditable.

Callback readback reuses the same native run/operation; cancelled operations
cannot be revived. Human takeover fences machine requests. Machine requests
need protected privacy evidence; claimed `ELIGIBLE` is insufficient. Non-null
Rule/Policy bindings remain blocked until their authoritative adapter exists.
Approval alone proves no provider permission, physical effect or Case closure.
The native checkpoint still can persist context; payload minimization here
does not claim complete DMS trace redaction or retention acceptance.

Tests: `tests/unit/documentApproval.test.ts` and
`tests/integration/documentApproval.sql`. SQL fixtures run only against a
dedicated schema-only test database and roll back; they are not real human
Acceptance or production runtime evidence.

Additive migration `20261004110000_document_current_proposal.sql` extends that
same domain RPC with a protected current Decision/revision pointer per
operation in the existing Case. A new proposal selects its immutable revision
atomically without changing the Case lifecycle. Prior proposals remain
append-only and findable, but their late callbacks cannot reactivate them and
their Approvals cannot resume after supersession. The shared read API exposes
derived `current` status; the manual panel labels non-current proposals.
Machine proposals and all semantic mode transitions require verified
`ELIGIBLE` privacy and may never use a NO_AI manifest, even with a plausible
proof hash. Private legacy delegates have no service/user execute grant.
The additional actual SQL suite is `tests/integration/documentCurrentProposal.sql`.
