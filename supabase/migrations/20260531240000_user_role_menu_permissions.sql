-- ============================================================================
-- Permisos de menú para el rol "user" y visibilidad de WhatsApp/Marketing.
--
-- Problema: el rol "user" solo heredaba permisos mínimos (p. ej. users:read)
-- y no podía ver la Agenda ni otras secciones operativas. WhatsApp y Marketing
-- existían en `permissions` pero no se podían asignar desde la UI de secciones.
--
-- Esta migración:
--   1) Garantiza nombres legibles para permisos de menú recientes.
--   2) Asigna al rol "user" los permisos :read operativos habituales
--      (agenda, TPV, clientes, fichaje, etc.). WhatsApp y Marketing quedan
--      fuera del rol base: se conceden explícitamente desde gestión de usuarios.
-- Idempotente.
-- ============================================================================

-- 1) Nombres descriptivos ----------------------------------------------------
INSERT INTO public.permissions (resource, action, name) VALUES
  ('agenda',     'read', 'Ver Agenda'),
  ('whatsapp',   'read', 'WhatsApp (ver chats y leer mensajes)'),
  ('marketing',  'read', 'Ver Marketing'),
  ('attendance', 'read', 'Fichaje (registrar/ver mis fichajes)')
ON CONFLICT (resource, action) DO UPDATE
  SET name = EXCLUDED.name
  WHERE public.permissions.name IS DISTINCT FROM EXCLUDED.name;

-- 2) Rol "user": permisos operativos de lectura ------------------------------
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'user'
  AND p.action = 'read'
  AND p.resource IN (
    'dashboard',
    'customers',
    'articles',
    'sales',
    'agenda',
    'attendance'
  )
ON CONFLICT DO NOTHING;
