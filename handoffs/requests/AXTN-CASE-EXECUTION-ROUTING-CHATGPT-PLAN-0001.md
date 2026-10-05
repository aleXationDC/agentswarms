# Implementation Assignment: Case Responsibility, Execution Routing and aXtn ChatGPT Plan

**Assignment ID:** `AXTN-CASE-EXECUTION-ROUTING-CHATGPT-PLAN-0001`  
**Repository:** `aXtn/aXtn-agentswarms`  
**Branch:** `work/AXTN-CASE-EXECUTION-ROUTING-CHATGPT-PLAN-0001`  
**Tracking issue:** `aXtn/aXtn-agentswarms#10`  
**Required base:** `6bf776ef7c9abb59224f0477dc7257f94f93f4ca`  
**Architecture contract:** `docs/architecture/axtn-case-execution-routing/ARCHITECTURE.md`

## Auftrag

Implementiere, deploye und verifiziere die im Architekturvertrag vollständig festgelegte Erweiterung. Die Architektur ist entschieden. Deine Aufgabe ist Umsetzung, Test, produktive Verifikation und Fehlerbehebung innerhalb der festgelegten nativen Contracts.

Du darfst keine alternative Architektur, keinen Dispatcher, keinen Controller als versteckte Orchestrierung, keine zweite Control Plane und keinen Ersatz-Case-Store entwerfen. Wenn eine festgelegte Entscheidung mit nachgewiesener Source-/Runtime-Wahrheit unvereinbar ist, tritt der definierte Stop-Gate ein: anhalten, Evidence liefern, kleinste notwendige Änderung benennen, nicht eigenmächtig ersetzen.

## Vor Beginn zwingend lesen

1. `AGENTS.md`
2. `docs/architecture/axtn-development-swarm/HANDOFF.md`
3. `handoffs/requests/AXTN-DEVELOPMENT-SWARM-NATIVE-0002.md`
4. `docs/architecture/axtn-case-execution-routing/ARCHITECTURE.md`
5. `src/axtn/workbenches/cases/caseContract.ts`
6. `src/axtn/workbenches/cases/caseManagement.server.ts`
7. `src/axtn/workbenches/cases/workContract.ts`
8. `src/axtn/workbenches/cases/work.server.ts`
9. `supabase/migrations/20260929010000_axtn_case_work.sql`
10. `supabase/migrations/20260929030000_axtn_work_contract.sql`
11. `src/routes/api/swarm.run.ts`
12. `src/utils/swarmExecute.server.ts`
13. `src/routes/api/chat.ts`
14. `src/utils/providers/credentials.server.ts`
15. `src/utils/providers/credentials.functions.ts`
16. `src/utils/providers/types.ts`
17. `src/routes/_authenticated/integrations.tsx`
18. `src/utils/iam.server.ts`
19. `src/lib/iamRules.ts`

Die Dateien auf `work/AXTN-DEVELOPMENT-SWARM-0001` sind superseded und keine Implementierungsbasis. Die drei dortigen ChatGPT-Plan-Dateien dürfen ausschließlich als Hinweise auf bereits untersuchte PKCE-, Token-Refresh- und app-server-Mechanik gelesen werden. Keine dortige Entwicklungs-Controller-/Dispatcher-Architektur übernehmen.

## SupaCase-Arbeitsstruktur

Als erste mutierende Aktion über den bestehenden nativen Case-Work-Contract:

1. vorhandenen Parent für dasselbe Gesamtziel anhand Assignment-/Issue-Referenz suchen und fortsetzen; nur falls nicht vorhanden exakt einen Parent `DEVELOPMENT_CHANGE` sicherstellen;
2. maximal vier accountable Children sicherstellen:
   - `CASE_RESPONSIBILITY_AND_ACCESS`
   - `EXECUTION_PRINCIPAL_AND_CREDENTIAL_ROUTING`
   - `AXTN_CHATGPT_PLAN_PROVIDER`
   - `INTEGRATION_RUNTIME_ACCEPTANCE`
3. keine Cases für Nodes, Befehle, einzelne Tests, Retries oder Logs erzeugen;
4. diese Arbeit als `COPILOT_CLI`/passenden Processing Mode führen;
5. Cases nach Work-Completion schließen; Acceptance separat und unabhängig halten.

Wenn der bestehende Case-Contract die neue Assignment-Funktion noch nicht ausdrücken kann, nutze den aktuellen Custodian-Vertrag für diese Implementierungsarbeit und erweitere ihn im ersten Child. Das ist Bootstrap, keine Erlaubnis für ungetrackte Arbeit.

## Umsetzungspakete

### WP1 — Case Responsibility and Access

- additive Migration der im Architekturvertrag festgelegten Assignment-Felder;
- Case-spezifische serverseitige Lese-/Mutationsautorisierung auf Basis nativer IAM users/groups;
- UI zum Zuweisen an User, Group oder System sowie optionalem Assignee;
- transaktionale Child-Inheritance und Parent-Cascade;
- optimistische `assignment_version`-Konfliktprüfung;
- Assignment-Audit und KPIs ohne Doppeldokumentation;
- vorhandene Case IDs, Rows, Relations und Work Contracts migrieren/backfillen, nicht kopieren.

Bevorzugte Änderungspunkte: bestehende Case Contracts/Server/UI und eine additive Supabase-Migration. Neue Module nur für klar abgegrenzte Assignment-/Resolver-Logik.

### WP2 — Execution Principal and Credential Routing

- Case-Bindung am nativen `swarm_runs`-/executeSwarmServer-Pfad;
- Trennung von Custodian, Initiator, Data Scope, Budget Subject, Execution Principal und Credential Owner;
- serverseitige Auflösung ausschließlich aus Run + Case;
- deterministischer, transaktionaler Group Claim;
- sticky Attempt binding und idempotentes Resume/Retry;
- explizite Credential Policy `SYSTEM_INTEGRATION` oder `PERSONAL_CONNECTION`;
- Case-Route-Override ausschließlich für Mode, Provider, Model und Version; niemals Credential-ID oder Credential Owner;
- eindeutige Company-Integration-Auflösung; bei null oder mehreren geeigneten Integrationen explizit `SYSTEM_INTEGRATION_UNAVAILABLE` beziehungsweise `SYSTEM_INTEGRATION_AMBIGUOUS`, niemals Auswahl nach neuestem Datensatz;
- typed failures und menschliche Fortsetzungsentscheidung;
- keine stillen Fallbacks und keine User-/Credential-IDs im Graph.

Bestehende native Checkpoints, retry policy, condition/router/approval nodes und traces wiederverwenden. Keine Sequenzierung im Resolver verstecken.

### WP3 — `aXtn ChatGPT Plan` Provider

- Provider ID `axtn_chatgpt_plan`, Display Name `aXtn ChatGPT Plan`;
- normale Integrationskarte mit Connected/Reauthorize/Disconnect/Model status;
- persönliche, nicht teilbare Verbindung;
- compliant local OAuth + protected remote import/pairing for self-hosted VM;
- verschlüsselte Credentials und atomische Refresh-Rotation;
- ID-token, subject, client, state, nonce and scope validation;
- Responses/Codex-app-server adapter, not Chat Completions impersonation;
- native Agent node inference, trace, budget and model-access integration;
- Connected only after real inference;
- explicit capability denial for unmapped agent-embedded tools.

Die Integration darf weder als MCP noch als Development-Swarm-Sondercontroller implementiert werden.

### WP4 — Product integration and runtime acceptance

- Development Swarm uses Case-derived personal/system route without graph rewrite outside necessary provider selection/configuration;
- Document Intake system path remains company-funded and regression-tested;
- UI demonstrates assignment, group claim, provider selection and blocked continuation;
- source tests, migrations, typecheck, lint and production build;
- immutable image, direct Greenfield PROD deployment, restart persistence and live acceptance;
- existing pending Development-Swarm independent Approval remains untouched and must not be self-approved;
- update Host pin/evidence only after exact deployed source and rollback are verified.

## Test requirements

Implement contract tests before or alongside code. At minimum cover all 17 acceptance scenarios in the architecture document plus:

- concurrent group claims and assignment update race;
- RLS/server-function denial for unrelated user;
- non-shareability through `iam_resource_grants`;
- token redaction in logs/traces/errors;
- PKCE state/nonce replay, expired pairing code and credential import replay;
- refresh-token rotation race;
- Case-bound run with forged Case ID;
- budget/model rule evaluated for correct execution principal;
- provider capacity error classification;
- legacy API-key run with no Case binding;
- existing OpenAI/Gemini/OpenRouter provider regression;
- existing DMS Stage 1 route regression;
- app restart between suspension and resume;
- no duplicate billing/inference on idempotent replay.

## PROD authority and safety

Authorized for this Greenfield system:

- implementation on the stated task branch;
- additive schema migration;
- immutable AgentSwarms image build;
- direct deployment to the existing PROD instance;
- live tests using retained synthetic/acceptance Cases;
- bounded repair and repeat until acceptance passes;
- required service restart with pre/post data and mount fingerprints;
- Host pin/evidence update on a matching task branch.

Not authorized:

- merge, tag or release;
- protected-branch writes;
- destructive migration or deletion of existing Cases, credentials, runs or evidence;
- changing unrelated provider credentials;
- enabling unscoped Codex shell/MCP/filesystem access;
- modifying Copilot's own local MCP configuration;
- substituting GitHub for Gitea.

## Stop behavior

Only the six Stop-Gates in the architecture contract justify pausing. A normal implementation defect, failed test, migration error, provider adapter bug or deployment fault is not a Stop-Gate: diagnose, repair and repeat inside scope.

At a genuine Stop-Gate, report:

```text
STOP_GATE
affected_architecture_decision
exact_source_or_runtime_evidence
why_native_contract_cannot_satisfy_it
smallest_possible_amendment
data_security_and_rollback_impact
```

Do not create a replacement architecture while waiting.

## Completion evidence

Commit and push a secret-free report under `handoffs/reports/` containing:

- Parent and Child Case IDs/status;
- exact source commits and deployed image digest;
- additive migration IDs and data-preservation proof;
- changed-file list grouped by WP;
- test counts and commands;
- live acceptance results for every numbered scenario;
- Case/run/trace/evidence references;
- pre/post restart fingerprints;
- rollback command and boundary;
- explicit statement that no token appeared in Git, logs, traces or Cases;
- remaining genuine gaps only.

Do not claim the assignment complete while any mandatory acceptance scenario is unverified.
