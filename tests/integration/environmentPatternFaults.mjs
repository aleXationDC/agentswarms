import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "./documentTestDatabase.mjs";

const owner = randomUUID();
const human = { kind: "user_session", id: owner };
const integration = randomUUID();
const sql = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const call = async (operation, payload) =>
  JSON.parse(
    await query(
      `SELECT axtn_case_environment('${owner}','${operation}',${sql({ ...payload, _principal: human })});`,
    ),
  );
try {
  await query(`INSERT INTO auth.users(id,email,invited_at) VALUES('${owner}','${owner}@faults.invalid',now());
    INSERT INTO integrations(id,user_id,type,name,is_active,config)
    VALUES('${integration}','${owner}','notification','Synthetic faulting ticket fixture',true,'{}');`);
  const root = JSON.parse(
    await query(
      `SELECT axtn_case_manual('${owner}','create',${sql({
        row: {
          subject: "Synthetic native fault recovery",
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
  await call("environment_binding", {
    integrationId: integration,
    environmentId: "Foreign Ticket Fixture",
    enabled: true,
    expectedVersion: 0,
    transitionKey: `binding:${owner}`,
  });
  const request = {
    caseId: root.case_id,
    expectedVersion: 0,
    transitionKey: `lost-response:${owner}`,
    patch: {
      external_environment_id: "Foreign Ticket Fixture",
      external_ref_id: "  0001/Ä  ",
      external_parent_ref_id: "Unrelated remote ticket parent",
    },
  };
  let readback;
  await assert.rejects(async () => {
    await call("external_references", request);
    throw new Error("SYNTHETIC_CONNECTION_LOST_AFTER_COMMIT");
  }, /SYNTHETIC_CONNECTION_LOST_AFTER_COMMIT/);
  readback = await call("external_references", request);
  assert.equal(readback.external_reference_version, 1);
  const counts = () =>
    query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}'
    AND action='axtn_case_environment.REFERENCES_CHANGED';`);
  assert.equal(await counts(), "1");
  const duplicates = await Promise.all(
    Array.from({ length: 8 }, () => call("external_references", request)),
  );
  assert.ok(duplicates.every((row) => row.external_reference_version === 1));
  assert.equal(await counts(), "1");
  await assert.rejects(
    call("external_references", {
      ...request,
      transitionKey: "out-of-order",
      patch: { external_ref_id: "older" },
    }),
    /CASE_ENVIRONMENT_VERSION_CONFLICT/,
  );
  await assert.rejects(
    call("external_references", {
      ...request,
      expectedVersion: 1,
      transitionKey: "schema-drift",
      arbitrarySourceBody: "synthetic",
    }),
    /CASE_ENVIRONMENT_PAYLOAD_REQUIRED/,
  );
  const spoofed = await call("external_correlate", {
    integrationId: integration,
    external_environment_id: "Spoofed Environment",
    external_ref_id: request.patch.external_ref_id,
  });
  assert.equal(spoofed.status, "NEEDS_CLARIFICATION");
  assert.equal(spoofed.reason, "UNCONFIRMED_ENVIRONMENT");
  const exported = await call("external_handover", {
    caseId: root.case_id,
    expectedVersion: 1,
    integrationId: integration,
  });
  assert.deepEqual(exported, request.patch);
  assert.ok(!("receipt" in exported) && !("accepted" in exported));
  // The foreign fixture has a Ticket model, not a SupaCase model.
  const remoteTickets = new Map();
  const deliveryKey = randomUUID();
  async function ticketWrite({ mode }) {
    if (mode === "timeout-before-write") throw new Error("SYNTHETIC_TIMEOUT");
    if (!remoteTickets.has(deliveryKey))
      remoteTickets.set(deliveryKey, { request: exported, effectCount: 1 });
    if (mode === "lost-ack") throw new Error("SYNTHETIC_UNKNOWN_EFFECT");
    return remoteTickets.get(deliveryKey);
  }
  await assert.rejects(ticketWrite({ mode: "timeout-before-write" }), /SYNTHETIC_TIMEOUT/);
  assert.equal(remoteTickets.size, 0);
  await assert.rejects(ticketWrite({ mode: "lost-ack" }), /SYNTHETIC_UNKNOWN_EFFECT/);
  const remoteReadback = remoteTickets.get(deliveryKey);
  assert.equal(remoteReadback.effectCount, 1);
  assert.deepEqual((await ticketWrite({ mode: "duplicate" })).request, request.patch);
  assert.equal(remoteTickets.size, 1);
  const partial = await call("external_references", {
    caseId: root.case_id,
    expectedVersion: 1,
    transitionKey: "partial-null",
    patch: { external_parent_ref_id: null },
  });
  assert.equal(partial.external_ref_id, request.patch.external_ref_id);
  assert.equal(partial.external_parent_ref_id, null);
  await assert.rejects(call("external_references", request), /CASE_ENVIRONMENT_STALE_REPLAY/);
  assert.equal(await counts(), "2");
  const native = JSON.parse(
    await query(`SELECT row FROM user_data_rows r JOIN user_data_tables t
    ON t.id=r.table_id WHERE t.user_id='${owner}' AND t.name='axtn_cases'
      AND r.row->>'case_id'='${root.case_id}';`),
  );
  assert.equal(native.status, "OPEN");
  assert.ok(!("accepted_sha" in native));
  console.log(
    "PASS: native lost-response readback/replay, duplicate/out-of-order/schema-drift/spoof/partial/stale fences; foreign Ticket mock timeout/lost-ack/idempotent readback; UNKNOWN is not success and native Case remains unaccepted/open. Fixture only, no live external effect or product retry engine.",
  );
} finally {
  await query(`DELETE FROM audit_events WHERE user_id='${owner}';
    DELETE FROM user_data_rows WHERE table_id IN (SELECT id FROM user_data_tables WHERE user_id='${owner}');
    DELETE FROM user_data_tables WHERE user_id='${owner}';
    DELETE FROM integrations WHERE user_id='${owner}';
    DELETE FROM auth.users WHERE id='${owner}';`);
}
