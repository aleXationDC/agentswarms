# Architekturprüfung: tatsächliche Development-MCP-Bindung

Stand: 18.10.2026. Bezug: bestehender Gesamtauftrag AXTN-DEVSWARM-DELIVERY-UAT-20261018, Produkt-Case 913dbf33-9891-4712-b945-aab9a5cfe5b9, bestehendes MCP-Arbeitspaket 3fbd099a-13bd-4186-8462-6f92b1ebd4d5. Diese Prüfung ist Source-/Berichtsreview, keine neue Runtime-Evidence oder Case-Transition.

## Ergebnis

Der veröffentlichte Bericht d185fb07d8aded2ce039e81b756d91d661524b71 ist kanonisch zurückgelesen, Blob e30bebc3a67619ca3d14d634f26190f7b062b486. Seine Inspektion des allgemeinen Containers axtn-gitea-mcp reicht nicht aus, um den tatsächlich vom Development Swarm benutzten Dienst zu identifizieren. Im vorhandenen Host-Design gibt es einen separaten eingeschränkten Dienst. Weder eine heutige Fehlbindung noch dessen heutige korrekte Bereitstellung sind damit bereits bewiesen.

Meine vorherige Übertragung von vorbereiteten Konfigurationsfähigkeiten auf den laufenden Connector war nicht hinreichend belegt. Zuerst die tatsächliche Bindung nachweisen; nicht einen weiteren Connector neu bauen.

## Quellgeprüfte Zuordnung

| Bestandteil | Kanonischer Stand | Geprüfter Vertrag |
|---|---|---|
| Allgemeiner Gitea-MCP | aXtn/aXtn-git@dfbb45ad6ee546e4b84cea35a106a0bce20c7070, mcp/src/axtn_gitea_mcp/server.py, Blob 31766964a44551266eece9f2d32afd7aad6d390c | Owner-/Write-Mode-Schutz, keine vorbereiteten scoped/effect-Funktionen. Dass dieser allgemeine Dienst so weiterläuft, war ausdrücklich vorgesehen. |
| Vorbereitete eingeschränkte Version | aXtn/aXtn-git@9b700ff5d1cbd8205d356b1413375767f630960a, gleicher Pfad, Blob eb678dfffd3adcfe6221cca81af6a2e4ae5aa467 | Exakte Repo-/Branch-Grenzen, Pfadregeln, Tools/Aktionen, geschützte Branches, optionale Effect-Idempotenz. Source ist nicht heutiger Deploymentnachweis. |
| Separater Host-Dienst | aXtn/aXtn-host@cad8500a00995c98707045b04bc337fd351a96aa, compose/development-swarm.native.yaml, Blob c663275719c5f1149715c0856181592e29675ab6 | Service development-gitea-mcp, Netzwerkalias axtn-development-gitea-mcp, eigenes Image und eigene geschützte Konfiguration, keine Hostports. |
| Historischer Betriebsnachweis | gleicher Host-Commit, evidence/development-swarm/20261003T-scoped-mcp-convergence.md, Blob 86752f08f231b0a4d48a61603e8368db9067a944 | Dokumentiert die frühere Bereitstellung des separaten Dienstes, sechs Tools, positive/negative Laufzeitprüfungen; allgemeiner Dienst blieb unverändert. Belegt nicht den heutigen Zustand. |
| AgentSwarms-Auswahl | aXtn/aXtn-agentswarms@14ad88b477b81ce123638e88b810f0e39990d4e5, src/utils/tools/registry.server.ts, Blob 5811bdb46bf67e7456fadb51bdeca2aa94c05e73 | Ownerbezogener Registry-Lookup nach Servername; Aufruf an den tatsächlich gespeicherten Endpoint. |
| Bestehende aXtn-Bindung | gleicher App-Commit, src/utils/tools/nativeMcp.server.ts, Blob 43981ea3a5ad4132396c964505bdb3d8ecbbebc2 | Prüft Registry-ID, Owner, Namen, Endpoint und Auth-Typ gegen Host-Bindung. Kein Freibrief zum Lesen geschützter Inputs. |

## Zwei wichtige Grenzen der vorbereiteten Version

1. effect ist in create_branch und upsert_file optional. Wenn mitgegeben, werden Feldformate, Payload und Idempotenzmarker geprüft. Das ist keine SupaCase-Autorisierung und keine verpflichtende Validierung der Existenz/Berechtigung des Cases. Native Case-Zugriffskontrolle, Connector-Zielrechte und Idempotenz nicht als dieselbe Funktion darstellen. Keine neue externe Case-Autorisierungsengine daraus ableiten.
2. effect-gebundenes create_branch prüft sowohl den angefragten Prefix als auch den abgeleiteten tatsächlichen Branch gegen dieselbe Branchregel. Eine Konfiguration mit nur dem erwarteten Endnamen scheitert bereits vor dessen Erzeugung. Keine Wildcard oder pauschale Lockerung als Reparatur. Bestehende separate Probe und bestehende Regeln anhand tatsächlicher Source/Negativtests prüfen; keine einzelne Endnamen-Allowlist als bereits funktionierendes Rezept behaupten.

## Konkrete nächste Ausführung

Mit erlaubten nichtgeheimen Metadaten genau eine Beweiskette erfassen: publizierter Builder-Servername -> effektive ownerbezogene Registry-Zeile/Endpoint -> Netzwerkziel -> tatsächlicher Dienst/Container -> Image/Source-Revision -> effektiv konfigurierte nichtgeheime Repo-/Branch-/Pfad-/Toolgrenzen. Keine vollständigen docker-inspect-Env-Ausgaben, Tokens oder ausgeschlossenen Inputs. Den allgemeinen und separaten Development-Dienst ausdrücklich unterscheiden. Bei verweigerter Metadatenabfrage diese eine Sperre benennen, nicht über andere Wege ausforschen.

Ist der vorhandene dedizierte Dienst falsch gebunden oder nicht bereitgestellt, den bestehenden genehmigten Host-/Registry-Betriebsweg zur gezielten Wiederherstellung verwenden. Keine Änderung des allgemeinen MCP-Dienstes und keine Wiederverwendung des historischen Provisioners ohne Prüfung: dieser enthält historische Swarm-/Owner-Annahmen, Secret-Übernahmen und direkte Registry-SQL-Schritte und ist kein ungeprüft zulässiger heutiger Befehl. Native Administration/aktuell vorgesehene Bindung verwenden; Content-Exclusion bleibt verbindlich.

Nach tatsächlich belegtem Scope begrenzte native Tool-Probe und Builder-Modellvergleich fortführen, danach den offenen Contract-HIGH-Befund durch den Swarm bearbeiten. Kein zusätzlicher Graphausbau und keine neue Runtime/Engine. Falls die verlangte Schutzsemantik über die vorhandene Konfiguration hinausgeht, genauen Restgap offen dokumentieren; keine neue aXtn-Erweiterung ungefragt bauen.

## Übrige Zustände

Copilot-Git-Veröffentlichung funktioniert wieder über die eigene Identität; diesen alten Blocker nicht wieder aufnehmen. Actions-Runner ist laut Bericht registriert; offen ist authentifizierter repo-begrenzter Ergebniszugriff, nicht erneut Runnerinstallation. UAT hat weiterhin eine ausdrücklich gemeldete Organisationssperre für den gepinnten Supabase-Input. Diese Architekturprüfung hebt sie nicht auf. Separates isoliertes Host-Target bleibt beauftragte Standard-Compose-Einrichtung; kein UAT-Deployment oder PASS ist damit behauptet.
