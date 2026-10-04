// Persistence for swarm run checkpoints. The shape and the (de)serialisation
// live in src/lib/swarmCheckpoint.ts; this is only the database half.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fromRow, toRow, type CheckpointRow, type SwarmCheckpoint } from "@/lib/swarmCheckpoint";

/**
 * Write the run's position. Overwrites in place — the checkpoint is where the
 * run is now; swarm_run_steps is the history.
 *
 * Generic runs retain best-effort persistence. Protected native Approvals set
 * required so a failed write cannot pretend that suspend/resume is durable.
 */
export async function saveCheckpoint(args: {
  runId: string;
  userId: string;
  checkpoint: SwarmCheckpoint;
  source: string;
  depth: number;
  required?: boolean;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("swarm_run_checkpoints").upsert(
      {
        run_id: args.runId,
        user_id: args.userId,
        source: args.source,
        depth: args.depth,
        ...toRow(args.checkpoint),
        suspended_at: args.checkpoint.suspendedNodeId ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "run_id" },
    );
    if (error) {
      if (args.required) throw new Error(`Native Approval checkpoint failed: ${error.message}`);
      console.warn("[swarmCheckpoint] save failed:", error.message);
    }
  } catch (e) {
    if (args.required) throw e;
    console.warn("[swarmCheckpoint] save threw:", (e as Error).message);
  }
}

/** Load a run's checkpoint, scoped to its owner. Null when there isn't one. */
export async function loadCheckpoint(
  runId: string,
  userId: string,
  required = false,
): Promise<SwarmCheckpoint | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("swarm_run_checkpoints")
      .select(
        "ctx, last_output, completed_node_ids, skipped_node_ids, dead_edge_ids, level_index, suspended_node_id",
      )
      .eq("run_id", runId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error && required)
      throw new Error(`Native Approval checkpoint read failed: ${error.message}`);
    return fromRow((data ?? null) as CheckpointRow | null);
  } catch (e) {
    if (required) throw e;
    console.warn("[swarmCheckpoint] load threw:", (e as Error).message);
    return null;
  }
}

/**
 * Drop the checkpoint once a run reaches a terminal state.
 *
 * Kept deliberately: leaving it behind would let a finished run be "resumed",
 * re-running whatever came after the last node — and the run row plus its steps
 * are the durable record, so nothing is lost by removing it.
 */
export async function clearCheckpoint(runId: string): Promise<void> {
  try {
    await supabaseAdmin.from("swarm_run_checkpoints").delete().eq("run_id", runId);
  } catch (e) {
    console.warn("[swarmCheckpoint] clear threw:", (e as Error).message);
  }
}
