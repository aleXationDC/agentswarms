# AXTN-DMS-RECOVERY-AND-LEARNING-0001 — Copilot-Ausführungsauftrag

Revision 0.5 · 04.10.2026 · READY_FOR_HOST_PREFLIGHT_AND_EXECUTION
Tracking: aXtn/aXtn-agentswarms#6
Architektur und Auftrag: Architekt; Implementierung, Tests und Betriebsnachweise: Copilot CLI auf dem Server.
Dieser vollständige Auftrag ersetzt die Ausführungsregeln/Startgates der Revisionen 0.3/0.4. Keine Abhängigkeit von der Fertigstellung des Development Swarms. Issue-Text ist Index; dieser Git-Vertrag ist ausführbar, auch ohne Issue-API-Zugriff.

## 1. Ziel und autorisierte Wirkung

Vollständiges natives Dokumentenmanagement wiederherstellen, jeden fachlichen Vorgang in SupaCase führen, manuell und agentisch identisch fortführbar machen und die begrenzte Document-Learning-V1 umsetzen. Keine erneute Gesamtinstallation und kein bloßes Intake-/UI-PASS.

Autorisiert innerhalb dieses Auftrags: read-only Discovery, eigene saubere Worktrees/Task-Branches, erforderliche kompatible Source-/Config-/Teständerungen, neue additive Migrationen, versionierter vollständiger Seed/Reconcile, Task-Commits/Push/PRs, isolierte Fixtures sowie nach Tests gezielte in-place DMS-/App-Konvergenz und Restart/Acceptance. Erforderliche minimale n8n-Workflow-/Contract-Änderungen gehören zum DMS-Executor-Paket, nicht zu einem n8n-Neudesign. Geschützte vorhandene Credentials nur im vorgesehenen Workflow nutzen; keine Scope-Ausweitung oder neue fremde Credentials.

Nicht autorisiert: Merge geschützter/default/fremder Branches, Tag/Release, Voll-Neuinstallation, Greenfield-Cleanup im laufenden System, destruktiver Business-Data-Reset, unrelated Upgrades, breite Network/DNS-Änderung, Copilot-MCP-/Login-/Provider-Konfigurationsumbau, ChatGPT-Plan-/Workspace-Agent-/Group-Collaboration-Implementierung, ECP/Federation/Ticket-Sync, pauschale neue automatische Quellenwrites. Neue produktive Auto-Policies bleiben deaktiviert; bestehende Ablage-/Delete-Rechte bleiben revisionsgebunden und explizit geprüft.

## 2. Handover: Ziel, Zugang, Branches und unveränderliche Quellen

Ziel: bestehende native Produktionsinstallation auf aleXation, Linux-User alex; Hostidentität tatsächlich prüfen, nicht aus cwd oder Marker ableiten.
Remote-Ausführung: vorhandener autorisierter Copilot/CLI direkt auf diesem Host. ChatGPT-MCP dient Repository-Prüfung/Auftragsablage, nicht Shell-Ausführung.
Transport: hostlokales natives Git, smart HTTP über verifizierten Gitea-Loopback-Port (aktuell erwartet 3000), http://127.0.0.1:<port>/aXtn/<repo>.git.
Repository-Identität: konfigurierte dedizierte axtn-codex gemäß HOST-EXECUTION-CONTRACT; geschützte Host-Credential-Facility. Credentialwerte niemals in URL, Chat, Git oder Evidence. Keine öffentliche HTTPS-/SSH-/MCP-Rekonstruktions-/Gitea-Volume-Fallbacks.
Copilots bestehendes funktionierendes lokales MCP unverändert verwenden; nicht mit dem produktinternen AgentSwarms-MCP verwechseln.

Plan-/Handover-Branch: work/AXTN-DMS-LEARNING-PLAN-0001. Nur Dokumentation; NICHT als Source-/Deployment-Basis verwenden oder vollständig in neueren Code mergen.
Implementierung: work/AXTN-DMS-RESTORE-0001 in aXtn-agentswarms, work/AXTN-HOST-DMS-RESTORE-0001 in aXtn-host. Bestehende Brancharbeit zuerst inventarisieren, gezielt integrieren; kein Reset/Force-Push. Falls nicht existent, von frisch belegter kompatibler aktueller Basis anlegen.
n8n bei nötigem Change: eigener work/AXTN-DMS-EXECUTORS-0001 in aXtn-n8n; gepinnte Basis und Worktree vorher dokumentieren.
Checkout/Worktree-Pfad: eigene freie task-spezifische Pfade auf dem Server auflösen und vor jedem Write im Preflight/Case referenzieren. Keine fremden dirty Worktrees verwenden, keine unbewiesenen Pfade erfinden.

Repository-Snapshots dieser Prüfung, keine neue Live-Prüfung:
- Component Development-Head: a67eefa15f36ff29bb6dd681fd56939e14e1a058.
- Host Development-Head: f36942762e649dd2f345a15b87739887ee40ebe8.
- Host-Pin nennt source-validierten Candidate 2801faa732eee3209c6bf212a142a7d5ff592219, DEPLOYMENT_PENDING; deployed App bleibt ff43febf35bee35e5a8346e142628e20bdefa5b9.
- Dokumentierte deployed App image: sha256:4a856a22f273dbdfe8540d461661d60de4d2e942ccee4055158d7c2e6bba4ac1.
- Eigenständige Developer-Runtime-/MCP-Pins im Host-Manifest sind separat; nicht durch AppSHA ersetzen.
- aXtn-agentswarms main d87a155626d6564416b590bc0e0efb7e8f75436e und aXtn-host main cc9569ed9139181affebdd609d379c4fcc54cfc3 sind nicht die dokumentierte aktuelle Runtime-Basis.
- n8n-Pin: 24de6248f13b5fc250482dc8c3b3ef483c91cb55.
- Historischer DMS-Stand: 7123d0ef167e72b39ee39a944e418003a253f50f.

Frisch origin/ls-remote, Head, ancestry, Pin, tatsächliche laufende Image-Revision und Schema-Ledger prüfen. Neuere kompatible getestete Source als Basis übernehmen und Source-/Deployment-Differenz ausdrücklich festhalten. Nicht auf 844eddf…, den alten Recovery-Branch oder main zurückdowngraden. Nicht ungeprüft einen source-validierten Candidate als deployed behandeln.

## 3. Pflichtlektüre und kollisionsfreier Start

Vollständig lesen:
- gültiges AGENTS.md einschließlich nested Anweisungen, aus aktueller kompatibler Component-Basis;
- diesen Auftrag und docs/architecture/axtn-document-management/HANDOFF.md;
- docs/architecture/axtn-development-swarm/SUPACASE-CASE-MODEL.md und SUPACASE-WORK-OPERATIONS.md;
- docs/architecture/axtn-development-swarm/HANDOFF.md, aktuelle Implementierungs-/Source-/Runtime-Berichte;
- Host architecture/PROJECT-CONFIG-ACCESS-PATCH.yaml, HOST-EXECUTION-CONTRACT.yaml, AGENTSWARMS-PIN.yaml, COMPONENT_MANIFEST.yaml, STATUS.yaml, TARGET_HOST_MODEL.yaml, IMAGE-PROVENANCE.yaml, CREDENTIALS_CONTRACT.yaml, NETWORK_MATRIX.yaml und konkrete Runtime-Mutation-/Rollback-Evidence;
- vorhandene DMS-/Registry-/Review-/Privacy-/n8n-Verträge und Tests, historische vollständige DMS-Graphs;
- External References: aXtn-agentswarms#8 / PR#9, handoffs/requests/AXTN-SUPACASE-EXTERNAL-REFERENCES-0001.md am frisch aufgelösten Task-Head.

G0 ersetzt das alte pauschale Warten auf #7:
1. Benutzer schiebt diesen DMS-Auftrag zwischen Development-Arbeit. Development-Arbeit nicht automatisch als abgeschlossen melden.
2. Vor Produkt-Writes gesicherten Writer-Handoff/ruhenden Checkpoint ermitteln; genau ein Writer je Worktree und gemeinsame Runtime-Konvergenz seriell. Nicht laufende Copilot-Arbeit von außen stoppen oder überschreiben.
3. Development-/External-Reference-/Maintenance-Branches und deren Cases unverändert lassen; unabhängige DMS-Case-Linie verwenden. Gemeinsame Case-Module erst im eigenen DMS-Branch nach Writer-Übergabe bearbeiten.
4. Der fertige Development-Graph, sein OpenAI-/ChatGPT-Transport und Notebook-Acceptance sind keine Eintrittsvoraussetzung für CLI-geführtes DMS. Existierenden Case-Consumer und dessen Tests wiederverwenden.
5. Bestehende Case-API muss tatsächlich owner-gebunden erreichbar sein. Zugriffsausfall nach vorhandenem Bootstrap ist ein zu behebender Ausführungsfehler, keine Erlaubnis zu ungetrackter Produktarbeit oder neuer Schattenakte.
6. SupaCase, D09/MFA, Maintenance CLOSED, bestehende native MCP/Runtime-/Provider-Konfiguration und Daten erhalten. AXTN_ENVIRONMENT=DEV bezeichnet Bootstrap-Credential-Profil; AXTN_DEPLOYMENT_ENVIRONMENT=Prod den Deployment-Tier. Keine neue Doppel-DEV/Prod-Komposition.

Frischer read-only Preflight wird als handoffs/reports/AXTN-DMS-PREFLIGHT-0001.md versioniert, mit Basis/Ancestry, Worktrees, aktiven Writer-Grenzen, tatsächlich beobachteten Runtime-/Schema-Pins und PASS/PARTIAL/BLOCKED je Fähigkeit. Routinefehler danach innerhalb Scope beheben und weiterarbeiten, nicht nur einen weiteren Plan liefern.

## 4. Copilot führt diesen Auftrag als Case

Vor Produktcode-/Config-/Schemaarbeit bestehenden serverseitig owner-gebundenen /api/cases/work beziehungsweise vorgesehenen case_work-Zugang verwenden:
- Genau einen idempotenten Parent DEVELOPMENT_CHANGE für aXtn/aXtn-agentswarms#6.
- Stabile Source-ID: implementation:dms-recovery-and-learning-v1:agentswarms-6.
- workContractRef auf diese angenommene unveränderliche Auftragsrevision binden; Actor serverseitig, executionChannel=COPILOT_CLI und tatsächlicher Processing Mode.
- Eigenständige Children: DMS Inventory/Recovery, DMS Case-/Manual-Adapter, Filing-/Privacy-/Executor-Verträge, Learning/Evaluation, unabhängige Integration/Acceptance.
- Typen für Implementierungs-Children aus dem bereits erlaubten DEVELOPMENT_*-Workmodell verwenden. Dokumentenlaufzeit erhält separate fachliche DOCUMENT_*-Typen gemäß Abschnitt 6.
- Status, Abhängigkeiten, Revision, PR/Run/Evidence und Übergaben während Arbeit führen. Children sind keine einzelnen Commands/Nodes.
- Work-CLOSED bedeutet Ergebnis geliefert, nicht unabhängige Acceptance. Parent erst bei allen Pflicht-Children, unabhängigen Gates und verifiziertem Endpunkt DEPLOYED_VERIFIED schließen.
- Keine Wiederverwendung des Development-#7-Parents als eigener Implementierungs-Parent. Kein untracked Weiterarbeiten, keine temporäre Case-Datenbank.
- Bestehende legitime Aufgabe und frühere Evidence idempotent dieser Linie zuordnen, keine schon existierenden Auftrags-Cases duplizieren.

## 5. Vollständige Wiederherstellung und Root Cause

Der bisherige Source-/Provisionierungs-/Acceptance-Scope deckt nur Intake ab. Historisches apply.mjs setzte vorhandene Parent-/Privacy-Rows und zwei aktive Agents voraus; es erzeugte sie nicht. Exakten Regression-Commit durch Git-Historie/Diffs bestimmen; keine unbelegte Löschungszuordnung zu Copilot.

Pflichtinventar mit ID, Typ, Owner/Visibility, nichtgeheimem Contract/Hash, dependencies, autoritativer Revision, historische/current-source/runtime-Lage, Seed-/Reconcile-Pfad und Acceptance:
- Parent Document Management 9b9ea6c2-a554-4fa7-9c40-908dad632ae7.
- Child Document Intake 62bbd9a0-2fb3-4241-828d-584fa76edc74.
- Privacy Preflight 6dcd7938-f9fb-4254-be9e-6f9a06793f0e.
- Blacklisted File Cleanup d0c6b64b-6a54-4db3-93ab-11be9d8d93a5.
- Stage 1 Document Triage 54edaad4-4726-4781-ae07-5df795434837; aktuelle belegte Gemini-Zuordnung erhalten, kein Development-Provider-Fallback hineinmischen.
- Stage 2 Document Processing 02482fe8-1970-447a-97d7-8898ab8abaae.
- Alle referenzierten Skills, KB-Definitionen/Bindings und plattformeigene Seedinhalte, Prompts/Modelle/Temperatur, Guardrails/Tools/Owner.
- Local Table MCP, sql_query und local_table_upsert, axtn_document_registry, Recognition-/Taxonomie-/Identity-Datasets.
- Privacy/Presidio und provider-safe Kontext; NO_AI und UNRESOLVED.
- DMS/Review/Cleanup-Workbenches, SupaCase/Relations, RLS/IAM und echte Owner-Sichtbarkeit.
- n8n_run_workflow, axtnDriveFilingExecutor / axtnDriveDeletionExecutor und weitere tatsächlich erforderliche Mail-/Drive-/Extraktionsverträge.
- Trace/Checkpoint/Eval-Persistenz mit Redaction/Access/Retention; nicht behaupten, Kontext werde nie persistiert.

Historische src/axtn/workbenches/documents/documentRecognition.ts und documentRegistries.functions.ts/server.ts rekonstruieren/adaptieren: vorhandene exact/fuzzy-, contains/not_contains-, AND/OR-Regelbasis bevorzugen, keinen frei lernenden Klassifikator bauen.

Skills/KB-/Runtime-only Promptwerte aus geschützter autoritativer History/Backups/runtime lesen, ohne Rohdaten-/Secret-Export. Namen sind kein Wiederherstellungsbeweis. Wirklich irrecoverable Werte exakt benennen und als fachliche Ersatzentscheidung an Architekten zurückgeben; belegte fehlende technische Implementierung ansonsten selbst beheben.

Vollständiger idempotenter Seed erstellt fehlende Plattformobjekte in Dependency-Reihenfolge und reconciliiert vorhandene im erlaubten Scope. Credentials und operator-owned Dokumentdaten nicht erfinden. Zweiter Seed erzeugt keine Duplikate. Empty-State-Rehearsal isoliert, niemals Produktionsstate löschen. Host-Bootstrap konsumiert exakt getesteten Component-Stand; Intake allein darf kein vollständiges DMS-PASS erzeugen.

## 6. Case-zentrierte DMS-Laufzeit und gemeinsame Erweiterungsgrenze

Jeder fachliche Auftrag hat einen Case, nicht jeder Node, jede Nachricht oder jeder Retry. Dokumentoriginal/Versionen/Rechte bleiben extern; document_id und source_ref bleiben eigenständig.

Intake → deterministische Source-/Delivery-Prüfung → atomarer Work-Ensure → Privacy → Recognition/Triage/Processing → Proposal-/Policy-Gate → Review/Filing → Provider-Readback → Registry-/Case-Projektion und Abschluss → minimiertes Feedback.

Ein DOCUMENT_PROCESSING Work Case je eigenständigem Request entsteht vor semantischer Verarbeitung und Quellenwirkung, auch im Privacy Hold. Minimal neutraler Betreff bis Privacy geklärt. Stabiler Key = serverseitiger Owner-Scope + Source-Kind + fachliche Request-ID; Child-Key = Parent + Work-Package-Key. Delivery-ID dedupliziert Zustellung; Retry/Resume/Attempt/Actorwechsel erhalten denselben Case. Source-Revision ist Input, nicht automatischer Neu-Case-Key. Atomares Ensure und Konfliktprüfung tatsächlich unter Concurrency testen.

Vorhandener Geschäfts-Case nur bei bestätigter autorisierter Zuordnung als Parent; sonst Work Case zunächst Root und Klärung sichtbar. related_document-Zuordnung nicht überschreiben: aktueller assignDocument erlaubt eine primäre Zuordnung. Work-Dokumentreferenz separat im validierten Work-Input/Referenzvertrag führen. Filing-ensureCaseForAcceptance muss vorhandenen Intake-Case wiederverwenden, nicht einen zweiten TODO-Case erzeugen.

Der vorhandene Work-Consumer ist real vorhanden, aber WorkIdentity.caseType erlaubt nur DEVELOPMENT_*, WorkReference hat noch keine document/source-Art und native Verify/Acceptance prüft PR-/SHA-/Developer-Harness-Kontext. Das ist die konkret zu implementierende DMS-Anschlusslücke, keine Begründung, SupaCase neu zu bauen.

Architekturentscheidung für dieses Paket:
- Bestehenden owner-gebundenen Work-Carrier, Audit, Locks, Takeover und KPIs wiederverwenden.
- Eng registrierte DMS-Domainprofile mit separaten Work-/Result-/Evidence-Validatoren im selben nativen Service ergänzen. Dokumenttyp-Allowlist: DOCUMENT_PROCESSING, DOCUMENT_REVIEW, DOCUMENT_FILING, DOCUMENT_CLEANUP, DOCUMENT_IMPROVEMENT_CANDIDATE.
- Nicht bloß DEVELOPMENT_-Regex öffnen oder alle Guards ausschalten. TypeScript, native RPC/SQL, Row-/Dataset-/Audit-Broker-Schutz und UI gemeinsam domain-spezifisch prüfen.
- Development-Verträge und PR-/Harness-Receipt-Checks bleiben unverändert. DMS-Approval bindet Case/Source-/Decision-/Policy-Revision und autoritativen Providerbeleg, nicht eine erfundene Git-SHA des Dokuments.
- Immutable DMS-Input-Manifest hashen; originale Provider-Revision/ETag separat exakt erhalten. CodeSHA, SourceRevision und InputHash niemals gleichsetzen.
- Nur erforderliche typisierte DMS-Referenzen eng ergänzen: Owner-/Quellenrechte prüfen, kein beliebiges URL-Dereferenzieren oder erweitertes Repository-Recht.
- Neue additive Migrationen nach aktuellstem Ledger, bereits angewandte Migrationen nie umschreiben. Kein physisches axtn_cases erfinden; bestehende owner-gebundene logische Datasets nutzen und Metadaten verlustfrei/idempotent reconciliieren.
- Minimale DMS-Adapter liegen in DMS-eigenen Modulen; gemeinsame Core-Module nur nach gesichertem Writer-Handoff im DMS-Branch. Der Development-Auftrag konsumiert später diesen kompatiblen Shared-Contract, keine parallele Kopie.

Neue DMS-Children nur bei separat verantwortbarem Auftrag, Review oder Cleanup. Parent/Children nutzen NEW/OPEN/WAITING_CONTACT/CLOSED; kontrollierte status_reason-/Outcome-Codes für Phasen/Blockaden. WAITING_CONTACT nur mit Contact und Follow-up. Registry/Run sind Projektionen/technische Ausführung, keine zweite Case-Autorität.

## 7. Manueller Ablauf, Governance und Ownership

Case-Detail bietet Inputs/Work Contract/Revision/Abhängigkeiten/Evidence, Übernahme/Zuweisung, Modewechsel, gleiches Resultat, deterministischen Executor, Block/Rework/Abschluss.
LLM-Ausfall UND Swarm-Orchestrator-Ausfall testen: HUMAN arbeitet denselben Case über gemeinsame serverseitige Validator-/Gate-/Executor-Funktionen weiter, solange SupaCase und erforderliche Dienste verfügbar sind. Kein separater Scheduler, keine neue Inbox, keine Freitext-PASS-Abkürzung.

Authenticated HUMAN-Takeover fencet alte Attempts; Maschine darf während Übernahme weder Resultat noch Approval/Wirkung ändern. Authenticated Release gibt denselben Case zurück. Actor/Mode/Channel getrennt; Maschine darf keinen Menschen imitieren. Priority0 bleibt human-only. Fehlende deterministische Dienste/Belege = OPEN/BLOCKED, nicht manuell erzwungenes PASS.

Dauerhaftes Human Approval auf oberstem DMS-Run; Privacy-Child deterministisch ohne Approval; Delete-Freigabe separat im Parent und revisionsgebunden an Cleanup. Gemeinsame Approval-Autorität muss über UI auch ohne laufenden Orchestrator verwendbar sein. Bestehende native Approval-/IAM-Semantik erhalten; Domainadapter ergänzen, falls nötig. Veraltete Revision, Rechteverlust oder Widerruf invalidiert Freigabe.

Case Owner/Kollaborationsbereich, ausführender Actor und Provider-Credential sind verschiedene Grenzen. Aktuelle autorisierte Scope-/Group/IAM-Lage prüfen. Keine zufällige Gruppenmitglied-Auswahl, kein Human-Pseudo-Bot, keine geborgte CLI-Token-Datei. Keine noch nicht implementierte Group-/Workspace-Agent-Capability voraussetzen; fehlender echter unattended Principal blockiert nur diesen Pfad, nicht deterministische/manuelle Arbeit.

Belegter bestehender DMS-Provider-/Model-Scope bleibt erhalten. Keine OpenAI-Billing-/ChatGPT-Plan-Reparatur und kein stiller Providerwechsel in diesem Auftrag.

## 8. External References / paralleler Auftrag #8

Angenommener separater Vertrag: zwei optionale opake Felder external_ref_id und external_parent_ref_id am vorhandenen Case. Quelle, lokaler Parent und externe IDs sind unabhängig. Case Work-Ensure-Key nicht aus externer Ref bauen.

DMS erhält bestätigten Handover-Kontext unverändert; keine semantische Identifier-Extraktion vor erlaubter Privacy, keine automatische Child-Erbschaft, keine Parent-Neuanlage aus external_parent_ref_id. Account + external_ref_id im autorisierten Scope exakt korrelieren; Mehrdeutigkeit/Widerspruch zur Klärung, kein Fuzzy-Match oder globaler Unique-Key. Ref ist keine Authority/URL.

#8/PR#9 liefert diese gemeinsamen Felder/Correlation. In dieser Prüfung ist nur der akzeptierte Auftrag belegt, keine Produktimplementierung. Frisch prüfen: falls getestet vorhanden, kompatibel übernehmen. Falls noch ausstehend, DMS-Inputs schema-validiert als untrusted Referenz-Kontext vorsehen und Anschlussfixtures liefern, aber keinen konkurrierenden gemeinsamen Correlation-/CRUD-Core unter #6 bauen. Kern-DMS für Eingänge ohne externe Referenzen bleibt unabhängig ausführbar. Unbestätigte externe Zuordnung bleibt NEEDS_CLARIFICATION, keine Scheinfunktion. Integration mit #8 genau im Bericht benennen; keine Produktdeployment-Autorisierung von #8 übernehmen.

## 9. Deterministischer Executor und Transport

Vor jeder Wirkung Principal, aktuelle Source-/Zielrechte, SourceRevision, Case-/Decision-/Policy-Revision, Approval und Ziel prüfen. Persistenter Effect-Key und atomare Claim/Fencing schützen Doppelwirkung.
Verlorene Write-Antwort = UNKNOWN mit Provider-Readback/Reconciliation, nicht blind Retry. Readback prüft Dokumentidentität/Revision, Ziel/Name und erlaubte Operation; filed=true reicht nicht.
Provider-PASS mit Registry-/Case-Projektionsausfall = EVIDENCE_PENDING, nur Projektion erneut; niemals Originalwirkung wiederholen. Reopen/Rollback bleibt gleiche Case-Linie.
n8n-Maintenance-Read-Key bleibt workflow:list/read. Getrennte bestehende Execution-Bindings mit begrenztem Workflow-/Operation-Scope verwenden; fehlende Providercredentials ausdrücklich BLOCKED.

n8n-Pin enthält Drive Intake, Drive Filing, Mail Materialization/Filing/Ingress; Exportdokumentation benennt inaktive Fail-closed-Platzhalter und ACK-Gap: AgentSwarms output-nested versus gefordertes top-level accepted/document_id/processing_status/next_location. Diesen Contract-Endpunkt kompatibel korrigieren und testen; keine Aktivierung ungeprüfter Flows.
Drive OAuth, verwaltete Folder, Naming Data Table und Ingress-Auth müssen echte nichtdestruktive Live-Read-Prüfung bestehen. Fehlender DriveDeletionExecutor ist belegte Provisionierungs-/Workflow-Lücke, nicht aus Namen als vorhanden behaupten; minimalen dokumentierten historischen Delete-Vertrag wiederherstellen, menschliche Delete-Freigabe zwingend. Keine fremden Mailversand-/Quellenwirkungen als Test.

## 10. Document Learning V1 — echte Funktionen, begrenzte Autonomie

Feedback → Finding → Root-Cause-Hypothese → begrenzter Rule-Candidate → unabhängiger Fach-/Security-/Contract-Review → Baseline/Candidate-Evaluation → revisionsgebundener Repo-/PR-Handoff.
Learner verändert keine Runtime/Policy/Prompts/Graphs selbst. Development Swarm nicht voraussetzen; vorhandenen Git-/Review-Prozess nutzen.

Sechs versionierte Contracts in bestehender nativer Persistenz:
- DocumentDecision: caseId/workContractRevision, DecisionID, document/sourceRef+Revision, Graph/Rule/FeatureSchemaRevision, Familie, Zuordnung, Ziel, Evidence, PrincipalScope, Status.
- FeedbackEvent: Case/Decision/SourceRevision, EventID, bestätigte vorher/nachher-Zuordnung, CORRECTION/EXCEPTION/TAXONOMY_CHANGE/VERIFIED_CORRECT/UNVERIFIED, Grund/Authority.
- LearningCandidate: ImprovementChildCaseID, Base, Feedbackrefs, Hypothese, begrenztes ChangeManifest, Familien/Risiken/Testprofil.
- EvaluationEvidence: CaseID, Baseline/CandidateSHA, Dataset/Split/EvaluatorRevision, harte Gates, Familienmetriken/Fallzahlen/Unsicherheit, Artefaktrefs/Verdict.
- AutomationPolicy: immutable Revision, autorisierender PromotionCase/Evidence, Familien/Quellen/Ziel/OperationScope, QualityProfile, ReviewTrigger, Gültigkeit/Authority/enabled.
- FilingReceipt: Case/Attempt/Run, EffectKey, Decision/Source/PolicyRevision, erwartetes/rückgelesenes Ziel/Name, Provideroperation, Registry/CaseProjectionStatus.

Feedback/Evaluation/Effektbelege append-only; Corrections referenzieren Vorgänger. Policy-Aktivierungszeiger kontrolliert, Revision immutable. Owner/RLS und referenzielle Checks; keine zweite Datendienst-/Dokumentenpersistenz.
Schweigen/erfolgreiches Filing ist keine fachliche Bestätigung. Feedback deduplizieren und gegen exakt bestätigte Revision validieren. Improvement Candidate als Child NEW, Anlage startet nichts.
Minimierte Merkmale/Referenzen, keine Originale/Volltexte/Secrets in Cases/Git/Candidates/Standard-Evals. NO_AI auch für Learner/Judge; UNRESOLVED stoppt semantisch.

Implementieren: funktionsfähiger Feedbackpfad, Candidate-Erzeugung, side-effect-freie Evaluation und Review-/PR-Handoff. Synthetisch SCOPED_AUTO beweisen. Real zunächst OBSERVE/SHADOW/ASSISTED; neue Auto-Policies disabled.
QualityProfile vor Promotion fachlich festlegen, keine erfundene Confidence-Schwelle. Harte Privacy/Rechte/schwere Fehlablage-Gates überstimmen jeden LLM-Score; unabhängige, leakage-freie Splits (Vorlage/Vorgang nicht auf beide Seiten). Familienmetriken: Präzision, schwere Fehlablage, Korrektur/Ausnahme, Human Interactions/Dokument, Abdeckung, Zeit/Kosten. Stichproben/Drift deaktivieren betroffenen Scope ohne automatisches Re-Filing. Fehlendes QualityProfile blockiert Promotion, nicht Restore/deaktivierte Lernfunktion.

## 11. Verbindliche Ausführungspakete

G0 fresh Host/Source/Writer-/Case-Preflight → D1 vollständiges Inventar/Regression → D2 native Seed/Restore → D3 DMS-Domainadapter/Case-ab-Intake/manueller Pfad → D4 Privacy/Filing/n8n-Contract → L1 Feedback/Rules/Candidates → L2 Evaluation/Review-Handoff → I1 unabhängiger getesteter Component-/Host-/ggf.n8n-Kandidat → I2 gezielte Live-Konvergenz/Restart/Empty-State-Evidence.

Restore-Code und Lerncode im selben Vorhaben; DMS-Recovery muss eigenes PASS erreichen, bevor neue Lernfähigkeit aktiviert wird. Fehlende konkrete Skills/KBs blockieren betroffene Capability, nicht unverbundene Arbeit.
Vor Live-Mutation exakte letzte Source/Image/Config/Schema-Revision und geprüften Rollback dokumentieren. Migrationschecksum prüfen, nur additive Kandidaten anwenden. Pin-Sources konsistent aktualisieren, separat vorhandene Runtime/MCP-Bindings erhalten. Nur betroffene App/DMS-Dienste neu erzeugen; Daten, Gitea/n8n/Matrix, Caddy/Tailscale/Website erhalten. D09 CLOSED hinterlassen. Keine globale Prune-/Volume-/Greenfield-Cleanup-Operation.

## 12. Acceptance — vollständige Pflichtmatrix

Ursprüngliche 17 Restore-Gates:
R1 alle Objects/stabile IDs; R2 published Parent/Children/intended Agents; R3 recovered Prompts/Model/Skill/KB/Guardrails; R4 Skill-Auflösung; R5 KB-Retrieval plattformeigener Seed; R6 LocalTable/Registry; R7 Privacy/NO_AI; R8 Stage1/2; R9 Approval Suspend/Resume; R10 Registry-Projektion; R11 READY_FOR_FILING; R12 sichere Filing-Fixture/Readback; R13 SupaCase/Relation-Regressionsfreiheit; R14 Restart/Persistenz; R15 vollständiger Empty-State-Test; R16 kein Secret; R17 getesteter Kandidat vor in-place Konvergenz.

24 Learning/Executor-Störungen:
L1 bekannte Familie/eindeutiges Ziel; L2 neue Familie trotz hoher Confidence; L3 Mehrdeutigkeit; L4 NO_AI/UNRESOLVED; L5 Human Override; L6 Exception/Taxonomie; L7 Duplicate/unverified Feedback; L8 Source/ProposalDrift; L9 Policywiderruf bei Suspend; L10 Ziel/Rechteverlust; L11 verlorene Write-Antwort; L12 DoubleResume/Retry/concurrent Decision; L13 filed=true/falsches Ziel; L14 ProviderPASS/Registry-Ausfall; L15 Kollision/Duplikat; L16 Familienregression; L17 HardFail trotz gutem LLMScore; L18 PromptInjection; L19 LeakageMarker in Trace/Checkpoint/Eval/Git; L20 Model/Prompt/RuleDrift; L21 Restart bei Review/UNKNOWN; L22 EmptyState/zweiter Seed; L23 LearnerScopeAusweitung; L24 QualityDrift.

13 Case-Gates:
C1 IntakeCase vor Semantik/Wirkung inkl PrivacyHold; C2 ConcurrencyEnsure/LostResponse/Resume genau einmal; C3 primäre Dokument-/BusinessCase-Zuordnung erhalten; C4 Human am selben Case bei LLM-/Orchestrator-Ausfall; C5 stale Agentresult nach Takeover abgewehrt; C6 gleiche UI/headless Validator/Approval/Rechte; C7 UNKNOWN/fehlende Evidence kein Abschluss; C8 Restart/Resume erhält Hierarchie/Actor/Mode/Revision; C9 fremder Owner/Case/Relation und Priority0-Overwrite abgewiesen; C10 Candidateanlage ohne Promotion; C11 CopilotParent/Children und unabhängige Acceptance; C12 persistente TestCases und kanalgleiche KPIs; C13 CaseProjektionsausfall nach ProviderPASS ohne zweite Wirkung.

Zusätzlich S1 Development-DEVELOPMENT_*-Work/SQL/IAM/Approval/Verify bleibt unverändert sicher; S2 DMS-native Domainreceipt kann nicht als DevelopmentPASS verwendet werden oder umgekehrt; S3 vorhandene Humans/Machines können die Guards nicht über Dataset/LocalTable/Audit-Write umgehen; S4 ExternalReferences fehlen/mehrdeutig = kontrollierte Klärung, ohne KernDMS-Ausfall; S5 ACK top-level und bisherige Consumer kompatibel; S6 MaintenanceRead-Key nicht zum ExecutionKey erweitert; S7 GeminiStage1 erhalten, keine Development-Provider-/Plan-/Group-Umbauten.

Ausführen und versionieren, nicht lediglich Source-String-Scans:
npm run check am tatsächlichen ComponentCandidate (Typecheck/Lint/Docs/Infra/fullUnit/build); relevante Integrationstests und tatsächliche isolierte PostgreSQL-Concurrency-/Role-/Policy-Tests; n8n-Vertragstests bei Changes; HostSyntax/Tests/Compose/ExactPin; echte erlaubte Runtime-/UI/Restart-/Canary-Nachweise. Historische Testzahlen nicht als aktuelle Tests ausgeben. Vollständige Acceptance-Cases retained und regulär schließen, keine automatische Löschung.

Keine IndependentAcceptance durch Builder selbst. Echte native Approval/Evidence gegen exact Candidate; synthetischer Policy-Replay ist kein menschliches Approval. Fehlende unabhängige Entscheidung = ACCEPTANCE_PENDING mit vollständigem bereits geliefertem Stand, nicht erfundenes PASS.

## 13. Ergebnis und echte Stopbedingungen

Versionierter Abschluss: handoffs/reports/AXTN-DMS-RECOVERY-AND-LEARNING-0001.md.
Enthält Parent/Children, tatsächliche Bases/Branches/Commits/PRs, exact RootCause/Regression, vollständiges DependencyManifest mit recovered/proposed/implemented/tested/deployed/runtime_verified, executed Tests, Schema/Image/Pin, OwnerVisibility, manueller Ablauf, Restart/EmptyState, Security/Privacy, Learn-Gates/disabled Policies, #7/#8-Kompatibilität, Operator-/irrecoverable Gaps, Rollback und restliche echte Acceptance.
Issue#6 nur Index/Status; Git-Handoff aktuell halten. Keine behauptete CLI-Ausführung aus einem ChatGPT-Planungswrite.

Stop nur für konkrete unauflösbare Target-/SourceIdentity, aktiven konfliktierenden Writer, unvermeidbare Secret-/Datenverlustgefahr, fehlende geschützte Berechtigung/externes OperatorBinding, wirklich irrecoverable Fachentscheidung oder material zusätzlichen Architektur-/Security-Scope. Gewöhnliche fehlende Source, Migration, Seed, Tests, Docs, ACK-/Runtime-/DMS-Adapter sind autorisierte Implementierung; diagnostizieren, reparieren und weiterarbeiten.
Kein Warten auf fertigen Development Swarm oder dessen ChatGPT-Transport. Kein Merge/Tag/Release und keine pauschale reale AutoFiling-Aktivierung.
