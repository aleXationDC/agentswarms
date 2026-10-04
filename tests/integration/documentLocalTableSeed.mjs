import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { query } from "./documentTestDatabase.mjs";

const owner = "99999999-9999-4999-8999-999999999999";
const other = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const encoded = (
  await readFile("axtn/mcp-servers/axtn-local-table-integration/server.py")
).toString("base64");
const source = `convert_from(decode('${encoded}','base64'),'UTF8')`;
const call = (user, slug = "axtn-local-table-fixture-abc123") =>
  `SELECT axtn_seed_document_local_table('${user}','${slug}',${source});`;
for (const id of [owner, other])
  assert.equal(await query(`SELECT count(*) FROM auth.users WHERE id='${id}';`), "0");
async function denied(sql, code) {
  await assert.rejects(query(sql), (error) => String(error).includes(code));
}
try {
  await query(`
    INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
      VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms How-To Guide',true)
      ON CONFLICT(id) DO NOTHING;
    INSERT INTO auth.users(id,aud,role,email) VALUES
      ('${owner}','authenticated','authenticated','local-table-fixture@example.invalid'),
      ('${other}','authenticated','authenticated','local-table-other@example.invalid');
  `);
  const initialAudits = Number(
    await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}';`),
  );
  const attempts = await Promise.allSettled(
    Array.from({ length: 16 }, (_, index) =>
      query(`SET ROLE service_role;${call(owner, `axtn-local-table-fixture-seed${index}`)}`),
    ),
  );
  const rows = attempts.map((attempt) => {
    assert.equal(attempt.status, "fulfilled", String(attempt.reason ?? ""));
    return JSON.parse(attempt.value);
  });
  assert.equal(rows.filter((row) => row.created).length, 1);
  assert.equal(new Set(rows.map((row) => row.appId)).size, 1);
  assert.equal(new Set(rows.map((row) => row.slug)).size, 1);
  const id = rows[0].appId;
  const before = await query(`SELECT row_to_json(a)::text FROM mcp_apps a WHERE id='${id}';`);
  const audits = await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}';`);
  assert.equal(Number(audits), initialAudits + 1);
  assert.equal(
    await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}'
      AND action='axtn_document.LOCAL_TABLE_DRAFT_SEEDED';`),
    "1",
  );
  const replay = JSON.parse(await query(`SET ROLE service_role;${call(owner)}`));
  assert.equal(replay.created, false);
  assert.equal(replay.appId, id);
  assert.equal(replay.status, "draft");
  assert.equal(replay.runtimeActivated, false);
  assert.equal(replay.registeredServerId, null);
  assert.equal(
    await query(`SELECT row_to_json(a)::text FROM mcp_apps a WHERE id='${id}';`),
    before,
  );
  assert.equal(await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}';`), audits);
  assert.equal(await query(`SELECT count(*) FROM mcp_app_keys WHERE user_id='${owner}';`), "0");
  assert.equal(await query(`SELECT count(*) FROM mcp_servers WHERE user_id='${owner}';`), "0");
  assert.equal(
    await query(`SELECT count(*) FROM notebook_runtime_sessions WHERE user_id='${owner}';`),
    "0",
  );
  const second = JSON.parse(
    await query(`SET ROLE service_role;${call(other, "axtn-local-table-other-abc123")}`),
  );
  assert.notEqual(second.appId, id);
  for (const role of ["anon", "authenticated"])
    await denied(`SET ROLE ${role};${call(owner)}`, "permission denied");
  await denied(
    `SET ROLE service_role;SELECT axtn_seed_document_local_table(
    '${owner}','axtn-local-table-bad-source','print(1)');`,
    "CANONICAL_SOURCE_REQUIRED",
  );
  await denied(
    `SET ROLE service_role;SELECT axtn_seed_document_local_table(
    NULL,'axtn-local-table-absent',${source});`,
    "AUTHENTICATED_OWNER_REQUIRED",
  );
  await query(`UPDATE mcp_apps SET source_code='operator-source' WHERE id='${id}';`);
  await denied(call(owner), "EXISTING_CONFIGURATION_CONFLICT");
  assert.equal(
    await query(`SELECT source_code FROM mcp_apps WHERE id='${id}';`),
    "operator-source",
  );
  await query(`UPDATE mcp_apps SET source_code=${source},is_public=true WHERE id='${id}';`);
  await denied(call(owner), "EXISTING_CONFIGURATION_CONFLICT");
  assert.equal(await query(`SELECT is_public FROM mcp_apps WHERE id='${id}';`), "t");
  await query(`UPDATE mcp_apps SET is_public=false WHERE id='${id}';
    INSERT INTO mcp_servers(id,user_id,name,type,endpoint)
      VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','${other}','Foreign fixture',
        'custom','https://example.invalid/mcp');
    UPDATE mcp_apps SET registered_server_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      WHERE id='${id}';`);
  await denied(call(owner), "EXISTING_CONFIGURATION_CONFLICT");
  assert.equal(
    await query(`SELECT user_id FROM mcp_servers
      WHERE id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';`),
    other,
  );
  await query(`INSERT INTO mcp_apps(user_id,name,slug,source_code)
    VALUES('${owner}','aXtn Local Table Integration','axtn-local-table-duplicate',${source});`);
  await denied(call(owner), "APP_AMBIGUOUS");
  console.log(
    "PASS: 16 concurrent native draft seeds, durable no-op replay, owner/role/source/config fences; zero keys/servers/runtimes.",
  );
} finally {
  await query(`BEGIN;
    DELETE FROM mcp_apps WHERE user_id IN ('${owner}','${other}');
    DELETE FROM mcp_servers WHERE user_id IN ('${owner}','${other}');
    DELETE FROM auth.users WHERE id IN ('${owner}','${other}');
    DELETE FROM audit_events WHERE user_id IN ('${owner}','${other}');
    COMMIT;`);
}
