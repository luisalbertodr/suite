-- Sincroniza el catálogo de empleados de agenda con Style/Dunasoft.
-- La agenda mostrará los empleados activos en Style, mientras las
-- preferencias por usuario seguirán decidiendo qué columnas ve cada uno.

ALTER TABLE public.agenda_employees
  ADD COLUMN IF NOT EXISTS dunasoft_codemp text;

CREATE INDEX IF NOT EXISTS idx_agenda_employees_company_dunasoft_codemp
  ON public.agenda_employees (company_id, dunasoft_codemp)
  WHERE dunasoft_codemp IS NOT NULL AND btrim(dunasoft_codemp) <> '';

COMMENT ON COLUMN public.agenda_employees.dunasoft_codemp IS
  'Código de empleado en Style/Dunasoft (codemp) para sincronizar actividad y citas.';

CREATE OR REPLACE FUNCTION public.sync_agenda_employees_from_style(p_company_id uuid DEFAULT NULL)
RETURNS TABLE(inserted_count integer, updated_count integer, deactivated_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_company_id uuid := coalesce(p_company_id, public.get_user_company_id());
  v_inserted integer := 0;
  v_updated integer := 0;
  v_deactivated integer := 0;
  v_next_sort integer := 0;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo resolver la empresa para sincronizar empleados de Style';
  END IF;

  IF to_regclass('dunasoft.empleados') IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  CREATE TEMP TABLE tmp_style_employees ON COMMIT DROP AS
  SELECT DISTINCT ON (codemp_norm)
    codemp,
    codemp_norm,
    employee_name,
    style_active
  FROM (
    SELECT
      btrim(coalesce(e.codemp, '')) AS codemp,
      coalesce(nullif(ltrim(btrim(coalesce(e.codemp, '')), '0'), ''), '0') AS codemp_norm,
      nullif(
        btrim(
          concat_ws(
            ' ',
            nullif(btrim(coalesce(e.nomemp, '')), ''),
            nullif(btrim(coalesce(e.ape1emp, '')), ''),
            nullif(btrim(coalesce(e.ape2emp, '')), '')
          )
        ),
        ''
      ) AS employee_name,
      (
        nullif(btrim(coalesce(e.fecbaja, '')), '') IS NULL
        AND upper(coalesce(nullif(btrim(coalesce(e.obsoleto, '')), ''), 'NO')) NOT IN ('S', 'SI', '1', 'TRUE', 'T', 'Y', 'YES')
      ) AS style_active
    FROM dunasoft.empleados e
  ) src
  WHERE codemp <> ''
    AND employee_name IS NOT NULL
  ORDER BY codemp_norm, style_active DESC, codemp DESC, employee_name;

  UPDATE public.agenda_employees ae
  SET
    name = src.employee_name,
    is_active = src.style_active,
    dunasoft_codemp = src.codemp,
    updated_at = now()
  FROM tmp_style_employees src
  WHERE ae.company_id = v_company_id
    AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0'), ''), '0') = src.codemp_norm
    AND (
      ae.name IS DISTINCT FROM src.employee_name
      OR coalesce(ae.is_active, true) IS DISTINCT FROM src.style_active
      OR btrim(coalesce(ae.dunasoft_codemp, '')) IS DISTINCT FROM src.codemp
    );
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  SELECT coalesce(max(ae.agenda_sort_order), -1) + 1
  INTO v_next_sort
  FROM public.agenda_employees ae
  WHERE ae.company_id = v_company_id;

  INSERT INTO public.agenda_employees (
    name,
    color,
    company_id,
    is_active,
    agenda_sort_order,
    dunasoft_codemp,
    unavailability
  )
  SELECT
    src.employee_name,
    '#3B82F6',
    v_company_id,
    src.style_active,
    v_next_sort + row_number() OVER (ORDER BY src.employee_name, src.codemp) - 1,
    src.codemp,
    '[]'::jsonb
  FROM tmp_style_employees src
  LEFT JOIN public.agenda_employees ae
    ON ae.company_id = v_company_id
   AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0'), ''), '0') = src.codemp_norm
  WHERE ae.id IS NULL;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  UPDATE public.agenda_employees ae
  SET
    is_active = false,
    updated_at = now()
  WHERE ae.company_id = v_company_id
    AND nullif(btrim(coalesce(ae.dunasoft_codemp, '')), '') IS NOT NULL
    AND coalesce(ae.is_active, true)
    AND NOT EXISTS (
      SELECT 1
      FROM tmp_style_employees src
      WHERE src.codemp_norm = coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0'), ''), '0')
    );
  GET DIAGNOSTICS v_deactivated = ROW_COUNT;

  RETURN QUERY SELECT v_inserted, v_updated, v_deactivated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_agenda_employees_from_style(uuid) TO authenticated, service_role;
