type SwarmGraphNode = {
  id?: string;
  data?: {
    kind?: string;
    toolId?: string;
    subSwarmId?: string | null;
  };
};

export type SwarmUsageRow = {
  id: string;
  name: string;
  nodes: unknown;
  edges: unknown;
  published_nodes?: unknown;
  published_edges?: unknown;
  published_at?: string | null;
};

export type SwarmUsage = {
  category: "workflow" | "component" | "standalone" | "draft";
  referencedBy: string[];
  nodes: unknown;
  edges: unknown;
};

function graphNodes(value: unknown): SwarmGraphNode[] {
  return Array.isArray(value) ? (value as SwarmGraphNode[]) : [];
}

function graphEdges(value: unknown): { source?: string; target?: string }[] {
  return Array.isArray(value) ? (value as { source?: string; target?: string }[]) : [];
}

export function classifySwarmUsage(swarms: SwarmUsageRow[]): Map<string, SwarmUsage> {
  const byId = new Map(swarms.map((swarm) => [swarm.id, swarm]));
  const children = new Map<string, Set<string>>();
  for (const parent of swarms) {
    if (!parent.published_at) continue;
    const nodes = graphNodes(parent.published_nodes);
    const edges = graphEdges(parent.published_edges);
    for (const node of nodes) {
      const childId = node.data?.subSwarmId;
      if (
        node.data?.kind !== "subswarm" ||
        typeof childId !== "string" ||
        !byId.has(childId) ||
        !node.id ||
        !edges.some((edge) => edge.source === node.id || edge.target === node.id)
      )
        continue;
      const parents = children.get(childId) ?? new Set<string>();
      parents.add(parent.name);
      children.set(childId, parents);
    }
  }

  return new Map(
    swarms.map((swarm) => {
      const published = Boolean(swarm.published_at);
      const nodes = published ? swarm.published_nodes : swarm.nodes;
      const edges = published ? swarm.published_edges : swarm.edges;
      const graph = graphNodes(nodes);
      const edgesInGraph = graphEdges(edges);
      const graphIds = new Set(graph.flatMap((node) => (node.id ? [node.id] : [])));
      const hasExecutableComposition = graph.some(
        (node) =>
          (node.data?.kind === "subswarm" || node.data?.toolId === "case_work") &&
          Boolean(node.id) &&
          edgesInGraph.some((edge) => edge.source === node.id || edge.target === node.id),
      );
      const hasEntryAndResult =
        graph.some((node) => node.data?.kind === "input") &&
        graph.some((node) => node.data?.kind === "output") &&
        edgesInGraph.length > 0 &&
        edgesInGraph.every(
          (edge) =>
            !edge.source ||
            !edge.target ||
            (graphIds.has(edge.source) && graphIds.has(edge.target)),
        );
      const parents = [...(children.get(swarm.id) ?? [])].sort((a, b) => a.localeCompare(b));
      const category: SwarmUsage["category"] = parents.length
        ? "component"
        : !published
          ? "draft"
          : hasExecutableComposition || hasEntryAndResult
            ? "workflow"
            : "standalone";
      return [
        swarm.id,
        {
          category,
          referencedBy: parents,
          nodes,
          edges,
        },
      ];
    }),
  );
}
