-- Corrige "column reference permission_name is ambiguous" en user_has_permission:
-- el parámetro y la columna devuelta por get_user_permissions se llaman igual.

CREATE OR REPLACE FUNCTION public.user_has_permission(
  user_id uuid,
  company_id uuid,
  permission_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_permission_name text := permission_name;
  v_dot int := position('.' in v_permission_name);
  v_resource text := NULL;
  v_action text := NULL;
BEGIN
  IF v_dot > 0 THEN
    v_resource := left(v_permission_name, v_dot - 1);
    v_action := substring(v_permission_name from v_dot + 1);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.get_user_permissions(user_id, company_id) p
    WHERE p.permission_name = v_permission_name
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
