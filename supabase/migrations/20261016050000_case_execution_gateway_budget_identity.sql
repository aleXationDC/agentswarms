-- Narrows 20261016040000 (already applied; not rewritten): the owner-identity budget view is returned
-- only for gateway opt-in nodes, which must decide exactly like the equivalent non-Case run.
-- Non-gateway SYSTEM_INTEGRATION nodes keep the existing Case company-funding (responsible-group
-- budget) contract and only take the node's own explicit provider/model. Persisted bindings are untouched.
-- Re-runnable: a no-op once applied. Only axtn_case_execution is touched.
DO $migration$
DECLARE
  def text := pg_get_functiondef('public.axtn_case_execution(uuid,text,jsonb)'::regprocedure);
  old_block constant text := $q$  IF standard_route THEN
    RETURN binding||jsonb_build_object('execution_class','SYSTEM_INTEGRATION',
      'execution_principal_type','SYSTEM','execution_principal_user_id',NULL,
      'policy_user_id',p_user_id,'budget_subject_user_id',p_user_id,'budget_subject_group_id',NULL,
      'provider_id',provider_id,'model_id',model_id);
  END IF;
$q$;
  new_block constant text := $q$  IF gateway_route THEN
    RETURN binding||jsonb_build_object('execution_class','SYSTEM_INTEGRATION',
      'execution_principal_type','SYSTEM','execution_principal_user_id',NULL,
      'policy_user_id',p_user_id,'budget_subject_user_id',p_user_id,'budget_subject_group_id',NULL,
      'provider_id',provider_id,'model_id',model_id);
  ELSIF standard_route THEN
    RETURN binding||jsonb_build_object('provider_id',provider_id,'model_id',model_id);
  END IF;
$q$;
  hits int;
BEGIN
  IF position('ELSIF standard_route THEN' IN def) > 0 THEN RETURN; END IF;
  hits := (length(def)-length(replace(def,old_block,'')))/length(old_block);
  IF hits<>1 THEN RAISE EXCEPTION 'axtn_case_execution return block not found exactly once'; END IF;
  EXECUTE replace(def,old_block,new_block);
END
$migration$;
