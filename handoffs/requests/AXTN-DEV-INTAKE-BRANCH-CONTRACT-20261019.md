# AXTN-DEV-INTAKE-BRANCH-CONTRACT-20261019 — tatsächliche Bindung abgleichen

Status ACTIVE_CORRECTION. Modularen Intake fortsetzen, keine neue allgemeine Analyse. Grundlage: Attemptbericht 0007@7c475449eae16d40c38e97843c49af3affed199b, Blob 06accc3e510f99c5c10d92092cc9b325eb2da813; Connector 9f920a0873b9b364a86f4d5dce48b7219678ed0b, server.py Blob 622cf76a98660a28d0af5f9befab7f6c0fef9eef; Hostprovisionierer@17d47e6c27c959d8b853cef4eb25e9fee0aa646b, Blob 28407f36f9762419abe1f07e5873391ad81ad510.

## Verbindliche Sourcekorrektur

Die Schlussfolgerung im Attemptbericht, create_branch müsse den vollständigen Effect-Branch statt task/intake-plan erhalten, ist am gelesenen Connectorstand falsch. create_branch prüft zuerst den übergebenen Präfix, berechnet key/digest aus Effect und Payload und hängt selbst -effect-<key32>-<digest32> an. Danach prüft es den tatsächlichen Branch nochmals exakt. Vollständiger Branch als Argument würde erneut suffigiert und überschreitet hier die 100-Zeichen-Grenze bzw. die 27-Zeichen-Präfixgrenze.

Der Host-Provisionierer profile_values erlaubt am geprüften Source beide Werte [PREFIX, effect_branch(...)]. Daher ist keine globale Scope-/Präfixerweiterung begründet. Derselbe Fehlermeldungstext kann bei der ersten ODER späteren Branchprüfung entstehen. Aus dem Toolargument branch=task/intake-plan allein folgt nicht, dass gerade die Präfixprüfung scheiterte.

Isolierter Kontrollfluss-Reproducer mit aus der Originalsource übernommenen _effect_identity/create_branch und gestubbten externen Grenzen wurde hier ausgeführt (kein Live-/Gitea-Write, kein kompletter Integrationstest):
1. Präfixargument + passende exakte Präfix-/Effectbranch-Liste -> erfolgreiche Branch-Rückgabe.
2. Vollständigen Effect-Branch als Argument einsetzen -> ValueError: Effect branch prefix must be at most 27 characters.
3. Präfix fehlt in effektiver Liste -> beobachtete Scope-Ablehnung reproduziert.
Das beweist den Aufrufvertrag, nicht die tatsächliche Host-Fehlerursache.

## Vor JEDEM weiteren Start konkret abgleichen und korrigieren

1. Bestehenden Case 577050e6-e596-4818-bc79-d1041c9ef02e, terminalen Attempt 862afd89-51c6-526d-a0a3-180026c7f334, dessen tatsächlich publizierten Snapshot 9d61c289-de2f-4cab-a2c9-a15736efee6f und exakten native create_branch-Toolcall lesen. Nur erlaubte nichtgeheime Werte vergleichen: Owner, Repository, branch, from_ref und vollständige Effect-Cases/Attempts/Operationen. Report nennt operation intake-plan-20261019-0007 und from_ref c806bd81d1cad6ba965badb9daa6affc982f4754; nicht ungeprüft als tatsächlich gesendetes Effect-Objekt übernehmen.

2. Vom tatsächlich benutzten Agent-/Registry-Namen bis zum privaten Endpoint/Container/Image und wirksamen nichtgeheimen Repo-/Branchlisten/Baseline-Pin zurücklesen. Keine Gesamt-Env-/docker-inspect-Ausgabe oder Zugangsdaten drucken. Erwartete Werte aus Provisionierer-Datei sind kein Nachweis der Containerwerte; geschriebene Envdatei beweist auch keinen erfolgten Recreate. Live-Policy und laufender Connector müssen exakt zu tatsächlichem Aufruf passen.

3. Mit der bestehenden identischen kanonischen Berechnung den aus dem Toolcall abgeleiteten tatsächlichen Branch ausrechnen und exakt gegen die wirksame Liste prüfen. Beide _scoped_working_branch-Prüfungen berücksichtigen. In einer kompakten Soll/Ist-Tabelle die genaue Abweichung belegen: Repo-Casing, Präfix, Effect-Case/Attempt/Operation, from_ref, abgeleiteter Branch, Baseline, Registry/Endpoint/Image. Keine Hashwerte erraten oder Branchnamen manuell zusammenbauen. Auch Owner/Repo-Schreibweise ist Bestandteil des Effect-Keys.

4. Nur die nachgewiesene Bindungs-/Provisionierungs-/Runtimekonfiguration korrigieren. Präfixargument bleibt task/intake-plan; upsert_file erhält ausschließlich den von echter create_branch-Antwort zurückgelesenen tatsächlichen Branch. Beide exakten Branchwerte bleiben erlaubt. Keine doppelten Effect-Suffixe, Wildcards oder Produktpfade freigeben und keine bereits reparierte Connector-Source erneut ändern, solange kein Sourcefehler belegt ist.

## Wiederanlauf ohne Blockade durch grünen Blocker-Run

Der Scope-Denial beendet diesen Attempt. Er verbietet blindes Wiederholen mit geänderten Effects bei unverändertem Fehler, nicht jede Fortsetzung nach tatsächlich behobener Konfiguration. Historischer success-Run mit fachlichem BLOCKED bleibt erhalten; ihn nicht per DB in error umdeuten.

Vor Neu-Provisionierung normale Inaktivität und tatsächliche Nullwirkung nachweisen: alter Run terminal, keine pending Approval/Checkpoint/aktiver Run, keine durch diesen Effect angelegte Branch oder Datei. Danach einen kontrollierten neuen technischen Attempt für denselben Case vorbereiten, bestehende eigene Intake-Instanz regulär neu binden und neu starten. Neue tatsächlich geplante native Start-ID, Profil und Toolcall müssen derselben Bindung entsprechen. Alter Attempt wird weder verändert noch als Planerfolg ausgegeben.

Der geprüfte Hostprovisionierer akzeptiert bisher nur cancelled/error beim Vorversuch; ein fachlich blockierter success-Run kann daher in dessen Wiederanlaufprüfung hängen bleiben. Falls das tatsächlich der Fall ist, ist die eng begrenzte Korrektur dieses bestehenden Inaktivitätsprüfers beauftragt: terminaler success ausschließlich bei belegtem fachlichen Blocker/Nullwirkung, passender Case-/Swarm-/Attempt-Identität und fehlender Approval/Checkpoint/aktiver Arbeit als zulässigen technischen Vorversuch behandeln. Kein allgemeines success=neu binden, kein Wiederanlauf nach freigegebenem Plan und keine Lockerung tatsächlicher Aktivitäts-/Wirkungsprüfungen. Mit vorhandenen isolierten Hosttests nachweisen. Keine neue Scheduler-/Policyengine.

## Präflight und Ergebnis

Vor kostenpflichtigem Intake-Lauf eine isolierte, rein lesende/gestubbte Prüfung mit denselben berechneten konkreten Profil-/Aufrufwerten: korrekter Präfix und abgeleiteter Branch akzeptiert, abweichende Operation/Attempt/Basis/Repo abgelehnt. Diese Prüfung führt keinen echten Git-Write aus und ersetzt ihn nicht. Erst nach passendem tatsächlichem Runtime-Readback genau einen korrigierten nativen Intake starten.

Danach echte Branchanlage, nützlicher vollständiger Git-Plan inklusive Teilaufträgen/Integration/Gesamtprüfung, Write-/Readback und echte revisionsgebundene pending Planfreigabe. Bei erneutem Denial keinen Versuch 0009 ohne neue Ursachenprüfung starten. Bereits funktionierendes NO-Gate erhalten: fehlender Plan -> keine Approval. Kein manueller Git-Plan oder Produktwrite als Ersatz.

MFA-Restoration laut Bericht 003deceff687366baad7b19f633b026344bdbad4 auf 814755422555e8375e476b229046eaa9ba08626f deployed; erhalten, nicht erneut bearbeiten. Persönliche positive MFA-Bestätigung bleibt Alex' Browseraktion.

Bestehenden Attempt-/Betriebsbericht korrigieren: falsche Präfix-Schlussfolgerung ausdrücklich zurücknehmen, tatsächliche Root Cause mit Runtimevergleich und Korrektur belegen, Ergebnisse regulär veröffentlichen/zurücklesen. Native Arbeit im bestehenden SupaCase führen; keine neue Credentialrunde. Gesamtauftrag erst am tatsächlichen Git-Plan mit gültiger Planfreigabe als dieser Meilenstein geliefert ausweisen.
