-- Comprueba marketing read/write con user_id explícito (fallback si auth.uid() es NULL en PostgREST).

DROP FUNCTION IF EXISTS public.current_user_has_marketing_permission(text);

CREATE OR REPLACE FUNCTION public.current_user_has_marketing_permission(
  p_action text DEFAULT 'read',
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := COALESCE(auth.uid(), p_user_id);
  v_estetica uuid := '816af484-92a0-4f65-a5a7-1c907aa4bb3d';
  v_medicina uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF public.current_user_is_superuser() THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.get_effective_user_permissions(v_uid, v_estetica) ep
    WHERE ep.resource = 'marketing' AND ep.action = p_action
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.get_effective_user_permissions(v_uid, v_medicina) ep
    WHERE ep.resource = 'marketing' AND ep.action = p_action
  ) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.get_effective_user_permissions(v_uid, NULL::uuid) ep
    WHERE ep.resource = 'marketing' AND ep.action = p_action
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_has_marketing_permission(text, uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.current_user_has_marketing_permission(text, uuid) IS
  'Marketing M+E: usa auth.uid() o p_user_id; comprueba Estética, Medicina y empresa activa.';
