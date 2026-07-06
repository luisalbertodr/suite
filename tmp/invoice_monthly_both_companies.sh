#!/bin/bash
# Totales facturación mes a mes: Suite (2 empresas) vs Style faccab
HUB='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
SL='816af484-92a0-4f65-a5a7-1c907aa4bb3d'

docker exec supabase-db psql -U postgres -d postgres -c "
WITH meses AS (
  SELECT to_char(i.issue_date, 'YYYY-MM') AS mes,
         round(sum(CASE WHEN i.company_id = '$HUB' THEN i.total_amount ELSE 0 END)::numeric, 2) AS lamas,
         round(sum(CASE WHEN i.company_id = '$SL' THEN i.total_amount ELSE 0 END)::numeric, 2) AS medicina,
         round(sum(i.total_amount)::numeric, 2) AS suite_total,
         count(*) FILTER (WHERE i.company_id = '$HUB') AS n_lamas,
         count(*) FILTER (WHERE i.company_id = '$SL') AS n_medicina
  FROM public.invoices i
  WHERE i.company_id IN ('$HUB', '$SL')
    AND coalesce(i.status, '') IS DISTINCT FROM 'cancelled'
  GROUP BY 1
)
SELECT * FROM meses ORDER BY mes DESC;
"
