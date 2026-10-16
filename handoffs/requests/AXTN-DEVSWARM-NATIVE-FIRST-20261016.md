# AXTN-DEVSWARM-NATIVE-FIRST-20261016 — verbindlicher Ausführungsauftrag

Nutzerpräzisierung 16.10.2026, 22:54 Europe/Berlin.
Repository: aXtn/aXtn-agentswarms. Tracking: bestehendes Issue #7 und bestehende native Case-Lineage.
Arbeits-/Handoff-Branch: work/AXTN-NATIVE-SWARM-COMPLETION-20261016.
Status: NATIVE_CONFIGURATION_AND_EXECUTION_AUTHORIZED; CUSTOM_RUNTIME_NOT_AUTHORIZED.

## Vorrang und Rollen

Dieser Auftrag ersetzt frühere Annahmen, eine zusätzliche Python-/TypeScript-Runtime, task/v2, ein eigener Validator oder Harness müssten als Voraussetzung gebaut werden. Es gibt dafür keine neue Freigabe. Er ersetzt nicht die separat autorisierte sichere Rotation genau der zwei offengelegten internen Secrets und bestehende Schutzverträge.

Copilot richtet den echten Development Swarm mit vorhandenen nativen AgentSwarms-Funktionen ein und prüft ihn. Der Swarm, nicht Copilot CLI, bearbeitet anschließend den Produktauftrag aus aXtn/aXtn-architecture PR #8. Kein weiterer Fixture-PASS als Ersatz für diese Umsetzung.

## Zuerst umsetzen und sichtbar machen

1. Aktuelle AGENTS.md, Handoff, native Developer-Dokumentation UND ausführende Handler/Tools des tatsächlich deployten AgentSwarms-Stands lesen. Den vorhandenen Developer-Workspace, Sessions, Datei-/Repository-Werkzeuge, ausführbare Entwicklungswerkzeuge und vorhandene native Graph-Komposition konkret ermitteln. Weder ein fehlendes npm in einem ausgewählten Python-Image noch eine vorhandene Notebook-Dokumentation beweist, dass die gesamte native Plattform keine passende Entwicklungsfähigkeit hat.
2. Den bestehenden Swarm nativ konfigurieren: Auftrags-/Quellkontext lesen, Entwicklungswerkzeuge dem Builder zuordnen, Änderungen erzeugen, deterministische Prüfungen ausführen, Contract/Security/Maintainability unabhängig prüfen lassen, native Approval und Review-PR. Native Nodes/Loops/Toolschleifen verwenden, soweit ihre ausführenden Verträge dies tatsächlich tragen. Keine Ablaufsteuerung in Function-Nodes, Tool-Dispatcher, externen Skripten oder versteckten Controllern.
3. Agents, Skills, Tools, Prompts, Modellwahl, Arbeitskontext und Workflow über die vorhandene native Administration zugänglich halten. Ein Seed oder apply.mts darf gespeicherte Operatoränderungen nicht zurücksetzen. Bibliotheksobjekt und Swarm-Snapshot unterscheiden; Save/Publish/Reload/Readback am tatsächlich genutzten Graphen nachweisen. Laufende/historische Runs und Versionen erhalten.
4. Bestehende vier Modellzuordnungen beibehalten: Builder GLM-5.3-Flash, Contract GLM-5.2, Security gpt-oss-120b, Maintainability Mistral-Small-4-119B-2603. Gateway-Opt-in je Agent, globales All-Traffic-Routing aus. Native IAM-/Credential-Prüfungen nicht umgehen. Kein neues Modellwahlprojekt als Vorbedingung.
5. Den konfigurierten nativen Ablauf tatsächlich ausführen. Erster sichtbarer Meilenstein: gespeicherter und publizierter Swarm, dessen nativer Run realen Repository-Kontext liest und ein natives Entwicklungswerkzeug ausführt; mit UI-Fundstelle, Version, Run und Tool-Evidence. Das allein ist noch kein vollständiger Produktnachweis.
6. Danach PR #8 in den Swarm geben: aXtn/aXtn-architecture@14b51ce781eeecfe766f6fe8dd83c0b393b2c2c1, work-orders/AXTN-SUPACASE-USABILITY-0001.md und die dortigen -SWARM.md/-TEST.md-Verträge vollständig beachten. Zielrepo aXtn/aXtn-agentswarms, aktueller kompatibler exakter Base-SHA; Zielbranch work/AXTN-SUPACASE-USABILITY-0001. Produktcode und Tests entstehen nachweislich durch Swarm-Agents mit nativen Werkzeugen, nicht durch stellvertretende CLI-Implementierung.
7. Alle Reviewer und die Verifikation müssen denselben unveränderlichen vollständigen Mehrdatei-Kandidaten prüfen. Keine Beschränkung auf normalize_score.py, das Acceptance-Repo oder python-normalization-v1 als vermeintlich allgemeiner Produktvertrag übernehmen.
8. Ergebnis des Produktauftrags ist ein echter reviewbarer PR nach erfolgreichen einschlägigen Prüfungen und tatsächlicher nativer Freigabe. Falls die reguläre unabhängige Approval noch aussteht, PENDING_APPROVAL wahrheitsgemäß berichten. Keine TEST_SIMULATION für echte Produktabnahme, kein eigenmächtiger Merge, Produkt-Deploy oder Produktionsdatenumbau unter PR #8.

## Sondercode transparent behandeln

Einmal knapp inventarisieren: vorhandene aXtn-Functions, fest codierte Repository-/Datei-/Profilbindungen, Harness und Runtime-Anpassungen; jeweils tatsächliche Funktion, Pfad, Aufruf und native Ablösung. Vorhandene native Mechanismen konfigurieren und solche Sonderpfade für den neuen Lauf entkoppeln; historische Evidence nicht löschen. Kein pauschales Löschen von Guards, Migrationen oder funktionierenden Komponenten.

Es ist nicht behauptet, dass diese Ablösung bereits gelungen ist. Eine native Tool-Hülle um eigenen Orchestrierungscode erfüllt den Auftrag ausdrücklich nicht.

## Echte Lücke statt weiterer Sonderlösung

Wenn ein konkreter benötigter Schritt trotz Prüfung der nativen Implementierungen nicht ausführbar ist: exakten fehlenden Vertrag, geprüfte native Alternativen und reproduzierbare Grenze berichten. Keine Runtime-Erweiterung, keinen eigenen Executor, kein neues Task-/Case-/Approval-System eigenmächtig bauen. Unabhängig mögliche native Konfiguration und sichtbare Teilnachweise trotzdem abschließen. Ein konkreter verbleibender Blocker ist zulässig; das wiederholte bloße Durchtesten der bekannten Python-Fixture ist kein Fortschritt und kein Abschluss dieses Auftrags.

## Betrieb, Sicherheit und Abschluss

Bestehende eigene Copilot-Zugänge und den etablierten Release-Weg nutzen; keine Codex-Identität, keine erneute pauschale Credential-Anforderung. Keine Secrets in Ausgaben/Git/Graph/Case. Die separat autorisierten Reparaturen und internen Secret-Rotationen bleiben gültig, sind aber nicht durch globale Neuverkabelung oder unnötige neue Backupschleifen auszuweiten.

Bestehende Cases idempotent weiterführen, nur echte Arbeitspakete als Children. Bericht: handoffs/reports/AXTN-DEVSWARM-NATIVE-FIRST-20261016.md. Enthalten sein müssen native Objekt-/Versions-/Run-Referenzen, nachvollziehbare Toolausführung und Urheberschaft der Produktänderungen, exakte Prüfresultate und Grenzen. Nachweis der nativen Administration und echter Ausführung zuerst; nicht nur Architekturentwurf abgeben. Gitea ist autoritativ, Spiegelung nach bestehendem Vertrag. Fertig erst bei verifiziertem Endpunkt, andernfalls präzise BLOCKED mit tatsächlichem fehlendem Schritt.
