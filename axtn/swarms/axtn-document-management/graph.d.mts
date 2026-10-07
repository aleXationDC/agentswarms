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
  nodePatch: Record<string, unknown>;
  agentSnapshot: {
    agentId: string;
    versionId: string;
    configHash: string;
  };
};
export function buildPrivacyGraph(): NativeGraph;
export function buildParentGraph(config: {
  triage: RecoveredDocumentAgent;
  processing: RecoveredDocumentAgent;
}): NativeGraph;
