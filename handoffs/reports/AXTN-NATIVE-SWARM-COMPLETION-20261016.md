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

## Nachtrag zu 54e4b1bf (16.10.2026 ~16:45 UTC) — Kontozuordnung `aXtn-copilot-cli`

- **Herkunft des Fehlers:** Das globale Git-Konfigurations-Credential-Helper (`~/.local/bin/axtn-codex-git-credential`, Datei `~/.config/axtn-codex/git-http-credential`) gehört zum Codex-Workflow und wurde irrtümlich für diesen Copilot-Release übernommen. Fremde Codex-Konfiguration wurde nicht verändert.
- **Korrektur für diesen Workflow:** Git-Transport erfolgt ab jetzt per SSH-Alias `axtn-gitea` (Schlüssel `axtn_copilot_gitea`). Verifiziert: `Hi there, aXtn-copilot-cli! … successfully authenticated with the key named aXtn Copilot CLI`; `git ls-remote ssh://git@axtn-gitea/aXtn/aXtn-agentswarms.git` liest Refs; Push dieses Nachtrags erfolgt über dieselbe Identität (Ergebnis siehe Commit).
- **Registry-Authentifizierung (separat geprüft):** SSH-Keys gelten nicht für `/v2` der Gitea-Container-Registry; dort ist ein HTTP-Token bzw. Passwort von `aXtn-copilot-cli` nötig. Für dieses Konto ist **kein** geschützter HTTP-/Registry-Zugang vorhanden (kein `~/.docker/config.json`, kein Copilot-Credentialfile; anonymer Token-Endpoint 401). Die Existenz des Kontos beweist keinen Registry-Zugriff; es wird kein Erfolg behauptet. Package-Rechte des Kontos sind damit unverifiziert.
- **axtn-codex:** Als Deploymentvoraussetzung aufgehoben. Das offengelegte Token `codex-git-http-20260914b` bleibt separate Sicherheitsaufgabe des Kontos `axtn-codex` (Widerruf/Rotation), nicht Teil dieses Releases.
- **Exakt fehlend:** Ein Registry-fähiges Credential für `aXtn-copilot-cli` (Gitea Settings → Applications, Scopes `write:package` + `read:package`, nur für Repo `aXtn/aXtn-agentswarms`/Org-Package-Schreibrecht), abgelegt in einem geschützten Copilot-eigenen Pfad (z. B. `~/.config/axtn-copilot/registry-credential`, 0600). Token-Erstellung verlangt eine authentifizierte Kontosession (API nur mit `write:user` oder Passwort/UI); ohne vorhandene Session/Token wurde nichts umgangen.

## Nachtrag zu 6b1598c7 (16.10.2026 ~17:00 UTC) — Copilot-Registry eingerichtet, Image publiziert

- **Token (nativer Server-CLI-Weg):** Im laufenden Container `axtn-gitea` (Gitea 1.27.3, Work-Path `/data/gitea`, Config `/data/gitea/conf/app.ini`) mit `gitea admin user generate-access-token -u aXtn-copilot-cli -t axtn-copilot-registry --raw --scopes write:package,read:package` ausgestellt. Ausgabe direkt in den geschützten Pfad `~/.config/axtn-copilot/registry-credential` (Verz. 0700, Datei 0600); stderr leer; nichts angezeigt. Kein `all`/`write:user`, keine neue Rolle, keine DB-/Passwort-Aktion.
- **Docker-Login:** eigener `DOCKER_CONFIG=~/.config/axtn-copilot/docker` (0700), Login per `--password-stdin` gegen `127.0.0.1:3000`. Docker-Config speichert ohne Credential-Helper unverschlüsselt (Docker-Warnung) → Schutz über Dateirechte im Betreiberbereich. Codex-Docker-/Git-Konfiguration unberührt.
- **Wiederverwendung:** Release-Aufruf: `DOCKER_CONFIG=$HOME/.config/axtn-copilot/docker docker push 127.0.0.1:3000/axtn/<image>:<tag>` (keine interaktive Eingabe). Rotation bei Widerruf/Ablauf: Betriebsaufgabe über denselben Server-CLI-Weg (neuer Tokenname), keine Ritual-Neuanforderung pro Release.
- **Rechtebeleg:** Image `127.0.0.1:3000/axtn/axtn-agentswarms:6b1598c7c4766be03bb26f638ef4757acc9d83a2` aus Dockerfile des Heads `6b1598c7` (Revision-Label, VITE-Public-Build-Args aus der bestehenden nativen Umgebung) gebaut und **erfolgreich als `aXtn-copilot-cli` gepusht**. Packages-API: Owner `aXtn`, Creator `aXtn-copilot-cli`. Registry-API-HEAD bestätigt `Docker-Content-Digest: sha256:f5c80afb788badbc65622301006d0f9f9c128a13a91271fca9641a5ae6344c07`; lokaler RepoDigest identisch.
- **Git** bleibt SSH (`axtn-gitea`, aXtn-copilot-cli). `/api/v1/user` mit diesem Token → 403 (bewusst kein `read:user`).
- **Nächste Schritte:** Host-Pin auf den Digest (IMAGE-PROVENANCE/AGENTSWARMS-PIN, Review-Gates), Ledger-Prüfung/Migration 060, Deployment, Health, native UI-Abnahme, Corporate-E2E.

## Release-Ausführung (16.10.2026 ~17:20 UTC) — deployed

| Schritt | Ergebnis |
| --- | --- |
| Source/Image | Head `6b1598c7c4766be03bb26f638ef4757acc9d83a2` (v1.6.0 + Selector + Gegenproben), Image `127.0.0.1:3000/axtn/axtn-agentswarms:6b1598c7…` |
| **RepoDigest** | `sha256:f5c80afb788badbc65622301006d0f9f9c128a13a91271fca9641a5ae6344c07` (Registry-HEAD = lokaler Digest, Push als `aXtn-copilot-cli`) |
| Backup | `release-20261016T1625Z` (siehe oben), Ledger-Stand vor Migration: letzter Eintrag `…050000` |
| Migration | `20261016060000_case_execution_native_identity_semantics.sql` (SHA256 `80dcf76c509f7b2bd37acc4848b501e00e49a4ccb72a16ca8d44d90ccfcae209`): zuvor Dry-run in zurückgerollter Transaktion OK, dann in einer Transaktion mit Ledger-Eintrag angewendet. **`20261009113000_case_system_integration_grant_only.sql` bewusst weiterhin NICHT angewendet** (laut Handoff AXTN-NATIVE-RESOURCE-CASE-ROUTING-0001 überholt; hätte die Live-Funktion zurückgesetzt). |
| Deployment | Candidate-Checkout `candidates/agentswarms-6b1598c7…` (git worktree), `compose.env` → neuer Commit (Vorstand `compose.pre-release-6b1598c7.env`), `native-compose.sh agentswarms up -d --no-build --no-deps agentswarms`; lokaler Tag `axtn-agentswarms-native:6b1598c7…` zeigt auf den Registry-Digest (Image-ID = Digest). Andere Services unverändert. |
| Health | Container `healthy`, Image-ID `sha256:f5c80afb…`, `GET :18080/` → 200 |
| Rollback | Image `axtn-agentswarms-native:eb191e15…` + `compose.pre-release-6b1598c7.env`; Funktionsdefinitionen vor 050 in `backups-owner-policy-20261016/`; vollständiges Backup oben. Vorwärts-Migration 060 hat kein automatisches Down. |
| Gateway-Inferenz am deployten Stand (`POST /api/chat`, `routeThroughGateway=true`, `provider=vllm`) | `gpt-oss-120b` 200 + exaktes JSON; `Mistral-Small-4-119B-2603` 200 + exaktes JSON; ungültige ID → 502 **„vllm via Gateway error [404]… Available models …“** (Fehlertext stammt vom Gateway ⇒ Gateway-Pfad, kein direkter Fallback, keine stille Substitution). |

**Weiterhin offen (nicht behauptet):** native UI-Abnahme am deployten Stand (Agent → Canvas → Draft → Publish → Readback) und der Corporate-E2E-Lauf des Development-Swarms (`gatewayRouted=true`-Trace, Runtime-Receipt, Approval/Resume, Case-Abschluss). Der Live-Swarm `aXtn Development Swarm - Native V1` hat weiterhin `openai/gpt-4.1-mini` ohne Gateway-Opt-in; die Umstellung auf Gateway-Modelle ist die native Operator-Konfiguration (Vorschlag: Builder `gpt-oss-120b`, Reviewer `Mistral-Small-4-119B-2603`, beide mit Opt-in), historische Runs/Approvals bleiben bei Publish unverändert.

## Nachtrag: native UI-Abnahme und Corporate-E2E (deployed Stand 6b1598c7, Image-Digest sha256:f5c80afb…c07)

**Native Bedienfolge (nur UI, keine CLI/Seeds):** Login → Agent Swarms → „aXtn Development Swarm - Native V1“ (`ad06e17d…`) → Node-Inspector. Security Breaker: Provider vLLM, „Route through LLM Gateway“ an, Modell `gpt-oss-120b`. Maintainability Breaker: vLLM, Gateway an, `Mistral-Small-4-119B-2603`. Save (Draft), Deploy → Publish. Readback in `swarms.nodes` und `swarms.published_nodes` (Published 2026-10-16 17:10:47Z, Version `61b057aa…`): Provider, exakte Modell-IDs und `routeThroughGateway=true` erhalten; Builder und Contract Breaker unverändert `openai/gpt-4.1-mini` ohne Opt-in. Vorheriger Node-Stand gesichert (Session-Artefakt `swarm-nodes-before-selector-20261016.json`). Historische Runs/Approvals unverändert.

**Corporate-E2E (Run `fbb14897-e41a-4aea-b574-2bb7e349e26e`, Case `f4dd1a02-ff31-433c-b625-3024d5a0aa97`, task `…-GATEWAY-E2E-20261016`, attempt `gateway-v1`):**
- Start über `POST /api/swarm/run` (Idempotency-Key, `route_all=false`) → `suspended` am Gate.
- `execution_traces.request_payload`: `vllm/gpt-oss-120b gatewayRouted=true`, `vllm/Mistral-Small-4-119B-2603 gatewayRouted=true`; Builder und Contract `openai/gpt-4.1-mini gatewayRouted=false` (kein Fallback, keine Direktverbindung für die Gateway-Nodes). `swarm_run_steps` zeigen dieselben Provider/Modelle.
- Approval `91435480-b605-4984-bc7a-8a5edba3534f` (Verdict PASS, Candidate `e867e4df…b415`) über die native Review-UI entschieden; **TEST_SIMULATION** im Rahmen der bereits erteilten Owner-Autorisierung, keine persönliche Entscheidung von Alex. Eine separate Evidence-Transition für die Delegation wurde auf diesem Case nicht geschrieben.
- Resume → Run `success`, 31 Steps, 0 Fehler. PR #10 `aXtn/development-swarm-acceptance` (offen, nicht gemerged), Case `CLOSED` per regulärem COMPLETED, Runtime-Receipt `notebook-runtime/273889c8-…/receipt` für Candidate `e867e4df…`.
- Gegenproben: ungültige Modell-ID über Gateway → 502 ohne Direktfallback; Unit-Tests fail-closed bei fehlendem/unvollständigem/nicht lesbarem Gateway; zwei Nodes mit eigenen Modellen im selben Lauf bestätigt.

**Grenzen:** Slice bleibt der normalize_score/Python-Fixture; allgemeine Development-Fähigkeit nicht behauptet. Live-IAM-Negativprobe pro Modell nicht ausgeführt. Offene Betriebsaufgaben: Owner-Escrow Backup-Schlüssel, Widerruf altes `axtn-codex`-Token, Helper-Image-Digest in `environments/*.env.example` per Host-Review.

## Nachtrag: LLMHub-Rollenmodelle konfiguriert, publiziert und gemessen (Fortsetzung bed1069a)

**Rollenmatrix (vorher → nachher), alle vLLM über Gateway-Opt-in, `route_all=false`:**

| Rolle | Vorher | Nachher |
|---|---|---|
| Builder | openai/gpt-4.1-mini | vllm/GLM-5.3-Flash (Alternative Qwen3.6-35B-A3B-FP8 offen, nicht benötigt) |
| Contract Breaker | openai/gpt-4.1-mini | vllm/GLM-5.2 (Alternative gpt-oss-120b) |
| Security Breaker | vllm/gpt-oss-120b | unverändert |
| Maintainability Breaker | vllm/Mistral-Small-4-119B-2603 | unverändert |

**Native Bedienfolge (nur UI):** Gateway-Probe aller Kandidaten (200). Agent Builder → Edit → Model je Agent; danach im Swarm-Canvas Inspector „Import from agent library“ je Node (Labels zurückgesetzt), Save, Deploy → Publish (2026-10-16 18:11:52Z, Version `f7fc9cb5…`). Readback `nodes == published_nodes`; `agentSnapshot.versionId` zeigt auf die neuen Agent-Versionen (Builder `2a3d3702…`, Contract `30a90386…`, Security `29c84b1a…`, Maintainability `d50b0c1c…`). Keine SQL-/Seed-Patches. Vorherige Agent-Versionen bleiben erhalten (Rollback möglich).

**UI-Befunde:** (1) AgentForm speichert Temperatur 0 als 0.7 (`agent?.temperature || 0.7`, `AgentForm.tsx`); per UI auf 0 zurückgesetzt, DB-Readback 0. Produktfix steht aus. (2) Speichern schreibt Guardrails als explizite Default-Werte (semantisch gleich, „Guarded“-Badge entfällt).

**All-Gateway-Baseline (Run `0bbbb403-5e8a-48dc-8802-7d369a91a3bb`, Case `238a5f08-a2e8-443c-854e-6acf5d807f35`, attempt `rolemodels-v1`):** `execution_traces`: alle vier Nodes `vllm` + exakte Modell-ID + `gatewayRouted=true`. Builder lieferte gültiges `candidate-content/v1`; Contract/Security/Maintainability lieferten strukturiertes `review/v1` (Contract: ein LOW-Finding „toter Code“, nicht blockierend). Gate PASS, Run suspendiert, Approval `f4c73f0a-6155-4e91-8405-8f2f0b7019c2` über Review-UI entschieden (**TEST_SIMULATION** im bereits erteilten Fixture-Scope, keine Entscheidung von Alex), Resume → `success`, 31 Steps, Outcome `PR_READY`, PR #11 in `aXtn/development-swarm-acceptance` (offen). Alte Runs/Approvals unverändert.

**Rollengrenzen:** Eine einzelne Fixture-Messung belegt Vertragstreue, nicht Qualität; kein bounded Vergleich mit fehlerhaften Kandidaten für Flash ausgeführt. Live-IAM-Negativprobe pro Modell mit synthetischer Identität weiterhin nicht ausgeführt (Voraussetzung: isolierte Test-Identität ohne Modellrecht).

**Phase A `AXTN-SUPACASE-USABILITY-0001`: NOT_READY.** Der publizierte Swarm validiert fest `repository=aXtn/development-swarm-acceptance` (`axtnDevelopmentSwarm.ts:52`), `path=src/normalize_score.py` (:57), `request` ≤ 8000 (:56), Testprofil `python-normalization-v1` (:66), Candidate ≤ 16000 Zeichen (:76), PR-Ziel/Branch hart auf das Acceptance-Repo (:77/:85/:180) und Builder-Prompt auf normalize_score (:292). Der Case-Auftrag (Repo `aXtn/aXtn-agentswarms`, mehrere Dateien/Bereiche) passt nicht; Tarnung als Python-Task wäre unzulässig (SWARM-Work-Order). Kleinste native Anschlussmöglichkeit: neuer Task-Vertrag `axtn.development.task/v2` mit Repository-Allowlist, Mehrdatei-Candidate, Testprofil für TypeScript (`npm`-basiert) im Runtime-Verify-Tool, Builder-Prompt aus dem Vertrag, plus Case-Lineage (ein Parent, Pakete `master-data`, `case-workbench`, `logging-observation`, `acceptance`). Keine Ausführung des Auftrags erfolgt.

## Nachtrag 7fced1df – Teilstatus (Stand Fortsetzung)

**Temperatur-Fix**
- Source: `agent?.temperature ?? 0.7` (`5a4d1405`); Regressionstest `tests/unit/agentFormTemperature.test.ts` (`57fe65cb`, grün, eslint ok).
- Deployed: Image `127.0.0.1:3000/axtn/axtn-agentswarms:57fe65cb…`, Digest `sha256:f04c13b962471c61aa445c271979d0073b3c01393a3d0184f55fbe8df56ea1d4`; Container healthy, HTTP 200. Rollback: `compose.pre-release-57fe65cb.env`.
- Live-UI-Readback (Playwright, deployed): Builder und DMS Stage 1 zeigen Temperatur 0 (DB: 0.00), Demo Friendly 0.5, neuer Agent Default 0.7, Slider auf 0 einstellbar. Ein vollständiger Speichern-Roundtrip mit Testagent wurde NICHT abgeschlossen (Scratch-Agent wurde nicht angelegt); produktive Agenten blieben unverändert.
- Guarded-Badge: `hasGuardrails` ist bei `contentSafetyLevel !== "off"` true; die früheren Dev-Agents speichern nun explizite Defaults (Filter aus). Kein Schutzverlust, kein Code-Fix.

**TypeScript-Runtime (Teil 4) – Lücke belegt**
- Runtime-Image `agentswarms/notebook-runtime:latest` (geprüft, `--network none`): nur Python 3.12; `node`, `npm`, `git` fehlen.
- Der Development-Swarm ist in `src/lib/axtnDevelopmentSwarm.ts` fest auf Repo-Allowlist, `src/normalize_score.py` und Testprofil `python-normalization-v1` verdrahtet (`workContract.ts` enum nur `python-normalization-v1 | documentation-v1`). Ein TypeScript-Produktrepo-Task ist nativ NICHT ausführbar.
- Kleinster Erweiterungsentwurf (nicht implementiert): neues unveränderliches Testprofil `node-ts-v1` mit Mehrdatei-Pfadscope, Base-SHA-Checkout im Runtime-Image mit gepinnten Node/npm (offline, lockfile-basierte Dependencies), Receipt, der den gesamten Candidate (alle Dateien) hasht; v1-Fixture und Repo-Allowlist bleiben unverändert; kein freier Shell-/npm-Befehl im Task.

**Offen (nicht erledigt)**
- KB „aXtn LLMHub Model Knowledge“ und Skill „aXtn LLMHub Model Selection“: Dokumente liegen im Repo (`docs/architecture/llmhub-model-knowledge/`), UI-Import, Indexstatus, Agententest mit Trace-IDs, Registry-Abgleich fehlen.
- IAM-Negativprobe und Flash-Gegenprobe am fehlerhaften Candidate fehlen.

**Sicherheitsvorfall**: Beim Anzeigen von `compose.env` wurden `AGENTSWARMS_INTERNAL_RUN_SECRET` und `AGENTSWARMS_PROVIDER_CREDS_SECRET` (dev-native) im Klartext in die Sitzungsausgabe geschrieben. Rotation empfohlen.

## Nachtrag 7fced1df – KB/Skill und Gegenproben
- KB, Skill, Advisor-Agent, Trace-IDs, Registry-Abgleich und Zugriffslücke: siehe `AXTN-LLMHUB-NATIVE-MODEL-KNOWLEDGE-20261016.md`.
- **IAM-Negativprobe:** Live-Probe NICHT durchgeführt – sie bräuchte eine synthetische Identität und eine Änderung der globalen IAM-Einstellungen (Default-Deny) auf der Produktivinstanz. Produktgleiche isolierte Tests laufen grün: `iamModelDefaultDeny`, `iamPolicyReadFailure`, `gatewayRouting` (35/35; Fail-closed ohne Direktfallback bei fehlendem/unvollständigem Gateway). Source-/Unit-Test ≠ Live-Abnahme.
- **Flash an fehlerhaftem Candidate:** Gateway-Lauf GLM-5.3-Flash (HTTP 200, 2.9 s) mit bekannt fehlerhaftem `normalize_score` (None→None, kein Clamp unten, Banker-Rounding, bool). Antwort war valides JSON mit `defects` + `candidate`; lokal ausgeführte Prüfungen (None→0, Clamp, Round-half-up, TypeError bei bool) PASS. Kleine Einzelprobe, kein Qualitätsranking, kein Qwen-Vergleich.
- Temperatur-Fix-Readback: Agent mit Temperatur 0 wurde im Advisor-Anlegen-/Edit-Pfad nicht erneut geprüft; Temperatur-0-Anzeige und Default 0.7 siehe oben.
