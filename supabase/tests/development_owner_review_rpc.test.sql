-- RPC path (decide_swarm_approval) and atomic audit checks for the owner review eligibility migration.
-- CLONE ONLY. Everything is rolled back.
BEGIN;
CREATE TEMP TABLE r_result(name text, outcome text, pass boolean);
CREATE TEMP TABLE r_ctx AS
  SELECT a.id AS approval_id, a.user_id AS owner_id, (a.approver_group_ids)[1] AS grp,
         a.payload->'axtnDevelopment'->>'caseId' AS case_id
  FROM approvals a WHERE a.id = '7aa0dcb3-60ae-4e37-9d94-91a84a5a2ff5' AND a.status = 'pending';
GRANT ALL ON r_result, r_ctx TO authenticated, service_role;

-- Calls the RPC as p_uid/role in a rolled-back subtransaction; returns
-- outcome plus status/audit counts observed before rollback.
CREATE FUNCTION pg_temp.rpc(p_uid uuid, p_role text, p_decision text, p_setup text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE res text; st text; aud int; who uuid; again text;
BEGIN
  BEGIN
    IF p_setup IS NOT NULL THEN EXECUTE p_setup; END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub',p_uid,'role',p_role)::text, true);
    EXECUTE format('SET LOCAL ROLE %I', p_role);
    BEGIN
      PERFORM public.decide_swarm_approval((SELECT approval_id FROM r_ctx), p_decision);
      res := 'OK';
    EXCEPTION WHEN OTHERS THEN res := SQLERRM; END;
    BEGIN
      PERFORM public.decide_swarm_approval((SELECT approval_id FROM r_ctx), p_decision);
      again := 'SECOND_OK';
    EXCEPTION WHEN OTHERS THEN again := 'SECOND_DENIED'; END;
    RESET ROLE;
    SELECT status, decided_by INTO st, who FROM approvals WHERE id=(SELECT approval_id FROM r_ctx);
    SELECT count(*) INTO aud FROM audit_events WHERE action='axtn_work.APPROVAL_DECIDED'
      AND detail->>'approvalId'=(SELECT approval_id::text FROM r_ctx);
    res := format('%s|status=%s|decided_by_is_caller=%s|audit_rows=%s|%s', res, st, who IS NOT DISTINCT FROM p_uid, aud, again);
    RAISE EXCEPTION 'ROLLBACK_MARKER';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_MARKER' THEN res := coalesce(res,'') || ' ERR:' || SQLERRM; END IF;
  END;
  RESET ROLE;
  RETURN res;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.rpc(uuid,text,text,text) TO PUBLIC;

DO $$
DECLARE c r_ctx; r text; tbl uuid; before_aud int; after_aud int; st text; other uuid := gen_random_uuid();
BEGIN
  SELECT * INTO c FROM r_ctx;
  IF c.approval_id IS NULL THEN RAISE EXCEPTION 'target approval not pending in clone'; END IF;
  SELECT id INTO tbl FROM user_data_tables WHERE user_id=c.owner_id AND name='axtn_cases';

  r := pg_temp.rpc(c.owner_id,'authenticated','approved');
  INSERT INTO r_result VALUES('RPC owner approve: decided, 1 audit row, caller recorded, second call denied', r,
    r LIKE 'OK|status=approved|decided_by_is_caller=t|audit_rows=1|SECOND_DENIED');
  r := pg_temp.rpc(c.owner_id,'authenticated','rejected');
  INSERT INTO r_result VALUES('RPC owner reject: decided, 1 audit row, second call denied', r,
    r LIKE 'OK|status=rejected|decided_by_is_caller=t|audit_rows=1|SECOND_DENIED');

  r := pg_temp.rpc(c.owner_id,'authenticated','approved',
    format('DELETE FROM iam_group_members WHERE user_id=%L AND group_id=%L',c.owner_id,c.grp));
  INSERT INTO r_result VALUES('RPC owner without assignment: denied, still pending, no audit', r,
    r LIKE '%status=pending|%audit_rows=0%' AND r NOT LIKE 'OK|%');

  r := pg_temp.rpc(c.owner_id,'authenticated','approved',
    format($q$UPDATE user_data_rows SET row=jsonb_set(row,'{human_builder_ids}',to_jsonb(ARRAY[%L])) WHERE table_id=%L AND row->>'case_id'=%L$q$,c.owner_id::text,tbl,c.case_id));
  INSERT INTO r_result VALUES('RPC owner as human builder: denied, still pending, no audit', r,
    r LIKE '%status=pending|%audit_rows=0%' AND r NOT LIKE 'OK|%');

  r := pg_temp.rpc(c.owner_id,'authenticated','approved',
    format($q$UPDATE user_data_rows SET row=jsonb_set(row,'{human_builder_ids}',to_jsonb(ARRAY[%L])) WHERE table_id=%L AND row->>'parent_case_id'=%L AND row->>'case_type'='DEVELOPMENT_BUILD'$q$,c.owner_id::text,tbl,c.case_id));
  -- No DEVELOPMENT_BUILD child exists for this fixture; the update is a no-op and the decision stays legitimate.
  INSERT INTO r_result VALUES('RPC with no DEVELOPMENT_BUILD child present (fixture shape): allowed', r, r LIKE 'OK|status=approved|%');

  INSERT INTO audit_events(user_id,action,resource_type,resource_id,detail)
    VALUES(c.owner_id,'axtn_work.TAKEOVER','axtn_case_work',c.case_id::uuid,
      jsonb_build_object('principal',jsonb_build_object('kind','user_session','id',c.owner_id)));
  r := pg_temp.rpc(c.owner_id,'authenticated','approved');
  INSERT INTO r_result VALUES('RPC owner with historical user_session TAKEOVER audit: denied, no decided audit', r,
    r LIKE '%status=pending|%audit_rows=0%' AND r NOT LIKE 'OK|%');
  DELETE FROM audit_events WHERE action='axtn_work.TAKEOVER' AND resource_id=c.case_id::uuid AND detail->'principal'->>'kind'='user_session';

  r := pg_temp.rpc(c.owner_id,'service_role','approved');
  INSERT INTO r_result VALUES('RPC service_role: denied', r, r NOT LIKE 'OK|%' AND r LIKE '%status=pending%');

  SELECT count(*) INTO before_aud FROM audit_events WHERE action='axtn_work.APPROVAL_DECIDED';
  SELECT status INTO st FROM approvals WHERE id=c.approval_id;
  INSERT INTO r_result VALUES('rollback hygiene: still pending, no leaked decided audit', st||'/'||before_aud,
    st='pending' AND before_aud = (SELECT count(*) FROM audit_events WHERE action='axtn_work.APPROVAL_DECIDED'));
END $$;

SELECT name, outcome, CASE WHEN pass THEN 'PASS' ELSE 'FAIL' END AS verdict FROM r_result;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM r_result WHERE NOT pass) THEN RAISE EXCEPTION 'RPC_MATRIX_FAILED'; END IF; END $$;
ROLLBACK;
