# AXTN-LLMHUB-NATIVE-AGENT-GATEWAY-20261016 – Statusbericht

Basis: `32481214b485a60761f60674d2c27308d48ad31e`. Branch `work/AXTN-LLMHUB-NATIVE-AGENT-GATEWAY-20261016`.

**Gesamtstatus: TEILWEISE. Corporate-E2E (Abnahme D) ist NICHT erbracht. Der Auftrag ist nicht abgeschlossen.**

## IMPLEMENTED (Code, im Branch)
- `src/routes/api/chat.ts`
  - Die beiden Sperren `caseExecution && routeThroughGateway` und `caseExecution && gatewayOverride` entfernt.
  - Gateway-Intent bei Case-Läufen kommt aus dem persistierten Run-Snapshot. Ein abweichender Body-Claim wird mit `ROUTING_DECISION_REQUIRED` abgelehnt. Fehlendes Opt-in ist `false`.
  - Gateway wird mit dem Policy-User aufgelöst (`required: true`, fail-closed). Kein Fallback auf vLLM/OpenAI.
- `src/axtn/workbenches/cases/caseExecution.server.ts`: `nodeGatewayIntent(snapshot, nodeId)`, `gatewayIntent` im Resolve-Ergebnis. Das Route-Evidence-Schema erlaubt `transport` und `gateway_integration_id`.
- `src/utils/providers/credentials.server.ts`
  - Das `credentialContext`+Gateway-Verbot ist aufgehoben.
  - Ein Case-Node mit Opt-in nutzt das Gateway und lädt keine direkte Case-Credential.
  - Ein Case-Node ohne Opt-in behält seine gebundene Credential.
- Migration `supabase/migrations/20261016030000_case_execution_gateway_transport.sql`
  - Ändert nur `axtn_case_execution` per anchor-geprüftem Rewrite der installierten Definition. Sie ist idempotent und bricht ab, wenn die Anker nicht genau einmal vorkommen.
  - Gateway-Node: `axtn_case_model_allowed` (Modell-IAM) bleibt. Statt direkter Credential-Kandidaten wird genau eine aktive `llm_gateway`-Integration des Policy-Users verlangt, sonst `SYSTEM_INTEGRATION_UNAVAILABLE` oder `…_AMBIGUOUS`. Die Operation `credential` wird für Gateway-Nodes abgelehnt.
  - Account, Kunde und Kostenträger sind keine Freigabequelle.
- Die ChatGPT-Personal-Account-Ausnahme und die Non-Case-Pfade sind unverändert.

## TESTED
- Neu und angepasst: `tests/unit/caseGatewayIntent.test.ts`, `tests/unit/caseExecutionCredentials.test.ts`. Sie decken ab: Agent mit/ohne Opt-in, Case-Gateway ohne Direct-Credential, fail-closed ohne Gateway, gebundene Credential ohne Opt-in, malformed/fehlender Snapshot-Intent.
- Gezielte Suites (Case-Execution, Gateway-Routing, SwarmGatewayExecution): 66/66 grün.
- Volllauf vitest: 10090 grün, 2 rot. Rot sind `docsUseCases` (docs/IAM.md) und `documentRecoveryInventory`. Beide berühren die Änderung nicht. Ein Vergleichslauf auf der Basis wurde nicht gefahren, die Zuordnung als vorbestehend ist daher nicht bewiesen.
- `tsc` meldet nur die bekannten, fehlende-`routeTree.gen`-bedingten Fehler. Für die geänderten Dateien gibt es keine anderen Fehler.
- Migration im isolierten Clone (Dump der PROD-DB) zweimal angewendet, idempotent. **Nicht getestet:** SQL-Verhaltenstests mit gebundenem Case-Run (Negativfälle C auf DB-Ebene: fremder Gateway-Owner, mehrdeutig, inaktiv). Sie sind offen.
- Nicht ausgeführt: lint, `test:integration`, Browser-/Canvas-Parität (Abnahme B).

## DEPLOYED
- Migration `20261016030000` ist live angewendet (sha256 `34ae966b752fbb07bd4718e50efdc32af17f4a4c2a46f2022327c64315282b35`, Host-Ledger-Eintrag). Rollback-Funktionskörper: `~/.local/share/axtn/native/backups-owner-policy-20261016/axtn_case_execution.before-gateway.sql`. Ohne neue App-Revision hat sie keine Wirkung auf bestehende Nodes ohne Opt-in. Migrationen `…000000/010000/020000` bleiben kompatibel.
- **App-Code ist NICHT deployt.** Es gibt kein publiziertes Image: Registry-Upload scheitert mit 401 `reqPackageAccess` (`axtn-codex` fehlt `write:package`). D06 wurde nicht aufgeweicht.
- Nicht ausgeführt: neue Swarm-Version mit gezielten Agent-Opt-ins, Gateway-Discovery, Rollenmessung.

## Corporate-E2E (Abnahme D)
**Nicht erbracht.** Voraussetzungen fehlen:
1. App-Image mit diesem Code (Registry-Scope).
2. Gültiger LLMHub-Schlüssel. Der Key der direkten vLLM-Integration war am 16.10. deaktiviert (Upstream 401). Der Key des Gateway `5936c3dc…` ist ungeprüft, da Schlüssel nie gelesen werden.
Der OpenAI-Fixture-Run zählt nicht als Gateway-Nachweis.

## Offene menschliche Schritte
- Gitea-Token für `axtn-codex` mit `write:package` (Settings → Applications), Token rotieren.
- LLMHub-Key-Reaktivierung/Neuausstellung durch den Owner in der UI.
- Age-Public-Key für `AXTN_BACKUP_RECIPIENT`.
- Danach: Release, Snapshot-Publikation mit Opt-in, Corporate-Case-Lauf mit TEST_SIMULATION-Approval, DB-Negativtests (C).

## Hinweis
Die Docs `docs/architecture/axtn-case-execution-routing/ARCHITECTURE.md`, `docs/llmhub-prod-lineage-acceptance-20261009.md` und `docs/engineering/02-agent-runtime.md` beschreiben noch das alte Verbot und sind noch nicht aktualisiert. Die Migration `20261009113000` (grant-only) bleibt live nicht angewendet.
