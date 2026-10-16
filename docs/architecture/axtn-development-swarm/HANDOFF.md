# Maßgeblicher Auftrag — zuerst echte native Swarm-Ausführung

Nutzerpräzisierung 16.10.2026, 22:54 Europe/Berlin.
Vollständig lesen und ausführen: handoffs/requests/AXTN-DEVSWARM-NATIVE-FIRST-20261016.md

Zuerst vorhandene native Developer-Werkzeuge im bestehenden Swarm konfigurieren, speichern/publizieren und sichtbar real ausführen. Danach bearbeitet der Swarm selbst PR #8 aus aXtn/aXtn-architecture@14b51ce781eeecfe766f6fe8dd83c0b393b2c2c1. Copilot richtet ein, ersetzt den Swarm nicht bei Produktcode. Keine weitere Python-Fixture-Abnahme als Ersatz; keine zusätzliche eigene Runtime/Executor/Orchestrierung autorisiert. Echte native Grenzen source- und runtime-belegt benennen statt Erweiterungen vorauszusetzen. Alle vorhandenen Sonderpfade transparent zuordnen und native Ablösung nachweisen. Bestehende Secret-Rotationsautorisierung und Schutzverträge bleiben gültig.

Der folgende Stand ist historisch; bei Widerspruch gilt der neue Auftrag. Insbesondere ist „TypeScript-Runtime fehlt“ keine abschließend belegte Aussage über sämtliche nativen Entwicklungsfähigkeiten.

## Historie

# Aktuelle Fortsetzung — belastbarer Teilabschluss und verbleibende Entscheidungen

Berichte 1b4e7f7868298758f75e8f70295cdcc25057f8ad gelesen. Aktueller vollständiger Auftrag:
handoffs/requests/AXTN-DEVSWARM-CLOSURE-20261016.md

Vorhandene native Reparaturen: KB-Kartenabsturz beheben, Temperatur-0-Save-Roundtrip abschließen, gezielte Retrievalvollständigkeit und tatsächliche Skill-Komposition belegen. Inline-Skill benötigt keinen use_skill-Toolaufruf. Isolierte IAM-Tests nicht mit Live-Abnahme verwechseln; keine globale Produktiv-IAM-Umstellung.
Nutzerautorisierung 16.10.2026 22:40: die zwei offengelegten internen Secrets über den vorhandenen Betreiber-/Keyring-/Reencrypt-Weg selbst sicher rotieren und danach Funktion nachweisen. Die jüngste Fortsetzung im vollständigen Auftrag ersetzt das frühere Warten auf eine Rotationszustimmung. Keine pauschale Rotation anderer Zugänge; am Schluss nur tatsächlich verbleibende Kontoinhaber-Aktionen nennen. Keine Secretwerte ausgeben, keine blinde Schlüsselersetzung.
TypeScript-Runtime fehlt weiterhin. Minimalen Erweiterungsentwurf auf vorhandener Infrastruktur konkret zur Entscheidung vorlegen, keinen neuen Executor/Orchestrator implementieren. Der reale Case-Management-Auftrag bleibt bis nachgewiesener Anschlussfähigkeit NOT_READY.

## Bisherige Aufträge und Herkunft

# Aktuelle Fortsetzung — offene Arbeit nach All-Gateway-Baseline

Bericht e3d98968430e879d0039cbe356df760496028a75: vier Rollen über Corporate Gateway publiziert und Fixture-Baseline PR_READY. Realer Case-Management-Auftrag weiterhin NOT_READY.

Vollständig ausführen:
handoffs/requests/AXTN-DEVSWARM-REMAINING-GAPS-20261016.md

Temperatur-0-Produktfix ist als Source 5a4d1405e83e5f82f0c6ee709326b7a8560dccb6 vorbereitet, noch nicht getestet/deployed. Native Modell-KB/Skill, bounded Rollen-/IAM-Gegenproben abschließen. Die echte native Produktrepo-/Mehrdatei-/TypeScript-Testfähigkeit mit Handlern und Runtime-Image belegen; task/v2 allein und Python-/Jupyter-Verifikation genügen nicht. Kein unfreigegebener neuer Executor oder bloßes Aufweichen des Fixture-Validators. Vorhandene normale Implementierungs-/Konfigurationsarbeit ohne neue allgemeine Zustimmung fortführen.

## Weitergeltende Detailaufträge und Herkunft

# Aktuelle Ergänzung — Modellwissen nativ in AgentSwarms bereitstellen

Nutzerauftrag 16.10.2026 20:00 Europe/Berlin: recherchierte LLMHub-Informationen in nativer KB bereitstellen, wiederverwendbaren nativen Modellwahl-Skill einrichten und tatsächlichen Registry-/Agentzugriff prüfen.

Vollständiger zusätzlicher Ausführungsauftrag:
handoffs/requests/AXTN-LLMHUB-NATIVE-MODEL-KNOWLEDGE-20261016.md

Fertiger Skill-Importtext: docs/architecture/axtn-llmhub-model-selection-skill.md.
Wissensquelle: docs/architecture/axtn-llmhub-model-role-research-20261016.md.
Native KB-/Skillobjekte idempotent konfigurieren und echten Retrieval-/Skill-Test liefern. Vorhandene Registry ist im geprüften Source AIMLAPI-basiert, Gateway-Discovery separat; kein nachgewiesenes Standard-Leseagenttool für LLM-Kataloge. Diese Lücke nicht durch eine neue unfreigegebene Registry-/Toolengine überspielen. Unabhängige KB-/Skillbereitstellung abschließen.

Der folgende Rollen-/Development-/Case-Management-Auftrag bleibt aktiv und wird nicht ersetzt:

# Aktuelle Fortsetzung — alle Development-Rollen über Corporate LLMHub

Nutzerentscheidung 16.10.2026 19:37 Europe/Berlin: alle bestehenden LLM-Agenten auf die aufgabenbezogene LLMHub-Startbelegung konfigurieren, nativ speichern/publizieren und für den vorbereiteten Case-Management-Test nutzbar machen.

Vollständiger Auftrag: handoffs/requests/AXTN-NATIVE-SWARM-COMPLETION-20261016.md
Die Fortsetzungen "Alle Rollen auf LLMHub konfigurieren und realen Folgeauftrag prüfen" UND "Recherchekorrektur aller zehn Modelle" sind maßgeblich. Primärquellenvergleich: docs/architecture/axtn-llmhub-model-role-research-20261016.md. Builder GLM-5.3-Flash nach bounded Rollenvergleich (explizite Alternative Qwen3.6-35B-A3B-FP8), Contract GLM-5.2 nach Discovery/Rollenprüfung (festgelegte Alternative gpt-oss-120b), Security gpt-oss-120b, Maintainability Mistral-Small-4-119B-2603. Alle über native Agent-/Node-Gateway-Opt-ins; route_all=false. Agent-Bibliothek und Swarm-Snapshots konsistent nativ administrieren. Keine erneute allgemeine Mapping-Freigabe.

Deployment/Gateway-Mischlauf ist laut Bericht 9c68bf47 erfolgt; keine alten Credential-/Backupblocker erneut als offen behandeln. All-Gateway-Rollenbaseline und echte native Developer-Toolchain-/Produktrepo-Fähigkeit bleiben separat zu belegen. Anschließend den vorbereiteten Auftrag AXTN-SUPACASE-USABILITY-0001 gemäß architecture@14b51ce781eeecfe766f6fe8dd83c0b393b2c2c1 Phase A–D durch den Swarm bearbeiten lassen, sofern der native Taskvertrag ihn trägt. CLI ersetzt den Swarm nicht. Kein Python-Fixture-PASS als echte Produktentwicklung, keine neue Custom-Orchestrierung.

## Vorheriger Auftrag und Detailherkunft

# Aktueller Abschlussauftrag — native administrierbarer Development Swarm

Nutzerentscheidung 16.10.2026 16:21 Europe/Berlin: lauffähigen Swarm fertigstellen; Agents, Skills, Tools, Modell- und Swarm-Konfiguration nativ administrieren; nur minimaler aXtn vLLM Swarm Selector.

Vollständig lesen und ausführen:
handoffs/requests/AXTN-NATIVE-SWARM-COMPLETION-20261016.md

Basis ist der verifizierte Update-Kandidat 084da7686b8254f56eb3ea8fe5be90e51a98d771 oder dessen geprüfter aktueller Nachfolger. Bestehende Lineage/Issue #7 verwenden. Bootstrap-/Seed-Einrichtung ist kein laufender Administrationsvertrag. Native UI-/Import-/Snapshot-/Publish-/Runtime-/Gateway-E2E-Abnahme abschließen. Der bisherige Python-Fixture-Slice ist kein universeller Development-Swarm-Nachweis.
Keine neue Engine oder allgemeine Freigabeschleife. Tatsächliche Registry-/Tokenrotations-/verschlüsselte Backupvoraussetzungen über zulässigen vorhandenen Weg abarbeiten; keine Umgehung und keine Secretwerte ausgeben.

## Frühere Aufträge — Herkunft und weiterhin geltende Detailverträge

# Aktuell: Update zuerst, danach aXtn vLLM Swarm Selector — 16.10.2026 15:26 Europe/Berlin

Maßgeblich ist die jüngste UPDATE-FIRST-Fortsetzung am Ende des vollständigen Auftrags:
handoffs/requests/AXTN-LLMHUB-NATIVE-AGENT-GATEWAY-20261016.md

Zuerst AgentSwarms auf verifizierter Git-Basis gegen v1.6.0@70c295f17af39c81b1a4b56e6552307f5d91eef3 aktualisieren, validieren und über bestehende Host-Release-Verträge in Betrieb nehmen. Dann erst die benannte aXtn-Erweiterung auf neuer Basis prüfen/entwickeln. Alte Selector-Patches erhalten, aber nicht ungeprüft als native Updatebestandteile übernehmen. Bereits akzeptierte aXtn-Funktionen und historische Migrationen erhalten. Kein blindes moving-main-Update, keine neue Orchestrierung.

Produkt-/Wartungsabgrenzung: docs/architecture/axtn-vllm-swarm-selector.md.
Source-Audit: handoffs/reports/AXTN-NATIVE-GATEWAY-PARITY-AUDIT-20261016.md.

Die bloße Update-Prüfung im vorigen Addendum ist durch die ausdrückliche Nutzerentscheidung zur Update-Umsetzung ersetzt. Echte Credential-/Backupvoraussetzungen bleiben unverändert; keine allgemeine erneute Update-Freigabe verlangen.

## Frühere Auftragsstände — nur soweit nicht durch die jüngste Fortsetzung ersetzt

# Maßgebliche Nutzerpräzisierung — 16.10.2026, 11:19

Native Benutzer-/Gruppen-IAM bestimmt Modellzugriff. Agent-Opt-in bestimmt den nativen Gateway-Weg, route_all=false. Case, Account und Kostenträger sind keine zusätzliche Modell-/Gateway-Berechtigung und wählen keine andere Credential-Identität. Der native Ausführungsbenutzer bleibt serverseitig authentifiziert; Cases bleiben fachlicher Träger/Evidence.

Vollständiger aktueller Auftrag:
handoffs/requests/AXTN-LLMHUB-NATIVE-AGENT-GATEWAY-20261016.md

Die frühere aXtn-Case-/Payer-Sonderarchitektur und der pauschale Case-Gateway-Ausschluss werden nicht als Nutzeranforderungen fortgeführt. Native Integrations-/IAM-/Budget-/Credential-Prüfungen bleiben; keine Schutzprüfungen blind entfernen und keine neue Policyengine bauen. Frühere direkte-vLLM-Zielangaben sind überholt, konfigurierte vLLM-Verbindung erhalten.

## Vorheriger Handoff zur Herkunft und Umsetzungshistorie

# Aktueller Auftrag — natives LLM Gateway je Agent

Nutzerziel bestätigt 16.10.2026, 11:15 Europe/Berlin:
LLMHub über vorhandenes natives LLM Gateway, Opt-in je Agent, route_all=false. Direkte vLLM-Verbindung ist nicht der gewünschte Zielpfad.

Aktuellen vollständigen Auftrag lesen:
handoffs/requests/AXTN-LLMHUB-NATIVE-AGENT-GATEWAY-20261016.md

Ältere direkte-vLLM-Zielvorgaben und pauschale Case-Gateway-Sperre sind damit nicht als Nutzeranforderungen fortzuführen. Native Gateway-Funktionen plus bestehende Case-/IAM-/Attempt-/Budgetverträge korrekt zusammenführen; keine bloße Guard-Löschung, keine neue Engine/Custom-Architektur. Native Fähigkeiten/kompatible Source-Nachfolger zuerst prüfen.

## Vorherige Umsetzung und Evidenz

# Aktuelle Ausführungsautorisierung — 16.10.2026, 01:28 Europe/Berlin

Aktuellen vollständigen Request lesen:
handoffs/requests/AXTN-DEVSWARM-OWNER-LLMHUB-20261016.md

Die Fortsetzungen am Ende sind verbindlich: Owner autorisiert die konkrete getestete additive Owner-Policy live und die eng begrenzte automatisierte Test-Approval für Run f615d338 / Approval 7aa0dcb3 / Candidate 67a3a681. Keine erneute allgemeine Freigabeanforderung. Native Guards/RPC, echte Identität und explizite TEST_SIMULATION-Evidence erhalten; keine persönliche manuelle Acceptance behaupten. Auftrag bis zum tatsächlich lauffähigen Ergebnis fortsetzen, echte technische Grenzen konkret beheben/benennen. Frühere allgemeine Live-Policy-Gates und Warten auf den Inbox-Klick sind für diesen exakten Test durch die spätere ausdrückliche Nutzerautorisierung ersetzt.

## Vorheriger Handoff-Stand zur Einordnung

# Development-Schwarm — aktueller Ausführungshandoff

Repository: aXtn/aXtn-agentswarms
Tracking: Issue #7
Handoff branch: work/AXTN-DEVSWARM-OWNER-LLMHUB-20261016
Status: IMPLEMENTATION_AND_VALIDATION_AUTHORIZED / LIVE_POLICY_CHANGE_GATED

Vollständig lesen und im angegebenen Scope umsetzen:
handoffs/requests/AXTN-DEVSWARM-OWNER-LLMHUB-20261016.md

Der vorhandene Slice ist veröffentlicht und acceptance-v2 steht PASS_TO_APPROVAL/SUSPENDED. Keine weitere allgemeine Python-Testphase. Nächste Arbeit: native Approval-Korrektur als getesteter Review-Kandidat, vorhandene Corporate-LLMHub-/Case-Route und deren Release-/Konfigurationsnachweis.

Erst AGENTS.md, Quellen und vollständigen Request lesen. Dieser Handoff enthält einen additiven SQL-Review-Kandidaten, keine Live-Policyfreigabe. Aktuelle Implementierungslinie verifizieren, nur Taskdokumente/SQL gezielt übernehmen. Alte Runs und Approvals erhalten. Rollen-/Native-first-/Case- und Effect-Grenzen stehen vollständig im Request.

Historische Basisaufträge: handoffs/requests/AXTN-DEVELOPMENT-SWARM-NATIVE-0002.md und handoffs/requests/AXTN-DEVSWARM-SLICE1-ACCEPTANCE-20261015.md samt Bericht. Frühere Login-/Publication-/Tasktext-Blocker sind laut Evidence 0304f453 gelöst. Owner-Policy und Corporate-Modell-/Release-Nachweis sind weiter offen.
