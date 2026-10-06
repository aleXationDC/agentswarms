import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { query } from "./documentTestDatabase.mjs";

const manifest = z
  .object({
    schemaVersion: z.literal("environment-pattern-fixture-v1"),
    artifactId: z.literal("exact-ticket-reference-handover"),
    artifactVersion: z.literal("2"),
    nativeDependencies: z.tuple([
      z.literal("axtn_case_environment(uuid,text,jsonb)"),
      z.literal("axtn_case_manual(uuid,text,jsonb)"),
    ]),
    requiredBindings: z.tuple([z.literal("ticketEnvironment"), z.literal("ticketIntegration")]),
    skill: z
      .object({
        name: z.string().min(1),
        description: z.string().min(1),
        body: z.string().min(1),
        tags: z.array(z.string()),
      })
      .strict(),
  })
  .strict();
const exported = readFileSync(
  new URL("../fixtures/environment-pattern/portable-skill.json", import.meta.url),
  "utf8",
);
const parsed = manifest.parse(JSON.parse(exported));
const exportedHash = createHash("sha256").update(exported).digest("hex");
assert.ok(
  !/token|password|session_id|user_id|integration_id|credential|https?:\/\//i.test(exported),
  "Portable fixture carries no secret/runtime binding or external URL",
);
assert.equal(manifest.safeParse({ ...parsed, schemaVersion: "incompatible" }).success, false);
assert.equal(manifest.safeParse({ ...parsed, localRunId: randomUUID() }).success, false);
const installed = JSON.parse(
  await query(`SELECT jsonb_build_array(
  to_regprocedure('axtn_case_environment(uuid,text,jsonb)') IS NOT NULL,
  to_regprocedure('axtn_case_manual(uuid,text,jsonb)') IS NOT NULL);`),
);
assert.deepEqual(installed, [true, true]);
const bindings = z
  .object({
    ticketEnvironment: z.string().min(1),
    ticketIntegration: z.string().uuid(),
  })
  .strict();
assert.equal(bindings.safeParse({ ticketEnvironment: "Fixture A" }).success, false);
const owners = [randomUUID(), randomUUID()];
const sql = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
try {
  const imported = [];
  const contextMeasurements = [];
  for (const [index, owner] of owners.entries()) {
    const human = { kind: "user_session", id: owner };
    const integration = randomUUID();
    const local = bindings.parse({
      ticketEnvironment: index === 0 ? "Ticket Fixture A" : "Ticket Fixture B",
      ticketIntegration: integration,
    });
    await query(`INSERT INTO auth.users(id,email,invited_at) VALUES('${owner}','${owner}@transfer.invalid',now());
      INSERT INTO integrations(id,user_id,type,name,is_active,config)
      VALUES('${integration}','${owner}','notification','Synthetic foreign ticket fixture',true,'{}');`);
    const root = JSON.parse(
      await query(
        `SELECT axtn_case_manual('${owner}','create',${sql({
          row: {
            subject: "SYNTHETIC_PRIVATE_MARKER ".repeat(16),
            status: "OPEN",
            priority: 3,
            source_kind: "manual",
            source_id: owner,
          },
          expectedVersion: 0,
          transitionKey: `case:${owner}`,
          _principal: human,
        })});`,
      ),
    );
    const payload = {
      caseId: root.case_id,
      integrationId: integration,
      expectedVersion: 0,
      _principal: human,
    };
    await assert.rejects(
      query(`SELECT axtn_case_environment('${owner}','external_handover',${sql(payload)});`),
      /CASE_ENVIRONMENT_CONFIRMED_BINDING_REQUIRED/,
    );
    await query(
      `SELECT axtn_case_environment('${owner}','environment_binding',${sql({
        integrationId: local.ticketIntegration,
        environmentId: local.ticketEnvironment,
        enabled: true,
        expectedVersion: 0,
        transitionKey: `binding:${owner}`,
        _principal: human,
      })});`,
    );
    const triple = {
      external_environment_id: local.ticketEnvironment,
      external_ref_id: "  0001/Ä  ",
      external_parent_ref_id: "Foreign ticket parent absent from local Case tree",
    };
    await query(
      `SELECT axtn_case_environment('${owner}','external_references',${sql({
        caseId: root.case_id,
        expectedVersion: 0,
        transitionKey: `reference:${owner}`,
        patch: triple,
        _principal: human,
      })});`,
    );
    const output = JSON.parse(
      await query(`SELECT axtn_case_environment('${owner}','external_handover',
      ${sql({ ...payload, expectedVersion: 1 })});`),
    );
    assert.deepEqual(output, triple);
    const persisted = JSON.parse(
      await query(`SELECT r.row FROM user_data_rows r JOIN user_data_tables t
        ON t.id=r.table_id WHERE t.user_id='${owner}' AND t.name='axtn_cases'
        AND r.row->>'case_id'='${root.case_id}';`),
    );
    assert.ok(persisted.subject.includes("SYNTHETIC_PRIVATE_MARKER"));
    assert.ok(!JSON.stringify(output).includes("SYNTHETIC_PRIVATE_MARKER"));
    assert.ok(!JSON.stringify(output).includes(root.case_id));
    assert.ok(!JSON.stringify(output).includes(owner));
    const persistedBytes = Buffer.byteLength(JSON.stringify(persisted));
    const exportedBytes = Buffer.byteLength(JSON.stringify(output));
    assert.ok(exportedBytes < persistedBytes / 2);
    contextMeasurements.push({
      scope: "ACTUAL_NATIVE_CASE_ROW_TO_AUTHORIZED_TRIPLE",
      persistedBytes,
      exportedBytes,
      exactOutcome: "MATCHED",
      semanticProviderCalls: 0,
      measuredModelTokens: null,
    });
    const original = {
      source: "synthetic-document",
      privacyStatus: "NO_AI",
      privateText: "SYNTHETIC_PRIVATE_MARKER ".repeat(500),
      ...triple,
    };
    assert.ok(!JSON.stringify(output).includes("SYNTHETIC_PRIVATE_MARKER"));
    assert.deepEqual(Object.keys(output).sort(), Object.keys(triple).sort());
    assert.ok(
      Buffer.byteLength(JSON.stringify(output)) < Buffer.byteLength(JSON.stringify(original)) / 10,
    );
    const skillId = randomUUID();
    const body = parsed.skill.body.replaceAll("'", "''");
    await query(`INSERT INTO agent_skills(id,user_id,name,description,body,tags)
      VALUES('${skillId}','${owner}','${parsed.skill.name}','${parsed.skill.description}',
        '${body}',ARRAY['environment-pilot','synthetic-transfer-fixture','native-case-contract']);`);
    const skill = JSON.parse(
      await query(`SELECT jsonb_build_object('body',body,'tags',tags)
      FROM agent_skills WHERE id='${skillId}' AND user_id='${owner}';`),
    );
    assert.deepEqual(skill, { body: parsed.skill.body, tags: parsed.skill.tags });
    const correlate = JSON.parse(
      await query(
        `SELECT axtn_case_environment('${owner}','external_correlate',${sql({
          integrationId: local.ticketIntegration,
          ...triple,
          _principal: human,
        })});`,
      ),
    );
    assert.equal(correlate.status, "MATCHED");
    assert.deepEqual(correlate.candidates, [root.case_id]);
    imported.push({ owner, skillId, integration, caseId: root.case_id, triple });
  }
  assert.notEqual(imported[0].skillId, imported[1].skillId);
  assert.notEqual(imported[0].integration, imported[1].integration);
  assert.equal(imported[0].triple.external_ref_id, imported[1].triple.external_ref_id);
  assert.notEqual(
    imported[0].triple.external_environment_id,
    imported[1].triple.external_environment_id,
  );
  assert.equal(createHash("sha256").update(exported).digest("hex"), exportedHash);
  console.log(
    `PASS: portable native skill manifest ${exportedHash}; two synthetic owned imports with distinct local bindings and identical exact opaque ticket ref; native missing-binding denial, schema/runtime-field negatives, minimized roundtrip; no external send or real independent systems`,
  );
  console.log(
    JSON.stringify({ contextMeasurements, tokenComparison: "NOT_MEASURED_NO_MODEL_CALL" }),
  );
} finally {
  for (const owner of owners) {
    await query(`DELETE FROM audit_events WHERE user_id='${owner}';
      DELETE FROM agent_skills WHERE user_id='${owner}';
      DELETE FROM user_data_rows WHERE table_id IN (SELECT id FROM user_data_tables WHERE user_id='${owner}');
      DELETE FROM user_data_tables WHERE user_id='${owner}';
      DELETE FROM integrations WHERE user_id='${owner}';
      DELETE FROM auth.users WHERE id='${owner}';`);
  }
}
