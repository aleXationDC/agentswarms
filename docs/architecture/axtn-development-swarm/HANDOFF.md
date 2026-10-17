# Development Swarm — aktueller Gesamtauftrag

Stand: 17.10.2026. Tracking: aXtn/aXtn-agentswarms#7.
Handoff-Branch: work/AXTN-NATIVE-SWARM-COMPLETION-20261016.

## Einziger maßgeblicher Ausführungsauftrag

handoffs/requests/AXTN-DEVSWARM-PRODUCT-NATIVE-20261017.md

Ziel: nativ administrierbarer Swarm bearbeitet selbst AXTN-SUPACASE-USABILITY-0001 aus Architektur-PR #8 bis zu unabhängig geprüfter Approval und reviewbarem, ungemergtem Produkt-PR. Copilot richtet native Konfiguration und Standardintegration ein und behebt gewöhnliche Fehler; Produktcode entsteht durch die Swarm-Agents.

Ausschließlich native AgentSwarms-Funktionen sowie Gitea-Standardfunktionen und offizielle CI-Runner konfigurieren. Keine eigenen Runtimes, Harness-Dienste, Dispatcher, Polling-/Callback-Dienste oder selbst geschriebenen Function-Ersatzmechanismen. Gitea-CI ist nicht als eingebauter AgentSwarms-TypeScript-Runner zu bezeichnen. Vorhandene aXtn-Erweiterungen transparent kennzeichnen.

Native Einzelmechanismen sind source-geprüft; vollständige sichere asynchrone Komposition, Gate und Hostbetrieb sind noch nicht E2E nachgewiesen. Der Gesamtauftrag benennt diese Grenzen ausdrücklich. Der fehlende CI-Nachweis verhindert PASS/Acceptance, aber nicht die zulässige Erstellung eines UNVERIFIED-Produktkandidaten und unabhängige Reviews.

Nicht nach Preflight/Phase A erneut als „Task complete“ enden. Native Konfiguration, offizieller Runner, Auth-/Session-Wiederaufnahme und gewöhnliche Fehler sind Einrichtungsarbeit. Nur eigene zusätzliche Codemechanismen, tatsächlich unerreichbare Rechte, destructive Scope-Erweiterungen oder ausstehende echte unabhängige Approval sind konkrete Stop-Gründe für den betroffenen Schritt. Andere Arbeit fortsetzen.

AGENTS.md, aktuellen Gesamtauftrag und die drei versionierten PR-#8-Auftragsverträge vollständig lesen. Frühere Fixture-/Canary-Beschränkungen werden durch diesen Gesamtauftrag für den aktuellen Produktpfad abgelöst, nicht durch stille Lockerung von Sicherheitsprüfungen. Gitea-/Produkt-Allowlist bleibt eng; kein Main-Write, Merge oder Produktdeploy.

## Bestand und Herkunft

Letzter gelesener Befund: c7133df89db096bf1fa91452b8e46d716241753d,
handoffs/reports/AXTN-DEVSWARM-NATIVE-FIRST-20261016.md.
Er belegt einen publizierten Read-only-Snapshot und native MCP-Reads ohne LLM-Agenten, keinen Produktkandidaten.

Historische Canary-/Ausführungsverträge:
- docs/architecture/axtn-development-swarm/V1-IMPLEMENTATION-CONTRACT.md
- handoffs/requests/AXTN-DEVELOPMENT-SWARM-IMPLEMENTATION-0001.md
- handoffs/requests/AXTN-DEVELOPMENT-SWARM-NATIVE-0002.md
- handoffs/requests/AXTN-DEVSWARM-NATIVE-FIRST-20261016.md

Vorheriger vollständiger Handoff einschließlich Historie ist unter Commit 991b742bb66b24960dc195e28320d7988dddca44 zurücklesbar. Keine historischen Runs, Cases, Versionsobjekte oder Evidence löschen.

Die separat autorisierten nativen Restreparaturen aus handoffs/requests/AXTN-DEVSWARM-CLOSURE-20261016.md und die sichere Rotation genau der zwei offengelegten internen Secrets bleiben gültig. Keine zusätzliche allgemeine Secret-/Credential-Rotation und keine erneute allgemeine Freigabefrage. Keine Secretwerte in Ausgaben, Git, Graph oder Cases.
