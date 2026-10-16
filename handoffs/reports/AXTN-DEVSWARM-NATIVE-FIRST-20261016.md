# AXTN-DEVSWARM-NATIVE-FIRST-20261016 — aktueller Ausführungsbefund

Stand: 16.10.2026

Status: **BLOCKED / NOT_READY — native read-only Phase A abgeschlossen; Produktänderung nicht gestartet**

Aktueller Handoff: `aXtn/aXtn-agentswarms@318d20724411464a50f37a4b89e96a407925b8cf`

Architekturauftrag: `aXtn/aXtn-architecture@14b51ce781eeecfe766f6fe8dd83c0b393b2c2c1`

## Fortsetzung — echte native Phase-A-Ausführung

- Die authentifizierte AgentSwarms-Administration speicherte und veröffentlichte den bestehenden Swarm `ad06e17d-460b-4b65-946a-9b5d78c6fd02` („Builder“). Veröffentlicht am `2026-10-16T22:34:57.671Z`, Version `97e53118-3fd6-49d3-bb5b-f51d7cd4d1a1`, 39 Nodes / 42 Edges; Reload bestätigte, dass Draft und Published Snapshot synchron sind.
- AgentSwarms lief mit Image `axtn-agentswarms-native:783ed4ecfd4d245e56b000bf1d7af9e6f61a7079`, Image-ID `sha256:1de2d89d41363ead364d11262a7e346ad60a1453d7222ff5c93fe9096fc82d0b`.
- Der Canvas-Run `18dc37af-bc5f-43c8-b1c4-68f69c3f1448` lief mit der exakten Eingabe `__AXTN_PHASE_A_READ_ONLY__` und endete `success` (`2026-10-16T22:37:06Z` bis `22:37:09Z`, 39 Steps, 9 erfolgreich, 30 übersprungen, 0 Fehler, 8 geflossene Edges). Persistierter Trace: `/analytics/observability/18dc37af-bc5f-43c8-b1c4-68f69c3f1448`.
- Die Function-Node „Exact Phase A route selector“ gab `phase-a` aus; der Exact Router gab dieselbe Route aus. Erfolgreiche read-only MCP-Nodes: „Read work order“, „Read Swarm contract“, „Read test contract“, „Read product tree“ und „Read product manifest“. Der Run verwendete keine LLM-Agenten.
- Der alte Task-/Builder-/Verify-Pfad sowie Branch-, Datei-, Candidate-, Case-, Approval- und PR-Wirkungen wurden übersprungen. Kein Produktbranch wurde erstellt; keine Produktdatei, kein PR und kein CI-/n8n-Job wurde geändert oder gestartet.
- Die vorhandenen Modellbindungen blieben unverändert: Builder `GLM-5.3-Flash`, Contract `GLM-5.2`, Security `gpt-oss-120b`, Maintainability `Mistral-Small-4-119B-2603`. Da dieser Run deterministisch war, belegt er keinen Modellaufruf oder Gateway-Inferenzlauf.

## Gelesene Auftrags- und Produktrevisionen

Die drei Auftragsdateien wurden vollständig aus `aXtn/aXtn-architecture@14b51ce781eeecfe766f6fe8dd83c0b393b2c2c1` gelesen:

| Datei | Gitea-Datei-SHA |
|---|---|
| `work-orders/AXTN-SUPACASE-USABILITY-0001.md` | `e7b4d81cccb9244210020edda41b16da01d099cf` |
| `work-orders/AXTN-SUPACASE-USABILITY-0001-SWARM.md` | `6488f5fa774a71498f1eecc9152289b3f79dc14b` |
| `work-orders/AXTN-SUPACASE-USABILITY-0001-TEST.md` | `1cb06ac62b73c82f653b113f6041dcfe8c334085` |

Der native Gitea-Read bezog den Produktkontext aus `aXtn/axtn-agentswarms@084da7686b8254f56eb3ea8fe5be90e51a98d771`. Die Root-Tree-Antwort enthielt 47 Einträge und war nicht abgeschnitten. `package.json` hatte Datei-SHA `3ec28aec14ab068210095fb7d53888ad9160e9df`. Der Vertrag verlangt Node `>=20.19`; `typecheck` führt `generate:routes` und `tsc --noEmit -p tsconfig.json` aus, `test` führt `vitest run` aus; außerdem sind Integrationstests und Production-Build definiert. Diese Manifeste belegen Prüfanforderungen, aber keinen ausführbaren Runner.

## Aktuelle native Fähigkeitsprüfung

- **Gitea MCP:** Die fünf oben genannten Leseaufrufe wurden real im Swarm ausgeführt. Die verwendeten nativen MCP-Schemas lesen Gitea-Repository-/Datei-/Tree-Daten; sie bieten keinen Shell-, Prozess-, npm-, TypeScript- oder CI-Test-Runner. Es wurden keine Schreibwerkzeuge aufgerufen. Die frühere Aussage, dass das Zielrepo nicht lesbar sei, ist durch diese Readbacks überholt; ein Schreibpfad wurde in diesem Run nicht geprüft oder benutzt.
- **Developer/Notebook Runtime:** Das native Kernel-Image basiert auf `python:3.12-slim`. Der geschützte aXtn-Verify-Vertrag ist auf `python-normalization-v1` und `documentation-v1`, das Acceptance-Repository und begrenzte Snapshots festgelegt. Das ist kein TypeScript-/React-Produktprüfprofil.
- **JS Sandbox:** Der vorhandene `js-sandbox` führt kurzlebige Function-/Component-Snippets in einer isolierten Node-VM aus. Der Worker erhält keine Node-Interna, keinen Dateisystem-, Netzwerk- oder Storage-Zugriff. Er kann daher weder das Produktrepository prüfen noch `tsc`, Vitest oder den Produkt-Build ausführen.
- **n8n:** Die native Integrationsansicht meldete eine authentifizierte Verbindung, 7 sichtbare Workflows und 0 aktive Workflows. Kein Workflow wurde ausgeführt.
- **CI/Gitea Actions:** Die read-only Hostinventur zeigte keinen `act_runner`- oder sonstigen CI-Runner-Container. Die registrierte MCP-Oberfläche bietet keine Actions-/Runner-Abfrage oder Workflow-Dispatch-Funktion. Ein extern registrierter Gitea-Runner oder ein tatsächlich gelaufener CI-Job ließ sich mit dem vorhandenen nativen Lesezugriff nicht belegen. Ein Workflow-Verzeichnis oder `package.json`-Skripte allein gelten nicht als Laufnachweis.

## Aktuelles Urteil und Case-Lineage

Der echte native Quellkontext-/Toollauf ist **PASS**. Die Annahme von `AXTN-SUPACASE-USABILITY-0001` für Produktänderungen ist **NOT_READY**: Ein bereits vorhandener, erreichbarer und autorisierter deterministischer TypeScript-/React-Runner samt echter Ausführung wurde nicht nachgewiesen. Die Arbeit endet daher vor Produktwrites. Es gibt keinen Candidate, keine TypeScript-Prüfung, keine Breaker-Ergebnisse, keine Acceptance und keinen Review-PR. Eine neue Runtime, ein eigener Executor, ein Function-Node-Test-Dispatcher oder ein externer Ersatz-Builder wird nicht eingeführt.

Die bestehende Parent-Case-Lineage `85a1d829-39ac-49bd-9047-163ab52d427b` und der Graph-Child `43d22cf1-8767-40ef-b682-785607e6d724` werden weiterverwendet; es wurde kein Case erzeugt und keine Acceptance behauptet. Dieser Bericht ist die stabile Evidence-Quelle für die veröffentlichte Version, den Run und den präzisen Blocker. Fortsetzung nur über einen tatsächlich vorhandenen, nativ erreichbaren und autorisierten TypeScript-Prüfweg.

Der letzte native Case-Detail-Readback zeigte den Graph-Child als `OPEN`. In dieser CLI-Sitzung war keine aktive authentifizierte AgentSwarms-UI-Session verfügbar; daher konnte die vorgesehene native `BLOCKED`-Transition mit `TYPESCRIPT_RUNNER_UNAVAILABLE` und Evidence-Referenz auf diesen Bericht nicht geschrieben oder zurückgelesen werden. Es wurde weder direkt in die Datenbank geschrieben noch ein Ersatz-Case-Pfad benutzt. Die Case-Transition bleibt ein offener Abschluss-Schritt.

## Historischer Ist-Stand vor der authentifizierten Fortsetzung (Handoff `991b742`)

- Der laufende AgentSwarms-App-Container antwortet auf `http://127.0.0.1:18080/` mit HTTP 200 und verwendet Image `axtn-agentswarms-native:57fe65cbc88f9592c678d103b240458433419647` (`sha256:f04c13b962471c61aa445c271979d0073b3c01393a3d0184f55fbe8df56ea1d4`). Der gespeicherte Development Swarm `ad06e17d-460b-4b65-946a-9b5d78c6fd02` hat den veröffentlichten Snapshot `f7fc9cb5-3ffb-49e1-93a7-009b099ba55a` mit 31 Nodes und 34 Edges. Der Datenbank-Readback meldet zugleich `is_deployed=false`; ein deployter Graph-Snapshot wird daher nicht behauptet.
- Die laufende native Gitea-MCP-Instanz verwendet Image `bd248c3fae4c` mit Source-Revision `6e18b49a46327a56a21444fd6ebb6aeac745718d`. Ihre aktive Allowlist umfasst ausschließlich `aXtn/development-swarm-acceptance`; Datei-Writes sind auf `src/*.py,tests/*.py,README.md,docs/*.md` beschränkt. `MCP_WRITE_MODE=review`; Merge, Delete und Admin sind nicht freigegeben. `aXtn/axtn-agentswarms` und die für PR #8 nötigen TypeScript-/React-Pfade sind damit nicht über dieses Tool erreichbar. Die versionierte Provisionierung setzt dieselben Grenzen (`scripts/provision-development-mcp.py:98-106`).
- Der aktuell veröffentlichte Task-Graph validiert `axtn.development.task/v1`, bindet Repository und Pfad an `aXtn/development-swarm-acceptance` und `src/normalize_score.py` und setzt das Profil `python-normalization-v1` (`src/lib/axtnDevelopmentSwarm.ts:51-77`). Der native Verify-Vertrag kennt nur `python-normalization-v1` und `documentation-v1` (`src/utils/notebookRuntime/developmentContract.ts:27`).
- Das im laufenden App-Container gepinnte Developer-Runtime-Image `sha256:bf7a93450c449eb9e5dad388dd3f868f6c1530f84924e7f973945cb17d36c803` enthält `python`, aber kein `node`, `npm`, `npx` oder `tsc`. Der native Tool-Node-Katalog enthält unter anderem `mcp_call_tool` und `case_work`, aber keinen Shell- oder allgemeinen Test-Runner (`src/utils/swarmNodes.server.ts:77-86`). Der JS-Sandbox-Worker führt Function-Code in einer isolierten VM ohne Node-Codegenerierung aus (`services/js-sandbox/worker.mjs:45-46`); er ist kein Repository-/TypeScript-Executor.

## Historisches Urteil und Grenzen

Der veröffentlichte Graph kann den Architekturauftrag weder annehmen noch die geforderten mehrdateiligen TypeScript-/React-Änderungen mit passenden deterministischen Prüfungen ausführen. Zusätzlich verweigert die aktuelle native Gitea-Allowlist bereits den Repository-Zugriff. Ein Python-Fixture-Lauf würde diese Grenzen nicht überwinden und wurde ausdrücklich nicht als Ersatz ausgeführt.

Die UI lieferte nur das App-Shell; in dieser Session wurde keine authentifizierte native Administration durchgeführt. Deshalb wurden Graph, Agent-/Node-Konfiguration, MCP-Scope, IAM, Credentials, Cases und Runtime nicht geändert. Es gibt keinen Run-/Attempt-/Candidate-/PR-Nachweis für diesen Auftrag; Produktcode wurde nicht durch Copilot geschrieben. Modell- und Gateway-Bindungen blieben unangetastet.

## Historische nächste Schritte (durch den aktuellen Befund teilweise überholt)

1. Über die vorhandene authentifizierte AgentSwarms-Administration einen tatsächlich ausführbaren, nativen Produkt-Taskpfad für `aXtn/axtn-agentswarms` und `work/AXTN-SUPACASE-USABILITY-0001` konfigurieren und nach Save/Publish/Reload zurücklesen. Die bestehende Acceptance-Repo-Freigabe nicht still erweitern oder entfernen.
2. Eine bereits vorhandene native TypeScript-/React-Test- und Build-Fähigkeit nachweisen, die denselben unveränderlichen Mehrdatei-Candidate wie Builder und Breaker prüft. In den geprüften Deploy-Handlern und Runtime-Images wurde sie nicht gefunden. Ein neuer Runtime-/Executor-Bau ist durch den Handoff nicht autorisiert.
3. Erst nach diesen Readbacks den echten Swarm-Run mit Repository-, Tool-, Case- und Attempt-Evidence starten und PR #8 durch die Swarm-Agents bearbeiten lassen.

Zum damaligen Stand blieb der Auftrag **BLOCKED**. Diese historischen Aussagen werden durch den aktuellen Befund oben ergänzt: Phase A ist inzwischen nativ ausgeführt, während der Produktauftrag mangels nachgewiesenem TypeScript-Prüfweg **NOT_READY** bleibt.
