-- Corrige el control de permisos de agenda para los RPC dual-write
-- (agenda_dual_create / agenda_dual_update / agenda_dual_delete y los de Style reservas).
--
-- Problema detectado en produccion:
--   * Esos RPC comprueban user_has_permission(..., 'agenda.create'|'agenda.update'|'agenda.delete').
--   * user_has_permission compara SOLO contra permissions.name, pero los nombres son etiquetas
--     legibles ("Ver Agenda", "Eliminar citas"), no claves "recurso.accion".
--   * Ademas faltaban los permisos agenda/create y agenda/update, y el rol admin no tenia
--     asignado ningun permiso de agenda.
--   => agenda_dual_create devolvia P0001 "Sin permiso agenda.create" para todos (incluido admin/superuser).
--
-- El frontend ya resuelve permisos por (resource, action), que es la convencion canonica.

-- 1) user_has_permission: si el nombre tiene forma "recurso.accion", hacer match tambien por
--    (resource, action). Mantiene compatibilidad con el match por name para el resto de llamadores.
CREATE OR REPLACE FUNCTION public.user_has_permission(user_id uuid, company_id uuid, permission_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dot int := position('.' in $3);
  v_resource text := NULL;
  v_action text := NULL;
BEGIN
  IF v_dot > 0 THEN
    v_resource := left($3, v_dot - 1);
    v_action := substring($3 from v_dot + 1);
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.get_user_permissions(user_id, company_id) p
    WHERE p.permission_name = $3
       OR (v_resource IS NOT NULL AND p.resource = v_resource AND p.action = v_action)
  );
END;
$function$;

-- 2) Sembrar permisos de agenda faltantes. read y delete ya existen.
INSERT INTO public.permissions (resource, action, name) VALUES
  ('agenda', 'create', 'Crear citas'),
  ('agenda', 'update', 'Modificar citas')
ON CONFLICT (resource, action) DO UPDATE
  SET name = EXCLUDED.name
  WHERE public.permissions.name IS DISTINCT FROM EXCLUDED.name;

-- 3a) Rol admin: todos los permisos de agenda (los administradores gestionan la agenda completa).
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.resource = 'agenda'
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- 3b) Roles que ya pueden ver la agenda (recepcion, user, etc.): poder crear y modificar citas
--     via el flujo dual-write. (delete se gestiono en una migracion previa para 'user').
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.resource = 'agenda' AND p.action IN ('create', 'update')
WHERE EXISTS (
  SELECT 1
  FROM public.role_permissions rp_read
  JOIN public.permissions p_read ON p_read.id = rp_read.permission_id
  WHERE rp_read.role_id = r.id
    AND p_read.resource = 'agenda'
    AND p_read.action = 'read'
)
ON CONFLICT DO NOTHING;
