-- Narrow native Parent trace protection; checkpoint and ingress codecs remain separate.
CREATE FUNCTION public.guard_axtn_document_parent_trace() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  parent_id constant uuid := '9b9ea6c2-a554-4fa7-9c40-908dad632ae7';
  protected boolean := false;
  run_owner uuid;
  run_swarm uuid;
  old_swarm uuid;
BEGIN
  IF TG_TABLE_NAME='swarm_runs' THEN
    protected := NEW.swarm_id=parent_id;
    IF TG_OP='UPDATE' THEN
      protected := coalesce(protected,false) OR OLD.swarm_id=parent_id;
      IF protected AND (NEW.id IS DISTINCT FROM OLD.id
        OR NEW.user_id IS DISTINCT FROM OLD.user_id
        OR NEW.swarm_id IS DISTINCT FROM OLD.swarm_id)
      THEN RAISE EXCEPTION 'DOCUMENT_TRACE_IMMUTABLE_RUN_BINDING_REQUIRED'; END IF;
    END IF;
    IF protected THEN
      NEW.final_output := NULL;
      NEW.error_message := CASE WHEN NEW.error_message IS NULL THEN NULL
        ELSE 'DOCUMENT_NATIVE_RUN_FAILED' END;
    END IF;
  ELSE
    SELECT user_id,swarm_id INTO run_owner,run_swarm FROM public.swarm_runs
      WHERE id=NEW.run_id FOR SHARE;
    protected := coalesce(run_swarm=parent_id,false);
    IF TG_OP='UPDATE' THEN
      IF OLD.run_id=NEW.run_id THEN old_swarm:=run_swarm;
      ELSE
        SELECT swarm_id INTO old_swarm FROM public.swarm_runs
          WHERE id=OLD.run_id FOR SHARE;
      END IF;
      protected := protected OR coalesce(old_swarm=parent_id,false);
      IF protected AND (NEW.id IS DISTINCT FROM OLD.id
        OR NEW.run_id IS DISTINCT FROM OLD.run_id
        OR NEW.user_id IS DISTINCT FROM OLD.user_id)
      THEN RAISE EXCEPTION 'DOCUMENT_TRACE_IMMUTABLE_ROW_BINDING_REQUIRED'; END IF;
    END IF;
    IF protected THEN
      IF run_owner IS DISTINCT FROM NEW.user_id
      THEN RAISE EXCEPTION 'DOCUMENT_TRACE_OWNED_PARENT_REQUIRED'; END IF;
      IF TG_TABLE_NAME='swarm_run_steps' THEN
        NEW.input := '{"schemaVersion":"document-trace-redaction-v1","redacted":true}'::jsonb;
        NEW.output := NULL;
        NEW.thinking := NULL;
        NEW.tool_calls := '[]'::jsonb;
        NEW.memory_used := '[]'::jsonb;
        NEW.rag_chunks := '[]'::jsonb;
        NEW.data_extractions := '[]'::jsonb;
        NEW.error_message := CASE WHEN NEW.error_message IS NULL THEN NULL
          ELSE 'DOCUMENT_NATIVE_NODE_FAILED' END;
      ELSE
        NEW.payload_preview := NULL;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_axtn_document_parent_trace()
  FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER protect_axtn_document_parent_run_bodies BEFORE INSERT OR UPDATE
  ON public.swarm_runs FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_document_parent_trace();
CREATE TRIGGER protect_axtn_document_parent_step_bodies BEFORE INSERT OR UPDATE
  ON public.swarm_run_steps FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_document_parent_trace();
CREATE TRIGGER protect_axtn_document_parent_edge_bodies BEFORE INSERT OR UPDATE
  ON public.swarm_run_edges FOR EACH ROW EXECUTE FUNCTION public.guard_axtn_document_parent_trace();
