-- ABANDONED path of axtn_case_work_before_responsibility wrote
--   COALESCE(current_case->'references','[]')||payload->'references'
-- which parses as (COALESCE(..)||payload)->'references' = NULL, so the Case lost ALL
-- references (prior and new) on abandonment. Only that expression is changed; the rest
-- of the function body is taken from the currently installed definition.
-- Re-runnable: no-op once the parenthesised form is installed.
DO $migration$
DECLARE
  def text := pg_get_functiondef('public.axtn_case_work_before_responsibility(uuid,text,jsonb)'::regprocedure);
  broken constant text := E'COALESCE(current_case->''references'',''[]'')||payload->''references'');';
  fixed constant text := E'COALESCE(current_case->''references'',''[]'')||(payload->''references''));';
BEGIN
  IF position(fixed IN def) > 0 THEN RETURN; END IF;
  IF position(broken IN def) = 0 OR def LIKE '%' || broken || '%' || broken || '%' THEN
    RAISE EXCEPTION 'axtn_case_work_before_responsibility reference expression not found exactly once';
  END IF;
  EXECUTE replace(def, broken, fixed);
END
$migration$;
