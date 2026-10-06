import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "./documentTestDatabase.mjs";

const owner = randomUUID();
const foreign = randomUUID();
const dashboard = randomUUID();
const model = randomUUID();
const dataset = randomUUID();
const literal = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const auth = (actor) => `SET LOCAL ROLE authenticated;
  SELECT set_config('request.jwt.claims',${literal({ sub: actor, role: "authenticated" })}::text,true);`;
const content = [
  { id: "synthetic-text", kind: "text", title: "Before", text: "Synthetic fixture" },
];
try {
  await query(`INSERT INTO auth.users(id,email,invited_at) VALUES
    ('${owner}','${owner}@bi-scope.invalid',now()),('${foreign}','${foreign}@bi-scope.invalid',now());
    INSERT INTO user_data_tables(id,user_id,name,is_sample,columns)
    VALUES('${dataset}','${owner}','synthetic_bi_scope_${dataset.replaceAll("-", "")}',false,'[]');
    INSERT INTO semantic_models(id,user_id,name,source_kind,table_id,source_table,dimensions,metrics)
    VALUES('${model}','${owner}','synthetic_scope_${model.replaceAll("-", "")}','data_table',
      '${dataset}','synthetic_table','[]','[]');
    INSERT INTO bi_dashboards(id,user_id,name,widgets,version,published)
    VALUES('${dashboard}','${owner}','Synthetic bounded view',${literal(content)},0,false);`);
  const foreignRead = await query(`BEGIN; ${auth(foreign)}
    WITH attempted AS (UPDATE bi_dashboards SET name='forged' WHERE id='${dashboard}' RETURNING id)
    SELECT jsonb_build_object(
      'models',(SELECT count(*) FROM semantic_models WHERE id='${model}'),
      'dashboards',(SELECT count(*) FROM bi_dashboards WHERE id='${dashboard}'),
      'datasets',(SELECT count(*) FROM user_data_tables WHERE id='${dataset}'),
      'writeCount',(SELECT count(*) FROM attempted));
    ROLLBACK;`);
  const result = JSON.parse(foreignRead.split("\n").find((line) => line.includes('"dashboards"')));
  assert.deepEqual(result, { models: 0, dashboards: 0, datasets: 0, writeCount: 0 });
  const changes = ["Synthetic view A", "Synthetic view B"];
  const writes = await Promise.all(
    changes.map((name) =>
      query(`BEGIN; ${auth(owner)}
    WITH changed AS (
      UPDATE bi_dashboards SET name='${name}',version=1 WHERE id='${dashboard}' AND version=0
      RETURNING id
    ) SELECT jsonb_build_object('changed',count(*)) FROM changed;
    COMMIT;`),
    ),
  );
  const counts = writes.map(
    (output) => JSON.parse(output.split("\n").find((line) => line.includes('"changed"'))).changed,
  );
  assert.deepEqual(
    counts.sort(),
    [0, 1],
    "Concurrent same-version edits must have exactly one winner",
  );
  const stored = JSON.parse(
    await query(`SELECT jsonb_build_object(
    'name',name,'version',version,'widgets',widgets,'published',published)
    FROM bi_dashboards WHERE id='${dashboard}';`),
  );
  assert.ok(changes.includes(stored.name));
  assert.equal(stored.version, 1);
  assert.deepEqual(stored.widgets, content);
  assert.equal(stored.published, false);
  const replay = await query(`BEGIN; ${auth(owner)}
    WITH changed AS (
      UPDATE bi_dashboards SET name='stale duplicate',version=1 WHERE id='${dashboard}' AND version=0
      RETURNING id
    ) SELECT jsonb_build_object('changed',count(*)) FROM changed;
    COMMIT;`);
  assert.equal(
    JSON.parse(replay.split("\n").find((line) => line.includes('"changed"'))).changed,
    0,
  );
  assert.deepEqual(
    JSON.parse(
      await query(`SELECT jsonb_build_object(
    'name',name,'version',version,'widgets',widgets,'published',published)
    FROM bi_dashboards WHERE id='${dashboard}';`),
    ),
    stored,
  );
  console.log(
    "PASS: actual isolated authenticated BI dataset/model/view owner RLS, foreign hidden counts/write denial, two concurrent same-version edits yield one winner, stale duplicate no effect; synthetic fixture only",
  );
} finally {
  await query(`DELETE FROM bi_dashboards WHERE id='${dashboard}';
    DELETE FROM semantic_models WHERE id='${model}';
    DELETE FROM user_data_tables WHERE id='${dataset}';
    DELETE FROM auth.users WHERE id IN ('${owner}','${foreign}');`);
}
