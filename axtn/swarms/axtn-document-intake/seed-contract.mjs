import {
  buildIntakeGraph,
  canonicalEdgeIds,
  canonicalNodeIds,
  intakeEdgeIds,
  intakeNodeIds,
  SWARM_ID,
  SWARM_NAME,
} from "./graph.mjs";

function sameSet(actual, expected) {
  return (
    Array.isArray(actual) &&
    actual.length === expected.length &&
    new Set(actual).size === expected.length &&
    expected.every((value) => actual.includes(value))
  );
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

function equal(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function assertIdentity(row, userId) {
  if (row.id !== SWARM_ID || row.name !== SWARM_NAME || row.user_id !== userId) {
    throw new Error(
      "Document Intake seed identity or owner differs from the canonical definition.",
    );
  }
}

function assertKnownShape(nodes, edges) {
  const nodeIds = Array.isArray(nodes) ? nodes.map((node) => node?.id) : [];
  const edgeIds = Array.isArray(edges) ? edges.map((edge) => edge?.id) : [];
  const intake = sameSet(nodeIds, intakeNodeIds()) && sameSet(edgeIds, intakeEdgeIds());
  const lifecycle = sameSet(nodeIds, canonicalNodeIds()) && sameSet(edgeIds, canonicalEdgeIds());
  if (!intake && !lifecycle) {
    throw new Error(
      "Document Intake graph shape is not a known version; refusing to overwrite it.",
    );
  }
}

function versionedNodes(nodes) {
  const graphNodes = buildIntakeGraph().nodes;
  const bodies = new Map(
    graphNodes
      .filter((node) => node.id === "intake_validate" || node.id === "intake_ack")
      .map((node) => [node.id, node.data.functionCode]),
  );
  let changed = false;
  const next = nodes.map((node) => {
    if (!bodies.has(node.id)) return node;
    if (node.data?.kind !== "function") {
      throw new Error(`Document Intake node ${node.id} is not a function node.`);
    }
    const functionCode = bodies.get(node.id);
    if (node.data.functionCode === functionCode) return node;
    changed = true;
    return { ...node, data: { ...node.data, functionCode } };
  });
  for (const id of bodies.keys()) {
    if (!nodes.some((node) => node.id === id)) {
      throw new Error(`Document Intake graph is missing node ${id}.`);
    }
  }
  return { nodes: next, changed };
}

function seedRow(userId) {
  const graph = buildIntakeGraph();
  return {
    id: SWARM_ID,
    user_id: userId,
    name: SWARM_NAME,
    description: "Versioned aXtn DMS intake and deterministic registration acknowledgement.",
    nodes: graph.nodes,
    edges: graph.edges,
  };
}

export async function seedDocumentIntake({ userId, store, publish }) {
  let row = await store.get(SWARM_ID);
  let created = false;
  if (!row) {
    try {
      row = await store.insert(seedRow(userId));
      created = true;
    } catch (error) {
      if (error?.code !== "23505") throw error;
      row = await store.get(SWARM_ID);
      if (!row) throw error;
    }
  }
  assertIdentity(row, userId);
  assertKnownShape(row.nodes, row.edges);
  if (Array.isArray(row.published_nodes) || Array.isArray(row.published_edges)) {
    assertKnownShape(row.published_nodes, row.published_edges);
  }

  const needsPublish =
    created || !Array.isArray(row.published_nodes) || !Array.isArray(row.published_edges);
  if (needsPublish) await publish(SWARM_ID, userId);
  return { created, published: needsPublish };
}

export async function applyDocumentIntake({ userId, store, publish }) {
  const row = await store.get(SWARM_ID);
  if (!row) throw new Error("Document Intake is not seeded; run seed.mjs first.");
  assertIdentity(row, userId);
  assertKnownShape(row.nodes, row.edges);

  const draft = versionedNodes(row.nodes);
  const needsPublish =
    draft.changed ||
    !Array.isArray(row.published_nodes) ||
    !Array.isArray(row.published_edges) ||
    !equal(row.published_nodes, draft.nodes) ||
    !equal(row.published_edges, row.edges);
  if (draft.changed) await store.updateDraft(SWARM_ID, draft.nodes);
  if (needsPublish) await publish(SWARM_ID, userId);
  return { changed: draft.changed, published: needsPublish };
}
