-- Corrige ambigüedad: dos overloads de get_effective_user_permissions rompían RPC y user_has_effective_permission.

DROP FUNCTION IF EXISTS public.get_effective_user_permissions(uuid);

CREATE OR REPLACE FUNCTION public.user_has_effective_permission(
  p_user_id uuid, p_resource text, p_action text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.get_effective_user_permissions(p_user_id, NULL::uuid) ep
    WHERE ep.resource = p_resource AND ep.action = p_action
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_effective_permission(uuid, text, text)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.user_has_effective_permission(uuid, text, text) IS
  'Permiso efectivo del usuario en su empresa activa (p_company_id NULL en get_effective_user_permissions).';
