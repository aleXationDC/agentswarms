import {
  buildIntakeGraph,
  buildCaseBoundIntakeGraph,
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
  const bound = buildCaseBoundIntakeGraph();
  const caseIntake =
    sameSet(
      nodeIds,
      bound.nodes.map((node) => node.id),
    ) &&
    sameSet(
      edgeIds,
      bound.edges.map((edge) => edge.id),
    );
  if (!intake && !lifecycle && !caseIntake) {
    throw new Error(
      "Document Intake graph shape is not a known version; refusing to overwrite it.",
    );
  }
}

function versionedNodes(nodes) {
  const graphNodes = nodes.some((node) => node.id === "intake_case")
    ? buildCaseBoundIntakeGraph().nodes
    : buildIntakeGraph().nodes;
  const bodies = new Map(
    graphNodes
      .filter((node) => node.type === "function")
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

export async function seedDocumentCaseIntake({ userId, store, publish }) {
  const graph = buildCaseBoundIntakeGraph();
  let row = await store.get(SWARM_ID);
  let created = false;
  if (!row) {
    try {
      row = await store.insert({ ...seedRow(userId), nodes: graph.nodes, edges: graph.edges });
      created = true;
    } catch (error) {
      if (error?.code !== "23505") throw error;
      row = await store.get(SWARM_ID);
      if (!row) throw error;
    }
  }
  assertIdentity(row, userId);
  assertKnownShape(row.nodes, row.edges);
  if (row.nodes.length === canonicalNodeIds().length)
    throw new Error("Recover the standalone Parent before replacing a full lifecycle Intake.");
  if (row.published_nodes || row.published_edges)
    assertKnownShape(row.published_nodes, row.published_edges);
  const changed = !equal(row.nodes, graph.nodes) || !equal(row.edges, graph.edges);
  const needsPublish =
    changed || !equal(row.published_nodes, graph.nodes) || !equal(row.published_edges, graph.edges);
  if (changed) await store.updateDraft(SWARM_ID, graph.nodes, graph.edges);
  if (needsPublish) await publish(SWARM_ID, userId);
  return { created, changed, published: needsPublish };
}
