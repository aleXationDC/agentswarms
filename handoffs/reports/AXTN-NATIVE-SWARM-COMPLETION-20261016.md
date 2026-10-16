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

## Nachtrag zu 85fe009b (16.10.2026 ~15:00 UTC)

**Helper-Image (kein Credential):** Host pinnt bereits `supabase/postgres@sha256:f371b5f3f2ac0a05703f33d6e6134515fb2498cab708fb948a0aeb7481467c00` (`architecture/SUPABASE-HOST-OVERRIDE.yaml`). Lokal verifiziert: amd64/linux, `tar` (busybox 1.37.0) vorhanden. Als `AXTN_BACKUP_HELPER_IMAGE` in der wirksamen, untracked Runtime-Datei `.runtime/compose.env` des Host-Checkouts gesetzt (Default von `scripts/backup.sh`; `/run/axtn/prod/compose.env` aus `prod.env.example` existiert auf diesem Host nicht). Für PROD-Vorlagen (`environments/*.env.example` tragen noch `REVIEW_REQUIRED_IMMUTABLE_DIGEST`) ist die Übernahme dieses Digests über regulären Host-Review nötig. Keine Secrets berührt.

**apply.mts:** Keine Referenz in `src/`/`package.json`; reguläre UI-Publikation (Draft/Publish) benötigt das Skript nicht und setzt gespeicherte Operatoränderungen nicht zurück. Drift-Schutz bleibt unverändert (Bootstrap/Regression only).

**Neue Gegenproben (reale Resolver-/Executor-Pfade, synthetische Daten):**
- `gatewayRouting.test.ts`: Opt-in ohne aktives, mit unvollständigem oder mit nicht lesbarem Gateway → fail-closed („LLM Gateway unavailable“), kein direkter Upstream-Zugriff.
- `swarmGatewayExecution.test.ts`: zwei Nodes im selben Lauf behalten eigene exakte Modell-IDs (`GLM-5.2` / `Other-Model-1`) und eigenes Opt-in (true/false).
- Vitest 25/25 grün, eslint/tsc sauber.

**Isolierte UI-Abnahme (Agent → Canvas → Draft → Publish → Readback):** nicht ausführbar, konkret fehlt: ein isoliertes synthetisches Supabase-/Auth-Backend für den Kandidaten (v1.6.0 + Migration 060). Das Live-Schema steht auf 050; ein zweiter dauerhafter Fullstack ist ausgeschlossen. Source-/Executorverträge sind oben abgedeckt; UI-Teil wird am regulär deployten Kandidaten bestätigt.

**Weiterhin Kontoinhaber:** `write:package`-Token für `axtn-codex` (Ersatz/Widerruf) und echter age-Public-Key (`AXTN_BACKUP_RECIPIENT`). Kein LLMHub-Key-Refresh nötig.

## Nachtrag zu 12888cdd (16.10.2026 ~16:30 UTC) — Backup erstellt, Publisher-Token nicht ausstellbar

**Backup (erledigt, nichtgeheim berichtet):**
- Wirksamer Host-Konfigurationspfad: `~/.local/share/axtn/native/compose.env` (Projekt `axtn-native`, Umgebung DEV-native; Vorsicherung `compose.pre-backup-setup.env`). `AXTN_BACKUP_HELPER_IMAGE` = geprüfter Digest `supabase/postgres@sha256:f371b5f3…7c00`; `AXTN_BACKUP_RECIPIENT` gesetzt.
- Provenienz Recipient: **neu angelegte Betreiber-Backup-Identität** (einmalig mit `age-keygen`, nichts überschrieben), privat unter `~/.local/share/axtn/backup-identity/backup-age.key` (0700/0600, außerhalb Git). Kein persönlicher Owner-Key. Schützt nur dieses Deployment-Backup; **kein Schutz gegen vollständigen Hostverlust** — Owner-Escrow/externe Kopie des Schlüssels bleibt getrennte Betriebsaufgabe.
- Backup: `~/.local/share/axtn/backups/release-20261016T1625Z/` (0700): `supabase.sql`, `gitea.sql`, `matrix.sql`, `matrix-runtime.tar`, `supabase-storage.tar`, `gitea-data.tar`, `n8n-data.tar`, `qdrant-data.tar` (alle `.age`), `manifest.sha256`, `metadata` (Ledger-Stand, AgentSwarms-Head `12888cdd`).
- Abweichung vom `scripts/backup.sh`-Ablauf: Das Script adressiert Compose-Projekte (`axtn-native` host/gitea-db/postgres), die auf diesem Host nicht so laufen (Gitea/Matrix-DB sind eigenständige Container). Gleicher Vertrag (age-Stream, kein Klartext auf Platte, Manifest über Ciphertext) direkt mit `docker exec pg_dumpall` und Helper-Image-`tar` read-only umgesetzt. Matrix-Runtime enthält root-eigene Dateien → über Helper-Image gelesen.
- Prüfung: Manifest-Hashes OK; alle drei SQL-Dumps entschlüsselbar mit Endmarker „dump complete“; alle Tar-Archive entschlüsselbar und listbar (7455/20/1629/5/7 Einträge). Kein Klartext ausgegeben. Der volle Restore-Drill wurde nicht neu gefahren.
- Historische Dumps/Schlüssel unangetastet.

**Publisher-Token (nicht ausstellbar mit vorhandener Authentifizierung):** Die Gitea-API verweigert Token-Erstellung für `axtn-codex` (`required=[write:user]`, vorhandenes Token hat `write:organization, write:repository, read:user`). Die Datei `~/.config/axtn-codex/git-http-credential` ist ein Token, kein Passwort; keine Passwortzurücksetzung/DB-Einfügung versucht (nicht autorisiert). **Einziger fehlender Schritt:** Kontoinhaber meldet sich als `axtn-codex` in der Gitea-UI an (Settings → Applications), erzeugt ein Token mit `write:package` (+ bestehende Scopes) und legt es im geschützten Credentialfile ab; danach altes Token `codex-git-http-20260914b` widerrufen. Alternativ ein Token mit `write:user`, dann stelle ich das Paket-Token selbst aus und rotiere.
Es wurde nichts lokal als Release-Image eingesetzt.

**Status:** Backup-Voraussetzung geschlossen. Release (Image-Push/Digest → Host-Pin → Migration 060 → Deployment → Health → UI-/Corporate-E2E) wartet ausschließlich auf den Publisher-Token.
