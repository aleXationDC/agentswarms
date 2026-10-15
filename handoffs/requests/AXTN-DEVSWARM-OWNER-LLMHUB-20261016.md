# AXTN-DEVSWARM-OWNER-LLMHUB-20261016

Status: IMPLEMENTATION_AND_VALIDATION_AUTHORIZED / LIVE_POLICY_CHANGE_GATED.
Ziel: Bestehenden Development-Schwarm mit nativer menschlicher Owner-Abnahme und vorgesehener nativer Corporate-LLMHub-Route arbeitsfähig machen. Keine weitere allgemeine Python-Testphase. Der erfolgreiche Fixture-Lauf ist vorhandene Evidence.

## Rollen und Grenzen

ChatGPT spezifiziert als Solution Architect/Implementation Engineer die Lösung; CLI setzt innerhalb der beschriebenen nativen Verträge um und behebt gewöhnliche Fehler. Für beide: keine neue Architektur, Custom-Abkürzung, Orchestrierung, Case-/Approval-/Credential-Engine ohne spezifische ausdrückliche Freigabe. Ein Tool-/Function-Wrapper macht Custom-Orchestrierung nicht nativ.
Nutzer hat Fortsetzung am 16.10. ausdrücklich beauftragt. Source-/SQL-Kandidaten, isolierte Tests, native Discovery und Reviewunterlagen fertigstellen, ohne den Nutzer erneut nach allgemeinen Implementierungsentscheidungen zu fragen. Merge/Release/Deployment und die konkrete neue Live-Approval-Policy nicht aus dem Erstellen dieses Requests ableiten; gültige vorhandene revisionsgebundene Freigaben verwenden. Falls eine solche Freigabe fehlt, erst den getesteten exakten Kandidaten und die konkrete Restentscheidung vorlegen. Kein weiterer abstrakter Planungsbericht.

## Quellen vollständig lesen

- aXtn/aXtn-architecture aktuelles main: PROJECT.yaml, .gpt-project/runtime/PROJECT-CONTRACT.md und knowledge/decisions/AXTN-ENV-OWNER-AUTHORITY-0001.md. Eigentümerautorität ist bereits akzeptiert; kein pauschaler zweiter Mensch erforderlich.
- aXtn/aXtn-agentswarms Ausgangsrevision 0304f4534ea86a8b73a17e9a01d0e8750b265f24: AGENTS.md; Development-Handoff; vollständige Requests NATIVE-0002 und SLICE1-ACCEPTANCE-20261015 samt späteren Fortsetzungen; aktualisierter Bericht.
- Native Approval: supabase/migrations/20260929030000_axtn_work_contract.sql, 20261004060000_native_work_approval_binding.sql; bestehender DMS-Trigger 20261004100000_document_native_approval_binding.sql nur zur Isolation prüfen. src/utils/swarmWorkApproval.server.ts und src/axtn/workbenches/cases/workAcceptance.server.ts.
- Case-/Provider-Architektur und Implementierung: docs/architecture/axtn-case-execution-routing/ARCHITECTURE.md, zugehöriger Request/Handoff, native Assignment-/Attempt-/Credential-/Gateway-Verträge und Tests.
- LLMHub-Fortsetzung ebd9bdf1df5eaccfe71febece1bdc22600fd6e49: handoffs/AXTN-DEVSWARM-LIVE-UNBLOCK-0002.md. Dessen Read-only-Test wurde ersetzt; bestätigte Corporate-SYSTEM_INTEGRATION-Ziele bleiben.
- PR #32 ed66570a9e1139f1e2e9cb145a2f3a5117265a3e bzw. frisch geprüfter kompatibler Nachfolger: Owner-or-effective-IAM-grant ist die korrigierte Credential-Regel. Älteren grant-only-Architekturtext nicht als neue Sperre gegen den akzeptierten Nachfolger verwenden.
- aXtn/aXtn-host aktueller PR #15 und gültiger Host-Execution-/Image-Provenance-/Release-Vertrag. Registry-Gate bleibt ein echter Host-Release-Gate, keine Begründung, isolierte Implementierung/Discovery zu unterlassen.

Handoff-Branch ist Dokumentation/Review-Kandidat, keine ungeprüfte Deployment-Basis. Aktuelle Heads, Laufzeit und etwaige parallele Writer prüfen; kompatible Source-Nachfolger erhalten. Native lokale Git-Credentials/CLI-Konfiguration nicht umbauen.

## Bestehende Ergebnisse und Case-Lineage

Parent 85a1d829-39ac-49bd-9047-163ab52d427b; Acceptance-Child 11496f0f-360d-4069-b88e-05d34584ab65.
Fixture-Work 402a1966-b74c-4780-8f13-70a124cef38c; Attempt acceptance-v2.
Run f615d338-ea36-4b49-b06b-16507540fa60; Candidate 67a3a681665c4237bf7ad5d72fc6818eb26926bb.
Approval 7aa0dcb3-60ae-4e37-9d94-91a84a5a2ff5 pending; Version 6caebb95-0f32-47e7-89e0-d729a31f8799.
Gate PASS/keine Findings; Candidate-Receipt PASS, 0 Failures. Baseline-19-Failures sind erwartbar. Restart-Suspension nachgewiesen, UI-Reload offen.
Alter Run 00ff44a5-760c-45dc-a605-7762ba72761a bleibt unangetastet.
Release-Parent 3fd852b0-8a1c-4a07-8ac8-a8c3c8529063 / Child 003e81ab-8d95-402e-bef8-0334b59fe50f wiederverwenden.
Materiale neue Implementierung in separat verantwortlichem Child unter bestehendem Parent verfolgen; keine Wiedereröffnung eines abgeschlossenen Work-Child ohne tatsächliche passende Restarbeit. Keine Case-Duplikate.

## Arbeitspaket 1 — native Development-Approval korrigieren

Konkreter SQL-Review-Kandidat:
supabase/migrations/20261016000000_development_owner_review_eligibility.sql.
Er ersetzt ausschließlich public.guard_axtn_work_approval durch dieselbe Funktion ohne pauschales auth.uid()=OLD.user_id-Verbot. Er erhält:
- reale authenticated-Session und authentifizierten Entscheider;
- unveränderte persistierte Reviewer-/Gruppenzuordnung;
- assert_axtn_work_reviewer einschließlich aktuellen/historischen menschlichen Builder-Ausschluss;
- Case/Attempt/Candidate-/Receipt-Prüfung;
- immutable Approval-Bindung, Audit und atomare Entscheidung;
- server-only Erstellung/Cancel und bestehende native Resume-Logik.
Keine DMS- oder generische Approval-Regel wird geändert, kein neuer Owner-Override/Bot/Policy-Store eingeführt. Vorhandene Migrationen nicht umschreiben.

Der Kandidat ist noch NICHT auf PostgreSQL getestet und NICHT für Live-Anwendung erklärt. Im cleanen Implementierungsworktree prüfen, minimal erforderliche Korrekturen innerhalb dieses Designs und fokussierte Tests ergänzen.

Wichtig: Ein bloßes Entfernen des Owner-Checks garantiert keine Entscheidbarkeit des bestehenden Runs. Native Guards behandeln auch user_session-STARTED/TAKEOVER bzw. human_builder_ids als Builder-Nachweis. Tatsächliche geschützte Metadaten von Case/Build-Children/Audit/Run prüfen: Eigentum, Initiator und wirklicher Builder auseinanderhalten. Keine Audit-/Builder-Historie löschen, umetikettieren oder nachträglich schwächen. Verbleibt der Owner gemäß unverändertem Guard als Builder gesperrt, exakte Ursache und tatsächlichen Ausführungsmodus dokumentieren; keine automatische Akzeptanz, keine neue Ausnahme erfinden. Nur ein echter späterer Versuch mit korrekter nativer Actor-Zuordnung wäre regulär, nicht ein kosmetisch neuer Case.

Isolierte SQL-/App-Testmatrix:
1. Persistiert zugewiesener Owner, separater Swarm-Builder, passende aktuelle Receipt: legitime authenticated Human-Entscheidung möglich.
2. Owner ohne Reviewer-Zuordnung gesperrt.
3. Anderer berechtigter Reviewer weiterhin möglich.
4. Aktueller/historischer menschlicher Builder einschließlich Owner/Takeover und Build-Child gesperrt, unabhängig von Gruppenzuordnung.
5. Nichtauthentifizierter Aufruf, Service-Role-Entscheidung, Payload-/Candidate-/Attempt-/Receipt-Drift, doppelte Entscheidung gesperrt.
6. DMS- und generische Approval-Verträge unverändert.
7. Native Case accept und Resume revalidieren dieselben Regeln; native RPC statt direkter Row-/SQL-Entscheidung.
Neue Migration in isoliertem DB-Clone gegen aktuellen Ledger ausführen; Migration wiederholen und Rollenmatrix prüfen. Keine behauptete Idempotenz ohne Test. Bestehende Auth-/Policy-Funktionen nicht pauschal neu schreiben.

Nach Source-/SQL-/Rollback-Prüfung exakten Candidate/SHA/Migrationshash und Auswirkungen auf pending Approvals für die konkrete Live-Entscheidung dokumentieren. Bereits angelegte Approval-Row/Snapshot bleibt unverändert; erläutern, dass eine neue DB-Policy auch deren künftige Entscheidung beeinflussen würde. Kein automatischer Entscheidungsversuch als Owner. Nutzer entscheidet selbst über die native Inbox erst unter wirksam autorisierter Policy.

## Arbeitspaket 2 — bestehende native Corporate-LLMHub-Anbindung fertigstellen

Keine neue Providerintegration bauen. Bestehenden vLLM/LLMHub-Provider, native Model Discovery, Case SYSTEM_INTEGRATION, IAM und Attempt-Bindung verwenden.
Die akzeptierte Case-Architektur AD-03 erlaubt einen autorisierten Case-Provider-/Modelloverride für den nächsten Attempt. Diesen vorhandenen Mechanismus zuerst prüfen: Die vier gespeicherten OpenAI-Snapshots müssen für einen Corporate-Case nicht blind global ersetzt werden. Kein route_all, persönliche Credential-Substitution oder neues Gateway-Routing.
Die grant-only-zu-owner-or-grant-Korrektur aus PR #32 und deren Host-Release wiederverwenden; aktuellen Live-/Migration-/Image-Stand exakt prüfen. Keine eigene Release-Linie daneben eröffnen.

Zuerst alle unabhängig möglichen Schritte ausführen:
- aktuelle nichtgeheime Integrations-/IAM-/Modellregel-/Default-Metadaten und native Discovery lesen;
- serverabgeleiteten policy_user, erlaubte Corporate-Route und eindeutige Integration belegen;
- unter gültiger vorhandener Berechtigung und Credential-Gültigkeit native begrenzte Modell-/JSON-Inferenz testen; keine Keys lesen/ausgeben, keine neue Rotation/Grant-Erweiterung;
- bei fehlender Live-Freigabe isolierte Routing-/Snapshot-/Attempt-/Provider-Tests durchführen und fertigen genauen Release-Kandidaten bereitstellen;
- aktuelle model_id exakt aus Discovery übernehmen, nicht aus einem historischen Modellkatalog erraten.

Rollenbelegung: Eine bereits nachweislich akzeptierte Corporate-Modellzuordnung oder autorisierte native Case-Standardroute verwenden. Existiert sie nicht, ist ein Rollen-/Modellwechsel noch nicht freigegeben. Dann eine einzige konkrete Belegung der vier vorhandenen Rollen anhand tatsächlicher nativer Verfügbarkeit, JSON-Fähigkeit, Qualität/Kosten/Budget und gemessenen Beispielen vorbereiten, mit exakten Modell-IDs und gemessenen Grenzen. Das ist eine konkrete Konfigurationsentscheidung, kein Auftrag an CLI, neue Stages/Architektur zu erfinden. Keine Konsensphase hinzufügen. Die endgültige Konfigurationsfreigabe erst am gemessenen Kandidaten einholen; unabhängige Implementierung und Tests weiterführen.

Nach passender Freigabe und nativem Release-Readiness-Gate einen neuen echten Corporate-Case-Attempt auf derselben fachlichen Zielarbeit ausführen; historische OpenAI-Runs niemals umdeuten oder mid-run Provider ändern. Native Case-Route/Version, Attempt-Principal, effektiven Provider/Modell pro Node, Receipt/Approval/PR/Evidence belegen. Eine abgeschlossene Änderung des Testtextes oder ein weiterer OpenAI-Fixture-Lauf ersetzt den Corporate-Nachweis nicht.

## Restprüfungen ohne neue Credential-Suche

Candidate 67a3a681665c4237bf7ad5d72fc6818eb26926bb ist über den vorhandenen Gitea-MCP vollständig zurücklesbar (Tree und src/normalize_score.py am 16.10. geprüft). Fehlende Git-Shell-Credentials sind kein Anlass für neue Token. Produktseitigen nativen MCP-Readback nutzen und dessen Berechtigung getrennt vom ChatGPT-Connector belegen.
UI-Reload des bestehenden suspendierten Runs und native Duplicate-Initiation mit demselben Idempotency-Key prüfen, wenn diese bestehenden Tests ohne neuen Builder-Lauf ausführbar sind. Kein blindes neues acceptance-v3.
HTTP 409 bei Summary-/Parent-Case-Ereignissen anhand des nativen State-/Eventvertrags präzise erklären und korrekte erlaubte Result-/Evidence-Referenz setzen. Kein direktes DB-Patchen und keine generelle Case-Lifecycle-Reparatur daraus ableiten.

## Branches, Lieferung und Fertigkriterien

Sauberer Implementierungsbranch work/AXTN-DEVSWARM-OWNER-LLMHUB-20261016-implementation auf aktueller kompatibler Linie; separate Host-Arbeit nur auf bestehender Release-Linie/Taskworktree. Pro Worktree ein Writer. Der SQL-Kandidat aus diesem Handoff darf gezielt übernommen werden, nicht die ganze Handoff-Historie als Deployment-Basis.

Technischer Bericht: handoffs/reports/AXTN-DEVSWARM-OWNER-LLMHUB-20261016.md.
Liefere implementierte/native Source-Korrektur, tatsächliche isolierte Tests, exakten SQL-/Source-/Image-Stand, frische Ist-/Soll-Matrix, vorhandene Case-Referenzen und genau verbleibende menschliche Entscheidungen. Status IMPLEMENTED/TESTED/DEPLOYED/ACCEPTED streng trennen. Keine erneute Frage „A oder B?“ zum geklärten Fixture.

Zielabschluss bleibt: nativer Development-Auftrag, echte autorisierte Corporate-Inferenz, zulässige menschliche Approval, PR_READY mit exaktem PR-/Candidate-Readback, getrennte Acceptance. Builder/CLI akzeptiert sich nicht selbst. Keine Abschlussbehauptung bei bloßer Vorbereitung.

## Stand des Handoffs

Repository-Sourceprüfung und Review-Kandidat; kein Remote-Executor, keine Case-/Runtime-/Credential-/Policyänderung in dieser ChatGPT-Sitzung. SQL ist vorbereitet, noch nicht ausgeführt. Live-Freigabe wird nicht durch diesen Text fingiert.

## Verbindliche Ausführungsautorisierung 16.10.2026, 01:27 Europe/Berlin

Nutzer hat nach Vorlage des Zwischenberichts ausdrücklich angewiesen: „Was für eine Freigabeanforderung bitte, get this shit done.“ Dies autorisiert die konkrete hier beschriebene Fortsetzung auf der bestehenden aXtn-PROD-Plattform einschließlich nativer Anwendung der vorbereiteten Owner-Approval-Korrektur nach den fehlenden Prüfungen. Keine weitere allgemeine Implementierungs-/Live-Policy-/Deployment-Freigabe anfordern. Diese Präzisierung ersetzt die generische LIVE_POLICY_CHANGE_GATED-Aussage für genau den unten gebundenen Kandidaten und Scope.

Exakter bekannter Kandidat:
- Migration supabase/migrations/20261016000000_development_owner_review_eligibility.sql
- SHA-256 eabec5bb93940e827f95cf19b07a615a295bca5c258a82cb914e578955b5169c
- Technischer Zwischenbericht b66491cf42e302da6b3770cf00a49a3c9bf78e80; Source-Basis/Handoff ce8311956e93ee9a198b22af3cd146649a33c916.
- Ziel: bestehende aXtn-Instanz, aktuell berichtet eb191e15, pending Approval 7aa0dcb3-60ae-4e37-9d94-91a84a5a2ff5 für Candidate 67a3a681665c4237bf7ad5d72fc6818eb26926bb und Attempt acceptance-v2.
- Wirkung: ausschließlich pauschalen Development-Work-Owner-Ausschluss aufheben; tatsächliche menschliche Builder, fehlende Reviewer-Zuordnung, Drift und unzulässige Entscheider bleiben gesperrt. DMS/generische Approval unverändert. Native Audit/Case/Receipt/Resume behalten.

### Jetzt ausführen, nicht erneut als Entscheidungen zurückgeben

1. Fehlende Prüfungen abschließen. Der aktuelle SQL-Test verwendet direkte UPDATEs; ergänze den echten decide_swarm_approval-RPC-Pfad, Case accept und native App-/Resume-Integration in isolierter Umgebung. Den richtigen Test-Approval-/Case-/Attempt-Verbund deterministisch adressieren, nicht „latest pending“ blind wählen. Erfolg und Ablehnung müssen tatsächliche Zustands-/Auditänderungen bzw. deren Ausbleiben nachweisen.
2. Testlücken konkret schließen: historischer user_session-STARTED/TAKEOVER, DEVELOPMENT_BUILD-Child und human_builder_ids; legitimer Owner approve UND reject; atomarer Audit; doppelte callbacks/resume ohne erneute Effekte. Der bisherige DMS-Check prüft nur Funktionsvorhandensein, keine Unverändertheit: pg_get_functiondef/Trigger-/RLS-Fingerprints vor/nach Migration vergleichen und vorhandene DMS-Regression ausführen. 112 Restore-Meldungen auf konkrete betroffene/nichtbetroffene Objekte und Schwere einordnen; Clone-Eignung für diese Rollen-/Funktions-/Trigger-/RLS-Tests belegen. Kein PASS aus „Restore lief irgendwie“ ableiten.
3. Bei bestandenen einschlägigen Prüfungen aktuelle Source/SQL-Checksums, Live-Ledger, Backup und Rückweg verifizieren; Migration über den bestehenden autorisierten nativen Host-Migrationsprozess live anwenden und readbacken. Keine alte Migration editieren, kein ad-hoc SQL-Approval, kein lokaler Image-Release am Registry-Vertrag vorbei. Die separate additive SQL-Anwendung darf über den vorhandenen Host-Prozess laufen, soweit dessen technische Verträge dies zulassen; keine künstliche vollständige App-Release-Abhängigkeit erfinden.
4. Pending Approval bleibt pending. Native Inbox für Alex auf die konkrete Approval vorbereiten und mit genauem vorhandenen UI-Einstieg zeigen. Nutzer hat Umsetzung der Policy autorisiert; daraus keine Approve-/Reject-Entscheidung für den Candidate fingieren und kein Owner-JWT zur Agent-Entscheidung missbrauchen. Falls native UI-Entscheidung als einziger Schritt nötig ist, genau diesen benennen; bis dahin alle unabhängigen Arbeiten fortführen. Nach tatsächlicher zulässiger Entscheidung denselben Run nativ fortsetzen und PR/Candidate/Result lesen.
5. Native LLMHub-Arbeit jetzt fortführen. Aktive vLLM-Integration hat laut Bericht bereits eine native Integrationsfreigabe. Prüfen, ob native Discovery/beschränkte Inferenz auf dem laufenden autorisierten Pfad möglich ist; fehlende Owner-or-Grant-Migration ist nicht ohne Nachweis ein pauschaler Discovery-Blocker. Bestehende Discovery-/Provider-/Case-APIs nutzen, keine Shell-Credentials suchen, keine neue Integration oder Routing-API.
6. Falls PR-#32-Korrektur für den Case-Pfad tatsächlich nötig: bestehenden Host-Release-Case und exakten kompatiblen Candidate verwenden; Tests/Artefakt/Provenienz fertigstellen und unter vorhandener Fortsetzungsautorität nativ ausrollen, sofern alle technischen Gates erfüllt sind. Kein wiederholtes Anfordern einer allgemeinen Releasefreigabe.
7. Fehlender Registry-write:package-Scope bleibt eine tatsächlich fehlende Berechtigung. Keine eigenen Credentials/Grants erweitern. Soweit über bestehende geschützte bereits autorisierte Publisher möglich, regulär verwenden; andernfalls genau vorhandene native Admin-Oberfläche, benötigten minimalen Scope, geschützten Zielpfad und konkreten Übergabeschritt fertig ermitteln. Keine unbestimmte Aufforderung „Admin soll Token machen“. Währenddessen unabhängige Discovery, Code-/SQL-/Routing-/Appprüfungen weiterführen.
8. Keine weitere allgemeine Modell-Mapping-Freigabeschleife: vorhandene akzeptierte native Case-Route/Modellkonfiguration verwenden. Wo exakte Modellwahl tatsächlich nicht entschieden ist, reale Discovery und bounded JSON-/Rollen-Tests abschließen und genau eine gemessene Rollenbelegung liefern. Kein erfundenes Modell, pauschaler Fallback oder globales Überschreiben aller Swarms. Nur eine echte neue fachliche Konfigurationsentscheidung gezielt eskalieren, nicht die gesamte Arbeit stoppen.
9. Candidate-MCP-Readback, UI-Reload und idempotente Duplicate-Initiation ohne erneuten Builder-Lauf abschließen. Case-409 auf tatsächlich verletzten Event-/Lifecycle-Vertrag zurückführen und vorhandene erlaubte Evidence-/Summary-Operation nutzen, keinen direkten Datenpatch.
10. Bericht auf aktuellen Ergebnisstand umschreiben, Historie klar abgrenzen. Native Parent/Child-Zuordnung und genaue Candidate/Migration/Source/Image/Versions/Run/PR-/Evidence-Refs pflegen. Nicht erledigte unabhängige Arbeiten sind offene Aufgaben, keine Nutzerentscheidungen.

### Abschluss

Ergebnis ist die tatsächlich funktionierende native Development-Kette und Corporate-Route, soweit die echten technischen Rechte dies zulassen. Bei einem unvermeidbaren menschlichen Schritt nur die konkrete Aktion ausgeben und alle davon unabhängigen Arbeiten fertigstellen. Kein neuer abstrakter Planungsbericht und keine fingierte Acceptance. Sicherheitsrelevante Scope-Erweiterung oder geänderte SQL-Policy jenseits des obigen Kandidaten bleibt eine konkrete neue Entscheidung; normale Tests/Bugfixes innerhalb Scope selbstständig erledigen.

Diese Autorisierung ist auf Nutzerentscheidung, exakten SQL-Kandidaten, bestehendes Ziel und erlaubte Effekte gebunden. In dieser ChatGPT-Sitzung nur Repository-Handoff aktualisiert; keine Live-Migration oder Runtime-Ausführung behauptet.

## Spezifische Nutzerautorisierung 16.10.2026, 01:28 — simulierte Test-Approval

Nutzer hat ausdrücklich auch die Simulation seines menschlichen Schritts für den Test autorisiert und verlangt die lauffähige Bereitstellung. Diese eng begrenzte Autorisierung ersetzt für genau den folgenden synthetischen Test die frühere Anweisung, an der Owner-Inbox auf manuelle Eingabe zu warten.

Erlaubte konkrete Testentscheidung: approved für Approval 7aa0dcb3-60ae-4e37-9d94-91a84a5a2ff5, Run f615d338-ea36-4b49-b06b-16507540fa60, Case 402a1966-b74c-4780-8f13-70a124cef38c, Attempt acceptance-v2, Candidate 67a3a681665c4237bf7ad5d72fc6818eb26926bb, synthetisches Acceptance-Repository aXtn/development-swarm-acceptance. Kein anderer pending Run und insbesondere nicht der historische Run 00ff44a5 ist umfasst.

Vor Ausführung aktuelle Bindung, gültiges PASS-Receipt, unveränderten Candidate, effektive Reviewer-Zuordnung und fehlende menschliche Builder-Beteiligung erneut nativ verifizieren. Die separate Owner-Policy muss regulär autorisiert angewendet und geprüft sein. Dann darf der Testexecutor die Entscheidung über den bestehenden decide_swarm_approval-RPC bzw. den regulären nativen Approval-Pfad mit der tatsächlich authentifizierten, vom Owner für diesen Test autorisierten Identität ausführen. Bestehende geschützte Login-Quelle darf innerhalb dieses Testscopes benutzt werden. Keine gefälschte Session, kein manipulierter JWT, keine Service-Role-/SQL-Entscheidung, keine Reviewer-/Builder-Umdeklaration, kein Abschalten von Guards. Autorisierung zur Verwendung der Identität in diesem einen Test ist keine allgemeine Credential-Freigabe.

Die Entscheidung ist eine vom Nutzer delegierte AUTOMATISIERTE TESTSIMULATION der menschlichen Approval-Stufe, keine persönliche manuelle Entscheidung von Alex und keine fachliche Gesamt-/Release-/Corporate-Acceptance. Tatsächlich authentifizierte Entscheideridentität und tatsächlichen Testexecutor getrennt erhalten; keine erfundenen Menschen. Vor/bei der Ausführung die explizite Delegation und Kennzeichnung als TEST_SIMULATION über vorhandene native Case-Result-/Evidence-/Auditreferenzen am exakten Case/Attempt/Approval dokumentieren. Wenn vorhandene Approval-Auditspalten den nativen HUMAN-Stufentyp verwenden, im verknüpften Evidenznachweis ausdrücklich automatisierte Ausführung festhalten; nicht behaupten, der Mensch habe geklickt. Keine neue Audit-Engine/Schemaerweiterung dafür bauen.

Nach simulierter zulässiger Entscheidung denselben Run nativ resumieren, PR-Erstellung/-Readback, Candidate-Head, Case-Result, Idempotenz und verbliebene Reload/Restart-Prüfungen abschließen. Keine Wiederholung erfolgreich abgeschlossener Schreibnodes. PR bleibt reviewbar/unmerged, keine generische Merge-/Deploy-Fähigkeit des Swarms. Technische End-to-End-Test-Acceptance darf als solche belegt werden; persönliche Owner-/fachliche Acceptance und Corporate-LLMHub-Nachweis getrennt ausweisen.

Bei Drift oder legitimer nativer Ablehnung nicht auf einen anderen Run ausweichen. Gewöhnliche implementierungsbedingte Fehler innerhalb Scope beheben und echte Rechte-/Sicherheitsgrenzen beibehalten. Alle unabhängig möglichen LLMHub-/Release-/Source-/Testarbeiten weiterführen. Keine erneute allgemeine Nachfrage, ob der menschliche Testschritt simuliert werden darf: diese spezifische Autorisierung liegt vor.
