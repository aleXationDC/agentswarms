> Historischer V1-Canary-Vertrag. Die ausschließliche Python-/Acceptance-Repo-Beschränkung gilt nicht als aktueller Produktauftrag. Für die Produktbefähigung ist handoffs/requests/AXTN-DEVSWARM-PRODUCT-NATIVE-20261017.md gemäß aktuellem HANDOFF.md maßgeblich. Dieses Dokument bleibt als Herkunft und historische Evidence erhalten.

# aXtn Development Swarm V1 – Implementierungsauftrag

**Stand:** 03.10.2026  
**Status:** Phase A read-only abgeschlossen; Eintrittsbedingungen blockiert  
**Ziel:** Einen minimalen, real ausführbaren Development Swarm in AgentSwarms bereitstellen und ausschließlich mit synthetischen Daten in `aXtn/development-swarm-acceptance` abnehmen.

## 1. Verbindliches Zielbild

Der V1-Prozess lautet:

`Task → Build → Materialize → Break → Verify → Approval → PR Review → Learn`

V1 endet bei einem reviewbaren Pull Request und einem prüfbaren Evidence-Paket. V1 besitzt keine allgemeine Merge-, Release-, Deployment- oder PROD-Capability.

Die Ebenen bleiben getrennt:

| Ebene | Verantwortlichkeit |
|---|---|
| AgentSwarms | Orchestrierung, Rollen, Datenfluss, Gates, Suspend/Resume |
| Developer Runtime | Isolierte deterministische Ausführung von Tests und Contract-Prüfungen |
| Evaluation und Tracing | Evidence, qualitative Regressionen und Auditierbarkeit |
| Gitea und Pull Request | Source of Truth, materialisierte Änderung und Integrationsgrenze |

Es wird keine zweite Control Plane, Approval-Inbox, Jobverwaltung oder Schattenpersistenz eingeführt.

## 2. Autoritative Quellen und Preflight

Vor jedem Write sind die aktuellen Pins erneut aus den Repositories zu ermitteln. Repository- und Runtime-Wahrheit haben Vorrang vor den hier dokumentierten Beobachtungen.

Aktuell belegte Ausgangspunkte:

| Quelle | Beobachteter Stand |
|---|---|
| `aXtn/aXtn-agentswarms` | deployter Branch `work/AXTN-MAINTENANCE-BINDINGS-0001` bei `844eddf5fc60ca6cef8fcc948e293eecc2d6b22e` |
| `aXtn/aXtn-host` | deployter Host-Vertrag bei `5a437f454cf984238d554e26eadf43851c9624f2` |
| `aXtn/aXtn-git` | Live-MCP meldet Source `dfbb45ad…`; Host-Manifest nennt `a85a333…` – Provenienz vor Implementierung verbindlich auflösen |
| `aXtn/development-swarm-acceptance` | Private Fixture, `main` bei `0a38f20ccea94d937a5d4fa2ad18b37ae6439c09` |

Der Preflight muss:

1. den aktuellen AgentSwarms-Pin aus dem maßgeblichen Host-Status auflösen;
2. Remote, Branch, Commit und sauberen Worktree belegen;
3. aktuelle Execution Contracts der betroffenen Nodes erneut gegen Source prüfen;
4. Gitea-MCP-Identity, Mode, Toolliste und Repository-Rechte read-only prüfen;
5. Notebook-Runtime-Enablement, IAM, Image-Digest, Limits und Egress-Policy ermitteln;
6. bestehende Tests und vorgeschriebene Repository-Anweisungen erfassen;
7. bei Abweichungen den Plan aktualisieren, bevor Code verändert wird.

## 3. Feste Architekturentscheidungen

1. **Code Review Pipeline als Break-Grundmuster.** Security und Maintainability werden übernommen und geschärft; Architecture/Contract wird als dritter unabhängiger Breaker ergänzt.
2. **Builder ohne Acceptance-Autorität.** Der Builder darf Candidate und Begründung liefern, aber kein PASS, keine Freigabe und keinen Gate-Override erklären.
3. **Deterministische Prüfung vor probabilistischer Bewertung.** Tests, Build und Contracts liefern das harte Verdict. `evaluate` und Scorecards sind separat und können einen Hard Fail nicht überstimmen.
4. **Identische Revision.** Alle Breaker, Verifier und das Approval beziehen sich auf denselben exakten PR-Head-SHA. Jede Änderung invalidiert die vorherige Acceptance.
5. **Top-level Approval.** Suspend/Resume verwendet den vorhandenen AgentSwarms-Mechanismus. Eine deterministische Function validiert die Entscheidung; kein LLM interpretiert die Freigabe.
6. **Gitea-MCP im Review-Modus.** Erlaubt sind zunächst Read, Branch, File-Upsert, Pull Request und Review. Direct-Main-Write und generischer Merge bleiben verboten.
7. **V1-Python-Harness ohne dynamische Installation.** `compileall`, `unittest`, Schema-/Contract-Checks und negative Fixtures. Weitere Werkzeuge erst, wenn sie im gepinnten Runtime-Image nachgewiesen sind.
8. **Learn erzeugt nur Kandidaten.** `Finding → Root Cause Hypothesis → Improvement Candidate → eigener geprüfter Change`. Keine automatische Änderung an Graph, Prompt, Toolset, Policy oder Runtime.

## 4. Zu implementierender V1-Graph

| Schritt | Node/Mechanismus | Verbindlicher Output |
|---:|---|---|
| 1 | `input` | `development_task` mit Task-ID, Repo, Base-Ref/SHA, Attempt-ID, erlaubten Pfaden/Effekten, Testprofil, Budget und Acceptance-Revision |
| 2 | `function: validate-task` | Validierter, normalisierter Task oder terminaler Contract-Fehler vor jedem Side Effect |
| 3 | `tool: Gitea fetch/tree` | Kanonischer Base-Stand und Evidence der gelesenen Revision |
| 4 | `agent: Builder` | Strukturiertes Candidate-Manifest mit vollständigen Dateiinhalten und Begründung; keine Acceptance-Aussage |
| 5 | `function: validate-candidate` | Pfad-, Schema-, Größen-, Effekt- und Hash-Prüfung |
| 6 | `tool: create_branch` | Deterministischer Working Branch für Task und Attempt |
| 7 | sequenzielle `tool: upsert_file` | Datei-Commits mit stabilen Effect Keys; keine parallelen Writes |
| 8 | `tool: fetch/readback` | Vollständige Rücklesung und Hash-Abgleich aller Candidate-Dateien |
| 9 | `tool: pull_request(create)` | Realer PR mit stabilem Task-/Attempt-Marker |
| 10 | `function: bind-pr-head` | Exakter PR-Head-SHA als unveränderliche Review-Revision |
| 11 | drei parallele `agent`-Nodes | Security-, Architecture/Contract- und Maintainability-Findings gegen denselben PR-Head |
| 12 | `merge: object` | Vollständiges Review-Paket ohne Verdichtung der Original-Findings |
| 13 | `function: validate-findings` | Vollständigkeits-, Schema-, Revisions- und Severity-Prüfung |
| 14 | `function: assemble-verify-request` | Gepinnter Runtime-Request für Baseline und Candidate |
| 15 | `http` oder nachgewiesener nativer Runtime-Zugriff | Deterministische Baseline-/Candidate-Ergebnisse und Artefakte |
| 16 | optional `evaluate` / Batch Evaluation | Separates probabilistisches Ergebnis mit fixierter Rubrik und Dataset-Revision |
| 17 | `function: validate-evidence-and-verdict` | Hard Verdict, Advisory Verdict und vollständiger Evidence-Index |
| 18 | top-level `approval` | Entscheidung über PR-Head-SHA und Evidence-Index; Suspend/Resume |
| 19 | optional `tool: pull_request(review)` | `APPROVED`, `REQUEST_CHANGES` oder Kommentar; niemals Merge |
| 20 | `agent: Learn` + `function: validate-learning` | Ausschließlich strukturierter Learning Candidate |
| 21 | `output` | `PR_READY`, `CHANGES_REQUESTED`, `BLOCKED`, `FAILED` oder `CANCELLED` plus Evidence-Referenzen |

## 5. Verbindliche Datenverträge

### Development Task

Pflichtfelder:

`taskId`, `attemptId`, `repositoryOwner`, `repositoryName`, `baseRef`, `baseSHA`, `allowedPaths`, `allowedEffects`, `acceptanceRevision`, `testProfile`, `budget`, `requestedOutcome`.

Unbekannte Pflichtsemantik, leere Allowlists oder ein nicht mehr aktueller Base-SHA blockieren vor jedem Write.

### Candidate Manifest

Pflichtfelder:

`taskId`, `attemptId`, `baseSHA`, `files[]`, `expectedContentHashes`, `changeRationale`, `declaredRisks`, `requestedTests`.

Das Manifest enthält kein Feld, mit dem der Builder seine Arbeit akzeptieren oder Gate-Ergebnisse überschreiben kann.

### Finding

Pflichtfelder:

`findingId`, `reviewerRole`, `candidateSHA`, `severity`, `category`, `claim`, `evidence`, `location`, `recommendedAction`, `confidence`.

Fehlende Reviewer, falsche SHA, ungültige Severity oder malformed Evidence führen zu `BLOCKED`.

### Evidence Envelope

Pflichtfelder:

`taskId`, `attemptId`, `runId`, `repository`, `baseSHA`, `candidateSHA`, `graphHash`, `runtimeImageDigest`, `harnessHash`, `testSuiteHash`, `command`, `exitCode`, `startedAt`, `finishedAt`, `artifactRefs`, `artifactHashes`, `findingIds`, `gateVerdict`, `principal`, `acceptanceRevision`.

Große Logs bleiben als unveränderliche Artefakte außerhalb des Node-Payloads. Der Gate-Node liest ihren Hash-gesicherten Index.

## 6. Retry-, Timeout- und Idempotenzregeln

- Jeder Side Effect erhält einen stabilen `effectKey` aus Task, Attempt, Operation und Ziel.
- Vor Retry wird der aktuelle Gitea-Zustand gelesen und mit dem erwarteten Ergebnis verglichen.
- Ein identischer vorhandener Effekt gilt als erfolgreiche Wiederaufnahme.
- Ein abweichender vorhandener Effekt führt zu `CONFLICT`; es gibt kein Last-writer-wins.
- Datei-Upserts laufen sequenziell und werden anschließend vollständig zurückgelesen.
- Ein Runtime-POST wird bei unbekanntem Ergebnis nicht blind wiederholt.
- `202` ist `PENDING`, nicht `PASS`; eine Run-ID muss dauerhaft referenzierbar sein.
- Timeout, Transportfehler, malformed Payload, fehlende Evidence und abgebrochene Pflichtprüfungen können kein PASS erzeugen.
- Approval-Resume muss gegen Doppelentscheidung und doppeltes Resume geschützt sein.

## 7. Security- und Berechtigungsmodell

| Principal | Erlaubt | Verboten |
|---|---|---|
| Swarm Orchestrator | Graph ausführen, Evidence referenzieren, Approval parken | Beliebige Toolwahl, Policy-Änderung, PROD |
| Builder | Candidate erzeugen | Acceptance, Review-Freigabe, Merge, Secrets |
| Gitea Review Principal | Lesen, Working Branch, erlaubte Dateien, PR, Review | Direct main/master, generischer Merge, Admin, Repo-Erzeugung |
| Breaker | Candidate und Evidence lesen, Findings erzeugen | Source verändern, eigenes Finding adjudizieren |
| Verifier | Gepinnten Harness ausführen, eigene Evidence schreiben | Candidate-Evidence fälschen, ungepinnte Tools installieren, PROD-Netz |
| Approver | Exakten Evidence-Stand annehmen oder ablehnen | Revision stillschweigend wechseln |
| Learner | Learning Candidate erzeugen | Graph/Prompt/Policy/Runtime automatisch ändern |

Secrets dürfen nicht in Prompts, Trace-Payloads, Logs, Git oder Learning Candidates erscheinen. Der V1-Drill verwendet ausschließlich synthetische Daten.

## 8. Implementierungsreihenfolge

### Phase A – Source- und Runtime-Preflight

- aktuelle Pins und Repository-Regeln belegen;
- Node-Verträge der tatsächlich verwendeten Pfade erneut prüfen;
- AgentSwarms-interne Gitea-MCP-Erreichbarkeit und Tool-Allowlist read-only nachweisen;
- Notebook-Runtime und Image-Vertrag read-only prüfen.

**Gate A:** Kein Write, solange Principal, Mode, Allowlist, Runtime-Image oder Zielbranch unklar sind.

### Phase B – Deterministische Contracts und Fixtures

- Schemas und Validator-Functions implementieren;
- synthetische positive und negative Task-/Candidate-/Finding-/Evidence-Fixtures erstellen;
- Failure-Zustände und Terminalstatus festlegen.

**Gate B:** Contract-Fixtures müssen ohne LLM und ohne externen Side Effect reproduzierbar bestehen.

### Phase C – Break und Verify

- Code Review Pipeline adaptieren;
- drei Breaker gegen denselben Candidate binden;
- deterministischen Python-Harness implementieren und versionieren;
- Baseline-vs-Candidate-Resultat und Hard-Verdict implementieren;
- probabilistische Evaluation klar abtrennen.

**Gate C:** Ein absichtlich defekter Candidate muss unabhängig von einem guten LLM-Score scheitern.

### Phase D – Gitea- und Approval-Pfad

- repo-/tool-scoped MCP-Binding konfigurieren;
- Branch-, Upsert-, Readback-, PR- und Review-Schritte mit Effect Keys verbinden;
- top-level Approval und Resume-Vertrag implementieren;
- Merge- und PROD-Capabilities technisch nicht in den V1-Graph aufnehmen.

**Gate D:** Statische Inspektion und negative Tests müssen Main-Write, Merge, fremdes Repository und nicht erlaubte Tools abweisen.

### Phase E – Isolierter Acceptance-Drill

Ziel ist ausschließlich `aXtn/development-swarm-acceptance`.

Der erste positive Drill verwendet eine kleine synthetische Python-Aufgabe und erzeugt:

1. genau einen Working Branch;
2. einen vollständig rückgelesenen Candidate;
3. genau einen Pull Request;
4. drei gültige Breaker-Ergebnisse gegen denselben Head;
5. Baseline-/Candidate-Evidence aus dem gepinnten Harness;
6. einen geparkten und korrekt wiederaufgenommenen Approval-Lauf;
7. maximal ein PR-Review;
8. einen Learning Candidate ohne Selbstmodifikation.

Danach werden mindestens folgende Störungen injiziert: verlorene Write-Antwort, erneutes Resume, Branch-Drift, partieller Datei-Write, malformed Finding, Runtime-Timeout, HTTP 200 mit Fehlerpayload, Baseline-PASS/Candidate-FAIL und geänderter PR-Head nach Acceptance.

**Gate E:** Jeder Störfall endet im spezifizierten Status und erzeugt keine unzulässige oder doppelte Wirkung.

### Phase F – Reviewbare Integration

- Änderungen in fachlich getrennten, kleinen Commits ablegen;
- Tests und Evidence versionieren, ohne Secrets oder vertrauliche Runtime-Daten;
- PR mit exakten Pins, ausgeführten Prüfungen, Restlücken und Rollback-Hinweis erstellen;
- keine Selbstfreigabe und kein Merge durch den Builder.

## 9. Abbruch- und Eskalationskriterien

Die Umsetzung stoppt vor weiterer Mutation, wenn:

- der aktuelle Host-Pin nicht eindeutig ist;
- der Sourcecode vom angenommenen Node-Vertrag materiell abweicht;
- AgentSwarms die MCP-Tool-Allowlist nicht wirksam begrenzen kann;
- der Gitea-Principal unerwartet Admin- oder Merge-Rechte besitzt;
- die Developer Runtime keinen reproduzierbaren gepinnten Harness erlaubt;
- Suspend/Resume die exakte Revision oder Entscheidung nicht dauerhaft bindet;
- Evidence nicht manipulationssicher an Candidate, Graph, Harness und Runtime gebunden werden kann;
- eine Lösung eine zweite Control Plane oder ungeplante PROD-Capability erfordern würde.

Ein Stop dokumentiert die konkrete Plattformlücke, ihren Sicherheits- und Betriebsimpact sowie die kleinste tragfähige Erweiterungsoption. Es wird kein stiller Workaround eingeführt.

## 10. Definition of Done für V1

V1 ist erst fertig, wenn:

- der veröffentlichte Graph headless ausführbar und versionsgebunden ist;
- Builder, Breaker, Verifier und Approver getrennte Autoritäten besitzen;
- alle drei Breaker denselben PR-Head nachweislich prüfen;
- deterministische Baseline-/Candidate-Prüfungen das harte Verdict liefern;
- Approval einen Neustart übersteht und keine Doppelwirkung erzeugt;
- der vollständige positive Drill im Acceptance-Repository bestanden ist;
- die definierten Störfälle bestanden sind;
- kein Pfad zu Direct-Main-Write, Merge, Release, Deployment oder PROD existiert;
- der PR, die Evidence und verbleibende Plattformlücken reviewbar dokumentiert sind.

## 11. Ausdrücklich außerhalb von V1

- allgemeiner autonomer Merge;
- Release und Deployment;
- PROD-Zugriff;
- frei wählbare Repositories oder Tools;
- TypeScript-/npm-Toolchains ohne gepinntes Runtime-Profil;
- lang laufende Jobs ohne nachgewiesenes durable JobRef-/Resume-Modell;
- rekursive oder wiederverwendbare Sub-Swarms ohne belegte Child-Trace- und Suspend-Semantik;
- automatische Übernahme von Learning Candidates;
- unkontrollierte Selbstmodifikation.

## 12. Erwartete Liefergegenstände

1. implementierter und veröffentlichter V1-Graph;
2. versionierte Validator-Components und Schemas;
3. gepinnter Python-Verifier-Harness;
4. synthetische positive und negative Fixtures;
5. repo-/tool-scoped Gitea-MCP-Konfiguration;
6. automatisierte Contract-, Failure- und Approval-Durability-Tests;
7. Evidence des positiven Acceptance-Drills;
8. PRs in den tatsächlich betroffenen Repositories;
9. aktualisierte Capability-/Gap-Matrix mit `nachgewiesen`, `teilweise`, `blockiert`;
10. kurze Betriebsanleitung für Taskstart, Approval, Fehleranalyse und Wiederaufnahme.

## 13. Aktueller Gate-Status

Phase A wurde am 03.10.2026 read-only ausgeführt. AgentSwarms kann den Gitea-MCP intern derzeit nicht auflösen beziehungsweise erreichen; die MCP-Source-/Image-Provenienz ist zwischen Live-Image und Host-Manifest inkonsistent; die Notebook Runtime ist deaktiviert und ihre Squid-Konfiguration verweist auf fehlende generierte ACL-Dateien. Vor Phase B sind die vollständige Preflight-Evidence zu versionieren und diese Eintrittsblocker gemäß Gitea-Issue #7 aufzulösen. Kein Teil dieses Dokuments autorisiert Merge, Release, Deployment oder PROD-Veränderungen.
