# AXTN Development Swarm — Zwischenstand

## Fortsetzung nach 5bc92e10 — exakte Auftragsrefs und case-gebundene Kandidatenarbeit

Stand: 17.10.2026, 19:20 UTC

### Account-Detail-Pass nach dem 19:10-Stand

Der bestehende native Development Swarm `ad06e17d-460b-4b65-946a-9b5d78c6fd02` wurde auf der publizierten Version `7fcb9f0c-3f76-445b-9507-684d453f060b` case-gebunden ausgeführt. Run `04319e38-b1c3-5ba9-a5b5-389fa0984e5a` meldete 14/14 erfolgreiche Schritte. Der Builder war auf `src/routes/_authenticated/accounts_.$accountId.tsx` begrenzt; die vorhandenen Backend-, Server-Function- und Dataset-Contract-Reads sowie alle drei unveränderten Auftrags-Reads waren Teil des Graphen.

Der native Gitea-MCP-Readback auf Branch `work/AXTN-SUPACASE-USABILITY-0001` bestätigt für diese Route `last_commit_sha=1115d435d5ce7779ec6c357a1e5288e5a0519007`, `sha=9f1dd2c3e3b31cc37255e4247f4bf4204a93d7fe` und 22,190 Bytes. Die normale Owner-authentifizierte Case-Operation aktualisierte die externe Referenz von `gitea://aXtn/axtn-agentswarms/work/AXTN-SUPACASE-USABILITY-0001@6cc875…` (Version 4) auf `…@1115d435…` (Version 5); die Antwort bestätigte Case `913dbf33-9891-4712-b945-aab9a5cfe5b9` und die neue Referenz. Das belegt die native Candidate-Materialisierung und Case-Bindung, nicht die fachliche Abnahme.

Ein zusätzlicher nativer Read auf Candidate-Ref `1115d435…` fand die bestehende Route `src/routes/_authenticated/contacts_.$contactId.tsx` mit Datei-Commit `610cc69c6c7d450ed7f0366eacb24cae043d91ff`, Blob `08589b049ec8117f0ff1ea1b22419c7d23f231b5` (9,020 Bytes). Dieser Read hat nichts geschrieben. Snapshot `7fcb9f0c…` bleibt auf Produkt-Ref `6cc875…` und dem Account-Detail-Writer konfiguriert: **nicht erneut ausführen**, bevor Produkt-Reads/SHA-Extractor/Writer auf den bestätigten Candidate `1115d435…` und ein neues passendes Ziel aktualisiert und publiziert sind.

Weiterhin nicht belegt sind Typecheck, Tests, Build, CI, drei unabhängige Reviews auf demselben vollständigen finalen SHA, native Approval oder Produkt-PR. Der Kandidat bleibt **PARTIAL / UNVERIFIED**; der separate content-excluded Gitea-Actions-Deployment-/Runner-Blocker bleibt offen. Kein Merge, Release oder Produktdeploy erfolgte; Copilot CLI hat keinen Produktcode geschrieben.

Der aktuelle Handoff-Commit `5bc92e1023eda94a585e5670250bd5585d19bcef` wurde aus dem kanonischen Gitea-Branch gelesen. Architektur-PR #8 bleibt offen und auf `14b51ce781eeecfe766f6fe8dd83c0b393b2c2c1`. Die drei vollständigen Auftragsdateien wurden über den bestehenden nativen Gitea-MCP-`fetch` mit `owner=aXtn`, `repository=axtn-architecture`, `target=file` und diesem expliziten Commit-`ref` gelesen:

| Pfad | Git-Blob-SHA | Last file commit |
|---|---|---|
| `work-orders/AXTN-SUPACASE-USABILITY-0001.md` | `e7b4d81cccb9244210020edda41b16da01d099cf` | `e77efaf7862964616eb937c2987670bbf10e892d` |
| `work-orders/AXTN-SUPACASE-USABILITY-0001-SWARM.md` | `6488f5fa774a71498f1eecc9152289b3f79dc14b` | `15fd6758614ed641f3122424f1c205e3e39c81c4` |
| `work-orders/AXTN-SUPACASE-USABILITY-0001-TEST.md` | `1cb06ac62b73c82f653b113f6041dcfe8c334085` | `14b51ce781eeecfe766f6fe8dd83c0b393b2c2c1` |

Der publizierte Swarm `ad06e17d-460b-4b65-946a-9b5d78c6fd02` wurde nativ gespeichert und veröffentlicht. Version `0d7d7cfc-cb69-46d2-8050-a1e004a72014` enthält drei getrennte Architektur-Datei-Read-Nodes mit genau diesen Pfaden und dem festen Ref `14b51ce…`; die Produkt-Code-Reads wurden auf den unveränderlichen Ausgangskandidaten `0f07f92f045441488c3367b3cbac38bf38040da1` gepinnt. Der ursprüngliche Provider `vllm`, das Modell `GLM-5.3-Flash` und die Gateway-/Agentkonfiguration blieben erhalten.

Auf dem bestehenden Master-Data-Case `913dbf33-9891-4712-b945-aab9a5cfe5b9` führte Run `a40b53f4-dfc7-5799-abe3-0e9c3414c706` alle 12 Graph-Schritte ohne Fehler aus, einschließlich der drei nativen Auftrags-Reads. Der Swarm ergänzte Account-/Contact-Backendfelder im bestehenden `accountManagement.server.ts` und materialisierte Kandidat `d0a727680fda8478cd6f97eea45337d475a7b17b`, Blob `90ef038b311816037b959b1a48102ab83790fb92`.

Für die Folgearbeit wurde der native Graph auf Version `b8b53bf6-64e1-47f1-b55d-e1dc470648d0` erweitert, um `caseManagement.functions.ts` zusammen mit der Backenddatei und den unveränderten Auftragsreads zu laden. Der erste Wrapper-Run `e1139c5e-5666-5e08-af5c-d99aff62aa7b` ließ Builder und MCP-Nodes erfolgreich laufen, aber der `upsert_file`-Readback enthielt einen Fehler: der vorhandene SHA-Extractor gab `NOT_FOUND` für die neu gewählte Wrapperdatei aus, obwohl der native Datei-Read erfolgreich war. Das war ein veralteter Extractor-Prompt, keine Gitea-Scope-/Policy-Ablehnung. Es wurde kein Wrapper-Commit geschrieben. Der Extractor wurde auf das tatsächliche `case_management_functions_source`-Fetch-Ergebnis umgestellt und Version `df93eb07-1acb-4222-a643-4d714d8348b6` nativ veröffentlicht.

Der erneute Case-Run `ee19c2b3-c666-5cf3-a367-bb798a46264c` lief mit 13/13 erfolgreichen Schritten und 0 Fehlern. Er las erneut alle drei Auftragsdateien über MCP, extrahierte den Wrapper-Blob-SHA und materialisierte `caseManagement.functions.ts` über den nativen Gitea-MCP-Writer. Readback auf `work/AXTN-SUPACASE-USABILITY-0001` bestätigt Datei-Commit `6cc87508886bca0fdc6160fdc8ac2580845dba8e`, Blob `82723aa0313f239241a0e39781a14166f02d5119`; die Backenddatei bleibt auf Commit `d0a727…`, Blob `90ef038b…`. Der bestehende Case referenziert den aktuellen Produktkandidaten `6cc875…` mit `external_reference_version=4`.

**Stand / Grenzen:** Kandidat `6cc875…` enthält Swarm-Arbeit an zwei Dateien und ist weiterhin nur ein partieller, unverified Zwischenstand. Die Detail-/Listen-UI, weitere Case-Workbench-Arbeit, echte Typecheck-/Test-/Build-Receipts, drei unabhängige Reviews auf demselben vollständigen Candidate-SHA, Approval und Produkt-PR fehlen. Kein Merge, Release oder Deploy erfolgte. Der nachfolgende Gitea-Actions-Operatorblocker aus dem vorigen Bericht bleibt separat bestehen: geschützter Compose-Input weiterhin content-excluded, kein Runner und kein echter CI-Lauf. Diese Sperre ist kein Grund, den zulässigen Candidate-Workstream zu stoppen.

Der aktuell veröffentlichte Graph `df93eb07…` bleibt auf Produkt-Ref `d0a727…` und als Writer-Target `caseManagement.functions.ts` eingestellt. Nicht erneut ausführen: vor weiterer Candidate-Arbeit zuerst alle relevanten Produkt-Reads auf `6cc875…` aktualisieren und das nächste erlaubte Ziel samt passendem SHA-Readback nativ konfigurieren.

Stand: 17.10.2026, 18:20 UTC

Tracking: `aXtn/aXtn-agentswarms#7`

Handoff: `work/AXTN-NATIVE-SWARM-COMPLETION-20261016@3e575327261d6489ed5289709faf9e26207ae4b4`

Status: **PARTIAL / OPERATOR_ACTION_REQUIRED**. Owner-Auth und native Save/Publish funktionieren wieder. Der Swarm hat im bestehenden Master-Data-Case einen Kandidaten erstellt und unabhängig geprüft; sein aktueller Branch-Head ist `0f07f92f045441488c3367b3cbac38bf38040da1`. Der geschützte Gitea-Compose-Deploy ist nicht ausgeführt, es läuft kein Runner, und es gibt daher keinen CI-PASS. Der Kandidat ist nur eine Datei und erfüllt weder den vollständigen PR-#8-Auftrag noch dessen drei Reviews auf demselben finalen SHA, native Approval oder offenen Produkt-PR. Kein Produktcode wurde durch Copilot CLI geschrieben.

## Fortsetzung nach 3e575327 — 17.10.2026, 18:20 UTC

- Regulärer Owner-Login, der bestehende Case-Zugriff und der native Builder-Publish wurden wiederverwendet. Der letzte Builder-Snapshot ist `b7e7023a-f1ea-415c-8ddd-0b46d5a6db1d` (9 Nodes, 10 Edges); der vorübergehende Review-only-Snapshot ist nicht mehr aktiv.
- Case-Run `a99f03d5-f951-5575-aa5e-a224923329fb` lief an Case `913dbf33-9891-4712-b945-aab9a5cfe5b9` mit 9/9 erfolgreichen Schritten und 0 Fehlern. Der Swarm commitete die Metadatenkorrektur als `37090588723cac30fbf343a189fa759f844f9116`.
- Der unabhängige Review-Run `0d348b4d-69ad-5090-a405-8886cc03b916` lief mit 7/7 erfolgreichen Schritten. Er bestätigte `parent_account_id` in der Metadatenliste für neue und bestehende owner-eigene Account-Datasets; die zuvor vermuteten fehlenden RLS-Policies sind durch `supabase/migrations/20260420170100_f0858a49-b3fb-4036-bf16-5fcdd1707107.sql` widerlegt.
- Der Swarm setzte den Review-Fund weiter um: Case-Run `bee23003-d0d8-5acb-a659-f942600cd9b1` lief mit 9/9 erfolgreichen Schritten und 0 Fehlern und erzeugte Commit `0f07f92f045441488c3367b3cbac38bf38040da1`. Die Änderung beschränkt das Metadaten-UPDATE zusätzlich auf `user_id` und meldet ein UPDATE ohne zurückgegebene Zeile explizit.
- Gitea-MCP-Readback bestätigt auf `work/AXTN-SUPACASE-USABILITY-0001` den Datei-Commit `0f07f92f045441488c3367b3cbac38bf38040da1` und Blob `42c8dcbb2a77b124c01f11c71eb5599a24187274` für `src/axtn/workbenches/cases/accountManagement.server.ts`. Die native Case-Referenz wurde über die normale `/api/cases/work`-Owner-Operation auf diese SHA aktualisiert; `external_reference_version` wechselte von 1 auf 2 und wurde zurückgelesen.
- Der finale unabhängige Review-Run `e2bbd0c3-8cdc-5fdc-a180-90fe778156cf` lief mit 7/7 erfolgreichen Schritten. Er meldet keine blockierenden oder größeren Findings. Übrig gebliebene LOW/INFO-Hinweise betreffen ein vorbestehendes Verhalten bei ungültiger `columns`-Form sowie einen möglichen konkurrierenden Delete; keine der Aussagen ist ein Build-/Testnachweis.
- Drei Review-Runs liegen über aufeinanderfolgende Kandidatenstände vor; nur `e2bbd0c3…` prüfte den finalen SHA `0f07f92…`. Es wurden keine Tests, Typecheck, Build, Gitea-Actions-Runs, Approval oder PR #8 auf diesem Kandidaten ausgeführt. Der finale Kandidat bleibt **UNVERIFIED** und das Gesamtziel offen.

## Konkrete Betreiberübergabe — Gitea Actions bereitstellen

Die Konfigurationsmetadaten wurden geprüft, ohne den ausgeschlossenen Deployment-Input zu lesen oder zu rendern:

| Feld | Verifizierter Stand |
|---|---|
| Repository / Zielbranch | `aXtn/aXtn-git`, `work/AXTN-GITEA-CI-RUNNER-0001` |
| Bereitstellungscommit | `b79e78bb3e82d0b4d97560c5913e27afc0746cb3` |
| Exakte Änderung | `compose.yaml` setzt für `gitea` `GITEA__actions__ENABLED: "true"`; `README.md` dokumentiert den separat verwalteten Runner |
| Rollback-Parent | `dfbb45ad6ee546e4b84cea35a106a0bce20c7070`; der Compose-Diff enthält dort die Actions-Variable nicht |
| Aktiver Compose-Projektpfad | Projekt `axtn-git`, Project Directory `/home/alex/aXtn-git`; laufender Checkout `0094812b2ee5eca13fffcd300659a35d6e2914e5` |
| Deployment-Compose-Datei | `/home/alex/aXtn-git-ci-runner-worktree/compose.yaml`, sauberer Checkout auf `b79e78bb…` |
| Live-Zustand | `axtn-gitea` (`gitea/gitea:1.27.3`) ist `running|healthy`; die Compose-Umgebungsvariable ist noch nicht gesetzt |
| Netzwerke vor Recreate | `axtn-native-api`, `axtn_git_ci` und `axtn_git_internal` hängen aktuell an `axtn-gitea`; die ersten beiden sind manuelle Bindings und können beim Recreate verloren gehen |
| Runner | Kein Runner-Container in `docker ps`; Actions-Konfiguration allein ist kein CI-Nachweis |

**Eine nötige Betreiberaktion:** den folgenden Befehl mit den bestehenden, unveränderten und geschützten Compose-Inputs über den genehmigten Hostweg ausführen. Der `.env`-Inhalt wird nicht angefordert oder ausgegeben:

```sh
sudo docker compose \
  --project-name axtn-git \
  --project-directory /home/alex/aXtn-git \
  --env-file /home/alex/aXtn-git/.env \
  --file /home/alex/aXtn-git-ci-runner-worktree/compose.yaml \
  up -d --no-deps --force-recreate --wait --wait-timeout 180 gitea

for network in axtn-native-api axtn_git_ci; do
  if ! sudo docker network inspect "$network" \
    --format '{{range $id, $endpoint := .Containers}}{{println $endpoint.Name}}{{end}}' |
    grep -Fxq axtn-gitea; then
    sudo docker network connect --alias axtn-gitea "$network" axtn-gitea
  fi
done

test "$(sudo docker inspect --format '{{.State.Status}}|{{.State.Health.Status}}' axtn-gitea)" = "running|healthy"
sudo docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' axtn-gitea |
  awk -F= '$1 == "GITEA__actions__ENABLED" && $2 == "true" { found=1 } END { if (!found) exit 1; print "Actions setting enabled" }'
for network in axtn-native-api axtn_git_ci; do
  sudo docker network inspect "$network" \
    --format '{{range $id, $endpoint := .Containers}}{{println $endpoint.Name}}{{end}}' |
    grep -Fxq axtn-gitea
done
```

**Exakter Rollback** auf `dfbb45ad…`; er liest nur die versionierte Compose-Datei und verwendet dieselben unveränderten geschützten Inputs. Danach werden die zuvor beobachteten manuellen Netze idempotent wieder angebunden und Health geprüft:

```sh
rollback_file="$(mktemp /tmp/axtn-gitea-compose-rollback.XXXXXX.yaml)"
trap 'rm -f "$rollback_file"' EXIT
git -C /home/alex/aXtn-git-ci-runner-worktree \
  show dfbb45ad6ee546e4b84cea35a106a0bce20c7070:compose.yaml > "$rollback_file"
sudo docker compose \
  --project-name axtn-git \
  --project-directory /home/alex/aXtn-git \
  --env-file /home/alex/aXtn-git/.env \
  --file "$rollback_file" \
  up -d --no-deps --force-recreate --wait --wait-timeout 180 gitea
for network in axtn-native-api axtn_git_ci; do
  if ! sudo docker network inspect "$network" \
    --format '{{range $id, $endpoint := .Containers}}{{println $endpoint.Name}}{{end}}' |
    grep -Fxq axtn-gitea; then
    sudo docker network connect --alias axtn-gitea "$network" axtn-gitea
  fi
done
test "$(sudo docker inspect --format '{{.State.Status}}|{{.State.Health.Status}}' axtn-gitea)" = "running|healthy"
```

Diese Übergabe schaltet nur die Gitea-Compose-Konfiguration um. Sie registriert keinen Runner. Nach bestätigtem Deploy kann die bereits versionierte offizielle repo-scoped Runner-Konfiguration aus `aXtn/aXtn-host@cad8500a00995c98707045b04bc337fd351a96aa` regulär fortgesetzt werden; bis zu echtem Workflow/Job-Readback bleibt CI offen. Die uncommitteten Löschungen im aktiven `/home/alex/aXtn-git`-Checkout (`mirror-hooks/axtn-github-mirror` und `scripts/install-github-push-mirror-hooks.sh`) wurden nicht verändert.

## Fortsetzung nach a10b4e98 — 17.10.2026, 16:30 UTC

Der Case-Chat-Fix `f3bd040cfe2b3250e65a65fa58fde06f63feeebc` wurde auf `fix/AXTN-CASE-CHAT-PHASE-DIAGNOSTICS-20261017` gepusht und über den bestehenden Host-Konvergenzweg deployed. Der laufende AgentSwarms-Container meldete Revision `f3bd040c…`, war healthy und `/api/health` lieferte HTTP 200. Die gezielten Case-Credential-/Binding-/Diagnostiktests, Typecheck und Produktionsbuild waren erfolgreich. Ein neuer case-gebundener Swarm-Lauf fand danach nicht statt, weil diesem CLI keine wiederverwendbare Owner-authentifizierte Sitzung zur Verfügung stand; es wurde kein neuer Login versucht und kein Credential angefordert.

Die Standard-CI-/Runner-Konfiguration ist in drei getrennten Branches committet und gepusht:

| Repository / Branch | Commit | Inhalt |
|---|---|---|
| `aXtn/aXtn-git`, `work/AXTN-GITEA-CI-RUNNER-0001` | `b79e78bb3e82d0b4d97560c5913e27afc0746cb3` | Gitea Actions in der Compose-Quelle aktivieren; README beschreibt Runner-/Netzwerkgrenze. |
| `aXtn/aXtn-host`, `work/AXTN-DEVELOPMENT-SWARM-NATIVE-0002` | `cad8500a00995c98707045b04bc337fd351a96aa` | Offiziellen Runner digest-pinnen, Token nur über geschützte Datei zuführen, Job-Netzwerk isolieren und native Compose-/Bind-Befehle ergänzen. |
| `aXtn/aXtn-agentswarms`, `fix/AXTN-CASE-CHAT-PHASE-DIAGNOSTICS-20261017` | `0a3cbf821dd9425f76462b8ed5986f5da0d49b5b` | Gitea-Workflow für `npm ci` und `npm run check`, mit `contents: read` und ohne persistierte Checkout-Credentials. |

Alle drei Remote-Refs wurden zurückgelesen. Die gepinnte Runner-Binary akzeptiert die restriktive Konfiguration; der gepinnte Ubuntu-Job-Container enthält Node 24.19.0, npm 11.17.0 und Git 2.55.0. Der Host hat das separat gelabelte `axtn_git_ci`-Bridge angelegt und nur `axtn-gitea` angehängt. Kein Runner-Container, keine Registrierung und kein Runner-Token wurden angelegt; es fand noch kein echter Gitea-CI-Lauf statt.

Die `403`-Antwort des unauthentifizierten Gitea-API-Probes ist mit `REQUIRE_SIGNIN_VIEW` konsistent und kein Netzwerkausfall. Die Repo-Konfigurationsbranches ließen sich über den autorisierten SSH-Pfad pushen. Der für die reguläre Gitea-Compose-Bereitstellung benötigte geschützte Input wurde in diesem CLI jedoch durch die Organisations-Content-Exclusion gesperrt. Kein alternativer Leseweg, kein Compose-Deploy und keine Container-/Bundle-Inspektion wurde versucht. Die Änderung `GITEA__actions__ENABLED=true` ist folglich nur versioniert, nicht live; für die Bereitstellung muss ein autorisierter Betreiber den Gitea-Compose-Branch über den normalen genehmigten Pfad anwenden und Gitea mit den geschützten Inputs neu starten. Es werden keine Credentials im Chat benötigt.

Der lokale vollständige `npm run check` erreichte die Testphase nach erfolgreichem Typecheck, Lint und Dokumentationsprüfungen, meldete aber 10.044 bestandene Tests, 40 übersprungene und zwei fehlgeschlagene Assertions in `tests/unit/documentRecoveryInventory.test.ts`: der erwartete Router-Revisionseintrag `6c13432b` weicht vom Istwert `2bada0814fca2ac719518310cea2ce5113fd0a2c` ab; ein gespeicherter SHA-256 (`eccc9d08…`) weicht vom aktuellen Dateiinhalt (`5275332e…`) ab. Der separate Produktionsbuild war erfolgreich. Diese Abweichungen wurden nicht stillschweigend übersprungen oder durch CLI-Produktcode geändert; bis zur Korrektur gibt es keinen CI-PASS.

**Fortsetzung bleibt offen:** Nach autorisierter Gitea-Bereitstellung den Runner repo-scoped mit der offiziellen CLI in die geschützte Token-Datei registrieren, einen tatsächlichen Workflowlauf zurücklesen und den Case-gebundenen Swarm über eine regulär angemeldete Owner-Sitzung weiter ausführen. Produktkandidat, Reviews, native Approval und PR #8 bleiben ungeprüft bzw. ausstehend.

## Vorheriger Fortsetzungsstand — 17.10.2026, 14:14 UTC (historisch)

Der Owner-Login erfolgte regulär über den im Auftrag benannten geschützten Credentialweg. Passwort und Access-Token wurden weder ausgegeben noch in den Chat übertragen; die Auth-Sitzung wurde unmittelbar für native Owner-RLS-Reads, Save/Publish und Case-Start verwendet. Die ausgeschlossene `.env` wurde nicht geöffnet oder über andere Wege ausgewertet.

Der Development Swarm `ad06e17d-460b-4b65-946a-9b5d78c6fd02` wurde nativ gespeichert und publiziert. Draft und Published Readback stimmen mit Version `62afaa0b-429b-434e-935c-781edb19509d` überein. Der veröffentlichte Graph enthält sechs Nodes: Input, Builder, Output, zwei separate Gitea-MCP-Read-Nodes sowie eine begrenzte Upsert-Node. Die vorherige Version `256497c0-f577-4430-b91c-15dac21006ca` bleibt erhalten. Dieser fokussierte Builder-Graph ist nicht der vollständige Development Swarm mit allen Rollen.

Der Case-Run/Attempt `fce6cb5c-a58b-52e6-a1a8-0534cc08eed2` war an den bestehenden Master-Data-Case `913dbf33-9891-4712-b945-aab9a5cfe5b9` und die Published-Version gebunden. Native `swarm_run_steps` zeigen Input `success`, beide Gitea-MCP-Lese-Nodes `success`, danach Builder `error` mit Provider `vllm`, Modell `GLM-5.3-Flash`, Fehlercode `PROVIDER_UNAVAILABLE` (96 ms). Der Lauf endete mit `step_count=4`, `error_count=1`; die Upsert-Node wurde nicht ausgeführt.

Ein zweiter nativer Case-Run/Attempt `8095f97f-c5dc-598a-af2c-93cc10d616f9` auf derselben veröffentlichten Version und Case-Bindung endete ebenso mit `error`, `step_count=4`, `error_count=1`, Builder `PROVIDER_UNAVAILABLE` (99 ms). Die Eingaben der beiden erfolgreichen MCP-Lese-Nodes waren 28,488 und 38,074 Bytes; der Builder-Eingabe-Prompt war 70,220 Bytes. Der Case-Log gibt nur den bereinigten Code aus und es wurde kein `execution_traces`-Datensatz für den Aufruf persistiert, deshalb ist die konkrete Ausnahme im aktuellen Evidence-Pfad nicht sichtbar. Owner-authentifizierte native `/api/chat`-Proben mit demselben vLLM-Modell antworteten sowohl bei `maxTokens=8192` als auch mit 67,200 Byte Eingabe HTTP 200; die acht Provider-Frames vor dem App-generierten `cost`-Event entsprachen dem Case-Framevertrag. Diese Proben schließen allgemeine Provider-/Promptgrößenprobleme nicht vollständig aus, belegen aber nicht den Case-spezifischen Credentialpfad.

Beide Case-Bindungen weisen `SYSTEM_INTEGRATION` / `CASE_SYSTEM_POLICY` mit Route `vllm/GLM-5.3-Flash` aus; die Owner-vLLM-Integration ist aktiv und es gibt genau einen aktiven Owner-vLLM-Integrationsdatensatz sowie keinen aktiven Owner-vLLM-Datensatz in `provider_credentials`. Die persistierten Case-`execution_bindings` belegen, dass die native `resolve`-Operation für den Builder die Route erfolgreich gebunden hat. Der Runtime-Log nennt `chat route error` statt des separaten `Provider vllm error`-Pfads, was den Fehler vor dem Provider-Stream eingrenzt. Die genaue fehlschlagende Route-Phase ist mangels `execution_traces` weiterhin nicht feststellbar. Der Remote-Head von `work/AXTN-SUPACASE-USABILITY-0001` wurde nach dem zweiten Run via `git ls-remote` gelesen und steht weiterhin auf `58869c783b076e7cada3232a1f556bc84c019a49`. Die Runs erzeugten keinen Candidate-Write. Die Produktkorrektur bleibt ausschließlich Aufgabe des Swarms.

Der installierte Gitea-Container läuft mit `gitea/gitea:1.27.3`. Auf dem Host ist kein `act_runner`-Executable, aktiver Runner-Container oder Runner-Systemdienst vorhanden; die direkte Gitea-API ist weiterhin nicht erreichbar (403 am vorgesehenen API-Endpunkt). Eine offizielle Runner-Registrierung konnte daher nicht geprüft oder vorgenommen werden. Es wurden keine Runner-Credentials angefordert oder erzeugt.

**Nächster Schritt:** den Vor-Stream-Fehler in der nativen Case-Chat-Auflösung über einen sicheren Diagnosekanal mit Run-/Trace-Korrelation weiter eingrenzen, ohne rohe Exceptions, Credentials oder Case-Daten offenzulegen; keine weiteren identischen Runs ohne konkreten Befund. Den offiziellen Gitea-Runner erst über den autorisierten Gitea-Administrationsweg registrieren und isoliert betreiben. Der Candidate bleibt **UNVERIFIED**; sein Typecheck hatte 62 Fehler im falschen physischen Accounts-/Contacts-Schema. Kein PASS, Review, CI, Approval oder Produkt-PR ist belegt.

## Kandidat 58869c783b076e7cada3232a1f556bc84c019a49

| Feld | Verifizierter Stand |
|---|---|
| Repository / Branch | `aXtn/axtn-agentswarms`, `work/AXTN-SUPACASE-USABILITY-0001` |
| Base / Kandidat | `ed66570a9e1139f1e2e9cb145a2f3a5117265a3e` → `58869c783b076e7cada3232a1f556bc84c019a49` |
| Herkunft | Acht Commits seit der Base; Git-Autor ist jeweils `aXtn Gitea MCP`. Der ergänzende UI-Lauf `021afe9c-a4bc-4388-ac37-bbe15286c0b3` war ungebunden. Eine durchgängige case-gebundene Swarm-Urheberschaft ist damit nicht belegt. |
| Geänderte Dateien | `src/axtn/workbenches/cases/accountManagement.server.ts`, `caseContract.ts`, `caseManagement.functions.ts`; `src/routes/_authenticated/accounts.tsx`, `accounts_.$accountId.tsx`, `contacts.tsx`, `contacts_.$contactId.tsx`; `tests/unit/supacaseUsabilityAcceptance.test.ts` |
| Typecheck | `npm run typecheck` auf exakt SHA `58869c…`: **FAILED, 62 TypeScript-Fehler**, alle im neuen `accountManagement.server.ts`. Der Code fragt physische `accounts`/`contacts`-Tabellen ab, während das vorhandene Case-Modell generische `axtn_accounts`/`axtn_contacts`-Datensätze über `user_data_tables`/`user_data_rows` verwendet. |
| Tests / CI / Review | Die synthetischen Tests wurden nicht als Abnahme ausgegeben; Tests und Gitea-CI sind nicht ausgeführt. Kein vollständiger unabhängiger Review, keine Approval und kein Produkt-PR. |
| Aktuelle Base-Einordnung | Gitea-`main` wurde frisch als `d87a155626d6564416b590bc0e0efb7e8f75436e` gelesen. Die Kompatibilität des älteren Kandidaten-Bases mit `main` ist noch nicht bestätigt. |

Der Route-Generator änderte beim Typecheck zwei `createFileRoute`-IDs. Beide Änderungen wurden auf den Ausgangsinhalt zurückgesetzt; der geprüfte lokale Candidate-Checkout ist wieder tracked-clean und steht weiterhin exakt auf `58869c…`.

## Native Bedienung und Case-Zuordnung — Stand 13:14 UTC (historisch; durch obigen Update ersetzt)

| Fähigkeit | Mechanismus / Konfiguration | Readback / Ergebnis |
|---|---|---|
| Anmeldung | Regulärer Supabase-Auth-Passwort-Grant mit dem bereits konfigurierten Owner-Zugang; kein Passwort-/MFA-Reset und keine Verwendung eines Service-Role- oder `INTERNAL_RUN_SECRET`-Zugangs. | Im vorherigen CLI-Durchlauf war die Owner-Anmeldung erfolgreich. Diese kurzlebige Sitzung wurde nicht in die Fortsetzung übernommen. Der erneute Grant mit den aktuell im laufenden App-Container konfigurierten Zugangsdaten antwortete HTTP 400 `invalid_credentials`; die konfigurierte `VITE_ADMIN_EMAIL` ist keine abweichende Login-Identität. In dieser Fortsetzung liegt deshalb kein verwendbares Owner-Bearer vor. |
| Case-Administration | Bestehender nativer Endpunkt `/api/cases/work`, Operation `external_references`; owner-authentifiziert, erwartete Referenzversionen und idempotente Transition-Keys. | Kandidatenreferenz `gitea://aXtn/axtn-agentswarms/work/AXTN-SUPACASE-USABILITY-0001@58869c783b076e7cada3232a1f556bc84c019a49` auf Parent `85a1d829-39ac-49bd-9047-163ab52d427b`, Graph-Child `43d22cf1-8767-40ef-b682-785607e6d724`, Produkt-Parent `ad8690f3-ecb3-4db1-a5e9-44a9752de2d2` und dessen vier bestehenden Arbeitspaketen `913dbf33-9891-4712-b945-aab9a5cfe5b9`, `b1be1c70-fba1-4ebb-be6d-2bf6640d0d79`, `27617016-6cdf-4e2c-b063-2e970e4fc0fb`, `a3c8feda-9953-44c8-985c-81b58b47854a` zurückgelesen. Es wurden keine Cases neu angelegt und keine Case-Status auf Acceptance gesetzt. |
| Bestehender Development Swarm | Owner-gebundener RLS-Read des Swarms `ad06e17d-460b-4b65-946a-9b5d78c6fd02`; aktuell drei Nodes und zwei Edges. | Draft und veröffentlichter Snapshot `0bd41ea5-3846-4e88-b6d0-d94020b07b18`; Owner-Scope bestätigt. Der Snapshot ist aktuell noch der fokussierte Builder mit Agent-MCP-Tools; `is_deployed=false`. |
| Case-gebundener Lauf | Die aktive UI verwendet den nativen `startCaseSwarm`-Serverfunktionsweg; der Server bindet `case_id`/`case_run_id` an `executeSwarmServer`. Separate `mcp_call_tool`-Tool-Nodes sind im Headless-Executor zugelassen. | Noch nicht gestartet. Der bestehende Graph muss vor dem Lauf auf sichtbare deterministische Gitea-MCP-Tool-Nodes umgestellt und nativ gespeichert/publiziert werden. Der Server-/Case-API-Pfad ist vorhanden; ohne aktuelle Owner-Sitzung kann der native RLS-Save-/Publish-/Start-Vertrag nicht aufgerufen werden. |

Die bestehende Produkt-Case-Lineage bleibt offen. Frühere ungebundene Runs und der fehlgeschlagene Case-Run `a7444ac2-90b1-5b78-ad70-78f1107ef18d` bleiben historische Evidence und werden nicht als erfolgreiche case-gebundene Candidate-Arbeit umgedeutet.

## Veröffentlichung

Der Handoff-Branch wird unverändert vom kanonischen Gitea in den bestehenden GitHub-Fork `aleXationDC/agentswarms` gespiegelt. Commit `6499230f60532468a7a8c8681f5f3974ce237638` wurde auf beiden Remotes per `ls-remote` bestätigt. Der frühere Eintrag, der `aleXationDC/aXtn-agentswarms` als Mirror bezeichnete, war falsch: diese GitHub-Repository-Adresse liefert 404. Es wurde kein GitHub-`main` verändert.

Der native Owner-Login und die Case-APIs funktionieren regulär; der aktuelle Blocker ist die case-spezifische Providerauflösung. Es ist keine Token- oder Passwortbereitstellung erforderlich.

## Nächste Arbeit — Stand 13:14 UTC (historisch; durch obigen Update ersetzt)

1. Den veröffentlichten Swarm über den vorhandenen nativen Save-/Publish-Weg mit separaten Gitea-MCP-Tool-Nodes ausstatten; Rollenmodell, Gateway-Opt-ins und bestehende Versionshistorie erhalten.
2. Auf dem bestehenden Master-Data-Case einen echten gebundenen Run starten und Trace, Run, Attempt und Candidate-Referenzen zurücklesen. Produktkorrekturen erstellt ausschließlich der Swarm.
3. Candidate-Repair auf einer frisch geprüften kompatiblen Base fortsetzen. Danach echte Tests, offizielle Gitea Actions, drei unabhängige Reviews und native Approval getrennt nachweisen. Fehlende CI sperrt PASS/Acceptance, nicht die zulässige Candidate-Arbeit.
4. Den Bericht nach jeder materiellen Veränderung ergänzen. Es gibt noch keinen PR, Merge oder Produktdeploy.
