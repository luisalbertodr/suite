-- Dashboard billing: evitar timeout en RPCs por familia/línea.
-- 1) split M/E: agregación por factura (rápida), sin resolver cada línea.
-- 2) by_family: join lateral a artículos + fallback si falla.

CREATE OR REPLACE FUNCTION public.dashboard_billing_monthly_split(
  p_year int DEFAULT NULL
)
RETURNS TABLE (
  month_num int,
  month_key text,
  company_id uuid,
  total     numeric
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
    SELECT dunasoft.style_sync_hub_company_id() AS id
  )
  SELECT
    extract(month FROM i.issue_date)::int AS month_num,
    to_char(i.issue_date, 'YYYY-MM') AS month_key,
    i.company_id,
    round(sum(coalesce(i.total_amount, 0))::numeric, 2) AS total
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
    AND m.company_id = hub.id
    AND m.style_key LIKE yr.y::text || '/%'
  GROUP BY 1, 2, 3
  ORDER BY 1, 3;
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
  WITH hub AS (
    SELECT dunasoft.style_sync_hub_company_id() AS id
  )
  SELECT
    i.issue_date::date AS day_date,
    to_char(i.issue_date, 'YYYY-MM-DD') AS day_key,
    i.company_id,
    round(sum(coalesce(i.total_amount, 0))::numeric, 2) AS total
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
    AND m.company_id = hub.id
    AND m.style_key ~ '^[0-9]{4}/'
  GROUP BY 1, 2, 3
  ORDER BY 1, 3;
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
AS $$
BEGIN
  SET LOCAL statement_timeout = '90s';

  RETURN QUERY
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
    SELECT i.id, i.issue_date, i.company_id
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
      CASE
        WHEN coalesce(resolved.billing_company_id, si.company_id, hub.catalog_id) = c.med_billing_id
        THEN c.report_medicina_id
        ELSE c.report_estetica_id
      END AS report_company_id,
      coalesce(ii.total_price, 0)::numeric AS amount
    FROM style_invoices si
    INNER JOIN public.invoice_items ii ON ii.invoice_id = si.id
    CROSS JOIN hub
    CROSS JOIN constants c
    LEFT JOIN LATERAL (
      SELECT
        coalesce(nullif(btrim(a.familia), ''), 'Sin familia') AS family_name,
        coalesce(a.billing_company_id, af.billing_company_id, hub.catalog_id) AS billing_company_id
      FROM public.articles a
      LEFT JOIN public.article_families af
        ON af.company_id = a.company_id
       AND af.name = a.familia
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

EXCEPTION
  WHEN others THEN
    RETURN QUERY
    SELECT
      s.month_num,
      'Todas'::text AS family_name,
      s.company_id AS report_company_id,
      s.total
    FROM public.dashboard_billing_monthly_split(p_year) s;
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
AS $$
BEGIN
  SET LOCAL statement_timeout = '90s';

  RETURN QUERY
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
    SELECT i.id, i.issue_date, i.company_id
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
      CASE
        WHEN coalesce(resolved.billing_company_id, si.company_id, hub.catalog_id) = c.med_billing_id
        THEN c.report_medicina_id
        ELSE c.report_estetica_id
      END AS report_company_id,
      coalesce(ii.total_price, 0)::numeric AS amount
    FROM style_invoices si
    INNER JOIN public.invoice_items ii ON ii.invoice_id = si.id
    CROSS JOIN hub
    CROSS JOIN constants c
    LEFT JOIN LATERAL (
      SELECT
        coalesce(nullif(btrim(a.familia), ''), 'Sin familia') AS family_name,
        coalesce(a.billing_company_id, af.billing_company_id, hub.catalog_id) AS billing_company_id
      FROM public.articles a
      LEFT JOIN public.article_families af
        ON af.company_id = a.company_id
       AND af.name = a.familia
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

EXCEPTION
  WHEN others THEN
    RETURN QUERY
    SELECT
      s.day_key,
      'Todas'::text AS family_name,
      s.company_id AS report_company_id,
      s.total
    FROM public.dashboard_billing_daily_split(p_from_date, p_to_date) s;
END;
$$;

COMMENT ON FUNCTION public.dashboard_billing_monthly_split(int) IS
  'Split M/E mensual rápido por empresa emisora de factura (sin resolver líneas).';

COMMENT ON FUNCTION public.dashboard_billing_daily_split(date, date) IS
  'Split M/E diario rápido por empresa emisora de factura (sin resolver líneas).';

COMMENT ON FUNCTION public.dashboard_billing_monthly_by_family(int) IS
  'Facturación mensual por familia; fallback a split rápido si timeout.';

COMMENT ON FUNCTION public.dashboard_billing_daily_by_family(date, date) IS
  'Facturación diaria por familia; fallback a split rápido si timeout.';
