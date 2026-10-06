# Sherlock / SupaCase V6 — Einzeldefinitionen P01–P38

Stand: 2026-10-06. Ergänzung zu AXTN-ENVIRONMENT-PATTERN-PILOT-0001, Issue12/PR13 und Implementierungs-PR14.
Quelle: vom Nutzer am 05.10.2026 bereitgestellter Sherlock / SupaCase Architecture & Implementation Handoff V6, Abschnitt4. Der Nutzer bestätigte den funktionalen Environment-Pilot und die Präzisierungen in der nachfolgenden Diskussion. Diese Datei überführt die vorhandenen Einzeldefinitionen in Gitea; sie erfindet keine unbekannten Patterns und keinen neuen Implementierungsumfang.

Status: AUTORITATIVE_PILOT_DEFINITION_SUPPLEMENT. Kein Runtime-PASS, keine unabhängige Acceptance und keine Enterprise-Acceptance.
Gültige Präzisierungen aus dem akzeptierten Auftrag bleiben erhalten: drei external_*_ref/Environment-Felder, opaque Fremdobjekte, Lifecycle/Mode getrennt, vorhandene native Orchestration, kleine ergänzende Contracts. Origin ist Provenance, nicht Credential Authority.

## Anwendung und Fortsetzung

Der Bericht c6ca7e5b0481d0bcddab94f8bc1ed5880ba151eb kennzeichnet die Einzeldefinitionen als fehlend. Mit dieser Datei ist diese Dokumentationsvoraussetzung aufgelöst. Ein neuer Product/Runtime-Lauf oder Parent ist dafür nicht erforderlich.

Executor: nur diese Definitionsdatei aus dem Dokumentationsbranch importieren; nicht den alten Branchcode als aktuelle Basis übernehmen. Die vorhandene P01–P38-Matrix je ID mit Meaning, native Contract/Pfad/Revision, tatsächlich ausgeführter Evidence, Evidenzgrenze und verbleibendem Gap vervollständigen. Historische Fehlbefunde im Report erhalten, aktuellen Status berichtigen. Kein38-faches PASS aus gruppierter Evidence.

Definition, funktionaler Pilotnachweis, reale Quellen/Partner, unabhängige Acceptance und Enterprise-Reife getrennt ausweisen. Fehlende freigegebene Originalquellen/Reviewer nicht erfinden, keine Zugriffsausweitung. Bestehende Cases/PRs/App-Pin erhalten. Kein selbst erteiltes Approval, kein Merge/Deploy für eine reine Dokumentationsergänzung.

Die folgenden Pilotprüfungen entsprechen den Checks aus V6 beziehungsweise den bereits akzeptierten E1–E9. Vorhandene Evidence wiederverwenden; keine neue Enterprise-Foundation als Abschlussbedingung hinzufügen.

## P01 — Secure Object Intake Pattern
Definition: Externe Objekte/Events werden vor semantischer Verarbeitung deterministisch auf Envelope, Identity, Privacy und Provenance geprüft und persistent registriert; je Risiko optional Approval.
Pilotprüfung: generischer sicherer Intake-Vertrag mit Source-/Request-/Delivery-Identität und positiven/negativen Admission-Fällen. Document-Intake-Evidence nur für ihren belegten Umfang übernehmen.

## P02 — Identity Separation Pattern
Definition: External/source identity, interne immutable identity, persistenter Business State, Execution State und physischer Zustand bleiben getrennt.
Pilotprüfung: lokale Case-ID nicht aus Source Locator ableiten; Ref/Environment, Dokument/Source, Run/Attempt und Provider-Effekt jeweils passend binden. Shipment-Beispiel ist kein Pflichtbau einer Shipment-Domain.

## P03 — Persistent Business Object Pattern
Definition: Business Object bleibt stabil; Agent-/Workflow-Runs sind technische Bearbeitungsrecords.
Pilotprüfung: mehrere Runs/Retry/Resume/Takeover verwenden denselben fachlichen Case; Lifecycle/History/Wiederaufnahme sind restartfest.

## P04 — Relationship / Hierarchical Outcome Graph Pattern
Definition: Cases besitzen Parent/Child und weitere Relations; jeder Case kann temporär Reporting Root sein. View(X) umfasst X und descendants. Hierarchie bedeutet Outcome-Zusammenhang, nicht zwingend Organisation.
Pilotprüfung: autorisierte rekursive Subtree-Query plus gleiche aggregierte View an beliebigen Roots; andere Relations erweitern Scope nicht automatisch.

## P05 — Agentic-over-Deterministic Pattern
Definition: AI interpretiert und plant; deterministische Komponenten erzwingen zulässige Effekte.
Pilotprüfung: mutierende Tool Calls durch native Policy/Capability Boundary; ein LLM-Vorschlag umgeht weder IAM/Privacy noch Approval/Hard Fail.

## P06 — Persistent Milestone / Asynchronous Continuation Pattern
Definition: Relevanten Milestone deterministisch persistieren, dann auf Event/Human Gate warten und später aus persistiertem Kontext fortsetzen; kein dauerhaft aktiver Agent nötig.
Pilotprüfung: suspend/resume nach Unterbrechung und Restart im selben Work-Kontext, ohne aktives semantisches Warten.

## P07 — Human Gate Pattern
Definition: Risk und Authority bestimmen notwendige menschliche Freigabe; Gate ist Business-/Execution-Grenze.
Pilotprüfung: echte native Approval-Bindung verhindert Effekt/Acceptance vor zulässiger Entscheidung; UI-Button allein genügt nicht. Review-Fixtures sind kein echter Reviewer.

## P08 — Fractional Assurance Pattern
Definition: Frühe kleine Specialist Assurance erkennt latente Gaps. Nur bei Finding gezieltes Gap Work und tiefer Specialist Drawdown mit Evidence/Closure.
Pilotprüfung: definierter Review-Slice mit minimiertem Context Package und Findings als Work; initialen Drawdown und tiefere Arbeit getrennt erfassen. Unabhängige echte Review offen lassen, wenn Reviewer fehlt.

## P09 — Portable Workbench Pattern
Definition: Workbench ist austauschbarer Experience-/Capability-Layer über fachlichem Contract; sie besitzt Business-Daten nicht.
Pilotprüfung: Case-/Controlling-Views aus autorisierten Contracts/Queries; UI-Wechsel erfordert keinen zweiten Business-State-Store.

## P10 — Deterministic Automation Pattern
Definition: AgentSwarms orchestriert; native Workflows/n8n führen kontrollierte deterministische Automation/Transport aus.
Pilotprüfung: native Topologie/Execution nutzen; keine parallele Orchestration oder verborgenes Sequencing in Custom Tool/Dispatcher.

## P11 — Capability Boundary Pattern
Definition: Capability wird über MCP/API/Tool/Adapter exponiert; interne Daten/Secrets bleiben beim Owner.
Pilotprüfung: Scope, Authority und Failure Semantics des bestehenden Toolcontracts prüfen; unzulässige Tools/Scopes/Effekte ablehnen.

## P12 — Minimum Necessary Context Pattern
Definition: Raw Enterprise Data durch deterministischen Preflight/Klassifikation/Minimierung/Pseudonymisierung in zweckgebundenen Context Envelope überführen; strukturiertes Ergebnis führt nur zu autorisierter deterministischer Aktion.
Pilotprüfung: synthetischer Raw-versus-Minimized-Vergleich mit Qualität und tatsächlich gemessenen Bytes/Tokens getrennt. NO_AI/UNRESOLVED respektieren; synthetische Evidence ersetzt keine Freigabe realer Daten.

## P13 — IAM/RLS / Authority Pattern
Definition: User, Group, Scope, Row/Column Access und Capability Availability werden serverseitig erzwungen.
Pilotprüfung: autorisierte private/shared Caseprojektion plus foreign/revoked/forged-Denials. ÖPost-spezifisches Rollen-/Entra-/Organisationsbinding bleibt eigenes Enterprise-Gap.

## P14 — Evidence / Audit Pattern
Definition: Runs, Traces, Approvals, Audit Events, Outcomes und Test-Evidence sind zusammenführbar.
Pilotprüfung: stabile revision-/Case-/Rungebundene Referenzen, durable Audit/Trace-/Usage-Readback und Restart. Einheitliche fachliche Acceptance zusätzlich unter P15 prüfen.

## P15 — Decision / Evidence / Acceptance Pattern
Definition: Fachliche Decision, Rationale, geprüfte Alternativen/verworfenes Ergebnis, Evidence und Customer Acceptance machen Outcome/Coverage nachvollziehbar.
Avoided Work zählt erst nach belegter Alternative/existing Capability/Prozessänderung und berechtigter Acceptance als erfüllte Anforderung.
Pilotprüfung: exakte Gegenstands-/Revision-/Kriterienbindung und unabhängige Entscheidung; keine freie accepted=true- oder Builder-Selbstfreigabe. Kein RFP-Coverage-PASS aus dem Demonstrator.

## P16 — Reporting / Semantic Pattern
Definition: Intent wird über autorisierte Daten/Semantik in View/Report/Dashboard übersetzt.
Pilotprüfung: vorhandene Reporting-/Semantic-Funktionen nutzen; Natural-language Report und persistierte View, soweit tatsächlich implementiert, separat nachweisen. Deterministische Subtree-View allein belegt keine freie NL-Reporting-Capability.

## P17 — Agentic Development Pattern
Definition: Intent/Architekturregel -> Repository-/Contract-Untersuchung -> Implementierung -> Tests -> Review -> versioniertes Artefakt.
Pilotprüfung: reale Repository-/PR-/Test-Evidence und unabhängig gebundener Review. AI-unterstützte Entwicklung nicht als autonomer Enterprise-Self-Modification-Nachweis ausgeben.

## P18 — Agentic Change Pattern
Definition: Drei Reifestufen: Agentic Development; End-User Agentic Change; Autonomous Enterprise Change. Letzteres ist kein notwendiger Sherlock-V1-Scope.
End-User-Flow: Intent -> Scope/Impact -> Change Work -> Preview/Test -> risikogerechtes Approval -> Version/Deployment -> Rollback/Audit.
Pilotprüfung: jeweilige erreichte Stufe benennen; kontrollierten Change mit Scope/Version/Gates/Rollback zeigen. Keine Selbständerung oder Enterprise-Autonomie hineininterpretieren.

## P19 — Capability Transfer Pattern
Definition: Workbench/Swarms/Skills/Workflow Definitions/Contracts/Tests/Schemas/Patterns sind transferierbar; Credentials, Secrets, Sessions, Kundendaten und environment-specific Runtime State nicht.
Pilotprüfung: versioniertes Paket und Dependency-Manifest mit verschiedenen lokalen Bindings importieren; Secrets-/Runtime-Abhängigkeiten und negative Missing-Binding-Fälle prüfen.

## P20 — Federated Case Reference Pattern
Definition: Lokale Hierarchie bleibt lokal; externe Hierarchie wird referenziert, nicht repliziert. Gegenstellen brauchen weder denselben Casecontract noch ein Caseobjekt.
Angenommene Präzisierung: external_environment_id, external_ref_id, external_parent_ref_id; keine gleichbedeutenden origin_environment-Felder.
Pilotprüfung: unterschiedliche lokale Hierarchien und Ticket/Request-Fremdmodell mit exaktem Roundtrip; Fixture und tatsächlich autonome Systeme als verschiedene Evidenzstufen ausweisen.

## P21 — Federated Work & Capability Pattern
Definition: Jedes Environment besitzt eigene Identity/Hierarchy/Context/Capacity/Knowledge/Policies und exponiert nur vereinbarte Ref, Committed Capability/Capacity, Status/Outcome und freigegebene Evidence.
Pilotprüfung: Austauschcontract minimiert Daten und trennt Capability, Availability, Commitment und Authority. Keine geteilte interne Wahrheit oder pauschale Credentialdelegation.

## P22 — Capability Composition Pattern
Definition: Persönliche Environments bleiben autonom und teilen kontrolliert Pattern/Skill/Workbench/Contract/Test/Evidence mit einem Project Environment.
Pilotprüfung: versioniertes Pattern aus lokalem Scope in Collaboration-Scope übernehmen; keine Verschmelzung persönlicher Environments. Reale Kollegenkonten/-systeme nicht durch Fixtures ersetzen.

## P23 — Processing State Telemetry Pattern
Definition: Processing/Waiting-Übergänge erzeugen Events mit Timestamp, erforderlicher Capability und Waiting Reason.
V6-Klassen: AGENTIC_PROCESSING, DETERMINISTIC_PROCESSING, HUMAN_PROCESSING, WAITING_INTERNAL_DEPENDENCY, WAITING_CUSTOMER, WAITING_EXTERNAL_CAPABILITY, WAITING_APPROVAL, VALIDATION_REVIEW, DONE.
Angenommene Präzisierung: bestehender Lifecycle und Mode bleiben getrennt; V6-Klassen als kompatible Projektion, keine zweite Abschlusswahrheit. State Duration ist keine Capacity Consumption.
Pilotprüfung: atomare/replayfeste Events, fortlaufende Kalenderdauer, Waiting/Mode und Parallelitätsgrenzen sichtbar.

## P24 — Human Processing Capacity Pattern
Definition: Begrenzte menschliche kognitive Verarbeitungskapazität eines Environments/Projekts, unabhängig von Tätigkeitsart; kalender-/allokationsbereinigt.
Pilotprüfung: Availability/Commitment/Booking getrennt, expliziter Verbrauch statt Aktivitätstracking. Keine Mitarbeiter-Performance-Kennzahl; synthetische Stunden als synthetisch ausweisen.

## P25 — Capability Creation vs. Delivery Processing Pattern
Definition: Delivery erzeugt konkreten Outcome; Capability Creation zusätzlich wiederverwendbares Pattern/Skill/Flow/Contract/Test und kann spätere Grenzkosten senken.
Pilotprüfung: purpose-bound Bookings und Artefakt-/Usage-Evidence; ein Case darf beide Zwecke enthalten. Uplift-Flag allein ist kein wiederverwendbares Ergebnis.

## P26 — Pattern Amortisation Pattern
Definition: Initiales Capability Investment, Reuse Count, Demand before/after und Break-even der Investition nachvollziehbar vergleichen.
Pilotprüfung: vergleichbare Baseline/Quality/Rework und tatsächliche Consumption; wenige synthetische Reuses demonstrieren Mechanik, keinen empirischen ROI. Nicht beobachtbare Einsparung bleibt UNKNOWN.

## P27 — Capability Demand Telemetry Pattern
Definition: Pro Work Object benötigte Capability, Processing/Waiting, Provider, Outcome/Rework/Acceptance und Pattern Usage erfassen; aggregiert Demand/Bottlenecks/Missing Patterns/Specialist Drawdown erkennen.
Pilotprüfung: autorisierte Subtree-Aggregation, getrennte Duration/Actual/Demand und unbekannte Werte. Signal ist noch keine belegte Root Cause.

## P28 — Capability Demand & Learning Loop
Definition: Work -> Demand/Waiting -> Outcome/Pattern Effectiveness -> Aggregation -> Bottleneck -> Improvement Work -> Context/Pattern/Capability-Intervention -> versionierte Verbesserung -> erneut messen.
Pilotprüfung: kontrollierte nachverfolgbare Schleife mit Verification; Produktionssystem verbessern, keine Menschen optimieren und keine autonome Promotion.

## P29 — Bottleneck-to-Improvement Pattern
Definition: Auffälliges Waiting/Human Processing führt über Root-Cause-Prüfung zu Improvement Case, Intervention und erneuter Messung.
Mögliche Ursachen: Context Deficit, Missing/Failed Pattern, Capability Gap, Decision Ambiguity, Poor Decomposition, Bad Preparation oder Enterprise Constraint.
Pilotprüfung: signalgebundene Hypothese, idempotenter Candidate, autorisierte Intervention, negatives und positives Resultat erhalten.

## P30 — Capacity & Economics Control Loop
Definition: Case/Context -> Pattern/Capability Demand -> Processing -> Capacity Consumption -> Outcome/Acceptance; Plan/Actual/Remaining/Waiting/Drawdown/EAC informieren Priorisierung und neue Forecasts.
Pilotprüfung: exakt einmalige autorisierte Aggregation und explizite Decisions. Fehlender Forecast/Revenue/Actual ist UNKNOWN, kein erfundener wirtschaftlicher Erfolg.

## P31 — Recursive Case Reporting Pattern
Definition: Dasselbe Reporting für X und alle lokalen descendants; kein separates PM-System und keine spezielle Rootlogik. Neuer Parent oberhalb ändert keine Childidentitäten.
Pilotprüfung: mehrere View-Roots, Reparent/Cycle/Hidden-Scope/Full-count/Paging; historische Buchungs-/Acceptance-Bindung getrennt von aktueller View.

## P32 — Personal / Project / Portfolio Transparency Pattern
Definition: Personal kennt eigene interne Details; Project nur zugesagte Capacity/exponierte Capabilities/accepted Work/Status/Evidence; Customer nur zulässigen Ausschnitt.
Pilotprüfung: unterschiedliche autorisierte Projektionen auf dasselbe Work-Netz, kein hidden-count-/Calendar-/Hierarchy-Leak. Personalzustand nicht als gemeinsame Wahrheit kopieren.

## P33 — Specialist Drawdown / Capability Investment Pattern
Definition: Specialist Delivery von Assurance/Capability Uplift unterscheiden; nachhaltige Demand-Reduktion gegenüber investierter Capacity bewerten.
Pilotprüfung: purpose-/artefaktgebundene tatsächliche Buchungen; Specialist nicht als doppelt summierbare Human-Kategorie. Investment Return nur bei belegter Vergleichsbasis.

## P34 — Predictive Capacity Management Pattern
Definition: Verfügbare Capacity ist aus Kalender, Abwesenheit, Zeitraum, Allokation und Tageskapazität planbar; Forecast nutzt Restlaufzeit und nachgewiesenen Learning-Effekt.
Pilotprüfung: Nettoverfügbarkeit einmal berechnen, Teilallokation/Overlap/Commitment; keine personenbezogenen Abwesenheitsgründe. Geplante Abwesenheit kann Abhängigkeits-/Wissenskonzentrationsrisiko zeigen, nicht automatisch dessen Ursache beweisen.

## P35 — Learning-adjusted EAC Pattern
Definition: Remaining Work, empirischer Demand je Pattern, beobachtete Learning-Entwicklung, Specialist Drawdown und Enterprise Risk ergeben begründeten Forecast.
Pilotprüfung: Actual plus Remaining Estimate mit Datenbasis/Uncertainty; Forecast darf UNKNOWN/EXPERIMENTAL_DISABLED sein, wenn Evidence fehlt. Frühes Uplift nur bei beobachteter späterer Demand-Reduktion amortisieren.

## P36 — Reuse Maturity × Enterprise Complexity Pattern
Definition: R0 Reuse/Reproduce, R1 Adapt, R2 Compose, R3 Extend, R4 Invent gemeinsam mit E0 geringe Complexity, E1 Integration, E2 sensitive Daten/IAM/Security, E3 kritische Operation/Agentic Action/Betrieb bewerten.
Pilotprüfung: versionierte R/E-Klassifikation und evidence-based Assurance-Reklassifikation. Hardening pro Work Package statt pauschal25%; Kategorien nicht als willkürliche numerische Faktoren multiplizieren.

## P37 — Integration Complexity Pattern
Definition: I0 Simple Binding, I1 Stateful, I2 Event/Reconciliation, I3 Enterprise Legacy/Critical. Tatsächliche Timeout/Partial/Duplicate/Ordering/Reconciliation/Schema/Rate-limit/Dead-letter/Idempotency/Repair/Monitoring-Semantik bestimmen Aufwand.
Pilotprüfung: kontrollierte Failure-Injection gegen passende vorhandene Integration/Mock; UNKNOWN nicht Erfolg, Lost ACK nicht blinder Doppelwrite. Kein Pflichtbau einer universellen Integrationplattform.

## P38 — 24/7 Agentic Runtime + Human Core Cell Pattern
Definition: Runtime kann fortlaufend Intake/Classification/Context/Analyse/Preparation betreiben und persistent auf Human Gate warten. Kontinuierliche Runtime bedeutet keine24/7-Human-SLA.
Pilotprüfung: vorhandene native asynchrone Ausführung und durable Fortsetzung; kein zweiter Scheduler oder aktiver Agent-Warteprozess. Kurzer Restart-/Resume-Test ist Funktionsnachweis, keine langzeitige Betriebs-/SLA-Acceptance.

## Abschlussgrenzen und offene reale Entscheidungen

Die Definitionsdatei beseitigt den fehlenden Katalog als Voraussetzung für per-ID Mapping. Sie ersetzt keine ausgeführten Tests und kein genuine Approval. Die bestehende Autorisierung erlaubt nicht, echte Dokumentquellen, Privacy-/Rights-Freigaben, unabhängigen Reviewer oder Michael-/Arbeitgeber-Verbindungen zu erfinden.

Drei reale Dokumente benötigen nur autorisierte Quell-/Bindingreferenzen und zulässigen Verarbeitungszweck; keine Credentials/Originalinhalte in Chat/Git. Independent Reviewer benötigt berechtigten Principal und native getrennte Entscheidungsrolle. Fehlen diese, nur diese echten Gates offen lassen. Bereits belegte synthetische Pilot-Slices nicht zurücksetzen oder als unimplementiert markieren.

683 vs26 Input-Tokens sind ein belegter einzelner synthetischer Providervergleich im Bericht, keine allgemeine Kosten-/Qualitäts-/ROI-Aussage. a33a9c142bf4e0401713c214be14599593696f5c ist dort deployter App-Pin; c6ca7e5b0481d0bcddab94f8bc1ed5880ba151eb der neuere Source-/Reportcheckpoint. Dokumentationsrevisionen niemals als deployed relabeln.
