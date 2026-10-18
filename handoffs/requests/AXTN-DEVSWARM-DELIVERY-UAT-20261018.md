# AXTN-DEVSWARM-DELIVERY-UAT-20261018 — aktiver Anschlussauftrag

Autorität: Alex, 18.10.2026, 10:06 Europe/Berlin: Copilot ist beendet; Fortsetzung jetzt über den Handoff herstellen.
Status: READY_TO_RESUME — Auftrag aktiviert, Ausführung durch Veröffentlichung nicht gestartet.

## Ziel und Vorrang

Den bestehenden echten Produktauftrag aus Architecture-PR #8 durch den nativ administrierbaren Development Swarm weiterführen und eine bedienbare, wiederverwendbare UAT bereitstellen. Nicht erneut nach einem Teilbericht ohne nächste Ausführung enden. Kein Neustart ab null und kein weiterer reiner Architekturauftrag.

Dieser Anschluss konkretisiert AXTN-DEVSWARM-PRODUCT-NATIVE-20261017; dessen fachlicher Scope, Swarm-Urheberschaft und Schutzgrenzen bleiben erhalten. Die bisherige QUEUED-/Nicht-aktivieren-Anweisung des UAT-Plans wird durch diese ausdrückliche Aktivierung abgelöst. Historische Berichte werden nicht zu PASS umgedeutet.

## Verbindliche Vorbereitung — nicht neu entwerfen

Vollständige Architektur und Objektdefinitionen liegen im selben Repository, exakt gepinnt auf **0c782276a144081821894d2269545e39d0556596**:
- handoffs/requests/AXTN-DEVSWARM-UAT-0001.md
- docs/architecture/axtn-development-swarm/uat/ARCHITECTURE.md
- docs/architecture/axtn-development-swarm/uat/NATIVE-WIRING.md
- docs/architecture/axtn-development-swarm/uat/native-object-plan.json
- dortige drei Skilltexte und zwei Knowledge-Base-Importquellen.
- SELF-REVIEW-20261018.md und source-audit.json dokumentieren geprüfte Source und Grenzen.

Diese Dateien vom genannten Commit lesen; kein Merge des Planungsbranches ist zum Lesen erforderlich. Bei Übernahme in Ausführungsbranches Quellenrevision beibehalten und aktuelle Reparatur-/Produktänderungen erhalten.

## Ausgangspunkt

Handoff/Report@1a01baa3822ece77ca48b7da15c15e6bce91d8a0:
Produktkandidat e4ca073195ada22dc378f6da0f300f498f2ebbf2, Case-Version 21.
Typecheck/Build bestanden; zwei Suite-Fehlschläge, 59 ESLintfehler, vier Warnungen.
Builder-/Reviewer-Ausgaben mehrfach leer/unvollständig. Kein finaler Review aller drei Rollen, echter CI-Lauf, native Approval oder Produkt-PR nachgewiesen.
Aktuellen Branch-Head zuerst zurücklesen; falls inzwischen fortgeschritten, nicht auf diesen älteren Stand zurücksetzen.

## Konkrete Ausführung

1. Bestehende Case-Lineage und den aktuellen Produktkandidaten weiterverwenden. UAT als eigenes verantwortlich abgrenzbares Arbeitspaket unter passender bestehender Lineage führen; keine Cases pro Node/Retry. Issue #7 und den bisherigen Gesamtbericht weiterführen.

2. Den unveränderten Textausgabe-/Formatierungsversuch nicht wiederholen. Mit bereinigten Metadaten feststellen, ob Eingaben vollständig ankommen und ob Modellantworten wegen Outputlimit, Toolmodus, Stream/Parser oder anderer Ursache leer/partiell enden. Nur tatsächlich ermittelten Fehler benennen; die 30.000-Zeichen-Grenze ist für Agent-Toolresultate belegt, nicht als Ursache dieser Runs bewiesen.

3. Die festgelegte native Verkabelung umsetzen: große Pflichtquellen über sichtbare MCP-Read-/set_var-Knoten, Builder mit bestehender nativer mcp_call_tool-Agenttoolschleife und begrenztem upsert_file, unabhängiger Readback; Reviewer mit vollständigem Kontext und enabledTools=[]. Ein begrenzter synthetischer Probe-Write muss echte Corporate-Toolcalls, gültigen Inhalt, Effect-Bindung und Readback nachweisen. Danach bestehende Produktarbeit fortsetzen. Keine neuen Serializer, Source-Extractor, Dispatcher oder eigenen Runtimes.

4. Drei vorbereitete native Skills und zwei KBs idempotent anlegen/geeignete bestehende Objekte wiederverwenden, wie native-object-plan.json vorgibt. Inhalte, Owner-/IAM-Zuordnung, Indexierung, Agentzuordnung und publizierte Snapshots zurücklesen. Die festgestellte Headless-Skills-Paritätslücke und nötige native Fehlerpropagation dürfen gezielt im vorhandenen Plattformpfad repariert und getestet werden; kein neuer Resolverdienst, keine unbeschränkten Service-Role-Reads. Keine Wirksamkeit aus bloßem Anhaken behaupten.

5. Echte Produktkorrekturen weiter vom Swarm durchführen lassen. Reine Formatierung gehört in das vorhandene Standardwerkzeug der Entwicklungs-/CI-Prüfung, statt das Modell wiederholt eine ganze Datei abschreiben zu lassen. Sofern noch kein erlaubter nativer Anschluss für diese Standardoperation vorhanden ist, diesen konkret ausweisen; nicht Copilot stellvertretend Produktcode schreiben lassen. Zwei Suite-Fehler vertraglich gegen Baseline prüfen, nicht Erwartungen/Hashes nur zum Grünmachen überschreiben. Drei vollständige unabhängige Reviews und technische Ergebnisse an denselben finalen SHA binden.

6. Isolierten, wiederverwendbaren UAT-Slot nach der vorgegebenen Architektur konfigurieren und bereitstellen. Eigene Auth/DB/Storage, synthetische Testdaten, bestehender privater Zugang, Start/Stop/Restart/Reset. Dafür müssen nicht erst allgemeine automatische Case-Acceptance oder ein universeller Dev-Loop fertig sein. Den tatsächlichen Kandidaten dort per Browser prüfen und Alex eine nutzbare Adresse mit Versionsreferenz und kurzen Testschritten liefern. Ein UNVERIFIED-Kandidat darf nur so bezeichnet im isolierten UAT geprüft werden; nicht als technisch/fachlich freigegeben darstellen.

7. Runner-/Release-/Betriebsweg aus den bestehenden Unterlagen weiterführen. Tatsächliche Content-Exclusion respektieren, nicht über andere Pfade/Tools umgehen. Die bereits vorbereitete konkrete Betreiberaktion bleibt separat; fehlende CI darf unabhängige native Konfiguration, Reviews und erlaubten UAT-Aufbau nicht pauschal stoppen. Falls genau der UAT-Deploy ebenfalls einen ausgeschlossenen Input benötigt, genau diesen Schritt und den bereits geprüften normalen Betreiberbefehl nennen. Keine neuen allgemeinen Credentials auf Verdacht verlangen, keine Codex-Identität für Copilot. GitHub-404 separat anhand tatsächlich konfigurierter Mirror-Metadaten klären; keinen Empfänger raten und produktiven Fortschritt nicht vom Mirror abhängig machen.

8. Reales fachliches Review in der nativen Inbox/Git-Review vorbereiten. Keine TEST_SIMULATION. Bestehenden Fixture-gebundenen aXtn-Work-Acceptance-Pfad nicht für einen falschen Produkt-PASS missbrauchen. Feedback am selben Case zum nächsten Swarm-Attempt führen. Kein Produktionsrelease oder Merge allein durch diesen Anschlussauftrag; für den Produktkandidaten bleibt echte Abnahme im regulären Releaseweg erforderlich.

## Fertigstellung und Arbeitsfortsetzung

Nicht nach Diagnose, Anlage von Skills oder einem grünen Login als vollständig fertig melden. Innerhalb des autorisierten Umfangs bis zur tatsächlichen UAT-/Reviewbereitschaft weiterarbeiten; einzelne reale Sperren begrenzen nur den betroffenen Schritt.

Ergebnis getrennt nachweisen: native Objektadministration und IDs, echter Builder-MCP-Write/Readback, aktueller Produktkandidat, drei Reviews, tatsächliche Tests/CI, UAT-Deployment und Browserfunktion, fachliche Approval sowie offene Einzelaktionen. Eine bedienbare UAT ist ein eigenständiges Lieferergebnis. Kein neuer Gesamtbackup für jeden kleinen Test; bestehenden verhältnismäßigen Betriebsvertrag nutzen.

Gesamtbericht weiterführen und die neuen UAT-Nachweise zusätzlich in handoffs/reports/AXTN-DEVSWARM-UAT-0001.md referenzieren. Eindeutiger Status und konkrete Restarbeit; keine behauptete lückenlose native Automatik.
