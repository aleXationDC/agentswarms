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

## Präzisierter Minimalumfang nach Pattern-Vergleich — 16.10.2026 16:26 Europe/Berlin

Sourcevergleich am aktualisierten Kandidaten 084da7686b8254f56eb3ea8fe5be90e51a98d771, nicht nur Dokumentationsvermutung:

- AgentForm.tsx und NodeInspector.tsx laden provider_credentials und integrations. Die Provider-Auswahl berücksichtigt Integrationen nur mit type=llm_provider; daher erscheinen OpenAI/Gemini/OpenRouter über das reguläre Pattern. llm_gateway ist ein separater nativer Integrationstyp und wird nicht als Provider in diese Liste aufgenommen.
- AgentForm behandelt llm_gateway separat, liest den vorhandenen Gatewaystatus und bietet natives Route-through-Gateway-Opt-in. NodeInspector hat im Kandidaten bereits einen ergänzten Schalter, prüft/zeigt dabei den Gateway-Verbindungsstatus aber noch nicht gleichwertig zum AgentForm.
- Nativer resolveOpenAICompatTransport nutzt für OpenAI, Gemini, OpenRouter und vllm dieselbe OpenAI-kompatible Transportschicht. GatewayOverride überschreibt dort Endpoint/Key vor der direkten Credential-Suche. Kein neuer HTTP-/Credential-/Provideradapter für LLMHub erforderlich.
- Vorhandene ModelCombobox -> useProviderModels -> listProviderModels -> resolveOpenAICompatTransport liefert Modellkatalog und eigentliche Aufrufe über dieselbe wirksame Route. Kandidat reicht routeThroughGateway bereits durch. Die Model-ID bleibt exakte Auswahl, IAM bleibt auf dem vorhandenen logischen Provider-/Modellvertrag.
- Die direkte vLLM-Integration ist llm_provider/provider=vllm. Der LLMHub-Gateway ist llm_gateway. Diese dürfen nicht zur Bequemlichkeit ineinander umgeschrieben, doppelt provisioniert oder durch "vllm im Dropdown" als Gateway-Nachweis ausgegeben werden.

Daraus folgt der kleinste zulässige Umsetzungsweg:
1. Bestehendes Provider-Auswahlpattern wiederverwenden; vllm nur als fehlenden bestehenden Provider anbieten, ohne zusätzlichen Adapter.
2. Für das beauftragte LLMHub-Ziel das bereits native Agent-Gateway-Pattern am Swarm-Knoten vervollständigen: vorhandene nutzbare Verbindung/Status verständlich anzeigen, explizites Opt-in am einzelnen Node, danach Auswahl der über diese Route verfügbaren autorisierten Modelle. Kein neuer Providerwert "llmhub", kein Umwidmen von OpenAI-/vLLM-Credentials, keine zweite Verbindung. Falls der native Gatewaydatensatz keinen Anzeigenamen kennt, keinen Namen aus einer URL erraten; bestehende Gatewaybezeichnung anzeigen.
3. Gespeichertes boolesches Intent entlang bestehender Agent-Import-/Node-/Draft-/Publish-/Portable-/Canvas-/headless-Verträge erhalten. Vorbereitete Implementierung gezielt vervollständigen, keinen zweiten Selector bauen.
4. Standardmäßige Discovery und tatsächliche Inferenz müssen denselben vorhandenen Resolver verwenden. Gateway explizit gewählt -> kein Laden direkter Provider-Credentials; Gateway nicht gewählt -> vorhandenes Providerverhalten.
5. Für gateway-only-Nutzer darf die UI nicht zusätzlich eine direkte vLLM-/OpenAI-Verbindung voraussetzen. Der aktuelle connectedProviders-Filter bildet direkte Integrationen ab; Gatewayroute und Provider-/Modell-IAM separat prüfen. Keine Verbindung als aktiv markieren, die nicht existiert, und keine IAM-Liste ausblenden/umgehen. Den passenden vorhandenen logischen Provider beibehalten; keine automatische Modell-/Provider-Präfixumschreibung erfinden.
6. Gezielte Regression des realen Patterns: direkt OpenAI/Gemini/OpenRouter unverändert; vllm direkt als vorhandener Provider; nur Gateway angebunden mit Opt-in und exakter Modell-ID; fehlender Gateway/Modellrecht fail-closed; zwei Nodes unterschiedliche Modelle; Flag bleibt nach Import/Publish/Export/Reload erhalten. Die zusätzlich konfigurierte direkte vLLM-Verbindung beim Test nicht deaktivieren oder verändern; gateway-only-Fall isoliert abbilden.

Größere Case-/Identitätskorrekturen sind Altlasten der bereits vorher eingebauten aXtn-Sonderregeln, kein notwendiges neues Integrationspattern für LLMHub. Vorliegende Korrekturen separat reviewen; keine weitere Case-/Payer-/Routingarchitektur für den Selector hinzufügen. Der Abschlussauftrag ist auf Wiederverwendung dieser vorhandenen nativen Bausteine begrenzt.

## Gezielte Fortsetzung nach be66d563 — 16.10.2026 16:52 Europe/Berlin

Bericht be66d5638e629f6fa830f6bb3db33cd8a528dd07 gelesen. Selector-Source wird nicht erneut konzeptionell aufgerollt. Noch offene Arbeit jetzt abschließen, ohne jedes Mal einen allgemeinen Teilabschluss als Endergebnis zurückzugeben.

1. AXTN_BACKUP_HELPER_IMAGE ist KEIN Credential und kein zwingender Kontoinhaber-Schritt. Host docs/BACKUP-RESTORE.md fordert ein digest-gepinntes Helper-Image; scripts/backup.sh verwendet daraus nur tar für read-only Volume-Archive. Vorhandene zulässige Host-Imagepins zuerst prüfen, geeignetes vorhandenes Standardimage mit tar/Plattform/Digest verifizieren und über normalen Host-Review-/Konfigurationsweg bereitstellen. Kein eigener Helper-Service, keine neue Image-Registry oder Security-Gate-Umgehung. Nicht vom Nutzer einen Image-Digest erfinden lassen. Die neue Source-Auswahl unter vorhandener Authority vorbereiten.
2. Tatsächlich wirksamen Host-Konfigurationspfad aus Start-/Environmentvertrag ermitteln, nicht blind .runtime/compose.env annehmen: scripts/backup.sh nutzt AXTN_RUNTIME_ENV_FILE oder als Default .runtime/compose.env, environments/prod.env.example setzt /run/axtn/prod/compose.env. Nur nichtgeheimen Pfad/Config-Provenienz berichten; keine geschützten Inhalte/Secretwerte ausgeben und keine Credentials ins Installationsrepository schreiben.
3. Die unvermeidbar vom Kontoinhaber zu liefernden Voraussetzungen getrennt und ausführbar halten: Publisher-Token write:package samt Ersatz/Widerruf; echter age-Public-Key mit bestehender Recovery-Verantwortung. Kein weiterer LLMHub-Key-Refresh ohne neuen Authfehler. Vorhandene gültige Konfiguration regulär nutzen, Werte nicht durchsuchen/ausgeben.
4. Native Administrationsabnahme nicht pauschal allein mit fehlendem PROD-Deployment verschieben. Auf geeigneter bestehender isolierter Instanz oder lokalem Kandidaten mit synthetisch gebundenem nativem Backend die UI-Kette Agent speichern -> Skills/Tools/Modell setzen -> bewusst in Canvas übernehmen -> Draft speichern -> Publish -> Reload/readback testen. Tatsächlich liveabhängige Teile anschließend am regulär deployten Kandidaten bestätigen. Kein dauerhaft zweiter Fullstack und kein lokales Image am Releasevertrag vorbei produktiv starten. Wenn die isolierte UI-Abnahme konkret nicht ausführbar ist, genaue fehlende Komponente statt "braucht Deployment" nennen und alle Source-/Executorverträge prüfen.
5. apply.mts NICHT nur wegen des Driftfehlers umbauen: Für reine Bootstrap-/Regression-Nutzung ist der Schutz korrekt. Belegen, dass reguläre native UI-Publikation das Skript nicht benötigt und gespeicherte Operatoränderungen nicht rücksetzt. Nur einen tatsächlich blockierenden Produktpfad minimal reparieren.
6. Noch fehlende Skill-/Snapshot-Semantik, Zwei-Node-Modellkonfiguration und negative Gateway-/IAM-Gegenproben über reale bestehende Import-/Publish-/Executorpfade mit isolierten Testdaten ausführen; bereits grüne Tests ohne neue Änderung nicht wiederholen.
7. Bericht auf den final getesteten Head ergänzen. Danach regulären Release mit vorhandenen Authority-/Backup-/Reviewverträgen fortsetzen. Kein großer neuer Integrationsumbau. Corporate-E2E und echte gatewayRouted=true-/Runtime-Receipt-Evidence bleiben letzte Funktionsabnahme.

## Ausdrückliche Betriebsfortsetzung — Backup erstellen und ausliefern, 16.10.2026 17:23 Europe/Berlin

Nutzer will mit der noch nicht produktiv genutzten Installation anfangen und den nächsten Case-Management-Auftrag später dem Swarm geben. Er beauftragt ausdrücklich: "erstell doch ein Backup ... sieh zu, dass du endlich vorwärts kommst." Dies ersetzt das bisherige Warten auf einen vom Nutzer eigens mitgebrachten age-Public-Key für diesen Release.

### 1. Backup-Einrichtung jetzt selbst erledigen
- Vorhandene funktionierende geschützte age-Identität/Recipient-Konfiguration verwenden, soweit sie im definierten Backup-Konfigurationsbereich bereits vorhanden und eindeutig ist. Keine breit angelegte Credential-/Keysuche, nichts anzeigen.
- Wenn für diesen Backupweg noch keine Identität existiert, ist Copilot jetzt ausdrücklich autorisiert, EINMAL mit dem vorhandenen nativen age-keygen eine Backup-Identität auf dem Host im geschützten Betreiberbereich außerhalb von Git anzulegen. Vorhandene Identitäten nie überschreiben/rotieren. Keine selbst geschriebene Kryptographie und keine zusätzliche Plattform.
- Privaten Schlüssel sicher persistent unter dem Betreiberaccount speichern (0700-Verzeichnis, 0600-Datei), nicht in flüchtigem Container/tmpfs, Git, Tool-Output, Prompts, Cases oder im zu sichernden Repository. Zugriff und lokale Wiederverwendbarkeit verifizieren. Public Recipient daraus intern ableiten und AXTN_BACKUP_RECIPIENT im bereits ermittelten geschützten Host-Konfigurationsweg setzen. Secretwert nie ausgeben.
- Dies ist eine neu angelegte Betreiber-Backup-Identität, kein bereits existierender "persönlicher Owner-Key"; Provenienz korrekt benennen. Betreiber-Schlüssel liegt zunächst auf dem Host und schützt dieses Deployment-Backup, bietet für sich allein keine Absicherung gegen vollständigen Hostverlust. Einen bestehenden sicheren externen Recoveryweg nutzen, wenn vorhanden; keine neue Cloud-/Mail-/Chat-Ausleitung. Eine spätere Owner-Escrow-Einrichtung als getrennte Betriebsaufgabe dokumentieren, dieses explizit beauftragte lokale Deployment-Backup nicht erneut deswegen blockieren.
- Bereits geprüften digest-gepinnten Backup-Helper verwenden und den vorhandenen scripts/backup.sh-Vertrag erfüllen. AXTN_ALLOW_BACKUP=1 ist für genau dieses Release-Backup autorisiert.
- EIN verwertbares verschlüsseltes Vorher-Backup mit Manifest und Source-/Ledger-Zuordnung erstellen. Entschlüsselbarkeit/Struktur/Exitstatus mit nativen Werkzeugen im geschützten/isolationstauglichen Bereich kontrollieren; keine entschlüsselten Produktivdaten ausgeben. Bestehende bereits belegte Restore-Tests wiederverwenden, wo dieselben Verträge betroffen sind; keine neue allgemeine Vollplattform-Restore-Runde aus bloßer Vorsicht.
- Dieses geprüfte Backup für die zusammengehörenden Migration-/App-/Selector-Release-Schritte wiederverwenden, solange kein relevanter neuer Daten-/Schema-Stand eine weitere Sicherung erfordert. Nicht vor jeder Source-/UI-/Teständerung erneut die gesamte Plattform sichern.
- Historische Dumps/Backupschlüssel nicht als Nebenarbeit löschen oder neu verschlüsseln; keine ungefragte Aufräumrunde.

### 2. Publisher-Voraussetzung zielgerichtet schließen
- Nutzer hat wiederholt die konkrete reguläre Auslieferung verlangt und kennt den fehlenden write:package-Scope. Der dafür erforderliche eng begrenzte Publisher-Token mit write:package und Ersatz/Widerruf des offengelegten Tokens ist im bestehenden zulässigen nativen Gitea-Konto-/Sessionweg vorzubereiten und, wenn mit vorhandener berechtigter Authentifizierung möglich, durchzuführen.
- Keine neue Organisation-/Adminrolle oder pauschalen Rechte vergeben; keine Passwortzurücksetzung, SQL-/DB-Tokeneinfügung, Secret-Logsuche oder Verwendung einer erfundenen menschlichen Session. Native API/UI und vorhandene gültige Berechtigungen verwenden. Token ausschließlich im vorhandenen geschützten Credentialfile persistieren, niemals ausgeben.
- Falls der legitime Kontozugriff die Ausstellung tatsächlich unmöglich macht, nach dem erledigten Backup und den unabhängigen Prüfungen genau den fehlenden Anmelde-/Kontoinhaber-Schritt nennen. Keine erneute generische Release-Freigabe und nicht weiter einen fehlenden Backup-Recipient als menschlichen Blocker führen.
- Keine lokalen Images außerhalb des vereinbarten Release-/Digest-/Provenienzwegs produktiv einsetzen, um die Registryberechtigung zu umgehen.

### 3. Unmittelbar weiter bis nutzbares Ergebnis
- Bestehenden getesteten kumulativen Kandidaten und Update 1.6 verwenden; keine erneute Architektur-/Integrationsschleife.
- Nach erfüllten Voraussetzungen regulärer Image-Push/Digest, Host-Pin und bestehende technische Review-/Merge-Gates, Ledgerprüfung/Migration 060, Deployment, Health/Smoke.
- Native Administration von Agents/Skills/Tools/Modellen/Swarm inklusive bewusstem Import, Draft/Publish/Readback bestätigen. Keine CLI-Seedpflicht im normalen Betrieb.
- Echten nativen Corporate-Gateway-Run mit route_all=false, konkreter Modellwahl und gatewayRouted=true sowie Native-Runtime-/Receipt-/Approval-/Case-Abschluss durchführen. Nur bereits autorisierte synthetische Approval-Simulation, keine fingierte Produktivabnahme.
- Noch vorhandene Fixture-/allgemeine Development-Grenze ehrlich ausweisen. Das nachfolgende Case-Management-Arbeitspaket nicht schon als durch den Swarm ausführbar erklären, solange dessen Repository-/Pfad-/Testspezifikation und native Fähigkeiten nur normalize_score zulassen. Kein Generalisieren durch Entfernen von Schutzregeln als Nebeneffekt.
- Ergebnis anhand tatsächlicher Betriebsfähigkeit berichten; Task nicht allein wegen Dokumentation/Source-Tests als fertig abschließen.

## Publisher-Identität zuerst nachvollziehen — Nutzerbeleg 16.10.2026 18:31 Europe/Berlin

Nutzer zeigt die native Gitea-Benutzerverwaltung: Es bestehen separate Konten aXtn-copilot-cli, axtn-admin, axtn-codex und axtn-gitea-mcp. Existenz oder letzte interaktive Anmeldung ist KEIN Nachweis von Token-/Registry-Rechten. Name des ausführenden KI-Produkts bestimmt ebenfalls nicht automatisch die Publisher-Identität.

Vor jeder erneuten Aufforderung an den Nutzer, ein axtn-codex-Token zu erzeugen:
1. Frühere erfolgreiche App-Image-Publikationen und Host-Release-Evidence gezielt lesen: Registry/Namespace, Publisher-Identität, Credential-Herkunftsreferenz und normaler Build-/Pushweg. Keine Secretwerte/alten credentialhaltigen Tool-Logs lesen oder ausgeben.
2. Insbesondere bestehenden technischen Zugang von aXtn-copilot-cli anhand seines dokumentierten Betriebszwecks und des definierten geschützten Credential-/Docker-/CI-Konfigurationswegs prüfen. Kein blindes Durchsuchen fremder Home-Verzeichnisse oder Auslesen weiterer privater Schlüssel.
3. Klären, warum die aktuelle Shell axtn-codex verwendet (z.B. taskbezogener Git-Credentialhelper oder übernommene Umgebung) und ob Git-Schreibidentität irrtümlich zugleich als verpflichtender Registry-Publisher behandelt wurde. Git- und Registry-Authentifizierung sind technisch getrennte Vorgänge. Keine neue generelle Identitätsarchitektur.
4. Wenn ein bestehender für diesen Release zugelassener Publisher-Zugang vorhanden ist, ihn unverändert im bestehenden Standardworkflow nutzen. Keine neue Credentials-/Benutzeranlage nur wegen des Namens der ausführenden CLI; keine passwortlose Rechteeskalation.
5. Wenn tatsächlich kein zulässiger Publishzugang existiert, konkret belegen, welche vorgesehenen Zugänge geprüft wurden und welche native Authentifizierung fehlt. Erst dann EINEN präzisen Betreiber-Schritt liefern. Nicht allein vom unzureichenden axtn-codex-Git-Token auf fehlende gesamte Publisherfähigkeit schließen.
6. Bereits gemeldetes Tokenleck getrennt behandeln: der geleakte Token braucht Ersatz/Widerruf über regulären Kontoweg; das beweist nicht, dass dieser Token der einzig mögliche oder richtige Registry-Publisher ist. Keine pauschale write:user-Freigabe verlangen.
7. Sobald der bestehende Weg regulär funktioniert, mit fertiggestelltem Backup und geprüftem Kandidaten unmittelbar Image-Push/Digest, regulären Release und Deployment/E2E fortsetzen. Keine neuen allgemeinen Planungs-/Abnahmerunden vor Auslieferung.

Der Screenshot ist ein Hinweis zur Kontozuordnung, keine im Chat erteilte Adminrolle, kein Secret und kein Beleg einer bereits geprüften alternativen Anmeldung.

## Verbindliche Kontozuordnung — Nutzerentscheidung 16.10.2026 18:34 Europe/Berlin

Copilot verwendet sein vorhandenes eigenes Gitea-Konto aXtn-copilot-cli. Das ist jetzt ausdrückliche Nutzeranweisung, nicht lediglich eine alternative zu prüfende Publisheridentität. Ältere Anweisungen, für diesen Copilot-Release ein axtn-codex-Token zu verlangen oder auszustellen, sind aufgehoben.

- Zuerst Herkunft des irrtümlich übernommenen axtn-codex-Credentialhelpers/Registry-Logins feststellen und für den taskbezogenen Copilot-Workflow korrigieren. Vorhandenen vorgesehenen geschützten Zugang von aXtn-copilot-cli verwenden. Fremde Codex-/MCP-Konfiguration und deren Worktrees nicht verändern.
- Git- und Registry-Authentifizierung separat korrekt auf aXtn-copilot-cli prüfen. Authentifizierte Identität und Repo-/Package-Berechtigung anhand nichtgeheimer Metadaten verifizieren, keine Tokenwerte/credentialhaltigen Ausgaben lesen oder veröffentlichen.
- Vorhandenen Standard-Publishweg dieses Kontos wiederverwenden. Falls dessen eigener Zugang tatsächlich repariert werden muss, den legitimen nativen Kontoweg nutzen; nur konkret nötige Repo-/Package-Rechte für diesen Release. Keine neue Benutzeranlage, keine pauschale Admin-/write:user-Rolle, keine Passwortzurücksetzung oder DB-/Session-Umgehung aus dieser Anweisung ableiten.
- Keine weiteren Kontoinhaber-Anforderungen für axtn-codex als Deploymentvoraussetzung. Das dort früher gemeldete Tokenleck als separate bestehende Sicherheitsaufgabe dem betroffenen Konto zugeordnet dokumentieren; Copilot-Release nicht weiter an dessen Publisher-Scope binden.
- Mit vorhandenem Backup und getesteter Source unverzüglich regulären Image-Push/Digest, Host-Release, Migration/Deployment und native UI-/Corporate-E2E-Abnahme fortsetzen.
- Nur falls der eigene vorgesehene Kontozugang konkret nicht verfügbar ist, exakt fehlende Authentifizierung/Einrichtung für aXtn-copilot-cli nachweisen. Existenz des Kontos allein beweist keinen erfolgreichen Zugriff; keine Erfolgsmeldung fingieren. Keine erneute allgemeine Planungs-/Freigabeschleife.

Diese Kontozuordnung ändert keine Produkt-Endbenutzeridentität, kein AgentSwarms-IAM und keinen Gateway-/Case-Vertrag. Es handelt sich um die bereits vorhandene technische Identität des CLI-Umsetzers.

## Dauerhafte Copilot-Anbindung und Release fortsetzen — 16.10.2026 18:43 Europe/Berlin

Nutzer präzisiert: Die Einrichtung muss dauerhaft für spätere Arbeiten und Releases funktionieren. "Einmalig" bezeichnet nur die Ersteinrichtung, nicht einen Einmal-Token oder eine nur aktuelle Shell. Keine manuelle Token-Neuanforderung bei jedem Release. Diese Fortsetzung konkretisiert den legitimen nativen Kontoweg; ältere Beschränkungen auf ausschließlich UI/API sind insoweit ersetzt.

Verifizierte Trennung:
- Diese ChatGPT-Sitzung verwendet den aXtn Git MCP Connector als axtn-gitea-mcp (identity-Rücklese, Gitea 1.27.3). Das ist weder das Konto axtn-codex noch Copilots Konto.
- Copilot berichtet Git-SSH als aXtn-copilot-cli erfolgreich. Eigenen SSH-Alias/Schlüssel für Git beibehalten. Der geerbte globale Codex-HTTP-Helper war die Ursache der falschen Git-Kontozuordnung; fremde Konfiguration nicht ändern.
- Registry-HTTP benötigt eigene Authentifizierung. Ein MCP-Connector und ein Git-SSH-Schlüssel ersetzen keinen Docker-Registry-Login. Kein neuer Custom-Connector, kein Registry-Proxy.

### Native Einrichtung mit vorhandener Betreiberberechtigung
1. Vorhandene Copilot-MCP-Konfiguration nur gezielt auf vorgesehenen Endpoint, eigene Authentifizierungsidentität und Funktion prüfen, keine Secretwerte anzeigen. Einen funktionierenden Connector erhalten; MCP-Neubau ist keine Deploymentvoraussetzung. Bestehende fremde Codex-/ChatGPT-MCP-Credentials nicht übernehmen.
2. Die offizielle Gitea-Server-CLI bietet admin user generate-access-token mit --username, --token-name und --scopes: https://docs.gitea.com/administration/command-line/ . Die Aussage "nur Kontoinhaber-UI oder API mit write:user möglich" ist deshalb unvollständig.
3. Auf dem bereits administrierten Host im tatsächlich laufenden Gitea-Dienst/Container mit dessen regulärem Service-User, tatsächlichem Config-/Work-Pfad und installierter --help prüfen. Bestehenden berechtigten Betreiberzugriff verwenden; keine neue Host-/Gitea-Adminrolle erwerben. Die eng begrenzte native Bereitstellung eines Registry-Tokens für das eigene vorhandene Konto aXtn-copilot-cli gehört zur beauftragten Einrichtung. Keine Passwortzurücksetzung, SQL-/DB-Tokeneinfügung oder Session-Imitation.
4. Wenn dort noch kein funktionierender eigener Zugang eingerichtet ist: EINEN dedizierten wiederverwendbaren Registry-Token für aXtn-copilot-cli ausstellen, Name axtn-copilot-registry, ausschließlich erforderliche Package-Scopes. Syntax/zulässige Scope-Kombination der installierten Version prüfen; write:package und ggf. read:package, kein all oder write:user. Der Package-Scope allein garantiert keine Namespace-Rechte: bestehende konkrete Ziel-Namespace-Berechtigung ebenfalls prüfen, keine pauschale Org-/Adminfreigabe.
5. Vor Token-Erzeugung sichere Ausgabeumleitung vorbereiten: keine PTY-/Tool-Ausgabe, set -x aus; native Raw-Ausgabe nur falls --help bestätigt. Secret direkt in geschützten persistenten Copilot-eigenen Pfad schreiben, z.B. ~/.config/axtn-copilot/registry-credential (Verzeichnis 0700, Datei 0600). stdout UND mögliche credentialhaltige stderr kontrolliert im geschützten Bereich behandeln. Kein Token in Kommandoargumenten, Chat, Git, Cases oder Logs. Bestehende Datei nicht blind überschreiben und bei Wiederholung nicht erneut Tokens anlegen.
6. Standard-Docker-Login per --password-stdin und eindeutigem Copilot-eigenen DOCKER_CONFIG bzw. vorhandenen nativen Credential-Store konfigurieren. Secret-Speicherung in docker config ist ohne Helper nicht verschlüsselt; denselben geschützten persistenten Betreiberbereich verwenden und Rechte absichern. Normaler Release-Aufruf muss diesen Weg ohne neue interaktive Eingabe verwenden. Vorhandene Codex-Docker-/Git-Konfiguration erhalten.
7. Persistenz tatsächlich prüfen: neue Shell/Prozess mit normalem Release-Aufruf verwendet dieselbe Konfiguration; Zugriff auf das vorgesehene Image/Namespace und regulärer Image-Push funktionieren. Ein bloßes 401 vom anonymen /v2-Endpoint ist kein Rechtebeleg. Nicht behaupten, ein erfolgreiches docker login allein beweise Pushrechte.
8. Nichtgeheime Einrichtungshinweise am bestehenden Betriebsort festhalten: Konto, Registryhost/Namespace, Konfigurationsreferenz und normaler Wiederverwendungs-/Rotationsweg. Keine neue Credential-Engine oder Secrets im Standardinstallations-Repository. Rotation bei Widerruf/Kompromittierung/ablaufendem Token ist eine Betriebsaufgabe, kein Release-Ritual.
9. Vorhandenes Backup wiederverwenden und sofort regulären Image-Push mit Digest, Host-Release, Ledger/Migration 060, Deployment, Health, native UI-Verwaltung und Corporate-E2E gemäß diesem Auftrag abschließen. Kein Abschluss nur wegen eingerichteter Credentials.
10. Falls der legitime Server-CLI-Weg konkret nicht zugänglich ist, exakt fehlende bestehende Betreiberberechtigung und geprüften nativen Pfad nennen, keine unbewiesene Forderung nach erneutem persönlichem Login. Keine Konten-/Rechteumgehung.

Abnahme der Anbindung: Git und Registry handeln als aXtn-copilot-cli; Folgeprozess kann den Zugang wiederverwenden; tatsächlicher Push/Digest belegt; fremde Identitäten unangetastet. Abnahme des Gesamtauftrags bleibt der deployed und nativ administrierbare Swarm mit echtem Gateway-/Runtime-E2E.

## Alle Rollen auf LLMHub konfigurieren und realen Folgeauftrag prüfen — 16.10.2026 19:37 Europe/Berlin

### Entscheidung und Ausgangsbeleg
Alex verlangt jetzt ausdrücklich, ALLE LLM-Agenten des vorhandenen Development Swarms auf die aufgabenbezogenen empfohlenen LLMHub-Modelle einzustellen, damit Rollen-/Prompt-/Tool-Finetuning und der vorbereitete Case-Management-Auftrag beginnen können. Kein Modelltraining oder Gewichts-Finetuning beauftragt. Frühere Einschränkungen "Builder/Contract unverändert" bzw. Warten auf allgemeine Modell-Mapping-Freigabe gelten für diese konkrete Konfiguration nicht weiter.

Bericht 9c68bf47c1f86ac421434c6ce19f6e6a454ed968 dokumentiert Deployment und erfolgreichen Mixed-Provider-Fixture-Run fbb14897-e41a-4aea-b574-2bb7e349e26e. Nur Security und Maintainability liefen dort über LLMHub; Builder und Contract weiterhin direkt OpenAI. Der Lauf ist kein Nachweis eines vollständig auf Corporate-Modelle konfigurierten oder allgemein entwicklungsfähigen Swarms.

Die frühere Chat-Empfehlung nannte Coding/Engineering = Qwen3.6-35B-A3B-FP8, komplexes Reasoning = GLM-5.2, alternative Reasoning = gpt-oss-120b, Dokument/Bild = Mistral-Small-4-119B-2603. Dies war KEINE bereits gemessene vollständige Vier-Rollen-Belegung. Die folgende Belegung konkretisiert jetzt die Startkonfiguration; optimale Rollenqualität nicht vorweg behaupten. Die beiden bestehenden getesteten Reviewer-Konfigurationen werden zunächst erhalten.

| Bestehende Rolle | Startmodell über natives LLM Gateway | Nachweis/Absicht |
| --- | --- | --- |
| Builder | Qwen3.6-35B-A3B-FP8 | Coding-Empfehlung; reales Candidate-Manifest und Tool-/JSON-Vertrag prüfen |
| Contract Breaker | GLM-5.2 | komplexe Vertrags-/Anforderungsprüfung; aktuelle Discovery und Rollenfähigkeit noch zu bestätigen |
| Security Breaker | gpt-oss-120b | bestehende erfolgreiche Gateway-Konfiguration erhalten; spezifische Security-Findings prüfen |
| Maintainability Breaker | Mistral-Small-4-119B-2603 | bestehende erfolgreiche Reviewer-Baseline erhalten; frühere Dokument-Empfehlung beweist keine optimale Code-Review-Qualität |

GLM-5.2 darf nur bei tatsächlich über den nativen Gateway-Katalog verfügbarer, per IAM erlaubter und im Rollenvertrag geeigneter exakter ID eingesetzt werden. Ist es nicht verfügbar oder scheitert es am nötigen Rollenvertrag, ist gpt-oss-120b als hier ausdrücklich festgelegte Reasoning-Alternative für Contract zulässig; abweichende Belegung mit Ursache offen dokumentieren. Kein geratener Modellalias oder stiller Providerfallback. Qwen3.8-27B-FP8 nicht mit Qwen3.6 verwechseln. Sonstige unerwartete Rollenfehler konkret diagnostizieren; keine Architektur-/Modelllotterie.

### Native Konfiguration tatsächlich fertigstellen
1. Bestehende Case-Lineage und aktuelle Agent-/Graph-Version nativ lesen. Alle wirklichen LLM-Nodes inventarisieren, einschließlich Router/Evaluate/Sub-Swarms falls inzwischen hinzugekommen. Vier Rollen sind der berichtete Stand, keine Ausrede weitere LLM-Nodes direkt OpenAI zu lassen. Deterministische Verify-/Tool-/Flow-Nodes benötigen kein künstliches Modell.
2. Aktuelle native Gateway-Discovery, Model-IAM, verfügbare Output-/Toolfähigkeiten und bestehende Budgets prüfen, Secrets nicht auslesen/ausgeben. GLM-Verfügbarkeit hier noch unbestätigt. Kein globales route_all; es bleibt false.
3. Vorhandene vier Agent-Builder-Objekte UND die zugehörigen Nodes des bestehenden Swarms über native UI-/Speicherverträge auf die konkrete Rollenbelegung mit routeThroughGateway=true setzen. Native Snapshot-Semantik beachten: Agent speichern/versionieren, erforderliche bewusste Übernahme in Canvas, vorhandene Node-/Prompt-/Skill-/Toolkonfiguration erhalten, Draft speichern, regulär Publish. Nicht bloß die Agent-Bibliothek ändern und stale Node-Snapshots stehen lassen; umgekehrt keine abweichende Agent-Bibliothek als fertige Gesamt-Konfiguration behaupten.
4. Historische Runs/Approvals/Versionen erhalten. Keine Seeds/apply.mts als nachträglichen Reconciler, keine SQL-Konfigurationspatches und keine Source-Defaults anstelle nativer Administration. Für diese Konfigurationsarbeit kein neues App-Deployment oder erneutes Gesamtbackup ohne tatsächliche Notwendigkeit.
5. Agent-Versionen, Draft/published Nodes und Reload zurücklesen. Für ALLE LLM-Rollen die exakten Modell-IDs, Gateway-Opt-in und tatsächlichen Rollen-/Tool-/Skillbindungen nichtgeheim dokumentieren. Notwendige Testsimulation nur im bereits autorisierten synthetischen Scope; echte Actor-/Delegations-Evidence nativ speichern, nichts rückdatieren.

### Geeignete Baseline und Folgeauftrag
6. Vorhandene erfolgreiche Tests wiederverwenden; gezielt nur neue Modell-/Rollenverträge prüfen: Builder liefert gültiges vollständiges Candidate-Manifest, Reviewer strukturierte Findings; bekannte fehlerhafte synthetische Kandidaten dürfen nicht alle PASS bekommen. Deterministische Tests bleiben maßgeblich, Modellselbstaussagen sind keine Abnahme. Ein bounded erfolgreicher vollständiger synthetischer Run mit neu veröffentlichter Konfiguration genügt als technische All-Gateway-Baseline. Pro tatsächlich ausgeführtem LLM-Node gatewayRouted=true/exakte Modell-ID im nativen Trace, Native-Runtime-Receipt, Suspend/Resume und unveränderte alte Runs belegen. Keine wiederholte Vollsuite ohne Sourceänderung.
7. Fehlende Modellrechte-Negativprobe gezielt mit geeigneter isolierter synthetischer Identität und nativen IAM-Verträgen schließen, keine produktiven Rechte des Owners oder fremder Nutzer ändern. Ungültige Modell-ID ist kein Ersatz für fehlende Berechtigung.
8. Der reale Folgeauftrag liegt bereits in aXtn/aXtn-architecture am unveränderlichen Commit 14b51ce781eeecfe766f6fe8dd83c0b393b2c2c1, Issue #8:
   - work-orders/AXTN-SUPACASE-USABILITY-0001.md
   - work-orders/AXTN-SUPACASE-USABILITY-0001-SWARM.md
   - work-orders/AXTN-SUPACASE-USABILITY-0001-TEST.md
   Alle drei vollständig lesen. Deren "Modelle unverändert" gilt für den Produkttest NACH dieser getrennten autorisierten Einrichtung: die neu veröffentlichte Rollenbelegung im eigentlichen Auftrag unverändert verwenden.
9. Phase A des Testauftrags jetzt am tatsächlich publizierten Swarm prüfen: Produktrepo aXtn/aXtn-agentswarms, erlaubte Mehrdatei-TypeScript-/React-Änderungen, passende native Developer-Workspace-/Runtime-Tools, tatsächliche Repository-/Test-/Build-Fähigkeit. Native vorhandene Skills/Tools/Rechte nur innerhalb des dokumentierten Auftragsscopes konfigurieren. Keine CLI-Entwicklung anstelle des Swarms, kein OpenAI-Direktfallback.
10. Wenn die nativen Voraussetzungen erfüllt sind, den vorbereiteten Auftrag über den nativen Case-/Task-Eingang an DEN SWARM übergeben und dessen eigene Bearbeitung bis zur im Auftrag definierten Grenze Review-PR/PR_READY begleiten. Copilot darf Einrichtung und Fehlerdiagnose erledigen, nicht die Case-Management-Implementierung als angebliche Swarm-Arbeit erzeugen. Kein Merge/Produktdeploy oder produktive Stammdatenänderung aus diesem Folgeauftrag. Für reale Abnahme keine TEST_SIMULATION.
11. Falls der bestehende Python-Fixture-Vertrag Phase A ablehnt, NOT_READY mit exaktem Validator/Graph-/Source-/Toolvertrag und kleinster verifizierter nativer Anpassungsmöglichkeit belegen. Bestehende native Konfigurationsmöglichkeiten innerhalb des Scope nutzen; kein pauschales Entfernen von Repo-/Pfad-/Testgrenzen, kein neuer Dispatcher/Executor. Echte über native Konfiguration hinausgehende Capability-/Schnittstellenlücke als konkrete technische Restarbeit ausweisen; nicht weitere Python-Läufe als Ersatz liefern und nicht eine neue Architektur erfinden.

Lieferung im bestehenden Report: tatsächliche vorher/nachher Rollenmatrix, native Agent-/Swarm-Versionen, bounded Rollenmessungen und Grenzen, All-Gateway-Run/Receipt, Case-Management-Phase A und anschließend reale Ausführung oder exakt belegtes NOT_READY. "LLMHub vollständig konfiguriert", "native Development-Toolchain nutzbar" und "Case-Management-Auftrag fertig" getrennt belegen. Keine erneute allgemeine Konfigurationsfreigabe verlangen.
