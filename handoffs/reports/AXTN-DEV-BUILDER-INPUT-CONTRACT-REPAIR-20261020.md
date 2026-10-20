# Builder-Eingabevertrag: Korrektur und verbleibende Formatter-Grenze

**SupaCase:** Builder Work `912b172e-20ae-478d-898d-a629fcf1af11`  
**Repository branch:** `work/AXTN-MODULAR-BUILDER-DELIVERY-20261019`

## Befund

Der persistierte Builder-Run `28343e65-62a2-5942-a16e-cf2c1c1252ca` lief auf dem
damals publizierten Graph mit 52 Nodes und endete technisch erfolgreich, aber
ohne Kandidat: Der gelesene Quell-Blob blieb unverändert und die native
No-op-Prüfung stoppte vor Candidate-Evidence und CI. Sein JSON-Input enthielt
`request`, aber kein `task`; der Agent-Prompt verlangte die Transformation aus
`input.task`. Im Trace steht außerdem ein ungültiger MCP-Argument-JSON-Aufruf
(Parserposition 29672). Danach waren zwei `upsert_file`- und zwei `fetch`-
Aufrufe mit Objektargumenten erfolgreich, aber der Quell-Blob blieb gleich.
Der exakt deployte App-Source `f8efcdda7b50c523cac83a21bb67fc9f0a446ab3`
definiert `arguments` als Objekt und akzeptiert zur Laufzeit zusätzlich einen
JSON-Objektstring; ungültiges JSON wird abgelehnt. Belegt ist damit ein
fehlerhafter Modell-Toolcall, kein anhaltender MCP-Schemafehler.

Der normale Owner-MCP-Probe-Readback zeigt fünf Gitea-Werkzeuge
(`identity`, `fetch`, `repository_tree`, `create_branch`, `upsert_file`), aber
keinen Formatter. Der Dev-Workflow am Baseline-Commit
`01d5ccef6c8b582945ec898d5252f899d60892fb` führt
`prettier --check` aus; er formatiert oder schreibt keine Quelldatei.
Eine deterministische Prettier-Ausführung ist dem Builder damit derzeit nicht
verfügbar. Eine Modellimitation als Ersatz für Prettier wäre nicht vertragsgemäß.

## Korrektur und Readback

Commit `c7a5f40cea915c67fbaf58cda882cb7c3561cf5a` richtet den nativen Prompt
und die README auf das tatsächliche Pflichtfeld `input.request` aus; fehlendes,
leeres oder mehrdeutiges `request` stoppt vor jedem Write. Der Regressionstest
prüft den Vertrag. Die gezielten Builder-Graph-Tests liefen **6/6** erfolgreich.

Über den normalen Owner-Pfad wurde nur der Prompt des vorhandenen Builder-Agent-
Nodes geändert und die Änderung als Swarm-Version `967fef2c-5492-41d7-9b70-4a73fac09e97`
gespeichert. Danach wurde der bestehende Swarm `d8e6f1ef-21a4-4f06-a1f5-f752b1b78a20`
regulär publiziert und zurückgelesen: 52 Nodes und 57 Edges, Draft und
Published Snapshot identisch; `input.request` ist vorhanden, `input.task` nicht.
Publikationszeit: `2026-10-20T13:14:00.803+00:00`.

## Status und nächste notwendige Fähigkeit

Nach dieser Korrektur wurde kein weiterer Modelllauf blind gestartet. Es gibt
noch keinen neuen Produkt-Write, Kandidaten-SHA oder Dev-/CI-Status; weder ein
Run-Erfolg noch das frühere No-op-Ergebnis wird als Lieferung gewertet.

Für die beauftragte reine Formatierung fehlt ein **dem Builder verfügbarer,
deterministischer Prettier-Ausführungspfad**. Der bestehende MCP-Connector und
der CI-Workflow bieten nur Datei-Read/Write beziehungsweise `prettier --check`.
Bis ein bereits autorisierter nativer Formatter verfügbar ist oder ein
zulässiger, konkreter Formatter-Pfad freigegeben wird, bleibt ein
vertragsgemäßer Produkt-Write blockiert. Es wurden weder ein Shell-MCP-Wrapper,
eine schreibende CI-Identität noch eine CLI-Produktkorrektur hinzugefügt.

## Quellen

- [Korrekturcommit](https://git.alexation.com/aXtn/axtn-agentswarms/commit/c7a5f40cea915c67fbaf58cda882cb7c3561cf5a)
- [Builder-Graph am Korrekturcommit](https://git.alexation.com/aXtn/axtn-agentswarms/src/commit/c7a5f40cea915c67fbaf58cda882cb7c3561cf5a/axtn/swarms/axtn-development-builder/graph.mjs)
- [MCP-Toolvertrag am deployten App-Source](https://git.alexation.com/aXtn/axtn-agentswarms/src/commit/f8efcdda7b50c523cac83a21bb67fc9f0a446ab3/src/utils/tools/registry.server.ts)
- [Dev-Workflow am exakten Baseline-Commit](https://git.alexation.com/aXtn/axtn-agentswarms/src/commit/01d5ccef6c8b582945ec898d5252f899d60892fb/.gitea/workflows/modular-builder-dev.yaml)
- Input-Vertrag: `handoffs/requests/AXTN-DEV-BUILDER-INPUT-CONTRACT-20261019.md` @ `7d30e83dd0ffcf052aaec04e9a6e2179e95f69ea`
- Ausführungsfortsetzung: `handoffs/requests/AXTN-DEV-BUILDER-TURN-AND-RESULT-20261020.md` @ `019bacb330ee7b989b96201d6130d1c7ae088d9a`
