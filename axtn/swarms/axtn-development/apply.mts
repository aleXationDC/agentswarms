import { createClient } from "@supabase/supabase-js";
import { createNativeDevelopmentSwarm } from "../../../src/lib/axtnDevelopmentSwarm.ts";
import { canonicalJson } from "../../../src/utils/provenance/canonical.ts";

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
const graph = createNativeDevelopmentSwarm({
  provider: process.env.AXTN_DEVELOPMENT_PROVIDER || "openai",
  model: process.env.AXTN_DEVELOPMENT_MODEL || "gpt-4.1-mini",
  reviewerUserIds: ids(process.env.AXTN_DEVELOPMENT_REVIEWER_USERS),
  reviewerGroupIds: ids(process.env.AXTN_DEVELOPMENT_REVIEWER_GROUPS),
});
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { data: auth, error: loginError } = await client.auth.signInWithPassword({ email, password });
if (loginError || !auth.user) throw new Error("Native owner authentication failed");
const swarmId = "ad06e17d-460b-4b65-946a-9b5d78c6fd02";
const { data: prior, error: readError } = await client
  .from("swarms")
  .select("id,user_id,nodes,edges,published_nodes,published_edges,published_at")
  .eq("id", swarmId)
  .maybeSingle();
if (readError) throw new Error(readError.message);
if (prior && prior.user_id !== auth.user.id) throw new Error("Native seed owner mismatch");
const equal = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
if (
  prior &&
  (!equal(prior.nodes, graph.nodes) ||
    !equal(prior.edges, graph.edges) ||
    (prior.published_at &&
      (!equal(prior.published_nodes, graph.nodes) || !equal(prior.published_edges, graph.edges))))
) {
  throw new Error(
    "Native Development graph drift; existing draft, publication and suspended runs retained. Reconcile explicitly through the native Canvas.",
  );
}
if (
  prior &&
  equal(prior.nodes, graph.nodes) &&
  equal(prior.edges, graph.edges) &&
  equal(prior.published_nodes, graph.nodes) &&
  equal(prior.published_edges, graph.edges) &&
  prior.published_at
) {
  console.log(JSON.stringify({ swarmId, nodes: graph.nodes.length, outcome: "UNCHANGED" }));
} else {
  // This uses the existing owner-RLS native Swarm publication columns. No
  // service-role client, alternate graph store or runtime dispatcher.
  const { error } = await client.from("swarms").upsert(
    {
      id: swarmId,
      user_id: auth.user.id,
      name: "aXtn Development Swarm - Native V1",
      description:
        "Native Builder / three Breakers / deterministic Verify / independent SupaCase Approval / bounded PR_READY.",
      nodes: graph.nodes,
      edges: graph.edges,
      published_nodes: graph.nodes,
      published_edges: graph.edges,
      published_at: new Date().toISOString(),
      published_by: auth.user.id,
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
  const { data: published, error: verifyError } = await client
    .from("swarms")
    .select("published_nodes,published_edges,published_at")
    .eq("id", swarmId)
    .single();
  if (
    verifyError ||
    !published ||
    !equal(published.published_nodes, graph.nodes) ||
    !equal(published.published_edges, graph.edges) ||
    !published.published_at
  ) {
    throw new Error("Native publication readback failed");
  }
  console.log(JSON.stringify({ swarmId, nodes: graph.nodes.length, outcome: "PUBLISHED" }));
}
