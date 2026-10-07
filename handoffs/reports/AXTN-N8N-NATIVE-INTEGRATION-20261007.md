# Native n8n integration follow-up

Date: 2026-10-07
Repository: `aXtn/aXtn-agentswarms` (Gitea)
Issue / PR: `#12` / `#14`
Branch: `work/AXTN-ENVIRONMENT-PATTERN-PILOT-EXECUTION-0001`

## Findings and cause

The host-side AgentSwarms runtime has a protected `N8N_BASE_URL` and
`N8N_API_KEY`. A post-deployment request from the AgentSwarms container
authenticated successfully against the existing n8n 2.36.9 API and returned
HTTP 200, six workflows, and zero active workflows. The key is a read/list
platform credential; it is not the n8n Owner login.

The product-side AgentSwarms integration state was different: the prior
read-only Supabase inventory found no `type='n8n'` row and no
`integration.create` / `integration.update` audit events. Thus the instance
was reachable from the host runtime but was not bound in the user's native
Integration Hub. No Owner credential, API key value, or user identity was
read or reported. No credential reset, authentication bypass, workflow
mutation, or direct Case-table write was attempted.

The exact body of Gitea Issue #12 comment 960 could not be independently
retrieved with the available signed-in Gitea access during this execution.
This report relies on the user's explicit instructions and the existing
Gitea branch; it does not claim a fresh readback of that comment.

## Implemented

Source commit `783ed4ecfd4d245e56b000bf1d7af9e6f61a7079` adds a native
host-managed binding through the existing AgentSwarms integration and tool
paths:

- The authenticated Integration Hub can discover and display the configured
  host endpoint and live workflow/active counts. The host API key stays on the
  server.
- Saving the native choice requires superadmin authorization and stores only
  `{ binding_mode: "native" }`, not the host URL or API key.
- Integration health and native tool resolution use the same server-side
  binding. Authorization is rechecked when the host credential is resolved.
- Managed workflow execution uses the existing `n8n_run_workflow` tool and
  requires an explicit workflow-ID allow-list on the Agent/Swarm.
- The adapter reads workflow metadata with the API key and only accepts one
  active workflow with one static POST Webhook trigger and no webhook
  authentication. Redirects are disabled; the API key is never forwarded to
  the webhook. Unsupported shapes fail closed.
- The chat notifier does not reuse the managed API key against an
  agent-supplied webhook URL. User-owned external n8n configuration remains
  on its existing separate path.

The n8n API's read/list credential cannot create or activate a workflow.
Because all six existing workflows are inactive, no workflow can currently
produce the requested execution evidence. They were all left unchanged.

## Validation and deployment

- Focused native n8n, authorization, execution, UI compatibility, and token
  reload regressions: 66 tests passed across five files.
- TypeScript typecheck: passed.
- Scoped ESLint: zero errors; eight `no-explicit-any` warnings in existing
  surrounding UI/tool code.
- Deployment-document checks: passed.
- Production build: passed.
- Full unit suite excluding
  `tests/unit/documentRecoveryInventory.test.ts`: 612 files passed, 10,035
  tests passed, 40 skipped.
- The excluded, unrelated DMS inventory test expects router revision
  `6c13432b`; its checked-in inventory identifies current DMS router revision
  `2bada0814fca2ac719518310cea2ce5113fd0a2c`. The unfiltered suite therefore
  still has that one stale inventory assertion failure.
- Exact app source deployed: `783ed4ecfd4d245e56b000bf1d7af9e6f61a7079`.
- Runtime image ID:
  `sha256:1de2d89d41363ead364d11262a7e346ad60a1453d7222ff5c93fe9096fc82d0b`;
  OCI source label matches the commit.
- Existing targeted Host Compose convergence recreated only AgentSwarms. The
  app container is healthy; private and HTTPS health endpoints returned
  HTTP 200. The existing n8n container remained running without restart.
- The Host pin and bootstrap defaults were advanced to the exact deployed
  commit in `aXtn/aXtn-host`, branch
  `work/AXTN-HOST-ENVIRONMENT-PATTERN-PILOT-0001`, commit
  `e5eee6486137fdbece284a08053b2d44950b88e2`.

## Completion state

| Dimension                                                        | State                                                                                                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Implemented                                                      | **Yes** — host-managed binding, server-side credential use, guarded native tool dispatch, Integration Hub status path                 |
| Tested                                                           | **Yes, bounded** — focused tests, typecheck, lint, docs, production build; full suite has one unrelated stale DMS inventory assertion |
| Deployed                                                         | **Yes** — exact source/image above, health checks pass                                                                                |
| Visible and operable in authenticated UI                         | **Not yet demonstrated** — no AgentSwarms product superadmin session was available to save the marker or capture the real-user view   |
| Native Swarm→n8n call with persisted Case/Run/Execution evidence | **Not yet demonstrated** — zero active flows; no product session or case-scoped SupaCase credential was available                     |
| Independently accepted                                           | **No** — pending an eligible independent reviewer                                                                                     |

Parent SupaCase `732dec32-082a-423a-85cd-3cdda5ab1341` and its Children were
not modified because this execution lacked an authenticated AgentSwarms
product session and `cases`-scoped credential for the native Case Work
endpoint. The Cases remain the required tracking record; the app/Host Git
evidence does not substitute for them.

## Exact remaining operator actions

1. A superadmin signs into AgentSwarms and opens `/integrations` →
   **n8n Workflows**, enables **Use host-managed native n8n**, and selects
   **Validate & Save**. This records only the native binding marker and should
   show the authenticated endpoint status and workflow counts.
2. The n8n Owner signs into the existing n8n UI and creates one dedicated,
   side-effect-free test workflow with a static POST Webhook trigger and fixed
   response. Activate only this newly created test workflow; leave the six
   existing workflows unchanged. Confirm the webhook is reachable only on
   the already-private component network.
3. The superadmin adds only that workflow's exact ID to an existing
   authenticated Agent/Swarm's `n8n_workflow_ids` allow-list and performs one
   bounded native tool run on the existing Parent/Child Case. Read back the
   resulting Case, Swarm Run, and n8n execution IDs through their native
   surfaces; do not use a direct database write.
4. An eligible independent reviewer checks this exact source revision and
   evidence. No self-acceptance, PR merge, tag, or release is implied here.

These are distinct identities and scopes: the working platform API key proves
AgentSwarms→n8n API authentication; it does not prove an n8n Owner session or
an AgentSwarms/SupaCase product session.
