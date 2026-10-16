-- Native execution-identity parity for Case-bound runs (follow-up to 20261016030000).
-- For standard (non-personal) executions and every gateway opt-in node, the policy identity is the
-- run owner, i.e. the validated native owner of the run/API key that p_user_id already proves
-- (identical to the equivalent non-Case run), not the Case assignee/payer. Provider/model come
-- from the node's own published configuration when it names both; Case semantic-route fields are
-- only a fallback. Budget is the owner's native decision. The persisted attempt binding (history,
-- active attempts) is untouched: only the value returned to the caller is the effective view.
-- PERSONAL_CONNECTION nodes without gateway opt-in (personal account/plan path) are unchanged.
-- Re-runnable: a no-op once applied. Only axtn_case_execution is touched.
DO $migration$
DECLARE
  def text := pg_get_functiondef('public.axtn_case_execution(uuid,text,jsonb)'::regprocedure);
  decl_old constant text := $q$ gateway_route boolean:=false; gateway_id uuid;
BEGIN
$q$;
  decl_new constant text := $q$ gateway_route boolean:=false; gateway_id uuid; standard_route boolean:=false;
BEGIN
$q$;
  actor_old constant text := $q$  actor:=(binding->>'policy_user_id')::uuid;
$q$;
  actor_new constant text := $q$  actor:=(binding->>'policy_user_id')::uuid;
  gateway_route:=COALESCE(node#>>'{data,routeThroughGateway}','')='true';
  standard_route:=gateway_route OR NOT personal;
  IF standard_route THEN
    actor:=p_user_id; personal:=false;
    IF NULLIF(node#>>'{data,provider}','') IS NOT NULL AND NULLIF(node#>>'{data,model}','') IS NOT NULL THEN
      provider_id:=node#>>'{data,provider}'; model_id:=node#>>'{data,model}';
    END IF;
  END IF;
$q$;
  ret_old constant text := $q$  RETURN binding;
END;
$q$;
  ret_new constant text := $q$  IF standard_route THEN
    RETURN binding||jsonb_build_object('execution_class','SYSTEM_INTEGRATION',
      'execution_principal_type','SYSTEM','execution_principal_user_id',NULL,
      'policy_user_id',p_user_id,'budget_subject_user_id',p_user_id,'budget_subject_group_id',NULL,
      'provider_id',provider_id,'model_id',model_id);
  END IF;
  RETURN binding;
END;
$q$;
  hits int;
BEGIN
  IF position('standard_route' IN def) > 0 THEN RETURN; END IF;
  FOREACH hits IN ARRAY ARRAY[
    (length(def)-length(replace(def,decl_old,'')))/length(decl_old),
    (length(def)-length(replace(def,actor_old,'')))/length(actor_old),
    (length(def)-length(replace(def,ret_old,'')))/length(ret_old)]
  LOOP
    IF hits<>1 THEN RAISE EXCEPTION 'axtn_case_execution anchors not found exactly once'; END IF;
  END LOOP;
  EXECUTE replace(replace(replace(def,decl_old,decl_new),actor_old,actor_new),ret_old,ret_new);
END
$migration$;
