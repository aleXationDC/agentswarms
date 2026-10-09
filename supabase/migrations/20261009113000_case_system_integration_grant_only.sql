-- SYSTEM_INTEGRATION may use only an active credential explicitly granted
-- through native IAM to the server-derived policy user or one of their groups.
-- PERSONAL_CONNECTION remains owner-only; no credentials or grants are created.
CREATE OR REPLACE FUNCTION public.axtn_case_credential_candidates(
  actor uuid,
  provider_id text,
  personal boolean
)
RETURNS TABLE(source text,id uuid,owner_id uuid)
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
  WITH grants AS (
    SELECT DISTINCT g.resource_type,g.resource_id
    FROM iam_resource_grants g
    WHERE NOT personal AND (
      g.principal_type='user' AND g.principal_id=actor
      OR g.principal_type='group' AND EXISTS(
        SELECT 1 FROM iam_group_members m
        WHERE m.user_id=actor AND m.group_id=g.principal_id
      )
    )
  )
  SELECT 'integration',i.id,i.user_id
  FROM integrations i
  WHERE i.is_active
    AND i.type='llm_provider'
    AND i.provider=provider_id
    AND EXISTS(
      SELECT 1 FROM auth.users owner
      WHERE owner.id=i.user_id
        AND owner.deleted_at IS NULL
        AND (owner.banned_until IS NULL OR owner.banned_until<=now())
    )
    AND (
      personal AND i.user_id=actor
      OR NOT personal AND EXISTS(
        SELECT 1 FROM grants g
        WHERE g.resource_type='integration' AND g.resource_id=i.id
      )
    )
  UNION ALL
  SELECT 'provider_credential',c.id,c.user_id
  FROM provider_credentials c
  WHERE c.is_active
    AND c.provider=provider_id
    AND EXISTS(
      SELECT 1 FROM auth.users owner
      WHERE owner.id=c.user_id
        AND owner.deleted_at IS NULL
        AND (owner.banned_until IS NULL OR owner.banned_until<=now())
    )
    AND (
      personal AND c.user_id=actor
      OR NOT personal AND EXISTS(
        SELECT 1 FROM grants g
        WHERE g.resource_type='provider_credential' AND g.resource_id=c.id
      )
    );
$$;
