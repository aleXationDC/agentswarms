# Native Developer Runtime acceptance

**IMPLEMENTED / TESTED / DEPLOYED / RUNTIME_VERIFIED** for the Runtime Work Package.
Full V1 and independent Parent Acceptance remain IN_PROGRESS.

- Parent `85a1d829-39ac-49bd-9047-163ab52d427b`.
- Runtime Work Child `e9d954a7-8c37-48c9-988d-5942f21bbb19`.
- Retained Regression Child `ac6ac6b5-f201-46c1-9f86-6c0732d8962a`.
- Executable source `189e7960530207415d6cef45c1dd5b3c6e6695ba`.
- App image `sha256:0ab3e7d7a0e053386c895591c0dd4cb28667bfd938f179a03459b367e6ce6fbd`.
- Wrapper image `sha256:bf7a93450c449eb9e5dad388dd3f868f6c1530f84924e7f973945cb17d36c803`.
- Host implementation `f8e9345919dcd3c5ab066391f97dc745390f8219`.
- Additive migration `20260929020000_development_runtime.sql`, native ledger 276.

Authoritative full deployment/isolation/preservation/rollback evidence:
`aXtn/aXtn-host:evidence/development-swarm/20261003T-native-runtime-acceptance.md`.
The earlier source report describes its historical checkpoint, not current deployment.

Real user-authenticated verification against complete immutable MCP-read snapshots
produced native baseline FAIL/candidate PASS for acceptance PR #2, revision
`7448eaa6447ed68d8aabe608715146a08fbed369`.
Receipt `c7532662-de0c-4e7c-8836-6d947a0a7d04` is persisted, replay-identical and
unchanged after app restart. Broken, timeout and bounded hostile/output revisions
in retained PRs #3/#4/#5 produced baseline PASS/candidate FAIL. None were merged.

Actual live service-created container isolation, native no-network/no-credentials,
real grant/owner/auth/snapshot denial, effect conflicts, PostgREST receipt tamper/
delete/profile-laundering denials and valid-token callback denials passed.
Rollback-only SQL role tests passed after migration without persistent changes.
The shared Squid ACL facility proved allowlisted PyPI 200/non-allowlisted destination
403; native verification does not use that network.

App-only restart preserved all five native sessions, one explicit grant and eight
retained Cases exactly. Existing private login and six-tool native browser-facing
MCP probe passed. Supabase user/integration/dataset counts, provider config,
published Document Intake graph, six native n8n workflows and zero credentials
were preserved. Native n8n/Gitea/Matrix health and managed workflow read passed.
D09 remained CLOSED.

Source gate remains 555 unit files / 9,039 PASS / 40 SKIP; typecheck/lint/docs/infra/
production build PASS, seven hermetic verifier tests PASS. Host 37 distinct Python
tests and native static/Compose gates PASS. Actual signing-secret/source/browser/
task/runtime-log non-exposure scan PASS.

## Reproduction

The opt-in native acceptance driver
[`native_acceptance.mjs`](../../tests/development-runtime/native_acceptance.mjs)
reads retained fixture revisions through the actual headless product registry
and protected native credentials on the authorized host. Set
`AXTN_ACCEPTANCE_PRIVATE_SUPABASE_ORIGIN` to the private AgentSwarms HTTPS origin
plus `/supabase`, then run:

```sh
node tests/development-runtime/native_acceptance.mjs
python3 -B tests/development-runtime/receipt_policy.py
python3 -B -m unittest discover -s tests/development-runtime -p 'test_*.py'
```

The driver replays stable effects and removes only its recorded disposable negative
auth identity, never a Case. No token or owner is provided by a graph. It does not
enable runtime, change grants, merge, deploy or relax limits.

Remaining work is the full SupaCase contract and executable OpenAI-default graph,
followed by independent integrated Acceptance. Runtime Work Completion is not
self-acceptance of that Parent.
