-- ============================================================================
-- Quitar permisos de menú demasiado amplios del rol "user".
--
-- La migración anterior asignó dashboard, clientes, TPV, etc. al rol base.
-- Los permisos efectivos = rol + user_permissions (unión), así que un admin
-- que desmarque "Dashboard" en un usuario concreto no podía quitarlo.
--
-- Dejamos solo agenda:read como permiso operativo por defecto del rol "user".
-- El resto (dashboard, TPV, WhatsApp, etc.) se concede explícitamente desde
-- gestión de usuarios.
-- Idempotente.
-- ============================================================================

DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'user'
  AND p.action = 'read'
  AND p.resource IN (
    'dashboard',
    'customers',
    'articles',
    'sales',
    'attendance'
  );

-- Garantizar agenda:read en el rol user (empleados operativos)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'user'
  AND p.resource = 'agenda'
  AND p.action = 'read'
ON CONFLICT DO NOTHING;
