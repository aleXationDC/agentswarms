# aXtn vLLM Swarm Selector

Status: UPDATE_FIRST_AUTHORIZED / SELECTOR_AFTER_VALIDATED_UPDATE.
Name ausdrücklich vom Nutzer am 16.10.2026, 15:25 Europe/Berlin festgelegt.
Komponente: aXtn/aXtn-agentswarms. Tracking: Issue #7.
Ausgangskandidat: bdbdc5a3a4963dec9bedb68fdc057326307bb1de.
Source-Audit: handoffs/reports/AXTN-NATIVE-GATEWAY-PARITY-AUDIT-20261016.md, Auditcommit 0123eb4f37df465d5468e9cfe0d3259d850fee59.

## Zweck und ausdrückliche Einordnung

aXtn vLLM Swarm Selector ist eine aXtn-Erweiterung an den bestehenden nativen AgentSwarms-Editor-/Snapshot-/Modell-/Gateway-Verträgen. Sie ist keine unveränderte Upstream-Funktion und kein separates LLM-Gateway, Provideradapter oder Orchestrator.

Ziel: Ein berechtigter Nutzer kann am nativen Agent-Knoten im Swarm die bestehende direkte vLLM-Integration verwenden oder gezielt die bestehende Gateway-Integration für LLMHub aktivieren und ein konkretes erlaubtes Modell wählen. Der gewünschte Corporate-LLMHub-Weg bleibt Gateway-Opt-in pro Knoten; route_all=false. Direkte vLLM-Anbindung bleibt getrennt und kein stiller Fallback.

Der sichtbare Produkt-/Dokumentationsname ist exakt "aXtn vLLM Swarm Selector". Bestehende Maschinenkennungen vllm, llm_gateway, routeThroughGateway sowie Provider-/Modell-IDs werden wegen dieser Benennung NICHT geändert. Keine unnötige neue Datenbank-/Routen-/Provider-Namenswelt.

## Native Grenze und vorhandene Änderung

Beim Original 7c95a69974bac08c946aa7130d7aa0ad1d3f0b06:
- Agent Builder hat natives Gateway-Opt-in.
- Swarm hat native Provider-/ModelCombobox, aber kein Gateway-Opt-in und keinen vLLM-Eintrag in seiner Providerliste.
- agentToNodePatch verwirft das Agent-Gateway-Flag ausdrücklich.
- Native Custom Components (src/lib/swarmComponents.ts) sind sandboxed JavaScript-Transformationen in function-Knoten; daraus folgt KEIN geeigneter Editor-/Provider-Pluginvertrag für diesen Selector.

Vorbereiteter aXtn-Kandidat:
- vLLM in bestehender Providerliste ergänzt;
- Gateway-Opt-in in bestehendem NodeInspector ergänzt;
- Flag in bestehendem Agent-Import/Snapshot und Ausführungs-/Katalogpfad weitergereicht.

Das sind Core-Patches an bestehenden nativen Komponenten. Nicht als vollständig isoliertes oder offiziell garantiert updatesicheres Plugin verkaufen. Keine eigene Function-Node-Steuerung, kein dynamisches Monkeypatching oder zweiter Credential-/Routing-/Policyresolver.

## Wartungs- und Upstream-Vertrag

1. Vorhandene Änderungen inventarisieren: je Datei Baseline, aXtn-Diff, Zweck, Test und native Abhängigkeit; reine fachliche SupaCase-/Identitätsmigrationen getrennt vom Selector führen.
2. Änderungen so klein wie möglich halten; bestehende native ModelCombobox, Importfunktion, Snapshot-Publikation, Auth/IAM/Budget, Gatewayresolver und Providertransport verwenden.
3. Eigene Hilfsmodule/Tests/Dokumentation, soweit sinnvoll, im aXtn-Namensraum; notwendige Core-Touchpoints explizit aufführen. Keine künstliche Abstraktions-/Pluginengine bauen.
4. Bei jedem Upstream-Update Konflikte UND semantische Verträge prüfen. UI sichtbar bedeutet nicht ausführbar; Flagverlust beim Import/Publish/Restart ebenso testen wie Canvas-/Headless-Parität.
5. Gezielte Abnahme: zwei Knoten mit unterschiedlichen Modellen, Gateway nur beim Opt-in-Knoten, globale Route-all aus, exakte Gateway-Katalog-/IAM-IDs, keine direkten Provider-Credential-Loads bei Gateway-Opt-in, fail-closed ohne stillen Fallback. Direkter vLLM-Pfad getrennt testen.
6. Wenn Upstream später gleichwertige Unterstützung liefert, nativen Ersatz prüfen und überflüssige aXtn-Patches entfernen. Upstream-Beitrag kann vorbereitet werden; keine externe Veröffentlichung ohne Auftrag.
7. Update-Fähigkeit ist ein nachgewiesener Wartungsprozess, keine Garantie allein durch Produktbenennung.

## Upstream-Prüfung vom 16.10.2026

Öffentliches Repository: https://github.com/AgentSwarms-fyi/agentswarms
- Neuester beim Abruf vorhandener numerischer Tag: v1.6.0, Commit 70c295f17af39c81b1a4b56e6552307f5d91eef3, Changelog 06.10.2026.
- Aktueller öffentlicher HEAD: 7c95a69974bac08c946aa7130d7aa0ad1d3f0b06 (nach dem Tag).
- Arbeitskandidat package.json meldet 1.5.0. Das allein belegt weder den vollständigen Git-Abstand noch den Live-Stand.
- Dokumentierte historische 1.5-Auswahl: 05df309fbabfa3612e3b86f1860d76c6d95f22b3 in docs/AXTN-UPSTREAM-150-ASSESSMENT.md und COMPATIBILITY.yaml. Historische Baseline nicht als aktuelle merge-base ausgeben.
- Auch der neueste geprüfte Upstream-HEAD schließt die Selector-Lücke nicht.
- Das 1.6-Changelog nennt Änderungen an Edit-Versionierung, Swarm-Abbruch und Sicherheits-/Runtime-Verhalten. Changelog nennt neun Migrationen gegenüber seiner Releasebasis. Nicht ungeprüft als neun fehlende Migrationen unserer Instanz behandeln: tatsächliches Dateimanifest und Ledger abgleichen.

Maßgebliche Nutzerentscheidung 16.10.2026, 15:26 Europe/Berlin: zuerst das reguläre Upstream-Update gegen den festen Tag v1.6.0 umsetzen, validieren und über die bestehenden Host-Verträge in Betrieb nehmen; erst danach den Selector auf dieser Basis prüfen/entwickeln. Relevante zusätzliche HEAD-Fixes getrennt bewerten. Vollständige Ausführungsgrenzen und echte technische Voraussetzungen stehen in der jüngsten UPDATE-FIRST-Fortsetzung unter handoffs/requests/AXTN-LLMHUB-NATIVE-AGENT-GATEWAY-20261016.md. Keine neue Runtime-/Betriebsarchitektur, kein blindes moving-main-Upgrade.
