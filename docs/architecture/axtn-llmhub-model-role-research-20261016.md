# LLMHub: zehn Modelle und Development-Rollen
Stand: 2026-10-16. Status: recherchierte Empfehlung, keine ausgeführte Live-Konfiguration.

## Katalog und Beweisgrenzen
Die exakten zehn IDs stehen in aXtn/aXtn-agentswarms, handoffs/AXTN-LLMHUB-DEVELOPMENT-SWARM-0001.md am Commit 212f213c45776b35c329bd50c5d1edb98ed627f5, Abschnitt 1. Es sind sieben generative Sprachmodelle und drei Embedding-Modelle. Der öffentliche heutige LLMHub-Gesamtkatalog ist größer und beweist keine persönliche Freischaltung. Die aktuelle native Discovery und IAM bleiben maßgeblich. Other-Model-1 stammt aus einem synthetischen Unit-Test und ist KEIN reales Katalogmodell.

Herstellerfähigkeiten und Benchmarks sind Primärquellenangaben, kein eigener Vergleichstest. Hersteller-Toolnutzung, Vision und lange Kontexte sind nur nutzbar, wenn LLMHub-Deployment UND der native AgentSwarms-Pfad sie unterstützen. Keine eigene Browser-/Toolintegration aus Modellwerbung ableiten. Kontextangaben der gehosteten Instanz haben Vorrang vor maximalen Herstellerangaben; FP8 ist keine automatische Qualitätsgarantie.

## Alle zehn Modelle
| Exakte Hub-ID | Dokumentierte Stärken | Ableitung für unsere Plattform / Grenze |
| --- | --- | --- |
| GLM-5.2 | Projektweite Engineering-Kontexte, lange Arbeitsabläufe, Einhalten technischer Standards und API-Verträge; strukturiertes JSON und Function Calling. [S1] | Contract Breaker für Anforderungen, Schnittstellen und Architekturgrenzen. Kein Nachweis, dass es in unserem Rollenlauf besser als Flash ist. |
| GLM-5.3-Flash | Multimodales agentisches Coding, visuelle UI-Iteration, Toolnutzung, strukturiertes Output. Hersteller meldet bessere Coding-/Agent-Benchmarks als GLM-5.2 bei niedrigeren Kosten. [S2] | Priorisierter Builder-Kandidat für den Case-Management-Frontend-/TypeScript-Auftrag. Flash nicht als bloßen schwachen Router einstufen. Herstellerwerte nicht als Hub-Latenzmessung oder unabhängiges Ranking behandeln. |
| Mistral-Small-4-119B-2603 | Vereint Reasoning, Bildverständnis und agentisches Coding; Function Calling und Structured Outputs. 119B gesamt, 6.5B aktiv. [S3] | Maintainability Breaker als begründete Startbelegung; Codeverständnis, Verständlichkeit und UI-/Dokumentkontext. Frühere Reduktion auf Dokumente/Bilder war falsch. Bereits im gemeldeten Gateway-Run verwendet. |
| NVIDIA-Nemotron-3-Super-120B-A12B-FP8 | Für kooperierende Agenten, längere Reasoning-Aufgaben, Toolnutzung, RAG und hohe Arbeitsvolumina ausgelegt. 120B gesamt, 12B aktiv. [S4] | Vergleichskandidat für Reviewer oder spätere Wissens-/Triage-Aufgaben; kein eigenes Orchestrierungsrecht. Hersteller nennt bis 1M Kontext, unser historischer Hub-Snapshot nur 256000: tatsächlich freigegebene Grenze prüfen. |
| Qwen3.6-35B-A3B-FP8 | Expliziter Schwerpunkt auf agentischem Coding, Frontend-Workflows und Repository-Verständnis; iterative Entwicklung mit erhaltenem Denk-Kontext. [S5] | Sehr passender Builder-Vergleichskandidat bzw. ausdrücklich benannte Alternative zu Flash. Denk-Kontext nur über tatsächlich unterstützte native Parameter, keine Sonderengine. |
| Qwen3.8-27B-FP8 | Coding, professionelle Aufgaben, längere agentische Abläufe, Planen mit Umgebungsfeedback; natives Bild-/Videoverständnis, steuerbares Reasoning. [S6] | Ernsthafter Kandidat für Builder/Review und visuelle Qualitätsprüfung. Ein früheres pong statt JSON ist ein ungeklärter lokaler Einzelbefund, keine generelle Untauglichkeit. Vor produktiver Rollenwahl erforderlichen Output-/Toolvertrag gezielt prüfen. |
| gpt-oss-120b | Textbasiertes Reasoning, Befolgen von Anweisungen, agentische Toolnutzung und Coding. [S7] | Security Breaker als unabhängige Modellfamilie und vorhandene erfolgreiche Gateway-Baseline. Kein dediziertes zertifiziertes Security-Modell; deterministische Security-/Testwerkzeuge bleiben nötig. |
| jina-embeddings-v2-base-code | Semantische Repräsentation von Englisch und 30 Programmiersprachen. [S8] | Kandidat für Code-/Repository-Suche im vorhandenen nativen Knowledge-/Retrievalpfad; kein Codegenerator oder Reviewer. |
| jina-embeddings-v2-base-de | Bilinguale deutsch-/englischsprachige Textrepräsentation, bis 8192 Tokens. [S9] | Deutsche Anforderungen, Cases und Projektdokumente semantisch suchen. Kein Chatmodell. |
| text-embedding-bge-m3 | Mehrsprachiges Retrieval; das Basismodell unterstützt dichte, sparse und Multi-Vector-Verfahren, 8192 Tokens und 1024 Dimensionen. [S10] | Gemischtes mehrsprachiges Projektwissen. Hub-/AgentSwarms-Embedding-API kann nur Dense-Vektoren exponieren: keine native Hybrid-/ColBERT-Unterstützung behaupten. |

## Recherchierte Startbelegung
Dies ist eine auf Quellen gestützte Engineering-Empfehlung, keine bereits gemessene optimale Rollenverteilung.

| Rolle | Vorrangige Startbelegung | Begründung |
| --- | --- | --- |
| Builder | GLM-5.3-Flash | Aktuelle ausdrückliche Ausrichtung auf Coding und visuelle UI-Iteration, passende Kostenposition. |
| Contract Breaker | GLM-5.2 | Projektkontext, Engineering-Vorgaben und API-Verträge; eigene Reviewer-Sitzung und unveränderter Candidate. |
| Security Breaker | gpt-oss-120b | Bestehende Gateway-Baseline und andere Modellfamilie; Security-Findings statt allgemeiner Zustimmung prüfen. |
| Maintainability Breaker | Mistral-Small-4-119B-2603 | Coding und Reasoning ausdrücklich belegt, bestehende Gateway-Reviewer-Konfiguration erhalten. |

Für Builder zuerst den echten erforderlichen Output-/Toolvertrag mit Flash prüfen und mit Qwen3.6 an einem kleinen identischen auftragsnahen Coding-Fall vergleichen. Nicht alle sieben Modelle über eine neue lange Benchmarkphase schicken. Wenn Flash nicht nativ verfügbar/berechtigt oder am konkreten Rollenvertrag ungeeignet ist, Qwen3.6 als explizite Alternative verwenden und offen dokumentieren. Falls beide geeignet sind, zählt funktionale Korrektheit und reale Test-/Toolfähigkeit vor Stil; bei vergleichbarem Ergebnis reale Gesamtlatenz, Tokenverbrauch und Kosten heranziehen. Keine stille automatische Provider-/Modellumschaltung im Run.

GLM-5.3-Flash als Builder ersetzt die unmittelbar zuvor nur aus der älteren Empfehlung abgeleitete Priorisierung von Qwen3.6. Mistral bleibt nicht mangels Recherche stehen: die neue Recherche bestätigt Coding als Herstellerfähigkeit. GLM-5.2 ist nicht pauschal intelligenter, nur weil es kein Flash im Namen trägt; Reviewerzuordnung ist eine zu prüfende funktionale Arbeitshypothese. Bestehende menschliche/native Approval, Rollenprompts und deterministische Gates bleiben erhalten. Verschiedene Modelle allein schaffen keine unabhängige Acceptance.

## Kosten und Kontext der gehosteten Modelle
Öffentliche LLMHub-Liste am Recherchetag, EUR pro Million Input-/Output-Tokens; kein Nachweis des individuellen Vertrags, Tarifs oder gemessener Run-Kosten. [S11]

| Modell | Input | Output |
| --- | ---: | ---: |
| GLM-5.2 | 1.50 | 3.50 |
| GLM-5.3-Flash | 0.20 | 0.60 |
| gpt-oss-120b | 0.20 | 0.65 |
| Mistral Small 4 | 0.60 | 1.20 |
| Nemotron 3 Super | 0.60 | 1.20 |
| Qwen3.6 35B | 0.60 | 1.20 |
| Qwen3.8 27B | 0.50 | 2.50 |

Reasoning- und Ausgabetoken sowie Wiederholungen beeinflussen reale Kosten; niedriger Tokenpreis beweist keine kürzere Gesamtlaufzeit. Native UI-/Toolparameter nur setzen, wenn implementiert und vom Hub akzeptiert. FlashX-Tempo/Preise gelten nicht automatisch für unseren Flash-Endpunkt.

Die drei Embeddings nicht nur zur Vollständigkeit aktivieren. Ein Modellwechsel eines bestehenden Vektorindex verlangt passenden nativen Index-/Reembedding-Vertrag; keine Vektoren verschiedener Modelle mischen. Dieser Rechercheauftrag autorisiert keine produktive Reindexierung.

## Primärquellen (abgerufen 16.10.2026)
- S1: https://docs.z.ai/guides/llm/glm-5.2
- S2: https://docs.z.ai/guides/vlm/glm-5.3-flash
- S3: https://docs.mistral.ai/models/mistral-small-4-0-26-03 und https://mistral.ai/news/mistral-small-4/
- S4: https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-FP8
- S5: https://huggingface.co/Qwen/Qwen3.6-35B-A3B
- S6: https://huggingface.co/Qwen/Qwen3.8-27B
- S7: https://deploymentsafety.openai.com/gpt-oss und https://openai.com/index/gpt-oss-model-card/
- S8: https://huggingface.co/jinaai/jina-embeddings-v2-base-code
- S9: https://huggingface.co/jinaai/jina-embeddings-v2-base-de
- S10: https://huggingface.co/BAAI/bge-m3
- S11: https://docs.llmhub.t-systems.net/de/models/llms/

Kein Live-Gateway-Aufruf und keine Runtime-Konfiguration in dieser ChatGPT-Session. Bestehende Deployment-Evidence ist Copilot-Bericht, diese Recherche ergänzt dessen Rollenbewertung.
