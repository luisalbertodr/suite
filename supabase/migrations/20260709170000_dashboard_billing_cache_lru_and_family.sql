-- LRU cache + facturación por familia para dashboard.

ALTER TABLE public.dashboard_billing_query_cache
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_dashboard_billing_query_cache_lru
  ON public.dashboard_billing_query_cache (company_id, last_accessed_at);

CREATE OR REPLACE FUNCTION public.dashboard_billing_cache_get(p_cache_key text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.get_user_company_id();
  v_payload jsonb;
BEGIN
  IF p_cache_key IS NULL OR btrim(p_cache_key) = '' OR v_company_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.dashboard_billing_query_cache c
  SET last_accessed_at = now()
  WHERE c.cache_key = p_cache_key
    AND c.company_id = v_company_id
  RETURNING c.payload INTO v_payload;

  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_billing_cache_set(
  p_cache_key text,
  p_company_id uuid,
  p_payload jsonb,
  p_max_entries int DEFAULT 300
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_company uuid := public.get_user_company_id();
  v_count int;
  v_limit int := greatest(coalesce(p_max_entries, 300), 50);
BEGIN
  IF p_cache_key IS NULL OR btrim(p_cache_key) = '' OR p_payload IS NULL THEN
    RETURN;
  END IF;
  IF v_user_company IS NULL OR p_company_id IS DISTINCT FROM v_user_company THEN
    RETURN;
  END IF;

  INSERT INTO public.dashboard_billing_query_cache (
    cache_key, company_id, payload, computed_at, expires_at, last_accessed_at
  )
  VALUES (
    p_cache_key,
    p_company_id,
    p_payload,
    now(),
    now() + interval '100 years',
    now()
  )
  ON CONFLICT (cache_key) DO UPDATE
  SET payload = EXCLUDED.payload,
      company_id = EXCLUDED.company_id,
      computed_at = now(),
      last_accessed_at = now();

  SELECT count(*)::int INTO v_count
  FROM public.dashboard_billing_query_cache
  WHERE company_id = p_company_id;

  IF v_count > v_limit THEN
    DELETE FROM public.dashboard_billing_query_cache d
    WHERE d.company_id = p_company_id
      AND d.cache_key IN (
        SELECT c.cache_key
        FROM public.dashboard_billing_query_cache c
        WHERE c.company_id = p_company_id
        ORDER BY c.last_accessed_at ASC, c.computed_at ASC
        LIMIT greatest(v_count - v_limit, 0)
      );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_billing_cache_get(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_billing_cache_set(text, uuid, jsonb, int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dashboard_resolve_line_family_name(
  p_description text,
  p_catalog_company_id uuid
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_legacy text;
  v_family text;
BEGIN
  IF p_catalog_company_id IS NULL THEN
    RETURN 'Sin familia';
  END IF;
  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RETURN 'Sin familia';
  END IF;

  v_code := btrim(substring(p_description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*'));
  IF v_code IS NOT NULL AND v_code <> '' THEN
    SELECT coalesce(nullif(btrim(a.familia), ''), 'Sin familia')
    INTO v_family
    FROM public.articles a
    WHERE a.company_id = p_catalog_company_id
      AND (
        upper(btrim(a.codigo)) = upper(v_code)
        OR btrim(coalesce(a.legacy_codart, '')) = v_code
        OR upper(btrim(coalesce(a.legacy_codart, ''))) = upper(v_code)
      )
    ORDER BY a.updated_at DESC NULLS LAST
    LIMIT 1;
    IF v_family IS NOT NULL THEN
      RETURN v_family;
    END IF;
  END IF;

  SELECT coalesce(nullif(btrim(a.familia), ''), 'Sin familia')
  INTO v_family
  FROM public.articles a
  WHERE a.company_id = p_catalog_company_id
    AND upper(btrim(a.descripcion)) = upper(btrim(p_description))
  ORDER BY a.updated_at DESC NULLS LAST
  LIMIT 1;
  IF v_family IS NOT NULL THEN
    RETURN v_family;
  END IF;

  v_legacy := (regexp_match(btrim(p_description), '\[(\d+)\]\s*$'))[1];
  IF v_legacy IS NOT NULL AND v_legacy <> '' THEN
    SELECT coalesce(nullif(btrim(a.familia), ''), 'Sin familia')
    INTO v_family
    FROM public.articles a
    WHERE a.company_id = p_catalog_company_id
      AND btrim(coalesce(a.legacy_codart, '')) = v_legacy
    ORDER BY a.updated_at DESC NULLS LAST
    LIMIT 1;
    IF v_family IS NOT NULL THEN
      RETURN v_family;
    END IF;
  END IF;

  RETURN 'Sin familia';
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_resolve_line_family_name(text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dashboard_billing_monthly_by_family(
  p_year int DEFAULT NULL
)
RETURNS TABLE (
  month_num int,
  family_name text,
  report_company_id uuid,
  total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
  WITH yr AS (
    SELECT coalesce(p_year, extract(year FROM current_date)::int) AS y
  ),
  hub AS (
    SELECT dunasoft.style_sync_hub_company_id() AS catalog_id
  ),
  constants AS (
    SELECT
      '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid AS med_billing_id,
      '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid AS report_medicina_id,
      '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid AS report_estetica_id
  ),
  style_invoices AS (
    SELECT i.id, i.issue_date
    FROM public.invoices i
    INNER JOIN dunasoft.style_sync_entity_map m
      ON m.suite_id = i.id
     AND m.entity_type = 'invoice'
    LEFT JOIN dunasoft.style_sync_billing_exclusions e
      ON e.company_id = m.company_id
     AND e.style_key = m.style_key
    CROSS JOIN yr
    CROSS JOIN hub
    WHERE extract(year FROM i.issue_date) = yr.y
      AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
      AND e.style_key IS NULL
      AND m.company_id = hub.catalog_id
      AND m.style_key LIKE yr.y::text || '/%'
  ),
  line_amounts AS (
    SELECT
      extract(month FROM si.issue_date)::int AS month_num,
      public.dashboard_resolve_line_family_name(ii.description, hub.catalog_id) AS family_name,
      CASE
        WHEN public.dashboard_resolve_line_billing_company_id(ii.description, hub.catalog_id)
          = c.med_billing_id
        THEN c.report_medicina_id
        ELSE c.report_estetica_id
      END AS report_company_id,
      coalesce(ii.total_price, 0)::numeric AS amount
    FROM style_invoices si
    INNER JOIN public.invoice_items ii ON ii.invoice_id = si.id
    CROSS JOIN hub
    CROSS JOIN constants c
  )
  SELECT
    la.month_num,
    la.family_name,
    la.report_company_id,
    round(sum(la.amount)::numeric, 2) AS total
  FROM line_amounts la
  GROUP BY 1, 2, 3
  ORDER BY 1, 2, 3;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_billing_monthly_by_family(int) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dashboard_billing_daily_by_family(
  p_from_date date,
  p_to_date date
)
RETURNS TABLE (
  day_key text,
  family_name text,
  report_company_id uuid,
  total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
  WITH hub AS (
    SELECT dunasoft.style_sync_hub_company_id() AS catalog_id
  ),
  constants AS (
    SELECT
      '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid AS med_billing_id,
      '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid AS report_medicina_id,
      '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid AS report_estetica_id
  ),
  style_invoices AS (
    SELECT i.id, i.issue_date
    FROM public.invoices i
    INNER JOIN dunasoft.style_sync_entity_map m
      ON m.suite_id = i.id
     AND m.entity_type = 'invoice'
    LEFT JOIN dunasoft.style_sync_billing_exclusions e
      ON e.company_id = m.company_id
     AND e.style_key = m.style_key
    CROSS JOIN hub
    WHERE i.issue_date >= p_from_date
      AND i.issue_date <= p_to_date
      AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
      AND e.style_key IS NULL
      AND m.company_id = hub.catalog_id
      AND m.style_key ~ '^[0-9]{4}/'
  ),
  line_amounts AS (
    SELECT
      to_char(si.issue_date, 'YYYY-MM-DD') AS day_key,
      public.dashboard_resolve_line_family_name(ii.description, hub.catalog_id) AS family_name,
      CASE
        WHEN public.dashboard_resolve_line_billing_company_id(ii.description, hub.catalog_id)
          = c.med_billing_id
        THEN c.report_medicina_id
        ELSE c.report_estetica_id
      END AS report_company_id,
      coalesce(ii.total_price, 0)::numeric AS amount
    FROM style_invoices si
    INNER JOIN public.invoice_items ii ON ii.invoice_id = si.id
    CROSS JOIN hub
    CROSS JOIN constants c
  )
  SELECT
    la.day_key,
    la.family_name,
    la.report_company_id,
    round(sum(la.amount)::numeric, 2) AS total
  FROM line_amounts la
  GROUP BY 1, 2, 3
  ORDER BY 1, 2, 3;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_billing_daily_by_family(date, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.dashboard_billing_cache_get IS
  'Lee caché dashboard y actualiza last_accessed_at (LRU).';

COMMENT ON FUNCTION public.dashboard_billing_cache_set IS
  'Guarda caché dashboard y elimina entradas menos usadas si supera el límite por empresa.';
