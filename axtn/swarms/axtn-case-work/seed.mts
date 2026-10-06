import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type { Database, Json } from "../../../src/integrations/supabase/types";
import { caseWorkAgent, createNativeCaseWorkSwarms } from "../../../src/lib/axtnCaseWorkSwarm";
import { toSnapshot } from "../../../src/lib/agentVersions";
import { canonicalJson } from "../../../src/utils/provenance/canonical";
import { publishSwarm } from "../../../src/utils/swarmDeploy/operations.server";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const provider = process.env.AXTN_CASE_WORK_PROVIDER;
const model = process.env.AXTN_CASE_WORK_MODEL;
const revision = process.env.AXTN_SOURCE_REVISION;
if (
  !url ||
  !key ||
  !email ||
  !password ||
  !provider ||
  !model ||
  !revision?.match(/^[a-f0-9]{40}$/)
)
  throw new Error(
    "Authenticated native owner, explicit existing provider/model and exact source revision required",
  );
const client = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { data: auth, error: loginError } = await client.auth.signInWithPassword({ email, password });
if (loginError || !auth.user || !auth.session)
  throw new Error("Native owner authentication failed");
const agent = caseWorkAgent(provider, model);
const { data: priorAgent, error: agentError } = await client
  .from("agents")
  .select("*")
  .eq("id", agent.id)
  .maybeSingle();
if (agentError) throw new Error(agentError.message);
if (
  priorAgent &&
  (priorAgent.user_id !== auth.user.id ||
    canonicalJson(toSnapshot(priorAgent)) !== canonicalJson(toSnapshot(agent)))
)
  throw new Error("Native Case Worker drift; operator configuration retained");
if (!priorAgent) {
  const { error } = await client.from("agents").insert({ ...agent, user_id: auth.user.id });
  if (error) throw new Error(error.message);
}
const { data: memory, error: memoryError } = await client
  .from("agent_memory_config")
  .select("stm_enabled,ltm_enabled")
  .eq("agent_id", agent.id)
  .maybeSingle();
if (memoryError) throw new Error(memoryError.message);
if (memory?.stm_enabled || memory?.ltm_enabled)
  throw new Error("Native Case Worker memory drift; retained");
if (!memory) {
  const { error } = await client.from("agent_memory_config").insert({
    agent_id: agent.id,
    user_id: auth.user.id,
    stm_enabled: false,
    ltm_enabled: false,
    stm_summarize: false,
    ltm_auto_extract: false,
  });
  if (error) throw new Error(error.message);
}
const snapshot = toSnapshot(agent);
const { data: versions, error: versionError } = await client
  .from("agent_versions")
  .select("id,config")
  .eq("agent_id", agent.id);
if (versionError) throw new Error(versionError.message);
let versionId = versions.find(
  (version) => canonicalJson(version.config) === canonicalJson(snapshot),
)?.id;
if (!versionId) {
  const { data, error } = await client
    .from("agent_versions")
    .insert({
      agent_id: agent.id,
      user_id: auth.user.id,
      kind: "manual",
      label: `Native Case Worker · source ${revision}`,
      config: JSON.parse(JSON.stringify(snapshot)) as Json,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Native Case Worker version readback failed");
  versionId = data.id;
}
const graphs = createNativeCaseWorkSwarms(agent);
const hash = createHash("sha256").update(canonicalJson(snapshot)).digest("hex");
graphs.proposal.nodes[0].data.agentSnapshot = { agentId: agent.id, versionId, configHash: hash };
for (const graph of [graphs.proposal, graphs.parent]) {
  const { data: prior, error: readError } = await client
    .from("swarms")
    .select(
      "id,user_id,nodes,edges,published_nodes,published_edges,published_at,published_version_id",
    )
    .eq("id", graph.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  const equal = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
  if (
    prior &&
    (prior.user_id !== auth.user.id ||
      !equal(prior.nodes, graph.nodes) ||
      !equal(prior.edges, graph.edges) ||
      (prior.published_at &&
        (!equal(prior.published_nodes, graph.nodes) || !equal(prior.published_edges, graph.edges))))
  )
    throw new Error(
      `Native Case Work graph drift; existing draft/publication retained: ${graph.id}`,
    );
  if (!prior) {
    const { error } = await client.from("swarms").insert({
      id: graph.id,
      user_id: auth.user.id,
      name: graph.name,
      description: graph.description,
      nodes: JSON.parse(JSON.stringify(graph.nodes)) as Json,
      edges: JSON.parse(JSON.stringify(graph.edges)) as Json,
    });
    if (error) throw new Error(error.message);
  }
  if (!prior?.published_at || !prior.published_version_id) {
    const result = await publishSwarm(auth.session.access_token, graph.id);
    if (!result.ok) throw new Error(result.error);
  }
  const { data: readback, error } = await client
    .from("swarms")
    .select("published_nodes,published_edges,published_version_id")
    .eq("id", graph.id)
    .single();
  if (
    error ||
    !readback?.published_version_id ||
    !equal(readback.published_nodes, graph.nodes) ||
    !equal(readback.published_edges, graph.edges)
  )
    throw new Error(`Native Case Work publication readback failed: ${graph.id}`);
  console.log(
    JSON.stringify({
      swarmId: graph.id,
      publishedVersionId: readback.published_version_id,
      outcome: prior ? "UNCHANGED" : "CREATED",
      revision,
    }),
  );
}
