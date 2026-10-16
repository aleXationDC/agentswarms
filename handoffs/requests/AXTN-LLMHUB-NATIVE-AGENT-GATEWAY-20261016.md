# AXTN-LLMHUB-NATIVE-AGENT-GATEWAY-20261016

Status: USER_CONFIRMED_TARGET / NATIVE_FIT_AND_IMPLEMENTATION.
Nutzerentscheidung 16.10.2026, 11:15 Europe/Berlin: Corporate-LLMHub wird über die vorhandene native Integrationsfunktion LLM Gateway angebunden und je Agent durch „Route through gateway“ gewählt. „Route All LLM traffic“ bleibt false. Die zusätzlich konfigurierte direkte vLLM-Verbindung ist NICHT der gewünschte Integrationsweg.

## Ziel und korrigierte Abgrenzung

Der vorhandene native Gateway-Konfigurations-/Agent-/Snapshot-/Discovery-/Transportpfad soll auch in der Development-Swarm-Ausführung und im vorhandenen SupaCase-Kontext funktionieren. Kein neues Gateway, kein neuer Provider/Transport, keine eigene Routing-/Credential-/Case-Engine.
Die ältere Festlegung „Corporate = direkter vLLM-llm_provider“ und der pauschale Ausschluss sämtlicher Case-Gateway-Aufrufe sind durch dieses bestätigte Ziel ersetzt. Native Benutzer-/Gruppen-IAM ist die Modellautorität. Ein Case ist fachlicher Vorgang und Nachweis; er schafft keine zweite Modell-/Gateway-Berechtigung.
Die direkte vLLM-Verbindung unverändert erhalten; nicht löschen/deaktivieren und nicht als versteckten Fallback verwenden. Der Nutzer hat sie zusätzlich konfiguriert, nicht zur Zielroute bestimmt.

## Verbindliche Architekturpräzisierung des Nutzers — 16.10.2026, 11:19

Diese Präzisierung hat Vorrang vor allen älteren Case-/Payer-Routing-Anforderungen und vor widersprechenden Formulierungen dieses Requests:

- Der in AgentSwarms nativ authentifizierte bzw. für den nativen Run tatsächlich autorisierte Ausführungsbenutzer darf die Modelle verwenden, die ihm persönlich oder durch seine aktuellen Gruppen freigegeben sind. Native IAM-, Credential-, Modellfähigkeits- und Budgetregeln bleiben maßgeblich.
- Die native Agent-Einstellung bestimmt den gewünschten Gateway-Weg; Opt-in je Agent, global route_all=false.
- Case, Account, Kunde, Kostenträger, Case-Custody und semantische Route sind KEINE zusätzliche Quelle für Modellfreigabe und KEIN Grund für abweichende Provider-/Gateway-/Credential-Identität. Ein Case kann eine fehlende IAM-Freigabe weder ersetzen noch einen nativ erlaubten Gateway-Aufruf pauschal verbieten.
- Case-ID/Run/Attempt dienen weiterhin fachlicher Zuordnung, Lifecycle und Evidence. Kosten können dort dokumentiert werden; Kostenzuordnung bestimmt nicht die Berechtigung oder den Connector. Native Benutzer-/Gruppenbudgets bleiben unabhängig davon wirksam.
- Native Authentifizierung/Run-Identität serverseitig aus den bestehenden vertrauenswürdigen Mechanismen ableiten; keine caller-injizierten user_id-/Credential-IDs und keine Identitätsübernahme aus dem Case.
- Bestehende persönliche Credentials werden dadurch nicht implizit mit anderen Benutzern geteilt. Es gelten die vorhandenen nativen Owner-/Group-/Integrationsregeln für denselben Ausführungsbenutzer.
- Derselbe berechtigte Benutzer und dieselbe Agent-/Modellkonfiguration müssen mit und ohne Case-Zuordnung denselben Provider-/Gateway-Pfad und dieselbe Zugriffsentscheidung erhalten. Änderungen an Case-Account/Kostenträger dürfen diese Entscheidung nicht verändern. Ein anderer Benutzer oder geänderte IAM-Mitgliedschaft muss regulär neu geprüft werden.
- Dies ist die ausdrückliche Nutzerkorrektur der früheren Case-Routing-Sonderarchitektur. Das ältere „ARCHITECTURE_LOCKED“-Label ist kein Grund, die neue Anforderung mit ROUTING_DECISION_REQUIRED abzuweisen.
- Vorhandene Case-/Attempt-Historie erhalten. Nicht wahllos Cases, Tabellen oder frühere Migrationen löschen. Die native Inferenz-/Credential-Auflösung gezielt vom ungewünschten Case-Entitlement-/Payer-Override entkoppeln; tatsächlich andere Abhängigkeiten als konkrete Auswirkungen dokumentieren. Keine Ersatz-Policyengine oder neue Architektur erfinden.
- Tests verpflichtend: gleiche Native-IAM-/Agentkonfiguration mit/ohne Case und mit unterschiedlichem Account/Kostenträger → gleicher effektiver Gateway-/Modellweg; unberechtigter Benutzer bleibt gesperrt. Kein stiller direkter Provider-Fallback.

## Verbindliche Trennung — persönliche ChatGPT-Verbindung vs. Standardintegrationen

Zusätzliche Nutzerpräzisierung 16.10.2026, 11:21:
Die besondere persönliche Accountzuordnung wurde für den ChatGPT-Account-/Abo-Zugang (axtn_chatgpt_plan / entsprechende ChatGPT-Accountintegration) benötigt. Diese Ausnahme folgt dessen besonderen Account-/Autorisierungsvorgaben. Sie ist KEIN allgemeines Ausführungs-/Credential-Modell für sämtliche Standardintegrationen.

Für normale native LLM-/API-/Unternehmensintegrationen einschließlich LLM Gateway und Corporate-LLMHub:
- vorhandene native Integrations-/Benutzer-/Gruppen-/Modellrechte verwenden;
- keine neue Case-/Payer-Klassifizierung SYSTEM_INTEGRATION/PERSONAL_CONNECTION als Voraussetzung oder alternative Modellberechtigung erzwingen;
- keine zusätzliche persönliche Konto-/Firmen-/Accountzuordnung verlangen, nur weil ein Case existiert;
- keine persönliche ChatGPT-Accountbindung auf Unternehmens-API-Keys oder das native Gateway übertragen;
- weiterhin reale native Authentifizierung, effektive bestehende Integrationsberechtigung, aktive Verbindung, native Modell-IAM und Budget prüfen. Dies gibt keine frei nutzbaren fremden Credentials frei.

Für ChatGPT-Account-/Abo-Zugang:
- persönliche verifizierte Accountbindung und dessen besondere nichtteilbare Credential-/Berechtigungsverträge unverändert erhalten;
- keine Unternehmens-/Gruppenfreigabe als Ersatz für diesen persönlichen Account erlauben;
- die Ausnahme im nativen zugehörigen Provider-/Accountpfad belassen, nicht auf Standard-Gateway-/Provideraufrufe verallgemeinern.

Regression verpflichtend: Corporate-Gateway-Aufruf mit und ohne Case unabhängig von Personal-Connection-Class/Case-Kostenträger und ohne persönliche ChatGPT-Verbindung möglich, sofern native IAM/Integration zulässig; ChatGPT-Accountzugang bleibt korrekt persönlich gebunden. Keine Keys/Tokens lesen oder solche Regeln für einen Test abschalten.

## Rollen und Autorität

ChatGPT ist Solution Architect/Implementation Engineer, CLI Programmierer/Umsetzer. Native capability > standard > reuse > configure > integrate > custom build. Bestehende native Funktionen zuerst vollständig nutzen und vergleichen. Kein Custom-Ansatz, Codeabkürzung, Controller, zusätzliche Stage oder alternative Architektur ohne spezifische ausdrückliche Freigabe. Normale native Verdrahtung und Bugfixes im genannten Vertrag sind erlaubt. Eine echte darüber hinausgehende native Lücke konkret belegen und kleinsten fertigen Änderungsvorschlag vorlegen; unabhängige Arbeiten weiterführen.

Vorhandene Autorisierung zur zielgebundenen Implementierung/Live-Fortsetzung verwenden. Keine neue allgemeine Freigabeschleife. Geschützte Branches, konkrete Release-/Provenienz-/Credential-Grenzen einhalten, keine eigenmächtige Rechte-/Token-Erweiterung. Keine Secrets in Repository, Logs, Cases, Prompts oder Clientantworten.

## Quellen und belegter Fehler

Aktuelle kanonische Projektsteuerung in aXtn/aXtn-architecture: PROJECT.yaml, Projektvertrag, knowledge/README.md und relevante Entscheidungen lesen.
Komponente aXtn/aXtn-agentswarms: AGENTS.md; vollständige vorhandene NATIVE-0002-/SLICE1-/OWNER-LLMHUB-Aufträge und Berichte, insbesondere erfolgreicher E2E-Bericht 36a681d74fd3cd93802622b4ce577ba0e0bfade2. Dieser Auftrag ist die neue Zielkorrektur; ältere direkte-vLLM-Zielangaben nicht weiter als bindend behandeln.

Quellen bei e42a771089cf30ed2bd895cf956a40095adc1cec:
- src/routes/api/chat.ts: explizite Case+routeThroughGateway- sowie Case+gatewayOverride-Verbote (ROUTING_DECISION_REQUIRED), Gateway-Resolver nur für !caseExecution.
- src/axtn/workbenches/cases/caseExecution.server.ts: servergebundene Credential-/Attempt-Regeln, direkte llm_provider-Auswahl.
- src/utils/providers/credentials.server.ts: vorhandener nativer llm_gateway-Resolver, bestehender GatewayOverride und OpenAI-kompatibler Transport. Gateway ersetzt im nativen Transport die Provider-Credentials; keine zusätzliche direkte vLLM-Verbindung als Voraussetzung.
- src/lib/agentToSwarmNode.ts: am geprüften Stand wird routeThroughGateway noch als dropped gemeldet. Neuere akzeptierte Gateway-Fixes/Nachfolger gezielt erhalten statt alte Datei zurückzusetzen.
- docs/AI_GATEWAY.md: outbound native Gateway-Konfiguration; inbound /api/v1 ist ein anderer Zugangsweg, kein Ersatz für diese Aufgabe.
- Native Gateway-Snapshot-/Agent-/Node-Inspector-/Model-Discovery-/Canvas-/Headless-Tests und aktuelle ausführbare Implementierung abgleichen.

Herkunftsbeleg bei c05d74230ffae1db67538ebfa038e585693996a5:
docs/llmhub-prod-lineage-acceptance-20261009.md, Abschnitte Native transfer und Case-bound routing, dokumentiert bewusstes Verbot des Case-Gateway-Pfads. Dies ist aXtn-Implementierungshistorie, keine belegte Nutzeranforderung und kein Beleg einer grundsätzlichen nativen AgentSwarms-Grenze.
Live eb191e15 enthält bereits eine Case/Gateway-Sperre. Nicht behaupten, alle Sperren seien erst durch den noch nicht deployten PR #32 entstanden.

## Konkreter Lösungsrahmen

1. Vorhandenen nativen Non-Case-Gateway-Pfad als Referenz vollständig verfolgen: gespeicherte Agent-Einstellung tools.routeThroughGateway, Agent-Version/Snapshot, Canvas/Headless-Payload, /api/chat, Gateway-Resolver, native Model Discovery, Toolloop/Streaming. Effektiven aktuellen Source inkl. kompatibler PR-Nachfolger prüfen. Nicht nur zwei throw-Zeilen löschen.
2. Opt-in muss in nativen Agent-Versionen/Snapshots und Node-Konfiguration verlustfrei erhalten bleiben. Bestehende neuere native Gateway-Importer-/Executor-Fixes wiederverwenden. Fehlendes Opt-in nicht als true interpretieren. Neue Agent-Einstellung nicht still auf alte published Snapshots/parked Runs übertragen; neue Version über vorhandenen nativen Publish-Lifecycle.
3. Unter Beachtung der vorrangigen Nutzerpräzisierung: Für Case-Aufrufe Gateway-Intent aus der bestehenden vertrauenswürdigen persistierten Agent-/Node-/Run-Konfiguration ableiten, nicht aus frei eingespeisten Credential-/Owner-/Gateway-IDs. Der vorhandene native vertrauenswürdige Ausführungsbenutzer und dessen IAM-/Modell-/Budgetregeln gelten; keine aus Case-Custody/Kostenträger neu abgeleitete Credential-Identität. Case-/Attempt-Bindung bleibt Nachweis und Idempotenzzuordnung.
4. Bestehende llm_gateway-Integration und deren vorhandene verschlüsselte Secret-Auflösung verwenden. Gateway-Autorisierung durch bestehende Eigentums-/effektive native Integrationsfreigaben und serverseitigen Policy-Kontext prüfen; UI-„Connected“ ist kein Freigabeersatz. Fremde persönliche Gateway-Verbindungen nicht durch Case-Custody/Initiator-Rechte substituieren. Die historische SYSTEM_INTEGRATION/PERSONAL_CONNECTION-Trennung darf keine zusätzliche Inferenz-/Gateway-Zugriffsschranke bilden; maßgeblich ist die obige Nutzerpräzisierung. Wenn bestehender nativer Gateway-Resolver nur Owner-Scope kann, diesen korrekt zum zulässigen Case-Policy-Nutzer auflösen; keine implizite globale Sharing-Regel einführen. Erforderliche echte zusätzliche Sharing-Semantik ist ein eng begrenzter Entscheidungspunkt, kein Anlass zum direkten-vLLM-Ersatz.
5. Der Case-Resolver darf vor dem Gateway-Transport nicht eine unbenötigte direkte Provider-Verbindung erzwingen. Native Gateway-Verbindung muss als tatsächlich gewählter Transport in bestehendem Case-/Run-/Attempt-Binding und Evidence belegbar sein; keine Secretwerte darin. Vorhandene Binding-/Integrationsreferenzen bzw. JSON-Verträge minimal wiederverwenden; keine neue Policytabelle/Engine.
6. Nur bei Opt-in=true über Gateway routen. Für Opt-in=false bestehende Providerroute unverändert, globale Konfiguration route_all=false erhalten. Gateway-Fehler bei explizitem Opt-in fail-closed ausweisen; kein stiller direkter vLLM/OpenAI-Fallback. Deterministische/Human-Schritte brauchen keine Provider-Credentials.
7. Model Discovery über den effektiven Gateway-Pfad ausführen, echte Modell-IDs und Fähigkeiten verwenden. Exakte IDs ohne unbelegte Präfix-Umschreibung speichern. Native IAM-Modellfreigaben auf tatsächlich verwendete logische Provider/Model-ID beziehen und Ergebnis sichtbar darstellen. Nicht voraussetzen, dass alle verfügbaren Modelle zulässig sind.
8. Vorhandene Developer-Rollen gezielt über native Agent-/Node-Einstellungen aktivieren und neue immutable Swarm-Version publizieren, sobald getestete kompatible Source und zulässige reale Gateway-Konfiguration bereitstehen. Keine neuen Rollen/Stages; keine globale Provider-/Modellumschaltung anderer Swarms. Rollenmodelle anhand tatsächlicher Discovery und bounded JSON-/Rollenmessung konkretisieren; nicht vorher erraten. Fehlende konkrete Modellentscheidung als eine fertige gemessene Empfehlung vorlegen, unabhängige Umsetzung weiterführen.
9. Bestehende Case-Lineage weiterverwenden, falls eigenständige Gateway-Implementierungsarbeit einen Child benötigt, idempotent unter bestehendem Development-Parent anlegen. Erfolgreiche Fixture-Cases und historische Fehler/Approvals erhalten. Keine Case-Rematerialisierung um eine Sperre zu umgehen.
10. Release-Fortsetzung über vorhandene Host-Authority/PR-Linie. Aktuelle bereits live angewendete Migrationen 20261016000000/010000/020000 in Source-/Ledger-/Rollback-Kompatibilität erhalten. Registry-Scope/PAT-Rotation und Backup-Recipient bleiben getrennte echte technische Voraussetzungen; keine lokale Image-/Backup-Policy umgehen und keine Schlüssel erzeugen/erweitern.

## Konkrete Abnahme

A. Zwei echte native Agent-Konfigurationen mit global route_all=false:
- Agent A: routeThroughGateway=true → Gateway-Discovery/Inferenz nachweislich am eingerichteten LLMHub.
- Agent B: false → bisheriger Providerweg unverändert; Gateway nicht aufgerufen.

B. A nach nativer Snapshot-Publikation auf Canvas UND headless:
- Flag/Modell/Restriktionen bleiben identisch;
- Case-gebundener Aufruf erreicht autorisiert das vorhandene Gateway und nicht den direkten vLLM-Connector;
- Case-/Attempt-/Node-/Provider-/Modell-/Gateway-Trace und Budget bleiben nachvollziehbar.
- Kein ungefragter Credentialbesitzwechsel, kein Route-All und keine globale Snapshotänderung.

C. Negative Tests:
- fehlende/inaktive/mehrdeutige/unberechtigte Gateway-Verbindung;
- widerrufene relevante IAM-/Modellfreigabe;
- manipulierte Run-/Node-/Case-/Principal-/Credential-ID;
- fehlender Snapshot-Intent, fremder Gateway-Owner, stale Attempt;
- abgelehnt ohne Provider-Fallback, Secret-Ausgabe oder fingierten Erfolg.
- Non-Case native Gateway-Funktion, normale Providerpfade, DMS und bestehende Work-/Approval-/Receipt-Guards regressionsfrei.

D. Ein tatsächlicher autorisierter Corporate-Case-/Swarm-Lauf über native Agent-Opt-ins bis vollständigem Resultat. Vorhandenes synthetisches Testziel und gekennzeichnete Test-Approval-Delegation nutzen, keine persönlichen Owner-/Produktivabnahmen fingieren. E2E-Erfolg, PR-Head/Readback, Idempotenz und Runtime-Durability gezielt nach veränderten Komponenten prüfen; vorhandenen erfolgreichen OpenAI-Test nicht als Gateway-Nachweis umdeuten.

## Arbeitsbranch und Lieferung

Sauberes taskbezogenes Worktree auf aktueller kompatibler Linie, z.B. work/AXTN-LLMHUB-NATIVE-AGENT-GATEWAY-20261016. Kein Deployment einer alten Main-/Handoff-Basis, keine fremden Worktrees ändern.
Bericht: handoffs/reports/AXTN-LLMHUB-NATIVE-AGENT-GATEWAY-20261016.md.
Ergebnis: genaue Ursache/Source-Diff, native Wiederverwendung, nötige minimale Vertragsergänzung, exakte SHAs/Images/Ledger/Version/Snapshots, tatsächlich ausgeführte Tests und reale Gateway-Route, Cases/Runs/Receipts/PR, verbleibende konkrete Schritte. Source-IMPLEMENTED, TESTED, DEPLOYED und Corporate-E2E getrennt.
Keine neue allgemeine Planungs-/Freigabeschleife. Ein ungeprüftes Dokument ist keine Umsetzung; echte zusätzliche Sicherheitsarchitektur jenseits dieses Rahmens nicht still einführen.

## Stand dieser Übergabe

Nutzerziel und native Implementierungsgrenzen sind präzisiert. Repository-Auftragsarbeit, keine Live-/Credential-/Routingänderung durch diese ChatGPT-Sitzung.
