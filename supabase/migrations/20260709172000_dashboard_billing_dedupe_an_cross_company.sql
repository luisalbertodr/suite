-- Dashboard: no contar facturas A-N si existe canónica A-YYYY-N (mismo numfac/codcli).
-- La deduplicación anterior solo miraba misma company_id; el hub sumaba ambas.

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

COMMENT ON FUNCTION public.dashboard_billing_monthly IS
  'Facturación mensual Style: excluye duplicados A-N si hay A-YYYY-N (mismo numfac/codcli).';

-- Cancelar huérfanas A-N cuando existe canónica A-2026-N (cualquier empresa emisora).
WITH yr AS (SELECT 2026 AS y),
legacy AS (
  SELECT i.id, split_part(m.style_key, '/', 3) AS numfac, split_part(m.style_key, '/', 4) AS codcli
  FROM public.invoices i
  INNER JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  CROSS JOIN yr
  WHERE i.number ~ '^A-[0-9]+$'
    AND extract(year FROM i.issue_date) = yr.y
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND m.company_id = dunasoft.style_sync_hub_company_id()
    AND m.style_key LIKE yr.y::text || '/%'
),
canonical AS (
  SELECT split_part(m.style_key, '/', 3) AS numfac, split_part(m.style_key, '/', 4) AS codcli
  FROM public.invoices i
  INNER JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  CROSS JOIN yr
  WHERE i.number ~ ('^A-' || yr.y::text || '-[0-9]+$')
    AND extract(year FROM i.issue_date) = yr.y
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND m.company_id = dunasoft.style_sync_hub_company_id()
    AND m.style_key LIKE yr.y::text || '/%'
)
UPDATE public.invoices i
SET status = 'cancelled',
    notes = coalesce(i.notes, '') || E'\nDuplicado A-N (canónica A-' || (SELECT y FROM yr)::text || '-N, cross-co)',
    updated_at = now()
FROM legacy l
JOIN canonical c ON c.numfac = l.numfac AND c.codcli = l.codcli
WHERE i.id = l.id;
