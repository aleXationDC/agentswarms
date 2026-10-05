-- Existing run/decision identity selects the profile, not a client redaction flag.
CREATE FUNCTION public.guard_axtn_document_parent_model_trace() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  parent_id constant uuid := '9b9ea6c2-a554-4fa7-9c40-908dad632ae7';
  run_owner uuid;
  old_owner uuid;
  protected boolean;
  old_protected boolean := false;
  usage_metadata jsonb;
BEGIN
  SELECT user_id INTO run_owner FROM public.swarm_runs
    WHERE id=NEW.decision_id AND swarm_id=parent_id FOR SHARE;
  protected := run_owner IS NOT NULL;
  IF TG_OP='UPDATE' THEN
    SELECT user_id INTO old_owner FROM public.swarm_runs
      WHERE id=OLD.decision_id AND swarm_id=parent_id FOR SHARE;
    old_protected := old_owner IS NOT NULL OR coalesce(
      OLD.request_payload->>'schemaVersion'='document-model-trace-redaction-v1',false);
    IF (protected OR old_protected) AND (NEW.id IS DISTINCT FROM OLD.id
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.decision_id IS DISTINCT FROM OLD.decision_id)
    THEN RAISE EXCEPTION 'DOCUMENT_MODEL_TRACE_IMMUTABLE_BINDING_REQUIRED'; END IF;
  END IF;
  IF old_protected AND NOT protected
  THEN RAISE EXCEPTION 'DOCUMENT_MODEL_TRACE_OWNED_PARENT_REQUIRED'; END IF;
  IF protected THEN
    IF NEW.user_id IS DISTINCT FROM run_owner
    THEN RAISE EXCEPTION 'DOCUMENT_MODEL_TRACE_OWNED_PARENT_REQUIRED'; END IF;
    SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO usage_metadata
      FROM jsonb_each(CASE WHEN jsonb_typeof(NEW.request_payload)='object'
        THEN NEW.request_payload ELSE '{}'::jsonb END)
      WHERE (key IN ('tokens_estimated','pricing_missing','replayed_final')
          AND jsonb_typeof(value)='boolean')
        OR (key='price_source' AND value#>>'{}' IN
          ('provider','override','catalog','bundled','self-hosted'))
        OR (key IN ('turn_tokens_in','turn_tokens_out','turn_cost_usd','image_count')
          AND jsonb_typeof(value)='number');
    NEW.prompt := NULL;
    NEW.request_payload := usage_metadata ||
      '{"schemaVersion":"document-model-trace-redaction-v1","redacted":true}'::jsonb;
    NEW.response_payload := '{"schemaVersion":"document-model-trace-redaction-v1","redacted":true}'::jsonb;
    NEW.tool_calls := '[]'::jsonb;
    NEW.error_message := CASE WHEN NEW.error_message IS NULL THEN NULL
      ELSE 'DOCUMENT_NATIVE_MODEL_FAILED' END;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_axtn_document_parent_model_trace()
  FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER protect_axtn_document_parent_model_bodies BEFORE INSERT OR UPDATE
  ON public.execution_traces FOR EACH ROW
  EXECUTE FUNCTION public.guard_axtn_document_parent_model_trace();
