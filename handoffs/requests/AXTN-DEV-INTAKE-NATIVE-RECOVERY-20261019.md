# AXTN-DEV-INTAKE-NATIVE-RECOVERY-20261019

Status ACTIVE_EXECUTION. Fortsetzung nach Report 161025c17bf297b47a62c02e9ecdfe32d4cd18f5. Connectorreparatur 9f920a0873b9b364a86f4d5dce48b7219678ed0b und Intake-Profil ad96fea397a8856cfc6d7052ed330a9953acb706 laut veröffentlichtem Betriebsbericht deployed; diese Arbeit erhalten. Kein weiterer allgemeiner Connectorumbau.

## 1. Fehlerhaften Intake nativ abbrechen

Genau Run ae023eb3-0bc4-5f9b-acd1-960416f3c281 und Approval 98cfac6b-6050-469f-91eb-e673a9da7ea4 zuerst ownerauthentifiziert neu lesen. Wenn weiterhin suspended/pending und kein gültiger Plan: den vorhandenen nativen cancelParkedSwarmRun mit normaler erlaubter Owner-Session über den bestehenden UI-/Serverfunktionsweg ausführen.

Sourcebeleg: src/utils/swarmResume.functions.ts@ded696b804c7d921f275560e3fc7bd799d4b3265, Blob 85f1fc967ca40cf23ca0e1ea685bc0794e2a2758. Die Funktion validiert normale Session und RLS-Runzugriff, beansprucht ausschließlich status suspended, setzt cancelled/cancel_requested/finished_at, räumt den Checkpoint auf und schließt zugehörige pending Approvals mit cancelled. Auditaktion swarm_run.cancel. Das ist technischer Abbruch eines fehlerhaften Versuchs im laufenden Implementierungsauftrag, keine menschliche Planentscheidung.

Keine Approval genehmigen oder als fachlich geprüft ablehnen; kein TEST_SIMULATION einer Planfreigabe. Keine direkten SQL-/Service-Role-Aufrufe durch Copilot. Den vorhandenen serverseitigen Dienst mit seinen normalen Prüfungen verwenden; dessen interne Implementierung nicht mit einem externen Bypass verwechseln. Historische Evidence erhalten.

Nachkontrolle: Run cancelled, alte pending Approval cancelled, Checkpoint entfernt, kein Resume/Produktwrite; Case bleibt fachlich offen. Bei zwischenzeitlich geändertem Zustand nicht blind abbrechen; aktuellen Zustand lesen. Falls die native Funktion eine konkrete Guard-/RLS-Ablehnung liefert, diese belegen statt einen anderen Mutationsweg zu wählen. Existenz einer regulären pending Approval allein verlangt hier keine menschliche inhaltliche Entscheidung.

## 2. Derselbe Auftrag, korrigierter neuer Attempt

Bestehenden Case 577050e6-e596-4818-bc79-d1041c9ef02e weiterverwenden. Neue stabile Start-Operation und daraus folgenden tatsächlichen nativen Run/Attempt für den korrigierten publizierten Intake bestimmen; keinen neuen fachlichen Case für diesen technischen Wiederanlauf.

Alte Run-/Snapshot-/Effectbindung nicht umschreiben. Exaktes bestehendes Intake-Profil für den neuen Attempt/Branch mittels vorhandenen Provisionierers vorbereiten. Gleiches Repository und gleicher enger Planpfad; keine alten Produktrechte hinzufügen. Kein neuer Container je Retry als Standard: bestehende eigene Intake-Instanz bei nachgewiesen inaktiver alter Arbeit regulär auf das neue enge Attempt-Profil umkonfigurieren, Registry/Source/Scope zurücklesen und alte Bindung nachvollziehbar dokumentieren. Alte Effect-IDs nicht für andere Payloads wiederverwenden. Wenn der geprüfte Provisionierer tatsächlich eine weitere Instanz verlangt, den konkreten Grund und anschließende Stilllegung der überholten Instanz benennen.

Repositorywerte exakt aus der erfolgreichen Connector-Identität/Policy verwenden: owner aXtn, repository axtn-agentswarms. Das anders geschriebene aXtn-agentswarms ist hier KEIN erlaubter Repo-Parameter. Nicht aus Handoff-Linkschreibweise rekonstruieren und keine globalen Normalisierungsregeln bauen. Konfigurierte exakte Inputs repositoryOwner/repositoryName durchreichen. Nach erster Scope-Ablehnung stoppen; keine weiteren Schreibweisen/Owner ausprobieren und keine Rechte erweitern. Erneute 24 Ablehnungen sind kein sinnvoller Retry.

## 3. Gültige Planfreigabe erst nach echtem Plan

Snapshot 34c586ce-bfc8-4539-8de9-56ab7ce5221e und tatsächlichen aktuellen Draft/Published-Stand lesen, Operatoränderungen erhalten. Bereits eingebauten Readiness-Zweig qualifizieren: Ist er nur ein Modellurteil oder durch tatsächlich erfolgreichen Git-Readback und echte Artefaktreferenz gestützt? Ein Modelltext planReady=true beweist keine Datei.

Mit vorhandenen nativen Tool-/Condition-/Output-/Approval-Nodes sichtbare Erfolgsabhängigkeit herstellen: erfolgreiches erlaubtes Git-Schreiben, tatsächlicher Readback der konkreten Datei am geschriebenen Commit, Planinhalt und Referenz im Gate. Falls vorhandene Standardkonfiguration keinen verlässlichen Gate-Eintritt abbildet, konkrete Native-Vertragslücke isolieren; keinen eigenen Guard-/Dispatcher in Function-Code einbauen. Fehlendes Artefakt, MCP-Denial, leerer Plan oder Fehlerbericht darf nie als Genehmigungsvorlage durchlaufen.

Ein Intake-Ergebnis muss vollständigen Umsetzungsplan enthalten: Ziel, Teilaufträge und Child-Zuordnung, Abhängigkeiten, nötige Prüfungen/Reviews, Integrationsverantwortung, Zusammenführung/Gesamttest, UAT-/Releasepfad, offene Fachentscheidungen. Allgemeine Recherche bleibt autonom, keine feste fachliche Quellenliste.

Planartefakt darf vor Gate 1 geschrieben werden; danach echte menschliche Freigabe genau dieser Revision. Keine automatische Approval-Simulation. Bis dahin keine Produktimplementation, Builder-Fan-outs oder behauptete Abnahme.

## 4. Nachweis und bekannte Runtime-Gaps

Die Gegenprobe „fehlender Plan führt ohne Approval zum Fehler-/Blocked-Ausgang“ sicher über bestehende isolierte Tests oder zulässige Run-Eingabe prüfen; keine absichtlich fremden Produktwrites. Positive Probe muss tatsächlichen neuen Git-Plan, Commit/Blob, Case-/Runbindung und genau die gültige pending Planfreigabe liefern. Restart/Replay bleibt ohne Doppelwrite und ohne Wiederbelebung des abgebrochenen Runs.

Gemeldete fehlende Weitergabe von skillIds im headless serverChat gesondert konkret behandeln: am tatsächlich laufenden Source nachweisen, vorhandenen nativen Saved-Agent-/Skill-Ladeweg prüfen. Ein angehängter Skill zählt erst bei belegtem Laden/Nutzung; keine KB-/Promptkopie als behaupteten Skill-Nachweis verkaufen. Sollte eine Korrektur des vorhandenen Parameters nötig sein, eng als bestehende Runtime-Paritätsreparatur mit Test konkretisieren; keine neue Skillengine bauen. Unabhängige zulässige Recovery/Intake-Arbeit fortsetzen, Qualifikationsgrenze ehrlich ausweisen.

Normalen eigenen Copilot-Git-Weg und vorhandene erlaubte Owner-Authentifizierung verwenden. Bestehenden Bericht remote fortführen. Fertig für diese Fortsetzung bedeutet gültiger Git-Plan mit nativer pending Planfreigabe und verständlicher Case-Erklärung, nicht bloß eine weitere Scopeanalyse. Bestehende Connector-/Hostreparaturen und Produktgeschichte bleiben erhalten.
