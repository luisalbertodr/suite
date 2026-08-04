-- Permisos separados en Inicio / secciones:
--   reports.read          → Ver reportes
--   recent_activity.read  → Ver actividad reciente
--   statistics.read       → Ver estadísticas (cuadro de mandos + gráficos)

INSERT INTO public.permissions (resource, action, name, description) VALUES
  ('reports', 'read', 'Ver reportes', 'Acceso a la pestaña y sección de reportes'),
  ('recent_activity', 'read', 'Ver actividad reciente', 'Ver el historial de actividad en Inicio'),
  ('statistics', 'read', 'Ver estadísticas', 'Ver cuadro de mandos, tarjetas y gráficos de Inicio')
ON CONFLICT (resource, action) DO UPDATE
  SET name = EXCLUDED.name,
      description = COALESCE(EXCLUDED.description, public.permissions.description);

-- Roles admin/manager/superadmin: los tres
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.name) IN ('admin', 'manager', 'superadmin')
  AND (
    (p.resource = 'reports' AND p.action = 'read')
    OR (p.resource = 'recent_activity' AND p.action = 'read')
    OR (p.resource = 'statistics' AND p.action = 'read')
  )
ON CONFLICT DO NOTHING;

-- Quien ya tenía dashboard.read en el rol hereda estadísticas + actividad
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p_new.id
FROM public.role_permissions rp
JOIN public.permissions p_old
  ON p_old.id = rp.permission_id
 AND p_old.resource = 'dashboard'
 AND p_old.action = 'read'
JOIN public.permissions p_new
  ON p_new.resource IN ('recent_activity', 'statistics')
 AND p_new.action = 'read'
ON CONFLICT DO NOTHING;

-- Quien ya tenía reports.read en el rol también recibe estadísticas + actividad
-- (antes "Reportes" incluía ambas áreas en la práctica del panel Inicio).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p_new.id
FROM public.role_permissions rp
JOIN public.permissions p_old
  ON p_old.id = rp.permission_id
 AND p_old.resource = 'reports'
 AND p_old.action = 'read'
JOIN public.permissions p_new
  ON p_new.resource IN ('recent_activity', 'statistics')
 AND p_new.action = 'read'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_permissions (user_id, company_id, permission_id)
SELECT DISTINCT up.user_id, up.company_id, p_new.id
FROM public.user_permissions up
JOIN public.permissions p_old
  ON p_old.id = up.permission_id
 AND p_old.resource IN ('reports', 'dashboard')
 AND p_old.action = 'read'
JOIN public.permissions p_new
  ON p_new.resource IN ('recent_activity', 'statistics')
 AND p_new.action = 'read'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.user_permissions up2
  WHERE up2.user_id = up.user_id
    AND up2.company_id = up.company_id
    AND up2.permission_id = p_new.id
);

-- Overrides ALLOW de dashboard.read → ALLOW de estadísticas/actividad
INSERT INTO public.user_permission_overrides (user_id, company_id, permission_id, mode)
SELECT DISTINCT o.user_id, o.company_id, p_new.id, 'allow'
FROM public.user_permission_overrides o
JOIN public.permissions p_old
  ON p_old.id = o.permission_id
 AND p_old.resource = 'dashboard'
 AND p_old.action = 'read'
JOIN public.permissions p_new
  ON p_new.resource IN ('recent_activity', 'statistics')
 AND p_new.action = 'read'
WHERE o.mode = 'allow'
  AND o.permission_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_permission_overrides o2
    WHERE o2.user_id = o.user_id
      AND o2.company_id = o.company_id
      AND o2.permission_id = p_new.id
  );
