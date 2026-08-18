-- Pistas cabina/recepción: GRANT + admins pueden leer/guardar; RPC de upsert.

CREATE OR REPLACE FUNCTION public.user_can_manage_incentives(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF to_regprocedure('public.current_user_is_superuser()') IS NOT NULL
     AND public.current_user_is_superuser() THEN
    RETURN true;
  END IF;
  IF to_regprocedure('public.is_admin()') IS NOT NULL
     AND public.is_admin() THEN
    RETURN true;
  END IF;
  IF NOT (
    p_company_id = public.get_user_company_id()
    OR public.user_can_access_company(p_company_id)
    OR public.company_in_user_work_center(p_company_id)
  ) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.get_effective_user_permissions(auth.uid(), p_company_id) ep
    WHERE ep.resource = 'incentives' AND ep.action = 'manage'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_set_employee_track(
  p_company_id uuid,
  p_employee_id uuid,
  p_track text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_can_manage_incentives(p_company_id) THEN
    RAISE EXCEPTION 'Sin permiso para administrar incentivos';
  END IF;
  IF p_track IS NULL OR p_track NOT IN ('cabina', 'recepcion', 'none') THEN
    RAISE EXCEPTION 'Pista no válida';
  END IF;

  INSERT INTO public.incentive_employee_tracks (
    company_id, employee_id, track, active, updated_at
  ) VALUES (
    p_company_id, p_employee_id, p_track, true, now()
  )
  ON CONFLICT (employee_id) DO UPDATE
    SET track = EXCLUDED.track,
        company_id = EXCLUDED.company_id,
        active = true,
        updated_at = now();

  RETURN jsonb_build_object('ok', true, 'employee_id', p_employee_id, 'track', p_track);
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.incentive_employee_tracks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.incentive_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_incentives(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_set_employee_track(uuid, uuid, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
