-- Native, short-lived access for private aXtn system extensions.
--
-- The browser receives two opaque capabilities:
--   1. a 90-second, single-use ticket issued only after an AAL2 superadmin
--      check in the application server;
--   2. a 15-minute host-bound access session created when that ticket is
--      atomically consumed at the extension host.
--
-- Both plaintext values exist only in the browser. Postgres stores SHA-256
-- hashes, and the private axtn tables are reachable only through the
-- service-role-only functions below.

ALTER TABLE axtn.extension_access_tickets
  ADD COLUMN IF NOT EXISTS target_url text,
  ADD COLUMN IF NOT EXISTS assurance_level text NOT NULL DEFAULT 'aal2';

-- The preceding migration had no issuer, so there cannot be a legitimate
-- outstanding ticket yet. This makes the upgrade safe if it was pushed on its
-- own before the application code shipped.
UPDATE axtn.extension_access_tickets
SET target_url = 'https://' || target_host || '/'
WHERE target_url IS NULL;

ALTER TABLE axtn.extension_access_tickets
  ALTER COLUMN target_url SET NOT NULL;

ALTER TABLE axtn.extension_access_tickets
  DROP CONSTRAINT IF EXISTS extension_access_tickets_target_url_https,
  ADD CONSTRAINT extension_access_tickets_target_url_https
    CHECK (target_url ~ '^https://[^[:space:]]+$'),
  DROP CONSTRAINT IF EXISTS extension_access_tickets_assurance_level_aal2,
  ADD CONSTRAINT extension_access_tickets_assurance_level_aal2
    CHECK (assurance_level = 'aal2'),
  DROP CONSTRAINT IF EXISTS extension_access_tickets_token_hash_sha256,
  ADD CONSTRAINT extension_access_tickets_token_hash_sha256
    CHECK (token_hash ~ '^[0-9a-f]{64}$');

CREATE INDEX IF NOT EXISTS idx_axtn_extension_access_tickets_expiry
  ON axtn.extension_access_tickets (expires_at)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS axtn.extension_access_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL UNIQUE
    REFERENCES axtn.extension_access_tickets(id) ON DELETE CASCADE,
  extension_id text NOT NULL CHECK (extension_id ~ '^[a-z0-9-]+$'),
  target_url text NOT NULL CHECK (target_url ~ '^https://[^[:space:]]+$'),
  target_host text NOT NULL CHECK (target_host = lower(target_host)),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_axtn_extension_access_sessions_active
  ON axtn.extension_access_sessions (token_hash, extension_id, target_host, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE axtn.extension_access_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE axtn.extension_access_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA axtn FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE axtn.extension_access_tickets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE axtn.extension_access_sessions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.axtn_issue_extension_access_ticket(
  _extension_id text,
  _target_url text,
  _target_host text,
  _token_hash text,
  _expires_at timestamptz,
  _created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, axtn
AS $$
DECLARE
  issued_id uuid;
BEGIN
  IF _extension_id !~ '^[a-z0-9-]+$'
     OR _target_url !~ '^https://[^[:space:]]+$'
     OR _target_host <> lower(_target_host)
     OR _token_hash !~ '^[0-9a-f]{64}$'
     OR _expires_at <= now()
     OR _expires_at > now() + interval '5 minutes'
     OR NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _created_by)
     OR NOT EXISTS (
       SELECT 1
       FROM public.user_roles r
       WHERE r.user_id = _created_by AND r.role = 'superadmin'
     )
  THEN
    RAISE EXCEPTION 'invalid aXtn extension access ticket'
      USING ERRCODE = '22023';
  END IF;

  -- Access records are operational state, not the audit trail. Redeem/issue
  -- events are retained in audit_events; stale capabilities can be removed.
  DELETE FROM axtn.extension_access_tickets
  WHERE expires_at < now() - interval '7 days';

  INSERT INTO axtn.extension_access_tickets (
    extension_id,
    target_url,
    target_host,
    token_hash,
    expires_at,
    created_by,
    assurance_level
  )
  VALUES (
    _extension_id,
    _target_url,
    _target_host,
    _token_hash,
    _expires_at,
    _created_by,
    'aal2'
  )
  RETURNING id INTO issued_id;

  RETURN issued_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.axtn_redeem_extension_access_ticket(
  _ticket_id uuid,
  _extension_id text,
  _target_url text,
  _target_host text,
  _ticket_token_hash text,
  _session_token_hash text,
  _session_expires_at timestamptz
)
RETURNS TABLE (
  ticket_id uuid,
  created_by uuid,
  session_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, axtn
AS $$
BEGIN
  IF _extension_id !~ '^[a-z0-9-]+$'
     OR _target_url !~ '^https://[^[:space:]]+$'
     OR _target_host <> lower(_target_host)
     OR _ticket_token_hash !~ '^[0-9a-f]{64}$'
     OR _session_token_hash !~ '^[0-9a-f]{64}$'
     OR _session_expires_at <= now()
     OR _session_expires_at > now() + interval '30 minutes'
  THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH consumed AS (
    UPDATE axtn.extension_access_tickets AS t
    SET used_at = now()
    WHERE t.id = _ticket_id
      AND t.extension_id = _extension_id
      AND t.target_url = _target_url
      AND t.target_host = _target_host
      AND t.token_hash = _ticket_token_hash
      AND t.assurance_level = 'aal2'
      AND t.used_at IS NULL
      AND t.expires_at > now()
      AND EXISTS (
        SELECT 1
        FROM public.user_roles r
        WHERE r.user_id = t.created_by AND r.role = 'superadmin'
      )
    RETURNING t.id, t.created_by
  ),
  created_session AS (
    INSERT INTO axtn.extension_access_sessions (
      ticket_id,
      extension_id,
      target_url,
      target_host,
      token_hash,
      created_by,
      expires_at
    )
    SELECT
      c.id,
      _extension_id,
      _target_url,
      _target_host,
      _session_token_hash,
      c.created_by,
      _session_expires_at
    FROM consumed c
    RETURNING
      extension_access_sessions.ticket_id,
      extension_access_sessions.created_by,
      extension_access_sessions.expires_at
  )
  SELECT
    s.ticket_id,
    s.created_by,
    s.expires_at
  FROM created_session s;
END;
$$;

CREATE OR REPLACE FUNCTION public.axtn_authorize_extension_access_session(
  _extension_id text,
  _target_url text,
  _target_host text,
  _session_token_hash text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, axtn
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM axtn.extension_access_sessions s
    WHERE s.extension_id = _extension_id
      AND s.target_url = _target_url
      AND s.target_host = _target_host
      AND s.token_hash = _session_token_hash
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND EXISTS (
        SELECT 1
        FROM public.user_roles r
        WHERE r.user_id = s.created_by AND r.role = 'superadmin'
      )
  );
$$;

REVOKE ALL ON FUNCTION public.axtn_issue_extension_access_ticket(
  text, text, text, text, timestamptz, uuid
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.axtn_redeem_extension_access_ticket(
  uuid, text, text, text, text, text, timestamptz
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.axtn_authorize_extension_access_session(
  text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.axtn_issue_extension_access_ticket(
  text, text, text, text, timestamptz, uuid
) TO service_role;
GRANT EXECUTE ON FUNCTION public.axtn_redeem_extension_access_ticket(
  uuid, text, text, text, text, text, timestamptz
) TO service_role;
GRANT EXECUTE ON FUNCTION public.axtn_authorize_extension_access_session(
  text, text, text, text
) TO service_role;

COMMENT ON TABLE axtn.extension_access_tickets IS
  'Hashed, AAL2-superadmin-only, host-bound one-time capabilities for private system extensions.';
COMMENT ON TABLE axtn.extension_access_sessions IS
  'Short-lived edge access sessions minted only by atomically consuming an extension access ticket.';
