# AXTN-DEV-INTAKE-CONNECTOR-REPAIR-20261019

Status ACTIVE_EXECUTION. Fortsetzung des modularen Auftrags und der Scope-Konfiguration; keine erneute allgemeine Architekturprüfung. Grundlage: Bericht handoffs/reports/AXTN-DEV-PROCESS-MODULAR-20261019.md@5f99bc3316b95e386915739fa6e7704667871ac7, Blob 5f142dc52aab67f6102e3a06d0e1e0adc15c97a0; Connector server.py@4235f9fb1bb6acc5b442d2017b3b4b75f685a12e, Blob 65896832d62703e8ca0de204eae9095e08cdf1ab.

## Verbindliche Entscheidung innerhalb der bestehenden Beauftragung

Die belegten Voraussetzungen jetzt konkret herstellen:
1. Getrenntes enges Intake-Konfigurationsprofil des bestehenden Gitea-MCP.
2. Fehlerkorrektur des bestehenden create_branch-Recovery-Pfads, damit der bereits vorhandene Baseline-Vertrag auch dort gilt.

Dies ist die notwendige Standardkonfiguration und Defektkorrektur der bereits eingesetzten aXtn-Gitea-Integration. Keine neue Policyengine, kein eigener Scheduler/Dispatcher, kein neues Ledger und keine neue fachliche Orchestrierung. Der Gitea-Connector ist eine bestehende aXtn-Integration, nicht AgentSwarms-Upstream-Core. Die frühere Einschränkung „keine Quelländerung“ im Konfigurationsauftrag gilt für genau diese belegte Reparatur nicht mehr. Die tatsächliche Case-/Run-Orchestrierung bleibt nativ.

Materialarbeit im vorhandenen Case 577050e6-e596-4818-bc79-d1041c9ef02e unter bestehender Lineage führen; bestehende Quelle/Runtime und lokale konkurrierende Arbeit neu lesen. Genau einen Writer je Worktree. Eigene konfigurierte Copilot-Identität, normale erlaubte Owner-Session und regulären Host-Releaseweg nutzen.

## A. Getrenntes Intake-Profil als Konfiguration

Im bestehenden Compose-/Provisionierungs-/Registryweg ein separates Intake-Profil mit demselben bestehenden Connector-Code/Image konfigurieren. Wenn das vorhandene Profilmodell nur eine Policy je Prozess unterstützt, eine zweite reguläre Instanz desselben Standardcontainers mit enger Intake-Konfiguration anlegen und nativ ownergebunden in AgentSwarms registrieren. Diese gezielte Konfiguration ist beauftragt; eine bisher einzige Compose-Instanz ist kein fehlendes Architekturmandat. Den vorhandenen produktgebundenen Endpoint und dessen Rechte unverändert erhalten. Kein temporäres Vereinigungsprofil und keine neue branchabhängige Policyimplementierung bauen.

Intake-Instanz erlaubt nur genau das benötigte Repository, einen konkreten kurzen Task-Präfix sowie den aus echter Work-/Attempt-/Operation-Zuordnung erwarteten Effect-Branch und die konkreten Git-Plan-/Ergebnispfade. Repo-Schreibpfade können auf dieser getrennten Instanz nicht in die Produktrechte der alten Instanz hineinwirken. Case-/Attempt-Identität im bestehenden nativen Start-/Workvertrag beschaffen; nicht auf einen noch gar nicht konfigurierten Intake warten, um dessen Einrichtungsarbeit zu beginnen. Für die Branchoperation stabile IDs verwenden, erwarteten Branch mit vorhandenem Algorithmus bestimmen, echte create_branch-Antwort zurücklesen und exakt vergleichen. Keine vom Modell frei wählbaren Branchfreigaben oder Wildcards.

from_ref/Baseline an tatsächlichem unveränderlichem Gitstand prüfen. Nur nach vorhandener Provenienzprüfung pinnen, keine relevanten Effect-Marker ausblenden. Scope-/Profil-/Baseline-Metadaten ohne Credentials dokumentieren. Nötige Host-/Registryänderungen regulär versionieren und bereitstellen. Keine neuen Credentials verlangen, sofern vorhandener geschützter Facility-Weg funktioniert; kein Secret in Toolausgabe, Graph, Git oder Case.

Wichtig: Intake darf VOR Planfreigabe seinen Plan nach Git schreiben. Gate 1 genehmigt anschließend dessen konkrete Revision und sperrt Produktimplementierung. Die Aussage im Bericht, Intake dürfe vor Planfreigabe überhaupt keine MCP-Toolschleife erhalten, ist zu weitgehend: dynamische Recherche plus ausschließlich Planartefakt-Schreibrechte sind sein Auftrag. Ein Zugriff auf den alten breiten Produktconnector wäre unzulässig; genau deshalb das getrennte enge Profil. Reviewer erhalten später passende eigene Rechte, kein Builder-Schreibprofil.

## B. create_branch-Recovery: vorhandenen Baseline-Vertrag konsistent anwenden

Konkreter Defekt: recover_branch liest bei vorgerücktem Head die volle erreichbare History über _effect_pages({sha: actual}), während _effect_commit_history bereits eine exakt repo-/branch-gepinnte Baseline, unveränderlich erfassten Head, Ancestry-Prüfung und begrenztes relevantes Delta unterstützt. Nicht bloß Timeout oder 500er-Grenze erhöhen.

Kleinste Korrektur im vorhandenen server.py:
- Bestehende Effect-Key-/Payload-/Branchname-/Scope-Prüfungen und Konfliktsuche erhalten.
- Baseline-basierte Wiederaufnahme muss die tatsächlich angeforderte from_ref beweisen. Ein aus dem Delta ausgeschlossener Baselinecommit kann nicht durch bloßes Suchen im Delta gefunden werden.
- Im hier benötigten klaren Fall Baseline == from_ref: exakt konfigurierte Baseline des tatsächlichen Effect-Branches und deren Erreichbarkeit vom erfassten aktuellen Head mittels vorhandener geprüfter Ancestry-Semantik belegen; vollständig begrenztes relevantes Delta weiterhin prüfen. Baseline nicht dynamisch auf Retry-Head verschieben.
- Für nicht übereinstimmende Baseline/from_ref oder fehlenden Pin den bestehenden sicheren Nachweis erhalten oder präzise fail-closed ablehnen, soweit API-Kompatibilität das verlangt. Keine ungeprüfte Behauptung „irgendeine Baseline ist Vorfahr, also stimmt from_ref“.
- Default-/geschützte Branches, Payloadkonflikte, fremde Repo-/Branch-/Pfadziele und fehlende/ungültige Effect-Bindung weiterhin vor Mutation ablehnen. Keine nachträglichen Marker oder force-push.
- Branchlisten-Pagination und Commit-Delta haben unterschiedliche Vollständigkeitsaufgaben; keinen Scan einfach entfernen oder Konfliktprüfung auf Dateipfade beschränken.
- Derselbe aktuelle Head muss zur Ancestry-/Delta-Provenienz gehören; Race/Branchwechsel erkennbar behandeln. Allgemeiner unscoped Connector und bisherige Profile bleiben kompatibel.

Gezielte Regression in bestehenden Connector-Tests:
- >1.612 alte Vorfahren, from_ref == geprüfte Baseline, Branch zunächst angelegt, danach Plancommit, anschließender Replay liefert denselben Branch ohne zweite Mutation.
- Antwortverlust nach Branchanlage und Replay nach späterem Fortschritt.
- Pin fehlt/falsch/nicht Vorfahr; von Pin abweichende from_ref; gleicher Effect mit abweichendem Payload; fremder Branch/Repo.
- Tatsächlich >500 relevante Einträge bleiben fail-closed; Scope und Rechte unverändert.
- Intake-Profil erlaubt genaue Planpfade, verweigert Produktcode und Geheimnis-/Workflow-/Hostpfade; altes Profil unverändert.

Vorhandene Connector-Suite ausführen. Reparaturcommits regulär veröffentlichen, unveränderliches Image bereitstellen, Digest/Source/Health/Registry-Bindung zurücklesen. Bestehenden produktiven Connector nur mit dieser kompatiblen gezielten Fehlerkorrektur aktualisieren, keine beiläufigen Produktänderungen.

## C. Unmittelbare fachliche Fortsetzung

Nach B und A direkt den Intake-Swarm konfigurieren und eigenständig qualifizieren: selbstständige erlaubte Recherche, echter effect-gebundener Branch-Create/Planwrite/Readback, vollständiger Git-Plan mit Teilaufträgen, Abhängigkeiten UND Integration/Gesamtprüfung. Echten revisionsgebundenen Plan-Gate-Suspend herstellen und verständliche Erläuterung im Case vorlegen.

Weder Produktimplementation vor Freigabe noch Fake-Approval. „Plan darf geschrieben werden“ ist keine Produktionsfreigabe. Vorhandene Skills/KBs/Modelle und Gateway-Opt-in wiederverwenden; fehlenden Intake nativ anlegen, keine fest verdrahteten Case-Dateiabrufe.

Nicht nach Analyse/Profildefinition mit Task complete enden. Fortschritt getrennt: Reparatur tested/deployed; Profil registriert/geprüft; Intake-Plan tatsächlich geschrieben; Planfreigabe pending. Tatsächlicher Nutzerentscheid am Plan-Gate ist ein legitimer Endpunkt dieser Fortsetzung.

Restlicher modularer Prozess bleibt beauftragt, mit seinen konkreten Native-Nachweispflichten. Falls ein wirklich benötigter geschützter Deploymentweg verweigert wird, genaue Policy-Ablehnung melden; vorhandene Pfade nicht umgehen und keine allgemeinen Credentials-/Architekturblocker erfinden. Ergebnisbericht im bestehenden Report fortführen und remote zurücklesen.
