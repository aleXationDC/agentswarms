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
