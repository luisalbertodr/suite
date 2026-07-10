-- Dashboard: robustecer dashboard_billing_monthly_split para evitar 500
-- Si falla el split "por familia/línea" (invoice_items + resolver), hacemos fallback
-- al split anterior "por empresa emisora" (invoices.total_amount).

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
AS $$
BEGIN
  -- Intento 1: split por familia/línea (dashboard_billing_split_by_line_family).
  BEGIN
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
      la.month_key,
      la.report_company_id AS company_id,
      round(sum(la.amount)::numeric, 2) AS total
    FROM line_amounts la
    GROUP BY 1, 2, 3
    ORDER BY 1, 3;

  EXCEPTION
    WHEN others THEN
      -- Intento 2: fallback anterior (por empresa emisora desde invoices).
      RETURN QUERY
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
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_billing_monthly_split(int) TO authenticated, service_role;
COMMENT ON FUNCTION public.dashboard_billing_monthly_split IS
  'Dashboard billing monthly split: robusto con fallback si falla el split por línea/familia.';

