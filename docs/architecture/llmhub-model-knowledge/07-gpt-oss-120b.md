# Modellprofil gpt-oss-120b
Herkunft: aXtn-agentswarms docs/architecture/axtn-llmhub-model-role-research-20261016.md @ bed1069a88a984a4e4d24a98409254b60ffe1475, Recherche 2026-10-16. Primärquellen S7: https://deploymentsafety.openai.com/gpt-oss und https://openai.com/index/gpt-oss-model-card/. Typ: generatives Sprachmodell. Exakte Hub-ID: gpt-oss-120b.

Herstellerangaben: textbasiertes Reasoning, Befolgen von Anweisungen, agentische Toolnutzung und Coding.

Ableitung für unsere Plattform: Security Breaker (andere Modellfamilie, vorhandene erfolgreiche Gateway-Baseline). Kein dediziertes zertifiziertes Security-Modell: deterministische Security-/Testwerkzeuge bleiben nötig. Öffentlicher Preis am Recherchetag: 0.20 EUR Input / 0.65 EUR Output je Million Tokens (S11).

Eigene Messung (kein Herstellerwert): Gateway-Probe HTTP 200. In den Runs fbb14897-e41a-4aea-b574-2bb7e349e26e und 0bbbb403-5e8a-48dc-8802-7d369a91a3bb lieferte es strukturierte review/v1-Findings über das Gateway. Persönliche Freischaltung/IAM-Negativprobe: nicht geprüft.
