# AXTN-DEVSWARM-PRODUCT-NATIVE-20261017 — konsolidierter Gesamtauftrag

## Ziel und Verantwortlichkeit

Nutzerauftrag 17.10.2026, 09:21 Europe/Berlin: Copilot soll die Umsetzung zielgerichtet fortführen; ausschließlich native Mechanismen vorsehen und diese vor Nutzung prüfen.

Lieferziel: Ein in AgentSwarms administrierbarer Development Swarm bearbeitet den echten Auftrag AXTN-SUPACASE-USABILITY-0001 aus aXtn/aXtn-architecture PR #8, Revision 14b51ce781eeecfe766f6fe8dd83c0b393b2c2c1. Der Swarm erzeugt selbst den Mehrdatei-Produktkandidaten, drei unabhängige Reviews und referenzierte deterministische Test-/Build-Ergebnisse für denselben Candidate-SHA. Er führt den Auftrag zur nativen unabhängigen Approval und anschließend zum reviewbaren, ungemergten Produkt-PR.

Copilot verantwortet Einrichtung, Konfiguration, Integration und Reparatur der Arbeitsumgebung. Produktcode aus PR #8 schreiben die Swarm-Agents, nicht Copilot CLI. Ein Read-only-Run oder Python-Fixture-PASS erfüllt diesen Gesamtauftrag nicht.

Repository: aXtn/aXtn-agentswarms; bestehendes Issue #7 und bestehende SupaCase-Lineage. Handoff-/Konfigurationsarbeit auf work/AXTN-NATIVE-SWARM-COMPLETION-20261016. Produktarbeit ausschließlich auf work/AXTN-SUPACASE-USABILITY-0001 von einem frisch verifizierten, kompatiblen Base-SHA. Den alten 084da768-Readback nicht als automatisch geeignete aktuelle Produktbasis verwenden.

## Vorrang: ein Vertrag statt widersprüchlicher Fortsetzungen

Dieser Gesamtauftrag ersetzt für die aktuelle Produktbefähigung die Python-/Acceptance-Repo-Beschränkungen und wiederholten Preflight-Aufträge aus V1-IMPLEMENTATION-CONTRACT.md, IMPLEMENTATION-0001, NATIVE-0002 und NATIVE-FIRST-20261016. Die alten Dokumente bleiben historische Canary-Verträge und Evidence, keine allgemeinen Grenzen eines Produktauftrags. Schutzverträge, bestehende Betriebsfreigaben und die separat autorisierte sichere Rotation der zwei offengelegten internen Secrets gelten weiter. Kein weiterer pauschaler Freigabestopp für bereits beauftragte normale Einrichtung/Reparatur.

Diese Ablösung ist keine Behauptung, dass der volle Produktpfad bereits funktioniert. Source-Prüfung und Runtime-Abnahme müssen getrennt ausgewiesen werden.

## Ausschließlich native Lösung: klare Grenze

Zulässig sind:
- konfigurierte native AgentSwarms-Nodes, Agent-Toolschleifen, gespeicherte Agents, Skills/KB, Snapshots, Publish, Traces und Approval;
- die vorhandene native MCP-Integration mit eng begrenzten Gitea-Standardoperationen;
- die native HTTP-Node mit serverseitigen Secret-Referenzen für dokumentierte Gitea-APIs;
- native Gitea Actions und ein offizieller Gitea-Standardrunner für deterministische Produktprüfungen; vorhandene Installation wiederverwenden, fehlende Standardkomponente im bestehenden Host-Betriebsweg konfigurieren und bereitstellen. Dies ist Gitea-native CI, kein eingebauter AgentSwarms-TypeScript-Runner;
- gewöhnliche deklarative Graph-, IAM-, Tool-, Runner- und CI-Workflow-Konfiguration sowie die vorgesehenen npm-Testbefehle.

Nicht zulässig sind neue eigene Python-/TypeScript-Runtimes, Harness-Dienste, Shell-Wrapper als MCP-Tools, eigene Dispatcher, selbst geschriebene Polling-/Callback-/Checkpoint-Dienste, zusätzliche Case-/Job-/Approval-Control-Planes oder selbst verfasster Function-Code, der fehlende Ablauf-/Prüfmechanismen ersetzt. Keine eigene CI-Engine und kein Plattformpatch, um einen unbewiesenen Plan passend zu machen. Auch eine native Tool-/Function-Hülle macht Sondercode nicht nativ.

Bereits vorhandene aXtn-Functions, Adapter und Runtime-Anpassungen im alten Fixture-Pfad inventarisieren und sichtbar zuordnen. Für den neuen Produktpfad keine davon still als Standard übernehmen. Den Altpfad samt Runs und Versionen erhalten, aber nicht als erfülltes Produktziel ausgeben. Bestehende freigegebene aXtn-Produktfunktionen, insbesondere SupaCase und vLLM Swarm Selector, werden nicht pauschal gelöscht; sie sind als vorhandene Erweiterungen zu kennzeichnen.

## Vorab geprüfte native Mechanismen und reale Grenzen

Source-Abgleich am 17.10.2026 auf dem aktuellen Handoff-Branch:

| Baustein | Source / Primärquelle | Beleg und Grenze |
|---|---|---|
| Agent-/MCP-Toolschleife | src/utils/tools/registry.server.ts; docs/engineering/02-agent-runtime.md | Native MCP-Toolaufrufe durch Agenten vorhanden. Tatsächliche Tool-Schemas und IAM zur Laufzeit prüfen. |
| HTTP + geschützte Credentials | src/lib/swarmRuntime.ts, src/utils/swarmExecute.server.ts, src/utils/swarmNodes.server.ts, src/utils/secrets.server.ts | Native HTTP-Nodes; Variablentemplates und serverseitige Secret-Referenzen; Canvas und Headless verwenden denselben HTTP-Core. HTTP 4xx/5xx wird nicht automatisch als harter fachlicher Fehler behandelt! Keine erfolgreiche Transportantwort mit einem bestandenen Test verwechseln. |
| Parallelität/Join | src/lib/swarmGraph.ts; src/lib/swarmRuntime.ts; src/utils/swarmExecute.server.ts | Graph-Abhängigkeiten und merge. Drei Reviewer gegen dieselbe eingefrorene Revision. |
| Exact Router | src/lib/swarmRuntime.ts; src/utils/swarmExecute.server.ts | routerMode=exact vorhanden; nur exakte, vollständig definierte Maschinenwerte verwenden. Keine LLM-Auslegung von CI-PASS. |
| condition | src/lib/swarmRuntime.ts | LLM-Klassifikation, kein deterministischer Predicate-Node. Nicht zum harten Test-Gate erklären. |
| loop / foreach | src/lib/swarmRuntime.ts | Wiederholen bzw. Verteilen einer Agent-Body, keine beliebige Subgraph-/HTTP-Pollschleife. Keine fiktiven Fähigkeiten beauftragen. |
| Code Review Pipeline | src/lib/swarmTemplates.ts, Template code-review | Natives Agent-Fan-out/Review-Muster, keine vollständige Entwicklungs-/Testumgebung und keine deterministische Static Analysis. |
| Gitea Actions | https://docs.gitea.com/1.27/usage/actions/overview/ | Native CI/CD; eigenständig betriebener Standardrunner erforderlich. Kein aktiver Runner ist bisher nachgewiesen. |
| Gitea Runs/Jobs APIs | https://docs.gitea.com/api/1.27/operations/get-workflow-runs/ ; https://docs.gitea.com/api/1.27/operations/get-workflow-run/ ; https://docs.gitea.com/api/1.27/operations/list-workflow-run-jobs/ | Repo-spezifische native API; Runs-Liste unterstützt head_sha und branch. Dokumentierte Schnittstellen vor konkreter Bindung gegen aktive 1.27.3-Swagger/API verifizieren. |
| Produkt-CI | .github/workflows/ci.yml und aktuelles package.json | Vorhandene npm-/TypeScript-Prüfdefinition, noch kein Beleg für deren aktive Gitea-Ausführung oder vollständige Actions-Kompatibilität. |

Offen sind insbesondere die vollständig native asynchrone Ergebnisübernahme, die deterministische Vollständigkeits-/Revisionsprüfung und deren Gate-Komposition. Sie werden nicht durch einen erfundenen generischen Loop oder versteckten Validator als gelöst dargestellt. Vor der automatischen Approval-/PR-Fortsetzung müssen sie nativ belegt sein. Das blockiert nicht die unabhängig mögliche Builder-/Candidate-/Review-Arbeit.

## Durchführung: bis zum tatsächlichen Endpunkt weiterarbeiten

### 1. Bestehende native Administration funktionsfähig nutzen
- Aktuelle Pins, Regeln und bisherige Evidence einmal auflösen, dann konkrete Änderungen ausführen statt denselben Preflight erneut abzugeben.
- Den bereits verwendeten geschützten Owner-Zugang und die vorhandenen nativen UI-/Serverfunktionen nutzen. Eine abgelaufene Browser-Session ist eine normale Wiederanmeldung, keine neue Architektur- oder Nutzerentscheidung.
- Graph-Child 43d22cf1-8767-40ef-b682-785607e6d724 im bestehenden Parent 85a1d829-39ac-49bd-9047-163ab52d427b nativ aktualisieren; offene frühere Transition nachholen. Keine direkten DB-Writes als Administration.
- Aktuelle vier Rollenmodelle und Agent-Gateway-Opt-ins erhalten; route_all=false. Skill-/Toolbindung, Agent-Bibliothek und kopierte Swarm-Snapshots kontrollieren.

### 2. Produktzugriff eng konfigurieren
- Exakte Gitea-Repo-Schreibweise und aktuelle Base-Revision zurücklesen.
- Read sowie Working-Branch-/File-Upsert-/PR-Operationen für die erlaubten Produktpfade aus dem PR-#8-Vertrag nativ konfigurieren. Keine generischen Admin-, Merge-, Delete- oder Protected-Branch-Rechte.
- CI-/Runner-/Workflow-Konfiguration ist getrennte Einrichtungsarbeit von Copilot; der Produkt-Builder darf diese Prüfdefinitionen nicht ändern oder sich selbst erfolgreiche Statusmeldungen schreiben.
- Keine Credentials im Agent-Kontext. Keine breite neue Credential-Suche, Codex-Identität oder Umstellung funktionierender CLI-MCP-Konfiguration.

### 3. Den Swarm echte Entwicklungsarbeit ausführen lassen
- Die drei versionierten PR-#8-Auftragsdokumente lesen und als aktuellen Arbeitskontext bereitstellen.
- Den nativen Builder mit den benötigten, eng freigegebenen MCP-Tools ausstatten. Auftrag und erlaubte Zielpfade gehören in native Konfiguration/Arbeitskontext, nicht in einen neu programmierten normalize_score-Nachfolger.
- PR-#8-Arbeitspakete master-data, case-workbench, logging-observation und acceptance gemäß bestehendem SWARM-Vertrag verwenden. Nur real eigenständige Arbeitspakete als Child Cases.
- Builder-Agenten erzeugen und materialisieren die Änderungen über ihre native Toolschleife. Bei begrenztem Toolbudget nativ in passende Arbeitspakete zerlegen; keinen eigenen Ausführungscontroller bauen.
- Vollständigen Kandidaten aus Gitea zurücklesen und auf einem exakten SHA einfrieren. Security, Contract und Maintainability prüfen diesen gesamten Mehrdatei-Kandidaten mit den vorhandenen Rollenmodellen.
- Fehlender CI-Nachweis verhindert PASS/PR_READY/Acceptance, aber nicht diese eng erlaubten Arbeitsbranch-Änderungen und unabhängigen Reviews. Ungeprüfte Kandidaten bleiben ausdrücklich UNVERIFIED; keine Produktivwirkung.

### 4. Native Gitea-CI bereitstellen und real prüfen
- Einen vorhandenen passenden offiziellen Gitea-Runner wiederverwenden, andernfalls einen zur aktiven Gitea-Version kompatiblen offiziellen Runner über normale Host-Konfiguration bereitstellen. Keine neueste Version blind wählen; Version und Images unveränderlich pinnen.
- Jobausführung isolieren. Kein Produktions-Compose-Env, Provider-/Datenbank-/Deployment-Secret, Betreiber-Home oder Host-Docker-Socket in Candidate-Jobs. Runner-Verwaltung und Jobrechte trennen; eng repo-gebundene native Registrierung. Keine zweite dauerhafte AgentSwarms-Instanz.
- Die existierenden Produkt-Prüfbefehle verwenden: npm ci, generate:routes/typecheck, lint, einschlägige Tests und build. Actions-/Artefakt-Kompatibilität der konkreten Runner-Version tatsächlich testen. Keine Änderungen an Produktlogik durch Copilot, keine Testabschaltung zum Erzwingen von Grün.
- Vertrauenswürdige Workflow-Definition vor Produktänderungen pinnen; Candidate darf Prüfdefinition, erlaubte Tests und erwartete Checks nicht selbst herabsetzen.
- Baseline und Candidate getrennt prüfen. Bekannte Basisfehler nur mit aktuellem Gegenbeleg ausweisen; sie niemals pauschal als Candidate-PASS umdeuten.
- Echte Runs/Jobs/Artefakte über native Gitea-APIs binden: Repository, vollständiger SHA, Workflow-Revision, Run/Attempt, tatsächliche Pflichtjobs, Schlusszustand und Ergebnis müssen zusammenpassen. Keine Auswahl des ersten beliebigen grünen Runs.
- Native HTTP-/Exact-Router-Komposition nur nach belegtem Vertrag einsetzen. Fehlt die vollständig native asynchrone Fortsetzung oder sichere Gate-Komposition tatsächlich, keine Ersatzskripte bauen; verbleibende Grenze exakt belegen und alle bis dahin unabhängig möglichen Arbeiten abschließen.

### 5. Native Approval und Review-PR
- Nur echte vollständig bestandene Pflichtprüfungen und vollständige unabhängige Reviews dürfen zur Approval führen. Keine LLM-Schätzung eines CI-Status.
- Native Approval enthält den exakten Candidate und die Evidence-Referenzen. Keine TEST_SIMULATION bei Produktabnahme, keine Selbstabnahme des Builders.
- Sobald allein eine reale unabhängige Entscheidung aussteht, PENDING_APPROVAL mit direkter nativer Inbox-/Case-Fundstelle melden; dies ist der vorgesehene menschliche Endpunkt, keine allgemeine Konfigurationsfreigabe.
- Nach tatsächlicher Freigabe und erneut unveränderter Revision Review-PR erstellen/zurücklesen, offen und ungemergt. Keine Produktmigration, kein Merge oder Produktdeploy unter PR #8.
- Save/Publish/Reload und den tatsächlich ausführenden Snapshot prüfen; Traces müssen Builder-Writes, exakte Modell-/Gateway-Nutzung, drei Reviews und CI-Evidence nachweisen. Read-only-/Fixture-Runs reichen nicht.

## Weiterarbeit statt routinemäßiger Abbruch

Im beauftragten nativen Scope ohne erneute allgemeine Rückfrage beheben: fehlende native Konfiguration, eigene repo-/pfadgebundene Freigaben, abgelaufene Session, Start-/Netzwerk-/Runnerkonfiguration, gewöhnliche Fehler und fehlende Testvoraussetzungen. Native Standardkomponenten konfigurieren statt deren Fehlen als Endergebnis abzugeben. Die fehlende Runner-Installation ist jetzt ausdrücklich Einrichtungsarbeit, nicht der alte TYPESCRIPT_RUNNER_UNAVAILABLE-Abschluss.

Nicht nach jeder Phase enden. Fortschritt und tatsächliche offene Arbeit in den vorhandenen Cases halten und mit dem nächsten zulässigen Schritt weiterarbeiten. Der Gesamtauftrag bleibt offen, solange der vereinbarte Endpunkt fehlt.

Echte Stop-Bedingungen, nur für den betroffenen Schritt:
1. Die Lösung erfordert nach konkretem Source-/Runtime-Beleg eigenen Code oder eine nicht vorhandene native Semantik.
2. Ein benötigtes Recht oder Konto ist über die vorhandenen legitimen Betreiberwege tatsächlich nicht verfügbar; bereinigten konkreten Fehler und minimal nötige Aktion nennen.
3. Eine irreversible/destruktive Handlung, ungeplante Datenfreigabe oder Überschreitung des Produkt-/Betriebsscopes wäre nötig.
4. Die reguläre unabhängige Produkt-Approval steht aus.

Kein Sicherheits-Bypass und kein Aufweichen des Auftrags nur für ein grünes Ergebnis. Bei einem echten Stop die exakte verbleibende Entscheidung kompakt vorlegen, unabhängig mögliche Arbeit abschließen und die Gesamtlieferung nicht als fertig bezeichnen.

## Liefernachweis

Bericht: handoffs/reports/AXTN-DEVSWARM-PRODUCT-NATIVE-20261017.md.
Eine knappe Tabelle je tatsächlicher Fähigkeit: native Source/Mechanismus, administrierbare UI-Fundstelle, Konfiguration/Version, Run-/Evidence-Referenz, Ergebnis/offene Grenze. Sämtliche aXtn-Sonderpfade separat sichtbar kennzeichnen; keine Behauptung „customfrei“, solange der neue Lauf davon abhängt.

Endnachweis: echter Produkt-Candidate und alle Dateien, Urheberschaft durch Swarm-Agents, exakte Gateway-Modelltraces, drei unabhängige Reviews, echte CI-Ergebnisse, native Approval-/PR-/Case-Referenzen, persistenter Snapshot und Bedienweg für Alex. Keine erfundenen Tests, Runs oder Freigaben. Am Schluss nur tatsächlich verbleibende persönliche Secret-Aktionen nennen. Gitea autoritativ, bestehende Spiegelung verwenden.

Prüfstatus dieses Auftrags: native Einzelmechanismen source-geprüft; vollständige Komposition und Hostbetrieb noch runtime-abzunehmen. Keine vorweggenommene Zusicherung vollständiger nativer E2E-Fähigkeit.


## Unmittelbare Fortsetzung — nativen Bedienzugang wiederherstellen (17.10.2026, 14:44 Europe/Berlin)

Dies ist der konkrete nächste Arbeitsschritt zum weiterhin gültigen Gesamtauftrag, kein erneutes Architektur-/Preflight-Projekt.

Ausgangsmeldung: Source-Pfad startCaseSwarm -> executeSwarmServer und deterministische MCP-Tool-Nodes seien bestätigt, aber kein authentifizierter Browser-/UI-Kontext oder nativer Steuerkanal vorhanden; Kandidat nur als 58869c… benannt. Diese Angaben sind zunächst die jüngste CLI-Meldung, kein verifizierter Live-Run oder identifizierter vollständiger Produktkandidat.

1. Zuerst Arbeitskontext auflösen und sichern: vollständigen SHA, Repo, Branch, Herkunft/Erzeuger und konkrete Typecheck-Fehler des genannten Kandidaten 58869c… feststellen. Vorhandene uncommittete Arbeit und fremde Änderungen bewahren; nichts blind überschreiben, zurücksetzen oder neu beginnen. Secret-freien Zwischenstand im bestehenden Gesamtbericht veröffentlichen, damit Gitea den realen Bearbeitungsstand zeigt.
2. Die in der aktuellen CLI-Sitzung tatsächlich vorhandenen Browser-/UI-Funktionen und vorhandenen nativen AgentSwarms-Schnittstellen feststellen. Keine aktive Sitzung nur behaupten, keine Sitzungen anderer Konten oder fremde Browserprofile auslesen. Den im vorherigen erfolgreichen Save/Publish verwendeten Bedienweg anhand vorhandener Arbeitsunterlagen identifizieren.
3. Falls Browsersteuerung vorhanden, aber abgemeldet: normale Anmeldung über den bereits dafür konfigurierten geschützten Owner-Zugang durchführen; Zugangswerte weder ausgeben noch in neue Skripte, Argumentlisten, Git, Logs oder Graphen kopieren. Keine Passwortänderung, MFA-Umgehung oder fremde Codex-Identität.
4. Falls in dieser CLI-Sitzung gar kein Browserwerkzeug vorhanden ist: das von einer fehlenden Anmeldung unterscheiden. Einen bereits verfügbaren, dokumentierten, authentifizierten nativen Server-/API-Bedienweg für Save, Publish und Case-Start prüfen. Nur tatsächlich registrierte Schnittstellen mit ihrem normalen Auth-/IAM-Vertrag nutzen. Native Schnittstellenaufrufe sind kein eigener Executor. Keinen Browser-/Connectorersatz programmieren, keine lokale MCP-Konfiguration umbauen, keine direkte DB-/Service-Role-Mutation und keinen INTERNAL_RUN_SECRET als Universalzugang verwenden.
5. Den bestehenden Case nativ lesen, den bestehenden Swarm lesen und den autorisierten Konfigurationsstand über den vorhandenen nativen Save-/Publish-Vertrag speichern. Danach Reload/Readback mit exakter Version und Owner-Scope. Bereits gespeicherte Operatoränderungen und historische Versions-/Runobjekte erhalten.
6. Bei wieder verfügbarem Zugriff unmittelbar den Gesamtauftrag fortsetzen: echten case-gebundenen Swarm-Lauf starten; Builder/Reviewer und MCP-Toolausführung mit echten Run-/Attempt-/Trace-Referenzen belegen. Nicht erneut beim Nachweis des Codepfads oder bei einem reinen Read-only-Run enden. Produktcode bleibt Aufgabe des Swarms. Testfehler gehen als konkrete Findings an den Swarm zurück, nicht als Produktpatch an CLI.
7. Für den ersten ausführbaren Lauf die bereits bestätigten deterministischen nativen MCP-Tool-Nodes verwenden, wo sie die materialisierenden Schritte sicher abbilden. LLM-Tool-Call-Frames sind nicht grundsätzlich erforderlich, wenn der konfigurierte native Graph die Tools separat ausführt. Agent-Tools nur dort aktivieren, wo sie benötigt und nachgewiesen sind. Keine neue Orchestrierung und kein Revival des alten Fixture-Harness.

Sitzungs-/Authentifizierungsgrenzen respektieren: Wenn kein nutzbares Browserwerkzeug UND kein vorhandener erlaubter nativer Steuerkanal verfügbar sind, ist das ein echter Umgebungsblocker. Dann nicht endlos weiterprobieren oder das Recht umgehen. Statt „UI fehlt“ genau eine minimale notwendige Aktion nennen: welche bestehende Copilot-Sitzung/Standard-Browserfunktion bereitgestellt werden muss, oder welcher normale Login-/MFA-Schritt erforderlich ist. Nur eine konkret beobachtete Auth-Ablehnung rechtfertigt eine Credential-Anforderung. Keine neuen Tokens oder Passwörter auf Verdacht verlangen.

Erwartete Rückmeldung: entweder fortgesetzte native Ausführung mit IDs und veröffentlichtem Zwischenstand, oder ein sauber belegter Umgebungsblocker mit exakt einer benötigten Aktion. Ein Abschluss „Task complete“ ohne Zielerfüllung bleibt unzulässig; Teilstatus ausdrücklich PARTIAL/BLOCKED nennen. Der native Gesamtauftrag wird nicht durch diese Zugangsklärung ersetzt.


## Unmittelbare Fortsetzung nach a1b9f4c — Owner-Auth korrekt wiederaufnehmen (17.10.2026)

Befund aus handoffs/reports/AXTN-DEVSWARM-PRODUCT-NATIVE-20261017.md@a1b9f4c15d0a0838690c7ec6d3871a0561a3c5c2: Eine normale Owner-Anmeldung und native Case-API-Aufrufe waren erfolgreich. Die erneute Anmeldung in der Fortsetzung wurde mit den im laufenden App-Container konfigurierten Zugangsdaten versucht und lieferte HTTP 400 invalid_credentials. Das ist kein Nachweis gegen jede vorgesehene Owner-Credentialquelle. Der Zugriff auf components/agentswarms/.env wurde durch Content-Exclusion verweigert und darf nicht über Containerinspect, Kopien, andere Pfade, Werkzeuge oder abgeleitete Ausgaben umgangen werden. Diese Fortsetzung hebt die Policy nicht auf.

Nächster konkreter Arbeitsschritt:
1. Metadaten und bestehende nichtgeheime Betriebsunterlagen zur Herkunft des vorherigen erfolgreichen Owner-Logins auswerten. Runtime-/Bootstrap-Adminvariablen nicht mit einem garantiert aktuellen Benutzerpasswort gleichsetzen.
2. Der Nutzer hatte den vorgesehenen geschützten Owner-Zugang bereits am 16.10. aktualisiert; danach war ein regulärer Auth-Check erfolgreich. Damaliger dedizierter Betreiberpfad war /home/alex/.local/share/axtn/native/agentswarms-superadmin-password. Zuerst prüfen, ob diese unabhängig bereitgestellte Credentialquelle weiterhin der vorgesehene und in dieser Sitzung erlaubte Auth-Weg ist. Nicht als Ersatzlesepfad für die ausgeschlossene .env nutzen. Die Datei oder ihren Inhalt nicht ausgeben, keine breite Secret-Suche und kein Abgleich durch Klartext-Logs. Wenn die einschlägige Policy auch diese Quelle oder das Authentifizierungsmaterial ausschließt, nicht lesen oder alternative Zugriffswege versuchen.
3. Nur wenn dieser vorgesehene Zugriff erlaubt ist: genau einen normalen Owner-Login gegen dieselbe verifizierte Instanz mit dem konfigurierten Owner durchführen, Werte ausschließlich im Auth-Prozess verarbeiten; nur Erfolg/Fehlercode protokollieren. Kein Reset, kein Service-Role-/INTERNAL_RUN_SECRET-Ersatz, keine Codex-Identität und keine Auth-DB-Mutation.
4. Nach erfolgreichem Login die normale Session-/Refresh-Funktion des vorhandenen Supabase-Auth-Clients für die laufende Arbeit nutzen. Access-Token nicht von Alex aus dem Browser kopieren lassen, nicht im Chat oder Git übertragen. Eine vorhandene regulär persistierte eigene Sitzung nur über deren normalen vorgesehenen Clientweg verwenden; keine fremden Browser-/Sitzungsspeicher auslesen. Falls kein erlaubter geschützter Persistenzweg vorhanden ist, dieselbe Auth-Sitzung in einem Arbeitsprozess verwenden und keine neue Sessionverwaltung programmieren.
5. Unmittelbar den nativen Swarm-Save/Publish/Readback und den case-gebundenen Run des Gesamtauftrags fortsetzen. Native MCP-Tool-Nodes sind zulässig; kein weiteres Architekturprojekt. Ist-Graph mit drei Nodes, gespeicherte Rollen und historische 31-/39-Node-Versionen bewusst unterscheiden; nicht versehentlich den reduzierten Builder als vollständigen Development Swarm abnehmen oder historische Versionen löschen.
6. Den bekannten Kandidaten 58869c783b076e7cada3232a1f556bc84c019a49 mit 62 Typecheck-Fehlern gegen das falsche physische Accounts-/Contacts-Schema als UNVERIFIED behandeln. Diese konkreten Findings und den bestehenden Local-Tables-Vertrag dem Swarm zur Korrektur geben. Der CLI-Agent schreibt die Produktkorrektur nicht stellvertretend. Swarm-Urheberschaft und frische Base-Kompatibilität bleiben nachzuweisen.

Falls Schritt 2 policybedingt oder Schritt 3 mit dem tatsächlich vorgesehenen Zugang scheitert: keine weiteren Passwortversuche und keine Umgehung. Exakt den bereinigten Fehler und eine einzige sichere Betreiberaktion nennen: normalen Owner-Login über einen vorgesehenen sicheren Auth-Kanal herstellen oder den vorgesehenen Credential-Eintrag geschützt aktualisieren. Keine Bitte um Token-/Passwortwerte im Chat. Eine erforderliche Anpassung einer Content-Exclusion-Policy nur über den dafür zuständigen Betreiberweg veranlassen; nicht selbst umgehen und nicht pauschal alle .env-Dateien freigeben.

Gesamtauftrag bleibt offen; nach erfolgreicher Authentifizierung direkt weiterarbeiten. Der neue Bericht muss unterscheiden: erfolgreicher nativer API-Zugriff, tatsächlicher Graph-Readback, tatsächlicher Case-Run, Fehlerkorrektur durch Swarm und noch fehlende Abnahme. Keine erledigte Implementierung aus einem gelungenen Login ableiten.
