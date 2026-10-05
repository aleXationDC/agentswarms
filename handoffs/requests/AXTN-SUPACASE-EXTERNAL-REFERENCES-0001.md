# SupaCase External References und Case Handover V1

## Status und Autorisierung

Datum: 2026-10-03.
Tracking: aXtn/aXtn-agentswarms Issue #8.
Branch: work/AXTN-SUPACASE-EXTERNAL-REFERENCES-0001.
Initiale Untersuchungs- und Branchbasis: c7bb6e603d01cc1839fbc041ea8c53c321c33e04.
Status: READY_FOR_HOST_EXECUTION.
Architekturentscheidung: ACCEPTED_BY_USER.
Implementierung: NOT_STARTED.
Produktcode, Schema und Runtime wurden durch die Auftragserstellung nicht geändert.

Alex hat die vorherige repository-basierte Architekturprüfung mit „Ja, bitte genauso umsetzen.“ angenommen. Dieser Vertrag hält die angenommene V1-Entscheidung und den ausführbaren Auftrag fest. Er ist keine Behauptung einer technischen Acceptance.

Erlaubt: Umsetzung im Component-Repository, additive kompatible Source-/Migrationsdateien, sinnvolle Tests auf einem isolierten Testziel, Task-Branch-Commits und reviewbarer PR. Bestehende SupaCase-Arbeitsmetadaten gemäß AGENTS.md führen.
Nicht erlaubt: Merge, Tag, Release, produktive Schema-Migration, Deployment, Pinänderung, Service-Restart, neue Credentials oder Erweiterung bestehender Berechtigungen. Runtime-Autorisierung anderer Aufträge gilt nicht automatisch für Issue #8.

## Aktueller Fortsetzungsstand 2026-10-03 19:56 Europe Berlin

Die Ausführung ist freigegeben und für den vorhandenen Host-CLI bereit. Wiederholte Nutzerfreigabe: „Ja, bitte genauso umsetzen.“ Keine erneute Planungsfreigabe erforderlich.

Neu gelesener Development-Head: 5ff3841a217cb34a3a9b9f51a9083e04aab56919.
Aktuelle Repository-Evidence nennt App-Pin ff43febf35bee35e5a8346e142628e20bdefa5b9 und Host-Evidence 34f46d49aaa022236ed78c6be639f5a1505f5fb1.
Quellen auf diesem Head:
- docs/architecture/axtn-development-swarm/HANDOFF.md
- handoffs/reports/AXTN-DEVELOPMENT-SWARM-SUPACASE-RUNTIME-0001.md
- handoffs/reports/AXTN-DEVELOPMENT-SWARM-IMPLEMENTATION-0001.md
- src/axtn/workbenches/cases/workContract.ts

SupaCase Work consumer und manueller Zugang sind laut Evidence IMPLEMENTED / TESTED / DEPLOYED / RUNTIME_VERIFIED. Der neuere Work-Contract besitzt unter anderem details, verify, dependencies und accept sowie geschärfte Referenz-/Candidate-Prüfung. Die Aussagen über fehlende Work-Funktionen in der ursprünglichen Untersuchung sind historische Befunde, keine Aufforderung, erledigte Funktionen erneut zu bauen.

Der vollständige semantische Development-Swarm ist weiterhin nicht implementiert/abgenommen und durch Provider-Guthaben blockiert. External References als CLI-geführte Sourcearbeit benötigen diesen Swarm nicht. Keine Provider-, Credential- oder Billing-Änderung unter Issue #8.

Host-Executor: zuerst aktuelle Git-/Runtime-/Writer-Lage prüfen, neuere SupaCase-Funktionen und Source in den eigenen sauberen External-References-Worktree übernehmen, Contractdatei erhalten und Integrationsevidence festhalten. Kein Reset/Force-Push und keine stillschweigende Verwendung der alten c7bb-Basis. Die User-Freigabe autorisiert die Integration neuerer erforderlicher kompatibler Basisarbeit in den eigenen Task-Branch, nicht einen Merge in fremde oder geschützte Branches.

Eigener Parent für Issue #8 über den bereits vorhandenen Headless-Zugang; bestehende #7-Cases nicht als Parent dieses neuen Auftrags missbrauchen. Keine Abhängigkeit von der vollständigen Graph-Acceptance erfinden. Überschneidende Datei-Writes nur bei gesichertem Writer-Handoff; Runtime bleibt unter diesem Auftrag unverändert.

Diese ChatGPT-Session besitzt weiterhin keinen verbundenen Host-/SupaCase-Ausführungszugang. Produktcode wurde hier nicht geändert, Host-CLI nicht gestartet. READY_FOR_HOST_EXECUTION bezeichnet den vollständigen autorisierten Auftrag, keinen laufenden oder abgeschlossenen Implementierungslauf.

## 1. Entscheidung

Case bleibt persistenter lokaler Träger von Arbeit. Externe Systeme müssen weder Cases noch unsere Hierarchie verwenden. SupaCase erhält genau zwei optionale, opake Stringfelder:

- external_ref_id: Referenz des Arbeitsgegenstands bei der fachlichen Gegenstelle.
- external_parent_ref_id: von dieser Gegenstelle angegebene übergeordnete Referenz.

Lokaler Parent und externe Parent-Referenz sind unabhängig. Kein lokaler FK, kein automatisches Parent-Create und keine automatische Parent-Zuordnung aus external_parent_ref_id.

Account beschreibt die primäre fachliche Gegenstelle, Primary Contact den Ansprechpartner. source_kind/source_id behalten Herkunft beziehungsweise Entstehungsidentität. Dokument-ID, source_ref, Work-Ensure-Key und technische Delivery-ID behalten jeweils ihre bisherigen Verantwortlichkeiten.

Ein Case trägt in V1 ein primäres externes Referenzpaar im Kontext seines Accounts. Mehrere Gegenstellen/externen Identitäten desselben Cases sind eine ausdrücklich benannte V1-Grenze. Children erben die Referenzfelder nicht automatisch.

Account + external_ref_id ist ein primärer fachlicher Suchkontext innerhalb des serverseitig autorisierten Owner-/Datasetbereichs, kein globaler Unique Key. Kein Unique Constraint auf dieses Paar. Ein externer Request kann mehrere lokale Arbeitspakete betreffen. Mehrdeutigkeit muss zur Klärung führen.

Keine Federation, keine Mapping-Tabelle, kein neuer Dienst, keine globale ID, kein bidirektionaler Status-Sync, kein zweiter Scheduler und keine zweite Control Plane. Zusätzlicher Kontext erst bei konkret belegtem Gap und gesonderter Architekturentscheidung.

### Alternativen und Tradeoffs

1. source_kind/source_id als externe Identität umdeuten: verworfen, weil Herkunft und Korrelation unterschiedliche Semantik haben und DMS/Work-Ensure bestehende Regeln besitzen.
2. Account + External Ref als Unique Key: verworfen, weil mehrere lokale Arbeitspakete und mögliche Gegenstellenkollisionen zulässig beziehungsweise klärungsbedürftig sind.
3. Mapping-/Namespace-/Federation-Modell: zurückgestellt; für den beschriebenen V1-Bedarf nicht gerechtfertigt.
4. Zwei Case-Felder und kontrollierte Suche: angenommen. Einfach, kompatibel und manuell bedienbar; unterstützt bewusst nur ein primäres externes Referenzpaar je Case.

## 2. Verifizierte Ausgangslage und Quellen

Alle Quellen stammen aus Gitea. Angaben sind Snapshots, vor Ausführung erneut prüfen.

- AgentSwarms default main: d87a155626d6564416b590bc0e0efb7e8f75436e. Der vollständige src-Subtree enthält den untersuchten SupaCase-Pfad dort nicht.
- work/AXTN-DEVELOPMENT-SWARM-0001: c7bb6e603d01cc1839fbc041ea8c53c321c33e04.
- Host work/AXTN-DEVELOPMENT-SWARM-0001: 627e8d6908ebaccb7b513c9afaf97ea2e290df08.
- Host architecture/AGENTSWARMS-PIN.yaml dokumentiert executable/deployed Component 189e7960530207415d6cef45c1dd5b3c6e6695ba und Runtime-Teilabnahme; complete_v1_acceptance bleibt IN_PROGRESS.
- Die gelesenen Case-Kern-, Work- und UI-Dateien sind auf diesem Component-Pin und dem untersuchten Development-Head blob-identisch.
- DMS Plan work/AXTN-DMS-LEARNING-PLAN-0001: d73b2d3c39de2996d7e54ffa14c2e6caef05f2a4, docs/architecture/AXTN-DMS-RECOVERY-AND-LEARNING-WORK-ORDER.md.
- ECP PR #4: offen/unmerged, Head 326669c5cc3c8be15c60bc07e17824e21c642002, axtn/engagement-control-plane/IMPLEMENTATION-READY.md; Design, keine Produktimplementierung.
- SupaCase Restore PR #5 ist closed/merged in seinen Maintenance-Zielbranch, kein Nachweis einer Integration in default main.

Maßgebliche Component-Pfade:
- AGENTS.md
- docs/architecture/axtn-development-swarm/HANDOFF.md
- docs/architecture/axtn-development-swarm/SUPACASE-CASE-MODEL.md
- src/axtn/workbenches/cases/caseContract.ts
- src/axtn/workbenches/cases/caseManagement.functions.ts
- src/axtn/workbenches/cases/caseManagement.server.ts
- src/axtn/workbenches/cases/workContract.ts
- src/axtn/workbenches/cases/work.server.ts
- src/routes/api/cases.work.ts
- src/routes/_authenticated/cases.tsx
- src/routes/_authenticated/cases_.$caseId.tsx
- supabase/migrations/20260929010000_axtn_case_work.sql
- axtn/swarms/axtn-document-intake/nodes/validate-envelope.js
- axtn/workbenches/axtn-supacase/manifest.json
- tests/unit/caseWork.test.ts
- tests/integration/caseWork.sql

Befunde:
- Cases/Accounts/Contacts/Relations sind logische owner-gebundene generische Datasets.
- ensureDataset liefert ein bestehendes Dataset zurück, ohne dessen Spaltenmetadaten zu aktualisieren.
- validateCaseReferences prüft Existenz, nicht Account-Contact-Konsistenz.
- Der bisherige CRUD-Pfad zeigt keine vollständige Parent-Zyklusprüfung.
- WAITING_CONTACT verlangt Primary Contact und Follow-up.
- DMS ensureCaseForAcceptance erzeugt TODO/OPEN erst bei Filing-Abnahme und verwendet dms_document/documentId. Getrennte Reads/Writes belegen keine konkurrierende Exactly-one-Garantie.
- Work-Ensure verwendet eine owner-gebundene SQL-Transaktion, advisory lock und development_work/sourceId-Identität.
- WorkIdentity ist aktuell DEVELOPMENT_* spezifisch und hat weder Account/Contact noch External References.
- WorkReference beschränkt repository auf aXtn/...; workContractRef allein belegt keine Prüfung eines akzeptierten Solution Contracts.
- Der aktuelle Intake-Validator projiziert technische Herkunft/Privacy, keine External References.
- Issue #7 und ursprüngliche Contracts enthalten historische PREFLIGHT_BLOCKED-Angaben. Neuere Handoff-/Runtime-Evidence hat Vorrang für ihren konkret belegten Teilumfang; keine Gesamt-V1-Acceptance daraus ableiten.

Diese ChatGPT-Session hat keine neue Live-Runtime-Prüfung ausgeführt.

## 3. Ausführung und SupaCase

Pflicht: aktuelle AGENTS.md und geltende Host-Execution-Regeln vollständig lesen. Auf verifiziertem Host vorhandenen autorisierten CLI-Zugang und hostlokales natives Git verwenden. Keine Repository-Rekonstruktion durch MCP als Ersatz für Host-Git.

Diese ChatGPT-Session besitzt nur den Gitea-Connector, keinen aufrufbaren SupaCase-Zugang oder verifizierten Host-Executor. Plugin-Suche ergab keinen bereits verbundenen passenden Zugang. Es wurde kein Parent Case erzeugt und kein Implementierer remote gestartet.

Der Host-Executor muss vor Produktcodearbeit:
1. Hostidentität, cwd, Origin, Branch, HEAD, Worktree, Environment und Rechte verifizieren.
2. Aktuelle Development-/DMS-Heads, deployten Pin und aktive Writer lesen.
3. Einen sauberen eigenen Task-Worktree verwenden und aktuelle kompatible Basis mit Evidence festhalten.
4. Über den vorhandenen serverseitig owner-gebundenen Zugang genau einen idempotenten Parent DEVELOPMENT_CHANGE für aXtn/aXtn-agentswarms#8 sicherstellen.
5. Stabile Work-Source-ID: implementation:supacase-external-references-v1:agentswarms-8. Gleicher Auftrag/Retry/Takeover führt denselben Case fort.
6. Children nur für eigenständig verantwortbare Arbeitspakete, etwa Contract/Persistenz, Correlation/Handover und Integration/Verification.
7. Alle Git-/Issue-/PR-/Run-/Evidence-Referenzen sowie Actor, Mode und Channel im bestehenden Modell führen.
8. Kein Token, Owner oder Secret in Graph, Git oder Case-Metadaten.

Issue #7 und #6 nicht umschreiben oder unter diesem Auftrag erweitern. Der neue Branch ist zunächst isoliert. Gemeinsame Dateien erst nach abgestimmtem Writer-Handoff integrieren; kein Force-Push, Reset oder paralleles Bearbeiten derselben Worktrees. DMS-spezifische Integration mit dessen finaler Basis koordinieren; kein neuer konkurrierender Intake-Case-Pfad.

Bei nicht verfügbarem Case-Zugang die konkrete Zugriffslücke beheben, soweit bestehende Autorisierung das erlaubt. Keine dauerhafte Sonderpersistenz und keine ungetrackte Produktimplementierung. Integration-Endpunkt dieses Auftrags ist PR_READY; kein Deployment-Endpunkt.

## 4. Pflichtänderungen am Case-Contract

CaseDraft:
external_ref_id?: string | null
external_parent_ref_id?: string | null

Übernahme in CaseRecord, Create-/Update-Input und alle Case-Erzeugungspfade. Beide Felder auf derselben bestehenden Case-Row persistieren; keine eigene Referenztabelle.

Gemeinsame Validierung für UI, headless und Automation:
- optional/nullable, nichtleere Strings;
- V1-Limit 500 Zeichen je Feld;
- reine Leerraumwerte und Steuerzeichen ablehnen;
- keine Trim-/Casefold-/Unicode-Normalisierung, Präfixentfernung, UUID-Prüfung oder numerische Konvertierung;
- zulässigen Originalstring exakt erhalten;
- absent beim Update = erhalten, null = ausdrücklich löschen;
- externe Parent-Referenz darf ohne externe Eigenreferenz bestehen;
- niemals Existenz einer externen Referenz im lokalen Case-Dataset verlangen.

Account kann fehlen; automatische Account-basierte Korrelation bleibt dann ungelöst. Kein neuer globaler Account-Zwang für bestehende Cases.

Dataset-Metadaten:
- Spaltenlisten in TypeScript und SQL-Erzeugungspfad ergänzen.
- Vorhandene axtn_cases-Metadaten additiv und idempotent reconciliieren.
- Unbekannte bestehende Spalten erhalten; keine komplette Überschreibung fremder Metadaten.
- Alte Rows ohne Felder als unbekannt lesen; kein destruktiver Backfill.
- Bestehende Migration nicht umschreiben; nötige Änderungen als neue additive Migration nach aktueller Repo-Konvention.
- JSON-Rows benötigen keine erfundene physische axtn_cases-Tabelle.

Gemeinsame Case-Mutationspfade müssen serverseitig zulässige Felder begrenzen. Automatische Referenzübernahme darf bestätigte Referenzen nicht ungeprüft ersetzen. Änderungen/Korrekturen revisions- beziehungsweise versionsgebunden gegen konkurrierendes Schreiben schützen und knapp auditieren; keine Referenzrohwerte unnötig in Logs kopieren.

## 5. Correlation Contract

Kleine serverseitige Funktion in der bestehenden Case-Capability, keine neue Runtime:
- Owner ausschließlich aus authentifiziertem Serverkontext.
- Autorisierten Eingangskontext auf Account/Contact abgleichen.
- Exakter Vergleich account_id + external_ref_id im lokalen autorisierten Datasetbereich.
- Geschlossene Cases nicht pauschal ausschließen.
- Kein fuzzy Identifier-Matching.
- Kein Vertrauen in frei behauptete Account-/Contact-/Owner-Zuordnung.
- Account-Contact-Widerspruch blockiert automatische Zuordnung; Contact muss nicht generell als Account-Mitglied erzwungen werden, wenn legitimer abweichender Ansprechpartner ausdrücklich bestätigt ist.
- Contact ist Kontext, kein dauerhafter Unique-Key-Bestandteil.

Minimale Ergebnisse: MATCHED, NO_MATCH, NEEDS_CLARIFICATION, CONFLICT.
Ergebnisse enthalten nur zulässige Candidate-IDs, knappen Reason-Code und nötige Kontextreferenzen.

Genau ein konsistenter Kandidat: MATCHED.
Mehrere Kandidaten: externe Parent-Referenz und vorhandene bestätigte Kontextzuordnungen zur eindeutigen Auflösung verwenden. Keine Confidence-Schwelle, kein Raten, kein neuester Case als stiller Default.
Kein Account oder keine ausreichende Referenz: NEEDS_CLARIFICATION, außer bereits bestätigte lokale Kontextbindung löst den Eingang.
Abweichende bestätigte Parent-/Account-Zuordnung: CONFLICT.
Fehlende Parent-Referenz am gespeicherten Case ist kein bewiesener Widerspruch.
NO_MATCH erzeugt allein noch keinen Case: neuer unabhängiger Auftrag versus Antwort mit unbekannter Referenz muss anhand Intake-Vertrag unterschieden werden.

Kein Unique Constraint auf Account + external_ref_id. Erst bei konkret dokumentierter wiederkehrender Kollision über unabhängige Systeme/Environments zusätzliche Architektur vorschlagen; nicht still account_id künstlich aufspalten.

## 6. Idempotenz und fachliche Case-Erzeugung

Correlation ist nicht Delivery-Deduplikation.
- Fachliche Request-Identität bestimmt den Work-Ensure-Key.
- Technische Message/Delivery-ID dedupliziert dieselbe Zustellung, erzeugt aber nicht einen Case je Nachricht.
- source_kind/source_id behalten ihre vorhandene Herkunfts-/Ensure-Semantik.
- Neue unabhängige Requests erzeugen eigene Arbeit; Retry, Resume, Moduswechsel und zusätzliche Nachricht im selben Auftrag erhalten den Case.
- Ensure/Create nach Prüfung atomar gegen konkurrierende Eingänge schützen, in vorhandener Persistenz.
- Reuse identischer Identität ist idempotent; abweichender Inhalt führt zu kontrolliertem Konflikt.
- Kein zweiter Scheduler und keine generische Ticket-Synchronisation.

## 7. Handover und Antworten

Eingehender Handover bindet ein bestätigtes Referenzpaar an den lokalen Work Case. Einfache Nachricht bleibt Interaktion am bestehenden Auftrag.

Child nur bei eigenständiger Verantwortung oder eigenem Work-/Result-Contract:
- Customer Clarification;
- separate fachliche Freigabeprüfung;
- eigenständiges Solution-/Development-/Improvement-Arbeitspaket.

Children erben externe IDs nicht automatisch. Antwort aus einem Child ohne eigene externe Identität verwendet einen ausdrücklich gebundenen übergeordneten Handover-Kontext. Kein impliziter Parent-Walk mit beliebiger Referenzübernahme.

Ausgehender Referenz-Context:
- external_ref_id und external_parent_ref_id aus dem bestätigten Kontext exakt zurückgeben;
- missing/null konsistent abbilden;
- parent_case_id niemals als external_parent_ref_id ausgeben;
- lokale Hierarchie/Case-IDs nur bei konkreter zulässiger Notwendigkeit übertragen;
- Ref-ID ist weder Empfängeradresse noch Authority noch ausführbare URL;
- kein Dereferenzieren beliebiger IDs/URLs;
- Transport nutzt seine bestehenden Effect-/Delivery-/Readback-Verträge;
- unbekanntes Versandresultat nicht blind als erfolgreich markieren oder erneut senden;
- keine neue Nachrichten-Inbox oder Versandplattform bauen.

Minimalen headless Correlation-/Handover-Zugang in bestehender API-Familie bereitstellen. Fehlende benötigte Transportbindung explizit ausweisen; keinen fiktiven E-Mail-End-to-End-Nachweis behaupten.

## 8. UI und manuelle Fortführung

Case-Detail zeigt External Ref ID und External Parent Ref ID getrennt von Local Parent und Source.
Beide Felder manuell über dieselben Validatoren pflegen; bestätigte Korrektur mit konkurrierender Update-Prüfung.
Klärungsfälle zeigen Grund und berechtigt sichtbare Kandidaten. Berechtigter Mensch/Agent kann Zuordnung bestätigen; automatischer Prozess wartet auf diese eindeutige Bindung.
Weder jede Nachricht noch jeder Matching-Versuch wird ein Case.
WAITING_CONTACT nur mit Primary Contact und Follow-up. Ohne Ansprechpartner NEW/OPEN mit Klärungsgrund; kein neuer generischer WAITING-Status.
Manueller Modus verwendet denselben Work-/Result-Contract und gleiche Hard Gates.

## 9. Solution Contract und Komponenten

Jeder Development Change benötigt einen gültigen und akzeptierten Solution Contract vor Entwicklungseffekten.
Dieser Auftrag ist der vom Nutzer angenommene lokale Solution-/Implementierungsvertrag für Issue #8; technische Acceptance des Ergebnisses bleibt unabhängig.

Für spätere externe Contracts:
- Mensch, Kunde, Partner und anderes autorisiertes System können Erzeuger sein.
- Keine Pflicht, dass ein eigener Solution Architecture Swarm den Contract erzeugt.
- Inhalt/Scope/Revision/Authority gegen lokale Anforderungen validieren.
- Akzeptierten unveränderlichen Contract lokal referenzierbar machen, Quellenherkunft und Entscheidung belegen.
- Arbeitsreferenz allein darf Acceptance nicht behaupten.
- Keine pauschale Freigabe beliebiger externer URLs oder Erweiterung von WorkReference.repository.
- Start-/Development-Gate prüft exakte gültige Accepted-Revision; Änderung invalidiert betroffene Annahme.
- Bestehende interne Aufträge mit belegtem akzeptiertem Contract gezielt kompatibel anbinden; keine erfundene Accepted-Default-Markierung.

DMS:
- Dokument-ID, source_ref und related_document erhalten.
- Zwei Felder nur aus bestätigtem fachlichem Handover übernehmen.
- Aktueller NO_AI/UNRESOLVED-Privacy-Hold bleibt wirksam; Identifier sind untrusted Daten, keine Instruktionen.
- Keine semantische Referenzextraktion vor erlaubter Privacy.
- DMS-Case-ab-Intake ist bereits im DMS-Auftrag vorgesehen; denselben späteren Ensure-Pfad nutzen und aktuellen Filing-/Resume-Pfad regressionsfrei halten.
- Bestehende primäre Dokumentrelation nicht überschreiben; kein zweiter Intake-Work-Case-Mechanismus.

CIP:
- Finding/Observation erzeugt Improvement Work im bestehenden Modell.
- Kein automatisches Graph-/Policy-/Prompt-Ändern und keine automatische Promotion.
- Externe IDs nur bei wirklicher externer Übergabe; interne Repos/PRs/Evidence behalten typisierte Referenzen.

ECP:
- Nur Designkontext; keine implementierte Authority-/Delegation-/Datenfreigabe-Capability voraussetzen.
- Bestehende Auth/IAM/Quellen-/Empfängerrechte gelten.
- Keine ECP-Produktimplementierung unter Issue #8.

## 10. Arbeitspakete und Prüfungen

A: Current-source/Case preflight und akzeptierte Contract-Bindung.
B: Gemeinsamer Case-/Dataset-/Create-/Update-/Work-Contract plus UI.
C: Exakte Correlation, Klärungsbindung und referenzerhaltender Handover.
D: DMS-/Development-/CIP-Anschlüsse gegen aktuelle gemeinsame Basis.
E: Unabhängige Review und reviewbarer PR mit Evidence.

Sinnvolle Tests, nicht nur Source-String-Scans:
1. Beide Referenzen exakt durch Create, Read, Update, Handover und Persistenz erhalten; Groß-/Kleinschreibung, führende Nullen und zulässige Unicode-Zeichen.
2. absent/null, reine Leerraumwerte, Steuerzeichen und Length-Limit korrekt.
3. Bestehendes Dataset-Metadaten-Reconcile zweimal ohne Daten-/Spaltenverlust.
4. Local Parent und External Parent unabhängig; externen Parent ohne lokalen Record akzeptieren.
5. Exakte Account/Ref-Korrelation; fremder Owner und unzulässige Candidate-Zugriffe abgewiesen.
6. Mehrere lokale Candidates und mehrere externe Systeme mit gleicher Ref führen ohne eindeutigen Kontext zur Klärung.
7. Parent-Kontext löst eindeutig; bestätigter Widerspruch führt zu CONFLICT.
8. Unbekannter Account/Contact, Contact-Account-Widerspruch und Contact-Wechsel.
9. Geschlossener Case, relevante Wiederaufnahme und wiederverwendete externe Ref; kein blindes Neu-Create.
10. Konkurrierender gleicher Request/Retry erzeugt einen Work Case; abweichender Payload unter derselben Identität kontrollierter Konflikt.
11. Zwei Nachrichten im selben Auftrag erzeugen keinen zweiten Case.
12. Child mit/ohne eigener externer ID antwortet nur über ausdrücklich gebundenen Kontext; keine ungewollte Erbschaft.
13. Änderung/fehlende/widerrufene Solution-Contract-Acceptance stoppt Entwicklungseffekte; externer Erzeuger mit gültiger lokaler Acceptance erlaubt.
14. DMS Filing-/Resume-/Relation-Verträge und NO_AI/UNRESOLVED regressionsfrei.
15. Lost-response/Retry erzeugt keine Doppelwirkung; unbekannte Zustellung wird nicht als erfolgreich behauptet.
16. Isolierter Restart/Persistenz-Readback erhält Referenzen, Hierarchie und Case-Linie.

Unit-, echte isolierte DB-/Concurrency- und relevante Integrationstests passend zum Change; Typecheck, Lint, vorgeschriebene Doc-/Infra-Checks und Build. Keine produktiven Testmutationen oder Restart unter diesem Auftrag.

## 11. Result Contract und Abschluss

Versionierter Abschlussbericht:
- Parent und relevante Children;
- ursprüngliche und tatsächlich verwendete Basis, Candidate SHA und PR;
- geänderte Dateien und additive Migration;
- Entscheidungen unverändert / belegte neue Gaps;
- implementiert, tatsächlich getestet und runtime-verifiziert getrennt;
- echte Testresultate mit Revision und Evidence;
- manuelle Nutzung und verbleibende Transport-/Operator-Konfiguration;
- Reconciliation/Idempotenz-/Concurrency-Evidence;
- kompatible Integration mit Development #7 und DMS #6;
- ausdrücklich NO_MERGE / NO_DEPLOYMENT / NO_PROD_MIGRATION.

Abnahme endet PR_READY nach unabhängiger Acceptance des exakten Candidate. Kein Parent-Abschluss aus Selbstfreigabe. Offene Runtime-Nachweise bleiben offen; späteres Deployment braucht eigenen umgebungsspezifischen Auftrag.
