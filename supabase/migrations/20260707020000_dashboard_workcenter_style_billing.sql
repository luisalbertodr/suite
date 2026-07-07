-- Facturación dashboard: centro laboral Lipoout = suma Style sync (Medicina + Estética vía mapeos hub).
-- Cancela facturas Style 2026 sin mapeo canónico (duplicados huérfanos).

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
    AND (
      (use_style.v AND m.company_id = hub.id AND m.style_key LIKE yr.y::text || '/%')
      OR (NOT use_style.v AND i.company_id = p_company_id)
    )
  GROUP BY 1, 2
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.dashboard_billing_monthly IS
  'Centro laboral Style: suma facturas con mapeo hub ejefac/… (Medicina+Estética). Otras empresas: facturas propias.';

-- Huérfanas Style sync 2026 sin mapeo canónico (no deben contar en facturación).
UPDATE public.invoices i
SET status = 'cancelled',
    notes = coalesce(i.notes, '') || E'\nStyle sync huérfana 2026 — sin mapeo canónico',
    updated_at = now()
WHERE extract(year FROM i.issue_date) = 2026
  AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
  AND coalesce(i.notes, '') ILIKE '%Factura Style sync%'
  AND NOT EXISTS (
    SELECT 1
    FROM dunasoft.style_sync_entity_map m
    WHERE m.suite_id = i.id
      AND m.entity_type = 'invoice'
      AND m.company_id = dunasoft.style_sync_hub_company_id()
      AND m.style_key LIKE '2026/%'
  );
