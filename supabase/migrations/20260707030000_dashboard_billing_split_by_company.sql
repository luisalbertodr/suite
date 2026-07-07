-- Facturación mensual Style sync desglosada por empresa emisora (Medicina / Estética).

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

GRANT EXECUTE ON FUNCTION public.dashboard_billing_monthly_split(int) TO authenticated, service_role;

COMMENT ON FUNCTION public.dashboard_billing_monthly_split IS
  'Facturación Style sync por mes y empresa emisora (centro laboral Lipoout).';
