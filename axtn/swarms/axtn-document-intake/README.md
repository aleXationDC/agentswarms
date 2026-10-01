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

The empty-database seed/apply regression is covered by
`tests/unit/axtnDocumentIntakeSeed.test.ts`:

```sh
npx vitest run tests/unit/axtnDocumentIntakeSeed.test.ts
```
