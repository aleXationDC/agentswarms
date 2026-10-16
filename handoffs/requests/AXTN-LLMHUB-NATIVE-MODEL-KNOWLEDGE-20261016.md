# AXTN-LLMHUB-NATIVE-MODEL-KNOWLEDGE-20261016

Status: NATIVE_CONFIGURATION_AUTHORIZED / EXECUTION_REQUIRED
Repository: aXtn/aXtn-agentswarms
Arbeitsbranch: work/AXTN-NATIVE-SWARM-COMPLETION-20261016
Tracking: Issue #7, bestehende passende Development-Case-Lineage.
Nutzerentscheidung 16.10.2026 20:00 Europe/Berlin: Modellwissen, Auswahlverfahren und native Bereitstellung in AgentSwarms nachholen.

## Ziel und Grenzen
Die Recherche über die zehn LLMHub-Modelle muss in AgentSwarms nativ administrierbar und für Agenten tatsächlich abrufbar sein. Ein wiederverwendbarer nativer Skill beschreibt die Auswahl. Vorhandene Registry-/Discovery-Funktionen prüfen und korrekt einordnen. Keine neue Registry-/Credential-/Routingengine, keine SQL-Direktpflege von Modell-/KB-/Skillobjekten, keine generische Architekturänderung. ChatGPT spezifiziert als Solution Architect/Implementation Engineer; Copilot setzt die konkrete native Konfiguration um. AGENTS.md, Case-/Work-/IAM-Verträge und bisherige Autorisierungen gelten. Keine erneute allgemeine Freigabeschleife.

## Quellen
- Recherche am bed1069a88a984a4e4d24a98409254b60ffe1475:
  docs/architecture/axtn-llmhub-model-role-research-20261016.md
- Vorbereiteter vollständiger Skill:
  docs/architecture/axtn-llmhub-model-selection-skill.md (erstellt 6ed6c6b5599662c2f81c1f2d37bb47190d01a168)
- Source-Prüfung am bed1069a: src/utils/modelRegistry.server.ts, modelRegistry.functions.ts, providerModels.functions.ts, src/components/agents/ModelRegistryPicker.tsx, src/lib/providerSupport.ts, src/lib/skills.ts, src/utils/tools/registry.server.ts und docs/KNOWLEDGE_BASES.md.
- Laufender Rollen-/Development-Auftrag:
  handoffs/requests/AXTN-NATIVE-SWARM-COMPLETION-20261016.md einschließlich jüngster Recherchekorrektur.
- Folgeauftrag architecture@14b51ce781eeecfe766f6fe8dd83c0b393b2c2c1:
  work-orders/AXTN-SUPACASE-USABILITY-0001-TEST.md plus Haupt-/Swarm-Auftrag.

## Verifizierte Ausgangslage, nicht Live-Inventar
Registry speichert Modell-ID, Alias, Hersteller, Beschreibung, Kontext/Outputlimit, Modalität, Fähigkeiten, Dokumentationslink, Quelle und last_seen_at. Der gezeigte native Sync lädt AIMLAPI; kein LLMHub-Sync oder eigener Eintragseditor im geprüften Pfad gefunden. Provider-/Gateway-Discovery ist separat und liefert für Text-Picker ID/Name/free/context, keine vollständigen recherchierten Rollenprofile.
Skills sind agent_skills-Markdown und erreichen ausgewählte Agenten/Nodes als Prompt oder über natives deferred use_skill. KBs liefern Dokumentwissen über Zuordnung/Retrieval und kb_search. Im geprüften Standard-Toolregister fehlt ein dediziertes LLM-Registry-/Discovery-Agenttool; ml_list_models betrifft trainierte ML-Modelle.
Diese Feststellungen am aktuellen Nachfolger prüfen, bevor eine neue Lücke behauptet wird. Live-KB/Skill/Registrybestand wurde in dieser ChatGPT-Session NICHT gelesen.

## Ausführung
1. Bestehenden Parent/geeigneten Child und tatsächlichen ausführenden Actor nativ zuordnen; keine Case-pro-Tool-Aufruf-Duplikate. Native Objektinventare lesen, anhand Namen UND Herkunft vorhandene passende KB/Skills identifizieren. Fremde Objekte/Inhalte erhalten.
2. Genau eine fachliche native KB "aXtn LLMHub Model Knowledge" verwenden oder idempotent anlegen. Die zehn Modellprofile aus der versionierten Recherche über vorhandenen nativen Dokument-/Dateiimport bereitstellen. Kein neuer Gitea-Sync-Connector. Inhalt in sinnvoll getrennte abrufbare Modellprofile gliedern, falls der vorhandene Import dies ohne Sondercode ermöglicht; sonst ein vollständig importiertes Dokument verwenden. Herkunftscommit, Primärquellenlinks und Recherchedatum im Dokument erhalten.
3. Herstellerfähigkeiten, öffentliche Providerpreise, historische Katalogwerte und eigene Rollen-/Gatewaymessungen klar unterscheiden. Das öffentliche Angebot ist nicht die persönliche Freischaltung. Keine Zugangsdaten oder vertraulichen Rohlogs importieren. Registry bleibt strukturierter Katalog, KB hält begründete Interpretation und Evidence; kein zweiter ausführbarer Modellkatalog.
4. Bestehende native KB-Indexierung verwenden. Kein produktiver Embeddingmodellwechsel/Reembedding bestehender KBs nur weil drei Embeddings im Katalog stehen. Falls semantische Indexierung der neuen KB fehlt, nativen Keywordzugriff samt tatsächlicher Grenze prüfen und korrekt berichten; kein funktionsloses "indexiert". Native Hybridretrieval nicht mit BGE-M3-Sparse-/ColBERT-API gleichsetzen.
5. Genau einen nativen Skill "aXtn LLMHub Model Selection" aus dem vorbereiteten Markdown anlegen/aktualisieren, Beschreibung und Tags model-selection,llmhub,planning verwenden. Native Skill-Oberfläche/Speicherverträge nutzen. Der Entwurf ist ein AgentSwarms-Produkt-Skill, keine Copilot-/ChatGPT-CLI-Skillinstallation.
6. Modellwissen den tatsächlich zuständigen vorhandenen Entwicklungs-/Planungsagenten lesbar zuordnen. Wenn es noch keinen Planungsagenten gibt, keinen neuen Swarm oder ungefragte Planungsstage erfinden: Skill in der nativen Bibliothek bereitstellen und zunächst einen geeigneten bestehenden Agenten im begrenzten Playground-/Testkontext mit Skill und KB verwenden. Dauerhafte Zuordnung für Builder/Contract nur soweit fachlich passend, bestehende Rollenprompts/Tools/Skills erhalten. Reviewer sollen Wissen erhalten können, nicht die Builder-Empfehlung blind übernehmen.
7. Erforderliche native KB-/Skill-Leserechte auf bestehenden Owner/autorisierten Nutzerkreis begrenzen; keine allgemeinen Grants, kein Öffentlichmachen. Agent-Bibliothek und tatsächlich benutzter Swarm-Snapshot sind getrennt: bewusst übernehmen und nativ publizieren, falls sich die operative Node-Konfiguration ändert. Historische Runs unberührt.
8. Abruf real testen: Agent nennt die sieben LLMs und drei Embeddings richtig, kann Coding-Stärken von Flash/Qwen/Mistral sowie Code-/DE-/mehrsprachiges Retrieval unterscheiden und die Herkunft nennen. Antwort muss aus dem zugeordneten Wissensbestand stammen; Retrieval-/Tool-/Skill-Nachweis aus vorhandenen Traces, nicht nur aus richtigem auswendig geliefertem Text.
9. Unsicherheitsprobe: Frage nach aktueller Freischaltung eines nur dokumentierten Modells oder nach garantierter Live-Latenz. Ohne aktuelle Daten muss der Agent "nicht geprüft" sagen und darf Herstellerfähigkeit, Registry-Badge oder KB-Text nicht als reale Freigabe/Messung ausgeben. Eine Modellwahlaufgabe darf keine Konfiguration unautorisiert verändern.

## Registry und technischer Agentzugriff
10. Aktuellen nativen Registrybestand mit den exakten zehn Hub-IDs vergleichen, einschließlich zulässiger modellbezogener Aliase. Hersteller-Slug ist nicht der Transport (z.B. Zhipu vs. natives vLLM/Gateway). Native "Available"-Badges beruhen im geprüften Source auf Provider-/Modalitätsunterstützung, nicht auf persönlicher Gateway-Verfügbarkeit; keine falsche Gleichsetzung.
11. Vorhandene native Import-/Konfigurations-/Readtools oder bereits integrierte autorisierte MCP-Tools auf tatsächlichen Katalogzugriff prüfen. Wenn ein vorhandener geeigneter Weg existiert, eng konfigurieren und im Agentlauf demonstrieren. Keine Service-Role/ungefilterte Tabellenfreigabe für Planungsagenten; Native IAM/Budget bleibt maßgeblich.
12. Falls kein solcher nativer Weg existiert, KB+Skill trotzdem fertigstellen. Exakte Source-/Runtime-Lücke für LLMHub-Registry-Import bzw. lesenden Agentzugriff getrennt dokumentieren, mit vorhandenen Wiederverwendungspunkten und kleinstem Änderungsvorschlag. Dieser Auftrag ist KEINE Freigabe für einen neuen Syncjob, custom model tool, Dispatcher oder automatisches Umkonfigurieren aller Swarms. Unbelegten Vollautomatismus nicht behaupten; einen empfohlenen Plan weiterhin über die vorhandenen zulässigen Konfigurations-/Publishwege umsetzen.
13. Rollen-/Case-Management-Auftrag unabhängig weiterführen. Skill/KB darf weder die erforderliche Development-Toolchain ersetzen noch den Python-Fixture-Slice zur allgemeinen Produktentwicklung erklären. Keine neue globale Integration oder erneutes App-Deployment, sofern native Konfiguration ausreicht.

## Abnahme und Lieferung
Bericht: handoffs/reports/AXTN-LLMHUB-NATIVE-MODEL-KNOWLEDGE-20261016.md.
Enthält reale KB-/Dokument-/Skill-IDs, relevante Agent-/Graph-Versionen, Quellenrevision, eigene/genutzte Rechte, Indexstatus, Retrieval-/Skill-Test mit Run-/Trace-/Case-Referenzen, exakten Registry-Abgleich und verbleibende native Zugriffslücke. Reine Datenbereitstellung und autonome Modellwahl getrennt bewerten.
Nach UI-Reload muss alles weiterhin administrierbar und abrufbar sein. Wiederholte Einrichtung erzeugt keine Duplikate. Kein "fertig", wenn nur Dateien in Git liegen.
Die Erzeugung von KB/Skill und die beschriebenen begrenzten synthetischen Tests sind jetzt beauftragt; keine neue allgemeine Zustimmung verlangen.
