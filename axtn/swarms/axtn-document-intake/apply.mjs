// Applies the versioned aXtn Document Intake function-node bodies to the swarm.
//
// The registration mapping is executed by the swarm runtime, so its real home
// is the `swarms` row. Keeping it only there made it invisible to review and
// impossible to test, which is how the missing technical-fact mapping survived
// a full package. The bodies under `nodes/` are the source of truth; this
// script pushes them into the existing swarm and republishes.
//
// It writes the DRAFT and the PUBLISHED snapshot together, because headless
// runs (the n8n ingress, and this swarm as a sub-swarm) serve the published
// snapshot — updating only the draft would leave production on the old body.
//
// It changes nothing else: node ids, kinds, wiring, labels, the tool node and
// every other swarm are untouched, and it refuses to run if the swarm's shape
// is not what it expects.
//
// Usage (from the repository root, inside the app container network):
//   node axtn/swarms/axtn-document-intake/apply.mjs [--dry-run]

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SWARM_ID = "62bbd9a0-2fb3-4241-828d-584fa76edc74";
const SWARM_NAME = "aXtn Document Intake";

/** Function-node id -> versioned body file. */
const BODIES = {
  intake_validate: "nodes/validate-envelope.js",
  intake_ack: "nodes/registration-ack.js",
};

const dryRun = process.argv.includes("--dry-run");
const baseUrl = process.env.SUPABASE_REST_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !key) {
  throw new Error("SUPABASE_REST_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function rest(pathAndQuery, init = {}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/${pathAndQuery}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${pathAndQuery} -> ${response.status} ${await response.text()}`,
    );
  }
  return response.status === 204 ? null : response.json();
}

function applyBodies(nodes, label) {
  if (!Array.isArray(nodes)) throw new Error(`${label}: expected an array of nodes`);
  let changed = 0;
  const next = nodes.map((node) => {
    const file = BODIES[node.id];
    if (!file) return node;
    if (node.data?.kind !== "function") {
      throw new Error(
        `${label}: node ${node.id} is not a function node; refusing to write into it`,
      );
    }
    const body = readFileSync(path.join(HERE, file), "utf8");
    if (node.data.functionCode === body) return node;
    changed += 1;
    return { ...node, data: { ...node.data, functionCode: body } };
  });
  const missing = Object.keys(BODIES).filter((id) => !nodes.some((node) => node.id === id));
  if (missing.length) throw new Error(`${label}: swarm is missing node(s) ${missing.join(", ")}`);
  return { next, changed };
}

const [swarm] = await rest(
  `swarms?select=id,name,nodes,published_nodes,published_at&id=eq.${SWARM_ID}`,
);
if (!swarm) throw new Error(`Swarm ${SWARM_ID} not found.`);
if (swarm.name !== SWARM_NAME) {
  throw new Error(`Swarm ${SWARM_ID} is "${swarm.name}", expected "${SWARM_NAME}".`);
}
if (!Array.isArray(swarm.published_nodes)) {
  throw new Error("Swarm has never been published; publish it from the canvas first.");
}

const draft = applyBodies(swarm.nodes, "draft");
const published = applyBodies(swarm.published_nodes, "published");

console.log(`draft nodes changed:     ${draft.changed}`);
console.log(`published nodes changed: ${published.changed}`);

if (draft.changed === 0 && published.changed === 0) {
  console.log("Already up to date; nothing written.");
  process.exit(0);
}
if (dryRun) {
  console.log("Dry run: nothing written.");
  process.exit(0);
}

await rest(`swarms?id=eq.${SWARM_ID}`, {
  method: "PATCH",
  headers: { Prefer: "return=minimal" },
  body: JSON.stringify({
    nodes: draft.next,
    published_nodes: published.next,
    published_at: new Date().toISOString(),
  }),
});
console.log("Applied and republished.");
