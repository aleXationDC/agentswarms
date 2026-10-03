-- Protect native verification receipts inside the existing runtime store.
CREATE UNIQUE INDEX development_runtime_effect_identity
  ON public.notebook_runtime_sessions(user_id, (inputs->>'effectKey'))
  WHERE entrypoint='axtn-development-verify-v1';

CREATE OR REPLACE FUNCTION public.guard_development_runtime_receipt()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF (CASE TG_OP
        WHEN 'INSERT' THEN NEW.entrypoint='axtn-development-verify-v1'
        WHEN 'DELETE' THEN OLD.entrypoint='axtn-development-verify-v1'
        ELSE NEW.entrypoint='axtn-development-verify-v1' OR OLD.entrypoint='axtn-development-verify-v1'
      END)
    AND current_user<>'postgres'
    AND current_user<>'service_role'
  THEN RAISE EXCEPTION 'Native verification receipts are server-owned'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_development_runtime_receipts
  BEFORE INSERT OR UPDATE OR DELETE ON public.notebook_runtime_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_development_runtime_receipt();
