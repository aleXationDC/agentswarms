import assert from "node:assert/strict";
import { query } from "./documentTestDatabase.mjs";

const owner = "88888888-8888-4888-8888-888888888888";
assert.equal(
  await query(`SELECT count(*) FROM auth.users WHERE id='${owner}';`),
  "0",
  "The isolated Registry fixture owner must not preexist.",
);
assert.equal(
  await query(`SELECT count(*) FROM user_data_tables WHERE user_id='${owner}';`),
  "0",
  "The isolated Registry fixture must start with no datasets.",
);
try {
  await query(`
    INSERT INTO public.knowledge_bases(id,user_id,name,is_sample)
      VALUES('a9ed1b51-4c3d-4f87-9c5a-1d2e3f4a5b00',NULL,'AgentSwarms How-To Guide',true)
      ON CONFLICT(id) DO NOTHING;
    INSERT INTO auth.users(id,aud,role,email)
      VALUES('${owner}','authenticated','authenticated','registry-concurrent@example.invalid');
  `);
  const rows = (
    await Promise.all(
      Array.from({ length: 16 }, () => query(`SELECT axtn_seed_document_registries('${owner}');`)),
    )
  ).map((response) => JSON.parse(response));
  assert.equal(
    rows.reduce((count, row) => count + row.classificationValuesInserted, 0),
    6,
  );
  assert.equal(rows.flatMap((row) => row.datasets).filter((dataset) => dataset.created).length, 3);
  for (const name of [
    "axtn_document_registry",
    "axtn_document_recognition_patterns",
    "axtn_document_classification_values",
  ]) {
    assert.equal(
      new Set(
        rows
          .flatMap((row) => row.datasets)
          .filter((dataset) => dataset.name === name)
          .map((dataset) => dataset.id),
      ).size,
      1,
    );
  }
  assert.equal(
    await query(`SELECT count(*) FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id='${owner}' AND t.name='axtn_document_classification_values';`),
    "6",
  );
  assert.equal(
    await query(`SELECT count(*) FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id='${owner}' AND t.name IN
        ('axtn_document_registry','axtn_document_recognition_patterns');`),
    "0",
  );
  const replay = JSON.parse(await query(`SELECT axtn_seed_document_registries('${owner}');`));
  assert.equal(replay.classificationValuesInserted, 0);
  assert.ok(replay.datasets.every((dataset) => !dataset.created && !dataset.reconciled));
  assert.equal(
    await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}'
      AND action IN ('axtn_document.REGISTRY_RECONCILED','axtn_document.TAXONOMY_SEEDED');`),
    "4",
  );
  console.log(
    "PASS: 16 actual independent sessions + new-session replay preserve three owned datasets, six taxonomy values, no business rows/patterns and exactly four audit events.",
  );
} finally {
  await query(`
    BEGIN;
    DELETE FROM user_data_tables WHERE user_id='${owner}';
    DELETE FROM auth.users WHERE id='${owner}';
    DELETE FROM audit_events WHERE user_id='${owner}';
    COMMIT;
  `);
}
