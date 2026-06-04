-- Configuración recepción Gemma (gemmasuarezgonzalez@gmail.com)
-- Medicina + Estética

DO $$
DECLARE
  v_user_id uuid := 'c3017f22-b618-4244-bbae-a578f8f22730';
  v_employee_id uuid := '0e5081fc-572b-45c3-be5c-22e54280bf85';
  v_estetica uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
  v_medicina uuid := '816af484-92a0-4f65-a5a7-1c907aa4bb3d';
  v_role_id uuid;
  v_pid uuid;
BEGIN
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'recepcion';
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Rol recepcion no existe';
  END IF;

  -- Perfil principal (Estética) + vínculo empleado
  INSERT INTO public.user_profiles (user_id, company_id, employee_id, updated_at)
  VALUES (v_user_id, v_estetica, v_employee_id, now())
  ON CONFLICT (company_id, user_id) DO UPDATE
  SET employee_id = EXCLUDED.employee_id, updated_at = now();

  -- Rol recepcion en ambas empresas
  UPDATE public.user_company_roles SET role_id = v_role_id
  WHERE user_id = v_user_id AND company_id = v_estetica;
  IF NOT FOUND THEN
    INSERT INTO public.user_company_roles (user_id, company_id, role_id)
    VALUES (v_user_id, v_estetica, v_role_id);
  END IF;

  UPDATE public.user_company_roles SET role_id = v_role_id
  WHERE user_id = v_user_id AND company_id = v_medicina;
  IF NOT FOUND THEN
    INSERT INTO public.user_company_roles (user_id, company_id, role_id)
    VALUES (v_user_id, v_medicina, v_role_id);
  END IF;

  -- Empresa activa por defecto: Estética
  INSERT INTO public.user_active_company (user_id, company_id, updated_at)
  VALUES (v_user_id, v_estetica, now())
  ON CONFLICT (user_id) DO UPDATE
  SET company_id = EXCLUDED.company_id, updated_at = now();

  -- Helper: allow override
  CREATE TEMP TABLE IF NOT EXISTS _gemma_allow (resource text, action text);
  TRUNCATE _gemma_allow;
  INSERT INTO _gemma_allow (resource, action) VALUES
    ('agenda', 'read'),
    ('customers', 'read'),
    ('articles', 'read'),
    ('sales', 'read'),
    ('invoices', 'read'),
    ('phone', 'read_missed'),
    ('whatsapp', 'read');

  -- Estética: common + marketing
  FOR v_pid IN
    SELECT p.id FROM public.permissions p
    JOIN _gemma_allow a ON a.resource = p.resource AND a.action = p.action
    UNION
    SELECT id FROM public.permissions WHERE resource = 'marketing' AND action = 'read'
  LOOP
    DELETE FROM public.user_permission_overrides
    WHERE user_id = v_user_id AND company_id = v_estetica AND permission_id = v_pid;
    INSERT INTO public.user_permission_overrides (
      user_id, company_id, permission_id, mode, reason
    ) VALUES (v_user_id, v_estetica, v_pid, 'allow', 'configure_gemma_reception.sql');
  END LOOP;

  -- Medicina: common allow
  FOR v_pid IN
    SELECT p.id FROM public.permissions p
    JOIN _gemma_allow a ON a.resource = p.resource AND a.action = p.action
  LOOP
    DELETE FROM public.user_permission_overrides
    WHERE user_id = v_user_id AND company_id = v_medicina AND permission_id = v_pid;
    INSERT INTO public.user_permission_overrides (
      user_id, company_id, permission_id, mode, reason
    ) VALUES (v_user_id, v_medicina, v_pid, 'allow', 'configure_gemma_reception.sql');
  END LOOP;

  -- Medicina: deny marketing
  SELECT id INTO v_pid FROM public.permissions WHERE resource = 'marketing' AND action = 'read';
  IF v_pid IS NOT NULL THEN
    DELETE FROM public.user_permission_overrides
    WHERE user_id = v_user_id AND company_id = v_medicina AND permission_id = v_pid;
    INSERT INTO public.user_permission_overrides (
      user_id, company_id, permission_id, mode, reason
    ) VALUES (v_user_id, v_medicina, v_pid, 'deny', 'configure_gemma_reception.sql');
  END IF;
END $$;

-- Verificación
SELECT ucr.company_id, r.name AS role, c.name AS company
FROM public.user_company_roles ucr
JOIN public.roles r ON r.id = ucr.role_id
LEFT JOIN public.companies c ON c.id = ucr.company_id
WHERE ucr.user_id = 'c3017f22-b618-4244-bbae-a578f8f22730';

SELECT up.company_id, up.employee_id, ae.name AS employee
FROM public.user_profiles up
LEFT JOIN public.agenda_employees ae ON ae.id = up.employee_id
WHERE up.user_id = 'c3017f22-b618-4244-bbae-a578f8f22730';

SELECT c.name AS company, p.resource, p.action, o.mode
FROM public.user_permission_overrides o
JOIN public.permissions p ON p.id = o.permission_id
LEFT JOIN public.companies c ON c.id = o.company_id
WHERE o.user_id = 'c3017f22-b618-4244-bbae-a578f8f22730'
ORDER BY c.name, p.resource, p.action;
