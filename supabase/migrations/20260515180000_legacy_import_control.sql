-- Control de importaciones legacy Dunasoft (UI Configuración → General → Importar)

CREATE TABLE IF NOT EXISTS public.legacy_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('staging', 'refresh', 'full', 'promote-only')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  options jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_step text,
  steps_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_message text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_legacy_import_runs_company_created
  ON public.legacy_import_runs (company_id, created_at DESC);

ALTER TABLE public.legacy_import_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY legacy_import_runs_select ON public.legacy_import_runs
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT up.company_id FROM public.user_profiles up WHERE up.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.superusers su
      WHERE su.email = (auth.jwt() ->> 'email') AND su.is_active = true
    )
  );

CREATE POLICY legacy_import_runs_insert ON public.legacy_import_runs
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT up.company_id FROM public.user_profiles up WHERE up.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.superusers su
      WHERE su.email = (auth.jwt() ->> 'email') AND su.is_active = true
    )
  );

-- Actualizaciones de estado las hace el worker con service_role (bypass RLS).

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
    SELECT COUNT(*) INTO v_legacy_planinc FROM legacy.planinc;
  END IF;
  IF to_regclass('legacy.faccab') IS NOT NULL THEN
    SELECT COUNT(*), MAX(imported_at), MAX(import_batch)
      INTO v_legacy_faccab, v_last_import, v_last_batch
    FROM legacy.faccab;
  END IF;
  IF to_regclass('legacy.albcab') IS NOT NULL THEN
    SELECT COUNT(*) INTO v_legacy_albcab FROM legacy.albcab;
  END IF;

  SELECT COUNT(*) INTO v_legacy_appts
  FROM public.agenda_appointments a
  WHERE a.company_id = p_company_id
    AND (a.legacy_planinc_id IS NOT NULL OR NULLIF(btrim(a.legacy_idplan::text), '') IS NOT NULL);

  SELECT COUNT(*) INTO v_legacy_sales
  FROM public.sales s
  LEFT JOIN public.agenda_appointments a ON a.id = s.appointment_id
  WHERE s.company_id = p_company_id
    AND (s.ticket_number LIKE 'LEG-%' OR a.legacy_planinc_id IS NOT NULL
         OR NULLIF(btrim(a.legacy_idplan::text), '') IS NOT NULL);

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
      'last_import_batch', v_last_batch
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

CREATE OR REPLACE FUNCTION public.legacy_import_reset_public(
  p_company_id uuid,
  p_scope text DEFAULT 'sales'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sales int := 0;
  v_sale_items int := 0;
  v_invoices int := 0;
  v_invoice_items int := 0;
  v_appts int := 0;
  v_appt_items int := 0;
BEGIN
  IF p_scope NOT IN ('sales', 'appointments', 'all') THEN
    RAISE EXCEPTION 'scope invalido: %', p_scope;
  END IF;

  -- Ventas / facturas legacy
  WITH legacy_sale_ids AS (
    SELECT s.id, s.invoice_id
    FROM public.sales s
    LEFT JOIN public.agenda_appointments a ON a.id = s.appointment_id
    WHERE s.company_id = p_company_id
      AND (
        s.ticket_number LIKE 'LEG-%'
        OR a.legacy_planinc_id IS NOT NULL
        OR NULLIF(btrim(a.legacy_idplan::text), '') IS NOT NULL
      )
  ),
  del_inv_items AS (
    DELETE FROM public.invoice_items ii
    WHERE ii.invoice_id IN (SELECT DISTINCT invoice_id FROM legacy_sale_ids WHERE invoice_id IS NOT NULL)
    RETURNING 1
  ),
  del_invoices AS (
    DELETE FROM public.invoices i
    WHERE i.id IN (SELECT DISTINCT invoice_id FROM legacy_sale_ids WHERE invoice_id IS NOT NULL)
    RETURNING 1
  ),
  del_sale_items AS (
    DELETE FROM public.sale_items si
    WHERE si.sale_id IN (SELECT id FROM legacy_sale_ids)
    RETURNING 1
  ),
  del_sales AS (
    DELETE FROM public.sales s
    WHERE s.id IN (SELECT id FROM legacy_sale_ids)
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*) FROM del_sales),
    (SELECT COUNT(*) FROM del_sale_items),
    (SELECT COUNT(*) FROM del_invoices),
    (SELECT COUNT(*) FROM del_inv_items)
  INTO v_sales, v_sale_items, v_invoices, v_invoice_items;

  IF p_scope IN ('appointments', 'all') THEN
    WITH legacy_appt_ids AS (
      SELECT a.id FROM public.agenda_appointments a
      WHERE a.company_id = p_company_id
        AND (
          a.legacy_planinc_id IS NOT NULL
          OR NULLIF(btrim(a.legacy_idplan::text), '') IS NOT NULL
        )
    ),
    del_ai AS (
      DELETE FROM public.appointment_items ai
      WHERE ai.appointment_id IN (SELECT id FROM legacy_appt_ids)
      RETURNING 1
    ),
    del_ap AS (
      DELETE FROM public.agenda_appointments a
      WHERE a.id IN (SELECT id FROM legacy_appt_ids)
      RETURNING 1
    )
    SELECT (SELECT COUNT(*) FROM del_ap), (SELECT COUNT(*) FROM del_ai)
    INTO v_appts, v_appt_items;
  END IF;

  RETURN jsonb_build_object(
    'scope', p_scope,
    'sales_deleted', v_sales,
    'sale_items_deleted', v_sale_items,
    'invoices_deleted', v_invoices,
    'invoice_items_deleted', v_invoice_items,
    'appointments_deleted', v_appts,
    'appointment_items_deleted', v_appt_items
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.legacy_import_get_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.legacy_import_reset_public(uuid, text) TO authenticated, service_role;
