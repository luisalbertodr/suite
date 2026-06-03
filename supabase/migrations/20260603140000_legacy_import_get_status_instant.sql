-- get_status: solo metadatos rápidos (sin COUNT en tablas grandes ni scan faccab).

CREATE OR REPLACE FUNCTION public.legacy_import_get_status(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, legacy
SET statement_timeout = '3s'
AS $$
DECLARE
  v_legacy_planinc bigint := 0;
  v_legacy_faccab bigint := 0;
  v_legacy_albcab bigint := 0;
  v_last_import timestamptz;
  v_last_batch text;
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
  END IF;

  IF to_regclass('legacy.albcab') IS NOT NULL THEN
    SELECT COALESCE(GREATEST(c.reltuples::bigint, 0), 0)
      INTO v_legacy_albcab
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'legacy' AND c.relname = 'albcab';
  END IF;

  SELECT r.started_at, COALESCE(r.options->>'label', r.options->>'import_batch', r.mode)
    INTO v_last_import, v_last_batch
  FROM public.legacy_import_runs r
  WHERE r.company_id = p_company_id
  ORDER BY r.created_at DESC
  LIMIT 1;

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
      'legacy_appointments', null,
      'legacy_sales', null,
      'legacy_invoices', null,
      'counts_deferred', true
    ),
    'last_run', v_last_run
  );
END;
$$;
