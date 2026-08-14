-- Permisos efectivos: ignorar user_permissions / overrides de empresas sin membresía.
-- Limpia huérfanos (p. ej. mariadelgado tras 20260804170000_mariadelgado_medicina_only).

CREATE OR REPLACE FUNCTION public.get_effective_user_permissions(
  p_user_id uuid,
  p_company_id uuid DEFAULT NULL
)
RETURNS TABLE (
  permission_id uuid,
  permission_name text,
  resource text,
  action text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
BEGIN
  v_company := COALESCE(p_company_id, public.get_user_company_id());

  RETURN QUERY
  WITH membership AS (
    SELECT DISTINCT ucr.company_id
    FROM public.user_company_roles ucr
    WHERE ucr.user_id = p_user_id
  ),
  role_perms AS (
    SELECT DISTINCT p.id, p.name, p.resource, p.action
    FROM public.permissions p
    JOIN public.role_permissions rp ON rp.permission_id = p.id
    JOIN public.user_company_roles ucr ON ucr.role_id = rp.role_id
    WHERE ucr.user_id = p_user_id
      AND (v_company IS NULL OR ucr.company_id = v_company)
  ),
  legacy_allow AS (
    SELECT DISTINCT p.id, p.name, p.resource, p.action
    FROM public.permissions p
    JOIN public.user_permissions up ON up.permission_id = p.id
    WHERE up.user_id = p_user_id
      AND EXISTS (SELECT 1 FROM membership m WHERE m.company_id = up.company_id)
      AND (v_company IS NULL OR up.company_id = v_company)
  ),
  allow_overrides AS (
    SELECT DISTINCT p.id, p.name, p.resource, p.action
    FROM public.user_permission_overrides upo
    JOIN public.permissions p
      ON (upo.permission_id IS NOT NULL AND p.id = upo.permission_id)
      OR (upo.permission_id IS NULL AND p.resource = upo.resource AND p.action = upo.action)
    WHERE upo.user_id = p_user_id
      AND upo.mode = 'allow'
      AND EXISTS (SELECT 1 FROM membership m WHERE m.company_id = upo.company_id)
      AND (v_company IS NULL OR upo.company_id = v_company)
  ),
  deny_overrides AS (
    SELECT DISTINCT p.id
    FROM public.user_permission_overrides upo
    JOIN public.permissions p
      ON (upo.permission_id IS NOT NULL AND p.id = upo.permission_id)
      OR (upo.permission_id IS NULL AND p.resource = upo.resource AND p.action = upo.action)
    WHERE upo.user_id = p_user_id
      AND upo.mode = 'deny'
      AND EXISTS (SELECT 1 FROM membership m WHERE m.company_id = upo.company_id)
      AND (v_company IS NULL OR upo.company_id = v_company)
  ),
  union_allow AS (
    SELECT * FROM role_perms
    UNION
    SELECT * FROM legacy_allow
    UNION
    SELECT * FROM allow_overrides
  )
  SELECT ua.id, ua.name, ua.resource, ua.action
  FROM union_allow ua
  WHERE ua.id NOT IN (SELECT id FROM deny_overrides);
END;
$$;

COMMENT ON FUNCTION public.get_effective_user_permissions(uuid, uuid) IS
  'Permisos efectivos en p_company_id (o activa). user_permissions/overrides solo cuentan si hay user_company_roles en esa empresa.';

-- Huérfanos: permisos/overrides en empresas sin rol asignado.
DELETE FROM public.user_permissions up
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_company_roles ucr
  WHERE ucr.user_id = up.user_id
    AND ucr.company_id = up.company_id
);

DELETE FROM public.user_permission_overrides upo
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_company_roles ucr
  WHERE ucr.user_id = upo.user_id
    AND ucr.company_id = upo.company_id
);
