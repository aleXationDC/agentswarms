-- Explicit authenticated native starts have their own execution Attempt.
-- Existing Work/Candidate attempts and non-native entry points retain their contract.
DO $migration$
DECLARE definition text;
  old_fragment text := 'attempt:=COALESCE(value->>''attempt_id'',run.id::text);';
  new_fragment text := $replacement$
      IF p_payload->'nativeStart'='true'::jsonb THEN
        IF principal->>'kind'<>'user_session'
          OR COALESCE(run.swarm_snapshot->>'startRequestHash','') !~ '^[a-f0-9]{64}$'
          OR COALESCE(run.swarm_snapshot->>'publishedVersionId','') !~ '^[a-f0-9-]{36}$'
        THEN RAISE EXCEPTION 'CASE_EXECUTION_BINDING_REQUIRED'; END IF;
        attempt:=run.id::text;
      ELSE
        attempt:=COALESCE(value->>'attempt_id',run.id::text);
      END IF;
  $replacement$;
BEGIN
  SELECT pg_get_functiondef('public.axtn_case_execution(uuid,text,jsonb)'::regprocedure)
    INTO definition;
  IF position(new_fragment IN definition)>0 THEN RETURN; END IF;
  IF position(old_fragment IN definition)=0
    OR position(old_fragment IN substr(definition,position(old_fragment IN definition)+length(old_fragment)))>0
  THEN RAISE EXCEPTION 'NATIVE_CASE_START_BINDING_SOURCE_DRIFT'; END IF;
  EXECUTE replace(definition,old_fragment,new_fragment);
END;
$migration$;
