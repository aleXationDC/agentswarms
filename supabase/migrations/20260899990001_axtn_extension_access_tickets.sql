CREATE SCHEMA IF NOT EXISTS axtn;

CREATE TABLE IF NOT EXISTS axtn.extension_access_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extension_id text NOT NULL CHECK (extension_id ~ '^[a-z0-9-]+$'),
  target_host text NOT NULL CHECK (target_host = lower(target_host)),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

REVOKE ALL ON TABLE axtn.extension_access_tickets FROM anon, authenticated;
