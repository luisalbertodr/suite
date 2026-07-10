-- Dashboard M/E: Delgado Lamas = Medicina, María del Mar = Estética.
-- Agregar por línea (dashboard_resolve_line_billing_company_id), no por empresa emisora.
-- Aplica a todo el histórico en Suite (2025, 2026 y siguientes).

DELETE FROM public.dashboard_billing_query_cache;

CREATE OR REPLACE FUNCTION public.dashboard_billing_monthly_split(
  p_year int DEFAULT NULL
)
RETURNS TABLE (
  month_num int,
  month_key text,
  company_id uuid,
  total     numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
SET statement_timeout = '120s'
AS $$
BEGIN
  RETURN QUERY
  WITH yr AS (
    SELECT coalesce(p_year, extract(year FROM current_date)::int) AS y
  ),
  hub AS (
    SELECT dunasoft.style_sync_hub_company_id() AS catalog_id
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
      to_char(si.issue_date, 'YYYY-MM') AS month_key,
      public.dashboard_resolve_line_billing_company_id(ii.description, hub.catalog_id) AS report_company_id,
      coalesce(ii.total_price, 0)::numeric AS amount
    FROM style_invoices si
    INNER JOIN public.invoice_items ii ON ii.invoice_id = si.id
    CROSS JOIN hub
  )
  SELECT
    la.month_num,
    la.month_key,
    la.report_company_id AS company_id,
    round(sum(la.amount)::numeric, 2) AS total
  FROM line_amounts la
  GROUP BY 1, 2, 3
  ORDER BY 1, 3;
END;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_billing_daily_split(
  p_from_date date,
  p_to_date   date
)
RETURNS TABLE (
  day_date   date,
  day_key    text,
  company_id uuid,
  total      numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
SET statement_timeout = '120s'
AS $$
BEGIN
  RETURN QUERY
  WITH hub AS (
    SELECT dunasoft.style_sync_hub_company_id() AS catalog_id
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
      si.issue_date::date AS day_date,
      to_char(si.issue_date, 'YYYY-MM-DD') AS day_key,
      public.dashboard_resolve_line_billing_company_id(ii.description, hub.catalog_id) AS report_company_id,
      coalesce(ii.total_price, 0)::numeric AS amount
    FROM style_invoices si
    INNER JOIN public.invoice_items ii ON ii.invoice_id = si.id
    CROSS JOIN hub
  )
  SELECT
    la.day_date,
    la.day_key,
    la.report_company_id AS company_id,
    round(sum(la.amount)::numeric, 2) AS total
  FROM line_amounts la
  GROUP BY 1, 2, 3
  ORDER BY 1, 3;
END;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_billing_monthly_by_family(
  p_year int DEFAULT NULL
)
RETURNS TABLE (
  month_num int,
  family_name text,
  report_company_id uuid,
  total numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
SET statement_timeout = '120s'
AS $$
BEGIN
  RETURN QUERY
  WITH yr AS (
    SELECT coalesce(p_year, extract(year FROM current_date)::int) AS y
  ),
  hub AS (
    SELECT dunasoft.style_sync_hub_company_id() AS catalog_id
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
      coalesce(resolved.family_name, 'Sin familia') AS family_name,
      public.dashboard_resolve_line_billing_company_id(ii.description, hub.catalog_id) AS report_company_id,
      coalesce(ii.total_price, 0)::numeric AS amount
    FROM style_invoices si
    INNER JOIN public.invoice_items ii ON ii.invoice_id = si.id
    CROSS JOIN hub
    LEFT JOIN LATERAL (
      SELECT coalesce(nullif(btrim(a.familia), ''), 'Sin familia') AS family_name
      FROM public.articles a
      WHERE a.company_id = hub.catalog_id
        AND (
          (
            btrim(substring(ii.description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*')) IS NOT NULL
            AND btrim(substring(ii.description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*')) <> ''
            AND (
              upper(btrim(a.codigo)) = upper(btrim(substring(ii.description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*')))
              OR btrim(coalesce(a.legacy_codart, '')) = btrim(substring(ii.description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*'))
              OR upper(btrim(coalesce(a.legacy_codart, ''))) = upper(btrim(substring(ii.description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*')))
            )
          )
          OR upper(btrim(a.descripcion)) = upper(btrim(ii.description))
          OR (
            (regexp_match(btrim(ii.description), '\[(\d+)\]\s*$'))[1] IS NOT NULL
            AND btrim(coalesce(a.legacy_codart, '')) = (regexp_match(btrim(ii.description), '\[(\d+)\]\s*$'))[1]
          )
        )
      ORDER BY
        CASE
          WHEN upper(btrim(a.codigo)) = upper(btrim(coalesce(substring(ii.description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*'), ''))) THEN 0
          WHEN upper(btrim(a.descripcion)) = upper(btrim(ii.description)) THEN 1
          ELSE 2
        END,
        a.updated_at DESC NULLS LAST
      LIMIT 1
    ) resolved ON true
  )
  SELECT
    la.month_num,
    la.family_name,
    la.report_company_id,
    round(sum(la.amount)::numeric, 2) AS total
  FROM line_amounts la
  GROUP BY 1, 2, 3
  ORDER BY 1, 2, 3;
END;
$$;

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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
SET statement_timeout = '120s'
AS $$
BEGIN
  RETURN QUERY
  WITH hub AS (
    SELECT dunasoft.style_sync_hub_company_id() AS catalog_id
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
      coalesce(resolved.family_name, 'Sin familia') AS family_name,
      public.dashboard_resolve_line_billing_company_id(ii.description, hub.catalog_id) AS report_company_id,
      coalesce(ii.total_price, 0)::numeric AS amount
    FROM style_invoices si
    INNER JOIN public.invoice_items ii ON ii.invoice_id = si.id
    CROSS JOIN hub
    LEFT JOIN LATERAL (
      SELECT coalesce(nullif(btrim(a.familia), ''), 'Sin familia') AS family_name
      FROM public.articles a
      WHERE a.company_id = hub.catalog_id
        AND (
          (
            btrim(substring(ii.description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*')) IS NOT NULL
            AND btrim(substring(ii.description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*')) <> ''
            AND (
              upper(btrim(a.codigo)) = upper(btrim(substring(ii.description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*')))
              OR btrim(coalesce(a.legacy_codart, '')) = btrim(substring(ii.description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*'))
              OR upper(btrim(coalesce(a.legacy_codart, ''))) = upper(btrim(substring(ii.description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*')))
            )
          )
          OR upper(btrim(a.descripcion)) = upper(btrim(ii.description))
          OR (
            (regexp_match(btrim(ii.description), '\[(\d+)\]\s*$'))[1] IS NOT NULL
            AND btrim(coalesce(a.legacy_codart, '')) = (regexp_match(btrim(ii.description), '\[(\d+)\]\s*$'))[1]
          )
        )
      ORDER BY
        CASE
          WHEN upper(btrim(a.codigo)) = upper(btrim(coalesce(substring(ii.description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*'), ''))) THEN 0
          WHEN upper(btrim(a.descripcion)) = upper(btrim(ii.description)) THEN 1
          ELSE 2
        END,
        a.updated_at DESC NULLS LAST
      LIMIT 1
    ) resolved ON true
  )
  SELECT
    la.day_key,
    la.family_name,
    la.report_company_id,
    round(sum(la.amount)::numeric, 2) AS total
  FROM line_amounts la
  GROUP BY 1, 2, 3
  ORDER BY 1, 2, 3;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_billing_monthly_split(int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_billing_daily_split(date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_billing_monthly_by_family(int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_billing_daily_by_family(date, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.dashboard_billing_monthly_split(int) IS
  'Split M/E mensual por línea: Delgado Lamas=medicina, María del Mar=estética.';

COMMENT ON FUNCTION public.dashboard_billing_daily_split(date, date) IS
  'Split M/E diario por línea: Delgado Lamas=medicina, María del Mar=estética.';

COMMENT ON FUNCTION public.dashboard_billing_monthly_by_family(int) IS
  'Facturación mensual por familia y área (línea → empresa fiscal M/E).';

COMMENT ON FUNCTION public.dashboard_billing_daily_by_family(date, date) IS
  'Facturación diaria por familia y área (línea → empresa fiscal M/E).';
