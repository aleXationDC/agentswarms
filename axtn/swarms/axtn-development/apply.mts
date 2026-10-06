import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/integrations/supabase/types";
import {
  createNativeDevelopmentSwarm,
  DEVELOPMENT_AGENT_ROLES,
  NATIVE_DEVELOPMENT_DESCRIPTION,
  type NativeDevelopmentAgentSnapshot,
} from "../../../src/lib/axtnDevelopmentSwarm.ts";
import { createNativeDevelopmentAgents } from "../../../src/lib/axtnDevelopmentAgents.ts";
import { agentToNodePatch } from "../../../src/lib/agentToSwarmNode.ts";
import { configHash, toSnapshot } from "../../../src/lib/agentVersions.ts";
import { canonicalJson } from "../../../src/utils/provenance/canonicalJson.ts";
import { publishSwarm } from "../../../src/utils/swarmDeploy/operations.server.ts";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (!url || !key || !email || !password) throw new Error("Configured native owner login required");
const ids = (value: string | undefined) =>
  value
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean) ?? [];
const config = {
  provider: process.env.AXTN_DEVELOPMENT_PROVIDER || "openai",
  model: process.env.AXTN_DEVELOPMENT_MODEL || "gpt-4.1-mini",
  reviewerUserIds: ids(process.env.AXTN_DEVELOPMENT_REVIEWER_USERS),
  reviewerGroupIds: ids(process.env.AXTN_DEVELOPMENT_REVIEWER_GROUPS),
};
const definitions = createNativeDevelopmentAgents(config);
const client = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { data: auth, error: loginError } = await client.auth.signInWithPassword({ email, password });
if (loginError || !auth.user || !auth.session?.access_token)
  throw new Error("Native owner authentication failed");

const roleSnapshots: Partial<
  Record<(typeof DEVELOPMENT_AGENT_ROLES)[number], NativeDevelopmentAgentSnapshot>
> = {};
for (const { role, agent } of definitions) {
  const { data: savedAgent, error: agentError } = await client
    .from("agents")
    .select("*")
    .eq("id", agent.id)
    .maybeSingle();
  if (agentError) throw new Error(agentError.message);
  if (!savedAgent || savedAgent.user_id !== auth.user.id)
    throw new Error(`Saved native Development Agent is missing or not owner-bound: ${role}`);
  const savedConfig = toSnapshot({ ...savedAgent });
  if (configHash(savedConfig) !== configHash(toSnapshot({ ...agent })))
    throw new Error(`Saved native Development Agent config drift: ${role}`);

  const { data: memory, error: memoryError } = await client
    .from("agent_memory_config")
    .select("stm_enabled,stm_window_messages,ltm_enabled")
    .eq("agent_id", agent.id)
    .maybeSingle();
  if (memoryError) throw new Error(memoryError.message);
  if (
    !memory ||
    memory.stm_enabled !== false ||
    memory.stm_window_messages !== 20 ||
    memory.ltm_enabled !== false
  )
    throw new Error(`Saved native Development Agent memory is missing or changed: ${role}`);

  const { data: versions, error: versionsError } = await client
    .from("agent_versions")
    .select("id,config,created_at")
    .eq("agent_id", agent.id)
    .order("created_at", { ascending: false });
  if (versionsError) throw new Error(versionsError.message);
  const version = versions.find(
    (candidate) => canonicalJson(candidate.config) === canonicalJson(savedConfig),
  );
  if (!version) throw new Error(`Exact saved Development Agent version is unavailable: ${role}`);

  const imported = agentToNodePatch({ ...savedAgent, memory });
  if (imported.dropped.length)
    throw new Error(`Saved Development Agent has non-transferable settings: ${role}`);
  const snapshotFingerprint = createHash("sha256")
    .update(canonicalJson({ configuration: savedConfig, memory }))
    .digest("hex");
  roleSnapshots[role] = {
    agentId: savedAgent.id,
    versionId: version.id,
    configHash: snapshotFingerprint,
    agent: { ...savedAgent, memory },
  };
}

const graph = createNativeDevelopmentSwarm({ ...config, agentSnapshots: roleSnapshots });
const baseline = createNativeDevelopmentSwarm(config);
const swarmId = "ad06e17d-460b-4b65-946a-9b5d78c6fd02";
const legacyDescription =
  "Native Builder / three Breakers / deterministic Verify / independent SupaCase Approval / bounded PR_READY.";
const equal = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const normalizeRoleBindings = (nodes: unknown) => {
  if (!Array.isArray(nodes)) return nodes;
  return nodes.map((item) => {
    if (!item || typeof item !== "object") return item;
    const node = structuredClone(item) as {
      id?: string;
      data?: Record<string, unknown>;
    };
    if (!DEVELOPMENT_AGENT_ROLES.includes(node.id as (typeof DEVELOPMENT_AGENT_ROLES)[number]))
      return node;
    const data = node.data;
    if (!data) return node;
    delete data.agentSnapshot;
    if (data.agentId === null) delete data.agentId;
    if (data.knowledgeBaseId === null) delete data.knowledgeBaseId;
    if (data.reranker === null) delete data.reranker;
    if (data.maxTokens === 4096) delete data.maxTokens;
    if (
      data.memory &&
      typeof data.memory === "object" &&
      (data.memory as Record<string, unknown>).stm_window_messages === 20
    ) {
      const memory = { ...(data.memory as Record<string, unknown>) };
      delete memory.stm_window_messages;
      data.memory = memory;
    }
    return node;
  });
};
const sameGraph = (leftNodes: unknown, leftEdges: unknown, right: typeof graph) =>
  equal(normalizeRoleBindings(leftNodes), normalizeRoleBindings(right.nodes)) &&
  equal(leftEdges, right.edges);

const { data: prior, error: readError } = await client
  .from("swarms")
  .select(
    "id,user_id,name,description,nodes,edges,published_nodes,published_edges,published_at,published_version_id,updated_at",
  )
  .eq("id", swarmId)
  .maybeSingle();
if (readError) throw new Error(readError.message);
if (prior && prior.user_id !== auth.user.id) throw new Error("Native seed owner mismatch");
if (prior && !sameGraph(prior.nodes, prior.edges, baseline))
  throw new Error("Native Development draft drift; operator edits and suspended runs retained.");
if (prior?.published_at && !sameGraph(prior.published_nodes, prior.published_edges, baseline))
  throw new Error("Native Development publication drift; prior snapshot retained.");

if (!prior) {
  const { error } = await client.from("swarms").insert({
    id: swarmId,
    user_id: auth.user.id,
    name: "aXtn Development Swarm - Native V1",
    description: NATIVE_DEVELOPMENT_DESCRIPTION,
    nodes: graph.nodes,
    edges: graph.edges,
  });
  if (error) throw new Error(error.message);
} else {
  const needsDescriptionUpdate = prior.description === legacyDescription;
  if (
    !equal(prior.nodes, graph.nodes) ||
    !equal(prior.edges, graph.edges) ||
    needsDescriptionUpdate
  ) {
    const { data: updated, error } = await client
      .from("swarms")
      .update({
        nodes: graph.nodes,
        edges: graph.edges,
        ...(needsDescriptionUpdate ? { description: NATIVE_DEVELOPMENT_DESCRIPTION } : {}),
      })
      .eq("id", swarmId)
      .eq("updated_at", prior.updated_at)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated)
      throw new Error("Native Development changed during reconciliation; no publication made.");
  }
}

const alreadyPublished =
  prior?.published_at &&
  prior.published_version_id &&
  equal(prior.published_nodes, graph.nodes) &&
  equal(prior.published_edges, graph.edges);
let outcome = "UNCHANGED";
if (!alreadyPublished) {
  const result = await publishSwarm(auth.session.access_token, swarmId);
  if (!result.ok) throw new Error(result.error);
  outcome = "PUBLISHED";
}
const { data: published, error: verifyError } = await client
  .from("swarms")
  .select("published_nodes,published_edges,published_at,published_version_id")
  .eq("id", swarmId)
  .single();
if (
  verifyError ||
  !published ||
  !equal(published.published_nodes, graph.nodes) ||
  !equal(published.published_edges, graph.edges) ||
  !published.published_at ||
  !published.published_version_id
) {
  throw new Error("Native Development versioned publication readback failed");
}
console.log(
  JSON.stringify({
    swarmId,
    nodes: graph.nodes.length,
    savedAgentSnapshots: Object.keys(roleSnapshots).length,
    publishedVersionId: published.published_version_id,
    outcome,
  }),
);
