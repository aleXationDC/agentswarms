# Gestufte Umsetzung: native Entscheidung, Builder-Konfiguration und reale Restlücke

## Ergebnis

Die tatsächliche Planfreigabe ist nativ entschieden und fortgesetzt. Die
Skill-Voraussetzung ist kompatibel repariert, regulär veröffentlicht und live.
Fünf getrennte enge Git-Rollenprofile sind eingerichtet und ihre Grenzen
tatsächlich geprüft. Eigenständiger Builder und deterministischer Dev-Verifier
sind separat nativ publiziert und als Graph-Konfiguration versioniert.

**Der beauftragte Builder-Meilenstein ist noch nicht erfüllt.** Ein initialer
Lauf und drei konkret begründete technische Korrekturzyklen haben keinen
`upsert_file`-Aufruf und keinen neuen Produktkandidaten erzeugt. Technischer
Run-Erfolg wird ausdrücklich nicht als fachlicher Erfolg ausgegeben. Die
Kandidatenprüfung wurde deshalb zusätzlich fail-closed qualifiziert. Kein
weiterer identischer Builder-Gesamtlauf, keine simulierte Ergebnisfreigabe.

## Autorität und erhaltene Lineage

Ausgeführt wird `HANDOFF.md@0a490842502a20e1f1da0f4739766838c046938e`
mit Auftrag
`handoffs/requests/AXTN-DEV-PROCESS-PLAN-APPROVAL-20261019.md`
am Commit `f6c53b6d65a29ecdadb2baf359b5fa48e67c108e`.

Der freigegebene Plan ist
`f3c198df50181366fa8c8b327f8853c84436e6f6`, Blob
`8a743fae22b3f46579852f899e91c09678ecb045`. Approval
`8d0498cb-e23c-4453-a25e-0650e8e0abf9` wurde über die normale authentifizierte
Owner-Funktion tatsächlich `approved`, am
`2026-10-19T13:57:55.739769+00:00`. Danach wurde der bestehende Gate-Run
`8ca0f035-d198-58a7-a9af-b3694610c351` mit der vorhandenen Resume-Funktion
erfolgreich beendet; sein Checkpoint ist bereinigt. Die Entscheidungsfunktion
liefert die Approval-UUID, keinen Boolean: eine nachgelagerte lokale Assertion
scheiterte zunächst, aber die bereits erfolgreiche Entscheidung wurde nicht
wiederholt. Approval-Zustand und unveränderte Planbindung wurden zurückgelesen.

| Verantwortliche Arbeit | Bestehender/nativ ergänzter Case |
|---|---|
| Implementation Parent, bleibt offen | `43d22cf1-8767-40ef-b682-785607e6d724` |
| Bestehender Intake-Scope | `577050e6-e596-4818-bc79-d1041c9ef02e` |
| Voraussetzungen A/B | `b0cb5d82-d035-47e8-95db-320c5cd3aa78` |
| Eigenständiger Builder/Qualifikation | `912b172e-20ae-478d-898d-a629fcf1af11` |
| Review-/Audit-Konfiguration | `19a2d897-5078-4cc0-bca3-79fbde780b18` |
| Erhaltene tatsächliche Produktarbeit | `913dbf33-9891-4712-b945-aab9a5cfe5b9` |

Keine Cases für einzelne Kommandos oder technische Retries wurden erzeugt.
Der Produkt-Case bleibt unter seinem bestehenden fachlichen Parent
`ad8690f3-ecb3-4db1-a5e9-44a9752de2d2`; seine Historie wird nicht umgehängt.
Der 69-Node-Prozess bleibt bei Version
`0a81fc0c-c142-4de5-adf0-5f8dc3a88513`, ebenso bleibt der Intake erhalten.

## Voraussetzungen und kompatible Livebasis

A: Der vorhandene native SQL-Bindungsvertrag validiert Case/Principal,
technischen Parent/Subswarm-Node und unveränderliche Run-Bindung. Kein konkreter
Identitätsdefekt wurde reproduziert; deshalb keine spekulative Reparatur.
Die vorhandenen Nested-Tests belegen Suspend/Resume und fehlende Doppeleffekte,
verwenden aber gemockte Registrierung und ersetzen keinen Live-SQL-Nachweis.

B: Auf der tatsächlichen Livebasis `814755422555e8375e476b229046eaa9ba08626f`
fehlte `skillIds` im realen `serverChat`-Request. Eine Regression über
`executeSwarmServer` reproduzierte dies zuerst rot. Die enge Reparatur reicht
nichtleere Skill-IDs unabhängig vom Toolangebot weiter. Konfigurierte, leere
und fehlende Skill-IDs sowie unveränderte Tool-/Run-/Node-Bindung sind abgedeckt.

Veröffentlichte Quelle:
[2140f2f70503d3ae3471f92feb0b186d419a1d50](https://git.alexation.com/aXtn/aXtn-agentswarms/commit/2140f2f70503d3ae3471f92feb0b186d419a1d50).
Gezielte Nested-/Parity-Tests: 22 bestanden; Typecheck und gezieltes ESLint
bestanden. Bestehende MFA-/Gateway-/Case-/Connector-Reparaturen bleiben erhalten.

Reguläre Konvergenz über `converge-agentswarms-candidate.py` und die bestehende
`development-swarm-compose.env`: Der erste Build wurde bei parallelem CI-
Typecheck unter gemeinsamem Speicherdruck beendet. Der alte Container blieb
gesund. Nach Ende des konkurrierenden Compilers wurde derselbe Build regulär
erfolgreich wiederholt, nicht durch Stoppen fremder Prozesse erzwungen.

Tatsächliches Live-Image:
`sha256:9a1fbd7b9edf304ea09699f72ba3f863edc71786c4fc55b22db38f3d195d8844`.
Container-Label nennt exakt `2140f2f70503d3ae3471f92feb0b186d419a1d50`;
Docker-Health `healthy`, `/api/health` HTTP 200. Owner-/Case-Zugriff und die
vorhandenen Work-Identitäten wurden nach dem Neustart erneut gelesen.

## Echte CI, keine behauptete Gesamtabnahme

[Actions Run 169 / Job 332](https://git.alexation.com/aXtn/aXtn-agentswarms/actions/runs/169/jobs/332)
für `2140f2f70503d3ae3471f92feb0b186d419a1d50` ist **fehlgeschlagen**:
Lint ohne Fehler, 235 Warnungen; 616 Testdateien bestanden, eine fehlgeschlagen;
10.063 Tests bestanden, 40 übersprungen, zwei Fehler in
`tests/unit/documentRecoveryInventory.test.ts`. Der nachgelagerte vollständige
Build-Schritt wurde dadurch nicht erreicht. Die geprüfte DMS-Inventardatei und
ihre Tests wurden durch die Skill-Reparatur nicht verändert; dies ist kein
behaupteter grüner vollständiger Plattform-CI-Lauf.

Die erste Source-Hash-Abweichung bestand bereits auf der unveränderten Livebasis:
für `src/utils/swarmExecute.server.ts` erwartet das historische Inventar
`eccc9d0861b849e2860afdf5d853d4c7c5d55bbbb913616d8ef9bfc78d5e0ddb`,
Baseline `8147554…` hat dagegen
`5275332e03e0f4551b60b00bd53cdaf9ec4d5e8c3296ad7ca93d4d5c65cbdd71`.
Nach der Skill-Reparatur ist der Hash
`1730d48095df1cc78b5de0215da1bb0c24e16a3760679f162b70c890a8b90adf`.
Der Vergleich aller inventarisierten Quellen ergab keine neu eingeführte
Hash-Abweichung. Historische Inventarbindungen werden nicht für grünes CI
nachträglich verfälscht.

Der vorhandene nichtadministrative Connector-Zugang kann Runs, Jobs, Logs und
exakten Commitstatus inzwischen tatsächlich HTTP 200 lesen. Die verschlüsselte
native Secret-Referenz `MODULAR_GITEA_CI_READ` wird nur vom deterministischen
HTTP-Knoten verwendet, nie als Modellinput. Frühere fehlende CI-Sichtbarkeit
wird nicht als aktuelle organisatorische Sperre fortgeschrieben.

## Enge native Git-Rollen

Host-Quelle:
[25468590052b3589d12889a6b01541d93bdbca37](https://git.alexation.com/aXtn/aXtn-host/commit/25468590052b3589d12889a6b01541d93bdbca37),
`compose/development-role-mcp.native.yaml` und
`docs/DEVELOPMENT-ROLE-MCP-20261019.md`.

Alle fünf Instanzen verwenden unverändert Connector-Quelle
`9f920a0873b9b364a86f4d5dce48b7219678ed0b` und Image
`sha256:c4a2e14b727d997191b8dd2ae2d9b0b628543a4cbd41df09673425095006ba03`.
Ownerbezogene Registry-Zeile, Endpoint, angesprochener Container und Image
wurden pro Rolle aufgelöst. Jede Rolle hat einen getrennten geschützten
Endpoint-Zugang, nur Repository `aXtn/axtn-agentswarms`, ihren konkreten
Effect-Branch, exakte Artefaktpfade und unveränderliche History-Baseline.

| Rolle | Native Registry |
|---|---|
| Builder | `da000253-0ddf-454e-a616-c2787e6dabd8` |
| Security Reviewer | `0be54609-c110-4b9c-921d-c13bd6c2d6ff` |
| Contract Reviewer | `26c07cd5-e4a4-44f6-8343-6f1ac107a9ba` |
| Quality Reviewer | `ae546e50-c9cd-4dbb-9041-44b24575cd82` |
| Audit | `1913eb50-d7b1-4f38-8c5c-b8a3945870c9` |

Native Negativaufrufe belegen je Rolle Ablehnung eines anderen Repositorys,
eines anderen nicht-Main-Taskbranches, fremder Produkt-/Plattformpfade sowie
eines fehlenden Effects. Reviewer und Audit können keinen Produktcode schreiben.
Diese Policyfehler erzeugten keine Commits. Keine globalen Rechte, Merge-/
Delete-/Admin-/Deployment-/Approval-Tools und keine CLI-MCP-Änderung.
Effect schützt Idempotenz/Konflikte; es ist keine eigenständige externe
Case-Autorisierung. Host-Tests: 17 bestanden; Bash-Syntax und echte Compose-
Validierung ohne Ausgabe geschützter Werte bestanden.

## Separat publizierte Bausteine

Builder Swarm `d8e6f1ef-21a4-4f06-a1f5-f752b1b78a20`, aktuelle Version
`6e60fdbf-0910-43ff-b533-8efc682b2d55`, 13 Nodes / 15 Edges.
Dev-Verifier `1ef62594-d955-407d-a925-f04e3182c827`, Version
`df973a88-46c8-4269-b19c-a44dcd807088`, 18 Nodes / 17 Edges.
Saved Draft, Published Graph und immutable Version-Snapshot wurden abgeglichen.
Konfiguration und Grenzen stehen unter
`axtn/swarms/axtn-development-builder/`; fünf Konfigurationstests bestehen.

Builder nutzt die bestehenden Development-/UAT-Skills, Development Standards KB
und eingefrorene Builder-Agent-Provenienz. Taskquellen und Dateipfade kommen
aus Git-Auftrag/Input, nicht aus einer festen fachlichen Quellenliste im Graph.
Native Tool-/Projektionsknoten liefern vollständigen Primärquelltext, Auftrag
und Formatkonfiguration, ohne Tool-Limits oder Schreibgrößen zu erhöhen.

Der getrennte native Dev-Verifier liest den exakten Commitstatus über Standard-
Gitea-HTTP. Nur echter Erfolg darf zu nativer Evidence-Schreib-/Readbackprüfung
und temporärem Builder-Ergebnisreview führen. Pending/Failure/Error erzeugen
keine Approval. Kein LLM-Judge, Function-Guard, verstecktes Polling oder manuelle
Approval-Erzeugung. Automatischer CI-Warte-/Konsum- und Nacharbeitszyklus des
Leitprozesses ist noch nicht qualifiziert und wird nicht als geliefert behauptet.

Echte Negativqualifikation: Run `ce4437f4-5666-533e-a06c-f35e1f6d0de1`
las den tatsächlichen fehlgeschlagenen CI-Status, lief in den Failure-Ausgang,
führte weder Evidence-Write noch Approval aus. Unterschiedliche Exact-Router-
Labels dürfen beim bestehenden Executor nicht denselben Zielnode verwenden;
diese konkret beobachtete Konfigurationsabweichung wurde korrigiert.
Run `8617b42c-2eea-5b40-ad56-f71200964633` qualifiziert außerdem den
tatsächlichen Pending-Status der unveränderten `[skip ci]`-Baseline:
Pending-Ausgang, kein Evidence-Write und null Approvals.

Echte Missing-Candidate-Qualifikation:
`31c26962-975e-527c-a545-a82849124824` am separat erhaltenen read-only
Qualifikations-Swarm `42a6960b-b577-45aa-97f0-207f2c4f3376` scheiterte
erwartet am Exact-Router: kein geschriebenes Kandidatenartefakt, kein
Kandidatenausgang und null Approvals. Dadurch kann ein leeres/unvollständiges
Modellergebnis nicht bloß mit dem unveränderten Baseline-Head erfolgreich enden.

## Tatsächliche Builder-Versuche und verbleibender Blocker

Unveränderte Produktlinie: `bea0a447` → `6a2421e3` → `98832eca` →
`a400acc7178162345234efaa4f59af7ff1950459`.
Darauf liegt ausschließlich die Dev-Workflow-/Auftragsbasis
`fa061f2642477bc9fcbe12a2bd7f270a55a96bf9`. Kein erfundener zusätzlicher Bug,
kein CLI-Produktpatch, kein Rücksetzen der Assignment-Korrektur.

| Versuch | Nativer Run | Beobachtetes Ergebnis |
|---|---|---|
| Initial | `869ac58a-9dee-5274-a4bf-e284cd68abcc` | Erfolgreiche Reads, danach fehlendes `tool_name` in Modellaufrufen und `-32602`; acht Toolrunden erschöpft, kein Write. |
| Korrektur 1 | `2d667297-81aa-5e6b-ae3f-727dd58fb74c` | Native vollständige Kontextprojektion + expliziter Toolvertrag; GLM-5.2 lieferte nach 325.984 ms und 98.969 Ausgabetokens leeren Inhalt, kein Write. Der lokale HTTP-Header-Timeout wurde durch tatsächlichen Run-/Git-Readback aufgeklärt, nicht durch erneuten Start. |
| Korrektur 2 | `8d0729e3-d0f5-5227-ad42-3675b2ce3f28` | Mistral aus bestehender Provider-Discovery wurde auf der tatsächlich gebundenen Gatewayroute mit `PROVIDER_CAPABILITY_UNSUPPORTED` abgelehnt; keine Modell-Toolcalls. Provider-Discovery beweist nicht Gateway-Ausführbarkeit. Keine Policy oder Capability wurde dafür geändert. |
| Korrektur 3 | `f3acfe5a-7a84-5ac0-a73a-7afb371fd5d5` | Bereits im vorhandenen Builder-Agent konfigurierte GLM-5.3-Flash-Variante liest die Quellen, gibt den begonnenen Write nur als unvollständiges `<tool_call>`-Markup im Text aus; kein ausführbarer `upsert_file`-Event. |

Vor jeder begründeten Attempt-Neubindung wurden terminaler Run, konkrete
Toolargumente/-ergebnisse und tatsächlicher Branch-Head geprüft. Alle vier
Effect-Branches stehen unverändert auf `fa061f2642477bc9fcbe12a2bd7f270a55a96bf9`.
Alte Runs, Effects, Branches und veröffentlichte Versionen bleiben erhalten.
Keine unbekannten/späten Produktwrites wurden nachgewiesen. Rohe Provider-
Stopreasons sind in diesen nativen Stepdaten nicht vollständig vorhanden und
werden nicht aus Tokenzahlen als angeblich bewiesen abgeleitet.

Die tatsächliche Restlücke ist jetzt der ausführbare, vollständige Modell-
Write auf dem vorhandenen Gateway-/Toolpfad, nicht fehlende Git-Rechte, fehlende
Owner-Session oder eine neue allgemeine Planfreigabe. Die drei begrenzten
Korrekturzyklen sind ausgeschöpft. Keine blinde Fortsetzung oder Parser-/
Policy-Umgehung und kein nachträglich gefälschter Effect-Schreibnachweis.

Die echte Assignment-Regressionssuite ist erhalten, aber ein neuer formatierter
Swarm-Kandidat samt tatsächlichem Dev-Lauf ist noch ausstehend. Daher sind
positive Verifier-/Evidence-/Ergebnisreview-Qualifikation, drei unabhängige
Reviews, Audit, fachliche Child-Case-/Dependency-Verbindung, Integration und
Gesamtprüfung weiterhin offen. UAT und Produktionsfreigabe bleiben separat.
UAT wurde in diesem Abschnitt nicht gestartet; eine historische Content-
Exclusion wurde weder umgangen noch ohne neuen Befund als aufgehoben erklärt.
