# Unabhängige Source-Prüfung des Produktkandidaten e8f8cafd

Stand: 18.10.2026. Auftrag AXTN-SUPACASE-USABILITY-0001, bestehender Case 913dbf33-9891-4712-b945-aab9a5cfe5b9. Architektur-/Source-Prüfung durch ChatGPT; keine Produktdatei geändert, keine Case-Transition oder fachliche Acceptance ausgeführt.

## Geprüfte Grundlage

- Betriebsbericht d7b2c4f25088c8d6598446edc0f52aa1319dd36e, handoffs/reports/AXTN-DEVSWARM-UAT-0001.md, Blob 946fb3fd336d66652bbeaadd2fe29396a722a823: kanonisch vollständig zurückgelesen.
- Produktbranch-Datei src/routes/_authenticated/cases.tsx: Datei-Commit e8f8cafd15fb7ba563bb344f8ed3a530d0cea3b9, Blob 9c77c63b1d44a5dba39d18196ec8c3411372ecd9. Nachfolgende Prüfungen am exakten Commit.
- PR-#8-Hauptauftrag am Ref 14b51ce781eeecfe766f6fe8dd83c0b393b2c2c1 vollständig erneut gelesen.
- caseAssignmentContract.ts, caseManagement.server.ts, die drei gemeldeten Testdateien und package.json am Kandidaten gelesen.
- supabase/migrations/20261005200000_case_responsibility.sql, Blob 064c1d684290ab6fa2fd675b7f3d3eb07e98591b. Die drei späteren Migrationsdateien im vollständigen Supabase-Teilbaum definieren die hier relevanten Case-Access-Funktionen nicht neu. Das ist ein Nachweis des versionierten Kandidatenvertrags, nicht der heute installierten DB-Funktionskörper.

## Auflösung des widersprüchlichen Reviewer-Befunds

Die Behauptung „Verantwortlichenfilter fehlt“ trifft auf diesen Dateiblob nicht zu:

- URL-Suchfeld responsible und Übernahme in updateSearch sind vorhanden.
- responsibleOptions und die Select-UI „Nach Verantwortlichem filtern“ sind vorhanden.
- responsibleFilter wird im filtered-Memo angewendet und ist Teil seiner Abhängigkeiten.
- cases, accountNames und contactNames stehen ebenfalls in den relevanten Abhängigkeiten.

Das widerlegt diesen konkreten behaupteten Mangel, nicht sämtliche anderen möglichen Review-Funde und nicht den fachlichen Gesamtauftrag. Modellberichte müssen Befund, Dateiblob und konkrete Source-/Verhaltensbelege nennen. Weder pauschale Freigabe noch wiederholtes Umschreiben bereits vorhandener Elemente.

## HIGH: Zugriffsmodus wird fälschlich als persönliche Zuweisung verwendet

Die SQL-Case-Access-Projektion setzt case_access_mode abhängig von custody: bei eigenem Bestand CUSTODIAN, andernfalls bei berechtigtem Zugriff RESPONSIBLE. Die Sichtbarkeitsfunktion erlaubt daneben den Zugriff über persönliche oder Gruppenverantwortung. Der Case-Access-Modus ist somit kein vollständiger Assignee-Ausweis.

Der SQL-Vertrag enthält bereits responsible_principal_type, responsible_principal_id und assignee_user_id in der zugelassenen Projektion. Die Assignment-Validierung unterscheidet USER, GROUP und SYSTEM sowie Assignee ausdrücklich. Die neue Route übernimmt diese Felder in asCases nicht, filtert „mine“ ausschließlich mit case_access_mode === RESPONSIBLE und baut auch die Auswahl „Verantwortlicher“ allein aus diesem Zugriffsmodus.

Konkreter Fehler: Ein offener Case im eigenen Bestand, der dem aktuellen Benutzer tatsächlich persönlich zugewiesen ist, erhält CUSTODIAN und wird unter „Mir zugewiesen“ ausgeblendet. Das widerspricht dem bestehenden Auftrag, der Zuweisung und Eigentum unterscheiden muss. Gruppenzugriff allein belegt ebenfalls keine persönliche Bearbeiterzuweisung. Eine Auswahl von Zugriffsmodi ist außerdem kein Nachweis des vertraglich geforderten Filters nach konkretem Verantwortlichen/Bearbeiter.

### Begrenzter synthetischer Reproducer

Die unveränderten Funktionen asCases, nextDate, compareCases sowie der exakte filtered-Memo-Callback wurden aus dem kanonischen Dateiblob lokal extrahiert; TypeScript-Typen wurden mit Node 24 stripTypeScriptTypes entfernt. Keine Produktfunktion umgeschrieben, kein Backend, keine Secrets, keine realen Datensätze, keine Browser-/Live-Abnahme.

| Synthetischer Input | Beobachtung der tatsächlichen Route-Funktionen |
|---|---|
| Eigener offener Case, CUSTODIAN, responsible_principal_type=USER, principal/assignee aktueller Benutzer | Fehlt in mine. |
| Eigener offener Case, CUSTODIAN, SYSTEM, kein Assignee | Erscheint zusammen mit dem persönlich zugewiesenen Case im selben CUSTODIAN-Auswahlwert. |
| Fremder zugreifbarer Gruppen-Case, RESPONSIBLE, Assignee anderer Benutzer | Wird allein wegen RESPONSIBLE in mine aufgenommen. Die passende fachliche Gruppenansicht darf daraus nicht ungeprüft als persönliche Zuweisung bezeichnet werden. |
| Alle drei Inputs über asCases | Die tatsächlichen Assignment-Felder fehlen im Ergebnis. |

Vier Reproducer-Assertions bestätigten dieses Verhalten. Die Projektion der synthetischen Inputs folgt dem versionierten SQL-Vertrag; SQL wurde hierfür nicht gegen eine Datenbank ausgeführt. Das ist ein funktionaler Source-Reproducer, kein E2E-/UAT-Nachweis.

## Verbindliche fachliche Korrekturrichtung

Der Swarm soll vorhandene berechtigt projizierte Assignment-Felder und vorhandene authentifizierte Benutzeridentität verwenden. Eigene Datenhaltung/Zugriffsmodus dürfen echte Eigenzuweisung nicht übersteuern. Gruppenverantwortung, verantwortlicher Principal, Assignee/Bearbeiter und custodian müssen getrennt bleiben. Die persönliche Schnellansicht und die Verantwortlichenauswahl am bestehenden Assignment-Vertrag prüfen; erforderliche Namen ausschließlich über die bestehenden berechtigten IAM-Lookups, keine globale Userliste oder neue IAM-/Case-Schicht.

Angemessene Interaktions-/Verhaltensregression für die oben genannten Konstellationen und unbekannte Werte ergänzen. Existiert für konkrete Namen ein tatsächlicher nativer Lookup-Gap, genau diesen isolieren; unabhängig mögliche Korrektur der persönlichen Zuweisung fortführen. Produktkorrekturen bleiben Swarm-Arbeit.

## Aussagekraft der gemeldeten Tests und Formatierung

Die drei gemeldeten Dateien supacaseUsabilityAcceptance.test.ts, caseAssignment.test.ts und caseManagement.test.ts importieren/rendern die neue Cases-Liste nicht. Sie prüfen reine Contracts, gemockte Work-/Assignment-Aufrufe und statische Persistenzgrenzen. Die gemeldeten 42 grünen Tests belegen nicht den neuen Filter oder die UI-Interaktion. Typecheck ebenfalls nicht als Funktionsabnahme ausgeben.

Elf Prettier-Fehler sind laut Bericht offen, nicht von dieser Sitzung erneut mit ESLint ausgeführt. package.json enthält das vorhandene Standardwerkzeug Prettier. Keine wiederholten LLM-Volltextabschriften nur zur Formatierung; den bereits vorhandenen erlaubten deterministischen Entwicklungs-/CI-Weg verwenden. npm run format formatiert das gesamte Repository und ist nicht der begrenzte gewünschte Befehl. Keine Erweiterung des MCP in einen beliebigen Shell-Executor und keine stellvertretende CLI-Implementierung fachlicher Produktlogik.

## Fortschritt und verbleibende Grenzen

Der Bericht belegt die aktuelle Verbindung zum dedizierten Dienst statt des allgemeinen Containers. Diese Sitzung hat den laufenden Container nicht selbst inspiziert. Die tatsächlichen Produktwrites und Git-Readbacks sind Fortschritt und bleiben als solche erhalten. Die zusätzliche synthetische Probe ist weiterhin NOT_EXECUTED; nur für sie keine unnötige Scope-Erweiterung und keinen Stillstand der bereits zulässigen Produktarbeit erzeugen. Connector-Effect-Idempotenz bleibt von nativer Case-Autorisierung getrennt.

CI-Ergebnisse bleiben ohne authentifizierten repo-begrenzten Ergebniszugriff unbelegt. Die UAT-Content-Exclusion ist eine separate tatsächliche Organisationssperre und wird hier nicht aufgehoben. Keine Approval, Acceptance, Merge oder Produktion aus dieser Source-Prüfung ableiten.
