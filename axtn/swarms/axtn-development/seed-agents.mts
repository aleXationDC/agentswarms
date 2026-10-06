import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "../../../src/integrations/supabase/types";
import { createNativeDevelopmentAgents } from "../../../src/lib/axtnDevelopmentAgents";
import { canonicalJson } from "../../../src/utils/provenance/canonical";
import { configHash, toSnapshot } from "../../../src/lib/agentVersions";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
const provider = process.env.AXTN_DEVELOPMENT_PROVIDER;
const model = process.env.AXTN_DEVELOPMENT_MODEL;
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
    "Native authenticated owner, explicit provider/model and exact source revision required",
  );
const ids = (value?: string) =>
  value
    ?.split(",")
    .map((id) => id.trim())
    .filter(Boolean) ?? [];
const definitions = createNativeDevelopmentAgents({
  provider,
  model,
  reviewerUserIds: ids(process.env.AXTN_DEVELOPMENT_REVIEWER_USERS),
  reviewerGroupIds: ids(process.env.AXTN_DEVELOPMENT_REVIEWER_GROUPS),
});
const client = createClient<Database>(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { data: auth, error: loginError } = await client.auth.signInWithPassword({ email, password });
if (loginError || !auth.user) throw new Error("Native owner authentication failed");
for (const { role, agent, memory } of definitions) {
  const { data: prior, error: readError } = await client
    .from("agents")
    .select("*")
    .eq("id", agent.id)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (
    prior &&
    (prior.user_id !== auth.user.id ||
      configHash(toSnapshot(prior)) !== configHash(toSnapshot(agent)))
  )
    throw new Error(`Native Agent drift; operator configuration retained: ${role}`);
  if (!prior) {
    const { error } = await client.from("agents").insert({ ...agent, user_id: auth.user.id });
    if (error) throw new Error(error.message);
  }
  const { data: priorMemory, error: memoryError } = await client
    .from("agent_memory_config")
    .select("*")
    .eq("agent_id", agent.id)
    .maybeSingle();
  if (memoryError) throw new Error(memoryError.message);
  if (
    priorMemory &&
    Object.entries(memory).some(
      ([key, value]) => priorMemory[key as keyof typeof priorMemory] !== value,
    )
  )
    throw new Error(`Native Agent memory drift; operator configuration retained: ${role}`);
  if (!priorMemory) {
    const { error } = await client
      .from("agent_memory_config")
      .insert({ agent_id: agent.id, user_id: auth.user.id, ...memory });
    if (error) throw new Error(error.message);
  }
  const { data: versions, error: versionsError } = await client
    .from("agent_versions")
    .select("id,config")
    .eq("agent_id", agent.id);
  if (versionsError) throw new Error(versionsError.message);
  const snapshot = toSnapshot(agent);
  if (!versions.some((version) => canonicalJson(version.config) === canonicalJson(snapshot))) {
    const { error } = await client.from("agent_versions").insert({
      agent_id: agent.id,
      user_id: auth.user.id,
      kind: "manual",
      label: `Native ${role} · source ${revision}`,
      config: JSON.parse(JSON.stringify(snapshot)) as Json,
    });
    if (error) throw new Error(error.message);
  }
  const { data: readback, error: verifyError } = await client
    .from("agents")
    .select("*")
    .eq("id", agent.id)
    .single();
  if (verifyError || configHash(toSnapshot(readback)) !== configHash(snapshot))
    throw new Error(`Native Agent configuration readback failed: ${role}`);
  console.log(
    JSON.stringify({ role, agentId: agent.id, outcome: prior ? "UNCHANGED" : "CREATED", revision }),
  );
}
