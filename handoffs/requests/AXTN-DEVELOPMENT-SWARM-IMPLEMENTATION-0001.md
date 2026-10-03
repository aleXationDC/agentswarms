# AXTN-DEVELOPMENT-SWARM-IMPLEMENTATION-0001

**Status:** `READY_FOR_EXECUTION`  
**Executor:** Copilot CLI on the aXtn server  
**Canonical repository:** `aXtn/aXtn-agentswarms`  
**Canonical branch:** `work/AXTN-DEVELOPMENT-SWARM-0001`  
**Tracking issue:** `aXtn/aXtn-agentswarms#7`  
**Execution plane:** existing production aXtn environment  
**Integration boundary:** Gitea branches, commits and pull requests  
**Orchestration plane:** AgentSwarms  
**Work carrier:** SupaCase  
**Evidence plane:** deterministic results, evaluations, traces and referenced artifacts

## Auftrag

Implementiere, deploye, teste und repariere den case-zentrierten aXtn Development Swarm V1 im bestehenden Produktivsystem:

`Task → Build → Break → Verify → Integrate → Learn`

Führe die Arbeit ohne weitere Planungs- oder Zwischenfreigabeschleifen bis zur nachgewiesenen End-to-End-Acceptance durch. Die Befunde aus Phase A sind Arbeitsumfang, keine Stop-Gates. Stoppe nur bei einer echten Stop Condition aus dem kanonischen `HANDOFF.md`.

## Verbindliche Quellen

Vor jeder Änderung vollständig lesen:

1. `docs/architecture/axtn-development-swarm/HANDOFF.md`
2. `docs/architecture/axtn-development-swarm/V1-IMPLEMENTATION-CONTRACT.md`
3. `docs/architecture/axtn-development-swarm/SUPACASE-CASE-MODEL.md`
4. `handoffs/reports/AXTN-DEVELOPMENT-SWARM-PREFLIGHT-0001.md`
5. Repository-Anweisungen und aktuelle Source-/Runtime-/Host-Verträge in allen betroffenen Gitea-Repositories

Repository- und Runtime-Wahrheit haben Vorrang. Keine GitHub-Abhängigkeit einführen.

## Arbeitsweise und Branches

Arbeite ausschließlich in sauberen, dedizierten Worktrees:

- AgentSwarms: `aXtn/aXtn-agentswarms:work/AXTN-DEVELOPMENT-SWARM-0001`
- Host: neuer sauberer Branch `work/AXTN-DEVELOPMENT-SWARM-0001`
- Gitea-MCP: neuer sauberer Branch `work/AXTN-DEVELOPMENT-SWARM-GITEA-MCP-0001`
- Acceptance: Task-/Attempt-Branch vom aktuell aufgelösten Default-Branch-SHA

Den vorhandenen schmutzigen `aXtn-git`-Checkout nicht verändern. Änderungen, Tests, Deployments und Evidence pro Repository nachvollziehbar committen. Images und Konfigurationen unveränderlich pinnen.

## Case-Pflicht für diesen Auftrag

Copilot führt seine eigene Arbeit nach demselben SupaCase-Vertrag wie der spätere Swarm oder ein menschlicher Bearbeiter.

1. Implementiere und deploye als erstes die sichere, serverseitig owner-gebundene headless Case-Funktion.
2. Erzeuge danach idempotent genau einen Parent Case für diesen Auftrag.
3. Materialisiere mindestens folgende Child Work Packages, soweit die tatsächliche Zerlegung keine bessere verantwortungswahrende Struktur ergibt:
   - Gitea-MCP Boundary
   - Developer Runtime
   - SupaCase Work Contract
   - Executable Development Swarm
   - Production Acceptance and Integration
4. Trage die bis zur Bereitstellung des headless Zugangs entstandene Bootstrap-Arbeit mit Git-, Run- und Evidence-Referenzen idempotent nach.
5. Halte Status, Dependencies, Actor, Processing Mode, `executionChannel=COPILOT_CLI`, Candidate-SHA, PR-, Run-, Evidence- und Integrationsreferenzen während der Bearbeitung aktuell.
6. Lege weitere Child Cases nur für eigenständig verantwortbare, abhängige, parallelisierbare oder separat messbare Unteraufträge an—not für Nodes, Commands, Tool Calls oder einzelne CI-Jobs.
7. Schließe einen von Copilot bearbeiteten Work Case, sobald Work-/Result-Contract erfüllt und Evidence referenziert ist. Dies ist Work Completion, keine selbst erteilte Acceptance.
8. Schließe den Parent erst, wenn alle erforderlichen Children geschlossen, Dependencies erfüllt, unabhängige Acceptance positiv und der vereinbarte Integrationsendpunkt verifiziert ist.
9. Lösche keine Cases nach Tests. Copilot-, Swarm- und Human-Cases verwenden dasselbe KPI-Modell. Channel, Actor, Mode und Scenario Class sind Vergleichsdimensionen, keine Ausschlussregeln.

## Work Package 1 – Gitea-MCP Boundary

- Provenienz von aktivem Source, Image und Host-Pin vollständig auflösen.
- Einen kanonischen Commit und ein immutable Image/Digest herstellen.
- Server-seitige Repository-, Tool- und Action-Scopes implementieren.
- Direkte Default-/Protected-Branch-Writes, Merge, Integration, Deletion und Admin für den Swarm verweigern.
- Native interne Host-Netzwerkbindung und AgentSwarms-MCP-Registrierung herstellen.
- Positive und negative Runtime-Tests für erlaubte Operationen, fremde Repositories, verbotene Actions, geschützte Branches, Delete und Merge ausführen.

## Work Package 2 – Developer Runtime

- Reproduzierbares, digest-gepinntes Runtime-Image bereitstellen.
- Explizite Grants sowie Workspace-, CPU-, Memory-, Timeout- und Output-Isolation erzwingen.
- Squid-ACLs deterministisch materialisieren.
- Deny-by-default und positive/negative Egress-Tests durchführen.
- Hermetischen Dependency-/Testpfad aus Lockfile oder gepinntem Image herstellen.
- Die notwendige, eng begrenzte Runtime im vorhandenen Produktivsystem aktivieren.

## Work Package 3 – SupaCase Work Contract

- Headless Case-Zugriff ausschließlich über server-derived `userId`/`scopeUserId`; keine Tokens oder Owner-IDs im Graphen.
- Idempotente Parent-/Child-Identität und Attempt-/Run-Verknüpfung implementieren.
- Directed Dependencies, Cycle Prevention und Lifecycle-Übergänge validieren.
- Typed References für Repository, Issue, PR, Run und Evidence implementieren.
- Durable Events für Actor-/Mode-Wechsel, Takeover, Completion, Acceptance, PR, Checks, Review, Merge, Deployment/Canary und Rollback herstellen.
- Bestehende DMS-/Document-/Resume-Verträge regressionsfrei halten.
- Einheitliches KPI-Modell unabhängig von Copilot CLI, Swarm oder Human Processing sicherstellen.

## Work Package 4 – Executable Development Swarm

Implementiere einen tatsächlich ausführbaren Graphen auf Basis nativer Nodes und vorhandener Patterns:

- Input/Task Contract
- Build
- Break mit unabhängigen Security-, Architecture/Contract- und Maintainability-Perspektiven, ausgehend vom nativen Code Review Pipeline Pattern
- deterministisches Verify für Build, Tests und Contracts
- probabilistisches Evaluate als getrennte Evidence
- Baseline-vs-Candidate-/Regression-Vergleich
- Approval und Suspend/Resume
- Integration mit Case- und PR-Lifecycle
- Learn über Finding → Root Cause → Improvement Candidate → verifizierte Änderung

Der Builder darf seine eigene Arbeit nicht akzeptieren. Findings, Gates, Approval und Integration müssen an denselben immutable Candidate-SHA gebunden sein. Der Ablauf muss bei Ausfall semantischer Bearbeitung auf demselben Case manuell fortsetzbar bleiben.

## Work Package 5 – Production Acceptance and Integration

Nutze das reale Produktivsystem mit echter IAM-, Netzwerk-, Datenbank-, Runtime-, Tracing-, Approval- und Gitea-Integration.

1. Führe zuerst einen eng begrenzten synthetischen Production-Canary gegen `aXtn/development-swarm-acceptance` aus.
2. Erhalte Parent/Child Cases, Attempt-/Run-Historie, Findings, Dispositions, Candidate-Bindung, Integration Events und Evidence dauerhaft.
3. Teste positive und negative Security-/Isolation-Fälle ohne fremde Daten oder Repositories zu verändern.
4. Repariere Fehler direkt auf den autorisierten Task Branches, deploye einen neu gepinnten Candidate und wiederhole dieselbe Acceptance.
5. Führe nach bestandenem Canary einen risikoarmen realen Development-Auftrag durch denselben Ablauf.
6. Verifiziere Persistenz und Wiederauffindbarkeit nach Service-Restart.
7. Verifiziere gemeinsame KPI-Auswertung und Segmentierung nach Execution Channel, Actor, Mode und Scenario Class.
8. Halte für jede Production-Mutation vorherigen Stand, Rollback und Ergebnis fest.

Keine separate Staging- oder zweite Control Plane schaffen.

## Acceptance Contract

PASS erfordert mindestens:

- vollständige Case-Hierarchie für Copilots Implementierungsarbeit;
- geschlossene Work Cases mit referenzierter Evidence;
- separate unabhängige Acceptance;
- auffindbare synthetische und reale Production-Runs;
- keine Case-Dubletten bei Retry/Resume;
- funktionierendes Manual Takeover im selben Case;
- sichere Gitea-MCP-Scopes einschließlich negativer Tests;
- isolierte, gepinnte Developer Runtime einschließlich Egress-Negativtest;
- deterministische Build-/Test-/Contract-Gates;
- getrennte probabilistische Evaluation;
- drei unabhängige Breaker-Perspektiven oder ein begründeter, source-verifizierter nativer Ersatz;
- Baseline-vs-Candidate-/Regression-Evidence;
- PR-, Approval-, Merge-/Deployment-/Rollback-Tracking im Case;
- Neustart-/Persistenznachweis;
- messbare Hierarchie, Automation Depth, Human Interventions, Rework, Durchlauf- und Integrationszeiten;
- keine Secrets in Git, Cases, Graphen, Prompts, Traces, Logs oder Evidence;
- bestehende relevante Regression-Suites, Typecheck, Lint, Docs-/Infra-Checks und Production Build erfolgreich.

## Lieferobjekte

1. Implementierung, Migrationen, Runtime-/Host-Konfiguration und Tests in den jeweiligen Gitea-Branches.
2. Laufende Parent-/Child-Cases in SupaCase.
3. PRs und deployte immutable Candidate-Revisions.
4. Secret-freie Evidence und reproduzierbare Testbefehle.
5. Abschlussbericht:
   `handoffs/reports/AXTN-DEVELOPMENT-SWARM-IMPLEMENTATION-0001.md`
6. Aktualisierter `docs/architecture/axtn-development-swarm/HANDOFF.md` mit:
   - finalem Status;
   - exakten Repository-/Branch-/Commit-/Image-/Migration-Revisionen;
   - Case-/PR-/Run-/Evidence-Referenzen;
   - PASS/PARTIAL/BLOCKED je Acceptance-Punkt;
   - verbleibenden echten Plattformlücken;
   - Rollback-Stand.

Ein gewöhnlicher Implementierungsfehler ist kein Abschlussgrund. Beheben, erneut deployen und denselben Contract wiederholen. Ein Abschluss mit `PARTIAL` oder `BLOCKED` ist nur bei einer echten Stop Condition zulässig und muss den externen, nicht innerhalb dieses Auftrags lösbaren Blocker exakt belegen.
