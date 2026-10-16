# AXTN-LLMHUB-NATIVE-AGENT-GATEWAY-20261016 – Statusbericht (Stand nach b2c516b7)

Basis: Anforderungscommit `b2c516b708c708221eb95d6a965dfb764532a70e`. Branch `work/AXTN-LLMHUB-NATIVE-AGENT-GATEWAY-20261016`. Vorgängerstände: Implementierung `47beb751`, Bericht `33497c2a`.

**Gesamtstatus: TEILWEISE. Source/SQL/Lint/Typecheck/Build und Gateway-Authentifizierung sind belegt. App ist NICHT deployt, Corporate-E2E (Abnahme D) ist NICHT erbracht.**

## IMPLEMENTED
- Gateway-Opt-in je Agent auch für Case-Läufe (siehe Vorbericht): Intent aus dem Run-Snapshot (`nodeGatewayIntent`), Drift-Prüfung `caseGatewayRoute` (Body-Claim ≠ Snapshot → `ROUTING_DECISION_REQUIRED`), fail-closed, kein Direct-Fallback.
- **Identitätsparität (neu):** Der installierte `axtn_case_execution` ließ die Policy-Identität beim Gateway-Knoten aus der Case-Bindung kommen (Assignee bei `PERSONAL_CONNECTION`, Case-Semantic-Route für Provider/Modell, Responsible-Group-Budget). Das war eine Abweichung von der Non-Case-Semantik. Der Beleg ist die Negativkontrolle unten.
  - Migration `20261016040000`: Für Gateway-Knoten und alle nicht-personalen Knoten ist `actor = p_user_id`. Das ist der validierte Run-/API-Key-Owner, den der Auth-Vertrag bereits erzwingt (`run.user_id = p_user_id`, Custodian = Owner). Provider/Modell kommen aus der Node-Konfiguration, wenn sie beides benennt. Die Case-Semantic-Route ist nur noch Fallback. Gateway-Knoten brauchen keine persönliche Verbindung.
  - Migration `20261016050000` (schränkt 040 ein, 040 wurde nicht umgeschrieben): Die Owner-Identitäts-Sicht (Policy-User, Budgetsubjekt = Owner) gilt nur für Gateway-Knoten. Nicht-Gateway-SYSTEM_INTEGRATION-Knoten behalten den bestehenden Case-Company-Funding-Vertrag (Responsible-Group-Budget, getestet in `tests/integration/caseExecution.sql`).
  - Die persistierte Attempt-Bindung wird nie verändert. Es ändert sich nur der zurückgegebene effektive Wert. Historische Attempts, Budgets, Traces und Snapshots bleiben unverändert.
  - Personal-ChatGPT-/Persönliche-Verbindung ohne Gateway-Opt-in bleibt unverändert.
- Docs: `docs/engineering/02-agent-runtime.md` korrigiert. `docs/llmhub-prod-lineage-acceptance-20261009.md` trägt jetzt ein „SUPERSEDED“-Banner mit Verweisen und ist sonst unverändert. `ARCHITECTURE.md` aktualisiert.

## TESTED
- **SQL, gebundene synthetische Case-Runs, isolierter Clone** (`supabase/tests/case_execution_identity_parity.test.sql`), 7/7 PASS:
  - A mit Modellrecht wird erlaubt, obwohl der Case-Assignee B andere Rechte hat. Policy- und Budgetidentität sind A. Die Route-Evidence trägt `transport=LLM_GATEWAY`.
  - A ohne Modellrecht wird trotz B-Rechten mit `MODEL_ACCESS_DENIED` abgelehnt.
  - `credential`-Load für Gateway-Knoten → `ROUTING_DECISION_REQUIRED`.
  - Inaktives und fremdes (B-eigenes) Gateway → `SYSTEM_INTEGRATION_UNAVAILABLE`.
  - Ambiguität ist per Constraint `uniq_integrations_singleton_type` ausgeschlossen (ein `llm_gateway` je Nutzer).
  - Manipulierte Node-ID → `CASE_EXECUTION_SEMANTIC_NODE_REQUIRED`.
  - Nicht-Gateway-Knoten im Personal-Case bleibt personal-gesperrt.
  - Fehlender Case-Datenzugriff → `CASE_ACCESS_DENIED`.
  - Ohne Provider-Call und ohne Secret-Ausgabe.
  - **Negativkontrolle:** Gegen die zuvor live installierte Funktion (nur 030000) schlägt derselbe Test mit `MODEL_ACCESS_DENIED` fehl. A wurde dort mit B's Rechten beurteilt. Das belegt die korrigierte Abweichung.
- Bestehende Regression `tests/integration/caseExecution.sql` im Clone: **PASS** nur mit angewendeter grant-only-Migration `20261009113000` plus 030/040/050. Ohne diese Migration schlägt der Test auf der Basis und auf dem Live-Zustand identisch fehl („SYSTEM_INTEGRATION accepted the actor-owned credential without an IAM grant“, vorbestehend, da `20261009113000` live nicht angewendet ist). 040 allein brach dort das Group-Funding-Assertion. Das ist der Grund für 050.
- Source: `npm run typecheck` (inkl. `generate:routes`) ohne Fehler. `eslint .` mit 0 Fehlern (235 vorbestehende Warnungen). `npm run build` erfolgreich.
- vitest gesamt: 10091 grün, 2 rot, 40 übersprungen. Beide Rotfälle sind **vorbestehend**. Nachweis: Lauf auf reiner Basis `32481214` (Worktree, nur diese beiden Suiten), gespeichert in `…/files/gateway-baseline-failures-32481214.log`.
  - `docsUseCases` (`docs/IAM.md`, „expected -1 to be greater than 0“).
  - `documentRecoveryInventory` („expected {…} to match object {app…}“).
  - Der frühere Bericht widersprach der Nutzerzusammenfassung. Der Basisvergleich wurde damals nicht ausgeführt und erst jetzt tatsächlich gefahren.
- `test:integration` (vitest) läuft ohne Supabase-Umgebung und wurde übersprungen (40 skipped). Die SQL-Integrationsfälle wurden stattdessen direkt im Clone ausgeführt (siehe oben).
- Abnahme B (Canvas/Headless-Parität): bestehende Executor-Tests `tests/unit/swarmGatewayExecution.test.ts` belegen für `agent`/`condition`/`evaluate` identische Weitergabe von Gateway/Modell/Tools aus dem immutable Snapshot in Canvas (`runSwarm`) und Headless (`executeSwarmServer`), inkl. „selected published snapshot, not draft“ und Nested-Child. Neue Drift-Tests in `tests/unit/caseGatewayIntent.test.ts`. Alle gezielten Case-/Gateway-Suiten sind grün. Browser-E2E auf der Instanz steht noch aus (Deployment).

## DEPLOYED (Live-DB, nur Migrationen)
- Ledger `agentswarms`: `20261016030000` (`34ae966b…2b35`), `20261016040000` (`4e387ed5…25cd`), `20261016050000` (`cd705d43…1767`). Alle drei sind idempotent und anker-geprüft.
- Rollback-Funktionskörper (nur Funktionsdefinitionen, keine Daten) in `~/.local/share/axtn/native/backups-owner-policy-20261016/`: `axtn_case_execution.before-gateway.sql`, `…before-identity-parity.sql`, `…before-gateway-budget.sql`.
- Es wurde kein Dump exportiert, daher bestand keine Verschlüsselungspflicht für `AXTN_BACKUP_RECIPIENT`.
- Wirkung vor App-Deployment: Der noch alte Live-Code liest weiter dieselben Felder. Für nicht-personale Knoten gilt unverändert der bestehende Vertrag.
- **App-Code (chat.ts, credentials, caseExecution) ist NICHT deployt**: Registry-Publish braucht `write:package` (Konto `axtn-codex`). Das ist die Credentialgrenze, ich habe weder Token noch Grants erweitert und kein lokales Image am Provenienzvertrag (D06) vorbei releast.

## Gateway-Key (kontrolliert, kein Secret gelesen)
- Natives Gesundheits-Metadatum des `llm_gateway` (`5936c3dc…`, Owner x@alexation.com, `route_all=false`): `health_status=ok`, „Gateway authenticated at https://llm-server.llmhub.t-systems.net/v2/models (10 models routed)“, geprüft 2026-10-16T08:45Z. **Es liegt aktuell KEIN Gateway-401 vor.** Eine erneute LLMHub-Key-Ausstellung ist nicht erforderlich.
- Bounded Inferenz über den alten Live-Code, Non-Case, `POST /api/chat` mit Owner-JWT, `provider=vllm`, `routeThroughGateway=true` (`required`, fail-closed), Prompt „antworte exakt `{"ok":true}`“. Die Ausgabe ist nur Status/Metadaten:

| Modell-ID | HTTP | ms | JSON exakt |
|---|---|---|---|
| `gpt-oss-120b` | 200 | ~1.2 s | ja |
| `Qwen3.6-35B-A3B-FP8` | 200 | ~2.2 s | ja |
| `Qwen3.8-27B-FP8` | 200 | ~1.3 s | nein („pong“) |
| `Mistral-Small-4-119B-2603` | 200 | ~0.3 s | ja |

- Discovery: Eine ungültige Modell-ID liefert 502 mit der Upstream-Modellliste. Sichtbare IDs u. a.: `GLM-5.2`, `GLM-5.3-Flash`, `Mistral-Small-4-119B-2603`, `NVIDIA-Nemotron-3-Super-120B-A12B-FP8`, `Qwen3.6-35B-A3B-FP8`, `Qwen3.8-27B-FP8`, `gpt-o…` (gekürzt). Das sind Beobachtungen, keine Modellzuweisung.
- Einschränkung: Dass der Aufruf tatsächlich den Gateway- und nicht den direkten vLLM-Pfad nahm, ist durch `required:true` und den Gateway-Health-Beleg nahegelegt. Eine Pfad-Attribution im Gateway-Log liegt nicht vor. Der Nutzer hat den Key zusätzlich unter vLLM eingegeben, sodass auch der direkte Pfad wieder funktionieren könnte.

## Corporate-E2E (Abnahme D)
**Nicht erbracht.** Voraussetzung ist ein deploytes App-Image mit diesem Code. Danach: gezielte neue Swarm-Version über den nativen Publish-Lifecycle mit Agent-Opt-ins (`route_all=false` bleibt), Case-Lauf mit TEST_SIMULATION-Approval, PR-Head-Readback, Duplicate-Check. Der OpenAI-Fixture-Run zählt nicht.

## Offene menschliche Schritte
1. `axtn-codex` in Gitea (Settings → Applications) ein Token mit Scope `write:package` ausstellen und im geschützten Credential-Pfad `/home/alex/.config/axtn-codex/git-http-credential` ablegen. Das bisher im lokalen Tool-Log sichtbar gewesene Token ist weiterhin **nicht widerrufen/rotiert**. Rotation ist offen (kein Mechanismus hier ausgeführt).
2. `AXTN_BACKUP_RECIPIENT` (age-Public-Key) für verschlüsselte Backups bei der nächsten geschützten Live-Operation (z. B. App-Release mit Migrationen).
3. Optional/organisatorisch: Merge der PRs nach den Review-Regeln.

## Hinweise
- Randfall: Gateway-Knoten in einem Personal-Case ohne Assignee scheitert bei der Erst-Bindung weiterhin an `PERSONAL_CONNECTION_REQUIRED`, weil die Attempt-Bindung nach Case-Modus erzeugt wird. Er ist weder getestet noch bewusst geändert, und eine Lockerung braucht eine eigene Entscheidung.
- Migration `20261009113000` (grant-only) bleibt live nicht angewendet. Die neuen Migrationen sind auf ihr getestet kompatibel.
