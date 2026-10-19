# AXTN-DEV-PROCESS-PLAN-APPROVAL-20261019 — gestufte Umsetzung

Status APPROVED_FOR_STAGED_IMPLEMENTATION_BY_USER / NATIVE_DECISION_READBACK_REQUIRED.
Quelle: tatsächliche Erklärung von Alex in dieser Unterhaltung am 19.10.2026, 15:51 Europe/Berlin:
„Also ja, gestufte Umsetzung bin ich dabei, ja, mit den Git-Werkzeugen. Klar, wenn die nur lesen sind, dann müssen wir die ergänzen.“

## Revisionsgebundene Entscheidung

Freigegeben ist die gestufte Umsetzung des korrigierten Gesamtplans:
handoffs/plans/AXTN-DEV-PROCESS-MODULAR-20261019.md
Commit f3c198df50181366fa8c8b327f8853c84436e6f6
Blob 8a743fae22b3f46579852f899e91c09678ecb045.

Bestehende native Gate-Evidence laut veröffentlichtem Fortschritt: Gate-Graph f2ab40d5-84cf-42f1-ab24-5afaeeadf1b7, Gate-Run 8ca0f035-d198-58a7-a9af-b3694610c351, Approval 8d0498cb-e23c-4453-a25e-0650e8e0abf9, Scope-Case 577050e6-e596-4818-bc79-d1041c9ef02e. Diese Werte vor Nutzung nativ neu lesen und Bindung gegen exakt obigen Plan verifizieren. Diese Datei dokumentiert die echte Entscheidung; sie behauptet keinen bereits geänderten nativen Approvalstatus.

Die Zustimmung ist keine UAT-/Produktivfreigabe und keine allgemeine Customarchitektur-Erlaubnis. Der frühere pauschale Umsetzungshalt am Plan-Gate ist für diesen geprüften Plan durch Alex' Entscheidung fachlich aufgehoben. Erforderliche native Dokumentation/Resume nicht überspringen. Keine weitere allgemeine Plan-Zustimmung von Alex verlangen.

## Verbindliche Ausführungspräzisierungen

1. Git-Schreibfähigkeit ist Bestandteil des ursprünglichen Auftrags, keine neue Nutzerkonfigurationsaufgabe. Mit vorhandenen Standard-Connectorfunktionen und engen Profilen einrichten:
- Intake: Arbeitsaufträge/Pläne und zugehörige Evidence schreiben.
- Builder: autorisierten Produktcode, Tests und Arbeits-/Prüfbelege schreiben.
- Jeder Reviewer: Produktcode nur lesen; eigene Review-/Testartefakte oder kandidatengebundene Gitea-Review-COMMENTs schreiben und zurücklesen.
- Audit: Quellcode/Reviews lesen; konsolidierten Ergebnisbericht und Nacharbeitsaufträge in den erlaubten Artefaktbereichen schreiben.
- Technische Identitäten/Owner-/IAM-Verträge erhalten. Drei AI-Reviews nicht als drei unabhängige menschliche Accounts ausgeben.
Repository-/Branch-/Pfad-/Operationsgrenzen tatsächlich durchsetzen; keine bloßen Promptverbote bei breiter Schreibberechtigung. Bestehende erlaubte Profile wiederverwenden; nur erforderliche Standardkonfiguration ergänzen. Kein neuer Berechtigungsdienst oder eigener Dispatcher.

2. Vollständiger Paketabschluss umfasst Builderergebnis, notwendige technische Prüfungen, die drei erforderlichen Reviews, Audit und gegebenenfalls Nacharbeit/Gate. Der vereinbarte temporäre Builder-Ergebnisreview bleibt in der Einführungsphase sichtbar konfiguriert. Ein REQUIRES_COMPLETION-Nachfolger darf nicht schon nach bloßem Builder-Candidate starten. Nach Integration ergänzende Gesamttests/Review auf dem integrierten SHA, sofern Wechselwirkungen relevant. Unterschied zwischen Builder Work abgeschlossen und Paket/Parent abgenommen erhalten. Bei Paket A „kein Defekt reproduziert“ als dokumentiertes verifiziertes Untersuchungsergebnis abschließen, nicht unnötig Code ändern oder C endlos auf einen nicht benötigten Fix warten lassen.

3. Leitprozess nativ ausführen. Lead-/Audit-Agent bewertet, erläutert und schlägt Arbeit vor. Start, Warten, Dependency-Durchsetzung, Checkpoints, Wiederanlauf und Approval bleiben in nachgewiesenen nativen Prozessfunktionen/Standardkompositionen. Keine versteckte Agent-/Function-Orchestrierung. Fachliche Child-Cases erhalten eigene IDs und kausale Parentbeziehung; technische Retries bleiben dieselbe Arbeit.

Diese Punkte konkretisieren die ursprünglichen Anforderungen; kein weiterer vollständiger Intake-Plan nur zur Wiederholung dieser Rechte-/Ablaufvorgaben. Vor jedem Baustein dessen exakten ausführbaren Konfigurations-/Toolvertrag und Nachweis festlegen.

## Native Entscheidung und direkte Ausführung

Die echte hier erteilte Nutzerentscheidung anhand dieser Git-Referenz über den bestehenden zulässigen nativen Entscheidungsweg festhalten und gegebenenfalls den suspendierten Gate-Run fortsetzen. Keine TEST_SIMULATION, keine erfundene menschliche Entscheidung, keine nachträgliche Änderung des Approval-Payloads, kein SQL-/Service-Role-Bypass. Serverattribution/Vertretungsregeln des vorhandenen Approvalvertrags beachten. Kann dessen bestehender autorisierter Weg die belegte Entscheidung nicht übernehmen, die exakte aktuelle Ablehnung benennen statt pauschal neue Freigabe/Credentials zu verlangen; keine neue Approvalengine bauen.

Nach verifizierter nativer Freigabe/Resume sofort die gestufte Umsetzung beginnen. Aktuelle kompatible Livebasis inklusive MFA-/Gateway-/Case-/Connector-Fixes sichern. Zuerst Voraussetzungen qualifizieren: A nur bei Reproducer, B skillIds-Parität am aktuellen Stand prüfen/korrigieren; anschließend tatsächlichen eigenständigen Builder mit Git-Write/Dev-Prüfung nachweisen, Reviewrollen/Audit und Leitprozess gemäß Plan verbinden. User erwartet sichtbare Bausteine und Ergebnisse, keine weitere reine Inventur. Fehler unabhängig zulässige Arbeit nicht grundlos stoppen lassen.

Dev-/UAT-Infrastruktur und echter CI-Resultzugriff sind nachzuweisende Arbeit, keine als erledigt angenommene Fähigkeit. Bei echter Content-Exclusion stoppen, nicht umgehen. Neue Customfähigkeit nur nach eigenständiger begründeter expliziter Freigabe; bestehende begrenzte Defektkorrekturen sind vom laufenden Auftrag gedeckt.

## Fortschritt für Alex

Native Cases/Worklist weiterführen. Alex muss weder Cases suchen noch Git-/MCP-Rechte selbst konfigurieren. Verständliche kurze Meldungen mit tatsächlichem gelieferten Baustein, Testergebnissen und geprüften direkten Gitea-Links. Nächster sichtbarer Meilenstein ist ein eigenständig ausführbarer Builder mit echtem Codekandidaten und Dev-Prüfbelegen. Reports und Source/Image/Objektversionen regulär veröffentlichen/zurücklesen. Produktive Fachänderungen erst nach späterer tatsächlicher UAT-/Releaseentscheidung.
