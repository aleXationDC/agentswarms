export const SWARM_ID: string;
export const SWARM_NAME: string;
export function buildIntakeGraph(): {
  nodes: Array<{ id: string; data: Record<string, unknown> }>;
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
};
export function buildCaseBoundIntakeGraph(): ReturnType<typeof buildIntakeGraph>;
export function intakeNodeIds(): string[];
export function intakeEdgeIds(): string[];
export function canonicalNodeIds(): string[];
export function canonicalEdgeIds(): string[];
