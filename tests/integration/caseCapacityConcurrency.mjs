import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "./documentTestDatabase.mjs";

const owner = randomUUID();
const human = { kind: "user_session", id: owner };
const sql = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const call = async (operation, payload) =>
  JSON.parse(
    await query(
      `SELECT axtn_case_capacity('${owner}','${operation}',${sql({ ...payload, _principal: human })});`,
    ),
  );
try {
  await query(
    `INSERT INTO auth.users(id,email,invited_at) VALUES('${owner}','${owner}@capacity.invalid',now());`,
  );
  const root = JSON.parse(
    await query(
      `SELECT axtn_case_manual('${owner}','create',${sql({
        row: {
          subject: "Synthetic capacity races",
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
  const allocationId = randomUUID();
  const commitmentId = randomUUID();
  const allocation = {
    allocationId,
    contextCaseId: root.case_id,
    providerRef: `synthetic:${owner}`,
    poolRef: "synthetic:pool",
    startsOn: "2026-10-01",
    endsOn: "2026-10-31",
    availableHours: 10,
    unavailableHours: 2,
    expectedVersion: 0,
    transitionKey: `allocation:${owner}`,
  };
  const replays = await Promise.all(
    Array.from({ length: 16 }, () => call("capacity_allocation", allocation)),
  );
  assert.ok(replays.every((item) => JSON.stringify(item) === JSON.stringify(replays[0])));
  const races = await Promise.allSettled(
    Array.from({ length: 16 }, (_, index) =>
      call("capacity_commitment", {
        commitmentId: index === 0 ? commitmentId : randomUUID(),
        allocationId,
        caseId: root.case_id,
        hours: 8,
        expectedVersion: 0,
        transitionKey: `commit:${owner}:${index}`,
      }),
    ),
  );
  assert.equal(races.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(
    races.filter(
      (item) =>
        item.status === "rejected" &&
        item.reason.message.includes("CASE_CAPACITY_COMMITMENT_LIMIT"),
    ).length,
    15,
  );
  const winner = races.find((item) => item.status === "fulfilled").value.id;
  const booking = {
    consumptionId: randomUUID(),
    commitmentId: winner,
    caseId: root.case_id,
    hours: 1.5,
    purpose: "DELIVERY",
    capabilityRef: "synthetic:review",
    bookedOn: "2026-10-05",
    expectedVersion: 0,
    transitionKey: `booking:${owner}`,
  };
  await Promise.all(Array.from({ length: 16 }, () => call("capacity_consumption", booking)));
  const corrections = await Promise.allSettled(
    Array.from({ length: 16 }, (_, index) =>
      call("capacity_consumption", {
        ...booking,
        consumptionId: randomUUID(),
        supersedes: booking.consumptionId,
        hours: 2,
        transitionKey: `correct:${owner}:${index}`,
      }),
    ),
  );
  assert.equal(corrections.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(
    corrections.filter(
      (item) =>
        item.status === "rejected" &&
        item.reason.message.includes("CASE_CAPACITY_CORRECTION_CONFLICT"),
    ).length,
    15,
  );
  const view = await call("capacity_view", {
    caseId: root.case_id,
    scope: "CURRENT",
    offset: 0,
    limit: 1,
  });
  assert.equal(view.actualHours, 2);
  assert.equal(view.total, 4);
  assert.equal(view.records.length, 1);
  assert.equal(view.capacityPeriods[0].netAvailableHours, 8);
  assert.equal(view.capacityPeriods[0].committedHours, 8);
  const counts = JSON.parse(
    await query(`SELECT jsonb_build_object(
    'events',(SELECT count(*) FROM audit_events WHERE user_id='${owner}' AND action LIKE 'axtn_case_capacity.%'),
    'records',(SELECT count(*) FROM user_data_rows r JOIN user_data_tables t ON t.id=r.table_id
      WHERE t.user_id='${owner}' AND t.name='axtn_case_capacity'));`),
  );
  assert.deepEqual(counts, { events: 4, records: 4 });
  console.log(
    "PASS: 64 independent capacity sessions: replay, net-allocation commitment race, consumption replay, correction fork race; durable full totals and one audit per actual record",
  );
} finally {
  await query(`DELETE FROM audit_events WHERE user_id='${owner}';
    DELETE FROM user_data_rows WHERE table_id IN (SELECT id FROM user_data_tables WHERE user_id='${owner}');
    DELETE FROM user_data_tables WHERE user_id='${owner}';
    DELETE FROM auth.users WHERE id='${owner}';`);
}
