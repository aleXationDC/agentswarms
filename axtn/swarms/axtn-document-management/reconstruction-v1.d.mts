export const DMS_RECONSTRUCTION_VERSION: string;
export const DMS_KNOWLEDGE_BASE_ID: string;
export const DMS_KNOWLEDGE_DOCUMENT_ID: string;
export const DMS_KB_CONTENT: string;
export const DMS_SKILLS: Array<{
  id: string;
  name: string;
  description: string;
  tags: string[];
  body: string;
}>;
export const DMS_AGENT_DEFINITIONS: {
  triage: {
    id: string;
    name: string;
    description: string;
    system_prompt: string;
    llm_provider: string;
    llm_model: string;
    temperature: number;
    max_tokens: number;
    skill_id: string;
  };
  processing: {
    id: string;
    name: string;
    description: string;
    system_prompt: string;
    llm_provider: string;
    llm_model: string;
    temperature: number;
    max_tokens: number;
    skill_id: string;
  };
};
