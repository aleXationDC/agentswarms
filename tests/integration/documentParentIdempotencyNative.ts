import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { query } from "./documentTestDatabase.mjs";
import {
  documentRunError,
  documentRunOutput,
} from "@/axtn/workbenches/documents/documentPersistence.server";

const parent = "9b9ea6c2-a554-4fa7-9c40-908dad632ae7";
const owner = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const key = randomUUID();
const run = randomUUID();
const other = randomUUID();
const delivery = `cache-contract:${randomUUID()}`;
const quote = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
let createdSwarm = false;
try {
  await query(`INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
      VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms — How-To Guide',true)
      ON CONFLICT(id) DO NOTHING;
    INSERT INTO auth.users(id,aud,role,email)
      VALUES('${owner}','authenticated','authenticated','cache-contract@example.invalid')
      ON CONFLICT(id) DO NOTHING;`);
  const prior = await query(`SELECT user_id::text FROM public.swarms WHERE id='${parent}'`);
  assert(prior === "" || prior === owner, "Isolated Parent fixture owner mismatch");
  if (!prior) {
    await query(`SET ROLE service_role;
      INSERT INTO public.swarms(id,user_id,name)
        VALUES('${parent}','${owner}','isolated-cache-contract');`);
    createdSwarm = true;
  }
  await query(`SET ROLE service_role;
    INSERT INTO public.swarm_api_keys(id,user_id,swarm_id,name,key_hash,key_prefix)
      VALUES('${key}','${owner}','${parent}','isolated-cache-contract','${key}','fixture');
    INSERT INTO public.swarm_runs(id,user_id,swarm_id)
      VALUES('${run}','${owner}','${parent}');
    INSERT INTO public.swarm_run_idempotency(api_key_id,idempotency_key,request_hash)
      VALUES('${key}','${delivery}','fixture-request-hash');`);
  for (const [status, cacheStatus] of [
    ["suspended", "in_progress"],
    ["success", "completed"],
    ["error", "failed"],
  ] as const) {
    const body = {
      runId: run,
      swarmId: parent,
      status,
      output: documentRunOutput(parent, status, "ORIGINAL_LEAKAGE_MARKER"),
      error: status === "error" ? documentRunError(parent, "ORIGINAL_LEAKAGE_MARKER") : null,
    };
    await query(`SET ROLE service_role;
      UPDATE public.swarm_run_idempotency SET run_id='${run}',status='${cacheStatus}',
        response=${quote(body)} WHERE api_key_id='${key}' AND idempotency_key='${delivery}';`);
    assert.deepEqual(
      JSON.parse(
        await query(`SELECT response FROM public.swarm_run_idempotency
          WHERE api_key_id='${key}' AND idempotency_key='${delivery}'`),
      ),
      body,
    );
  }

  const source = readFileSync(
    "src/axtn/workbenches/documents/documentPersistence.server.ts",
    "utf8",
  );
  const codes = new Set([
    "ORIGINAL_LEAKAGE_MARKER",
    "DOCUMENT_FAKE_LEAKAGE_MARKER",
    "DOCUMENT_CHECKPOINT_WRITE_FAILED ORIGINAL_LEAKAGE_MARKER",
    ...Array.from(source.matchAll(/"(DOCUMENT_[A-Z_]+)"/g), ([, code]) => code),
  ]);
  let accepted = 0;
  let rejected = 0;
  for (const code of codes) {
    const expected = documentRunError(parent, code) === code;
    const body = {
      runId: run,
      status: "error",
      output: documentRunOutput(parent, "error", ""),
      error: code,
    };
    try {
      await query(`SET ROLE service_role;
        UPDATE public.swarm_run_idempotency SET response=${quote(body)}
          WHERE api_key_id='${key}' AND idempotency_key='${delivery}';`);
      assert(expected, "Database admitted a diagnostic rejected by the actual native codec");
      accepted++;
    } catch (error) {
      if (expected) throw error;
      assert(error instanceof Error);
      assert.match(error.message, /DOCUMENT_CACHE_MINIMIZED_RESPONSE_REQUIRED/);
      assert(!error.message.includes("ORIGINAL_LEAKAGE_MARKER"));
      rejected++;
    }
  }
  assert(accepted > 0 && rejected > 0);

  const completed = {
    runId: run,
    status: "success",
    output: documentRunOutput(parent, "success", ""),
    error: null,
  };
  const write = () =>
    query(`SET ROLE service_role;
      INSERT INTO public.swarm_run_idempotency(api_key_id,idempotency_key,request_hash,
        run_id,status,response)
        VALUES('${key}','${delivery}','fixture-request-hash','${run}','completed',
          ${quote(completed)})
        ON CONFLICT(api_key_id,idempotency_key) DO UPDATE
          SET status=EXCLUDED.status,response=EXCLUDED.response;`);
  const denyKey = () =>
    query(`SET ROLE service_role;
        UPDATE public.swarm_api_keys SET swarm_id='${other}' WHERE id='${key}';`).then(
      () => false,
      (error: Error) => {
        assert.match(error.message, /DOCUMENT_CACHE_IMMUTABLE_KEY_BINDING_REQUIRED/);
        return true;
      },
    );
  const denyRun = () =>
    query(`SET ROLE service_role;
        UPDATE public.swarm_run_idempotency SET run_id=NULL
          WHERE api_key_id='${key}' AND idempotency_key='${delivery}';`).then(
      () => false,
      (error: Error) => {
        assert.match(error.message, /DOCUMENT_CACHE_IMMUTABLE_RECORD_BINDING_REQUIRED/);
        return true;
      },
    );
  const denied: boolean[] = [];
  for (const deny of [denyKey, denyRun]) {
    const [, outcomes] = await Promise.all([
      Promise.all(Array.from({ length: 8 }, write)),
      Promise.all(Array.from({ length: 8 }, deny)),
    ]);
    denied.push(...outcomes);
  }
  assert(denied.every(Boolean));
  const rows = JSON.parse(
    await query(`SELECT jsonb_agg(jsonb_build_object('run',run_id,'response',response))
      FROM public.swarm_run_idempotency WHERE api_key_id='${key}' AND idempotency_key='${delivery}'`),
  );
  assert.deepEqual(rows, [{ run, response: completed }]);
  assert.equal(
    await query(`SELECT swarm_id::text FROM public.swarm_api_keys WHERE id='${key}'`),
    parent,
  );
  console.log(
    JSON.stringify({
      status: "NATIVE_CACHE_BODY_AND_BINDING_PASS_NOT_EFFECT_AUTHORITY",
      nativeDiagnosticCodesAccepted: accepted,
      unknownOrPrefixDiagnosticsRejected: rejected,
      actualNativeOutputStatusesPreserved: 3,
      independentConcurrentUpserts: 16,
      maximumConcurrentSessions: 16,
      concurrentIdentityDenials: denied.length,
      sameOwnedCacheRowsAfterNewSessionReadback: rows.length,
      providerOrCaseEffects: 0,
    }),
  );
} finally {
  await query(`DELETE FROM public.swarm_api_keys WHERE id='${key}' AND user_id='${owner}';
    DELETE FROM public.swarm_runs WHERE id='${run}' AND user_id='${owner}';`);
  if (createdSwarm)
    await query(`DELETE FROM public.swarms WHERE id='${parent}' AND user_id='${owner}'
      AND name='isolated-cache-contract';`);
}
