# AXTN-DEV-PROCESS-MODULAR-20261019 — Umsetzung in nachgewiesenen Bausteinen

Autorität: Alex' modularer Prozessvorschlag vom 19.10.2026 und Präzisierungen zu vollständiger Integration im Intake-Plan. Status ACTIVE, gestufte native Umsetzung. Dieser Auftrag ersetzt den bisherigen allgemeinen Blueprint-Ausbau und dessen Analyse-Pause im benannten Scope. Veröffentlichungen starten keine CLI.

## Ziel und Grenzen

aXtn Development Process aus eigenständig nutzbaren nativen Swarms aufbauen: aXtn Subswarm Dev Request Intake, aXtn Subswarm Dev Builder, getrennte Security-/Contract-/Quality-Reviews, Consolidated Audit und schlanker Leitprozess. Vorhandene passende Agents, Skills, KBs und Integrationen wiederverwenden. Keine neue große Einzweck-Graphkopie; keine Task-Dateinamen im allgemeinen Graph. Produktaufträge bearbeitet der Swarm, Copilot konfiguriert und qualifiziert die native Infrastruktur.

AGENTS.md gilt. Aktuelle Betriebsstände und bestehende SupaCase-Lineage zuerst lesen; genau einen vorhandenen oder idempotent zugeordneten Implementierungs-Parent verwenden. Nicht jeden Start, Toolcall oder Retry als neuen Case anlegen. Vorhandene Operatorarbeit, aktive Versionen und Kandidaten sichern; neue Bausteine zunächst eigenständig als Draft/Version qualifizieren. Bestehenden Swarm nicht blind ersetzen.

## 1. Verbindlicher Prozess

Ein neuer autorisierter Development-Case ist fachlicher Einstieg. Vorhandenen Trigger/Consumer aus dem DMS vergleichen und qualifizieren: Case-Typ/Owner/Rechte, stabile Work-Identität, doppelte Zustellung, Wiederanlauf. Neuer Case allein ist noch kein nachgewiesener automatischer Swarm-Start.

Intake recherchiert selbst im erlaubten Repo, klärt Ziel und erforderliche Informationen und erstellt einen vollständigen Auftragskandidaten in Git. Der Plan umfasst Teilaufträge, ihre Akzeptanzkriterien, technische Schnittstellen, Abhängigkeiten, Git-Bases/Branches, Dev-Testprofile, Reviewpflichten, Integration, Gesamtprüfung und UAT/Release. Integration wird vom Intake mitgeplant und nötigenfalls als eigener Teilauftrag behandelt. Freigegebene Repo-Konfiguration ist legitim, fest verdrahtete Account-/Contact-/Case-Pfade sind kein allgemeiner Prozess.

Unklare fachliche Entscheidungen als gebündelte konkrete Rückfragen im Case mit Git-Referenz vorlegen. Ohne erforderliche Antwort keine Annahme erfinden. Vorhandenen nativen Human-/Approval-/Resume-Weg verwenden, fehlende freie Antwort-/Planänderungsfunktion separat belegen. Ein yes/no-Approval allein ist kein vollständiger Rückfragekanal. Antworten und Planänderungen versionieren; geänderte entscheidungsrelevante Pläne erneut freigeben.

Gate 1: Mensch sieht den vollständigen Implementierungsplan und genehmigt genau dessen Revision. Vorher keine Produktimplementation oder kostenpflichtige vollständige Builder-Fan-outs. Geplante Arbeit darf vorab dokumentiert sein, ihre Ausführung bleibt gesperrt.

Nach Freigabe je eigenständig verantwortbarem Teilauftrag einen Child-Case mit Git-Auftrag anlegen. Unter diesem Paket können Builder-, Review- und Audit-Work-Cases liegen, soweit separat verantwortbar/messbar. Beim trivialen Einzelpaket keinen leeren zusätzlichen Verwaltungsknoten erzwingen. Der Paket-Case bleibt offen bis seine erforderlichen Children und Ergebnisse erledigt sind. Der Builder darf nur seine eigene gelieferte Arbeit als abgeschlossen melden, keine unabhängige Acceptance oder den Gesamtauftrag vorwegnehmen.

Builder beschafft notwendige Quellen selbst, implementiert im autorisierten Git-Arbeitsbereich, führt echte Tests in Dev aus und persistiert Kandidat und Prüfbelege nach Git. Bei fehlgeschlagenem Vertragsnachweis begrenzte lokale Nachbesserung innerhalb seiner Arbeit, bevor ein fertiges Ergebnis gemeldet wird. Kein unendlicher Run: technisches Zeit-/Kostenlimit, persistierter Zwischenstand und Wiederaufnahme derselben Work-Identität; menschliche Übernahme bei Ausschöpfung. Keine neue fachliche Nacharbeits-Case-Kette pro internem Testfehler.

Temporäres Builder-Review-Gate: Ergebnis und Dev-Beleg erläutern, menschliche Freigabe zur Fortsetzung. Dieses Gate ist eine sichtbare Entwicklungs-/Einführungsoption, später durch Konfiguration entfernbar. Entfernung umgeht weder Pflichtprüfungen noch finale UAT/Produktionsfreigabe.

Die vom Intake bestimmten drei Reviewrollen bearbeiten nach Builder-Fertigstellung unabhängig denselben fixierten Kandidaten, parallel soweit Ressourcen erlauben. Eigene Dev-Prüfungen sind möglich. Jeder Review persistiert Findings, Scope, geprüften Commit und Tests in Git/Gitea. Reviews verändern keinen Produktcode. Allgemeine Rollenvorgaben und Prüfkriterien stehen in Prompts/Skills/KBs; auftragsbezogene Anforderungen stammen aus dem Git-Auftrag.

Consolidated Audit wartet auf sämtliche erforderlichen Reviews und technischen Resultate. Native Merge-Node aggregiert, der Audit-Agent bewertet Vollständigkeit und Widersprüche mit Source-/Testevidence. Fehlender Review ist kein Null-Finding-Ergebnis. Ergebnis Git, kurze verständliche Case-Zusammenfassung, konkrete Folgearbeit.

Bei blockierenden Findings ein eigenständiges Nacharbeitspaket als Child des Cases, dessen Ergebnis die Nacharbeit ausgelöst hat. Dieses Paket erhält Git-Auftrag und einen eigenen daran gebundenen Builder-Run; keine bloße zweite Runde unter dem falschen Sammel-Case. Review-/Audit-Cases referenzieren den verursachenden Kandidaten. Reine Implementierungsnacharbeit geht direkt zum Builder. Geändertes Ziel, Scope, Schnittstellen oder neue Fachentscheidung geht über Intake und erforderliche Planfreigabe.

Maximal drei fachliche Nacharbeitszyklen je ursprünglichem Teilauftrag über alle untergeordneten Reparaturen hinweg; ursprünglicher Build zählt nicht als Nacharbeit. Counter/Referenzen müssen in vorhandenen nativen Work-/Evidence-Strukturen nachvollziehbar sein, nicht bei jedem neuen Child wieder bei null beginnen. Danach menschliches Review-Gate mit kompletter Evidence statt stiller Freigabe oder vierter automatischer Runde. Technische Retries zählen separat und erzeugen keine fachlichen Child-Cases.

Abhängiger Teilauftrag startet erst bei dem im Plan verlangten Reifegrad seines Vorgängers. Wenn Auftrag 3 den vollständigen Abschluss von Auftrag 1 verlangt, genügt nicht dessen Builder-Ergebnis: erforderliche Reviews, Nacharbeit, Gates und Paketabschluss müssen vorliegen. Abhängigkeitsgraph muss azyklisch und tatsächlich durchgesetzt sein, nicht nur im Prompt erwähnt. Bei verspäteter Änderung des Vorgängerkandidaten abhängige Ergebnisse/Prüfungen auf betroffene Revisionen neu bewerten.

Unabhängige Pakete dürfen parallel entwickeln, mit eigenen Git-Arbeitsbereichen und isolierten Dev-Daten bzw. serialisierten gemeinsam genutzten Ressourcen. Kein konkurrierender blind schreibender Builder am selben Branch. Intake legt Merge-/Integrationsreihenfolge und Konfliktverantwortung fest. Ein gemeinsam genutztes aktivierbares UAT-Target genügt, wenn wechselnde Kandidaten sichtbar serialisiert und revisionsgebunden bereitgestellt werden; kein zweiter dauerhafter Fullstack pro Auftrag.

Integration, Gesamtprüfungen und isoliertes UAT-Deployment gehören zum ursprünglichen Intake-Plan. Geprüfte Paketstände kontrolliert zusammenführen, gemeinsamen Commit bauen/testen und genau diesen als Digest bereitstellen. Einzelne grüne Pakete beweisen noch kein getestetes Gesamtergebnis.

Final Gate: Zusammenfassung, Findings, Testergebnisse und tatsächlich verfügbare UAT-URL samt Commit/Digest vorlegen. Bei Freigabe denselben geprüften Build regulär nach Produktion promoten, notwendige Migrationen/Health/Funktionsprüfung nachweisen. UAT-Findings als kausale Nacharbeit verknüpfen; betroffene Freigaben invalidieren. Parentabschluss erst nach Pflicht-Children, unabhängiger Acceptance und verifiziertem vereinbartem Endpunkt.

## 2. Gemeinsamer Ein-/Ausgabevertrag

Jeder Baustein ist separat aufrufbar und erhält vorhandene Case-/Work-Identität, freigegebene Git-Auftragsreferenz, Repo/Base/Kandidat, erlaubte Werkzeuge/Arbeitsbereiche und notwendige Vorgängerreferenzen. Serverseitige Owner-/IAM-Autorität nicht aus Modelltext ableiten.

Ergebnisse: tatsächlicher Run/Attempt, unveränderliche Git-/PR-/Evidence-Referenzen, getestete Revision, fachliches Ergebnis, offene Entscheidungen und verantwortbare Folgearbeit. Git für Aufgaben/Code/Tests/Reviews; AgentSwarms/Supabase für Konfiguration und native Case-/Run-/Approvalzustände. Keine Shadow-Queue oder zweite Statusautorität. Issues nur bei nachgewiesenem Nutzen mit Case-/Git-Verknüpfung.

## 3. Sourcegeprüfte Voraussetzungen und gezielte Gap-Prüfung

Referenzstand App ded696b804c7d921f275560e3fc7bd799d4b3265; aktuellen Stand vor Umsetzung neu lesen.

- workContract.ts hat parentCaseId, stabile sourceId und dependencies mit REQUIRES_COMPLETION, REQUIRES_CANDIDATE und INFORMS. work.server.ts dispatcht case_work. Das sind bestehende aXtn-SupaCase-Verträge, nicht pauschal Upstream-Core.
- swarmExecute.server.ts besitzt native Subswarm-, Approval-/Checkpoint- und Merge-Pfade. Der geprüfte Execute-Swarm-Pfad übernimmt caseExecution des Parents; Parent-Run-Verknüpfung erzeugt keinen separaten fachlichen Child-Case und setzt dessen case_id nicht automatisch. Einzelaufruf und Zusammensetzung müssen Child-Case-Bindung tatsächlich belegen, nicht mit einer Payload-Variablen vortäuschen.
- startCaseSwarm besitzt authentifizierte Caseprüfung und idempotenten Start. Aus dessen Existenz folgt kein dauerhafter automatischer Dispatcher für neue Cases, abhängige Pakete oder Nacharbeit. Vorhandenen DMS-/Work-Consumer im erlaubten Scope prüfen und Wiederverwendung nachweisen.
- Native Loop und For Each führen am Referenzstand Modellaufrufe aus, keinen beliebigen Subgraph aus Git-Write, Runner, Readback und erneuter Entscheidung. Ein Loop-Label beweist den verlangten Builder-Test-Nachbesserungszyklus nicht. Agent-Toolschleife, vorhandene native Komposition und tatsächliche Dev-Werkzeuge zuerst qualifizieren; keine zyklischen DAG-Rückkanten oder versteckte Funktionsengine bauen.
- workAcceptance.server.ts beschränkt Binding/Receipt noch auf aXtn/development-swarm-acceptance und den bisherigen Runtime-Harness. workContract.testProfile kennt python-normalization-v1 und documentation-v1. Damit ist allgemeine Produktrepo-Abnahme nicht bewiesen. Keine Guards entfernen, Fake-Profile oder Python-PASS für React verwenden.
- DMS-README, documentWorkContract und bestehender DMS-Recovery-Auftrag belegen getrennte Work-/Child- und Approval-/Recovery-Patterns. Sie enthalten auch aXtn-Domainadapter und ältere Function-Nodes. Die Übernahme ist kein Freibrief für Function-basierte Development-Orchestrierung; tatsächlichen vorhandenen Consumer und dessen Source/Tests prüfen.
- Vollständige dynamische Source-Reads, echte Dev-/Runner-Fähigkeit, Reviewpersistenz und Ergebniszugriff gehören zu jedem Bausteinnachweis; bekannte Toolresultat-/Modellrundenlimits berücksichtigen. Keine festen Vorabreads als Reparatur tarnen.

Für jede Lücke zuerst native Konfiguration, Standardintegration oder vorhandenen Adapter verwenden. Falls ein notwendiger konkreter Übergang damit nachweislich nicht realisierbar ist, minimalen sourcebelegten Gap mit Reproducer, kleinster Alternative und Auswirkung vorlegen. Neue Custom-Implementierungen sind nicht pauschal autorisiert. Unabhängige native Bausteinarbeit fortsetzen, statt den Gesamtauftrag wegen einer einzelnen offenen Betriebsaufgabe stillzulegen.

## 4. Gestufte Umsetzung und Nachweise

A. Begrenzter Vertragsabgleich statt erneuter 69-Node-Inventur: vorhandenen Audit a6bc36fcf012e5f744764ea6dd54221a9759bf9a wiederverwenden, DMS-/Case-Übergaben und oben genannte Gaps gezielt prüfen. Kurze Native-Matrix mit konkreter Source, Objekt/Version, Übergabe und Test. Kosten für Modellaufrufe/Tool-/CI-Ausführung als gemessene Werte bzw. ausdrücklich unbekannt ausweisen. Keine erfundenen Kostenschätzungen.

B. Intake eigenständig konfigurieren/qualifizieren: echten autorisierten Auftrag autonom recherchieren, vollständigen Git-Plan inklusive Zusammenführung erzeugen, Rückfrage mit Antwort/Planrevision und Gate-Suspend/Resume nachweisen. Arbeit stoppt nur am tatsächlich erforderlichen Nutzerentscheid des Plans; keine erneute generelle Implementierungserlaubnis verlangen.

C. Builder eigenständig: kleiner repräsentativer autorisierter Produktrepo-Task, echte Git-Write-/Readbacks, passende ausführbare Regression, Dev-Testresultate und begrenzte nachgewiesene Fehlerkorrektur; temporäres Ergebnisgate. Kein Ersatz durch Normalisierungsfixture.

D. Reviewrollen und Audit eigenständig: gleicher fixierter Kandidat, drei vollständige persistierte Reviews, mindestens ein tatsächlicher oder kontrolliert synthetischer Findingfall im autorisierten Qualifikationsbereich, nachvollziehbare Konsolidierung. Synthetik klar kennzeichnen und keine Produktmängel absichtlich einbauen.

E. Leitprozess verbindet die nachgewiesenen Fähigkeiten: zwei unabhängige Pakete und ein abhängiges Paket als gezielte Qualifikation, automatische Case-/Run-Zuordnung, wirksames Warten, kein Doppelstart nach Retry/Restart, begrenzte Nacharbeit. Vorhandene Swarms wiederverwenden; keine Vollkopie jedes Fachschritts. Case-Hierarchie im UI findbar.

F. Gemeinsamer integrierter UAT-Kandidat, menschlicher Review, reguläre Freigabe/Produktion mit exakt geprüftem Artefakt. Bestehende Content-Exclusion respektieren; UAT-Input nur über policy-erlaubten Betreiberweg. Fehlende UAT darf nicht die belegte Fertigstellung unabhängiger Bausteine verdecken, verhindert aber die Gesamt-Funktionsabnahme.

Mindestens zwei fachlich unterschiedliche Eingaben mit unveränderter veröffentlichter allgemeiner Konfiguration qualifizieren. Keine Repo-/Task-Dateinamen nachträglich in Graphen ergänzen. Erst einzelne Bausteine belegen, dann Leitprozess aktivieren. Nativen Objekt-/Konfigurations-Readback, Save/Publish/Snapshot-/Skill-/KB-Parität und Kosten-/Zeitgrenzen dokumentieren.

## 5. Wissen und Administration

Vorhandene Development-Delivery-/Independent-Review-/UAT-Skills, Development Standards-/UAT-KBs und geeignete Agenten prüfen und wiederverwenden; Model Advisor ist nicht automatisch Intake. Fehlende native Rollenobjekte gezielt anlegen. Tatsächliche IDs, Zuweisungen, Modelle, Skills, KB-Quellen und Versionen nennen. Gateway weiterhin pro Agent Opt-in, kein All-Traffic-Routing.

Allgemeine Methodik in Skills, Architektur-/Prüfstandards und qualifizierte Patterns in KBs, auftragsspezifische Ziele/Contracts/Tests in Git. Externe Repositories liefern lokale verbindliche Verträge für diesen Auftrag. Verallgemeinerbare Erkenntnisse als überprüfbaren Wissens-/Skill-Änderungskandidaten mit Herkunft/Version erfassen; nicht ungeprüft zum globalen Standard machen. Lizenz, Vertraulichkeit und Widersprüche beachten; keine Secrets oder vollständigen fremden Codebestände in KBs kopieren. Vorhandene Pattern-Usage-/Improvement-Verträge vor neuer Lerninfrastruktur prüfen.

## Ergebnisbericht

Fortschritt je Baustein: konfiguriert, publiziert, separat getestet, Case-gebunden, integriert, UAT, prod, akzeptiert. Pro Stufe tatsächliche Git-/Case-/Run-/Objekt-/Testreferenzen und nächsten ausführbaren Schritt. Kein Gesamt-Task-complete nach Analyse oder grünen Graph-Steps. Keine neue Credentialrunde ohne konkrete aktuelle Ablehnung. Eigene bestehende Copilot-Identität und reguläre erlaubte Owner-Session verwenden.

Bericht: handoffs/reports/AXTN-DEV-PROCESS-MODULAR-20261019.md im autorisierten Repo-Artefaktbereich; nötige vorhandene Schreibrechte zuerst lesen. Keine Nutzeraufforderung zum Kopieren von Tokens.
