-- Alinear validaciones backend con la UI:
-- la UI concede acceso a superusuarios y permisos efectivos por (resource, action),
-- pero varios RPC legacy siguen llamando a user_has_permission(...).
-- Esto provocaba 400 "Sin permiso agenda.delete" en agenda_dual_delete para
-- usuarios que sí podían borrar desde la UI.

CREATE OR REPLACE FUNCTION public.user_has_permission(user_id uuid, company_id uuid, permission_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_dot int := position('.' in permission_name);
  v_resource text := NULL;
  v_action text := NULL;
BEGIN
  IF v_dot > 0 THEN
    v_resource := left(permission_name, v_dot - 1);
    v_action := substring(permission_name from v_dot + 1);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.get_user_permissions(user_id, company_id) p
    WHERE p.permission_name = permission_name
       OR (v_resource IS NOT NULL AND p.resource = v_resource AND p.action = v_action)
  ) THEN
    RETURN TRUE;
  END IF;

  IF v_resource IS NOT NULL AND v_action IS NOT NULL THEN
    IF to_regprocedure('public.user_has_effective_permission(uuid,text,text)') IS NOT NULL
       AND public.user_has_effective_permission(user_id, v_resource, v_action) THEN
      RETURN TRUE;
    END IF;
  END IF;

  IF to_regprocedure('public.current_user_is_superuser()') IS NOT NULL
     AND public.current_user_is_superuser() THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$function$;
