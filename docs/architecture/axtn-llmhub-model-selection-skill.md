---
name: aXtn LLMHub Model Selection
description: Aufträge analysieren und geeignete, erlaubte LLMHub-Modelle anhand aktueller Verfügbarkeit, Modellprofilen und gemessener Eignung empfehlen.
---

## Wann anwenden
Wenn du einen Entwicklungsauftrag planst, ein Rollenmodell auswählst oder die Eignung einer bestehenden Modellbelegung beurteilst.

## Vorgehen
1. Lies den konkreten Auftrag und seine vorhandenen Architektur-/Work-Verträge. Ermittle benötigte Code-, Review-, Sprach-, Bild-, Kontext-, Tool- und Ausgabeanforderungen. Neue Rollen, Tools oder Rechte werden durch die Modellwahl nicht autorisiert.
2. Suche in der zugeordneten Knowledge Base "aXtn LLMHub Model Knowledge" die relevanten Modellprofile und Evaluationsergebnisse. Prüfe Quellenstand, exakte Modell-ID und Datum. Trenne Herstellerangaben, unsere Empfehlung und tatsächlich gemessene Eignung.
3. Verwende für aktuelle Verfügbarkeit nur einen tatsächlich vorhandenen autorisierten Discovery-/Katalogzugriff. Ein KB-Profil oder öffentlicher Registry-Eintrag beweist keine aktuelle Freischaltung. Hast du keinen solchen Zugriff, kennzeichne die Empfehlung als vorläufig und nenne genau die fehlende Verifikation. Erfinde keinen Toolaufruf und keine aktuelle Verfügbarkeit.
4. Wähle nur tatsächlich erforderliche Modelltypen. Embedding-Modelle dienen Retrieval, nicht Codegenerierung/Review. Bildverständnis ist keine Bildgenerierung. Hersteller-Toolfähigkeit ersetzt keine native Toolfreigabe.
5. Priorisiere erfüllten Aufgaben-/Output-/Toolvertrag und funktionale Korrektheit. Vergleiche danach gemessene Gesamtlatenz, Kontextbedarf, Tokenverbrauch und geltende Kosten. Parameteranzahl, "Flash" im Namen oder Aktualität allein sind kein Ranking.
6. Für unsichere entscheidende Eigenschaften verwende vorhandene native Vergleichs-/Testfunktionen mit kleinen synthetischen auftragsnahen Beispielen. Kein neuer Benchmarkdienst oder unbegrenztes Probieren. Prüfe Reviewer auch an bekannten Fehlern; allgemeines PASS ist kein Qualitätsnachweis.
7. Gib Rolle, exakte Modell-ID, Begründung, nötige Fähigkeiten, verwendete Evidence und verbleibende Unsicherheit aus. Explizite Alternative nur mit eigenem Eignungsgrund. Verschiedene Modelle allein garantieren keine unabhängige Acceptance.
8. Eine Empfehlung ändert keine gespeicherte Agent-/Node-Konfiguration. Änderungen nur innerhalb des ausdrücklich beauftragten Scopes über vorhandene native Speicher-/Snapshot-/Publishverträge. Historische Runs bleiben unverändert. Globales route_all bleibt false; beauftragte Rollen verwenden das native Gateway-Opt-in. Keine stille Direktroute oder Modellsubstitution.
9. Halte nach einem echten Lauf brauchbare gemessene Erkenntnisse im vorhandenen Evidence-/KB-Pflegeweg fest: Quellenreferenz, Datum, Aufgabe, Modell/Route, Test-/Toolvertrag, Ergebnis und Grenzen. Keine Secrets oder vollständigen vertraulichen Prompts/Logs übernehmen.

## Ergebnisformat
- Aufgabe und erforderliche Fähigkeiten
- Rollenempfehlung: Rolle | exakte Modell-ID | Grund | Evidenz | offene Prüfung
- Verfügbarkeit/IAM: tatsächlich geprüft oder nicht geprüft
- Grenzen und nächster konkreter Prüfschritt

## Grenzen
Dieser Skill ist eine Arbeitsanweisung, kein Registry-Abfragetool, kein Training, kein Berechtigungsnachweis und keine autonome Änderungsfreigabe. Verwende nur die tatsächlich verfügbaren nativen Tools. Fehlt eine Capability, melde sie präzise statt sie durch Prosa oder erfundene Ergebnisse zu ersetzen.
