#!/bin/bash
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT id, name FROM public.companies ORDER BY name;
"
docker exec supabase-db psql -U postgres -d postgres -c "
SELECT c.name,
       to_char(i.issue_date, 'YYYY-MM') AS mes,
       round(sum(i.total_amount)::numeric, 2) AS total,
       count(*) AS n
FROM public.invoices i
JOIN public.companies c ON c.id = i.company_id
WHERE i.status IS DISTINCT FROM 'cancelled'
GROUP BY c.name, to_char(i.issue_date, 'YYYY-MM')
ORDER BY c.name, mes DESC
LIMIT 40;
"
