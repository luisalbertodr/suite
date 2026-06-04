-- ============================================================================
-- Rol "recepcion": operativa M+E (agenda, clientes, artículos, TPV, facturación).
-- Marketing, WhatsApp y llamadas perdidas se asignan por usuario (overrides).
-- ============================================================================

INSERT INTO public.roles (name, description, is_system_role) VALUES
  (
    'recepcion',
    'Recepción: agenda, clientes, artículos, TPV y facturación (centro M+E)',
    true
  )
ON CONFLICT (name) DO UPDATE
  SET description = EXCLUDED.description
  WHERE public.roles.description IS DISTINCT FROM EXCLUDED.description;

INSERT INTO public.permissions (resource, action, name) VALUES
  ('invoices', 'read', 'Facturación (ver facturas y documentos)')
ON CONFLICT (resource, action) DO UPDATE
  SET name = EXCLUDED.name
  WHERE public.permissions.name IS DISTINCT FROM EXCLUDED.name;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'recepcion'
  AND p.action = 'read'
  AND p.resource IN (
    'agenda',
    'customers',
    'articles',
    'sales',
    'invoices'
  )
ON CONFLICT DO NOTHING;
