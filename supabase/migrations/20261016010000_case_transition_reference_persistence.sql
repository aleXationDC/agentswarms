-- Fixes Case reference persistence for transitions in axtn_case_work_bootstrap.
-- `a || p_payload->'references'` parses as `(a || p_payload)->'references'`, which is NULL,
-- so references sent with any transition (for example the PR_CREATED pull_request reference
-- that native Acceptance reads) were silently dropped. Only that expression is changed;
-- the rest of the function body is taken from the currently installed definition.
-- Re-runnable: it is a no-op once the parenthesised form is installed.
DO $migration$
DECLARE
  def text := pg_get_functiondef('public.axtn_case_work_bootstrap(uuid,text,jsonb)'::regprocedure);
  broken constant text := E'|| p_payload->''references'') ref));';
  fixed constant text := E'|| (p_payload->''references'')) ref));';
BEGIN
  IF position(fixed IN def) > 0 THEN RETURN; END IF;
  IF position(broken IN def) = 0 OR def LIKE '%' || broken || '%' || broken || '%' THEN
    RAISE EXCEPTION 'axtn_case_work_bootstrap reference expression not found exactly once';
  END IF;
  EXECUTE replace(def, broken, fixed);
END
$migration$;
