# Modellprofil text-embedding-bge-m3 (Embedding)
Herkunft: aXtn-agentswarms docs/architecture/axtn-llmhub-model-role-research-20261016.md @ bed1069a88a984a4e4d24a98409254b60ffe1475, Recherche 2026-10-16. Primärquelle S10: https://huggingface.co/BAAI/bge-m3. Typ: Embedding-Modell, kein Chatmodell. Exakte Hub-ID: text-embedding-bge-m3.

Herstellerangaben: mehrsprachiges Retrieval; das Basismodell unterstützt dichte, sparse und Multi-Vector-Verfahren, 8192 Tokens, 1024 Dimensionen.

Ableitung für unsere Plattform: gemischtes mehrsprachiges Projektwissen. Die Hub-/AgentSwarms-Embedding-API kann nur Dense-Vektoren exponieren: keine native Hybrid-/Sparse-/ColBERT-Unterstützung behaupten. Natives Hybridretrieval der Plattform (pgvector plus Postgres-Volltext) ist nicht das BGE-M3-Sparse-Verfahren. Die Plattform-KB nutzt 1536 Dimensionen; ein Modell mit 1024 Dimensionen verlangt einen passenden Index-/Reembedding-Vertrag. Keine produktive Aktivierung erfolgt.

Eigene Messung: keine. Persönliche Freischaltung: nicht geprüft.
