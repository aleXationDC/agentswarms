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
