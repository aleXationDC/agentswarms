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

## Verbindliche Restarbeit nach Teilabschluss 47beb751 — 16.10.2026, 12:33

Quellenstand vollständig geprüft: Implementierungshead 47beb751349014480f239092528dedc9d1c73029; technischer Bericht 33497c2aa535aff4d37d012013ffe26024ecc346. Kein weiterer allgemeiner Freigabestopp. Bestehenden autorisierten nativen Umsetzungsauftrag im selben Taskworktree abschließen. Live-Migration allein ist kein vollständiger Funktions-/Security-Nachweis.

### 1. Noch verbliebene falsche Case-/Payer-Ableitung korrigieren

Der neue SQL-Block ersetzt Credential-Suche durch Gateway-Suche, verändert jedoch die bestehende Actor-/Binding-Auswahl nicht. Referenz: supabase/migrations/20261005210000_case_execution_binding.sql:
- personal wird aus binding.execution_class bzw. Case.semantic_route_mode abgeleitet;
- actor wird aus Case.assignee_user_id bzw. custodian abgeleitet;
- provider/model werden aus Case.semantic_route_provider_id/model_id bzw. bereits gebundener Case-Route vor Node-Konfiguration bevorzugt;
- policy_user_id und ggf. responsible-group budget werden aus dieser Ableitung persistiert.
Neue Migration 20261016030000 ersetzt nur den Credential-Kandidatenblock und die Transport-Evidence.
src/routes/api/chat.ts verwendet weiterhin caseExecution.binding.policy_user_id für IAM/Gateway und getCaseBudgetDecision für Case-Aufrufe.

Das ist NICHT automatisch die neue gewünschte native Benutzer-IAM-Semantik. Kein Satz „der Case liefert nur policy_user“ als Beweis der Entkopplung. Mit aktiver Live-Funktionsdefinition/Nachfolgemigrationen abgleichen und die Abweichung konkret schließen:

- Für Standard-LLM-/API-/Gateway-Aufrufe exakt dieselbe authentifizierte/vertrauenswürdig autorisierte native Ausführungsidentität wie im äquivalenten Non-Case-Lauf verwenden. Browser: echte Session; Headless: tatsächlich validierter nativer Run-/API-Key-Owner gemäß unverändertem Authvertrag. Keine Identität aus Case-Custody/Assignee/Account/Payer an ihre Stelle setzen und keine Caller-user_id vertrauen.
- Case-/Datenzugriffsberechtigung bleibt separat voll wirksam. Case-Sichtbarkeit/Datenscope niemals aus Modellfreigabe ableiten oder umgekehrt.
- Standard-Modell-/Provider-/Gateway-Wahl aus der vorhandenen autorisierten Agent-/Node-/Snapshot-Konfiguration; keine Case-semantic-route-Felder als zweite Entitlement-/Credential-Steuerung. Native Benutzer-/Gruppen-Modellregeln und native Budgets auf derselben Ausführungsidentität wie ohne Case prüfen.
- Persönliche ChatGPT-Account-/Abo-Ausnahme nur im passenden axtn_chatgpt_plan-/Accountpfad erhalten. SYSTEM_INTEGRATION/PERSONAL_CONNECTION nicht weiterhin für jede normale API-/Gateway-Verbindung als Sondervorbedingung verwenden.
- Historische Case-/Attempt-/Budget-/Trace-/Snapshotdaten unverändert erhalten; keine aktiven Attempts nachträglich umhängen. Fehlermeldung/Versionierung nutzen, falls ein alter gebundener Attempt widersprechende Semantik trägt; neue korrekte Test-Attempts gezielt erstellen.
- Im bestehenden nativen Auth-/IAM-/Gateway-/Case-Vertrag minimal korrigieren, keine Ersatz-Policy-/Routingengine. Notwendige additive Migration an neuem Timestamp erstellen; bereits live angewendete 20261016030000 nicht umschreiben.

### 2. Abnahme der Benutzeridentität — Pflicht vor Deployment

Isolierte SQL-/App-Verhaltenstests mit zwei realistisch getrennten Testnutzern A/B, unterschiedlichen Modellregeln und Integrationsberechtigungen:
- Benutzer A + gleiche Agentkonfiguration, mit/ohne Case → gleicher Model-IAM-/Gateway-/Budgetentscheid.
- Case-Custodian B, Responsible/Assignee B, anderer Kunde/Account/Kostenträger oder Case.semantic_route_mode/provider/model ändern nicht A's native Modell-/Gatewayidentität.
- A ohne Modellrecht wird trotz Rechte von B/Case-Owner abgelehnt; A mit Recht wird nicht allein wegen fehlender Rechte beim Case-Owner abgelehnt, solange A regulär auf den Case zugreifen darf.
- fehlender Case-Datenzugriff bleibt unabhängig davon gesperrt.
- Headless/Canvas verwenden denselben tatsächlich autorisierten Benutzer und immutable Opt-in.
- Persönliche ChatGPT-Accountzuordnung bleibt eingeschränkt; Standard-Unternehmensgateway braucht keine persönliche ChatGPT-Verbindung.
Nicht nur Intent-Booleans testen; aktueller caseGatewayIntent-Test prüft lediglich die Flag-Extraktion und belegt keine Identity-/IAM-Parität.

### 3. Fehlende Prüfungen jetzt ausführen

- SQL-Negativtests gegen tatsächlich gebundene synthetische Case-Runs: inaktiv/fehlend/mehrdeutig/fremder Gateway-Owner bzw. unwirksame native Integrationsrechte, Modell-IAM verweigert, Body/Snapshot-Drift. Kein Providercall/kein Fallback/keine Secret-Ausgabe bei Ablehnung.
- lint, normale Source-/Typecheck-/Build-Generierung einschließlich benötigter routeTree.gen und einschlägiges test:integration ausführen. Fehlende generierte Dateien mit vorhandenem Buildprozess erzeugen; keinen Typecheck-Fehler pauschal als PASS deklarieren.
- Canvas-/Headless-Parität (Abnahme B) auf geeignet isolierter Testinstanz/Fixture oder regulär geprüftem Kandidaten belegen. Registry-Publish ist keine Voraussetzung für alle isolierten Source-/DB-/Executorprüfungen. Wirklich liveabhängige Teile nach regulärem Deployment nachholen, aber vor Release nicht alle SQL-Negativtests verschieben.
- Beide Full-Suite-Baselinefehler mit exakter Basis/Suite/Fehlernachweis dispositionieren. Bericht widerspricht der jüngeren User-Zusammenfassung zum ausgeführten Basisvergleich; Nachweis anhand tatsächlich gespeicherter Ergebnisse aktualisieren, keinen Lauf erfinden.
- docs/engineering/02-agent-runtime.md auf geltendes Ziel korrigieren. Historischen Bericht docs/llmhub-prod-lineage-acceptance-20261009.md nicht fälschlich als heutige Beschreibung belassen: prominent als superseded kennzeichnen und auf aktuellen Request/Architektur/Ergebnis verweisen, historische damalige Evidence nicht umschreiben.

### 4. Gateway-Key kontrolliert verifizieren — kein erfundener menschlicher Blocker

Nutzer hat die Verbindung erneuert und bestätigt, den Key unter vLLM zusätzlich eingegeben zu haben; Gateway ist auf der nativen UI aktiviert, route_all=false. Der direkte vLLM-Key-Fehler beweist KEINEN Fehler des Gateway-Keys.

- Genau den konfigurierten llm_gateway-Pfad durch vorhandene native Validate/Discovery-/Chat-Funktion mit autorisiertem Benutzer kontrolliert prüfen. Secret intern durch bestehenden verschlüsselten Resolver nutzen lassen; „Keys nicht lesen“ bedeutet nicht, dass die App den Key nicht regulär verwenden darf.
- Kein Auslesen/Loggen/Export von Credentialwerten und kein Ersetzen durch direkte vLLM-Verbindung.
- Auf dem noch alten Live-Code kann die bestehende native Non-Case-Validierung/Discovery die Gateway-Authentifizierung prüfen; der neue Case-Code muss dafür nicht schon deployed sein. Ergebnis status-/metadatenbasiert belegen.
- Bei erfolgreicher Auth native Discovery und bounded JSON-/Rollenmessung durchführen, exakte IDs verwenden und keine ungeprüfte Modellbelegung als beschlossen darstellen.
- Nur bei tatsächlich aktuellem Gateway-401/deactivated den exakten Integrationsnamen und vorhandenen sicheren UI-Aktualisierungsschritt als menschlichen Blocker melden. Nicht vorsorglich eine erneute LLMHub-Key-Ausstellung verlangen.

### 5. Release und echte Blocker sauber abschließen

Nach bestandenen Prüfungen kompatiblen kumulativen Source-/Image-/SQL-Kandidaten bauen und bestehende Host-Release-Linie nutzen. Registry-PAT-write:package bleibt echte Credentialgrenze; keine eigenen Token/Grants erweitern, kein lokales Image am Provenienzvertrag vorbei releasen. Unabhängige Tests/Gatewayvalidierung/Docs fertigstellen.
Token wurde laut früherem Bericht im Tool-Log ausgegeben: keine weiteren Logs mit Secrets lesen/ausgeben, Rotation/Widerruf des betroffenen Tokens über vorhandenen geschützten Mechanismus als offen oder tatsächlich erledigt dokumentieren. Menschlicher Schritt muss genaues Konto/native UI/Scope/geschützten Zielpfad nennen.
AXTN_BACKUP_RECIPIENT ist ein separates echtes Konfigurationsthema, kein pauschaler Grund, Source-/App-/SQL-Tests oder Gatewayauth auszulassen. Verschlüsselungspflicht vor neuen geschützten Backup-/Live-Schritten anhand geltendem Host-Vertrag erfüllen; keine unverschlüsselten Dumps exportieren, keinen Recipient erfinden.

Nach regulärem Deployment: nur gezielte neue Agent-/Swarm-Version mit native Gateway-Opt-ins veröffentlichen, route_all=false erhalten, Abnahme A/B/C/D inklusive Corporate-E2E und gekennzeichneter synthetischer Test-Approval ausführen. Erfolgreiche alte OpenAI-Fixture ist weiterhin kein Corporate-Nachweis.

### 6. Bericht und Abschluss

Aktuellen Bericht auf tatsächlichen Head nachführen: Identity-/IAM-Parität, Source-/SQL-/Lint-/Integration-/Canvas-/Headless-Nachweise, Gateway-Keystatus, Discovery, Rollenmessung, Image/Release/Version, Corporate-E2E und echte restliche menschliche Schritte getrennt. Kein „danach Tests“ für unabhängig ausführbare Pflichten und kein Task-complete bei offenem Ziel.
Diese Fortsetzung ist Repository-Auftragsarbeit, kein behaupteter Remote-/Live-Test durch ChatGPT.

## Präziser Abschlussauftrag nach 8227a683 — 16.10.2026, 13:17

Report und SQL 040/050 am Stand 8227a683372ac21dcfb51d9746893b63f9f94bc5 geprüft. Gateway ist authentifiziert und bounded Inferenz grundsätzlich möglich; keine neue Key-Ausstellung als pauschalen Nutzerblocker nennen. Noch keine App-Deployment-/Corporate-E2E-Behauptung.

Die verbindliche Nutzerarchitektur wird NICHT zugunsten alter Tests eingeschränkt. Noch verbliebene Kontraktabweichungen innerhalb des beauftragten nativen Lösungsrahmens abschließen:

1. Persönliche Ausnahme anhand tatsächlichen persönlichen ChatGPT-Account-/Abo-Providers bestimmen, NICHT allein anhand eines generischen Case-Feldes PERSONAL_CONNECTION. Der dokumentierte Randfall „Gateway-Node ohne Case-Assignee → PERSONAL_CONNECTION_REQUIRED“ widerspricht dem ausdrücklich freigegebenen Standardintegrationsziel. Standard-Gateway-/API-Auflösung muss VOR/UNABHÄNGIG von einer persönlichen Case-Assignee-/Group-Claim-Vorbedingung erfolgen. Dafür ist keine neue fachliche Entscheidung nötig. Menschliche-/persönliche ChatGPT-Schutzregeln im passenden Providerpfad unverändert erhalten.
2. Standard-Provider/Modell aus vollständiger autorisierter Node-/Agent-/Snapshot-Konfiguration oder deren vorhandenem nativen Default, niemals Case.semantic_route_provider/model als Sonderfallback. Fehlende/unzulässige Node-Konfiguration gemäß vorhandenem nativem Verhalten behandeln. Positiv-/Negativvergleich mit identischem Non-Case-Aufruf; ein Case darf fehlende Agent-Konfiguration nicht heimlich ersetzen.
3. 050 gibt für Nicht-Gateway-SYSTEM-Knoten die alte policy_user-/Budget-Bindung zurück, obwohl 040 sie teilweise mit p_user_id validiert. Das kann Prüfidentität und an die App zurückgegebene Identität auseinanderziehen. Für ALLE normalen nativen Integrationen konsistent die tatsächliche native Ausführungsidentität, native persönliche/Gruppen-Modellrechte und native Budgets verwenden. Case-Kostenzuordnung darf als Berichtsdimension bleiben, aber keine zusätzliche Company-Funding-Zugriffsschranke oder fremde Credential-Identität wählen. Persönlicher ChatGPT-Provider bleibt die Ausnahme. Keine allgemeine Budgetprüfung abschalten.
4. Den alten SQL-Test, der grant-only-Credentials oder Case-Company-Funding erzwingt, gegen die aktuelle bestätigte Nutzerarchitektur prüfen. Widersprechende Erwartung als überholt aktualisieren und durch entsprechende native IAM-/Integrations-/Budgettests ersetzen; keine überholte Sicherheitsregel oder live nicht angewendete alte Migration nur zum Grünmachen einer alten Suite erzwingen. Vergleichbarer tatsächlich nicht betroffener Baselinefehler darf dokumentiert bleiben. Insbesondere nicht automatisch 20261009113000 anwenden, wenn sie dem akzeptierten owner-or-native-grant-Vertrag widerspricht.
5. Neue Attempts müssen eine zur tatsächlich verwendeten Policy-/Provider-/Gateway-/Budgetidentität konsistente bestehende Binding-/Node-Route-/Trace-Evidence haben. Nur den Rückgabewert zu projizieren, während frische persistierte Evidence andere Identitäten trägt, ist kein sauberer Nachweis. Historische/aktive Bindings nicht rückwirkend umschreiben: vorhandene native Attemptversionierung nutzen, frische korrekte Test-Attempts erstellen und alte Werte als historisch erhalten. Keine neue State-/Policyengine.
6. Zusätzliche gezielte SQL-/App-Regression: gleicher berechtigter Benutzer/Agent mit/ohne Case, Case ohne Assignee, beliebiger Case-Personalmodus bei Standardprovider, andere Case-Route/Account/Kostenträger, Non-Gateway-Standardprovider; Ergebnis muss native IAM-/Provider-/Gatewayidentität bewahren. Native Case-Datenberechtigung bleibt getrennt. Tatsächlichen persönlichen ChatGPT-Aufruf weiter korrekt persönlich binden.
7. Gateway-Attribution belegen: vorliegende 200er sind echte Inferenz, wegen parallel konfiguriertem direktem vLLM noch kein vollständiger Pfadnachweis. Vorhandene native Traces/gatewayRouted-/Transportmetadaten, Integration-ID und isolierte Resolver-Spies nutzen: Opt-in → Gateway-Resolver/Transport, kein direkter Provider-Credential-Load. Keine Gateway-/Provider-Credentials zum Beweis deaktivieren, keine Secretwerte/Tool-Logs oder neue Loggingengine. Native Model-Discovery normal nutzen statt absichtlich falsche Modellnamen als Katalog-API.
8. Qwen3.8-27B-FP8 antwortete im einen Test nicht im verlangten JSON. Diesen gemessenen Befund erhalten, nicht als generelle Modelluntauglichkeit aus einem Sample ableiten. Keine unbelegte Rollenfreigabe; geeignete tatsächlich verfügbare Modelle mit reproduzierbaren Rollen-/JSON-Prüfungen und exakten IDs vorbereiten.
9. Backup-Aussage berichtigen: Zuvor wurde scripts/backup.sh als AXTN_BACKUP_RECIPIENT-pflichtig für jeden Run geprüft. „Kein Export, daher keine Verschlüsselungspflicht“ darf ohne neue verifizierte einschlägige Vertragsquelle nicht behauptet werden. Geltenden Host-Vertrag am exakten Source nennen, vorhandene manuelle Dumps/Dateirechte/Recipient-Status minimiert dokumentieren. Vor nächster backup-pflichtiger Live-Operation vorgeschriebenen sicheren Backupweg erfüllen. Keine Dumpinhalte lesen/exportieren oder Schlüssel erfinden.
10. Fehlende native App-Deployment-/Browser-/Corporate-E2E-Schritte nach bestandenen unabhängigen Prüfungen über die bestehende autorisierte Host-Release-Linie durchführen. Registry-PAT/Rotation ist eine echte noch zu liefernde Berechtigung; keine eigene Rechteerweiterung/Provenienzumgehung. Bis dahin alle oben unabhängigen Korrekturen und Tests fertigstellen. Genau einen ausführbaren geschützten Credential-Schritt liefern, falls er unvermeidbar menschlich bleibt; kein allgemeiner Implementierungs-/Freigabestopp.

Bestehenden Bericht auf tatsächliche Ergebnisse nachführen. Nicht allein wegen einer widersprechenden alten Testassertion neue Nutzerarchitektur zurücknehmen. Keine weitere allgemeine Planungsschleife oder unbelegte neue Stop-Entscheidung. Source-/SQL-/Runtime-Resultate, Gatewaynachweis, Registry und Backup separat ausweisen.

## Vorrangige Fortsetzung — aXtn vLLM Swarm Selector und Update-Prüfung, 16.10.2026 15:25 Europe/Berlin

Nutzer benennt die besprochene eng begrenzte Erweiterung ausdrücklich "aXtn vLLM Swarm Selector" und verlangt saubere Abgrenzung sowie Erhalt der Update-Fähigkeit. Produktvertrag: docs/architecture/axtn-vllm-swarm-selector.md. Native-only-Audit: handoffs/reports/AXTN-NATIVE-GATEWAY-PARITY-AUDIT-20261016.md. Dieser benannte Scope konkretisiert die Nutzerentscheidung nach dem Audit; kein allgemeiner Freibrief für Custom-Code.

ChatGPT bleibt Solution Architect/Implementation Engineer; CLI prüft und bereinigt die bestehende Implementierung als Programmierer innerhalb dieses klaren Rahmens. Keine neue Architektur, kein Ersatz-Controller oder Credential-/Routingengine.

### Jetzt auszuführende Arbeit
1. Zuerst aktuellen Host-/Source-/Branchstand nur über nichtgeheime Metadaten zurücklesen; fremde Worktrees erhalten. Bestehende Lineage/Issue #7 weiterverwenden. Die Fortsetzungsdokumente gezielt in den bestehenden Taskworktree übernehmen, nicht einen älteren Source-Head deployen.
2. Existierende Selector-Änderungen mit Original vergleichen und ein knappes Patchinventar liefern: Pfad, native Ausgangsfunktion, konkrete aXtn-Ergänzung, Grund, Test. Öffentliche Originalbasis beim Audit: 7c95a69974bac08c946aa7130d7aa0ad1d3f0b06.
3. Native Erweiterungsmöglichkeiten tatsächlich prüfen. Die bekannte Custom-Components-Funktion erzeugt Transformations-/function-Knoten und ist kein Nachweis eines geeigneten Editor-/Providerhooks. Keine erfundene Plugin-Garantie. Wenn kein passender Hook existiert, die vorhandenen minimalen Core-Patches ausdrücklich als solche führen.
4. Name exakt aXtn vLLM Swarm Selector in Architektur, Wartungsinventar und Bericht verwenden. Technische Kennungen vllm, llm_gateway, routeThroughGateway nicht umbenennen. Keine neue Provider-Identität "LLMHub" erfinden. UI nur dort klar kennzeichnen, wo es Nutzern die tatsächliche aXtn-Ergänzung erklärt; kein neuer Screen oder dekorative Produktumbau.
5. Bestehende native Modellwahl, vLLM-Provider, Gatewayresolver, IAM, Budget, Snapshot/Publish und Executor wiederverwenden. Persistierte Opt-ins/Modell-IDs, Canvas/headless und Importverhalten gezielt absichern. Direkte vLLM-Auswahl und Gateway-Opt-in getrennt behandeln. route_all=false, keine versteckte direkte Ausweichroute. SupaCase-Identitätsmigrationen als separaten Änderungsbereich inventarisieren.
6. Upgrade-Preflight gegen festen Upstream-Tag v1.6.0@70c295f17af39c81b1a4b56e6552307f5d91eef3: tatsächliche gemeinsame Git-Basis und bereits übernommene Upstream-Änderungen ermitteln; packageVersion=1.5.0 ist kein ausreichender Beleg. Historischen 1.5-Assessmentstand nicht als aktuelle Live-/Git-Basis übernehmen.
7. Ohne Eingriff in bestehende Arbeit den reinen Git-Konfliktumfang, Migrations-Datei-/Ledger-Abstand, Abhängigkeiten und Sicherheits-/Runtime-Verträge prüfen. Das Release-Changelog nennt neun Migrationen gegenüber seiner eigenen Releasebasis; tatsächliche fehlende Migrationen unseres Kandidaten gesondert nachweisen. post-1.6-HEAD-Fixes bis 7c95a699 getrennt bewerten, kein moving-main-Upgrade.
8. Ergebnis als konkrete Update-Empfehlung liefern: v1.6 vor Selector-Release sinnvoll oder getrennt nachziehen; echte Konflikte, betroffene aXtn-Patches, erforderliche Checks/Restore und Aufwand nennen. Falls native gleichwertige Unterstützung gefunden wird, überflüssige Patchteile zur Ablösung markieren.
9. Quellenprüfung und Vergleich fortsetzen, auch wenn Registry-/Backupvoraussetzungen offen bleiben. Keine Secretwerte, credentialhaltigen Logs oder Dumps lesen/ausgeben. Für Merge-/Migrationsproben nur bei Bedarf geeignet isolierte bestehende Umgebung nutzen, kein zweites dauerhaftes Fullstack-System.
10. Bericht handoffs/reports/AXTN-VLLM-SWARM-SELECTOR-UPDATE-PREFLIGHT-20261016.md mit exakten SHAs und wirklich ausgeführten Checks schreiben. Noch kein Upstream-Upgrade mergen, keine Live-Migration/Deployment oder Upstream-PR aufgrund dieses Prüfauftrags. Vorhandene allgemeine Release-Autorität nicht auf einen ungeprüften größeren Versionssprung ausdehnen.

Die ältere Behauptung "Gateway am Agenten aktivieren und nativ neu importieren genügt" ist widerlegt: Original-Import verwirft das Flag. Bestehende Selector-Ergänzungen sind aXtn-Patches, nicht unveränderter Standard. Dieses Addendum ist der gezielte nächste Arbeitsauftrag; keine Wiederholung erledigter großer Suites ohne neue Änderung/konkreten Grund.

## Maßgebliche Reihenfolge — UPDATE FIRST, Nutzerentscheidung 16.10.2026 15:26 Europe/Berlin

Diese jüngste Entscheidung ersetzt die Einschränkung des vorigen Addendums auf bloße Update-Prüfung. Nutzer zieht ausdrücklich vor, ZUERST AgentSwarms zu aktualisieren und ERST DANACH darauf basierend aXtn vLLM Swarm Selector zu entwickeln.

### Arbeitspaket 1: Upstream-Update umsetzen
- Ziel fest pinnen: AgentSwarms v1.6.0@70c295f17af39c81b1a4b56e6552307f5d91eef3. Öffentliches main@7c95a69974bac08c946aa7130d7aa0ad1d3f0b06 ist nach dem Release; zusätzliche Sicherheits-/Fehlerfixes anhand konkreter Relevanz bewerten und gegebenenfalls separat begründet aufnehmen, nicht pauschal moving main.
- Tatsächlichen aktuellen Source, Host-Pins und Git-Abstammung ermitteln. Wenn v1.6 bereits vollständig enthalten ist, nicht künstlich erneut mergen: Äquivalenz belegen, vorhandene lokale Änderungen trotzdem prüfen. Versionsfeld allein reicht nicht.
- Taskbezogenen Update-Branch/Worktree von der verifizierten kompatiblen Ausgangslinie erstellen. Alle bisherigen Selector-Arbeiten auf ihrem Branch erhalten; nicht löschen. Den Update-Kandidaten nicht ungeprüft mit den noch nicht abgenommenen Selector-Patches vermischen: Selector-spezifische Core-Diffs anhand Inventar separat halten/aus dem reinen Update-Kandidaten gezielt ausklammern, ohne andere akzeptierte aXtn-Funktionen zu entfernen. Keine Historie umschreiben.
- Upstream aktualisieren, vorhandene akzeptierte aXtn-Funktionen minimal portieren und veraltete/schon upstream vorhandene Patches ablösen. Normale Merge-/Compiler-/Testkonflikte selbst beheben. Keine neue Betriebs-/Sicherheitsarchitektur und keine Funktionsverluste still akzeptieren.
- Migrationsmanifest/Checksummen/Ledger prüfen; bereits live angewendete additive Migrationen nicht umschreiben oder doppelt anwenden. Update-/Restore-Kompatibilität bei Schemaänderungen in geeignet isoliertem Clone belegen; vorgeschriebenen verschlüsselten Backupweg vor Live-Schritten erfüllen.
- Canonical Checks der Zielversion sowie gezielte aXtn-Regressionen durchführen: Auth/IAM/Modellrechte/Budget, Agent/Swarm-Draft/Publish/Snapshots, Canvas/headless, Approval-Suspend/Resume, Case-Lifecycle/Evidence, DMS/MCP/n8n der tatsächlich betroffenen Verträge. Live-Tests durch begrenzte synthetische Fixture, keine fremden Produktivvorgänge.
- Bestehende Host-Release-Linie, unabhängige Prüfungen und Freigaben nutzen. Die Nutzerentscheidung autorisiert die Update-Umsetzung und deren reguläre Inbetriebnahme innerhalb dieses Rahmens; keine erneute allgemeine "Soll ich das Update machen?"-Frage. Tatsächliche Registry-/Tokenrotations-/Backuprecipient-Voraussetzungen bleiben echte technische Grenzen; weder umgehen noch als Architekturfreigabeproblem darstellen. Alles unabhängig Ausführbare fertigstellen.
- Update erst mit exaktem Source-/Image-/Host-Pin, Schema-Ledger, Health/Smoke und gezieltem Funktionsnachweis als deployed behaupten. Bei technischen Live-Blockern den vollständig getesteten konkreten Release-Kandidaten bereitstellen und genau die fehlende Voraussetzung nennen. Kein Task-complete allein bei Source-Merge.

### Arbeitspaket 2: Selector auf neuer Basis
Erst nach validiertem Update-Stand native Gateway-/vLLM-/Modellauswahl erneut prüfen. Wenn das Ziel nun nativ erfüllt ist, entsprechende alte Selector-Patches nicht portieren. Sonst ausschließlich den dokumentierten minimalen aXtn vLLM Swarm Selector auf der neuen Basis weiterentwickeln; vorhandenen Code nur gezielt wiederverwenden, keinen ungeprüften Sammel-Cherrypick.
- Name und aXtn-Einordnung beibehalten.
- Native Provider-/Gateway-/Katalog-/Snapshot-/IAM-Verträge verwenden, keine neue Engine.
- Pro Knoten konkrete Modellwahl und Gateway-Opt-in; global route_all=false; direkter vLLM-Pfad getrennt.
- Erweiterung getrennt vom Upstream-Update committen/testen, damit künftige Updates ihren tatsächlichen Patchumfang erkennen und gegebenenfalls durch native Unterstützung ersetzen können.
- Bestehende Corporate-E2E-Abnahme nach regulärem Selector-Release fortsetzen; historische OpenAI-/direkte-vLLM-Proben nicht als Gateway-Beleg umdeuten.

Bericht: handoffs/reports/AXTN-VLLM-SWARM-SELECTOR-UPDATE-PREFLIGHT-20261016.md darf um tatsächliche Update-Umsetzung/Evidence erweitert werden; Titel/Status entsprechend nachführen. Tatsächliches Update und anschließende Erweiterung klar getrennt berichten.
