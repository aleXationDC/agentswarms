## Jetzt ausführen: Case-Chat reparieren und Runner nativ einrichten

Stand 17.10.2026, 16:34 Europe/Berlin. Im bestehenden Gesamtauftrag handoffs/requests/AXTN-DEVSWARM-PRODUCT-NATIVE-20261017.md die jüngste „Reparaturfortsetzung nach de242674“ vollständig ausführen. Owner-Login und Save/Publish sind gelöst. PROVIDER_UNAVAILABLE ist hier ein Sammelcode, kein belegter LLMHub-Ausfall. Vor-Stream-Phase sicher im vorhandenen Fehler-/Tracepfad korrelieren, Ursache beheben, gezielt testen, erforderlichen Fix regulär bereitstellen und echten Case-Swarm fortsetzen. Keine neue Runtime/Engine, keine rohen Exceptions oder Schutzumgehung. Gitea-403 präzisieren und repo-begrenzte native Verwaltung einschließlich dokumentierter offizieller CLI über bestehenden erlaubten Betreiberzugang nutzen; keine globalen Adminrechte/Token verlangen. Runner-Blocker stoppt die Providerreparatur nicht. Gesamtauftrag nicht nach der Diagnose beenden.

## Vorheriger Fortsetzungsstand nach 2ef63a8 (17.10.2026, 14:14 UTC; historisch)

- Der vorgesehene Owner-Credentialweg authentifizierte regulär. Passwort und Access-Token wurden nicht ausgegeben oder in den Chat übertragen; die ausgeschlossene `.env` wurde nicht geöffnet oder anderweitig ausgewertet.
- Swarm `ad06e17d-460b-4b65-946a-9b5d78c6fd02` wurde nativ gespeichert und publiziert. Draft und Published Readback stimmen mit Version `62afaa0b-429b-434e-935c-781edb19509d` überein; die vorherige Version `256497c0-f577-4430-b91c-15dac21006ca` bleibt erhalten.
- Case-Runs/Attempts `fce6cb5c-a58b-52e6-a1a8-0534cc08eed2` und `8095f97f-c5dc-598a-af2c-93cc10d616f9` sind an Case `913dbf33-9891-4712-b945-aab9a5cfe5b9` gebunden. Beide führten Input und separate Gitea-MCP-Read-Nodes erfolgreich aus; der Builder `vllm/GLM-5.3-Flash` endete jeweils mit `PROVIDER_UNAVAILABLE`. Die Upsert-Node wurde nicht erreicht; kein Candidate-Write ist belegt.
- Aktueller Zwischenbericht: `handoffs/reports/AXTN-DEVSWARM-PRODUCT-NATIVE-20261017.md`. Der Remote-Head von `work/AXTN-SUPACASE-USABILITY-0001` wurde nach dem zweiten Run via `git ls-remote` erneut gelesen und bleibt `58869c783b076e7cada3232a1f556bc84c019a49`; es gab keinen Candidate-Write.
- Owner-authentifizierte native `/api/chat`-Proben mit demselben Modell lieferten bei `maxTokens=8192` und 67,200 Byte Eingabe HTTP 200; acht Provider-Frames passten zum Case-Frameformat. Persistierte `execution_bindings` belegen erfolgreiche native Route-Bindung für beide Case-Runs. Der Runtime-Log nennt `chat route error`, nicht den separaten `Provider vllm error`-Pfad; der Fehler liegt damit vor dem Provider-Stream. Die genaue Route-Phase bleibt mangels `execution_traces` unaufgelöst.
- Gitea läuft als `gitea/gitea:1.27.3`; auf dem Host ist kein `act_runner`-Executable, Runner-Container oder Runner-Systemdienst vorhanden. Die direkte Gitea-API antwortet am vorgesehenen Endpunkt mit 403, daher wurde kein offizieller Runner registriert oder konfiguriert.
- Nächster Schritt: den Vor-Stream-Fehler der nativen Case-Chat-Auflösung sicher mit Run-/Trace-Korrelation diagnostizieren; keine rohen Exceptions, Credentials oder Case-Daten offenlegen und keine weiteren identischen Runs ohne konkreten Befund. Keine Case-Route, Rollen oder Zugangsschutz umgehen. Den offiziellen Runner nur über den autorisierten Gitea-Administrationsweg einrichten. Der Gesamtauftrag bleibt offen; kein PASS, CI, Review, Approval oder Produkt-PR ist belegt.

Die neue Fortsetzung „Owner-Auth korrekt wiederaufnehmen“ ist damit ausgeführt. Keine Credential-Anforderung auf Verdacht, kein Browser-/Connectorersatz, kein direkter DB-/Service-Role-Bypass und kein Umbau des funktionierenden CLI-MCP. Die Ziele und Sicherheitsgrenzen unten bleiben gültig.

## Fortsetzung nach a10b4e98 — 17.10.2026, 16:30 UTC

- Case-Pfad-Fix `f3bd040cfe2b3250e65a65fa58fde06f63feeebc` ist auf `fix/AXTN-CASE-CHAT-PHASE-DIAGNOSTICS-20261017` gepusht und deployed. Der laufende AgentSwarms-Container meldete diese Revision und `/api/health` lieferte HTTP 200. Gezielte Tests, Typecheck und Produktionsbuild waren erfolgreich.
- Repo-scoped CI-Konfiguration ist versioniert: aXtn-git Branch `work/AXTN-GITEA-CI-RUNNER-0001` bei `b79e78bb3e82d0b4d97560c5913e27afc0746cb3` aktiviert Gitea Actions; AgentSwarms-Branch `fix/AXTN-CASE-CHAT-PHASE-DIAGNOSTICS-20261017` bei `0a3cbf821dd9425f76462b8ed5986f5da0d49b5b` fügt `.gitea/workflows/ci.yaml` mit `npm ci` und `npm run check` hinzu.
- Der Host-Branch `work/AXTN-DEVELOPMENT-SWARM-NATIVE-0002` bei `cad8500a00995c98707045b04bc337fd351a96aa` enthält den digest-gepinnten offiziellen Gitea Runner, repo-scoped Registrierung über eine geschützte Token-Datei und isolierte Job-Netzwerkkonfiguration. Runner-Config wurde vom gepinnten Binary geparst; der gepinnte Job-Container enthält Node 24.19.0, npm 11.17.0 und Git 2.55.0. Jobs sind nicht privilegiert, haben keine erlaubten Host-Volumes, keine injizierte Env-Datei und erhalten den Host-Socket nicht (`container.docker_host: "-"`); Cache ist aus.
- Der neue `axtn_git_ci`-Bridge ist mit dem Scope-Label für dieses Repository angelegt und hat aktuell ausschließlich `axtn-gitea` als Mitglied. Es gibt keinen Runner-Container, keine `.runner`-Registrierung und keinen generierten Registrierungstoken.
- Gitea-403 ist ein absichtliches Sign-in-Gate (`REQUIRE_SIGNIN_VIEW`), keine Netzwerkstörung; die scoped Gitea-Branch-Pushes funktionierten über den bereits konfigurierten SSH-Weg. Der geschützte Gitea-Compose-Deployment-Input wurde durch Content-Exclusion abgewiesen. Es wurde weder erneut darauf zugegriffen noch ein alternativer Container-/Bundle-/Compose-Weg verwendet; deshalb ist `GITEA__actions__ENABLED=true` noch nicht live und es wurde kein Runner-Token angefordert.
- Lokales `npm run check`: Typecheck, Lint und Dokumentationsprüfungen liefen durch; Vitest meldete 10.044 bestanden, 40 übersprungen und 2 fehlgeschlagene Assertions in `tests/unit/documentRecoveryInventory.test.ts` (stale Router-Revision und SHA-256-Erwartung). `npm run build` war separat erfolgreich. Damit ist kein CI-PASS belegt; diese beiden Inventory-Abweichungen dürfen nicht übersprungen werden.
- Es wurde kein weiterer Owner-Case-Run gestartet: In diesem CLI-Kontext liegt keine live Owner-Session vor. Es erfolgte kein neuer Login-Versuch und es wurden keine Credentials angefordert. Die native Case-Ausführung und Candidate-Korrektur bleiben Swarm-Aufgabe.

**Nächste sichere Aktionen:** Ein autorisierter Betreiber muss den Gitea-Compose-Branch über den normalen genehmigten Pfad bereitstellen und Gitea mit den geschützten Deployment-Inputs neu starten; danach kann der repo-scoped Runner über die offizielle Gitea-CLI registriert und der reale Workflow verifiziert werden. Für den Case-Run ist eine bereits regulär angemeldete Owner-Sitzung über den unterstützten AgentSwarms-Bedienweg erforderlich; kein Passwort oder Token im Chat. Anschließend den case-gebundenen Swarm-Lauf fortsetzen, Candidate-Urheberschaft dem Swarm überlassen und echte CI-/Review-/Approval-Nachweise sammeln.

# Development Swarm — aktueller Gesamtauftrag

Stand: 17.10.2026. Tracking: aXtn/aXtn-agentswarms#7.
Handoff-Branch: work/AXTN-NATIVE-SWARM-COMPLETION-20261016.

## Einziger maßgeblicher Ausführungsauftrag

handoffs/requests/AXTN-DEVSWARM-PRODUCT-NATIVE-20261017.md

Ziel: nativ administrierbarer Swarm bearbeitet selbst AXTN-SUPACASE-USABILITY-0001 aus Architektur-PR #8 bis zu unabhängig geprüfter Approval und reviewbarem, ungemergtem Produkt-PR. Copilot richtet native Konfiguration und Standardintegration ein und behebt gewöhnliche Fehler; Produktcode entsteht durch die Swarm-Agents.

Ausschließlich native AgentSwarms-Funktionen sowie Gitea-Standardfunktionen und offizielle CI-Runner konfigurieren. Keine eigenen Runtimes, Harness-Dienste, Dispatcher, Polling-/Callback-Dienste oder selbst geschriebenen Function-Ersatzmechanismen. Gitea-CI ist nicht als eingebauter AgentSwarms-TypeScript-Runner zu bezeichnen. Vorhandene aXtn-Erweiterungen transparent kennzeichnen.

Native Einzelmechanismen sind source-geprüft; vollständige sichere asynchrone Komposition, Gate und Hostbetrieb sind noch nicht E2E nachgewiesen. Der Gesamtauftrag benennt diese Grenzen ausdrücklich. Der fehlende CI-Nachweis verhindert PASS/Acceptance, aber nicht die zulässige Erstellung eines UNVERIFIED-Produktkandidaten und unabhängige Reviews.

Nicht nach Preflight/Phase A erneut als „Task complete“ enden. Native Konfiguration, offizieller Runner, Auth-/Session-Wiederaufnahme und gewöhnliche Fehler sind Einrichtungsarbeit. Nur eigene zusätzliche Codemechanismen, tatsächlich unerreichbare Rechte, destructive Scope-Erweiterungen oder ausstehende echte unabhängige Approval sind konkrete Stop-Gründe für den betroffenen Schritt. Andere Arbeit fortsetzen.

AGENTS.md, aktuellen Gesamtauftrag und die drei versionierten PR-#8-Auftragsverträge vollständig lesen. Frühere Fixture-/Canary-Beschränkungen werden durch diesen Gesamtauftrag für den aktuellen Produktpfad abgelöst, nicht durch stille Lockerung von Sicherheitsprüfungen. Gitea-/Produkt-Allowlist bleibt eng; kein Main-Write, Merge oder Produktdeploy.

## Bestand und Herkunft

Letzter gelesener Befund: c7133df89db096bf1fa91452b8e46d716241753d,
handoffs/reports/AXTN-DEVSWARM-NATIVE-FIRST-20261016.md.
Er belegt einen publizierten Read-only-Snapshot und native MCP-Reads ohne LLM-Agenten, keinen Produktkandidaten.

Historische Canary-/Ausführungsverträge:
- docs/architecture/axtn-development-swarm/V1-IMPLEMENTATION-CONTRACT.md
- handoffs/requests/AXTN-DEVELOPMENT-SWARM-IMPLEMENTATION-0001.md
- handoffs/requests/AXTN-DEVELOPMENT-SWARM-NATIVE-0002.md
- handoffs/requests/AXTN-DEVSWARM-NATIVE-FIRST-20261016.md

Vorheriger vollständiger Handoff einschließlich Historie ist unter Commit 991b742bb66b24960dc195e28320d7988dddca44 zurücklesbar. Keine historischen Runs, Cases, Versionsobjekte oder Evidence löschen.

Die separat autorisierten nativen Restreparaturen aus handoffs/requests/AXTN-DEVSWARM-CLOSURE-20261016.md und die sichere Rotation genau der zwei offengelegten internen Secrets bleiben gültig. Keine zusätzliche allgemeine Secret-/Credential-Rotation und keine erneute allgemeine Freigabefrage. Keine Secretwerte in Ausgaben, Git, Graph oder Cases.
