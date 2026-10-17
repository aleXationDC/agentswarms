# AXTN Development Swarm — Zwischenstand

Stand: 17.10.2026, 14:14 UTC

Tracking: `aXtn/aXtn-agentswarms#7`

Handoff: `work/AXTN-NATIVE-SWARM-COMPLETION-20261016@2ef63a8196a31f1e3239460cfdf4f4a60c85f3bd`

Status: **PARTIAL / BLOCKED an der case-spezifischen Provider-/Chat-Auflösung**. Der vorgesehene Owner-Credentialweg funktionierte mit regulärem Supabase-Login. Der bestehende Swarm wurde nativ gespeichert und publiziert; zwei case-gebundene Runs führten jeweils beide getrennten Gitea-MCP-Lese-Nodes erfolgreich aus, scheiterten aber beim Builder-Agent mit `PROVIDER_UNAVAILABLE`. Ein gezielter owner-authentifizierter nativer `/api/chat`-Probeaufruf mit demselben `vllm/GLM-5.3-Flash`-Modell lieferte HTTP 200 und acht provider-originierte SSE-Frames im Case-Frameformat. Der Fehler ist daher nicht durch generelle Modell-/Endpoint-Unerreichbarkeit belegt; der Fehler der Case-Ausführung bleibt unaufgelöst. Die Upsert-Node wurde nicht erreicht und kein Produktcode geändert. Es gibt keinen neuen Candidate-SHA und keinen erfolgreichen Produktlauf, Review, CI-Nachweis, Approval oder PR.

## Aktueller Fortsetzungsstand — 17.10.2026, 14:14 UTC

Der Owner-Login erfolgte regulär über den im Auftrag benannten geschützten Credentialweg. Passwort und Access-Token wurden weder ausgegeben noch in den Chat übertragen; die Auth-Sitzung wurde unmittelbar für native Owner-RLS-Reads, Save/Publish und Case-Start verwendet. Die ausgeschlossene `.env` wurde nicht geöffnet oder über andere Wege ausgewertet.

Der Development Swarm `ad06e17d-460b-4b65-946a-9b5d78c6fd02` wurde nativ gespeichert und publiziert. Draft und Published Readback stimmen mit Version `62afaa0b-429b-434e-935c-781edb19509d` überein. Der veröffentlichte Graph enthält sechs Nodes: Input, Builder, Output, zwei separate Gitea-MCP-Read-Nodes sowie eine begrenzte Upsert-Node. Die vorherige Version `256497c0-f577-4430-b91c-15dac21006ca` bleibt erhalten. Dieser fokussierte Builder-Graph ist nicht der vollständige Development Swarm mit allen Rollen.

Der Case-Run/Attempt `fce6cb5c-a58b-52e6-a1a8-0534cc08eed2` war an den bestehenden Master-Data-Case `913dbf33-9891-4712-b945-aab9a5cfe5b9` und die Published-Version gebunden. Native `swarm_run_steps` zeigen Input `success`, beide Gitea-MCP-Lese-Nodes `success`, danach Builder `error` mit Provider `vllm`, Modell `GLM-5.3-Flash`, Fehlercode `PROVIDER_UNAVAILABLE` (96 ms). Der Lauf endete mit `step_count=4`, `error_count=1`; die Upsert-Node wurde nicht ausgeführt.

Ein zweiter nativer Case-Run/Attempt `8095f97f-c5dc-598a-af2c-93cc10d616f9` auf derselben veröffentlichten Version und Case-Bindung endete ebenso mit `error`, `step_count=4`, `error_count=1`, Builder `PROVIDER_UNAVAILABLE` (99 ms). Die Eingaben der beiden erfolgreichen MCP-Lese-Nodes waren 28,488 und 38,074 Bytes; der Builder-Eingabe-Prompt war 70,220 Bytes. Der Case-Log gibt nur den bereinigten Code aus und es wurde kein `execution_traces`-Datensatz für den Aufruf persistiert, deshalb ist die konkrete Ausnahme im aktuellen Evidence-Pfad nicht sichtbar. Owner-authentifizierte native `/api/chat`-Proben mit demselben vLLM-Modell antworteten sowohl bei `maxTokens=8192` als auch mit 67,200 Byte Eingabe HTTP 200; die acht Provider-Frames vor dem App-generierten `cost`-Event entsprachen dem Case-Framevertrag. Diese Proben schließen allgemeine Provider-/Promptgrößenprobleme nicht vollständig aus, belegen aber nicht den Case-spezifischen Credentialpfad.

Beide Case-Bindungen weisen `SYSTEM_INTEGRATION` / `CASE_SYSTEM_POLICY` mit Route `vllm/GLM-5.3-Flash` aus; die Owner-vLLM-Integration ist aktiv und es gibt genau einen aktiven Owner-vLLM-Integrationsdatensatz sowie keinen aktiven Owner-vLLM-Datensatz in `provider_credentials`. Die persistierten Case-`execution_bindings` belegen, dass die native `resolve`-Operation für den Builder die Route erfolgreich gebunden hat. Der Runtime-Log nennt `chat route error` statt des separaten `Provider vllm error`-Pfads, was den Fehler vor dem Provider-Stream eingrenzt. Die genaue fehlschlagende Route-Phase ist mangels `execution_traces` weiterhin nicht feststellbar. Der Remote-Head von `work/AXTN-SUPACASE-USABILITY-0001` wurde nach dem zweiten Run via `git ls-remote` gelesen und steht weiterhin auf `58869c783b076e7cada3232a1f556bc84c019a49`. Die Runs erzeugten keinen Candidate-Write. Die Produktkorrektur bleibt ausschließlich Aufgabe des Swarms.

Der installierte Gitea-Container läuft mit `gitea/gitea:1.27.3`. Auf dem Host ist kein `act_runner`-Executable, aktiver Runner-Container oder Runner-Systemdienst vorhanden; die direkte Gitea-API ist weiterhin nicht erreichbar (403 am vorgesehenen API-Endpunkt). Eine offizielle Runner-Registrierung konnte daher nicht geprüft oder vorgenommen werden. Es wurden keine Runner-Credentials angefordert oder erzeugt.

**Nächster Schritt:** den Vor-Stream-Fehler in der nativen Case-Chat-Auflösung über einen sicheren Diagnosekanal mit Run-/Trace-Korrelation weiter eingrenzen, ohne rohe Exceptions, Credentials oder Case-Daten offenzulegen; keine weiteren identischen Runs ohne konkreten Befund. Den offiziellen Gitea-Runner erst über den autorisierten Gitea-Administrationsweg registrieren und isoliert betreiben. Der Candidate bleibt **UNVERIFIED**; sein Typecheck hatte 62 Fehler im falschen physischen Accounts-/Contacts-Schema. Kein PASS, Review, CI, Approval oder Produkt-PR ist belegt.

## Kandidat 58869c783b076e7cada3232a1f556bc84c019a49

| Feld | Verifizierter Stand |
|---|---|
| Repository / Branch | `aXtn/axtn-agentswarms`, `work/AXTN-SUPACASE-USABILITY-0001` |
| Base / Kandidat | `ed66570a9e1139f1e2e9cb145a2f3a5117265a3e` → `58869c783b076e7cada3232a1f556bc84c019a49` |
| Herkunft | Acht Commits seit der Base; Git-Autor ist jeweils `aXtn Gitea MCP`. Der ergänzende UI-Lauf `021afe9c-a4bc-4388-ac37-bbe15286c0b3` war ungebunden. Eine durchgängige case-gebundene Swarm-Urheberschaft ist damit nicht belegt. |
| Geänderte Dateien | `src/axtn/workbenches/cases/accountManagement.server.ts`, `caseContract.ts`, `caseManagement.functions.ts`; `src/routes/_authenticated/accounts.tsx`, `accounts_.$accountId.tsx`, `contacts.tsx`, `contacts_.$contactId.tsx`; `tests/unit/supacaseUsabilityAcceptance.test.ts` |
| Typecheck | `npm run typecheck` auf exakt SHA `58869c…`: **FAILED, 62 TypeScript-Fehler**, alle im neuen `accountManagement.server.ts`. Der Code fragt physische `accounts`/`contacts`-Tabellen ab, während das vorhandene Case-Modell generische `axtn_accounts`/`axtn_contacts`-Datensätze über `user_data_tables`/`user_data_rows` verwendet. |
| Tests / CI / Review | Die synthetischen Tests wurden nicht als Abnahme ausgegeben; Tests und Gitea-CI sind nicht ausgeführt. Kein vollständiger unabhängiger Review, keine Approval und kein Produkt-PR. |
| Aktuelle Base-Einordnung | Gitea-`main` wurde frisch als `d87a155626d6564416b590bc0e0efb7e8f75436e` gelesen. Die Kompatibilität des älteren Kandidaten-Bases mit `main` ist noch nicht bestätigt. |

Der Route-Generator änderte beim Typecheck zwei `createFileRoute`-IDs. Beide Änderungen wurden auf den Ausgangsinhalt zurückgesetzt; der geprüfte lokale Candidate-Checkout ist wieder tracked-clean und steht weiterhin exakt auf `58869c…`.

## Native Bedienung und Case-Zuordnung — Stand 13:14 UTC (historisch; durch obigen Update ersetzt)

| Fähigkeit | Mechanismus / Konfiguration | Readback / Ergebnis |
|---|---|---|
| Anmeldung | Regulärer Supabase-Auth-Passwort-Grant mit dem bereits konfigurierten Owner-Zugang; kein Passwort-/MFA-Reset und keine Verwendung eines Service-Role- oder `INTERNAL_RUN_SECRET`-Zugangs. | Im vorherigen CLI-Durchlauf war die Owner-Anmeldung erfolgreich. Diese kurzlebige Sitzung wurde nicht in die Fortsetzung übernommen. Der erneute Grant mit den aktuell im laufenden App-Container konfigurierten Zugangsdaten antwortete HTTP 400 `invalid_credentials`; die konfigurierte `VITE_ADMIN_EMAIL` ist keine abweichende Login-Identität. In dieser Fortsetzung liegt deshalb kein verwendbares Owner-Bearer vor. |
| Case-Administration | Bestehender nativer Endpunkt `/api/cases/work`, Operation `external_references`; owner-authentifiziert, erwartete Referenzversionen und idempotente Transition-Keys. | Kandidatenreferenz `gitea://aXtn/axtn-agentswarms/work/AXTN-SUPACASE-USABILITY-0001@58869c783b076e7cada3232a1f556bc84c019a49` auf Parent `85a1d829-39ac-49bd-9047-163ab52d427b`, Graph-Child `43d22cf1-8767-40ef-b682-785607e6d724`, Produkt-Parent `ad8690f3-ecb3-4db1-a5e9-44a9752de2d2` und dessen vier bestehenden Arbeitspaketen `913dbf33-9891-4712-b945-aab9a5cfe5b9`, `b1be1c70-fba1-4ebb-be6d-2bf6640d0d79`, `27617016-6cdf-4e2c-b063-2e970e4fc0fb`, `a3c8feda-9953-44c8-985c-81b58b47854a` zurückgelesen. Es wurden keine Cases neu angelegt und keine Case-Status auf Acceptance gesetzt. |
| Bestehender Development Swarm | Owner-gebundener RLS-Read des Swarms `ad06e17d-460b-4b65-946a-9b5d78c6fd02`; aktuell drei Nodes und zwei Edges. | Draft und veröffentlichter Snapshot `0bd41ea5-3846-4e88-b6d0-d94020b07b18`; Owner-Scope bestätigt. Der Snapshot ist aktuell noch der fokussierte Builder mit Agent-MCP-Tools; `is_deployed=false`. |
| Case-gebundener Lauf | Die aktive UI verwendet den nativen `startCaseSwarm`-Serverfunktionsweg; der Server bindet `case_id`/`case_run_id` an `executeSwarmServer`. Separate `mcp_call_tool`-Tool-Nodes sind im Headless-Executor zugelassen. | Noch nicht gestartet. Der bestehende Graph muss vor dem Lauf auf sichtbare deterministische Gitea-MCP-Tool-Nodes umgestellt und nativ gespeichert/publiziert werden. Der Server-/Case-API-Pfad ist vorhanden; ohne aktuelle Owner-Sitzung kann der native RLS-Save-/Publish-/Start-Vertrag nicht aufgerufen werden. |

Die bestehende Produkt-Case-Lineage bleibt offen. Frühere ungebundene Runs und der fehlgeschlagene Case-Run `a7444ac2-90b1-5b78-ad70-78f1107ef18d` bleiben historische Evidence und werden nicht als erfolgreiche case-gebundene Candidate-Arbeit umgedeutet.

## Veröffentlichung

Der Handoff-Branch wird unverändert vom kanonischen Gitea in den bestehenden GitHub-Fork `aleXationDC/agentswarms` gespiegelt. Commit `6499230f60532468a7a8c8681f5f3974ce237638` wurde auf beiden Remotes per `ls-remote` bestätigt. Der frühere Eintrag, der `aleXationDC/aXtn-agentswarms` als Mirror bezeichnete, war falsch: diese GitHub-Repository-Adresse liefert 404. Es wurde kein GitHub-`main` verändert.

Der native Owner-Login und die Case-APIs funktionieren regulär; der aktuelle Blocker ist die case-spezifische Providerauflösung. Es ist keine Token- oder Passwortbereitstellung erforderlich.

## Nächste Arbeit — Stand 13:14 UTC (historisch; durch obigen Update ersetzt)

1. Den veröffentlichten Swarm über den vorhandenen nativen Save-/Publish-Weg mit separaten Gitea-MCP-Tool-Nodes ausstatten; Rollenmodell, Gateway-Opt-ins und bestehende Versionshistorie erhalten.
2. Auf dem bestehenden Master-Data-Case einen echten gebundenen Run starten und Trace, Run, Attempt und Candidate-Referenzen zurücklesen. Produktkorrekturen erstellt ausschließlich der Swarm.
3. Candidate-Repair auf einer frisch geprüften kompatiblen Base fortsetzen. Danach echte Tests, offizielle Gitea Actions, drei unabhängige Reviews und native Approval getrennt nachweisen. Fehlende CI sperrt PASS/Acceptance, nicht die zulässige Candidate-Arbeit.
4. Den Bericht nach jeder materiellen Veränderung ergänzen. Es gibt noch keinen PR, Merge oder Produktdeploy.
