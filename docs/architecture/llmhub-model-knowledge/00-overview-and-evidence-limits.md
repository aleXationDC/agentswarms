# LLMHub Modellwissen: Überblick, Rollenbelegung und Beweisgrenzen
Herkunft: aXtn/aXtn-agentswarms, docs/architecture/axtn-llmhub-model-role-research-20261016.md @ bed1069a88a984a4e4d24a98409254b60ffe1475. Recherchedatum 2026-10-16. Art der Information: Herstellerangaben und Engineering-Empfehlung, keine unabhängige Messung.

## Katalog
Zehn Hub-Modelle: sieben generative Sprachmodelle (GLM-5.2, GLM-5.3-Flash, Mistral-Small-4-119B-2603, NVIDIA-Nemotron-3-Super-120B-A12B-FP8, Qwen3.6-35B-A3B-FP8, Qwen3.8-27B-FP8, gpt-oss-120b) und drei Embedding-Modelle (jina-embeddings-v2-base-code, jina-embeddings-v2-base-de, text-embedding-bge-m3). Die exakten IDs stammen aus aXtn/aXtn-agentswarms handoffs/AXTN-LLMHUB-DEVELOPMENT-SWARM-0001.md @ 212f213c45776b35c329bd50c5d1edb98ed627f5, Abschnitt 1. "Other-Model-1" ist ein synthetischer Unit-Test-Eintrag, kein reales Modell.

## Beweisgrenzen
- Öffentliches LLMHub-Angebot und Herstellerfähigkeit sind keine persönliche Freischaltung. Aktuelle native Discovery und IAM sind maßgeblich.
- Herstellerangaben (Benchmarks, Tool-/Vision-Fähigkeit, Kontext) sind keine Latenzmessung des Hub-Endpunkts. Kontextgrenzen der gehosteten Instanz haben Vorrang.
- Öffentliche Preise sind kein individueller Tarif.
- Die Registry ist der strukturierte Katalog, diese KB enthält begründete Interpretation und Evidence.

## Rollenbelegung (Startbelegung, Stand Recherche und Konfiguration 2026-10-16)
| Rolle | Modell | Begründung |
| --- | --- | --- |
| Builder | GLM-5.3-Flash (explizite Alternative: Qwen3.6-35B-A3B-FP8) | Coding und UI-Iteration, Kostenposition |
| Contract Breaker | GLM-5.2 (Alternative gpt-oss-120b) | Projektkontext, API-Verträge |
| Security Breaker | gpt-oss-120b | andere Modellfamilie, vorhandene Gateway-Baseline |
| Maintainability Breaker | Mistral-Small-4-119B-2603 | Coding und Reasoning belegt |

Verschiedene Modelle allein garantieren keine unabhängige Acceptance. Menschliche Approval, Rollenprompts und deterministische Gates bleiben erhalten.

## Embeddings
Ein Modellwechsel eines bestehenden Vektorindex verlangt einen passenden Reembedding-Vertrag; Vektoren verschiedener Modelle nicht mischen. Die Plattform-KB nutzt derzeit 1536-dimensionale pgvector-Embeddings, keines der drei Hub-Embeddings ist als produktiver Index aktiviert.
