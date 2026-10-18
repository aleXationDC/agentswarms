# Development-MCP: Source-Prüfung des Write-Timeouts

Stand 18.10.2026. Bezug: veröffentlichter Betriebsbericht 6ab606dd25aa65e653316ff22e27076eb8bb095c, Blob b0ea0548e9d54d2daf87a42728e930d8433d1834. Der Bericht wurde kanonisch zurückgelesen. Source-Prüfung, keine eigene Host-/Runtime-Messung und kein Produktfix.

## Gesicherte Source-Befunde

App aXtn/aXtn-agentswarms@14ad88b477b81ce123638e88b810f0e39990d4e5:

- src/utils/tools/registry.server.ts, Blob 5811bdb46bf67e7456fadb51bdeca2aa94c05e73: mcpRequest setzt AbortSignal.timeout; initialize erhält MCP_CONNECT_BUDGET_MS, DELETE 5 Sekunden, alle übrigen POSTs einschließlich tools/call 15 Sekunden. Ein Timeout entsteht auch beim Warten auf den Response-Body unter demselben Signal.
- src/utils/mcpApps/budgets.ts: bestehendes Cold-Start-Budget 90 Sekunden und initialize-Budget 105 Sekunden. Das größere initialize-Budget verlängert tools/call nicht.
- src/utils/mcpApps/session.ts: initialize -> initialized notification -> eigentlicher Request, jeweils über den injizierten Transport; optionales Session-DELETE erfolgt im finally ohne Ergebnisänderung. FastMCP-Transport und Sitzungslogik nicht durch einen eigenen Client ersetzen.
- src/utils/tools/loop.server.ts: echte Modell-Toolcalls können innerhalb einer Runde parallel ausgeführt werden. Vier gleiche aktuelle Datei-SHAs in mehreren Writes sind deshalb auf Parallelität und unterschiedliche Payloads zu prüfen; nicht automatisch vier sichere idempotente Wiederholungen behaupten.

Development-Connector aXtn/aXtn-git@9b700ff5d1cbd8205d356b1413375767f630960a:

- mcp/src/axtn_gitea_mcp/server.py, Blob eb678dfffd3adcfe6221cca81af6a2e4ae5aa467: _request erzeugt pro Gitea-Aufruf einen httpx.AsyncClient mit timeout=30 Sekunden.
- upsert_file prüft Repo/Branch/Pfad, lädt Repository/Branchmetadaten und begrenzt scoped content auf 65.536 UTF-8-Bytes. Die gemeldete Route mit etwa 25 KB liegt darunter. Es gibt hier keinen Beleg einer Dateigrößen-/Credential-/Scope-Ursache.
- Bei vorhandenem effect laufen Idempotenzprüfung und Recovery über Commit-Marker, nicht nur ein Gitea-PUT. _effect_pages liest Seiten mit je 50 Einträgen, bis zu 10 Seiten. Bei jeweils vollen 10 Seiten bricht die Funktion ausdrücklich mit „Effect readback exceeds the bounded 500-record window“ ab. Diese Grenze darf nicht ignoriert werden.
- Vor dem Mutation-Request und danach werden dieselben branchbezogenen Commit-Abfragen ausgeführt. Der Client kann damit schon vor einem Write seine 15 Sekunden verbrauchen; alternativ kann ein Gitea-Write bereits erfolgt sein, während dessen Bestätigung/Readback abbricht. Kein automatischer Retry ist im Connector implementiert. HTTP-Abbruch allein beweist keinen Rollback.

## Schlussfolgerung und Grenze

Ein 15-Sekunden-RPC-Client ist nicht auf eine Connectoroperation abgestimmt, die mehrere sequenzielle Gitea-Anfragen mit jeweils bis zu 30 Sekunden ausführen darf. Das ist ein belegter Budgetkonflikt im Source. Der Bericht allein belegt noch nicht, welcher der vier Requests in welcher Phase stoppte, ob effect tatsächlich in allen übergebenen Argumenten vorhanden war, ob noch ein Request läuft und ob eine History-Fenstergrenze zusätzlich betroffen ist.

Keine pauschale Diagnose „25 KB zu groß“ oder „mehr Credentials nötig“. Das vorhandene Source-Limit bleibt unverändert.

## Eng begrenzter Reparaturauftrag im vorhandenen Pfad

1. Vor neuem Write tatsächlichen Branch-Head, Datei-Blob, relevante vorhandene Effect-Marker und gegebenenfalls noch laufende Operationen über den bereits zulässigen nativen Readback prüfen. Späte Writes/Teilbestätigungen ausschließen. Keine Wiederholung eines mutierenden Calls mit verändertem Payload bei derselben Effect-Identität. Bestehenden Case/Attempt behalten und unbekannten Ausgang nicht als sicher fehlgeschlagen deklarieren.
2. Mit der bestehenden sicheren Runtime-Diagnose tatsächliche Phasen/Zeiten korrelieren: initialize/initialized, Scope-/Branchprüfung, Effect-Prescan/Seitenzahl, Gitea-Mutation, Effect-Readback. Nur Phase, Dauer, Status-/Fehlerklasse, begrenzte Größen-/Seiten-/Aufrufzahlen und vorhandene Korrelationsreferenzen; keine Request-/Response-Bodies, Tokens, Roh-Exceptions oder Sourceinhalte. Zuerst vorhandene Logs/Traces nutzen. Falls die bereits autorisierte enge Fehlerdiagnose erweitert werden muss, genau im bestehenden Pfad, kein neuer Observability-/Dispatcherdienst.
3. Die belegte Ursache durch eine kleine Reparatur im bestehenden App-Transport und/oder bestehenden Connector beheben. Endliche Gesamtoperation, einzelne HTTP-Requests und äußeres RPC-Budget aufeinander abstimmen. Kein globales unendliches Timeout und kein unnötiges Timeout-Anheben für alle fremden MCP-Server; bestehende Abstraktionen/Konfiguration bevorzugen. Grenzwerte nach gemessenem Ablauf begründen, nicht blind auf Minuten setzen. Liegt der Engpass in Historienabfragen oder dem 500er-Fenster, genau diesen Befund separat reparieren bzw. ausweisen; mehr Wartezeit allein löst keinen logischen Fensterfehler.
4. Scope, geschützte Branches, Effect-Payloadkonfliktprüfung, Duplicate-/Recovery-Semantik und 64-KiB-Grenze erhalten. Keine Wegnahme von effect, kein erster ungeprüfter Historytreffer als Erfolg, kein Chunking, kein anderer Schreibkanal/Account und kein neuer Patch-/Shell-/Case-Service. Technische Reparatur am vorhandenen Plattformpfad ist Copilots bereits autorisierte Einrichtungsarbeit; fachlicher PR-#8-Produktcode bleibt Swarm-Arbeit.
5. Angemessene gezielte Tests: verzögerte erfolgreiche Antwort innerhalb des vereinbarten Budgets, begrenzter echter Timeout mit unbekanntem Commit-Ausgang, Commit erfolgreich/Antwort verloren mit sicherer Recovery, Effect-Payloadkonflikt, aktueller Datei-SHA-Konflikt sowie unveränderte Scope-Negativtests. Für den tatsächlich betroffenen Historypfad zusätzlich Fenstergrenze nicht als Erfolg verschlucken. Testen gegen synthetische Fake-Server/isolierten bestehenden Testkontext; keine neue Live-Schreibberechtigung dafür schaffen.
6. Reparatur gegen die tatsächlich laufende Basis isolieren, über den bestehenden regulären Releaseweg bereitstellen und Source-/Image-/Health-Readback dokumentieren. Dann genau einen begrenzten fachlich gerechtfertigten Swarm-Write zur offenen Assignment-Korrektur ausführen und dessen tatsächlichen Git-Effekt/Blob zurücklesen. Kein erneuter ganzer 69-Node-Lauf nur als Timeout-Experiment. Weitere erforderliche Produktänderungen und echte unabhängige Reviews danach im selben Auftrag fortführen.

## Fortbestehende Abnahmegrenzen

Der Assignment-HIGH-Befund aus AXTN-SUPACASE-CANDIDATE-REVIEW-20261018.md bleibt bis zum tatsächlichen Produktfix offen. Der aktuelle Quellenstand ist laut Bericht weiterhin e8f8cafd15fb7ba563bb344f8ed3a530d0cea3b9 / Case-Version 23. CI-Ergebniszugriff und UAT-Content-Exclusion sind unabhängig und dürfen nicht als Ursache des MCP-Timeouts vermischt werden. Keine neue allgemeine Nutzerfreigabe nötig; tatsächliche Organisationssperren bleiben verbindlich. Kein CI-, UAT- oder Acceptance-PASS aus dieser Source-Prüfung.
