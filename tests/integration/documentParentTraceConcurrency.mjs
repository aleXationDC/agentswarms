import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "./documentTestDatabase.mjs";

const run = randomUUID();
const owner = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const parent = "9b9ea6c2-a554-4fa7-9c40-908dad632ae7";
try {
  await query(`SET ROLE service_role;
    INSERT INTO public.swarm_runs(id,user_id,swarm_id)
    VALUES('${run}','${owner}','${parent}');`);
  await Promise.all(
    Array.from({ length: 16 }, (_, index) =>
      query(`SET ROLE service_role;
        INSERT INTO public.swarm_run_steps(run_id,user_id,node_id,input,output,
          thinking,tool_calls,error_message,tokens_in)
        VALUES('${run}','${owner}','concurrent-${index}',
          '{"text":"CONCURRENT_LEAKAGE_MARKER"}','CONCURRENT_LEAKAGE_MARKER',
          'CONCURRENT_LEAKAGE_MARKER','["CONCURRENT_LEAKAGE_MARKER"]',
          'CONCURRENT_LEAKAGE_MARKER',${index});
        UPDATE public.swarm_run_steps SET output='CONCURRENT_LEAKAGE_MARKER'
          WHERE run_id='${run}' AND node_id='concurrent-${index}';
        INSERT INTO public.swarm_run_edges(run_id,user_id,source_node_id,target_node_id,
          payload_preview,bytes) VALUES('${run}','${owner}',
          'concurrent-${index}','next','CONCURRENT_LEAKAGE_MARKER',${index});`),
    ),
  );
  assert.equal(
    await query(`SELECT jsonb_build_object(
      'steps',(SELECT count(*) FROM public.swarm_run_steps WHERE run_id='${run}'),
      'edges',(SELECT count(*) FROM public.swarm_run_edges WHERE run_id='${run}'),
      'tokens',(SELECT sum(tokens_in) FROM public.swarm_run_steps WHERE run_id='${run}'),
      'bytes',(SELECT sum(bytes) FROM public.swarm_run_edges WHERE run_id='${run}'),
      'leaks',(SELECT count(*) FROM public.swarm_run_steps s WHERE run_id='${run}'
        AND to_jsonb(s)::text LIKE '%CONCURRENT_LEAKAGE_MARKER%')
        +(SELECT count(*) FROM public.swarm_run_edges e WHERE run_id='${run}'
        AND to_jsonb(e)::text LIKE '%CONCURRENT_LEAKAGE_MARKER%'));`),
    '{"bytes": 120, "edges": 16, "leaks": 0, "steps": 16, "tokens": 120}',
  );
  const denied = await Promise.all(
    Array.from({ length: 16 }, () =>
      query(`SET ROLE service_role;
        UPDATE public.swarm_runs SET swarm_id=NULL WHERE id='${run}';`).then(
        () => false,
        (error) => {
          assert.match(error.message, /DOCUMENT_TRACE_IMMUTABLE_RUN_BINDING_REQUIRED/);
          return true;
        },
      ),
    ),
  );
  assert.equal(denied.every(Boolean), true);
  assert.equal(
    await query(`SELECT swarm_id::text FROM public.swarm_runs WHERE id='${run}';`),
    parent,
  );
  console.log(
    "PASS: 16 independent native write/update sessions exclude body markers, retain technical totals, and deny 16 identity downgrade attempts; new-session readback confirms bindings. Scoped Parent traces only.",
  );
} finally {
  await query(`DELETE FROM public.swarm_runs WHERE id='${run}' AND user_id='${owner}';`);
}
