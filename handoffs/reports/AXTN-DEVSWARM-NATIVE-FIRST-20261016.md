# AXTN-DEVSWARM-NATIVE-FIRST-20261016 — Ausführungsbefund

Stand: 16.10.2026

Status: **BLOCKED — native Ausführung und PR #8 nicht gestartet**

Handoff: `aXtn/aXtn-agentswarms@991b742bb66b24960dc195e28320d7988dddca44`

Architekturauftrag: `aXtn/aXtn-architecture@14b51ce781eeecfe766f6fe8dd83c0b393b2c2c1`

## Geprüfter Ist-Stand

- Der laufende AgentSwarms-App-Container antwortet auf `http://127.0.0.1:18080/` mit HTTP 200. Der gespeicherte Development Swarm `ad06e17d-460b-4b65-946a-9b5d78c6fd02` hat den veröffentlichten Snapshot `f7fc9cb5-3ffb-49e1-93a7-009b099ba55a` mit 31 Nodes und 34 Edges. Der Datenbank-Readback meldet zugleich `is_deployed=false`; ein deployter Graph-Snapshot wird daher nicht behauptet.
- Die laufende native Gitea-MCP-Instanz verwendet Image `bd248c3fae4c` mit Source-Revision `6e18b49a46327a56a21444fd6ebb6aeac745718d`. Ihre aktive Allowlist umfasst ausschließlich `aXtn/development-swarm-acceptance`; Datei-Writes sind auf `src/*.py,tests/*.py,README.md,docs/*.md` beschränkt. `MCP_WRITE_MODE=review`; Merge, Delete und Admin sind nicht freigegeben. `aXtn/axtn-agentswarms` und die für PR #8 nötigen TypeScript-/React-Pfade sind damit nicht über dieses Tool erreichbar. Die versionierte Provisionierung setzt dieselben Grenzen (`scripts/provision-development-mcp.py:98-106`).
- Der aktuell veröffentlichte Task-Graph validiert `axtn.development.task/v1`, bindet Repository und Pfad an `aXtn/development-swarm-acceptance` und `src/normalize_score.py` und setzt das Profil `python-normalization-v1` (`src/lib/axtnDevelopmentSwarm.ts:51-77`). Der native Verify-Vertrag kennt nur `python-normalization-v1` und `documentation-v1` (`src/utils/notebookRuntime/developmentContract.ts:27`).
- Das im laufenden App-Container gepinnte Developer-Runtime-Image `sha256:bf7a93450c449eb9e5dad388dd3f868f6c1530f84924e7f973945cb17d36c803` enthält `python`, aber kein `node`, `npm`, `npx` oder `tsc`. Der native Tool-Node-Katalog enthält unter anderem `mcp_call_tool` und `case_work`, aber keinen Shell- oder allgemeinen Test-Runner (`src/utils/swarmNodes.server.ts:77-86`). Der JS-Sandbox-Worker führt Function-Code in einer isolierten VM ohne Node-Codegenerierung aus (`services/js-sandbox/worker.mjs:45-46`); er ist kein Repository-/TypeScript-Executor.

## Urteil und Grenzen

Der veröffentlichte Graph kann den Architekturauftrag weder annehmen noch die geforderten mehrdateiligen TypeScript-/React-Änderungen mit passenden deterministischen Prüfungen ausführen. Zusätzlich verweigert die aktuelle native Gitea-Allowlist bereits den Repository-Zugriff. Ein Python-Fixture-Lauf würde diese Grenzen nicht überwinden und wurde ausdrücklich nicht als Ersatz ausgeführt.

Die UI lieferte nur das App-Shell; in dieser Session wurde keine authentifizierte native Administration durchgeführt. Deshalb wurden Graph, Agent-/Node-Konfiguration, MCP-Scope, IAM, Credentials, Cases und Runtime nicht geändert. Es gibt keinen Run-/Attempt-/Candidate-/PR-Nachweis für diesen Auftrag; Produktcode wurde nicht durch Copilot geschrieben. Modell- und Gateway-Bindungen blieben unangetastet.

## Erforderlicher nativer Anschluss

1. Über die vorhandene authentifizierte AgentSwarms-Administration einen tatsächlich ausführbaren, nativen Produkt-Taskpfad für `aXtn/axtn-agentswarms` und `work/AXTN-SUPACASE-USABILITY-0001` konfigurieren und nach Save/Publish/Reload zurücklesen. Die bestehende Acceptance-Repo-Freigabe nicht still erweitern oder entfernen.
2. Eine bereits vorhandene native TypeScript-/React-Test- und Build-Fähigkeit nachweisen, die denselben unveränderlichen Mehrdatei-Candidate wie Builder und Breaker prüft. In den geprüften Deploy-Handlern und Runtime-Images wurde sie nicht gefunden. Ein neuer Runtime-/Executor-Bau ist durch den Handoff nicht autorisiert.
3. Erst nach diesen Readbacks den echten Swarm-Run mit Repository-, Tool-, Case- und Attempt-Evidence starten und PR #8 durch die Swarm-Agents bearbeiten lassen.

Bis dahin bleibt der Auftrag **BLOCKED**. Es wurde kein weiterer Fixture-PASS, keine Änderung an Sicherheitsautorisierungen und kein Produkt-PR erzeugt.
