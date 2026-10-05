-- Existing native cache only; no checkpoint, effect or acceptance authority.
CREATE FUNCTION public.guard_axtn_document_parent_api_key() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  parent_id constant uuid := '9b9ea6c2-a554-4fa7-9c40-908dad632ae7';
  swarm_owner uuid;
BEGIN
  IF TG_OP='UPDATE' AND (OLD.swarm_id=parent_id OR NEW.swarm_id=parent_id)
    AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.swarm_id IS DISTINCT FROM OLD.swarm_id)
  THEN RAISE EXCEPTION 'DOCUMENT_CACHE_IMMUTABLE_KEY_BINDING_REQUIRED'; END IF;
  IF NEW.swarm_id=parent_id THEN
    SELECT user_id INTO swarm_owner FROM public.swarms WHERE id=parent_id FOR SHARE;
    IF swarm_owner IS DISTINCT FROM NEW.user_id
    THEN RAISE EXCEPTION 'DOCUMENT_CACHE_OWNED_KEY_REQUIRED'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_axtn_document_parent_api_key()
  FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER protect_axtn_document_parent_api_key_binding BEFORE INSERT OR UPDATE
  ON public.swarm_api_keys FOR EACH ROW
  EXECUTE FUNCTION public.guard_axtn_document_parent_api_key();

CREATE FUNCTION public.guard_axtn_document_parent_idempotency() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  parent_id constant uuid := '9b9ea6c2-a554-4fa7-9c40-908dad632ae7';
  key_owner uuid;
  key_swarm uuid;
  run_owner uuid;
  run_swarm uuid;
  old_key_swarm uuid;
  old_run_swarm uuid;
  protected boolean;
  expected_status text;
  expected_output text;
  failure_code text;
BEGIN
  SELECT user_id,swarm_id INTO key_owner,key_swarm FROM public.swarm_api_keys
    WHERE id=NEW.api_key_id FOR SHARE;
  IF NEW.run_id IS NOT NULL THEN
    SELECT user_id,swarm_id INTO run_owner,run_swarm FROM public.swarm_runs
      WHERE id=NEW.run_id FOR SHARE;
  END IF;
  protected := coalesce(key_swarm=parent_id,false) OR coalesce(run_swarm=parent_id,false);
  IF TG_OP='UPDATE' THEN
    IF OLD.api_key_id=NEW.api_key_id THEN old_key_swarm:=key_swarm;
    ELSE
      SELECT swarm_id INTO old_key_swarm FROM public.swarm_api_keys
        WHERE id=OLD.api_key_id FOR SHARE;
    END IF;
    IF OLD.run_id=NEW.run_id THEN old_run_swarm:=run_swarm;
    ELSIF OLD.run_id IS NOT NULL THEN
      SELECT swarm_id INTO old_run_swarm FROM public.swarm_runs
        WHERE id=OLD.run_id FOR SHARE;
    END IF;
    protected := protected OR coalesce(old_key_swarm=parent_id,false)
      OR coalesce(old_run_swarm=parent_id,false);
    IF protected AND (NEW.id IS DISTINCT FROM OLD.id
      OR NEW.api_key_id IS DISTINCT FROM OLD.api_key_id
      OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
      OR NEW.request_hash IS DISTINCT FROM OLD.request_hash
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR (OLD.run_id IS NOT NULL AND NEW.run_id IS DISTINCT FROM OLD.run_id))
    THEN RAISE EXCEPTION 'DOCUMENT_CACHE_IMMUTABLE_RECORD_BINDING_REQUIRED'; END IF;
  END IF;
  IF NOT protected THEN RETURN NEW; END IF;
  IF key_swarm IS DISTINCT FROM parent_id OR (NEW.run_id IS NOT NULL
    AND (run_swarm IS DISTINCT FROM parent_id OR run_owner IS DISTINCT FROM key_owner))
  THEN RAISE EXCEPTION 'DOCUMENT_CACHE_OWNED_PARENT_REQUIRED'; END IF;
  IF NEW.response IS NULL THEN RETURN NEW; END IF;
  IF jsonb_typeof(NEW.response) IS DISTINCT FROM 'object'
  THEN RAISE EXCEPTION 'DOCUMENT_CACHE_MINIMIZED_RESPONSE_REQUIRED'; END IF;
  IF NEW.response->'runId' IS DISTINCT FROM coalesce(to_jsonb(NEW.run_id::text),'null'::jsonb)
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(NEW.response) AS k
      WHERE k NOT IN ('runId','status','output','error','swarmId'))
    OR (NEW.response ? 'swarmId' AND NEW.response->'swarmId'
      IS DISTINCT FROM to_jsonb(parent_id::text))
  THEN RAISE EXCEPTION 'DOCUMENT_CACHE_MINIMIZED_RESPONSE_REQUIRED'; END IF;
  expected_status := CASE NEW.status WHEN 'in_progress' THEN 'suspended'
    WHEN 'completed' THEN 'success' WHEN 'failed' THEN 'error' END;
  expected_output := CASE NEW.status
    WHEN 'in_progress' THEN '{"schemaVersion":"document-suspended-output-v1"}'
    WHEN 'completed' THEN '{"schemaVersion":"document-completed-output-v1"}'
    WHEN 'failed' THEN '{"schemaVersion":"document-failed-output-v1"}' END;
  IF (NEW.response ? 'status' AND NEW.response->'status'
      IS DISTINCT FROM to_jsonb(expected_status))
    OR (NEW.status='in_progress' AND NOT (NEW.response ? 'status'))
    OR (NEW.status<>'failed' AND NOT (NEW.response ? 'output'))
    OR (NEW.response ? 'output' AND NEW.response->'output'
      IS DISTINCT FROM to_jsonb(expected_output))
    OR (NEW.status<>'failed' AND NEW.response ? 'error'
      AND NEW.response->'error' IS DISTINCT FROM 'null'::jsonb)
  THEN RAISE EXCEPTION 'DOCUMENT_CACHE_MINIMIZED_RESPONSE_REQUIRED'; END IF;
  IF NEW.status='failed' THEN
    failure_code:=NEW.response->>'error';
    IF jsonb_typeof(NEW.response->'error') IS DISTINCT FROM 'string'
      OR failure_code IS NULL OR NOT failure_code=ANY(ARRAY[
        'DOCUMENT_RUN_FAILED',
        'DOCUMENT_RUN_IDEMPOTENCY_READ_FAILED',
        'DOCUMENT_RUN_CLAIM_FAILED',
        'DOCUMENT_RUN_OUTCOME_WRITE_FAILED',
        'DOCUMENT_PARENT_REGISTRATION_RUN_REQUIRED',
        'DOCUMENT_PARENT_REGISTRATION_RUN_READ',
        'DOCUMENT_PARENT_REGISTRATION_OWNED_RUN_REQUIRED',
        'DOCUMENT_PARENT_REGISTRATION_CHECKPOINT_REQUIRED',
        'DOCUMENT_PARENT_REGISTRATION_CACHED_RESPONSE_REQUIRED',
        'DOCUMENT_PARENT_REGISTRATION_COMPLETED_INTAKE_REQUIRED',
        'DOCUMENT_PARENT_REGISTRATION_REQUEST_BINDING_REQUIRED',
        'DOCUMENT_PARENT_REGISTRATION_DATASET_READ',
        'DOCUMENT_PARENT_REGISTRATION_OWNED_DATASET_REQUIRED',
        'DOCUMENT_PARENT_REGISTRATION_ROW_READ',
        'DOCUMENT_PARENT_REGISTRATION_PERSISTED_ROWS_REQUIRED',
        'DOCUMENT_PARENT_REGISTRATION_MINIMIZED_BINDING_REQUIRED',
        'DOCUMENT_PARENT_REGISTRATION_PERSISTED_BINDING_REQUIRED',
        'DOCUMENT_PARENT_REGISTRATION_FIRST_CASE_REQUIRED',
        'DOCUMENT_CHECKPOINT_COMPLETE_STATE_REQUIRED',
        'DOCUMENT_CHECKPOINT_WRITE_FAILED',
        'DOCUMENT_CHECKPOINT_READ_FAILED',
        'DOCUMENT_PROVENANCE_OWNED_PARENT_REQUIRED',
        'DOCUMENT_RESUME_SUSPENDED_PARENT_REQUIRED',
        'DOCUMENT_RESUME_GRAPH_REQUIRED',
        'DOCUMENT_RESUME_EXACT_ROUTING_REQUIRED',
        'DOCUMENT_RESUME_APPROVAL_DECISION_REQUIRED',
        'DOCUMENT_RESUME_CLAIM_FAILED',
        'DOCUMENT_RESUME_CLAIM_UNAVAILABLE'])
    THEN RAISE EXCEPTION 'DOCUMENT_CACHE_MINIMIZED_RESPONSE_REQUIRED'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_axtn_document_parent_idempotency()
  FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER protect_axtn_document_parent_idempotency_bodies BEFORE INSERT OR UPDATE
  ON public.swarm_run_idempotency FOR EACH ROW
  EXECUTE FUNCTION public.guard_axtn_document_parent_idempotency();
