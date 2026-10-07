export const DMS_RECONSTRUCTION_VERSION = "reconstruction-v1";
export const DMS_KNOWLEDGE_BASE_ID = "e1000000-0000-4000-8000-000000000001";
export const DMS_KNOWLEDGE_DOCUMENT_ID = "e1000000-0000-4000-8000-000000000002";

export const DMS_SKILLS = [
  {
    id: "e1000000-0000-4000-8000-000000000011",
    name: "DMS document triage — reconstruction v1",
    description:
      "Bounded, non-authoritative document type and routing proposal for the recovered Stage 1 contract.",
    tags: ["axtn-dms", "reconstruction-v1", "stage-1"],
    body: `# DMS Stage 1 triage — Reconstruction v1

This is a newly reconstructed Agent Builder Skill, not a recovered historical payload.

Use only the supplied document text, filename, canonical Registry context and the connected DMS contract Knowledge Base. Return a proposal, never an authoritative classification, privacy decision, rights decision, approval, filing instruction or cleanup instruction.

The allowed document types are exactly: Rechnung, Vertrag, Vertragsanpassung, Mahnung, Bescheid, Nachweis. If the available evidence does not support one type, return null and route to human review. Do not invent parties, dates, amounts, identifiers, case references, business units, locations or destinations. Every proposed value must be directly supported by the supplied text; cite a short evidence excerpt where the output contract allows it.

Output only JSON matching the Stage 1 projection contract in the Knowledge Base. Do not include commentary, Markdown, instructions to tools or additional keys.`,
  },
  {
    id: "e1000000-0000-4000-8000-000000000012",
    name: "DMS metadata proposal — reconstruction v1",
    description:
      "Bounded metadata completion proposal for the recovered Stage 2 contract; no provider-side effects.",
    tags: ["axtn-dms", "reconstruction-v1", "stage-2"],
    body: `# DMS Stage 2 metadata proposal — Reconstruction v1

This is a newly reconstructed Agent Builder Skill, not a recovered historical payload.

Complete only fields allowed by the Stage 2 projection contract and only from explicit supplied evidence. Preserve canonical Registry corrections. Leave unsupported or ambiguous values null and request human review. Never infer a person's identity, legal rights, privacy eligibility, approval, filing location, duplicate status or deletion scope.

This Agent can propose metadata only. It cannot authorize a real effect, decide an Approval, file a document, or delete a file.

Output only JSON matching the Stage 2 projection contract in the Knowledge Base. Do not include commentary, Markdown, instructions to tools or additional keys.`,
  },
];

export const DMS_KB_CONTENT = `# aXtn DMS bounded stage contract — Reconstruction v1

Provenance: this is a newly authored, non-historical Knowledge Base document, limited to explicit constraints in aXtn/swarms/axtn-document-management/graph.mjs and the approved UI-readiness request. It contains no customer document, identity, training example or private operational value.

## Allowed classification values

The six operational document types are Rechnung, Vertrag, Vertragsanpassung, Mahnung, Bescheid and Nachweis. These names do not authorize a legal, financial, privacy or rights conclusion.

## Stage 1: triage proposal

Use the provider-safe document text, filename and canonical Registry context. Emit only fields accepted by the Stage 1 projection: document type, confidence, supported labels and a route of STAGE_2 or FINALIZE. Unknown, ambiguous or unsupported facts remain null; human review remains required. The Stage 1 agent cannot set privacy eligibility, rights, approval or effect authorization.

## Stage 2: metadata proposal

Use the same bounded source evidence plus the Stage 1 proposal. Emit only fields accepted by the Stage 2 projection and route deterministically to FINALIZE. Preserve canonical Registry corrections. Unknown or ambiguous metadata remains null and human review remains required.

## Shared safety boundary

Language models produce proposals only. They are not privacy analyzers, Rights/Policy authorities, reviewers, filing providers or cleanup authorities. Native deterministic validators, protected current Case/Decision/Approval bindings and provider readback remain mandatory for any real downstream effect. A successful Agent response or Swarm Run is not an Approval or external-effect acceptance.

## Native execution

Each Agent's inputs are supplied by the Parent Swarm snapshot; retrieval uses this owner-scoped Knowledge Base. Agent Skills and this document are snapshot dependencies at publication time. Editing an Agent later does not mutate any published Swarm or Run snapshot. A changed Agent must be explicitly imported and published as a new Swarm revision.`;

export const DMS_AGENT_DEFINITIONS = {
  triage: {
    id: "e1000000-0000-4000-8000-000000000021",
    name: "aXtn DMS Stage 1 Triage — Reconstruction v1",
    description:
      "Reconstructed new-version Stage 1 triage proposal Agent. Historical Agent payload was not recovered.",
    system_prompt: `You are the Stage 1 proposal agent in the aXtn Document Management Swarm. This is Reconstruction v1, not the historical Agent configuration.

Use only supplied provider-safe document text and canonical DMS context. Use the attached DMS contract Knowledge Base and triage Skill. Return a single JSON object with an "output" property containing only the Stage 1 projection fields defined there. Be conservative: use null for unsupported values, preserve human review, and never claim privacy eligibility, rights, approval or authorization. Do not use tools other than the attached DMS knowledge retrieval.`,
    llm_provider: "openai",
    llm_model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 2048,
    skill_id: DMS_SKILLS[0].id,
  },
  processing: {
    id: "e1000000-0000-4000-8000-000000000022",
    name: "aXtn DMS Stage 2 Metadata — Reconstruction v1",
    description:
      "Reconstructed new-version Stage 2 metadata proposal Agent. Historical Agent payload was not recovered.",
    system_prompt: `You are the Stage 2 proposal agent in the aXtn Document Management Swarm. This is Reconstruction v1, not the historical Agent configuration.

Use only supplied provider-safe document text, the Stage 1 proposal and canonical DMS context. Use the attached DMS contract Knowledge Base and metadata Skill. Return a single JSON object with an "output" property containing only the Stage 2 projection fields defined there. Be conservative: use null for unsupported values, preserve human review, and never claim privacy eligibility, rights, approval or authorization. Do not use tools other than the attached DMS knowledge retrieval.`,
    llm_provider: "openai",
    llm_model: "gpt-4o-mini",
    temperature: 0,
    max_tokens: 2048,
    skill_id: DMS_SKILLS[1].id,
  },
};
