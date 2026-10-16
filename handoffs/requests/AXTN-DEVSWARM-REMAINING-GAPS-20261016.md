# AXTN-DEVSWARM-REMAINING-GAPS-20261016

Status: AUTHORIZED_CONTINUATION / NOT_GENERAL_DEVELOPMENT_ACCEPTED
Branch: work/AXTN-NATIVE-SWARM-COMPLETION-20261016
Tracking: Issue #7, vorhandene passende Parent-/Child-Cases.
Quelle: Bericht e3d98968430e879d0039cbe356df760496028a75.

## Stand und Ziel
Vier LLM-Rollen sind laut Bericht nativ auf Corporate-Gateway-Modelle publiziert; Run 0bbbb403-5e8a-48dc-8802-7d369a91a3bb/PR #11 belegt die synthetische All-Gateway-Baseline. Dies erhalten. Der reale Auftrag AXTN-SUPACASE-USABILITY-0001 bleibt NOT_READY und wurde nicht ausgeführt. Keine weiteren reinen positiven normalize_score-Läufe als Ersatz.

ChatGPT arbeitet als Solution Architect/Implementation Engineer, Copilot als technischer Umsetzer. AGENTS.md, Native-first, vorhandene Case-/Work-/Runtime-/Release-Verträge und erteilte Berechtigungen gelten. Kein neuer Orchestrator, unfreigegebener Executor oder generischer Shellzugang.

## 1. Konkreter Produktfehler
Source-Fix 5a4d1405e83e5f82f0c6ee709326b7a8560dccb6:
src/components/agents/AgentForm.tsx initialisiert Temperatur mit agent?.temperature ?? 0.7 statt || 0.7. Nur null/undefined verwenden den Default, 0 bleibt erhalten. Einzige Sourceänderung dieses Vorbereitungsschritts; noch nicht getestet/deployed.
- Fix auf aktuellem Nachfolger erhalten, vorhandene gezielte AgentForm-Checks sowie Save/Reopen mit 0, nichtnull Wert und neuem Agent prüfen. Keine pauschale Volltestwiederholung ohne Anlass.
- Guarded-Badge separat gegen effektive Guardrails prüfen. Explizite Defaultwerte sind nicht automatisch ein Schutzverlust. Anzeige/Serialisierung nur bei belegtem Fehler minimal im vorhandenen Produktvertrag korrigieren; keine Guards deaktivieren oder Konfiguration direkt per SQL umetikettieren.
- Den getesteten Bugfix über vorhandenen regulären Releaseweg ausliefern, wenn dafür bereit; keine neuen Credential-/Backup-Einrichtungsrunden. Tatsächlichen Source/Image-Digest und UI-Readback dokumentieren. Native KB-Konfiguration unabhängig davon fortführen.

## 2. Beauftragte Modell-KB und Skill abschließen
Der Auftrag handoffs/requests/AXTN-LLMHUB-NATIVE-MODEL-KNOWLEDGE-20261016.md ist weiterhin auszuführen. Fertiger Skilltext und Recherche liegen im Repo. Im neuen Abschlussbericht fehlt dessen Erledigungsbeleg.
Native KB/Skill idempotent einrichten, geeigneten bestehenden Agenten zuordnen und echte Retrieval-/Skill-/Unsicherheitsprobe samt IDs/Trace liefern. Registry-Abgleich und fehlenden technischen Katalogzugriff getrennt dokumentieren. Kein Custom-Registrytool oder neuer Syncdienst aus diesem Auftrag.

## 3. Verbleibende bounded Rollen-/IAM-Gegenproben
- Fehlende isolierte Testidentität ist eine einzurichtende technische Testvoraussetzung, keine neue Modellauswahlentscheidung. Vorhandene autorisierte synthetische Testnutzer/Isolation verwenden; nötigenfalls im isolierten Testbackend einen synthetischen Nutzer über native Auth-/IAM-Einrichtung anlegen. Keine fremden oder produktiven Owner-Grants ändern und keinen Service-Role-Modellaufruf als Benutzer-Negativtest ausgeben. Falls Live-Testbenutzer nicht erforderlich/sicher verfügbar, exakten produktgleichen isolierten Test und Grenze zur Live-Negativprobe berichten.
- Pro betroffenem Modell ohne Recht: serverseitige Ablehnung vor Gatewaydispatch, kein direkter Fallback. Negativfälle benötigen keine erfolgreiche Inferenz.
- Flash einmal an einem kleinen bekannten fehlerhaften Candidate und erforderlichem Candidate-/Outputvertrag prüfen. Dies prüft Grenzen und Fehlerbehandlung, nicht optimale Qualität. Ein Qwen-Vergleich nur soweit für die noch offene konkrete Builderentscheidung erforderlich; nicht alle Modelle benchmarken. Keine Simulation echter Produktapproval.

## 4. Echte Anschlussfähigkeit zuerst technisch klären
Der Bericht nennt axtn.development.task/v2 als "kleinste native Anschlussmöglichkeit". Sourceprüfung bestätigt bislang nur Bedarf, nicht vorhandene vollständige Capability:
- src/lib/axtnDevelopmentSwarm.ts bindet Task, Ein-Datei-Candidate, Review-Hash, MCP-Branch/File/PR, Builder-Prompt und Verifyprofil an den Python-Fixture.
- src/utils/notebookRuntime/development.server.ts verwendet vorhandene Docker-Batch-Sessions mit spezifischer axtn-Verify-Receipt/Harnessbindung.
- docs/DEVELOPER_WORKSPACE_RUNTIME.md und docker/notebook-runtime/Dockerfile beschreiben Python/Jupyter; das geprüfte Image installiert kein Node/npm. Ein Umbenennen des Testprofils liefert keine TypeScript-/React-Buildfähigkeit.

Gezielt am aktuellen Source und laufenden Runtime-Image prüfen:
1. Welche vorhandenen nativen Workspace-/Batch-/MCP-Tools können das Produktrepo am festen Base-SHA lesen, mehrere erlaubte Dateien bearbeiten und echten TypeScript-Test/Build ausführen? Source-Handler, Bild/Programme, native Grants/egress/limits/Outputs konkret belegen. CLI-Verfügbarkeit ist kein Swarm-Toolnachweis; JS-Function-Transform ist kein npm-Workspace.
2. Falls eine bestehende native Konfiguration dies bereits vollständig ermöglicht, diese im Auftragsscope nutzen und gegen Phase A des vorbereiteten Produktauftrags prüfen.
3. Andernfalls eine konkrete reviewbare Lösung innerhalb der vorhandenen Komponenten vorbereiten: Task-/Candidate-/Review-/Receipt-Felder, exakte Repo-/Pfad-/Größen-Scopes, nötige native Nodekomposition, erlaubtes unveränderliches Testprofil und tatsächliche Runtime-Abhängigkeiten. Quellenreferenzen und minimaler Änderungsumfang statt "v2" als pauschalem Lösungsnamen.
4. Historischen v1-Fixture kompatibel erhalten. Keine Repository-Allowlist entfernen, keinen freien Shell-/npm-Befehl im Task akzeptieren, keine unbeschränkte Paketinstallation, keine Candidate-Änderung nach Review. Ein Mehrdatei-Receipt muss den ganzen Candidate binden, nicht nur files[0].
5. Handelt es sich um neue Runtime-/Executor-/Tool-/Schnittstellenfunktion jenseits vorhandener nativer Konfiguration, Implementierung nicht als schon nativ/autorisiert vortäuschen. Konkrete Lücke und kleinsten notwendigen Erweiterungsentwurf für die Architekturentscheidung liefern. Kein neuer Kontrollplan. Bereits autorisierte UI-/KB-/Skill-/Testarbeit deshalb nicht anhalten.
6. Case-Management-Implementierung bleibt Arbeit des konfigurierten Swarms; Copilot darf sie nicht selbst erzeugen und dem Swarm zuschreiben. Produktauftrag architecture@14b51ce781eeecfe766f6fe8dd83c0b393b2c2c1 enthält seinen eigenen tatsächlichen Test-/PR-Scope. Keine weitere künstliche Python-Aufgabe als Phase-A-PASS.

## Lieferung
Bestehenden Abschlussbericht aktualisieren und native Case-Referenzen pflegen. Reale Zustände getrennt: Rollenmodelle, Modellwissen, UI-Fix Source/tested/deployed, negative Checks, native Produktrepo-/TypeScript-Toolfähigkeit. Source-/Konfigurationstests nicht als Live-Abnahme ausgeben.
Dieser Fortsetzungsauftrag ersetzt kein Test-/Runtime-Gate durch Behauptungen. Keine allgemeine erneute Freigabe für bereits beauftragte native Routinearbeit verlangen.
