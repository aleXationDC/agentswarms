-- Explicit maintenance close.
--
-- The AAL2-superadmin server action calls this service-role-only function
-- before sending the browser to the extension host to clear its host cookie.
-- Revoking every active session and outstanding ticket for this user +
-- extension makes close immediate across tabs and devices; normal expires_at
-- checks remain the automatic close path.

CREATE INDEX IF NOT EXISTS idx_axtn_extension_access_tickets_creator_active
  ON axtn.extension_access_tickets (created_by, extension_id, target_host, expires_at)
  WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_axtn_extension_access_sessions_creator_active
  ON axtn.extension_access_sessions (created_by, extension_id, target_host, expires_at)
  WHERE revoked_at IS NULL;

CREATE OR REPLACE FUNCTION public.axtn_revoke_extension_access_for_user(
  _extension_id text,
  _target_url text,
  _target_host text,
  _created_by uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, axtn
AS $$
DECLARE
  revoked_count integer;
BEGIN
  IF _extension_id !~ '^[a-z0-9-]+$'
     OR _target_url !~ '^https://[^[:space:]]+$'
     OR _target_host <> lower(_target_host)
     OR NOT EXISTS (
       SELECT 1
       FROM public.user_roles r
       WHERE r.user_id = _created_by AND r.role = 'superadmin'
     )
  THEN
    RAISE EXCEPTION 'invalid aXtn extension access close'
      USING ERRCODE = '22023';
  END IF;

  WITH closed_tickets AS (
    UPDATE axtn.extension_access_tickets AS t
    SET used_at = now()
    WHERE t.created_by = _created_by
      AND t.extension_id = _extension_id
      AND t.target_url = _target_url
      AND t.target_host = _target_host
      AND t.used_at IS NULL
      AND t.expires_at > now()
    RETURNING 1
  ),
  closed_sessions AS (
    UPDATE axtn.extension_access_sessions AS s
    SET revoked_at = now()
    WHERE s.created_by = _created_by
      AND s.extension_id = _extension_id
      AND s.target_url = _target_url
      AND s.target_host = _target_host
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
    RETURNING 1
  )
  SELECT
    (
      (SELECT count(*) FROM closed_tickets)
      + (SELECT count(*) FROM closed_sessions)
    )::integer
  INTO revoked_count;

  RETURN revoked_count;
END;
$$;

REVOKE ALL ON FUNCTION public.axtn_revoke_extension_access_for_user(
  text, text, text, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.axtn_revoke_extension_access_for_user(
  text, text, text, uuid
) TO service_role;
