import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "./documentTestDatabase.mjs";

const owner = randomUUID();
const run = randomUUID();
const trace = randomUUID();
try {
  await query(`INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
      VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
      ON CONFLICT(id) DO NOTHING;
    INSERT INTO auth.users(id,aud,role,email)
      VALUES('${owner}','authenticated','authenticated','${owner}@example.invalid');
    SET ROLE service_role;
    INSERT INTO public.swarm_runs(id,user_id,swarm_id)
      VALUES('${run}','${owner}','9b9ea6c2-a554-4fa7-9c40-908dad632ae7');`);
  await Promise.all(
    Array.from({ length: 16 }, () =>
      query(`SET ROLE service_role;
        INSERT INTO public.execution_traces(id,user_id,decision_id,agent_name,llm_model,
          prompt,request_payload,response_payload,tool_calls,error_message,tokens_in,cost_usd)
        VALUES('${trace}','${owner}','${run}','fixture-agent','fixture-model',
          'CONCURRENT_MODEL_MARKER','{"x":"CONCURRENT_MODEL_MARKER"}',
          '{"x":"CONCURRENT_MODEL_MARKER"}','["CONCURRENT_MODEL_MARKER"]',
          'CONCURRENT_MODEL_MARKER',7,0.25)
        ON CONFLICT(id) DO UPDATE SET prompt=EXCLUDED.prompt,
          request_payload=EXCLUDED.request_payload,response_payload=EXCLUDED.response_payload,
          tool_calls=EXCLUDED.tool_calls,error_message=EXCLUDED.error_message;`),
    ),
  );
  assert.equal(
    await query(`SELECT jsonb_build_object('rows',count(*),'tokens',sum(tokens_in),
      'cost',sum(cost_usd),'leaks',count(*) FILTER(
        WHERE to_jsonb(t)::text LIKE '%CONCURRENT_MODEL_MARKER%'))
      FROM public.execution_traces t WHERE id='${trace}' AND user_id='${owner}';`),
    '{"cost": 0.250000, "rows": 1, "leaks": 0, "tokens": 7}',
  );
  const denied = await Promise.all(
    Array.from({ length: 16 }, () =>
      query(`SET ROLE service_role;
        UPDATE public.execution_traces SET decision_id=NULL,prompt='CONCURRENT_MODEL_MARKER'
          WHERE id='${trace}';`).then(
        () => false,
        (error) => {
          assert.match(error.message, /DOCUMENT_MODEL_TRACE_IMMUTABLE_BINDING_REQUIRED/);
          return true;
        },
      ),
    ),
  );
  assert.equal(denied.every(Boolean), true);
  assert.equal(
    await query(`SELECT decision_id::text FROM public.execution_traces WHERE id='${trace}';`),
    run,
  );
  console.log(
    "PASS: 16 native model upsert sessions preserve one redacted trace and exact usage/cost; 16 detach/injection attempts denied, protected run identity retained by new-session readback. Correlated Parent only.",
  );
} finally {
  await query(`DELETE FROM public.execution_traces WHERE id='${trace}' AND user_id='${owner}';
    DELETE FROM public.swarm_runs WHERE id='${run}' AND user_id='${owner}';
    DELETE FROM auth.users WHERE id='${owner}';`);
}
