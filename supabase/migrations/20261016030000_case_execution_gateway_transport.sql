-- Native per-agent LLM Gateway opt-in for Case-bound runs.
-- A node whose published snapshot sets data.routeThroughGateway=true is resolved against the
-- policy user's own active llm_gateway integration (the same lookup the non-Case path uses)
-- instead of demanding exactly one direct llm_provider credential. The transport is recorded
-- in the node route evidence (ids only, no secrets). Nodes without the opt-in are unchanged,
-- and 'credential' (direct credential loading) is refused for gateway nodes: no direct fallback.
-- Only axtn_case_execution is touched; the rest of the body is the installed definition.
-- Re-runnable: a no-op once applied.
DO $migration$
DECLARE
  def text := pg_get_functiondef('public.axtn_case_execution(uuid,text,jsonb)'::regprocedure);
  decl_old constant text := $q$  previous jsonb;
BEGIN
$q$;
  decl_new constant text := $q$  previous jsonb; gateway_route boolean:=false; gateway_id uuid;
BEGIN
$q$;
  count_old constant text := $q$  SELECT count(*) INTO candidate_count FROM axtn_case_credential_candidates(actor,provider_id,personal);
$q$;
  count_new constant text := $q$  gateway_route:=COALESCE(node#>>'{data,routeThroughGateway}','')='true';
  IF gateway_route THEN
    IF p_operation='credential' THEN RAISE EXCEPTION 'ROUTING_DECISION_REQUIRED'; END IF;
    SELECT count(*),(array_agg(i.id))[1] INTO candidate_count,gateway_id FROM integrations i
      WHERE i.user_id=actor AND i.type='llm_gateway' AND i.is_active;
    IF candidate_count=0 THEN RAISE EXCEPTION 'SYSTEM_INTEGRATION_UNAVAILABLE';
    ELSIF candidate_count<>1 THEN RAISE EXCEPTION 'SYSTEM_INTEGRATION_AMBIGUOUS'; END IF;
  ELSE
    SELECT count(*) INTO candidate_count FROM axtn_case_credential_candidates(actor,provider_id,personal);
  END IF;
$q$;
  route_old constant text := $q$jsonb_build_object(run.id::text||':'||node_id,jsonb_build_object('provider_id',provider_id,'model_id',model_id)));$q$;
  route_new constant text := $q$jsonb_build_object(run.id::text||':'||node_id,jsonb_build_object('provider_id',provider_id,'model_id',model_id)
      ||CASE WHEN gateway_route THEN jsonb_build_object('transport','LLM_GATEWAY','gateway_integration_id',gateway_id)
        ELSE '{}'::jsonb END));$q$;
  hits int;
BEGIN
  IF position('gateway_route' IN def) > 0 THEN RETURN; END IF;
  FOREACH hits IN ARRAY ARRAY[
    (length(def)-length(replace(def,decl_old,'')))/length(decl_old),
    (length(def)-length(replace(def,count_old,'')))/length(count_old),
    (length(def)-length(replace(def,route_old,'')))/length(route_old)]
  LOOP
    IF hits<>1 THEN RAISE EXCEPTION 'axtn_case_execution anchors not found exactly once'; END IF;
  END LOOP;
  EXECUTE replace(replace(replace(def,decl_old,decl_new),count_old,count_new),route_old,route_new);
END
$migration$;
