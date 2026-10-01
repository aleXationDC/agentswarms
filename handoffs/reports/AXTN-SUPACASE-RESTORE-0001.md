# AXTN-SUPACASE-RESTORE-0001

## Result

aXtn SupaCase has been restored onto the current AgentSwarms 1.5 D09 maintenance baseline as a complete capability candidate.

Status: SOURCE_RESTORED_VALIDATION_PENDING

Authoritative repository: aXtn/aXtn-agentswarms on Gitea
Base branch: work/AXTN-D09-MAINTENANCE-0001
Base commit: 21a435d5f7f306f41d01c2c5e7dc504ccd1e46d8
Restore branch: work/AXTN-SUPACASE-RESTORE-0001
Restore head at report creation: da13831d767953ed391fc2188c6fed173fe9d4bb

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
- tests/unit/axtnWorkbenches.test.ts

## Validation required before host pin promotion

Required:
- typecheck
- focused SupaCase unit tests
- full relevant AgentSwarms unit suite
- production build
- authenticated UI smoke: /cases, /cases/:id, /accounts, /contacts
- parent/child Case create
- Account/Contact create and Case references
- Document assign/create-and-assign
- idempotent READY_FOR_FILING Case creation
- restart/persistence
- synthetic smoke cleanup verification

No merge, release, deployment or runtime mutation is claimed by this report.
