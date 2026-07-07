-- resolve_agenda_employee_for_dunasoft_codemp referenciaba ae.active (no existe).
-- Provocaba 400 en agenda_dual_create al ejecutar la función.

CREATE OR REPLACE FUNCTION public.resolve_agenda_employee_for_dunasoft_codemp(
  p_company_id uuid,
  p_codemp text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_codemp text := btrim(coalesce(p_codemp, ''));
  v_employee_id uuid;
  v_hub uuid := dunasoft.style_sync_hub_company_id();
BEGIN
  IF v_codemp = '' THEN
    RETURN NULL;
  END IF;

  SELECT ae.id INTO v_employee_id
  FROM public.agenda_employees ae
  WHERE ae.company_id = p_company_id
    AND coalesce(ae.is_active, true)
    AND (
      ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0') = ltrim(v_codemp, '0')
      OR btrim(coalesce(ae.dunasoft_codemp, '')) = v_codemp
    )
  ORDER BY ae.agenda_sort_order NULLS LAST, ae.name
  LIMIT 1;

  IF v_employee_id IS NOT NULL THEN
    RETURN v_employee_id;
  END IF;

  SELECT ae.id INTO v_employee_id
  FROM public.agenda_employees ae
  INNER JOIN dunasoft.empleados de ON (
    ltrim(btrim(de.codemp), '0') = ltrim(v_codemp, '0')
    OR btrim(de.codemp) = v_codemp
  )
  WHERE ae.company_id = p_company_id
    AND coalesce(ae.is_active, true)
  ORDER BY ae.agenda_sort_order NULLS LAST, ae.name
  LIMIT 1;

  IF v_employee_id IS NOT NULL THEN
    RETURN v_employee_id;
  END IF;

  SELECT ae.id INTO v_employee_id
  FROM public.agenda_employees ae
  WHERE ae.company_id = p_company_id
    AND coalesce(ae.is_active, true)
  ORDER BY ae.agenda_sort_order NULLS LAST, ae.name
  LIMIT 1;

  IF v_employee_id IS NOT NULL THEN
    RETURN v_employee_id;
  END IF;

  IF v_hub IS NOT NULL AND v_hub IS DISTINCT FROM p_company_id THEN
    SELECT ae.id INTO v_employee_id
    FROM public.agenda_employees ae
    WHERE ae.company_id = v_hub
      AND coalesce(ae.is_active, true)
      AND (
        ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0') = ltrim(v_codemp, '0')
        OR btrim(coalesce(ae.dunasoft_codemp, '')) = v_codemp
      )
    ORDER BY ae.agenda_sort_order NULLS LAST, ae.name
    LIMIT 1;

    IF v_employee_id IS NOT NULL THEN
      RETURN v_employee_id;
    END IF;

    SELECT ae.id INTO v_employee_id
    FROM public.agenda_employees ae
    WHERE ae.company_id = v_hub
      AND coalesce(ae.is_active, true)
    ORDER BY ae.agenda_sort_order NULLS LAST, ae.name
    LIMIT 1;
  END IF;

  RETURN v_employee_id;
END;
$$;
