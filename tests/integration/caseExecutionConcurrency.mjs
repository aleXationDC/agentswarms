import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { query } from "./documentTestDatabase.mjs";

const owner = randomUUID();
const members = [randomUUID(), randomUUID()].sort();
const group = randomUUID();
const swarm = randomUUID();
const runs = [randomUUID(), randomUUID()];
const principal = { kind: "user_session", id: owner };
const json = (value) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
const execution = async (operation, payload) =>
  JSON.parse(
    await query(`SELECT axtn_case_execution('${owner}','${operation}',${json(payload)});`),
  );
try {
  await query(`INSERT INTO auth.users(id,email,invited_at) VALUES
    ${[owner, ...members].map((id) => `('${id}','${id}@execution.invalid',now())`).join(",")};
    INSERT INTO iam_groups(id,name) VALUES('${group}','synthetic-execution:${group}');
    INSERT INTO iam_group_members(group_id,user_id) VALUES
      ${members.map((id) => `('${group}','${id}')`).join(",")};
    INSERT INTO iam_model_rules(principal_type,principal_id,provider,model_pattern) VALUES
      ${members.map((id) => `('user','${id}','openai','fixture-model')`).join(",")};
    INSERT INTO integrations(user_id,type,name,provider,is_active,config) VALUES
      ${members.map((id) => `('${id}','llm_provider','Synthetic execution','openai',true,'{}')`).join(",")};
    INSERT INTO swarms(id,user_id,name) VALUES('${swarm}','${owner}','Synthetic execution race');`);
  const cases = [];
  for (let index = 0; index < runs.length; index++) {
    const row = JSON.parse(
      await query(
        `SELECT axtn_case_manual('${owner}','create',${json({
          row: {
            subject: "Synthetic concurrent native claim",
            status: "OPEN",
            priority: 3,
            source_kind: "manual",
            source_id: owner,
          },
          expectedVersion: 0,
          transitionKey: `create:${index}`,
          _principal: principal,
        })});`,
      ),
    );
    cases.push(row.case_id);
    await query(`SELECT axtn_case_assignment('${owner}','case_assignment',${json({
      caseId: row.case_id,
      expectedVersion: 1,
      transitionKey: `assign:${index}`,
      responsiblePrincipalType: "GROUP",
      responsiblePrincipalId: group,
      assigneeUserId: null,
      assignmentPolicy: "LEAST_ACTIVE_ELIGIBLE",
      assignmentInheritance: "OVERRIDE",
      semanticRouteMode: "PERSONAL_CONNECTION",
      semanticRouteProviderId: null,
      semanticRouteModelId: null,
      _principal: principal,
    })});
    INSERT INTO swarm_runs(id,user_id,swarm_id,status,swarm_snapshot)
      VALUES('${runs[index]}','${owner}','${swarm}','running',${json({
        nodes: [
          { id: "agent", data: { kind: "agent", provider: "openai", model: "fixture-model" } },
        ],
        edges: [],
      })});`);
    await execution("bind_run", { runId: runs[index], caseId: row.case_id, _principal: principal });
  }
  const claims = await Promise.all(
    runs.map((runId) =>
      execution("resolve", {
        runId,
        nodeId: "agent",
        operationKey: "synthetic-concurrent-first",
      }),
    ),
  );
  assert.deepEqual(claims.map((value) => value.execution_principal_user_id).sort(), members);
  const replay = await Promise.allSettled(
    Array.from({ length: 16 }, () =>
      execution("resolve", {
        runId: runs[0],
        nodeId: "agent",
        operationKey: "synthetic-racing-operation",
      }),
    ),
  );
  assert.equal(replay.filter((value) => value.status === "fulfilled").length, 1);
  assert.ok(
    replay
      .filter((value) => value.status === "rejected")
      .every((value) => /CASE_EXECUTION_READBACK_RECOVERY_REQUIRED/.test(value.reason.message)),
  );
  assert.equal(
    await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}'
    AND action='axtn_case_execution.SEMANTIC_BOUND';`),
    "3",
  );
  const blocks = await Promise.all(
    Array.from({ length: 16 }, () =>
      execution("block", {
        runId: runs[0],
        reasonCode: "PERSONAL_PLAN_LIMIT_REACHED",
      }),
    ),
  );
  assert.ok(blocks.every((value) => JSON.stringify(value) === JSON.stringify(blocks[0])));
  assert.equal(
    await query(`SELECT count(*) FROM audit_events WHERE user_id='${owner}'
    AND action='axtn_case_execution.BLOCKED';`),
    "1",
  );
  console.log(
    "PASS: two concurrent group claims balance; 16 same-operation sessions permit one semantic claim; 16 blocked replays produce one native transition/audit; no provider call/Acceptance",
  );
} finally {
  await query(`DELETE FROM audit_events WHERE user_id IN ('${owner}',${members.map((id) => `'${id}'`).join(",")});
    DELETE FROM swarm_runs WHERE user_id='${owner}';
    DELETE FROM swarms WHERE user_id='${owner}';
    DELETE FROM integrations WHERE user_id IN (${members.map((id) => `'${id}'`).join(",")});
    DELETE FROM iam_model_rules WHERE principal_id IN (${members.map((id) => `'${id}'`).join(",")});
    DELETE FROM user_data_rows WHERE table_id IN (
      SELECT id FROM user_data_tables WHERE user_id IN ('${owner}',${members.map((id) => `'${id}'`).join(",")}));
    DELETE FROM user_data_tables WHERE user_id IN ('${owner}',${members.map((id) => `'${id}'`).join(",")});
    DELETE FROM iam_group_members WHERE group_id='${group}';
    DELETE FROM iam_groups WHERE id='${group}';
    DELETE FROM auth.users WHERE id IN ('${owner}',${members.map((id) => `'${id}'`).join(",")});`);
}
