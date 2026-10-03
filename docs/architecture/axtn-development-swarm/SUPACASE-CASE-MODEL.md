# Addendum: Case-zentrierter aXtn Development Swarm V1

**Stand:** 03.10.2026  
**Status:** Verbindliche Ergänzung nach Abschluss des laufenden Phase-A-Preflights  
**Leitentscheidung:** Der fachliche Case-Verbund trägt den Ablauf. Swarm, deterministische Ausführung und menschliche Bearbeitung sind austauschbare Bearbeitungsformen innerhalb desselben Ablaufs.

## 1. Verifizierte Ausgangslage

SupaCase ist im deployten AgentSwarms-Stand als native Workbench-Capability vorhanden und laut Host-Pin als erhaltene Basis-Capability runtime-verifiziert:

- AgentSwarms-Branch `work/AXTN-MAINTENANCE-BINDINGS-0001`
- deployter Commit `844eddf5fc60ca6cef8fcc948e293eecc2d6b22e`
- Host-Pin-Status `DEPLOYED_RUNTIME_VERIFIED`
- Datasets `axtn_cases`, `axtn_accounts`, `axtn_contacts`, `axtn_case_relations`
- Parent/Child-Hierarchie, Owner-Scope, Audit-Grundlage, Status, Priorität, Due/Follow-up und explizite Relationen

Im bisherigen Development-Swarm-Auftrag ist SupaCase noch nicht funktional angebunden. Der Zielgraph beschreibt technische Orchestrierung, aber noch keinen dauerhaft manuell fortführbaren fachlichen Case-Verbund.

## 2. Fachliches Case-Modell

### Parent Case

Der Parent Case ist der fachliche Träger des gesamten Development-Auftrags:

- fachlicher Intent und erwartetes Ergebnis;
- Scope und Verantwortlichkeit;
- Priorität und Fälligkeit;
- Gesamtstatus und Statusgrund;
- Referenzen auf Issue/Task, Repository, PR und maßgebliche Evidence;
- Beziehung zu seinen fachlichen Arbeitspaketen;
- Abschluss oder bewusste Aufgabe des Gesamtvorgangs.

Empfohlener Typ: `DEVELOPMENT_CHANGE`.

### Child Cases

Ein Child Case entsteht nur für ein echtes, separat verantwortbares Arbeitspaket mit eigenem Input-, Output- und Acceptance-Contract. Nicht jeder Node und nicht jeder technische Schritt wird zum Case.

Für V1 kommen insbesondere infrage:

| Child-Case-Typ | Fachlicher Auftrag | Parallelisierbarkeit |
|---|---|---|
| `DEVELOPMENT_BUILD` | Candidate gegen definierten Scope erzeugen | vor Break/Verify |
| `DEVELOPMENT_REVIEW_SECURITY` | Security-Dimension beurteilen | parallel zu den anderen Review-Dimensionen |
| `DEVELOPMENT_REVIEW_CONTRACT` | Architecture-/Contract-Dimension beurteilen | parallel |
| `DEVELOPMENT_REVIEW_MAINTAINABILITY` | Maintainability-Dimension beurteilen | parallel |
| `DEVELOPMENT_VERIFY` | deterministische Baseline-/Candidate-Evidence herstellen | parallel zu Reviews, sofern Inputs vollständig und Revision identisch sind |
| `DEVELOPMENT_IMPROVEMENT_CANDIDATE` | abgeleitete Verbesserung als eigenen fachlichen Folgeauftrag festhalten | nach Learn; keine automatische Ausführung |

Weitere Child Cases werden nur angelegt, wenn die Zerlegung fachlich eigenständige Verantwortung, Abhängigkeit, Parallelisierung oder Messbarkeit erzeugt. Interne Agenten-, Tool-, Retry- und Transformationsschritte bleiben im Swarm Run und Trace.

### Hierarchie und Ursprung

`parent_case_id` bildet die unmittelbare Zerlegung. Der höchste Auslöser wird durch Auflösung der Parent-Kette bestimmt. Eine zusätzliche gespeicherte Root-ID ist nur dann gerechtfertigt, wenn die Laufzeit- und Reporting-Prüfung zeigt, dass die Ableitung nicht ausreichend ist.

Improvement Candidates sind Child Cases des Vorgangs, aus dem sie entstanden sind. Sie bleiben zunächst `NEW` beziehungsweise vorgeschlagen. Ein menschlicher oder explizit deterministischer Promotion-Entscheid autorisiert erst ihre spätere Bearbeitung; die Erstellung selbst startet keine Änderung.

## 3. Ein Ablauf, mehrere Bearbeitungsformen

Jeder Case besitzt einen fachlichen Work Contract. Dieser bleibt unabhängig davon gleich, wer oder was ihn bearbeitet:

- `SEMANTIC`: Agent oder Modell erzeugt bzw. beurteilt fachlichen Inhalt;
- `DETERMINISTIC`: Tool, Validator, Build oder Test erzeugt reproduzierbare Ergebnisse;
- `HUMAN`: Mensch bearbeitet oder entscheidet denselben fachlichen Auftrag manuell.

Ein Wechsel des Bearbeitungsmodus erzeugt weder einen neuen Prozess noch einen neuen Case. Er ändert nur die verantwortliche Bearbeitungsform am bestehenden Case.

Beispiel: Fällt der Security-Agent aus, bleibt der Child Case `DEVELOPMENT_REVIEW_SECURITY` bestehen. Ein Mensch öffnet denselben Case, sieht Candidate-Revision, Review-Contract und vorhandene Evidence, bearbeitet ihn manuell und liefert dasselbe Output-Schema. Parent, Abhängigkeiten und Acceptance bleiben unverändert.

## 4. Manuell durchklickbarer Fallback

Der Case-Verbund muss ohne verfügbare KI vollständig bedienbar bleiben. Die SupaCase-Oberfläche beziehungsweise verlinkte native Oberflächen müssen ermöglichen:

1. Parent Case öffnen und Scope, Status, Child Cases und Abhängigkeiten sehen;
2. Child Case manuell übernehmen oder zuweisen;
3. unveränderten Work Contract und die autoritativen Input-Referenzen sehen;
4. Bearbeitungsmodus auf `HUMAN` wechseln;
5. Ergebnis im gleichen Output-Contract erfassen oder Evidence referenzieren;
6. Child Case abschließen, blockieren oder zur Nacharbeit zurückgeben;
7. Parent-Gate nur dann fortsetzen, wenn alle erforderlichen Child Contracts erfüllt sind;
8. Human Approval weiterhin über den bestehenden revisionsgebundenen Approval-Pfad durchführen.

Der manuelle Pfad darf keine schwächere fachliche oder technische Abnahme verwenden. Insbesondere:

- ein Mensch kann einen semantischen Agentenschritt ersetzen;
- ein Mensch kann einen deterministischen Test starten, überwachen oder dessen reproduzierbare Evidence beibringen;
- ein Mensch kann einen vorgeschriebenen Hard Fail nicht durch einen Freitext-PASS überschreiben;
- Builder und Bearbeiter dürfen unabhängig vom Modus nicht ihre eigene Arbeit zur Acceptance erklären;
- fehlende Tools oder Evidence führen zu `BLOCKED`, nicht zu manueller Scheinfreigabe.

## 5. Trennung von Case, Run und Evidence

| Ebene | Enthält | Enthält nicht |
|---|---|---|
| Parent Case | Gesamtauftrag, Hierarchie, fachlicher Status, knappe Outcome-Codes, Referenzen | Einzelschritte, vollständige Findings, Logs, Diffs |
| Child Case | Work Contract, Abhängigkeiten, Bearbeitungsmodus/Actor, Status, Ergebnisreferenz | interne Nodes, Prompts, Tool-Aufrufe, Retry-Details |
| Swarm Run | technische Ausführung, Checkpoints, Retry/Timeout, Suspend/Resume | fachliche Langzeitakte |
| Evidence Plane | Findings, Testresultate, Hashes, Artefakte, Traces | fachliche Workflow-Autorität |
| Gitea/PR | Source, Diff, Revision, Integrationsstatus | Case-Steuerung |

Cases speichern stabile Referenzen und knappe Ergebnis-Codes, keine Kopien der autoritativen Inhalte.

## 6. Abhängigkeiten und Parallelisierung

Die fachliche Zerlegung erzeugt einen kleinen Work-Package-DAG:

1. Parent `DEVELOPMENT_CHANGE` wird validiert.
2. Child `DEVELOPMENT_BUILD` erzeugt und materialisiert den Candidate.
3. Nach Bindung des exakten PR-Head werden Security, Contract und Maintainability parallel ausführbar.
4. `DEVELOPMENT_VERIFY` darf parallel laufen, sobald derselbe Candidate und der eingefrorene Harness gebunden sind.
5. Das Parent-Gate aggregiert nur Status und Evidence-Referenzen der erforderlichen Child Cases.
6. Human Approval entscheidet über exakt diese gemeinsame Candidate-Revision.
7. Learn darf anschließend Improvement-Candidate-Child-Cases anlegen, aber nicht starten oder selbst freigeben.

Die technische Parallelisierung kann weiterhin der native topologische Swarm Executor übernehmen. Die Case-Abhängigkeiten sind der fachliche, manuell bedienbare Vertrag; sie werden nicht zu einem zweiten Scheduler. Fällt die automatische Orchestrierung aus, kann der Mensch dieselben freigegebenen Child Cases anhand ihrer Abhängigkeiten bearbeiten.

## 7. Bearbeitungsübergänge

Nicht jeder Node-Wechsel wird persistiert. Pro Case werden nur verantwortungs- und messrelevante Ereignisse erfasst:

- Case/Child angelegt;
- Abhängigkeiten erfüllt und Case bearbeitbar;
- Bearbeitungsmodus oder Actor gewechselt;
- Bearbeitung gestartet;
- Ergebnis bereitgestellt;
- Case blockiert, zurückgegeben, wieder geöffnet oder abgeschlossen;
- Human Approval angefordert und entschieden;
- Pull Request angelegt oder auf eine neue Candidate-Revision aktualisiert;
- Integrationsprüfung gestartet, bestanden oder fehlgeschlagen;
- Review/Approval erteilt, abgelehnt oder zurückgezogen;
- Merge vorbereitet, ausgeführt, abgebrochen oder zurückgerollt;
- Deployment/Canary gestartet, verifiziert, fehlgeschlagen oder zurückgerollt;
- Improvement Candidate erzeugt oder zur Bearbeitung promoviert.

Ein Übergangsereignis benötigt mindestens:

`caseId`, `eventType`, `fromMode`, `toMode`, `actorType`, `reasonCode`, `candidateSHA`, `repositoryRef`, `pullRequestRef`, `integrationPhase`, `evidenceRef`, `timestamp`, `transitionKey`.

Es enthält keine vollständigen fachlichen Inhalte. Der Case führt damit den Integrationsprozess fachlich mit, während Gitea/PR, Runtime und Evidence die autoritativen technischen Details behalten. Einzelne CI-Jobs, Tool-Aufrufe und Logzeilen werden nicht als Case-Schritte kopiert. Ein Integrationsfehler erzeugt nur dann einen neuen Child Case, wenn daraus ein eigenständig verantwortbares Arbeitspaket entsteht. `transitionKey` macht Wiederholung idempotent; abweichender Inhalt unter demselben Schlüssel ist ein Konflikt.

Vorrang hat der bestehende native Audit-Mechanismus. Nur wenn der Preflight belegt, dass dessen Struktur, Abfrage oder Retention für die erforderlichen Messungen nicht ausreicht, ist eine kleine append-only Case-Event-Projektion gerechtfertigt. Sie wäre Evidence/Reporting, keine zweite Workflow-Autorität.

## 8. Messmodell

Die Case-Hierarchie und die schlanken Übergangsereignisse sollen folgende Kennzahlen ableitbar machen, ohne operative Inhalte zu duplizieren:

| Kennzahl | Ableitung |
|---|---|
| höchster Auslöser | Root der Parent-Kette |
| erreichte Zerlegungstiefe | maximale Case-Tiefe |
| Umfang der fachlichen Zerlegung | Anzahl Child Cases pro Ebene und Typ |
| Parallelisierungsgrad | zeitlich überlappende aktive, voneinander unabhängige Child Cases |
| automatische Reichweite | längste Folge abgeschlossener Cases ohne Human-Mode oder Human-Intervention |
| menschliche Eingriffe | Anzahl Mode-/Actor-Wechsel zu `HUMAN` sowie Human-Decision-Events |
| Automatisierungsquote | abgeschlossene Child Cases nach primärem Bearbeitungsmodus |
| Übergabequote | Wechsel `SEMANTIC↔DETERMINISTIC↔HUMAN` pro Case-Typ |
| Rework | Rückgaben, Reopens und neue Attempts pro Case |
| Durchlaufzeit | Parent- und Child-Zeit vom bearbeitbar bis abgeschlossen |
| Blockierungszeit | Dauer in blockiertem Zustand nach Grundcode |
| Improvement Yield | Improvement Candidates pro Root Case sowie später promoviert/geschlossen |
| Integrationsdurchlaufzeit | Zeit von PR-Erstellung bis verifizierter Integration je Candidate-SHA |
| Integrationsrework | fehlgeschlagene Checks, neue Candidate-Revisions und erneute Reviews pro Case |
| Rollout-Stabilität | erfolgreiche Canaries/Deployments, Rollbacks und Wiederherstellungszeit pro Root Case |

Kennzahlen werden aus Hierarchie und Events berechnet. Redundante, fortlaufend zu synchronisierende Zähler im Case sind zu vermeiden.

## 9. Lifecycle-Regeln

- Parent und Children verwenden den bestehenden SupaCase-Status `NEW`, `OPEN`, `WAITING_CONTACT`, `CLOSED`.
- Fachliche Feinzustände werden als kontrollierte `status_reason`-/Outcome-Codes geführt, nicht als zweites Lifecycle-System.
- `WAITING_CONTACT` wird nur genutzt, wenn Primary Contact und Follow-up vorhanden sind; nicht als generisches Approval-Warten.
- Der Parent verfolgt den vereinbarten Integrationsendpunkt (`PR_READY`, `MERGED`, `DEPLOYED_VERIFIED` oder `ABANDONED`) über typisierte Referenzen und idempotente Übergangsereignisse.
- Ein erfolgreicher Merge allein schließt den Parent nicht. Abschluss erfordert unabhängige Acceptance und den für den Auftrag vereinbarten, verifizierten Integrationsendpunkt.
- Fehlgeschlagene Integration oder Rollback öffnet denselben Case wieder; nur eigenständig zu bearbeitende Reparaturarbeit wird als Child Case angelegt.
- Neue relevante Aktivität darf nach bestehendem Contract wieder öffnen.
- Automation darf Priorität 0 weder setzen noch überschreiben.
- Ein Improvement Candidate bleibt nach Anlage unverarbeitet, bis seine Promotion autorisiert ist.

## 10. Ergänzung des V1-Contracts

### Parent Case

Pflichtreferenzen:

`caseId`, stabile Task-/Issue-Identität, Repository, Base-Revision, aktueller Candidate-SHA, PR-Referenz, Acceptance-Revision, erforderliche Child-Case-IDs, aggregierter Outcome-Code, Evidence-Index.

### Child Case

Pflichtfelder:

`caseId`, `parentCaseId`, `caseType`, `workContractRef`, `inputRevision`, `requiredDependencies`, `processingMode`, `actorRef`, `status`, `statusReason`, `resultRef`, `evidenceRef`.

Der Child Case enthält den fachlichen Auftrag oder eine stabile Referenz darauf, aber keine Kopie der vollständigen technischen Ausführung.

## 11. Native Wiederverwendung und Lücken

| Bedarf | Einstufung | Begründung |
|---|---|---|
| Parent/Child-Hierarchie | nativ vorhanden | `parent_case_id` unterstützt beliebige Tiefe |
| Status, Priorität, Due/Follow-up, Owner-Scope | nativ vorhanden | bestehender SupaCase-Contract |
| manuelles Öffnen und Bearbeiten von Cases | nativ teilweise | CRUD und Detailoberfläche vorhanden; Work Contract, Abhängigkeiten und Bearbeitungsmodus sind noch zu ergänzen |
| Development-Case-Typen und Outcome-Codes | konfigurieren | kontrollierte Validatoren auf bestehenden Stringfeldern |
| idempotentes Ensure nach fachlicher Source-Identität | kleine Erweiterung | vorhandenes DMS-Ensure ist dokumentenspezifisch; manuelles Create nicht source-idempotent |
| Child-Abhängigkeiten | kleine Erweiterung oder Relation-Konfiguration | aktuelle Relation Targets bilden Case↔Case, aber noch keinen geprüften Dependency-Typ/Contract ab |
| Bearbeitungsmodus und Actor-Wechsel | kleine Erweiterung | im aktuellen Case-Contract nicht explizit vorhanden |
| manuell/automatisch identischer Work-/Result-Contract | Komposition plus UI-Anpassung | muss dieselben Validatoren und Gate-Regeln verwenden |
| PR-/Run-/Evidence-Referenzen | konfigurieren oder kleine Erweiterung | `related_entity` zu unspezifisch; aktuelle Relation Targets reichen nicht für typisierte Referenzen |
| Messbare Übergänge | bestehendes Audit prüfen, sonst kleine Erweiterung | keine ungeprüfte Annahme über Audit-Abfrage und Retention |
| Parallelisierung | native Swarm-Komposition | Case-Abhängigkeiten sind fachlicher Vertrag, kein zweiter Scheduler |

## 12. Acceptance-Ergänzungen

PASS erfordert:

1. genau einen Parent Case je fachlichem Auftrag trotz Retry/Resume;
2. genau einen Child Case je stabiler Work-Package-Identität;
3. Child Cases entstehen nur für eigenständige Arbeitspakete, nicht für Nodes oder Tool-Schritte;
4. Security, Contract und Maintainability sind nach Build parallel bearbeitbar und an denselben Candidate-SHA gebunden;
5. automatische und manuelle Bearbeitung verwenden identische Input-, Output- und Acceptance-Contracts;
6. Ausfall eines semantischen Bearbeiters erlaubt Human-Übernahme desselben Child Case ohne Prozesswechsel;
7. deterministische Hard Gates können manuell ausgeführt, aber nicht manuell überschrieben werden;
8. Builder/Bearbeiter können unabhängig vom Modus nicht selbst Acceptance erklären;
9. Lost-response, Doppel-Resume und Moduswechsel erzeugen keine doppelten Cases oder Events;
10. Parent-Gate wartet auf alle erforderlichen Child Cases und dieselbe Revision;
11. Cases enthalten keine vollständigen Findings, Logs, Diffs, Prompts oder Traces;
12. Improvement Candidates entstehen als Child Cases, starten aber keine automatische Änderung;
13. Root-Ursprung, Hierarchietiefe, automatische Reichweite und menschliche Eingriffe sind aus Hierarchie und Events messbar;
14. falscher Owner, fremdes Repository und unzulässige Referenzen werden abgewiesen;
15. kein Access Token erscheint in Prompt, Trace, Log, Git oder Evidence;
16. bestehende DMS-/Document-SupaCase-Verträge bleiben regressionsfrei;
17. Restart/Persistenz erhält Hierarchie, Abhängigkeiten, Modi, Status und Referenzen;
18. keine zweite Control Plane oder parallele Workflow-Autorität wird eingeführt;
19. der Parent Case führt PR-, Review-, Merge-, Deployment-, Canary- und Rollback-Übergänge mit typisierten Referenzen und derselben Candidate-Revision mit;
20. CI-Jobs, Tool-Aufrufe, Logs und einzelne technische Checks werden nicht als Cases dupliziert;
21. ein Integrationsfehler erzeugt nur bei eigenständig verantwortbarer Reparaturarbeit einen Child Case;
22. ein Merge ohne unabhängige Acceptance und verifizierten vereinbarten Integrationsendpunkt schließt den Parent nicht.

## 13. Persistente Acceptance- und Regression-Cases

Die im produktiven Acceptance- und Canary-Betrieb entstehenden Cases bleiben als nachvollziehbare Test-, Evidence- und Regressionsträger erhalten.

- Kennzeichne den fachlichen Anlass beziehungsweise das Szenario und binde die Cases an Scenario-ID, Repository, Candidate-SHA, ausführende Version und Evidence-Referenzen. Erfasse den Ausführungskanal (`COPILOT_CLI`, `SWARM`, `HUMAN` oder weiterer kontrollierter Kanal) sowie Bearbeitungsmodus und Actor getrennt.
- Lösche Parent Cases, Child Cases, Übergangsereignisse, Findings-Dispositionen oder Integrationsreferenzen nach erfolgreichem oder fehlgeschlagenem Lauf nicht.
- Schließe abgeschlossene Test-Cases regulär. Sie verwenden dasselbe KPI- und Messmodell wie alle anderen Cases und bleiben in den Gesamtstatistiken enthalten. Eine Klassifikation wie `synthetic_acceptance`, `real_work` oder `regression` dient ausschließlich als auswertbare Dimension, nicht als Ausschlussregel.
- Ein Retry/Resume desselben Versuchs verwendet denselben Case und eine neue idempotente Attempt-/Run-Referenz; er erzeugt keine Dublette.
- Eine neue Candidate-Revision oder bewusst neue Acceptance-Kampagne erhält eine neue eindeutig referenzierte Ausführung in derselben Scenario-Linie, sodass Baseline-vs-Candidate und Regressionen historisch vergleichbar bleiben.
- Git bleibt für Fixture, erwartete Ergebnisse und ausführbaren Testvertrag autoritativ. SupaCase hält fachliche Testlinie, Status, Übergänge und stabile Referenzen; Evidence hält Logs, Traces und Artefakte.
- Aufbewahrung folgt der festgelegten Audit-/Evidence-Retention. Eine spätere Bereinigung darf nur über eine explizite, referenzsichere Retention Policy erfolgen, nicht als automatisches Run-Cleanup.

Acceptance verlangt zusätzlich, dass die Cases nach Restart weiterhin auffindbar sind und ihre Case-Hierarchie, Candidate-Bindung, Runs, Integrationsereignisse und Evidence-Referenzen vollständig rekonstruierbar bleiben. Identische KPI-Definitionen müssen unabhängig davon gelten, ob ein Case durch Copilot CLI, den Swarm oder einen Menschen erzeugt oder bearbeitet wurde; Auswertungen dürfen diese Dimensionen vergleichen, aber die Daten nicht strukturell trennen.

## 14. Ergänzung für den laufenden Copilot-Preflight

Der laufende Phase-A-Preflight soll read-only zusätzlich klären:

1. Ist SupaCase am aktuell aufgelösten Pin und in der Runtime tatsächlich verfügbar?
2. Welche Case-CRUD- und Relation-Funktionen sind aus einem headless Swarm real erreichbar?
3. Wie kann der Run-Owner serverseitig gebunden werden, ohne Token im Graph-Payload?
4. Existiert bereits ein generischer idempotenter Ensure-by-source-Contract?
5. Lassen sich Case↔Case-Relationen als gerichtete Work-Package-Abhängigkeiten validieren, ohne neues Datenmodell?
6. Welche UI- und Server-Funktionen fehlen für Bearbeitungsmodus, Zuweisung, Work Contract und Human-Übernahme?
7. Reicht der native Audit für die genannten Ereignisse und Kennzahlen hinsichtlich Struktur, Query und Retention?
8. Welche minimale typisierte Referenz ist für Repository, Issue, PR, Run und Evidence nötig?
9. Welche vorhandenen SupaCase-Tests können erweitert werden, ohne DMS-/Resume-Verträge zu verändern?

Erst nach diesem Preflight wird final entschieden, was reine Konfiguration, Komposition oder eine kleine Source-Erweiterung ist.
