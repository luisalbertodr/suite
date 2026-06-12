-- Marketing: permisos evaluados por empresa concreta (p_company_id) y recepción con acceso en M+E.

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
  WITH role_perms AS (
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

GRANT EXECUTE ON FUNCTION public.get_effective_user_permissions(uuid, uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_effective_user_permissions(uuid, uuid) IS
  'Permisos efectivos del usuario en la empresa p_company_id (o empresa activa si NULL).';

-- Recepción M+E: marketing read+write en ambas empresas (tablero siempre en Estética).
DO $$
DECLARE
  v_user uuid;
  v_read uuid;
  v_write uuid;
  v_estetica uuid := '816af484-92a0-4f65-a5a7-1c907aa4bb3d';
  v_medicina uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
BEGIN
  SELECT id INTO v_read FROM public.permissions WHERE resource = 'marketing' AND action = 'read';
  SELECT id INTO v_write FROM public.permissions WHERE resource = 'marketing' AND action = 'write';
  IF v_read IS NULL OR v_write IS NULL THEN
    RETURN;
  END IF;

  FOR v_user IN
    SELECT DISTINCT ucr.user_id
    FROM public.user_company_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id AND r.name = 'recepcion'
    WHERE ucr.company_id IN (v_estetica, v_medicina)
  LOOP
    DELETE FROM public.user_permission_overrides upo
    WHERE upo.user_id = v_user
      AND upo.company_id IN (v_estetica, v_medicina)
      AND upo.permission_id IN (v_read, v_write);

    INSERT INTO public.user_permission_overrides (
      user_id, company_id, permission_id, resource, action, mode, reason
    ) VALUES
      (v_user, v_estetica, v_read, NULL, NULL, 'allow', 'marketing_scope M+E'),
      (v_user, v_estetica, v_write, NULL, NULL, 'allow', 'marketing_scope M+E'),
      (v_user, v_medicina, v_read, NULL, NULL, 'allow', 'marketing_scope M+E'),
      (v_user, v_medicina, v_write, NULL, NULL, 'allow', 'marketing_scope M+E');
  END LOOP;
END $$;
