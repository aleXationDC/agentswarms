# AXTN-NATIVE-SWARM-COMPLETION-20261016 — Stand 2026-10-16 (Teilabschluss, nicht deployed)

Tracking: aXtn/aXtn-agentswarms#7. Branch `work/AXTN-NATIVE-SWARM-COMPLETION-20261016`.

## Getrennte Ergebnisklassen

| Klasse | Status |
| --- | --- |
| Source-Update v1.6.0 (`70c295f1`) | **fertig, validiert** (`6728dd67`, Bericht `AXTN-VLLM-SWARM-SELECTOR-UPDATE-PREFLIGHT-20261016.md`) |
| aXtn vLLM Swarm Selector (Source) | **fertig, getestet** (siehe unten) |
| Native Administration (UI-E2E) | **offen** — braucht deployte Installation |
| Deployed (Image/Host-Pin/Migration 060/Health) | **offen — blockiert** |
| Corporate-E2E (`gatewayRouted=true`) | **offen** — nach Deployment |
| Allgemeine Development-Fähigkeit | **nicht behauptet**: Swarm bleibt auf den normalize_score/Python-Fixture-Slice begrenzt |

## Pins (nichtgeheim)

- Update-Kandidat: `084da768`; Docs-Nachfolger `8cc270f9`; Selector-Commit dieses Schritts siehe Git-Log des Branches (`f7ec1b6a`).
- Live-App, Image, Host-Pin: unverändert gegenüber dem Vorbericht (Live-Ledger 030/040/050; 060 nur im Repo). Nichts deployt.

## Selector — exakt begrenzte aXtn-Patches (inventarisiert)

Namen/IDs unverändert (`vllm`, `llm_gateway`, `routeThroughGateway`). Kein neuer Provider „llmhub“, kein neuer Adapter.

| Patch | Datei | Stand |
| --- | --- | --- |
| vLLM als direkter Provider (`llm_provider/vllm`) im Swarm-Node (**aXtn-geerbt, nicht upstream-nativ in v1.6.0**) | `NodeInspector.tsx` | vorhanden |
| Node-Gateway-Opt-in, Weitergabe in Runtime/Execution/Resolver/Discovery | `NodeInspector.tsx`, `swarmRuntime.ts`, `swarmExecute.server.ts`, `credentials.server.ts`, `providerModels.functions.ts`, `use-provider-models.ts`, `ModelCombobox.tsx`, `agentToSwarmNode.ts` | geerbt, Tests grün |
| Portable Export/Import erhält Flag | `swarmPortable.ts` | `e39ce442` |
| **Neu:** NodeInspector liest natives `llm_gateway` (Name/Provider, nie `config`), zeigt Status, Schalter nur bei aktivem Gateway (Ausschalten immer möglich) | `NodeInspector.tsx` | `f7ec1b6a` |
| **Neu:** Opt-in über verbundenes Gateway verlangt keine direkte Providerverbindung; IAM-Filter bleibt | `NodeInspector.tsx` | `f7ec1b6a` |

Tests: `vllmSwarmSelectorInspector`, `vllmSwarmSelectorPortable`, `nodeInspectorReads`, `gatewayRouting`, `swarmGatewayExecution`, `caseGatewayIntent`, `providerModelGateway`, `agentToSwarmNode`, `swarmExecutorParity`, `nodeConfigReachable` — grün (tsc/eslint sauber). Gesamtsuite zuletzt auf `6728dd67`: nur 2 Baseline-Rotfälle (`documentRecoveryInventory`); seither nur NodeInspector/Test-Delta.

Nicht durch Source-Test belegbar (bewusst nicht behauptet): reale Gateway-Traces, Modellrechte am Live-IAM, Fail-closed gegen echtes Gateway.

## Native Bedienfolge (ohne CLI-Zwang; im Source geprüft, UI-Abnahme offen)

Agent Builder speichern → im Canvas Agent bewusst erneut übernehmen → Node konfigurieren (Provider/Modell, Gateway-Opt-in) → Draft speichern → Publish. Seeds (`apply.mts`) nur initial/Regression; nicht als Reconciler nach UI-Änderung starten (config-drift-Prüfung bleibt als Schutz erhalten, nicht entfernt).

## Echte offene Voraussetzungen (geprüft am 2026-10-16 ~14:36 UTC)

1. **Registry-Push**: Publisher-Konto `axtn-codex`, einziges Token `codex-git-http-20260914b` hat Scopes `write:organization, write:repository, read:user` — **kein `write:package`**; Registry-Upload liefert 401. Kontoinhaber-Schritt: Gitea → Settings → Applications als `axtn-codex` neues Token mit zusätzlich `write:package` erzeugen, im bestehenden geschützten Pfad `~/.config/axtn-codex/git-http-credential` ersetzen, altes Token widerrufen. Erst nach tatsächlichem Push-Erfolg als erledigt melden.
2. **Backup**: `AXTN_BACKUP_RECIPIENT` (age-Public-Key des Owners, mit Owner-Recovery) fehlt; `age` ist installiert. Eintrag über geschützten Konfigurationsweg (`.runtime/compose.env` des Host-Repos) zusammen mit `AXTN_BACKUP_HELPER_IMAGE`; kein erfundener Schlüssel.

## Danach (Reihenfolge laut Vertrag)

Verschlüsseltes Backup → Image-Digest → Host-Pin/Review → Migration 060 (Ledgerprüfung) → Deployment → Health/Smoke → native Agent-/Swarm-Konfiguration + Publish → Corporate-E2E (zwei Nodes/Modelle, Opt-in gezielt, `gatewayRouted=true`, Gegenproben, Runtime-Session/Testreceipt, Approval/Resume) → Case-Lifecycle.
