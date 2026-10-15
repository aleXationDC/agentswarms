# AXTN-DEVSWARM-SLICE1-ACCEPTANCE-20261015

Status: AUTHORIZED_CONTINUATION / EXECUTION_PENDING.
Datum: 15.10.2026.
Autorisierung: Nutzer „Umsetzen bitte“ nach Repository-Prüfung und vorgeschlagener Fortsetzung des bestehenden Slice. Dieser Auftrag konkretisiert die vorhandene Arbeit; Merge, Release und Cutover benötigen weiterhin eine einschlägige revisionsgebundene Freigabe. Keine Ausführung durch das Erstellen dieser Datei behauptet.

## Ziel und Abgrenzung

Den bestehenden nativen Development-Acceptance-Slice in Betrieb nehmen und mit seinem unterstützten Implementierungsauftrag abnehmen:
Task → Builder → Security/Contract/Maintainability und deterministisches Verify parallel → Join/Hard Gate → native Approval → reviewbarer PR → Result.
Dies ist ein begrenzter Python-Fixture-Slice, keine allgemeine Development-Fähigkeit.

Der Read-only-Pilot AXTN-DEVSWARM-READONLY-PILOT-20261015 bleibt zurückgezogen. Auch der Read-only-Testprompt aus CASE-LLMHUB-LIVE-0001/LIVE-UNBLOCK-0002 wird für diesen Slice durch den unten definierten Implementierungstest ersetzt. Die bestätigten Case-/IAM-/LLMHub-Ziele jener Folgeaufträge bleiben bestehen. Keine neue Audit-Variante, kein Ersatz-Swarm, keine zusätzliche Konsensphase und keine spekulative Modellzuordnung.

## Rollen und Native-first-Grenze

ChatGPT bereitet als Solution Architect und Implementation Engineer den konkreten Auftrag vor; der CLI-Agent setzt Funktionen um und behebt gewöhnliche Defekte innerhalb der akzeptierten nativen Verträge. Der CLI-Agent entwirft keine neue Architektur. Für beide Rollen sind Custom-Ansätze und Codeabkürzungen ohne vorherige ausdrückliche Freigabe genau dieses Ansatzes ausgeschlossen. Eine Implementierungsfreigabe oder festgestellte native Lücke ist keine Custom-Freigabe.

## Verbindliche Quellen und Revisionen

Projektsteuerung: aXtn/aXtn-architecture bei 4d2bb39f97d6d0e5dd484791e3731433f6610ef5:
- PROJECT.yaml, .gpt-project/runtime/PROJECT-CONTRACT.md;
- knowledge/work-orders.md;
- knowledge/decisions/AXTN-ENV-OWNER-AUTHORITY-0001.md.

Komponente: aXtn/aXtn-agentswarms bei ed66570a9e1139f1e2e9cb145a2f3a5117265a3e (geprüfter PR #32 Head):
- AGENTS.md;
- docs/architecture/axtn-development-swarm/HANDOFF.md;
- handoffs/requests/AXTN-DEVELOPMENT-SWARM-NATIVE-0002.md vollständig;
- handoffs/reports/AXTN-DEVELOPMENT-SWARM-NATIVE-0002.md;
- axtn/swarms/axtn-development/README.md, seed-agents.mts und apply.mts;
- src/lib/axtnDevelopmentSwarm.ts;
- aktuelle native Case-, Credential-, Verify- und Approval-Verträge samt taskrelevanten Tests.

Folgeauftrag: aXtn/aXtn-agentswarms bei ebd9bdf1df5eaccfe71febece1bdc22600fd6e49:
- handoffs/AXTN-DEVSWARM-LIVE-UNBLOCK-0002.md;
- handoffs/AXTN-DEVSWARM-CASE-LLMHUB-LIVE-0001.md und dessen Bericht.
Deren Read-only-Test und überholte generische Review-/Environment-Blocker sind keine Fortsetzungsgrundlage.

Host: aXtn/aXtn-host PR #15, geprüfter Head 0cfaa3391e5c24af29fcab858d5550441ed7a0bd:
- handoffs/reports/AXTN-GREENFIELD-FINAL-RELEASE-0002.md (Datei zuletzt 60a4636d01f8bbdcfd043e177bcde3cb7a393bf6);
- gültiger Release-Auftrag, Host-Ausführungsvertrag und IMAGE-PROVENANCE.
Vor Ausführung aktuelle Heads, Nachfolger und effektive Freigaben auflösen; kompatible Änderungen erhalten. Ein älterer Report/PR-Text überschreibt keine neuere verifizierte Evidence.

Acceptance-Repository: aXtn/development-swarm-acceptance, Basis 0a38f20ccea94d937a5d4fa2ad18b37ae6439c09.
Git-Tree zurückgelesen: enthält nur README.md. src/normalize_score.py existiert an dieser Basis noch nicht und soll durch den Builder entstehen; das ist kein fehlender Bootstrap.

## Belegter Ausgangspunkt, keine neue Runtime-Prüfung

- Bericht 04.10.: 31-Node-Slice deployed, echte Canvas/Headless-FAILs und PASS bis Approval; vollständige Acceptance nicht erreicht.
- Bericht 15.10.: derselbe Swarm ad06e17d-460b-4b65-946a-9b5d78c6fd02 mit 31 Nodes, is_deployed=false, published_version_id=null und null swarm_versions.
- Leere enabledTools der vier Agents entsprechen dem geprüften Fixture-Source. Builder liefert vollständigen Dateiinhalt, Breaker erhalten Candidate/Hash; separate native MCP-/Case-/Verify-Nodes führen Effekte aus. Keine Agent-Tools nur zur Beseitigung eines vermeintlichen Defekts hinzufügen.
- seed-agents.mts und apply.mts unterstützen gespeicherte Agent-Snapshots und versionierte native Publication bereits. Zuerst diese Mechanismen prüfen; kein neuer Publisher.
- Hostbericht: Restore/Migrationsreplay/Case-SQL erfolgreich; die früher berichtete Restore-Lücke ist geschlossen. Candidate ed66570a wurde gebaut, nicht deployed. Registry-Publikation durch fehlendes write:package blockiert.
- Letzter berichteter Runtime-Pin eb191e152de0132b0107329d7bf444b10150fccb ist kein heute selbst verifizierter Live-Stand.

## Ausführung und erlaubte Effekte

Executor: vorhandener Copilot CLI auf dem autorisierten aleXation-Host; Arbeitsumgebung ist die einzelne native PROD-benannte Greenfield-Plattform. Kein zusätzliches DEV-System verlangen.
Saubere eigene Worktrees; genau ein Writer je Worktree, Runtime-Mutationen seriell.
Vorgeschlagene Taskbranches:
- App: work/AXTN-DEVSWARM-SLICE1-ACCEPTANCE-20261015;
- Host nur bei erforderlichen Hoständerungen: work/AXTN-HOST-DEVSWARM-SLICE1-20261015.
Branches von frisch verifizierter kompatibler Linie ableiten; Dokumentationsbranch ist keine Deployment-Basis.

Erlaubt sind die notwendigen Repository-/Testarbeiten, minimale bestehende native Seed-/Publication-Konfiguration, Case-Tracking und synthetische Implementierungstests innerhalb der bestätigten Berechtigungen. Vor Runtime-Effekten passende bestehende Environment-Freigabe auf exakten Source-/Image-/SQL-Stand prüfen. Keine neue pauschale Deployment-Freigabeschleife; fehlt tatsächlich eine Revisionsbindung, den fertigen Kandidaten mit einer konkreten Entscheidung vorlegen.
Keine automatische Erweiterung von Secrets, IAM, Reviewerberechtigungen, Provider-/Modellmapping oder Host-Release-Regeln. Keine direkten geschützten Writes, Merges, Tags, Releases oder Cutover aus diesem Auftrag ableiten. Der Swarm selbst erhält ausschließlich Fixture-Taskbranch-/Datei-/PR-Effekte, niemals Merge/Deployment/PROD-Zugriff.

## Geordnete Fortsetzung

1. Native Case-Lineage vor materialer Arbeit sicherstellen. Bestehenden Development-Parent 85a1d829-39ac-49bd-9047-163ab52d427b und Acceptance-Child 11496f0f-360d-4069-b88e-05d34584ab65 verifizieren und für dasselbe Ziel fortführen. Implementation-Child 41039014-4a5e-4e8d-873a-2869cebea5f9 nur bei tatsächlicher Restarbeit wieder öffnen. Routing-/Release-Parent 3fd852b0-8a1c-4a07-8ac8-a8c3c8529063 und Release-Child 003e81ab-8d95-402e-bef8-0334b59fe50f sind andere bestehende Verantwortlichkeiten: referenzieren, nicht als Test-Case missbrauchen. Fehlgeschlagene frühere Pilot-Transitions nicht als erfolgreiche Case-Ereignisse übernehmen.
2. Frische Bestandsaufnahme: App Source/Image/SQL-Ledger, Seed-Source, vier gespeicherte Agent-Versionen, Snapshot-Hashes, Draft/Published-Graph, Swarm-Versionen, Historie und verbleibende Run-/Approval-Snapshots abgleichen. Ursache für frühere Publication versus heute fehlende immutable Version belegen; published_at allein genügt nicht. Pending Run 00ff44a5-760c-45dc-a605-7762ba72761a und Approval afe3d09b-f27b-41ce-a00a-60c82c06e8e3 unverändert erhalten. Keine Migration/Seed darf alte Runs an eine neue Version umhängen.
3. Auf aktuellem kompatiblem Source die vorhandenen Seed-/Publish-Verträge und Tests prüfen. Unbekannte Draft-/Agent-Drift nicht überschreiben. Kleinste belegte native Reparatur durchführen; gewöhnliche Fehler innerhalb Scope beheben. Publikation über vorhandenen versionierten Lifecycle mit Graph-/Version-/Readback-Nachweis; zweiter identischer Apply muss unverändert bleiben.
4. Case-/LLMHub- und Release-Arbeit wiederverwenden. Owner-or-effective-IAM-grant für SYSTEM_INTEGRATION gilt; PERSONAL_CONNECTION bleibt owner-only. Kein redundanter Grant nur wegen Case-Nutzung, kein globaler Gateway-Fallback. Aktuelle Identität, tatsächliche erforderliche Account-Zuordnung und geschützte Credential-Gültigkeit serverseitig prüfen, keine Alias-/Firmenbeziehung erfinden. Firmenroute nur für entsprechend autorisierte Cases. Vorhandene vier Rollen-/Modellbindungen erhalten; ein Providerwechsel benötigt eine belegte kompatible, freigegebene Zuordnung und Snapshot-Publikation. Einen OpenAI-Lauf niemals als Corporate-LLMHub-Nachweis ausweisen.
5. Host-Release-Gate separat fortführen. Registry-Publisher mit write:package durch zuständigen Credential-Administrator geschützt bereitstellen lassen, falls weiterhin fehlend. Keine Secretwerte anfordern/ausgeben, keine eigenen Privilegien erweitern. Vorhandenen exakten Candidate veröffentlichen, RepoDigest prüfen, Backup aktualisieren und native Release-Prozedur nur unter passender bestehender Freigabe ausführen. Lokales Image ersetzt keinen vorgeschriebenen Registry-Nachweis. Unabhängige Source-/Seed-/Testarbeit bis dahin fortführen.
6. Approval gegen akzeptierte Eigentümerentscheidung UND wirksamen Source prüfen. Aktueller Source beschreibt pauschalen Work-Owner-Ausschluss; die akzeptierte Entscheidung erlaubt einem berechtigten Environment-Eigentümer die Annahme eines separaten Builders. Prüfen, ob tatsächliche Builder-Identität und Owner getrennt gebunden werden können. Eine Sperre nicht über SQL, Fake-User, Bot-Review oder umetikettierten Builder umgehen. Falls Code-/Policyänderung notwendig ist, eng begrenzten belegten Kandidaten samt negativen Tests zur ausdrücklichen Entscheidung vorbereiten. Alte Approval-Snapshots nicht rückwirkend lockern.
7. Nach erfüllten technischen Voraussetzungen den folgenden echten Implementierungstest durch den vorhandenen Swarm ausführen. Copilot initiiert/pollt/prüft Infrastruktur und Evidence; Copilot schreibt nicht die Candidate-Datei anstelle des Builders und erzeugt keine Breaker-Ausgaben oder Test-Receipts.

## Genau unterstützter Testauftrag

Native Task-JSON; caseId wird erst aus dem echten gestarteten DEVELOPMENT_CHANGE-Case eingesetzt:

```json
{
  "schema": "axtn.development.task/v1",
  "repository": "aXtn/development-swarm-acceptance",
  "baseSHA": "0a38f20ccea94d937a5d4fa2ad18b37ae6439c09",
  "caseId": "<native gestarteter DEVELOPMENT_CHANGE Case>",
  "taskId": "AXTN-DEVSWARM-SLICE1-ACCEPTANCE-20261015",
  "attemptId": "acceptance-v1",
  "path": "src/normalize_score.py",
  "request": "Implement normalize_score with finite numeric inputs, bool rejection, ordered bounds and clipping to [0,1]."
}
```

Das ist eine Vorlage, kein unmittelbar mit Platzhalter abzusendender Payload. Der Case muss denselben typisierten Task-/Basis-/Profilvertrag tragen; bestehendes Profil python-normalization-v1. Stabilen Test-Case per Assignment-Key sicherstellen; technische Retries verwenden dieselben Idempotency-Identitäten. Neue fachliche Versuche erhalten neue attemptId im selben Work-Vertrag.

Genuine FAIL über einen separat nachvollziehbaren synthetischen Negativversuch bzw. vorhandene native Fixture an derselben Versionslinie nachweisen: echter deterministischer FAIL oder akzeptierter blockierender Finding → kein Approval-/PR-Knoten. Keine erfundene LLM-Ausgabe, kein manipuliertes Receipt und kein fingierter Fehler.
PASS: echter Builder-Candidate, parallele Breaker/Verify, native Receipt, Gate, Approval. Vor Owner-Entscheidung nur PASS_TO_APPROVAL/SUSPENDED melden; PR_READY erst nach tatsächlicher zulässiger Entscheidung und exaktem offenen PR-Readback.

## Abnahme und Ergebnis

- 31-Node-Inventory gegen Source; keine Controller/Dispatcher/zweite Control Plane.
- Vier tatsächlich parallel ausgeführte Review-/Verify-Ergebnisse zum selben Candidate/Hash.
- Canvas/Headless-Gleichheit der Gates; FAIL ohne PR, PASS bis echter Approval und zulässiger PR-Erstellung.
- Immutable Version/Agent-Snapshots; Repeat-Apply unverändert, keine Duplikat-Agents/-Cases/-Writes/-PRs.
- Durable Suspend/Resume nach Reload und tatsächlichem Restart; keine Wiederholung bereits erfolgreicher Write-Nodes.
- Unberechtigte Repo-/Pfad-/Merge-/PROD-Effekte und Builder-Selbstfreigabe bleiben gesperrt.
- Aktuelle tatsächliche Modell-/Provider-/Case-Route und Budget belegt; LLMHub-Acceptance separat von Slice-Source-/Fixture-PASS ausweisen.
- Vorhandene DMS-/n8n-/MFA-/Maintenance-Funktionen, alte Runs, Daten und Mounts erhalten.
- Evaluate/Learn bleiben bis tatsächlicher Slice-1-Acceptance zurückgestellt.
- Gezielte vorhandene Native-Development-/Approval-/Case-/Seed-/Publication-Tests sowie material betroffene Routing-/Migration-/Build-Gates ausführen. Vorbestehende Full-Suite-Fehler explizit dispositionieren, nicht als PASS darstellen.

Versionierter technischer Bericht in aXtn-agentswarms:
handoffs/reports/AXTN-DEVSWARM-SLICE1-ACCEPTANCE-20261015.md.
Host-Evidence verbleibt im Host; kuratierter Projektstatus und Referenzen in aXtn-architecture.
Bericht nennt genaue SHAs, geänderte Dateien, Version/Graph-/Snapshot-Hashes, Source/Image/RepoDigest/SQL, Parent/Children/Runs/Receipt/PR, tatsächlich ausgeführte Tests, vorher/nachher, Rollback und verbleibenden konkreten Owner-Schritt. IMPLEMENTED, TESTED, DEPLOYED, PASS_TO_APPROVAL, PR_READY und ACCEPTED getrennt.
Keine End-to-End-Acceptance aus Source-Tests oder dieser Auftragserstellung ableiten.

## Stand dieser Auftragserstellung

Repository- und Dokumentationsarbeit über Gitea; keine eigene Host-/SupaCase-Verbindung, kein Case/Run angelegt, Copilot nicht gestartet, keine Runtime geändert. Der aktuelle Ausführungskanal dieser Sitzung bietet Repository-Zugriff, keinen autorisierten Remote-Executor. Der Auftrag ist zur Ausführung durch den bestehenden Host-Copilot vorbereitet.

## Technischer Ausführungshandoff

Dieser vollständige Komponenten-Request ist die technische Ausführungsquelle. Herkunft: Architektur-PR #5, b5aba18552c9885e1b8f00b3baac63edbaa37569. Komponenten-Handoff und Issue #7 referenzieren diese Fortsetzung. Nur die Auftragsdokumentation übernehmen; der Handoff-Branch ist keine freigegebene Source-/Deployment-Basis. Aktuelle kompatible Implementierungslinie und Runtime vor Ausführung auflösen. Kein langer Chat-Startprompt erforderlich.
