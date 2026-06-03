-- legacy_import_get_status: evitar COUNT(*) en legacy.planinc/faccab (timeout 57014 en edge).

CREATE OR REPLACE FUNCTION public.legacy_import_get_status(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, legacy
AS $$
DECLARE
  v_legacy_planinc bigint := 0;
  v_legacy_faccab bigint := 0;
  v_legacy_albcab bigint := 0;
  v_last_import timestamptz;
  v_last_batch text;
  v_legacy_appts bigint := 0;
  v_legacy_sales bigint := 0;
  v_legacy_invoices bigint := 0;
  v_last_run jsonb;
BEGIN
  IF to_regclass('legacy.planinc') IS NOT NULL THEN
    SELECT COALESCE(GREATEST(c.reltuples::bigint, 0), 0)
      INTO v_legacy_planinc
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'legacy' AND c.relname = 'planinc';
  END IF;

  IF to_regclass('legacy.faccab') IS NOT NULL THEN
    SELECT COALESCE(GREATEST(c.reltuples::bigint, 0), 0)
      INTO v_legacy_faccab
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'legacy' AND c.relname = 'faccab';

    SELECT f.imported_at, f.import_batch
      INTO v_last_import, v_last_batch
    FROM legacy.faccab f
    WHERE f.imported_at IS NOT NULL
    ORDER BY f.imported_at DESC
    LIMIT 1;
  END IF;

  IF to_regclass('legacy.albcab') IS NOT NULL THEN
    SELECT COALESCE(GREATEST(c.reltuples::bigint, 0), 0)
      INTO v_legacy_albcab
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'legacy' AND c.relname = 'albcab';
  END IF;

  SELECT COUNT(*) INTO v_legacy_appts
  FROM public.agenda_appointments a
  WHERE a.company_id = p_company_id
    AND (
      a.legacy_planinc_id IS NOT NULL
      OR NULLIF(btrim(a.legacy_idplan::text), '') IS NOT NULL
    );

  SELECT COUNT(*) INTO v_legacy_sales
  FROM public.sales s
  WHERE s.company_id = p_company_id
    AND (
      s.ticket_number LIKE 'LEG-%'
      OR EXISTS (
        SELECT 1
        FROM public.agenda_appointments a
        WHERE a.id = s.appointment_id
          AND a.company_id = p_company_id
          AND (
            a.legacy_planinc_id IS NOT NULL
            OR NULLIF(btrim(a.legacy_idplan::text), '') IS NOT NULL
          )
      )
    );

  SELECT COUNT(*) INTO v_legacy_invoices
  FROM public.invoices i
  WHERE i.company_id = p_company_id
    AND i.notes ILIKE '%Factura legacy autom%';

  SELECT to_jsonb(r) INTO v_last_run
  FROM (
    SELECT id, mode, status, current_step, created_at, started_at, finished_at, error_message
    FROM public.legacy_import_runs
    WHERE company_id = p_company_id
    ORDER BY created_at DESC
    LIMIT 1
  ) r;

  RETURN jsonb_build_object(
    'legacy_staging', jsonb_build_object(
      'planinc_rows', v_legacy_planinc,
      'faccab_rows', v_legacy_faccab,
      'albcab_rows', v_legacy_albcab,
      'last_imported_at', v_last_import,
      'last_import_batch', v_last_batch,
      'row_counts_approximate', true
    ),
    'public_promoted', jsonb_build_object(
      'legacy_appointments', v_legacy_appts,
      'legacy_sales', v_legacy_sales,
      'legacy_invoices', v_legacy_invoices
    ),
    'last_run', v_last_run
  );
END;
$$;
