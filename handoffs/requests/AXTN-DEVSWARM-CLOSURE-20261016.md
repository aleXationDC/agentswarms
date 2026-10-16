# AXTN-DEVSWARM-CLOSURE-20261016

Status: EXISTING_NATIVE_REPAIRS_AUTHORIZED / NEW_RUNTIME_AND_SECRET_ROTATION_DECISION_REQUIRED
Basisbericht: 1b4e7f7868298758f75e8f70295cdcc25057f8ad.
Branch: work/AXTN-NATIVE-SWARM-COMPLETION-20261016. Tracking: Issue #7 und vorhandene Case-Lineage.
AGENTS.md, Rollen- und Native-first-Grenzen gelten. Keine neue Kontrollplattform.

## Vorhandene Ergebnisse erhalten
Vier Development-Rollen über LLMHub und nativer Skill/KB-Import sowie Temperatur-Sourcefix/Deployment sind berichtet. Kein erneutes Setup, keine weiteren positiven Python-Fixtures als allgemeine Development-Abnahme. Modell-Advisor ist ein separater Testagent, keine neue beauftragte Swarm-Planungsstage. Die KB ist noch nicht an Development-Rollen gebunden; das nicht als fertige Swarm-Wissensversorgung ausgeben.

## Noch ausführbare native Fertigstellung
1. Temperatur 0 in einem eindeutig synthetischen, owner-eigenen Testagenten nativ speichern, Editor schließen/neu öffnen und gespeicherte Agent-Version zurücklesen. Null/fehlend verwendet 0.7. Produktive Agenten nicht zum Test umkonfigurieren; Testobjekt nicht mit dem nützlichen Advisor verwechseln.
2. KB-Karten-Absturz reproduzieren (React #185 ist ein Symptom, noch keine Ursachenanalyse). Card-Klick, Switch und Tastatur vergleichen; State-/Effect-/Draft-Feedback und Ereignisweitergabe prüfen. Eng begrenzten Produktbug im vorhandenen AgentForm-Vertrag beheben, gerichteten Regressionstest und UI Save/Reload ausführen. Nicht nur den Card-Klick verbieten oder einen Switch-Workaround als fertige Reparatur melden.
3. Skill-Nachweis korrekt: src/lib/skills.ts komponiert bei insgesamt höchstens SKILLS_INLINE_MAX_CHARS (Default 8000) den vollständigen Skill direkt in den Prompt. Nur darüber wird use_skill benötigt. Tatsächlich aktiven Modus und selektierte Skill-ID bzw. sicheren Prompt-Kompositionsnachweis prüfen; keinen künstlichen Toolaufruf oder aufblasen des Skills erzwingen. Keine credentialhaltigen Prompts/Logs publizieren.
4. Vollständigkeitsprobe für zehn Modellprofile über vorhandenes kb_search bzw. gezielte native Retrievalfragen durchführen. Ein allgemeiner Top-k-Aufruf kann nicht alle Profile garantieren. Pro fehlendem Profil gezielt nach exakter ID und Fähigkeit suchen; Quellen und richtige Grenzen prüfen. Kein neuer Retriever und keine pauschale gigantische Kontextvergrößerung.
5. KB/Skill an tatsächlich zuständige vorhandene Rollen nur gemäß bestehendem Konfigurationsauftrag sinnvoll zuordnen, bewusst nativ übernehmen/publizieren. Wenn allein der separate Advisor verwendet wird, Ergebnis explizit auf diesen Agenten begrenzen.
6. Isolierte IAM-Tests als solche dokumentieren. Keine globale Default-Deny-Umstellung in der Produktivinstanz zur Herstellung einer negativen Testidentität. 35 grüne Unit-Tests sind kein Live-Rechtebeleg. Eventuellen vorhandenen sicheren isolierten End-to-End-Testweg nutzen; produktive IAM-Eingriffe nicht erfinden.
7. Reparatur innerhalb bestehender autorisierter Releasegrenzen regulär ausliefern und nachweisen, ohne neue Credential-/Backup-Einrichtungsschleife. Neue schema-/key-/runtimewirksame Eingriffe unten sind damit nicht freigegeben.

## Sicherheitsvorfall: gezielte Vorbereitung, keine blinde Rotation
Gemeldet sind die Host-Konfigurationsvariablen AGENTSWARMS_INTERNAL_RUN_SECRET und AGENTSWARMS_PROVIDER_CREDS_SECRET. Werte niemals erneut in Chat/Tooloutput/Git/Cases ausgeben; keine kompromittierten Sitzungslogs durchsuchen. Vorfall nur mit nichtgeheimen Referenzen und tatsächlichem Expositionsumfang dokumentieren, Logs nicht eigenmächtig löschen.

Source am 1b4e7f78 zeigt bereits native Rotation:
- src/utils/providers/crypto.server.ts: Keyring, bisherige Schlüssel, reEncryptDeep.
- src/utils/providers/keyRotation.functions.ts: getKeyEncryptionStatus / reEncryptCredentials, echte Superadmin-Autorisierung und Audit.
- src/utils/providers/keyRotation.server.ts: vorhandene Umschlüsselung über ENCRYPTED_TABLES.
Keine neue KMS-/Rotationengine bauen, keinen neuen externen KMS einführen.

Vor konkreter Autorisierung einen sicheren ausführbaren rotationsbezogenen Plan erstellen:
- Tatsächliche Host→App-Variablenzuordnung prüfen, ohne Werte auszugeben; Hostnamen der Variablen sind nicht automatisch die process.env-Namen.
- INTERNAL_RUN_SECRET: alle tatsächlichen Erzeuger/Prüfer/abhängigen Prozesse benennen, koordiniertes Umschalten und Ablehnung des alten Secrets nachweisen; keine JWT-/Provider-API-Key-Rotation mit ihm verwechseln.
- PROVIDER_CREDS_SECRET: ist Verschlüsselungsmaterial für persistierte Credentials, kein gewöhnlicher Provider-API-Key. Neues Current plus vorheriger Key nur für die Übergangsphase, nativen Reencrypt-Pfad und vollständige Statuskontrolle planen. Alle betroffenen Tabellen/Blobtypen und Runtimeversionen berücksichtigen.
- Tabellenzählung/Pagination der vorhandenen Rotation verifizieren: die geprüfte Routine liest mit select("*"), ohne sichtbare explizite Pagination. Keine Vollständigkeit aus einer möglicherweise serverseitig gekappten Ergebnismenge ableiten. Ebenso konkurrierende Änderungen/zulässiges Wartungsfenster und Wiederaufnahme klären. Bei belegter Lücke minimale normale Produktkorrektur vorbereiten, keine ungeprüfte Massenumschlüsselung.
- Schlüsselmaterial erst aus dem aktiven Keyring entfernen, wenn alle gespeicherten Blobs und betroffenen Verbindungen mit dem neuen Schlüssel funktionieren. Alte Backups benötigen ihre passenden geschützten Recovery-Schlüssel; keine Löschung/Reencrypt aller Backups als Nebenarbeit. Wiederherstellbarkeit und Sicherheitsrest alter Ciphertexte konkret ausweisen.
- Rotation als wirksame Änderung separat zur konkreten Nutzerentscheidung vorlegen; diese neue Vorfall-Fortsetzung allein autorisiert noch keine Schlüssel-/Datenmutation. Vorhandene autorisierte UI-/KB-Reparaturarbeit weiterführen.

## TypeScript-Fähigkeit: konkrete Entscheidungsvorlage
Aktuelles Image ohne node/npm/git und Python-Fixture-Taskvertrag bleiben belegt. Eine Erweiterung ist erforderlich, kein bestehender bloßer Schalter.
Aus dem bestehenden node-ts-v1-Entwurf genau die minimale Lösung auf vorhandener Runtime-/Session-/Approval-/Case-Infrastruktur ausarbeiten: konkrete Dateien, gepinnte Node-/npm-/Dependencyversorgung und Lockfileintegrität, erlaubtes Produktrepo/Base-SHA/Pfadscope, Mehrdatei-Candidate, kompletter Candidate-Hash im Review/Receipt, festes Test-/Buildprofil, CPU/RAM/Timeout/Egress/Secretschutz und Rollback.
Native vorhandene Komponenten wiederverwenden; keine neue Shell-/Executor-/Orchestrierungsplattform. Eigenständige Architektur-/Runtimeerweiterung nicht als bereits autorisiert implementieren. Reviewbare Vorlage mit Risiken und Abnahme für echte Phase A des Case-Management-Auftrags liefern.

## Ergebnis
Bestehende Reports/Case-Referenzen aktualisieren. Vier getrennte Zustände: (a) UI-Reparatur und Save-Roundtrip, (b) native KB-/Skill-Nutzung, (c) Sicherheitsvorfall/ausstehende konkrete Rotation, (d) weiterhin fehlende Produkt-Development-Runtime und deren freigabefähiger kleinster Entwurf.
"Task complete" nur für ausdrücklich erfüllte Teilpakete, nicht für den gesamten Development-Swarm.
