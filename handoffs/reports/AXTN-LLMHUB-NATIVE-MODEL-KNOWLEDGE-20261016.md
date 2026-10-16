# AXTN LLMHub native Modell-KB und Skill – Bericht 2026-10-16

Bezug: Request `AXTN-DEVSWARM-REMAINING-GAPS-20261016` (Fortsetzungscommit `7fced1df`). Alle Objekte wurden über die native UI angelegt (kein SQL-Schreibzugriff).

## Objekte
| Objekt | ID | Stand |
|---|---|---|
| Knowledge Base `aXtn LLMHub Model Knowledge` | `8070ae97-19ce-49b2-8595-5b44e40175c7` | 11 Dokumente (00 Overview + 10 Modellprofile), je 1–2 Chunks, alle eingebettet (OpenAI text-embedding-3-small, 1536d, Owner-Key; das ist die vorhandene Plattform-Indexierung, keines der Hub-Embeddings ist aktiviert) |
| Skill `aXtn LLMHub Model Selection` | `f2ce61cf-c228-489e-a410-171a9063848b` | Tags `model-selection,llmhub,planning`, Body aus `docs/architecture/axtn-llmhub-model-selection-skill.md` |
| Agent `aXtn LLMHub Model Advisor` (neu, nicht im Swarm) | `e2871759-05d6-4f29-8cb6-91952657d822` | vLLM/GLM-5.2, Gateway-Opt-in, KB + Skill zugeordnet, Temperatur 0.7 |

Quelle der Dokumente: `docs/architecture/llmhub-model-knowledge/*.md` (Herkunft `bed1069a`). Rechte: Owner-gebunden (RLS `user_id`); keine Freigabe an weitere Principals.

Die vier Development-Swarm-Agenten und der publizierte Swarm (`f7fc9cb5…`) wurden **nicht** verändert. Der Builder/Contract folgt damit nicht blind einer Modellempfehlung; Zuordnung an Rollenagenten bleibt eine bewusste Folgeentscheidung (Re-Publish nötig).

## Tests (Agent Advisor, Playground)
- Retrieval: Conversation `808a5367-8fb1-4cc0-8579-9157f25dcd8f`, Trace `0018c5a5-58fd-4a61-85ae-25e7f636f7a9` (vllm/GLM-5.2, gatewayRouted=true). Nennt die 7 LLMs und 3 Embeddings, Coding-Rollen von Flash/Mistral, Embeddings für Code/Mehrsprachig, Herkunft `bed1069a`. **Grenze:** Top-k-Retrieval lieferte nicht alle Profile (Qwen3.8-27B, jina-de wurden als „nicht geprüft“ statt aus ihrem Profil beantwortet) – ehrlich markiert, aber unvollständig.
- Unsicherheitsprobe (Freischaltung/Latenz): Trace `fbfc92fc-5f53-424c-ac3b-1532665061ba`. Antwort „nicht geprüft“ für Konto-Freischaltung und garantierte Latenz; Qwen3.8-Eigenschaften korrekt aus dem Profil mit Evidenzgrad. Skill-Wirkung (Evidenz-/Unsicherheitsformat) erkennbar; ein expliziter `use_skill`-Toolaufruf wurde nicht separat belegt (Skill ist in den Prompt komponiert).
- Keine Konfigurationsänderung durch die Läufe.

## Registry-Abgleich (nur lesend, `model_registry`, 814 Einträge, Quelle `aimlapi`)
Die Registry ist ein öffentlicher Katalog, kein LLMHub-Bestand; sie beweist keine Freischaltung.
- Treffer über Alias: GLM-5.2 (`zhipu/glm-5.2`), GLM-5.3-Flash (`z-ai/glm-5.3-flash`), Qwen3.8-27B (`alibaba/qwen3.8-27b`), Qwen3.6-35B-A3B (`alibaba/qwen3.6-35b-a3b`, ohne FP8), Nemotron-3-Super-120B-A12B (`nvidia/nemotron-3-super-120b-a12b`, ohne FP8), gpt-oss-120b (`openai/gpt-oss-120b`).
- Nur Näherung: Mistral-Small-4-119B-2603 ↔ `mistralai/mistral-small-2603` (Größe nicht belegt).
- Fehlt: `jina-embeddings-v2-base-code`, `jina-embeddings-v2-base-de`, `text-embedding-bge-m3`.
- Der Agentenformular-Modellpicker für vLLM listet die sieben LLMs nativ.

## Zugriffslücke Katalog
Kein nativer Agenten-Tool-Zugriff auf einen autorisierten Hub-Katalog: `src/utils/tools/registry.server.ts` kennt keinen Modellkatalog-/Discovery-Tool (nur `kb_search`, `list_mcp_servers`, `ml_list_models` u. a.). Daher bleibt aktuelle Freischaltung „nicht geprüft“.
Kleinster Entwurf (nicht implementiert): lesendes Tool `list_gateway_models` im Tool-Register, das nur die Models-Discovery des owner-eigenen Gateways (vorhandene Gateway-Auflösung aus `gatewayRouting`) liest, IAM-gefiltert (`iam_model_rules`), ohne Schreibrechte; Wiederverwendung: `modelRegistry.server.ts`, `providerModels.functions.ts`, `providerSupport.ts`.

## Beobachtete Produktauffälligkeit
Im Agentenformular (Tab Knowledge) führt ein Klick auf die KB-Karte (nicht auf den Switch) auf dem deployten Stand `57fe65cb` zu React-Fehler #185 („Something went wrong“, Seite stürzt ab). Der Switch funktioniert. Nicht behoben (außerhalb des Auftrags); Folgeticket empfohlen.
