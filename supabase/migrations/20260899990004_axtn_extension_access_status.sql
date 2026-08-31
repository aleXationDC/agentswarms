CREATE OR REPLACE FUNCTION public.axtn_get_extension_access_status(
  _extension_id text,
  _target_url text,
  _target_host text,
  _created_by uuid
)
RETURNS TABLE (expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, axtn
AS $$
  SELECT s.expires_at
  FROM axtn.extension_access_sessions AS s
  WHERE s.extension_id = _extension_id
    AND s.target_url = _target_url
    AND s.target_host = _target_host
    AND s.created_by = _created_by
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
  ORDER BY s.expires_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.axtn_get_extension_access_status(
  text, text, text, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.axtn_get_extension_access_status(
  text, text, text, uuid
) TO service_role;
