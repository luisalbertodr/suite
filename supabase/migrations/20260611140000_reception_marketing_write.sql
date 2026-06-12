-- Recepción en Estética: marketing read+write; Medicina: sin marketing.
-- Corrige overrides invertidos (p. ej. Gemma con read deny en Estética y allow en Medicina).

DO $$
DECLARE
  v_user uuid;
  v_read uuid;
  v_write uuid;
  v_estetica uuid := '816af484-92a0-4f65-a5a7-1c907aa4bb3d';
  v_medicina uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
BEGIN
  SELECT id INTO v_read FROM public.permissions WHERE resource = 'marketing' AND action = 'read';
  SELECT id INTO v_write FROM public.permissions WHERE resource = 'marketing' AND action = 'write';
  IF v_read IS NULL OR v_write IS NULL THEN
    RAISE NOTICE 'Permisos marketing no encontrados; omitiendo fix recepción';
    RETURN;
  END IF;

  FOR v_user IN
    SELECT DISTINCT ucr.user_id
    FROM public.user_company_roles ucr
    JOIN public.roles r ON r.id = ucr.role_id AND r.name = 'recepcion'
    WHERE ucr.company_id IN (v_estetica, v_medicina)
  LOOP
    DELETE FROM public.user_permission_overrides upo
    WHERE upo.user_id = v_user
      AND upo.company_id IN (v_estetica, v_medicina)
      AND upo.permission_id IN (v_read, v_write);

    INSERT INTO public.user_permission_overrides (
      user_id, company_id, permission_id, resource, action, mode, reason
    ) VALUES
      (v_user, v_estetica, v_read, NULL, NULL, 'allow', 'reception_marketing_write migration'),
      (v_user, v_estetica, v_write, NULL, NULL, 'allow', 'reception_marketing_write migration'),
      (v_user, v_medicina, v_read, NULL, NULL, 'deny', 'reception_marketing_write migration');
  END LOOP;
END $$;
