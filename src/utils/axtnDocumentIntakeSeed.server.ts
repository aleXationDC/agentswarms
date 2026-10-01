import {
  applyDocumentIntake,
  seedDocumentIntake,
} from "../../axtn/swarms/axtn-document-intake/seed-contract.mjs";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { publishSwarmForOwner } from "@/utils/swarmDeploy/operations.server";
import type { Json } from "@/integrations/supabase/types";

function requireNoError(error: { message: string; code?: string } | null): void {
  if (error) {
    const failure = new Error(error.message);
    Object.assign(failure, { code: error.code });
    throw failure;
  }
}

const store = {
  async get(id: string) {
    const { data, error } = await supabaseAdmin
      .from("swarms")
      .select("id, name, user_id, nodes, edges, published_nodes, published_edges")
      .eq("id", id)
      .maybeSingle();
    requireNoError(error);
    return data;
  },
  async insert(row: {
    id: string;
    user_id: string;
    name: string;
    description: string;
    nodes: Json;
    edges: Json;
  }) {
    const { data, error } = await supabaseAdmin
      .from("swarms")
      .insert(row)
      .select("id, name, user_id, nodes, edges, published_nodes, published_edges")
      .single();
    requireNoError(error);
    if (!data) throw new Error("Swarm seed insert returned no row.");
    return data;
  },
  async updateDraft(id: string, nodes: Json) {
    const { error } = await supabaseAdmin.from("swarms").update({ nodes }).eq("id", id);
    requireNoError(error);
  },
};

async function publish(id: string, userId: string): Promise<void> {
  const result = await publishSwarmForOwner(id, userId);
  if (!result.ok) throw new Error(`Native swarm publish failed: ${result.error}`);
}

export async function seedAxtnDocumentIntake(userId: string) {
  return seedDocumentIntake({ userId, store, publish });
}

export async function applyAxtnDocumentIntake(userId: string) {
  return applyDocumentIntake({ userId, store, publish });
}
