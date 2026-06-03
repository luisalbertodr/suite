-- ============================================================================
-- Permiso de lectura para la pestaña Teléfono / integración Issabel.
-- ============================================================================

INSERT INTO public.permissions (resource, action, name) VALUES
  ('phone', 'read', 'Teléfono (ver llamadas Issabel)')
ON CONFLICT (resource, action) DO UPDATE
  SET name = EXCLUDED.name
  WHERE public.permissions.name IS DISTINCT FROM EXCLUDED.name;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'user'
  AND p.resource = 'phone'
  AND p.action = 'read'
ON CONFLICT DO NOTHING;
