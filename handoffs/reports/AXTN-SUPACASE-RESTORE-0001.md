# AXTN-SUPACASE-RESTORE-0001

## Result

aXtn SupaCase has been restored onto the current AgentSwarms 1.5 D09 maintenance baseline as a complete capability candidate.

Status: SOURCE_VALIDATED_HOST_ACCEPTANCE_PENDING

Authoritative repository: aXtn/aXtn-agentswarms on Gitea
Base branch: work/AXTN-D09-MAINTENANCE-0001
Base commit: 21a435d5f7f306f41d01c2c5e7dc504ccd1e46d8
Restore branch: work/AXTN-SUPACASE-RESTORE-0001
Restore source commit tested: 49f79e0392a268d9ff88b19aa0c97f1094e0fc34
Restore branch head before this report-only status update: 04dd3a26409dd83e44b929c386c5c848e0744832

## Recovered accepted capability

Historical authoritative Gitea source:
- change/AXTN-SUPACASE-MANAGEMENT-0001
- change/DMS-MVP-E2E-SUPACASE-NAV-0001

Recovered semantics:
- Case is the persistent business work object; Swarm Runs remain technical execution records.
- User-owned logical datasets: axtn_cases, axtn_accounts, axtn_contacts, axtn_case_relations.
- Arbitrary parent/child Case hierarchy via parent_case_id.
- Explicit Case relations to documents, contacts, accounts and other cases.
- Thin Account and Contact context rather than a parallel CRM.
- Due/follow-up, WAITING_CONTACT, CLOSED->OPEN on relevant activity and guarded automation priority.
- DMS filing acceptance creates/reuses exactly one Case and explicit document relation.
- Document and Review surfaces expose Case assignment/create-and-assign.
- Dedicated Cases, Accounts and Contacts routes are restored.
- Workbench registry and navigation entry are restored.

## Current 1.5 integration

The historical business semantics are preserved, but the restored implementation is attached to the current D09 runtime contracts.

In particular:
- current D09 checkpoint-based resume and cancellation behavior is retained;
- SupaCase filing acceptance was added after successful resumed execution without replacing the newer resume logic;
- a completed READY_FOR_FILING run can retry Case creation from its persisted final output, and a partial Case-without-relation write is repaired without creating a duplicate Case;
- Case server-function results use JSON-serializable row types, while dataset access remains scoped to the authenticated owner;
- Case detail supports editing Case fields and status, explicit Close/Reopen actions, and primary Account/Contact references;
- owner-authenticated Case relation creation now supports related Cases, Accounts and Contacts, with same-owner target validation, self-link rejection, and idempotent duplicate handling;
- parent/child Case creation remains supported, and Case detail resolves explicit related records to their management surfaces;
- the generic user_data_tables / user_data_rows persistence seam remains available in AgentSwarms 1.5;
- no physical Supabase schema, second persistence plane or n8n control plane was added.

## Restored source

- axtn/workbenches/axtn-supacase/manifest.json
- src/axtn/workbenches/cases/**
- src/components/axtn/CaseRelationsPanel.tsx
- src/routes/_authenticated/cases.tsx
- src/routes/_authenticated/cases_.$caseId.tsx
- src/routes/_authenticated/accounts.tsx
- src/routes/_authenticated/contacts.tsx
- src/routes/_authenticated/documents_.$documentId.tsx
- src/routes/_authenticated/review_.$approvalId.tsx
- src/utils/swarmResume.functions.ts
- src/lib/appNav.ts
- axtn/workbenches/registry.json
- tests/unit/caseContract.test.ts
- tests/unit/caseManagement.test.ts
- tests/unit/caseManagementPersistence.test.ts
- tests/unit/caseDetailCapabilities.test.ts
- tests/unit/supacaseResumeAcceptance.test.ts
- tests/unit/axtnWorkbenches.test.ts

## Source validation

Validated source commit: `49f79e0392a268d9ff88b19aa0c97f1094e0fc34`

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors; repository-wide lint reports 235 existing warnings.
- `npm run check:docs`, `check:md-docs`, `check:doc-commands`, and `check:infra`: passed; the infrastructure check skipped PowerShell parsing because PowerShell is unavailable.
- Focused SupaCase, Case detail, relation persistence, Workbench registry, DMS filing and D09 resume/cancel tests: 42 passed.
- Full AgentSwarms unit suite: 547 test files passed; 8,967 tests passed and 40 skipped.
- `npm run build`: passed.
- D09 base branch remained at `21a435d5f7f306f41d01c2c5e7dc504ccd1e46d8`; its checkpoint, resume, cancel, auth and RLS paths were not replaced.

## Gitea pull request status

Canonical Gitea read-only database verification, reported by the host-side check at 2026-10-01 21:20 UTC:

- PR #5 (`aXtn/aXtn-agentswarms`): open (`issue.is_closed=false`), unmerged (`has_merged=false`).
- Head at verification: `work/AXTN-SUPACASE-RESTORE-0001`, `04dd3a26409dd83e44b929c386c5c848e0744832` (before this report-only update).
- Base: `work/AXTN-D09-MAINTENANCE-0001`, at `21a435d5f7f306f41d01c2c5e7dc504ccd1e46d8`.
- The source branch and Gitea `refs/pull/5/head` were independently confirmed to match that head.
- Related host PR #6 was also reported open and unmerged, targeting the native-bootstrap work branch; it is separate from this AgentSwarms source PR.

No protected branch was updated and no merge was performed.

## Disposable-user Document and Review smoke fixtures

`/documents/$documentId` and `listWorkbenchDocuments()` do not read `knowledge_documents`. The Documents Workbench reads only the signed-in user's `user_data_tables` row named `axtn_document_registry`, then its `user_data_rows` where `table_id` matches. The Review queue/detail reads the signed-in user's native `approvals` rows under approvals-table RLS. `useRegisteredDocument()` resolves a registration approval's document id through that same registry lookup.

For a disposable authenticated user, the minimal registry fixture is:

1. One owner-scoped `user_data_tables` row with `user_id = <disposable user UUID>`, `name = 'axtn_document_registry'`, `is_sample = false`, and `columns` declaring at least `document_id` and `record_kind` (for an intake-shaped fixture, also declare `source_ref`, `source_type`, `processing_status`, `privacy_status`, and `original_filename`).
2. One `user_data_rows` row referencing that table id. Its `row` JSON needs `record_kind: "document"` and a unique 24-character lowercase hex `document_id`. For a realistic registered document include `source_ref: "drive:<synthetic-file-id>"`, `source_type: "google_drive"`, `processing_status: "registered"`, `privacy_status: "UNRESOLVED"`, and `original_filename: "<synthetic-name>.pdf"`.
3. Open `/documents/<document_id>` using that same signed-in disposable user. The detail page should resolve the registry record; its Case / Relations panel can create-and-assign a Case. Reusing that id on an unowned table, a table with another name, a `schema_seed` row, or a row without `document_id` will not resolve.

The canonical current DMS write path is the versioned Document Intake graph's `nodes/validate-envelope.js` → `local_table_upsert` MCP operation. It targets `axtn_document_registry` by `source_ref`, asks the broker to generate `document_id` with `generate_columns: { document_id: "hex24" }`, and keeps that identity immutable on replay. The server accepts writes only from an authorized, platform-created MCP runtime session and an owned, allow-listed Local Table; do not simulate this with `knowledge_documents`.

For the Review browser smoke, create a native `approvals` row owned by the same disposable user with `status: "pending"`, a synthetic `agent_name`, `action_title: "Review Intake Registration"`, `action_type: "swarm_step"`, `risk_level: "medium"`, and `payload: { last_output: JSON.stringify(ack) }`, where `ack` contains the exact same `document_id`, plus `source_ref: "drive:<synthetic-file-id>"` and `processing_status: "registered"`. A JSON-string `description` containing the same acknowledgement is a supported fallback. Keep `swarm_run_id` null for a display/assign smoke that must not resume any run. Then open `/review/<approval-uuid>`; the detail resolves the same registered document and shows Case / Relations. The identity match between `ack.document_id` and the registry row is required.

The existing Documents registry and Review presentation tests cover these shapes and the `registrationContext()` parsing contract. The live smoke mismatch was the fixture table, not a source defect; no application code or live/runtime data was changed for this finding.

## Validation still required before host pin promotion

Required:
- authenticated UI smoke: /cases, /cases/:id, /accounts, /contacts
- parent/child Case create
- Account/Contact create and Case references
- Document assign/create-and-assign
- restart/persistence
- synthetic smoke cleanup verification

No merge, release, deployment or runtime mutation is claimed by this report.
