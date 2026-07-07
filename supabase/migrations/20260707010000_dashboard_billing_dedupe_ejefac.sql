-- Dashboard hub: solo mapeos con prefijo ejefac del año consultado (evita doble conteo legacy).

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
  WHERE extract(year FROM i.issue_date) = yr.y
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND e.style_key IS NULL
    AND (
      CASE
        WHEN p_company_id = dunasoft.style_sync_hub_company_id() THEN
          m.company_id = p_company_id
          AND m.style_key LIKE yr.y::text || '/%'
        ELSE
          i.company_id = p_company_id
      END
    )
  GROUP BY 1, 2
  ORDER BY 1;
$$;

COMMENT ON FUNCTION public.dashboard_billing_monthly IS
  'Facturación mensual hub: solo mapeos ejefac/año/serie/numfac (sin legacy A/num/cli).';

-- Cancelar duplicados legacy A-N cuando existe A-YYYY-N mismo ejercicio y empresa.
WITH yr AS (SELECT 2026 AS y),
legacy AS (
  SELECT i.id, i.company_id, i.number,
         substring(i.number FROM '^A-(\d+)$') AS numfac
  FROM public.invoices i
  CROSS JOIN yr
  WHERE i.number ~ '^A-[0-9]+$'
    AND extract(year FROM i.issue_date) = yr.y
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND coalesce(i.notes, '') ILIKE '%Factura Style sync%'
),
canonical AS (
  SELECT i.id, i.company_id,
         substring(i.number FROM '^A-[0-9]{4}-(\d+)') AS numfac
  FROM public.invoices i
  CROSS JOIN yr
  WHERE i.number ~ ('^A-' || yr.y::text || '-[0-9]+')
    AND extract(year FROM i.issue_date) = yr.y
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
)
UPDATE public.invoices i
SET status = 'cancelled',
    notes = coalesce(i.notes, '') || E'\nDuplicado legacy A-N (canónica A-' || yr.y::text || '-N)',
    updated_at = now()
FROM legacy l
JOIN canonical c ON c.company_id = l.company_id AND c.numfac = l.numfac
CROSS JOIN yr
WHERE i.id = l.id;

-- Eliminar mapeos legacy sin prefijo ejefac cuando hay canónico 2026/ para el mismo numfac.
DELETE FROM dunasoft.style_sync_entity_map m
WHERE m.company_id = dunasoft.style_sync_hub_company_id()
  AND m.entity_type = 'invoice'
  AND m.style_key ~ '^A/[0-9]+/'
  AND NOT m.style_key ~ '^[0-9]{4}/'
  AND EXISTS (
    SELECT 1 FROM dunasoft.style_sync_entity_map c
    WHERE c.company_id = m.company_id
      AND c.entity_type = 'invoice'
      AND c.style_key LIKE '2026/A/' || split_part(m.style_key, '/', 2) || '/%'
  );
