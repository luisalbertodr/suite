-- ============================================================================
-- Permiso granular: solo llamadas perdidas (empleados) vs todas (gestión).
-- ============================================================================

INSERT INTO public.permissions (resource, action, name) VALUES
  ('phone', 'read_missed', 'Teléfono (solo llamadas perdidas)')
ON CONFLICT (resource, action) DO UPDATE
  SET name = EXCLUDED.name
  WHERE public.permissions.name IS DISTINCT FROM EXCLUDED.name;

-- Empleados (rol user): solo perdidas por defecto, no el listado completo.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'user'
  AND p.resource = 'phone'
  AND p.action = 'read_missed'
ON CONFLICT DO NOTHING;

DELETE FROM public.role_permissions rp
USING public.roles r, public.permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'user'
  AND p.resource = 'phone'
  AND p.action = 'read';
