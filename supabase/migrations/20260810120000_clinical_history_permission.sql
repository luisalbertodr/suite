-- Pestaña Historial clínico en ficha de cliente: permiso expreso.
-- Por defecto se otorga a admin/manager/superadmin y a usuarios asignados a Medicina.

INSERT INTO public.permissions (resource, action, name, description) VALUES
  (
    'clinical_history',
    'read',
    'Historial clínico',
    'Ver y gestionar la pestaña Historial clínico en la ficha del cliente'
  )
ON CONFLICT (resource, action) DO UPDATE
  SET name = EXCLUDED.name,
      description = COALESCE(EXCLUDED.description, public.permissions.description);

-- Roles de gestión
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.name) IN ('admin', 'manager', 'superadmin')
  AND p.resource = 'clinical_history'
  AND p.action = 'read'
ON CONFLICT DO NOTHING;

-- Usuarios con asignación a empresa Medicina (Delgado Lamas Medicina Estética SL)
DO $$
DECLARE
  v_medicina uuid := '816af484-92a0-4f65-a5a7-1c907aa4bb3d';
  v_perm_id uuid;
BEGIN
  SELECT id INTO v_perm_id
  FROM public.permissions
  WHERE resource = 'clinical_history' AND action = 'read'
  LIMIT 1;

  IF v_perm_id IS NULL THEN
    RAISE EXCEPTION 'permission clinical_history.read missing';
  END IF;

  -- Rol de la empresa Medicina → role_permissions (si el rol solo se usa allí, ya cubierto arriba;
  -- además, permisos directos por usuario+empresa Medicina).
  INSERT INTO public.user_permissions (user_id, company_id, permission_id)
  SELECT DISTINCT ucr.user_id, v_medicina, v_perm_id
  FROM public.user_company_roles ucr
  WHERE ucr.company_id = v_medicina
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_permissions up
      WHERE up.user_id = ucr.user_id
        AND up.company_id = v_medicina
        AND up.permission_id = v_perm_id
    );

  -- Override ALLOW en Medicina para que no lo anule un deny de estética
  INSERT INTO public.user_permission_overrides (user_id, company_id, permission_id, mode)
  SELECT DISTINCT ucr.user_id, v_medicina, v_perm_id, 'allow'
  FROM public.user_company_roles ucr
  WHERE ucr.company_id = v_medicina
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_permission_overrides o
      WHERE o.user_id = ucr.user_id
        AND o.company_id = v_medicina
        AND o.permission_id = v_perm_id
    );
END $$;
