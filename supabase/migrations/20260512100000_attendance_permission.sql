-- ============================================================================
-- Separar el permiso de Fichaje del de Configuración.
--
-- Hasta ahora, el icono "Fichaje" y la página /asistencia compartían el
-- permiso `settings:read` con la pestaña Configuración. Eso obligaba a dar
-- acceso a Configuración a cualquier empleada que solo necesitara fichar.
--
-- Esta migración:
--   1) Crea los permisos `attendance:read` y `attendance:write`.
--   2) Garantiza que TODOS los usuarios y roles que hoy tienen
--      `settings:read` reciben también `attendance:read`, para no romper
--      el acceso al fichaje de ninguna empleada existente.
--   3) Idempotente: se puede aplicar varias veces sin efectos secundarios.
-- ============================================================================

-- 1) Crear permisos --------------------------------------------------------
INSERT INTO public.permissions (resource, action, name) VALUES
  ('attendance', 'read',  'Fichaje (registrar/ver mis fichajes)'),
  ('attendance', 'write', 'Gestionar fichajes de la empresa')
ON CONFLICT (resource, action) DO NOTHING;

-- 2) Backfill: heredar de quien hoy tenga settings:read --------------------
WITH src AS (
  SELECT id FROM public.permissions WHERE resource = 'settings' AND action = 'read'
), dst AS (
  SELECT id FROM public.permissions WHERE resource = 'attendance' AND action = 'read'
)
INSERT INTO public.user_permissions (user_id, company_id, permission_id)
SELECT up.user_id, up.company_id, (SELECT id FROM dst)
FROM public.user_permissions up
WHERE up.permission_id = (SELECT id FROM src)
ON CONFLICT DO NOTHING;

WITH src AS (
  SELECT id FROM public.permissions WHERE resource = 'settings' AND action = 'read'
), dst AS (
  SELECT id FROM public.permissions WHERE resource = 'attendance' AND action = 'read'
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rp.role_id, (SELECT id FROM dst)
FROM public.role_permissions rp
WHERE rp.permission_id = (SELECT id FROM src)
ON CONFLICT DO NOTHING;
