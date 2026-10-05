import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "./documentTestDatabase.mjs";

const owner = randomUUID();
const member = randomUUID();
const other = randomUUID();
const group = randomUUID();
const human = (id) => ({ kind: "user_session", id });
const sql = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const call = async (actor, operation, payload) =>
  JSON.parse(
    await query(`SELECT axtn_case_assignment('${actor}','${operation}',
    ${sql({ ...payload, _principal: human(actor) })});`),
  );
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let held;
let removal;
try {
  await query(`INSERT INTO auth.users(id,email,invited_at) VALUES
    ('${owner}','${owner}@assignment.invalid',now()),('${member}','${member}@assignment.invalid',now()),
    ('${other}','${other}@assignment.invalid',now());
    INSERT INTO iam_groups(id,name) VALUES('${group}','synthetic:${group}');
    INSERT INTO iam_group_members(group_id,user_id) VALUES('${group}','${member}'),('${group}','${other}');`);
  const root = JSON.parse(
    await query(
      `SELECT axtn_case_manual('${owner}','create',${sql({
        row: {
          subject: "Synthetic assignment races",
          status: "OPEN",
          priority: 3,
          source_kind: "manual",
          source_id: owner,
        },
        expectedVersion: 0,
        transitionKey: `root:${owner}`,
        _principal: human(owner),
      })});`,
    ),
  );
  const assignment = {
    caseId: root.case_id,
    expectedVersion: 1,
    transitionKey: `assign:${owner}`,
    responsiblePrincipalType: "GROUP",
    responsiblePrincipalId: group,
    assigneeUserId: null,
    assignmentPolicy: "MANUAL",
    assignmentInheritance: "OVERRIDE",
    semanticRouteMode: "SYSTEM_INTEGRATION",
    semanticRouteProviderId: null,
    semanticRouteModelId: null,
  };
  const replays = await Promise.all(
    Array.from({ length: 16 }, () => call(owner, "case_assignment", assignment)),
  );
  assert.ok(replays.every((value) => JSON.stringify(value) === JSON.stringify(replays[0])));
  const races = await Promise.allSettled(
    Array.from({ length: 16 }, (_, index) =>
      call(owner, "case_assignment", {
        ...assignment,
        expectedVersion: 2,
        transitionKey: `race:${owner}:${index}`,
        responsiblePrincipalType: "USER",
        responsiblePrincipalId: other,
        assigneeUserId: other,
      }),
    ),
  );
  assert.equal(races.filter((value) => value.status === "fulfilled").length, 1);
  assert.ok(
    races
      .filter((value) => value.status === "rejected")
      .every((value) => /CASE_ASSIGNMENT_VERSION_CONFLICT/.test(value.reason.message)),
  );
  const views = await Promise.all(
    Array.from({ length: 16 }, () =>
      call(other, "case_access", { caseId: root.case_id, sharedOnly: true, offset: 0, limit: 1 }),
    ),
  );
  assert.ok(views.every((view) => view.total === 1 && view.cases[0].assignment_version === 3));
  await assert.rejects(
    call(member, "case_access", { caseId: root.case_id, sharedOnly: true, offset: 0, limit: 1 }),
    /CASE_ACCESS_DENIED/,
  );
  await call(owner, "case_assignment", {
    ...assignment,
    expectedVersion: 3,
    transitionKey: `restore-group:${owner}`,
  });

  const application = `assignment_hold_${owner}`;
  held = query(`SET application_name='${application}'; BEGIN;
    SELECT axtn_case_processing('${member}','processing',${sql({
      caseId: root.case_id,
      expectedVersion: 0,
      transitionKey: `held:${owner}`,
      reasonCode: "SYNTHETIC_GROUP_SERIALIZATION",
      patch: { processing_stage: "VALIDATION_REVIEW" },
      _principal: human(member),
    })}); SELECT pg_sleep(2); COMMIT;`);
  let observed = false;
  for (let i = 0; i < 30; i++) {
    if (
      (await query(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity
      WHERE application_name='${application}' AND wait_event='PgSleep');`)) === "t"
    ) {
      observed = true;
      break;
    }
    await sleep(25);
  }
  assert.ok(
    observed,
    "The authorized transaction must be observed holding native membership locks",
  );
  const removalApplication = `assignment_remove_${owner}`;
  removal = query(`SET application_name='${removalApplication}';
    DELETE FROM iam_group_members WHERE group_id='${group}' AND user_id='${member}';`);
  await sleep(100);
  assert.equal(
    await query(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity
    WHERE application_name='${removalApplication}' AND wait_event_type='Lock');`),
    "t",
  );
  await Promise.all([held, removal]);
  const before = await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}';`);
  await assert.rejects(
    query(
      `SELECT axtn_case_processing('${member}','processing',${sql({
        caseId: root.case_id,
        expectedVersion: 1,
        transitionKey: `revoked:${owner}`,
        reasonCode: "SYNTHETIC_REVOKED",
        patch: { processing_stage: "ACTIVE" },
        _principal: human(member),
      })});`,
    ),
    /CASE_ACCESS_DENIED/,
  );
  assert.equal(await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}';`), before);
  assert.equal(
    await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}'
    AND action='axtn_case_assignment.ASSIGNED';`),
    "3",
  );
  console.log(
    "PASS: 48 independent assignment/replay/CAS/readback sessions; one optimistic winner, no copied Case; actual Group membership revocation serializes after an authorized transaction and fences later mutation without audit changes",
  );
} finally {
  await Promise.allSettled([held, removal].filter(Boolean));
  await query(`DELETE FROM audit_events WHERE user_id IN ('${owner}','${member}','${other}');
    DELETE FROM user_data_rows WHERE table_id IN (
      SELECT id FROM user_data_tables WHERE user_id IN ('${owner}','${member}','${other}'));
    DELETE FROM user_data_tables WHERE user_id IN ('${owner}','${member}','${other}');
    DELETE FROM iam_groups WHERE id='${group}';
    DELETE FROM auth.users WHERE id IN ('${owner}','${member}','${other}');`);
}
