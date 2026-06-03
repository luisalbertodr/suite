-- Permitir al rol "user" eliminar citas si ya tiene acceso de lectura a agenda.
-- La UI ya protege el botón con agenda:delete; esta migración alinea el rol base.

INSERT INTO public.permissions (resource, action, name)
VALUES ('agenda', 'delete', 'Eliminar citas')
ON CONFLICT (resource, action) DO UPDATE
  SET name = EXCLUDED.name
  WHERE public.permissions.name IS DISTINCT FROM EXCLUDED.name;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p
  ON p.resource = 'agenda'
 AND p.action = 'delete'
WHERE r.name = 'user'
  AND EXISTS (
    SELECT 1
    FROM public.role_permissions rp_read
    JOIN public.permissions p_read ON p_read.id = rp_read.permission_id
    WHERE rp_read.role_id = r.id
      AND p_read.resource = 'agenda'
      AND p_read.action = 'read'
  )
ON CONFLICT DO NOTHING;
