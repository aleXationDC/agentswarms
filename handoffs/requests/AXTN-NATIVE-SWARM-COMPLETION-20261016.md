# AXTN-NATIVE-SWARM-COMPLETION-20261016

Status: EXECUTE_EXISTING_NATIVE_SCOPE_TO_OPERABLE_RESULT.
Nutzerentscheidung 16.10.2026 16:21 Europe/Berlin: funktionierender nativer Development Swarm; Agents, Skills, Tools und Swarm nativ in AgentSwarms administrierbar; nur der besprochene minimale aXtn vLLM Swarm Selector für LLM-Nutzung.
Tracking: aXtn/aXtn-agentswarms#7, bestehende SupaCase-Lineage verwenden.

## Verbindliches Ergebnis
Nicht beim Source-Update oder einem Python-Fixture-PASS stehenbleiben. Ziel ist eine lauffähige, native administrierbare Installation mit nachgewiesenem LLMHub-Pfad und Native-Runtime-Verwendung. Erledigte Arbeit wiederverwenden, unabhängige Restarbeit jetzt abschließen. Keine weitere allgemeine Planungs-/Implementierungsfreigabe verlangen.

ChatGPT spezifiziert innerhalb des akzeptierten Lösungsrahmens, Copilot implementiert/prüft als Programmierer. Native capability > standard > reuse > configure > integrate > custom build. Keine neue Architektur, Control Plane, Ersatz-Provider-/Credentialengine oder Shell-/Function-Orchestrierung. Der ausdrücklich besprochene Selector ist die eng begrenzte aXtn-Erweiterung; daraus folgt keine Custom-Generalvollmacht.

## Verifizierte Ausgangsquellen
- Aktualisierter Source/Report: 084da7686b8254f56eb3ea8fe5be90e51a98d771.
- v1.6.0: 70c295f17af39c81b1a4b56e6552307f5d91eef3.
- Update-Merge 6728dd677f85f4a4155e352356146bc861757d84; Portable-Selector-Fix e39ce4423dbb23775d72f5a96db751c924ac74a8.
- Audit: aXtn/aXtn-agentswarms@f6efd42c4288b28ce41ab3d8217367449bc437ee, handoffs/reports/AXTN-UPSTREAM-160-NATIVE-REPLACEMENTS-20261016.md.
- Vorheriger vollständiger Auftrag: handoffs/requests/AXTN-LLMHUB-NATIVE-AGENT-GATEWAY-20261016.md einschließlich UPDATE-FIRST und Native-Runtime-Fortsetzung. Dieses Abschlussdokument priorisiert die noch offene Lieferung.
- Native-/Case-/Work-/Approval-Verträge und AGENTS.md gelten weiterhin. Historische Native-0002-Fixture ist Regression, keine Beschränkung der administrativen Oberfläche auf CLI-Seeds.

## A. Native Administration als echtes Abnahmekriterium
1. Bestehenden Swarm und die vier vorhandenen Agents weiterverwenden. Keine Ersatzobjekte/duplizierten produktiven Swarms oder neue Orchestrierung zur Umgehung von Import-/Publikationsproblemen.
2. Native Agent-Builder-, Skills-, Tool-/MCP-, Memory-/KB-, Modell-/IAM- und Swarm-Canvas-/Publish-Oberflächen nutzen. Agent-Konfiguration und Swarm-Node-Konfiguration sind die jeweiligen nativen Datensätze/Snapshots. Keine zweite verbindliche Konfiguration in Environmentvariablen, Seed-Dateien oder eigenem Editor für die laufende Administration.
3. Geprüfter Ist-Befund: axtn/swarms/axtn-development/apply.mts bildet definitions=createNativeDevelopmentAgents(config), vergleicht gespeicherte Config/Memory gegen diese festen Werte und wirft config drift. createNativeDevelopmentSwarm vergleicht übernommene Rollenfelder zusätzlich mit generierten Vorgaben. Das darf nicht der laufende Änderungs-/Publikationsweg für Operatoren bleiben.
4. Vorhandene Seeds nur als initiale, idempotente Einrichtung/Regression behandeln. Nicht nach UI-Änderung als Reconciler starten und nicht automatisch Konfiguration wieder zurücksetzen. Bestehende Drift-/Concurrency-Sicherungen gegen unbeabsichtigtes Überschreiben erhalten. Keine pauschale Drift-Prüfungsentfernung.
5. Zuerst nativen manuellen Weg prüfen: Agent speichern/versionieren -> im bestehenden Canvas bewusst erneut übernehmen -> Node konfigurieren -> Draft speichern -> nativen Publish verwenden. Wenn dieser funktioniert, ihn verwenden und dokumentieren; keinen eigenen Sync bauen. Funktional erforderliche bestehende Bootstrap-Annahmen minimal begrenzen, falls sie die reguläre native Bedienung tatsächlich blockieren.
6. Native Snapshot-Semantik erhalten: spätere Agent-/Skill-Änderungen ändern einen laufenden oder bereits publizierten Run nicht heimlich. Bewusste Übernahme/Publikation muss über vorhandene native Oberfläche möglich und nach Reload/Restart persistent sein. Nicht alle Skill-Inhalte sind zwingend snapshotgleich; exakt den tatsächlichen nativen Versions-/Referenzvertrag prüfen und transparent dokumentieren statt zusätzliche Semantik zu erfinden.
7. Fachliche Aufgaben-/Receipt-/Acceptance-Sicherheit bleibt. Administrierbarkeit ist keine Erlaubnis, durch freie Prompts Runtime- oder Datenrechte zu vergeben. Modell-/Tool-/Skill-Einstellungen müssen die vorhandenen nativen IAM-/Grant-/Budgetregeln respektieren.
8. Native Skill-Objekte auflisten, zuordnen/entfernen und wirksam im Run belegen. Keine leeren Dummy-Skills erzeugen, um das Kriterium formal abzuhaken; vorhandenen fachlich geeigneten Skill oder eindeutig gekennzeichnete inhaltsarme synthetische Prüffixture verwenden, fremde Produktivinhalte nicht verändern.

## B. Minimaler LLM-Eingriff
- Name exakt aXtn vLLM Swarm Selector.
- Bestehende native vLLM-/Gateway-/ModelCombobox-/Resolver-/Providertransportfunktionen verwenden.
- LLMHub bleibt die vorhandene native Gateway-Integration, nicht ein neu erfundener Provider. Opt-in je Agent/Node, konkretes autorisiertes Modell je Knoten, global route_all=false.
- Keine direkten vLLM-/OpenAI-Fallbacks bei Gateway-Opt-in. Technische IDs unverändert.
- Korrektur im Bericht 084da768: vLLM-Dropdown-Eintrag im Swarm ist NICHT upstream-native in v1.6.0. Geerbte aXtn-Patchteile und neuer Portable-Fix gemeinsam als Selector inventarisieren.
- Native Fehlersperren erhalten; keine pauschale Grant-/Case-/Budget-Umgehung. Case bleibt fachlicher Lifecycle-/Evidence-Träger, keine zusätzliche LLM-Identitätsquelle.
- Keine neue allgemeine Erweiterungsengine oder große Refaktorierung für diese Funktion.

## C. Native Runtime und tatsächliche Entwicklungsfähigkeit
- Bestehende Notebook-/Developer-Workspace-Batch-Sessions und Orchestrator verwenden; kein zweiter Executor/Jobstore.
- App-Update, Runtime-Basisimage, aXtn-Prüfharness und tatsächliches Session-Image separat verifizieren/pinnen. Im neuen Source sind native CAS-/Reaper-/Staging-Fixes enthalten; nicht wieder durch alte Dateikopien verlieren.
- Verify-Session mit Run/Case/Attempt/Candidate/Testreceipt belegen.
- Der Builder erzeugt bisher Code, er führt keinen allgemeinen Sandbox-Entwicklungsprozess aus. Der Swarm ist source-seitig auf normalize_score/Python-Fixture begrenzt. Diese Grenze im Ergebnis ehrlich benennen, keinen universellen Development Swarm behaupten.
- Für zusätzliche allgemeine Build-/Test-Schritte zuerst die vorhandene native Workspace-/Batch-/MCP-Fähigkeit verwenden und den konkreten bereits akzeptierten Work-/Solution-Contract lesen. Keine neue eigene Shell-/Runtime-Anbindung aus dem allgemeinen Fertigstellungsauftrag ableiten. Eine materielle verbleibende Capability-Lücke präzise belegen, die funktionierenden unabhängigen Teile trotzdem liefern.

## D. Release abschließen, technische Voraussetzungen konkret abarbeiten
1. Aktuellen Host-/App-/Branchstand nichtgeheim zurücklesen. Fremde Worktrees erhalten. Source-Nachfolger berücksichtigen; nicht den Dokumentationsbranch als älteren Source-Rollback deployen.
2. Bestehenden regulären Host-Releasevertrag anwenden. Vorhandene Autorisierung gilt für die konkrete Update-/Selector-Inbetriebnahme; keine erneute allgemeine Freigabefrage. Gültige unabhängige Review-/Merge-/Provenienzregeln bleiben.
3. Registry: vorhandene zulässige Publish-Identität und geschützte Credentialbereitstellung prüfen. Nicht weitere Token-/Secretquellen durchsuchen oder Werte/credentialhaltige Logs ausgeben. Falls Publisher-PAT weiterhin write:package fehlt, keine eigene Rechteausweitung: exakt einen sicheren Kontoinhaber-Schritt mit Konto, Gitea Settings/Applications, Scope und vorhandenem geschütztem Dateipfad nennen. Zuvor offengelegtes Token ersetzen und widerrufen; erst tatsächlichen Erfolg als erledigt melden.
4. Backup: vorhandenen tatsächlichen age-Recipient/verifizierten Recovery-Vertrag prüfen. Falls weiterhin nicht vorhanden, echten Owner-Public-Key über geschützten Konfigurationsweg verlangen; keinen erfundenen/unwiederherstellbaren Recipient. Keine Secrets im Repository. Vor backup-pflichtigen Live-Schritten vorgeschriebenen verschlüsselten Backupweg erfüllen.
5. Währenddessen alle unabhängigen Source-/UI-/Import-/Publish-/Runtime-Tests auf geeigneter bestehender isolierter Umgebung abschließen. Keine wiederholten vollständigen Suites ohne neue Änderung/Fehler; gezielte Tests auf endgültigem Candidate. Vorbestehende rote Tests mit konkretem Baselinebeleg dispositionieren.
6. Nach erfüllten Voraussetzungen: Backup -> kumulativer geprüfter Source/Image-Digest -> zulässige Source-/Host-Integration -> benötigte additive Migrationen einschließlich 060 nach Ledgerprüfung -> App/Runtime-Deployment -> Health/Smoke -> native Agent-/Swarm-Konfiguration und Publikation -> Corporate-E2E.
7. Nicht eigenmächtig verlorene Daten/alte Migrationsdateien bereinigen. Historische Runs und suspendierte Approvals erhalten. TEST_SIMULATION nur für die bereits autorisierten synthetischen Approval-Schritte durch echten nativen Authpfad.

## E. Sichtbare Ende-zu-Ende-Abnahme
- Agent Builder: bestehende Agent-Konfiguration ändern/speichern, ausgewählte Skill-/Tool-/Modell-/Gateway-Zuordnung zurücklesen.
- Swarm: Änderungen bewusst nativ übernehmen bzw. direkt am Node vornehmen, zwei Knoten mit unterschiedlichen erlaubten Modellen, Opt-in nur gezielt.
- Draft speichern, UI reload, nativ publizieren; veröffentlichte Version und Node-Konfiguration zurücklesen. Alte Run-Version unverändert.
- Canvas und headless führen die publizierte Konfiguration im jeweils geltenden nativen Vertrag aus; keine unbemerkte Seed-/Env-Übersteuerung.
- Corporate-Run: reale native Traces gatewayRouted=true, konfigurierte Gateway-Integration, exakte Modell-ID, tatsächliche Runtime-Session und Testreceipt, reguläres Approval/Resume und Zielergebnis belegen.
- Gegenprobe: fehlendes Modellrecht bzw. fehlendes Gateway wird korrekt abgelehnt, kein direkter Fallback. Standardprovider ohne Opt-in unverändert.
- Ergebnis nach Reload/Restart auffindbar; Idempotenz der betroffenen Operationen, exakter PR-Head/Readback und reguläre Case-Lifecycle-Fortsetzung.
- Keine Erfolgsbehauptung allein aufgrund Modell-Discovery, UI-Schalter, Source-Build oder alten direct-vLLM-Proben.

## Lieferung
Bericht: handoffs/reports/AXTN-NATIVE-SWARM-COMPLETION-20261016.md.
Enthält: tatsächliche aktuelle Git-/Image-/Host-/Runtime-Pins; native Bedienfolge ohne CLI-Zwang; exakt begrenzte aXtn-Patches; erfüllte E2E-Kriterien; Case/Run/Receipt/PR-Referenzen; echte offene technische Voraussetzungen.
Funktionierender synthetischer Abnahmeslice, allgemeine Development-Fähigkeit, Native-Administration, deployed und Corporate-E2E getrennt ausweisen. Kein "Task complete", solange das zugesagte betriebsfähige Ergebnis offen ist.
