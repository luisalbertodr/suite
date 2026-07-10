-- Facturación diaria para comparativa del dashboard (rango de fechas).

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
    AND (
      (use_style.v AND m.company_id = hub.id AND m.style_key ~ '^[0-9]{4}/')
      OR (NOT use_style.v AND i.company_id = p_company_id)
    )
  GROUP BY 1, 2
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_billing_daily(uuid, date, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.dashboard_billing_daily IS
  'Facturación diaria dashboard: centro laboral Style (hub) u otras empresas por company_id.';

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
AS $$
BEGIN
  BEGIN
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
      la.day_date,
      la.day_key,
      la.report_company_id AS company_id,
      round(sum(la.amount)::numeric, 2) AS total
    FROM line_amounts la
    GROUP BY 1, 2, 3
    ORDER BY 1, 3;

  EXCEPTION
    WHEN others THEN
      RETURN QUERY
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
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_billing_daily_split(date, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.dashboard_billing_daily_split IS
  'Facturación diaria M/E dashboard con fallback si falla split por línea.';
