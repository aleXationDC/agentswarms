# Native Gateway-/Modellauswahl: Agent Builder vs. Swarm
Stand: 2026-10-16. Source-Audit, keine Runtime-Mutation.

## Auftrag und Grenze
Nutzer fordert den nativen Standard von AgentSwarms und die Prüfung, ob individuelle Änderungen die unterschiedliche Auswahl verursacht haben. Keine Freigabe für zusätzliche Gateway-Architektur, eigene Provideradapter oder globale Gateway-Umschaltung aus diesem Audit ableiten.

## Exakte Vergleichsquellen
- Öffentliches Original: https://github.com/AgentSwarms-fyi/agentswarms, HEAD beim Abruf 7c95a69974bac08c946aa7130d7aa0ad1d3f0b06.
- Zuletzt als live berichteter aXtn-Source: eb191e152de0132b0107329d7bf444b10150fccb. Hier nur Source gelesen, Live-Pin nicht erneut gemessen.
- aXtn-Arbeitskandidat: bdbdc5a3a4963dec9bedb68fdc057326307bb1de.
- Original lokal per git clone gelesen; Dateihistorie ebenfalls geprüft. Keine Browser-/Inferenz-/UI-Tests ausgeführt.

## Belegte Befunde
1. Upstream AgentForm.tsx bietet den separaten Schalter "Route through LLM Gateway". Das ist eine native Funktion am gespeicherten Agenten.
2. Upstream NodeInspector.tsx hat Provider- und Model-Auswahl (ModelCombobox), aber keinen routeThroughGateway-Schalter. Der Providerkatalog ist separat im Swarm-Editor definiert. Eine fehlende Gateway-Auswahl ist somit auch im geprüften aktuellen Original vorhanden, nicht erst durch die jüngste aXtn-Änderung.
3. Upstream agentToSwarmNode.ts verwirft tools.routeThroughGateway ausdrücklich und meldet das als dropped setting: what="Route through gateway", why="swarm runs resolve provider credentials per node". agentId wird beim Import auf null gesetzt. Es handelt sich um einen Snapshot, nicht um eine aktive Verknüpfung zum Agenten. Aktivieren am Agenten und Neuimport behebt das im unveränderten Standard nicht.
4. Der zuletzt als live berichtete aXtn-Source enthält dieselbe ausdrückliche Verwerfung und keinen Gateway-Schalter im NodeInspector. Er enthält bereits eine native ModelCombobox; "im Swarm kann generell kein Modell gewählt werden" ist daher durch den Source nicht belegt. Sichtbarkeit im konkreten Browser wurde hier nicht getestet.
5. Der aXtn-Kandidat übernimmt routeThroughGateway in agentToNodePatch und ergänzt eine eigene LLM-Gateway-Section im NodeInspector. Das ist eine aXtn-Erweiterung gegenüber dem geprüften Original und darf nicht als bloßes Aktivieren einer unveränderten nativen Swarm-Funktion dargestellt werden.
6. Auch der originale ModelCombobox-/AgentForm-Katalog ruft useProviderModels(provider) ohne explizites per-Agent-Gateway-Argument auf. Der Kandidat erweitert die Katalogübergabe um routeThroughGateway. Ein vorhandener Agent-Schalter allein belegt damit noch keine korrekte Gateway-Modellauswahl oder Swarm-Ausführung.

## Korrektur vorheriger Auskünfte
Die Empfehlung, am Agenten das Gateway zu aktivieren und lediglich neu in den unveränderten Swarm zu importieren, war falsch: Der Standardimport verwirft das Flag ausdrücklich. Ein Deploy der aXtn-Erweiterung als selbstverständlicher "nativer Standard" ist ebenfalls nicht gerechtfertigt. Der bestehende Release-Auftrag ist durch diese erneute Nutzerpräzisierung hinsichtlich zusätzlicher Gateway-Swarm-Erweiterungen zu begrenzen; keine stillschweigende Custom-Freigabe aus älterer allgemeiner Umsetzungsautorität ableiten.

## Konsequenz für die weitere Arbeit
- Keine neuen UI-/Routing-/Provider-Erweiterungen aus diesem Audit implementieren oder deployen.
- Bestehende native Provider-/Modellauswahl und Agent-Gateway-Funktion als Standard behandeln.
- Die bereits vorbereiteten aXtn-Gateway-Swarm-Erweiterungen nicht als Upstream-Standard freigeben; vor einem Release explizit von unveränderten nativen Funktionen unterscheiden.
- Der geprüfte Standard erfüllt das präzisierte Ziel "Gateway pro Agent-Knoten im Swarm, globale Route-all aus" über seinen regulären Agent-Import nicht. Dieses Ergebnis belegt eine Upstream-Funktionslücke, keine Autorisierung für deren individuellen Ausbau.
- Keine globale Route-all-Umschaltung oder direkte vLLM-Ausweichroute als ungefragte Ersatzlösung.
- SQL-Case-Identitätskorrekturen sind ein separater Änderungsbereich; dieser UI-/Import-Audit behauptet weder ihre Upstream-Herkunft noch ihre vollständige Abnahme.

## Reproduzierbare Kernstellen
Original-Commit 7c95a69974bac08c946aa7130d7aa0ad1d3f0b06:
- src/components/agents/AgentForm.tsx: Gateway-Label und Speicherung tools.routeThroughGateway.
- src/components/swarms/NodeInspector.tsx: Provider-Section gefolgt von Model-Section, ModelCombobox; kein Gateway-Flag.
- src/lib/agentToSwarmNode.ts: agentToNodePatch, dropped Gateway, agentId:null.
- src/components/models/ModelCombobox.tsx: useProviderModels(provider).
Kandidat bdbdc5a3a4963dec9bedb68fdc057326307bb1de: dieselben Pfade, Gateway-Section und Flag-Übernahme ergänzt.

Status: SOURCE_AUDIT_COMPLETE. Kein App-Code, kein Schema, keine Runtime-Konfiguration, keine Publikation und kein Deployment durch diesen Audit verändert.
