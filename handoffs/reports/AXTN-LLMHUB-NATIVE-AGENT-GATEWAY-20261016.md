# AXTN-LLMHUB-NATIVE-AGENT-GATEWAY-20261016 – Statusbericht (Stand nach 96a2d68e)

Basis: Abschlussauftrag-Commit `96a2d68ef57c9d9f2b7b5265df2a613bf7f99936` (Vorstand `8227a683`). Branch `work/AXTN-LLMHUB-NATIVE-AGENT-GATEWAY-20261016`.

**Gesamtstatus: TEILWEISE.** Source/SQL (im Clone) sind abgeschlossen und getestet. Die neue Migration `20261016060000` ist **NICHT live angewendet** (siehe Backup). Die App ist NICHT deployt, Corporate-E2E (Abnahme D) ist NICHT erbracht. Die Ergebnisse sind unten getrennt nach Source, SQL, Runtime, Gateway-Nachweis, Registry und Backup.

## 1. Source / SQL (Clone, rollback-basiert)

Neue Migration `supabase/migrations/20261016060000_case_execution_native_identity_semantics.sql` (additiv; 030/040/050 sind live angewendet und unverändert). Sie ersetzt `axtn_case_execution` vollständig und ergänzt `axtn_case_credential_candidates` um Owner-Liveness:

1. **Persönliche Ausnahme nur am tatsächlichen Provider.** `personal` gilt nur, wenn der effektive Node-Provider `axtn_chatgpt_plan` ist (und kein Gateway-Opt-in). `semantic_route_mode`, Assignee, Group oder Payer sind keine Vorbedingung mehr. Der Randfall „Gateway-Node ohne Assignee → `PERSONAL_CONNECTION_REQUIRED`“ ist beseitigt (getestet).
2. **Provider/Modell nur aus Node-/Snapshot-Konfiguration** oder dem vorhandenen nativen Default (`openrouter` / `google/gemini-3-flash-preview`), nie aus `semantic_route_provider/model`. Fehlende Node-Konfiguration führt zu derselben Entscheidung wie ohne Case (Test: `MODEL_ACCESS_DENIED`, identisch zu `axtn_case_model_allowed`).
3. **Eine Identität für alle Standardintegrationen:** Policy, Modellrechte, Credential-/Gateway-Auflösung und Budget laufen auf `p_user_id` (validierter Run-/API-Key-Owner). Die 050-Sonderlogik (Return ≠ Prüfidentität, Case-Company-Funding) entfällt. Kein Funding-Gate. Responsible Group und Case-Route bleiben Berichtsdimension (`responsible_group_id`, `route_*` im Binding).
4. **Frische Evidence konsistent:** Neue Bindings werden mit `budget_subject_user_id = Owner`, `budget_subject_group_id = NULL` erzeugt. Jede Node-Route trägt `execution_class`, `policy_user_id`, `budget_subject_user_id`, `provider_id`, `model_id` (+ `transport`/`gateway_integration_id`). Der Rückgabewert entspricht dieser Evidence. Der Test liest Binding, Node-Route und Audit zurück. Bestehende Bindings werden nicht umgeschrieben. Alte Attempts bleiben historisch.
5. `axtn_case_credential_candidates` behält den nativen Vertrag „eigene oder IAM-gegrantete Integration“, ergänzt aber die Prüfung, dass der Credential-Owner aktiv ist (nicht gelöscht/gesperrt). Die grant-only-Migration `20261009113000` wurde **nicht** angewendet und widerspricht dem akzeptierten Vertrag.

### Tests
- `supabase/tests/case_execution_identity_parity.test.sql`: alle Fälle PASS (Gateway mit/ohne Case, A ohne Modellrecht trotz B-Rechten, inaktives/fremdes Gateway, manipulierte Node-ID, Standardprovider auf Personal-Case mit anderer Route/Assignee, persistierte Evidence = Rückgabe, Case ohne Assignee, Node ohne Provider/Modell, ChatGPT-Plan bleibt persönlich inkl. fehlender Verbindung/Rechte, fehlender Case-Datenzugriff).
- **Negativkontrolle:** Gegen den frisch geklonten Live-Stand (030/040/050) schlägt derselbe Test fehl (`expected MODEL_ACCESS_DENIED got PERSONAL_CONNECTION_REQUIRED (resolve plain)`).
- `tests/integration/caseExecution.sql` wurde gegen die bestätigte Architektur aktualisiert und ist im Clone **PASS ohne** `20261009113000`: persönliche Fixtures nutzen `axtn_chatgpt_plan`. Die Erwartungen „eigener Credential ohne Grant abgelehnt“ und „Responsible-Group als Payer/Funding“ sind als überholt ersetzt durch Owner-Credential und Owner-Budget mit `responsible_group_id` als Berichtsdimension. Die Trace-Attribution wurde neu kalibriert (Owner statt Gruppe; ein trigger-seitiger Konsistenzcheck erzwingt Trace = Binding). Grant-/Widerruf-/Inaktiv-/Deleted-Fälle bleiben.
- Die Unit-Tests aus dem Vorstand sind unverändert (TS wurde in diesem Schritt nicht geändert).

## 2. Gateway-Attribution (Pfad-Nachweis)
- Source-Nachweis: `tests/unit/caseExecutionCredentials.test.ts` („routes an opted-in Case node through the gateway without loading a direct Case credential“, „fails closed … never falls back“, „keeps the bound credential for a Case node without the opt-in“) und `tests/unit/gatewayRouting.test.ts` verwenden Resolver-Spies. Opt-in führt zum Gateway-Resolver und zu keinem direkten Credential-Load.
- **Korrektur zum Vorbericht:** Die nativen Traces der vier Probe-Aufrufe tragen `request_payload.gatewayRouted = false`. Die 200er stammen damit nachweislich vom direkten vLLM-Pfad des alten Live-Codes, **nicht** vom Gateway. Sie sind echte Inferenz, aber **kein** Gateway-Nachweis. Der Gateway selbst ist laut natives Health-Metadatum authentifiziert („10 models routed“, 2026-10-16T08:45Z). Es liegt kein Gateway-401 vor und keine neue Key-Ausstellung ist nötig. Ein echter Gateway-Pfadnachweis (`gatewayRouted=true` in Trace + Route-Evidence) erfordert das deployte App-Image. Es wurden keine Credentials deaktiviert, um den Pfad zu beweisen.

## 3. Modelle (nur Beobachtung, keine Rollenfreigabe)
- Beobachtet (direkter vLLM-Pfad, ein Sample je Modell, Prompt „antworte exakt `{"ok":true}`“): `gpt-oss-120b`, `Qwen3.6-35B-A3B-FP8`, `Mistral-Small-4-119B-2603` → exaktes JSON. `Qwen3.8-27B-FP8` → „pong“ (nicht JSON). Dies ist ein Einzelbefund, keine Aussage über generelle Eignung.
- Weitere sichtbare IDs aus der Upstream-Liste: `GLM-5.2`, `GLM-5.3-Flash`, `NVIDIA-Nemotron-3-Super-120B-A12B-FP8`. Eine Rollenfreigabe erfolgt nicht. Reproduzierbare Prüfung: Skript `gateway-probe.mjs` (Session-Files, nur Status/Metadaten) je exakter Modell-ID, mehrere Läufe, nach dem Deployment mit `gatewayRouted=true`-Prüfung. Native Model-Discovery statt falscher Modellnamen verwenden.

## 4. Runtime / Live
- Live angewendet (Ledger `agentswarms`): `20261016030000`, `…040000`, `…050000`. Rollback-Funktionskörper in `~/.local/share/axtn/native/backups-owner-policy-20261016/` (Dateirechte jetzt 600).
- `20261016060000` ist nur im Repo und im Clone getestet. **Nicht live.** Sie wird mit der Host-Release-Linie angewendet (mit Backup, siehe Abschnitt 6). Bis dahin laufen live noch die 040/050-Semantiken.

## 5. Registry / Release (Credentialgrenze)
- Unverändert: Das Publish des App-Images scheitert an fehlendem `write:package` des Kontos `axtn-codex` (Registry-401). D06 wird nicht aufgeweicht, es gibt kein lokales Image am Provenienzvertrag vorbei und keine Rechteerweiterung.
- Das früher im lokalen Tool-Log sichtbare Token ist weiterhin nicht widerrufen/rotiert (kein Mechanismus hier ausgeführt).

## 6. Backup (Berichtigung)
- Die frühere Aussage „kein Export, daher keine Verschlüsselungspflicht“ wird **zurückgenommen**: Sie hatte keine Vertragsquelle. Geltender Host-Vertrag (Source `aXtn-host` `scripts/backup.sh`, geprüft im lokalen Checkout `~/aXtn-host-cleanboot`): Zeilen 8–9 verlangen `AXTN_ALLOW_BACKUP=1` und `require_value AXTN_BACKUP_RECIPIENT`; Zeile 16 verschlüsselt jeden Stream mit `age -r "$AXTN_BACKUP_RECIPIENT"`. `age` ist installiert. `AXTN_BACKUP_RECIPIENT` ist in dieser Umgebung nicht gesetzt.
- Bestand minimiert: In `~/.local/share/axtn/native/backups-owner-policy-20261016/` liegen sechs Funktionsdefinitions-Dateien und ein manueller, **unverschlüsselter** Datenbank-Dump `postgres-pre-20261016000000.dump` (3,7 MB, vom Vorlauf). Die Dateirechte sind jetzt 600 im 700-Verzeichnis, Inhalte wurden weder gelesen noch exportiert. Der Dump ist ein Altbestand außerhalb des Hostvertrags und sollte nach dem verschlüsselten Backup entfernt werden.
- Konsequenz: Vor der nächsten backup-pflichtigen Live-Operation (Anwendung von `20261016060000`/App-Release) muss der vorgeschriebene `scripts/backup.sh`-Weg erfüllt sein. Deshalb wurde `060000` in diesem Lauf **nicht** live angewendet.

## 7. Offene menschliche Schritte (genau einer unvermeidbar)
1. `axtn-codex`-Token mit `write:package` ausstellen (Gitea → Settings → Applications) und im geschützten Pfad `/home/alex/.config/axtn-codex/git-http-credential` ablegen. Dabei das geleakte Token widerrufen.
- Ergänzend (separates Thema, Voraussetzung für das Release-Backup): `AXTN_BACKUP_RECIPIENT` (age-Public-Key, kein Geheimnis) in `.runtime/compose.env` bzw. Umgebung bereitstellen.

## 8. Nach dem Credential-Schritt (autorisierte Host-Release-Linie)
Backup (`backup.sh`) → Release mit App-Image und Migrationen inkl. `060000` über die Host-Pins → gezielte Swarm-Version mit Gateway-Opt-ins über den nativen Publish-Lifecycle (`route_all=false`) → Corporate-Case-Lauf mit TEST_SIMULATION-Approval, `gatewayRouted=true`-Nachweis, PR-Head-Readback, Duplicate-Check, Browser-Canvas/Headless-Parität. Abnahme D bleibt bis dahin offen.

## Source-Gates dieses Schritts
- Nur SQL-Tests und Doku wurden geändert (TS unverändert). Lint/Typecheck/Build/vitest-Ergebnisse des Vorstands `8227a683` gelten unverändert (0 Lint-Fehler, Build ok, 2 vorbestehende Baseline-Rotfälle `docsUseCases` und `documentRecoveryInventory`, nachgewiesen auf `32481214`).
