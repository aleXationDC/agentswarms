export const PARENT_ID: string;
export const PARENT_NAME: string;
export const PRIVACY_ID: string;
export const PRIVACY_NAME: string;
export const CLEANUP_ID: string;
export const CLEANUP_NAME: string;
export type NativeGraph = {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown> & { functionCode?: string; inputs?: string[] };
  }>;
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
};
export type RecoveredDocumentAgent = {
  id: string;
  llm_provider: string;
  llm_model: string;
  system_prompt: string | null;
  temperature: number;
  knowledge_base_id?: string | null;
  tools?: { skillIds?: string[] };
};
export function buildPrivacyGraph(): NativeGraph;
export function buildParentGraph(config: {
  triage: RecoveredDocumentAgent;
  processing: RecoveredDocumentAgent;
}): NativeGraph;
