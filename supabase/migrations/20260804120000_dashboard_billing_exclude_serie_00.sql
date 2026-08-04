-- Facturación dashboard Style: la serie 00 es consumo de bonos (sin ingreso nuevo).
-- Style (totfacres / informes) solo suma serfac≠'00'; la serie A (y otras ≠00) sí es ingreso.
-- Antes, style_key ~ '^[0-9]{4}/' incluía 2026/00/... e inflaba el dashboard.

DELETE FROM public.dashboard_billing_query_cache;

COMMENT ON FUNCTION public.dashboard_billing_monthly IS
  'Facturación mensual Style (ingreso): excluye serie 00 (bonos) y duplicados A-N si hay A-YYYY-N.';

CREATE OR REPLACE FUNCTION public.dashboard_billing_monthly(
  p_company_id uuid,
  p_year       int DEFAULT NULL
)
RETURNS TABLE (
  month_num int,
  month_key text,
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
  ),
  use_style AS (
    SELECT
      p_company_id = (SELECT id FROM hub)
      OR EXISTS (
        SELECT 1
        FROM public.companies c
        JOIN public.companies h ON h.id = (SELECT id FROM hub)
        WHERE c.id = p_company_id
          AND c.work_center_id IS NOT NULL
          AND c.work_center_id = h.work_center_id
      ) AS v
  )
  SELECT
    extract(month FROM i.issue_date)::int AS month_num,
    to_char(i.issue_date, 'YYYY-MM') AS month_key,
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
  CROSS JOIN use_style
  WHERE extract(year FROM i.issue_date) = yr.y
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND e.style_key IS NULL
    AND split_part(m.style_key, '/', 2) IS DISTINCT FROM '00'
    AND (
      (use_style.v AND m.company_id = hub.id AND m.style_key LIKE yr.y::text || '/%')
      OR (NOT use_style.v AND i.company_id = p_company_id AND i.number !~ '^00-')
    )
    AND NOT (
      i.number ~ '^A-[0-9]+$'
      AND EXISTS (
        SELECT 1
        FROM public.invoices i2
        INNER JOIN dunasoft.style_sync_entity_map m2
          ON m2.suite_id = i2.id
         AND m2.entity_type = 'invoice'
        WHERE m2.company_id = hub.id
          AND m2.style_key LIKE yr.y::text || '/A/'
            || split_part(m.style_key, '/', 3) || '/'
            || split_part(m.style_key, '/', 4) || '/%'
          AND i2.number ~ ('^A-' || yr.y::text || '-[0-9]+$')
          AND lower(coalesce(i2.status, '')) NOT IN ('cancelled', 'void', 'anulada')
      )
    )
  GROUP BY 1, 2
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_billing_daily(
  p_company_id uuid,
  p_from_date  date,
  p_to_date    date
)
RETURNS TABLE (
  day_date date,
  day_key  text,
  total    numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
  WITH hub AS (
    SELECT dunasoft.style_sync_hub_company_id() AS id
  ),
  use_style AS (
    SELECT
      p_company_id = (SELECT id FROM hub)
      OR EXISTS (
        SELECT 1
        FROM public.companies c
        JOIN public.companies h ON h.id = (SELECT id FROM hub)
        WHERE c.id = p_company_id
          AND c.work_center_id IS NOT NULL
          AND c.work_center_id = h.work_center_id
      ) AS v
  )
  SELECT
    i.issue_date::date AS day_date,
    to_char(i.issue_date, 'YYYY-MM-DD') AS day_key,
    round(sum(coalesce(i.total_amount, 0))::numeric, 2) AS total
  FROM public.invoices i
  INNER JOIN dunasoft.style_sync_entity_map m
    ON m.suite_id = i.id
   AND m.entity_type = 'invoice'
  LEFT JOIN dunasoft.style_sync_billing_exclusions e
    ON e.company_id = m.company_id
   AND e.style_key = m.style_key
  CROSS JOIN hub
  CROSS JOIN use_style
  WHERE i.issue_date >= p_from_date
    AND i.issue_date <= p_to_date
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND e.style_key IS NULL
    AND split_part(m.style_key, '/', 2) IS DISTINCT FROM '00'
    AND (
      (use_style.v AND m.company_id = hub.id AND m.style_key ~ '^[0-9]{4}/')
      OR (NOT use_style.v AND i.company_id = p_company_id AND i.number !~ '^00-')
    )
  GROUP BY 1, 2
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.dashboard_billing_daily IS
  'Facturación diaria dashboard (ingreso): excluye serie 00 (consumo de bonos).';

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
      AND split_part(m.style_key, '/', 2) IS DISTINCT FROM '00'
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
      AND split_part(m.style_key, '/', 2) IS DISTINCT FROM '00'
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
      AND split_part(m.style_key, '/', 2) IS DISTINCT FROM '00'
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
      AND split_part(m.style_key, '/', 2) IS DISTINCT FROM '00'
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
