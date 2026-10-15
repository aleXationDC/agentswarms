-- Isolated DB-clone test for 20261016000000_development_owner_review_eligibility.sql.
-- Run against a CLONE only (never live), after applying the migration:
--   psql -d <clone> -v ON_ERROR_STOP=1 -f supabase/tests/development_owner_review_eligibility.test.sql
-- Everything is rolled back. Expects a pending native Development approval
-- whose reviewer group contains the Work owner (the live Slice 1 fixture shape).
BEGIN;

CREATE TEMP TABLE t_result(n int, name text, outcome text, pass boolean);
CREATE TEMP TABLE t_ctx AS
  SELECT a.id AS approval_id, a.user_id AS owner_id,
         (a.approver_group_ids)[1] AS grp,
         a.payload->'axtnDevelopment'->>'caseId' AS case_id
  FROM approvals a WHERE a.payload ? 'axtnDevelopment' AND a.status='pending'
  ORDER BY created_at DESC LIMIT 1;
GRANT ALL ON t_result, t_ctx TO authenticated, service_role;

-- Runs one decision under the given role/uid inside a subtransaction that is
-- always rolled back; returns 'OK' or the exception message.
CREATE FUNCTION pg_temp.try_decide(p_uid uuid, p_role text, p_status text, p_setup text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE res text := 'OK';
BEGIN
  BEGIN
    IF p_setup IS NOT NULL THEN EXECUTE p_setup; END IF;
    PERFORM set_config('request.jwt.claims',
      CASE WHEN p_uid IS NULL THEN '' ELSE json_build_object('sub',p_uid,'role',p_role)::text END, true);
    EXECUTE format('SET LOCAL ROLE %I', p_role);
    UPDATE approvals SET status=p_status WHERE id=(SELECT approval_id FROM t_ctx);
    IF NOT FOUND THEN res := 'NO_ROW_UPDATED'; END IF;
    RAISE EXCEPTION 'ROLLBACK_MARKER';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_MARKER' THEN res := SQLERRM; END IF;
  END;
  RESET ROLE;
  RETURN res;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.try_decide(uuid,text,text,text) TO PUBLIC;

DO $$
DECLARE
  c t_ctx; other uuid := gen_random_uuid(); r text;
  tbl uuid;
BEGIN
  SELECT * INTO c FROM t_ctx;
  IF c.approval_id IS NULL THEN RAISE EXCEPTION 'no pending native approval in clone'; END IF;
  SELECT id INTO tbl FROM user_data_tables WHERE user_id=c.owner_id AND name='axtn_cases';

  r := pg_temp.try_decide(c.owner_id,'authenticated','approved');
  INSERT INTO t_result VALUES(1,'owner in reviewer group, separate swarm builder',r,r='OK');

  r := pg_temp.try_decide(c.owner_id,'authenticated','approved',
    format('DELETE FROM iam_group_members WHERE user_id=%L AND group_id=%L',c.owner_id,c.grp));
  INSERT INTO t_result VALUES(2,'owner without reviewer assignment',r,r LIKE '%NATIVE_APPROVAL_REVIEWER_DENIED%');

  SET LOCAL session_replication_role = replica; -- bypass the clone's signup policy trigger only
  INSERT INTO auth.users(id,instance_id,aud,role,email) VALUES(other,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','reviewer-test@example.invalid');
  SET LOCAL session_replication_role = origin;
  INSERT INTO iam_group_members(group_id,user_id) VALUES(c.grp,other);
  r := pg_temp.try_decide(other,'authenticated','approved');
  INSERT INTO t_result VALUES(3,'other group reviewer approves',r,r='OK');
  r := pg_temp.try_decide(other,'authenticated','rejected');
  INSERT INTO t_result VALUES(3,'other group reviewer rejects',r,r='OK');

  r := pg_temp.try_decide(c.owner_id,'authenticated','approved',
    format($q$UPDATE user_data_rows SET row=jsonb_set(row,'{human_builder_ids}',to_jsonb(ARRAY[%L])) WHERE table_id=%L AND row->>'case_id'=%L$q$,c.owner_id::text,tbl,c.case_id));
  INSERT INTO t_result VALUES(4,'human builder (human_builder_ids) blocked',r,r LIKE '%NATIVE_APPROVAL_BUILDER_DENIED%');
  r := pg_temp.try_decide(other,'authenticated','approved',
    format($q$UPDATE user_data_rows SET row=jsonb_set(row,'{actor_principal}',jsonb_build_object('kind','user_session','id',%L)) WHERE table_id=%L AND row->>'case_id'=%L$q$,other::text,tbl,c.case_id));
  INSERT INTO t_result VALUES(4,'user_session actor blocked even for other reviewer',r,r LIKE '%NATIVE_APPROVAL_BUILDER_DENIED%');

  r := pg_temp.try_decide(NULL,'authenticated','approved');
  -- RLS hides the row without a session, so a zero-row update is the denial
  INSERT INTO t_result VALUES(5,'unauthenticated',r,r IN ('NO_ROW_UPDATED') OR r LIKE '%NATIVE_APPROVAL_AUTHENTICATED_REVIEWER_REQUIRED%');
  r := pg_temp.try_decide(c.owner_id,'service_role','approved');
  INSERT INTO t_result VALUES(5,'service_role decision blocked',r,r LIKE '%NATIVE_APPROVAL_AUTHENTICATED_REVIEWER_REQUIRED%');
  r := pg_temp.try_decide(c.owner_id,'authenticated','approved',
    format($q$UPDATE user_data_rows SET row=jsonb_set(row,'{candidate_sha}','"deadbeef"') WHERE table_id=%L AND row->>'case_id'=%L$q$,tbl,c.case_id));
  INSERT INTO t_result VALUES(5,'candidate drift blocked',r,r LIKE '%NATIVE_APPROVAL_CURRENT_WORK_BINDING_REQUIRED%');
  r := pg_temp.try_decide(c.owner_id,'authenticated','approved',
    format($q$UPDATE user_data_rows SET row=jsonb_set(row,'{attempt_id}','"other"') WHERE table_id=%L AND row->>'case_id'=%L$q$,tbl,c.case_id));
  INSERT INTO t_result VALUES(5,'attempt drift blocked',r,r LIKE '%NATIVE_APPROVAL_CURRENT_WORK_BINDING_REQUIRED%');
  r := pg_temp.try_decide(c.owner_id,'authenticated','approved',
    format($q$UPDATE notebook_runtime_sessions SET result=jsonb_set(result,'{gateVerdict}','"FAIL"') WHERE id=(SELECT (payload->'axtnDevelopment'->>'runtimeSessionId')::uuid FROM approvals WHERE id=%L)$q$,c.approval_id));
  INSERT INTO t_result VALUES(5,'receipt drift blocked',r,r LIKE '%NATIVE_APPROVAL_CURRENT_RECEIPT_REQUIRED%');
  r := pg_temp.try_decide(c.owner_id,'authenticated','approved',
    format($q$UPDATE approvals SET payload=jsonb_set(payload,'{axtnDevelopment,candidateSHA}','"deadbeef"') WHERE id=%L$q$,c.approval_id));
  INSERT INTO t_result VALUES(5,'payload drift blocked',r,r LIKE '%NATIVE_APPROVAL_BINDING_IMMUTABLE%');
  r := pg_temp.try_decide(c.owner_id,'authenticated','approved',
    format($q$UPDATE approvals SET status='approved',decided_by=%L WHERE id=%L$q$,other,c.approval_id));
  INSERT INTO t_result VALUES(5,'second decision on decided row blocked',r,r LIKE '%NATIVE_APPROVAL_AUTHENTICATED_REVIEWER_REQUIRED%');
  r := pg_temp.try_decide(c.owner_id,'authenticated','cancelled');
  INSERT INTO t_result VALUES(5,'human cancel blocked',r,r LIKE '%NATIVE_APPROVAL_AUTHENTICATED_REVIEWER_REQUIRED%');

  INSERT INTO t_result VALUES(6,'document approval guard still present','present',
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='guard_axtn_document_approval'));
END $$;

SELECT n, name, outcome, CASE WHEN pass THEN 'PASS' ELSE 'FAIL' END AS verdict FROM t_result ORDER BY n, name;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM t_result WHERE NOT pass) THEN RAISE EXCEPTION 'MATRIX_FAILED'; END IF; END $$;
ROLLBACK;
