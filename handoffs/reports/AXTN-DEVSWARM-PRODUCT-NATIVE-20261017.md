# AXTN Development Swarm — Zwischenstand

Stand: 17.10.2026, 13:14 UTC

Tracking: `aXtn/aXtn-agentswarms#7`

Handoff: `work/AXTN-NATIVE-SWARM-COMPLETION-20261016@f63ccd8d990924bee3fb49e1da51226c643e1f9e`

Status: **PARTIAL**. Der vorhandene Produktkandidat ist eindeutig identifiziert, erneut typgeprüft und in der bestehenden Case-Lineage nativ referenziert. Der alte UI-Blocker war nicht „fehlende Anmeldung“: In dieser CLI-Sitzung gibt es weder ein Browserwerkzeug noch einen laufenden Browser/CDP-Endpunkt, aber der bestehende geschützte Owner-Zugang konnte regulär am Supabase-Auth-Endpunkt angemeldet werden. Danach waren die vorhandenen AgentSwarms-Server- und Case-APIs mit derselben Sitzung erreichbar. Der case-gebundene Swarm-Lauf und die Graph-Umstellung folgen; es wird noch kein erfolgreicher Produktlauf behauptet.

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

## Native Bedienung und Case-Zuordnung

| Fähigkeit | Mechanismus / Konfiguration | Readback / Ergebnis |
|---|---|---|
| Anmeldung | Regulärer Supabase-Auth-Passwort-Grant mit dem bereits konfigurierten Owner-Zugang; kein Passwort-/MFA-Reset und keine Verwendung eines Service-Role- oder `INTERNAL_RUN_SECRET`-Zugangs. | Authentifizierte Sitzung akzeptiert. Das belegt vorhandene Anmeldung über API, nicht eine vorhandene Browsersteuerung. |
| Case-Administration | Bestehender nativer Endpunkt `/api/cases/work`, Operation `external_references`; owner-authentifiziert, erwartete Referenzversionen und idempotente Transition-Keys. | Kandidatenreferenz `gitea://aXtn/axtn-agentswarms/work/AXTN-SUPACASE-USABILITY-0001@58869c783b076e7cada3232a1f556bc84c019a49` auf Parent `85a1d829-39ac-49bd-9047-163ab52d427b`, Graph-Child `43d22cf1-8767-40ef-b682-785607e6d724`, Produkt-Parent `ad8690f3-ecb3-4db1-a5e9-44a9752de2d2` und dessen vier bestehenden Arbeitspaketen `913dbf33-9891-4712-b945-aab9a5cfe5b9`, `b1be1c70-fba1-4ebb-be6d-2bf6640d0d79`, `27617016-6cdf-4e2c-b063-2e970e4fc0fb`, `a3c8feda-9953-44c8-985c-81b58b47854a` zurückgelesen. Es wurden keine Cases neu angelegt und keine Case-Status auf Acceptance gesetzt. |
| Bestehender Development Swarm | Owner-gebundener RLS-Read des Swarms `ad06e17d-460b-4b65-946a-9b5d78c6fd02`; aktuell drei Nodes und zwei Edges. | Draft und veröffentlichter Snapshot `0bd41ea5-3846-4e88-b6d0-d94020b07b18`; Owner-Scope bestätigt. Der Snapshot ist aktuell noch der fokussierte Builder mit Agent-MCP-Tools; `is_deployed=false`. |
| Case-gebundener Lauf | Die aktive UI verwendet den nativen `startCaseSwarm`-Serverfunktionsweg; der Server bindet `case_id`/`case_run_id` an `executeSwarmServer`. Separate `mcp_call_tool`-Tool-Nodes sind im Headless-Executor zugelassen. | Noch nicht gestartet. Der bestehende Graph muss vor dem Lauf auf sichtbare deterministische Gitea-MCP-Tool-Nodes umgestellt und nativ gespeichert/publiziert werden. |

Die bestehende Produkt-Case-Lineage bleibt offen. Frühere ungebundene Runs und der fehlgeschlagene Case-Run `a7444ac2-90b1-5b78-ad70-78f1107ef18d` bleiben historische Evidence und werden nicht als erfolgreiche case-gebundene Candidate-Arbeit umgedeutet.

## Nächste Arbeit

1. Den veröffentlichten Swarm über den vorhandenen nativen Save-/Publish-Weg mit separaten Gitea-MCP-Tool-Nodes ausstatten; Rollenmodell, Gateway-Opt-ins und bestehende Versionshistorie erhalten.
2. Auf dem bestehenden Master-Data-Case einen echten gebundenen Run starten und Trace, Run, Attempt und Candidate-Referenzen zurücklesen. Produktkorrekturen erstellt ausschließlich der Swarm.
3. Candidate-Repair auf einer frisch geprüften kompatiblen Base fortsetzen. Danach echte Tests, offizielle Gitea Actions, drei unabhängige Reviews und native Approval getrennt nachweisen. Fehlende CI sperrt PASS/Acceptance, nicht die zulässige Candidate-Arbeit.
4. Den Bericht nach jeder materiellen Veränderung ergänzen. Es gibt noch keinen PR, Merge oder Produktdeploy.
