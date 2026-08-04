-- 1) Empresa activa: solo empresas asignadas (no hermanas del centro laboral).
--    Evita que un usuario solo de Medicina active Estética vía RPC.
CREATE OR REPLACE FUNCTION public.set_active_company_id(p_company_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_company_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.get_user_assigned_company_ids() g
       WHERE g = p_company_id
     )
  THEN
    RAISE EXCEPTION 'No tienes asignación a la empresa %', p_company_id;
  END IF;

  INSERT INTO public.user_active_company (user_id, company_id, updated_at)
  VALUES (auth.uid(), p_company_id, now())
  ON CONFLICT (user_id) DO UPDATE
    SET company_id = EXCLUDED.company_id,
        updated_at = now();

  RETURN p_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_active_company_id(UUID) TO authenticated, service_role;

-- 2) Usuario Medicina (mariadelgado@lipoout.com): solo Delgado Lamas Medicina.
DO $$
DECLARE
  v_user uuid;
  v_medicina uuid := '816af484-92a0-4f65-a5a7-1c907aa4bb3d';
  v_estetica uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = 'mariadelgado@lipoout.com';
  IF v_user IS NULL THEN
    RAISE NOTICE 'Usuario mariadelgado@lipoout.com no encontrado; nada que hacer';
    RETURN;
  END IF;

  DELETE FROM public.user_company_roles
  WHERE user_id = v_user AND company_id = v_estetica;

  DELETE FROM public.user_profiles
  WHERE user_id = v_user AND company_id = v_estetica;

  INSERT INTO public.user_profiles (user_id, company_id)
  VALUES (v_user, v_medicina)
  ON CONFLICT DO NOTHING;

  UPDATE public.user_profiles
  SET company_id = v_medicina,
      updated_at = now()
  WHERE user_id = v_user
    AND company_id IS DISTINCT FROM v_medicina;

  INSERT INTO public.user_active_company (user_id, company_id, updated_at)
  VALUES (v_user, v_medicina, now())
  ON CONFLICT (user_id) DO UPDATE
  SET company_id = excluded.company_id,
      updated_at = now();

  RAISE NOTICE 'mariadelgado restringida a Medicina (%)', v_medicina;
END $$;
