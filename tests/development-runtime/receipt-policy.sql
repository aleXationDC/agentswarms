-- Run inside a transaction that installs the candidate migration and ROLLBACKs.
SELECT set_config('axtn_test.owner',
  (SELECT user_id::text FROM public.swarms
   WHERE id='62bbd9a0-2fb3-4241-828d-584fa76edc74'), true);
INSERT INTO public.notebook_runtime_sessions(id,user_id,kind,entrypoint,inputs)
VALUES('c1934e12-0d49-47b8-a942-864351246cad',
  current_setting('axtn_test.owner')::uuid,'batch','axtn-development-verify-v1',
  '{"effectKey":"axtn-runtime-policy-fixture"}');
DO $$ BEGIN
  BEGIN
    INSERT INTO public.notebook_runtime_sessions(user_id,kind,entrypoint,inputs)
    VALUES(current_setting('axtn_test.owner')::uuid,'batch','axtn-development-verify-v1',
      '{"effectKey":"axtn-runtime-policy-fixture"}');
    RAISE EXCEPTION 'Duplicate effect identity was accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('axtn_test.owner'),'role','authenticated')::text,true);
DO $$ BEGIN
  BEGIN
    UPDATE public.notebook_runtime_sessions SET result='{"gateVerdict":"PASS"}'
      WHERE id='c1934e12-0d49-47b8-a942-864351246cad';
    RAISE EXCEPTION 'Forged receipt was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Native verification receipts are server-owned' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.notebook_runtime_sessions SET entrypoint='generic'
      WHERE id='c1934e12-0d49-47b8-a942-864351246cad';
    RAISE EXCEPTION 'Entrypoint laundering was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Native verification receipts are server-owned' THEN RAISE; END IF;
  END;
  BEGIN
    DELETE FROM public.notebook_runtime_sessions
      WHERE id='c1934e12-0d49-47b8-a942-864351246cad';
    RAISE EXCEPTION 'Native receipt deletion was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Native verification receipts are server-owned' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.notebook_runtime_sessions(user_id,kind,entrypoint)
    VALUES(current_setting('axtn_test.owner')::uuid,'batch','axtn-development-verify-v1');
    RAISE EXCEPTION 'Caller-minted native session was accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Native verification receipts are server-owned' THEN RAISE; END IF;
  END;
END $$;

-- Claims text cannot confer the actual service database role.
SELECT set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('axtn_test.owner'),'role','service_role')::text,true);
DO $$ BEGIN
  BEGIN
    UPDATE public.notebook_runtime_sessions SET result='{"gateVerdict":"PASS"}'
      WHERE id='c1934e12-0d49-47b8-a942-864351246cad';
    RAISE EXCEPTION 'Forged role claims were accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Native verification receipts are server-owned' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
UPDATE public.notebook_runtime_sessions SET result='{"policyFixture":true}'
  WHERE id='c1934e12-0d49-47b8-a942-864351246cad';
RESET ROLE;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.notebook_runtime_sessions
      WHERE id='c1934e12-0d49-47b8-a942-864351246cad'
      AND result='{"policyFixture":true}'::jsonb)
  THEN RAISE EXCEPTION 'Actual service role could not persist a receipt'; END IF;
END $$;
